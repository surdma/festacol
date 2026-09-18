-- Festacol Supabase platform integration for the canonical Prisma schema.
-- Prisma owns public tables. Supabase owns auth.users, auth.uid(), RLS and
-- SECURITY DEFINER RPCs. Apply this file only after `prisma migrate deploy`.

BEGIN;

CREATE SCHEMA IF NOT EXISTS private;

ALTER TABLE public.school_members
  DROP CONSTRAINT IF EXISTS school_members_auth_user_fk;
ALTER TABLE public.school_members
  ADD CONSTRAINT school_members_auth_user_fk
  FOREIGN KEY (auth_user_id) REFERENCES auth.users(id) ON DELETE SET NULL;

CREATE OR REPLACE FUNCTION private.current_school_member_id()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, auth
AS $$
  SELECT m.id
  FROM public.school_members m
  WHERE m.auth_user_id = auth.uid()
    AND m.status = 'active'
  LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION private.current_member_role()
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, auth
AS $$
  SELECT m.role::text
  FROM public.school_members m
  WHERE m.auth_user_id = auth.uid()
    AND m.status = 'active'
  LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION private.is_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, auth
AS $$
  SELECT COALESCE(private.current_member_role() = 'administrator', false);
$$;

CREATE OR REPLACE FUNCTION private.is_staff()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, auth
AS $$
  SELECT COALESCE(private.current_member_role() IN ('teacher','administrator'), false);
$$;

-- These RPCs are the public PostgREST boundary. Drop the legacy/profile-named
-- variants first so reapplying this integration file can also rename PostgreSQL
-- input parameters without CREATE OR REPLACE retaining the old argument names.
DROP FUNCTION IF EXISTS public.resolve_student_profile_by_name(text,text);
DROP FUNCTION IF EXISTS public.resolve_student_member_by_name(text,text);

CREATE FUNCTION public.resolve_student_member_by_name(
  p_first_name text,
  p_last_name text
)
RETURNS TABLE(
  member_id uuid,
  auth_user_id uuid,
  first_name text,
  last_name text,
  student_number text
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_first text := lower(regexp_replace(btrim(coalesce(p_first_name,'')), '\s+', ' ', 'g'));
  v_last text := lower(regexp_replace(btrim(coalesce(p_last_name,'')), '\s+', ' ', 'g'));
  v_count integer;
BEGIN
  IF v_first = '' OR v_last = '' THEN
    RETURN;
  END IF;

  SELECT count(*)::integer INTO v_count
  FROM public.school_members m
  WHERE m.role = 'student'
    AND m.status = 'active'
    AND lower(regexp_replace(btrim(m.first_name), '\s+', ' ', 'g')) = v_first
    AND lower(regexp_replace(btrim(m.last_name), '\s+', ' ', 'g')) = v_last;

  IF v_count > 1 THEN
    RAISE EXCEPTION 'student_identity_ambiguous';
  END IF;

  RETURN QUERY
  SELECT m.id,m.auth_user_id,m.first_name,m.last_name,m.student_number
  FROM public.school_members m
  WHERE m.role = 'student'
    AND m.status = 'active'
    AND lower(regexp_replace(btrim(m.first_name), '\s+', ' ', 'g')) = v_first
    AND lower(regexp_replace(btrim(m.last_name), '\s+', ' ', 'g')) = v_last
  LIMIT 1;
END;
$$;

-- Service-role-only atomic binding between a pre-provisioned student and an
-- existing Supabase Auth identity. It never creates a domain student record.
DROP FUNCTION IF EXISTS public.claim_student_auth_identity(uuid,uuid);

CREATE FUNCTION public.claim_student_auth_identity(
  p_member_id uuid,
  p_auth_user_id uuid
)
RETURNS boolean
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_member public.school_members%rowtype;
BEGIN
  SELECT * INTO v_member
  FROM public.school_members m
  WHERE m.id = p_member_id
  FOR UPDATE;

  IF NOT FOUND OR v_member.role <> 'student' OR v_member.status <> 'active' THEN
    RETURN false;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM auth.users u WHERE u.id = p_auth_user_id) THEN
    RETURN false;
  END IF;

  IF v_member.auth_user_id IS NOT NULL THEN
    RETURN v_member.auth_user_id = p_auth_user_id;
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.school_members m
    WHERE m.auth_user_id = p_auth_user_id
      AND m.id <> p_member_id
  ) THEN
    RETURN false;
  END IF;

  UPDATE public.school_members
  SET auth_user_id = p_auth_user_id, updated_at = now()
  WHERE id = p_member_id
    AND auth_user_id IS NULL;

  RETURN FOUND;
END;
$$;

-- A student is eligible for an offering when they are actively enrolled in the
-- offering's class and the subject is either required by the curriculum rule or
-- explicitly selected by the student as an elective.
CREATE OR REPLACE FUNCTION private.student_is_enrolled_in_offering(
  p_offering_id uuid,
  p_student_id uuid
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.class_subject_offerings o
    JOIN public.classes c ON c.id = o.class_id
    JOIN public.subject_curriculum_rules r
      ON r.subject_id = o.subject_id
     AND r.level_id = c.level_id
     AND r.track = c.track
    JOIN public.class_enrollments ce
      ON ce.class_id = c.id
     AND ce.student_id = p_student_id
     AND ce.status = 'active'
     AND ce.ended_at IS NULL
    WHERE o.id = p_offering_id
      AND o.status = 'active'
      AND (
        r.participation = 'required'
        OR EXISTS (
          SELECT 1
          FROM public.student_subject_enrollments sse
          WHERE sse.student_id = p_student_id
            AND sse.offering_id = o.id
            AND sse.status = 'active'
            AND sse.ended_at IS NULL
        )
      )
  );
$$;

CREATE OR REPLACE FUNCTION private.teacher_is_assigned_to_offering(
  p_staff_id uuid,
  p_offering_id uuid
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $staff_scope$
  SELECT EXISTS (
    SELECT 1
    FROM public.school_members m
    WHERE m.id = p_staff_id
      AND m.status = 'active'
      AND (
        m.role = 'administrator'
        OR (
          m.role = 'teacher'
          AND EXISTS (
            SELECT 1
            FROM public.teaching_assignments ta
            JOIN public.class_subject_offerings o ON o.id = ta.offering_id
            JOIN public.staff_subject_qualifications q
              ON q.staff_id = ta.staff_id
             AND q.subject_id = o.subject_id
             AND q.active = true
            WHERE ta.staff_id = p_staff_id
              AND ta.offering_id = p_offering_id
              AND ta.ended_at IS NULL
              AND o.status = 'active'
          )
        )
      )
  );
$staff_scope$;

CREATE OR REPLACE FUNCTION private.staff_can_access_class(
  p_staff_id uuid,
  p_class_id text
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $staff_scope$
  SELECT EXISTS (
    SELECT 1
    FROM public.school_members m
    WHERE m.id = p_staff_id
      AND m.status = 'active'
      AND (
        m.role = 'administrator'
        OR (
          m.role = 'teacher'
          AND EXISTS (
            SELECT 1
            FROM public.teaching_assignments ta
            JOIN public.class_subject_offerings o ON o.id = ta.offering_id
            JOIN public.staff_subject_qualifications q
              ON q.staff_id = ta.staff_id
             AND q.subject_id = o.subject_id
             AND q.active = true
            WHERE ta.staff_id = p_staff_id
              AND ta.ended_at IS NULL
              AND o.class_id = p_class_id
              AND o.status = 'active'
          )
        )
      )
  );
$staff_scope$;

CREATE OR REPLACE FUNCTION private.staff_can_access_subject(
  p_staff_id uuid,
  p_subject_id uuid
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $staff_scope$
  SELECT EXISTS (
    SELECT 1
    FROM public.school_members m
    WHERE m.id = p_staff_id
      AND m.status = 'active'
      AND (
        m.role = 'administrator'
        OR (
          m.role = 'teacher'
          AND EXISTS (
            SELECT 1
            FROM public.staff_subject_qualifications q
            WHERE q.staff_id = p_staff_id
              AND q.subject_id = p_subject_id
              AND q.active = true
          )
        )
      )
  );
$staff_scope$;

CREATE OR REPLACE FUNCTION private.staff_can_access_exam(
  p_staff_id uuid,
  p_session_id text
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $staff_scope$
  WITH actor AS (
    SELECT m.role
    FROM public.school_members m
    WHERE m.id = p_staff_id
      AND m.status = 'active'
      AND m.role IN ('teacher', 'administrator')
  ),
  exam_row AS (
    SELECT e.mode
    FROM public.exam_sessions e
    WHERE e.id = p_session_id
  ),
  exam_subjects AS (
    SELECT t.subject_id
    FROM public.exam_subject_targets t
    WHERE t.session_id = p_session_id
    UNION
    SELECT o.subject_id
    FROM public.exam_offering_targets t
    JOIN public.class_subject_offerings o ON o.id = t.offering_id
    WHERE t.session_id = p_session_id
  )
  SELECT
    EXISTS (SELECT 1 FROM actor WHERE role = 'administrator')
    OR (
      EXISTS (SELECT 1 FROM actor WHERE role = 'teacher')
      AND (
        EXISTS (SELECT 1 FROM exam_row WHERE mode = 'qualifier')
        OR (
          EXISTS (SELECT 1 FROM exam_subjects)
          AND NOT EXISTS (
            SELECT 1
            FROM exam_subjects s
            WHERE NOT EXISTS (
              SELECT 1
              FROM public.staff_subject_qualifications q
              WHERE q.staff_id = p_staff_id
                AND q.subject_id = s.subject_id
                AND q.active = true
            )
          )
        )
      )
    );
$staff_scope$;

CREATE OR REPLACE FUNCTION private.student_is_targeted_for_exam(
  p_session_id text,
  p_student_id uuid
)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_decision text;
BEGIN
  SELECT a.decision::text INTO v_decision
  FROM public.exam_student_access a
  WHERE a.session_id = p_session_id
    AND a.student_id = p_student_id
    AND (a.valid_from IS NULL OR a.valid_from <= now())
    AND (a.valid_until IS NULL OR a.valid_until >= now())
  LIMIT 1;

  IF v_decision = 'deny' THEN RETURN false; END IF;
  IF v_decision = 'allow' THEN RETURN true; END IF;

  IF EXISTS (
    SELECT 1 FROM public.exam_offering_targets t WHERE t.session_id = p_session_id
  ) THEN
    RETURN EXISTS (
      SELECT 1
      FROM public.exam_offering_targets t
      WHERE t.session_id = p_session_id
        AND private.student_is_enrolled_in_offering(t.offering_id,p_student_id)
    );
  END IF;

  RETURN EXISTS (
    SELECT 1
    FROM public.exam_class_targets t
    JOIN public.class_enrollments ce
      ON ce.class_id = t.class_id
     AND ce.student_id = p_student_id
     AND ce.status = 'active'
     AND ce.ended_at IS NULL
    WHERE t.session_id = p_session_id
  );
END;
$$;

CREATE OR REPLACE FUNCTION private.student_level_ordinal(
  p_student_id uuid
)
RETURNS integer
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    (
      SELECT l.ordinal
      FROM public.class_enrollments ce
      JOIN public.classes c ON c.id = ce.class_id
      JOIN public.academic_levels l ON l.id = c.level_id
      WHERE ce.student_id = p_student_id
        AND ce.status = 'active'
        AND ce.ended_at IS NULL
      ORDER BY l.ordinal DESC
      LIMIT 1
    ),
    -- Unassigned students (zero active class_enrollments) sit in the SS1
    -- holding pool: ordinal 1. They may enter SS1 exams and placement
    -- (qualifier) exams but never SS2+ class exams.
    1
  );
$$;

-- Minimum target level ordinal for an exam, resolved across direct class
-- targets and classes behind offering targets. NULL when the exam targets no
-- class (placement/qualifier exams admit anyone).
CREATE OR REPLACE FUNCTION private.exam_min_target_ordinal(
  p_session_id text
)
RETURNS integer
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT min(l.ordinal)
  FROM (
    SELECT t.class_id AS class_id
    FROM public.exam_class_targets t
    WHERE t.session_id = upper(p_session_id)
    UNION
    SELECT o.class_id AS class_id
    FROM public.exam_offering_targets t
    JOIN public.class_subject_offerings o ON o.id = t.offering_id
    WHERE t.session_id = upper(p_session_id)
  ) targets
  JOIN public.classes c ON c.id = targets.class_id
  JOIN public.academic_levels l ON l.id = c.level_id;
$$;

CREATE OR REPLACE FUNCTION private.student_allowed_attempts(
  p_session_id text,
  p_student_id uuid
)
RETURNS integer
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT greatest(
    0,
    coalesce(
      (
        SELECT a.max_attempts_override
        FROM public.exam_student_access a
        WHERE a.session_id = p_session_id
          AND a.student_id = p_student_id
          AND a.decision = 'allow'
          AND (a.valid_from IS NULL OR a.valid_from <= now())
          AND (a.valid_until IS NULL OR a.valid_until >= now())
      ),
      (SELECT e.attempt_limit FROM public.exam_sessions e WHERE e.id = p_session_id),
      0
    )
    + coalesce(
      (
        SELECT sum(r.additional_attempts)::integer
        FROM public.exam_retake_grants r
        WHERE r.session_id = p_session_id
          AND r.student_id = p_student_id
          AND r.revoked_at IS NULL
          AND (r.expires_at IS NULL OR r.expires_at >= now())
      ),
      0
    )
  );
$$;

CREATE OR REPLACE FUNCTION public.my_exam_access(p_session_id text)
RETURNS TABLE(
  eligible boolean,
  allowed_attempts integer,
  used_attempts integer,
  active_attempt_id uuid,
  denial_reason text
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public,private
AS $$
DECLARE
  v_student uuid := private.current_school_member_id();
  v_status text;
  v_starts bigint;
  v_ends bigint;
  v_now bigint := (extract(epoch FROM now()) * 1000)::bigint;
BEGIN
  IF v_student IS NULL OR NOT EXISTS (
    SELECT 1 FROM public.school_members m
    WHERE m.id=v_student AND m.role='student' AND m.status='active'
  ) THEN
    RETURN QUERY SELECT false,0,0,NULL::uuid,'not_authenticated'::text;
    RETURN;
  END IF;

  SELECT e.status::text,e.starts_at,e.ends_at
  INTO v_status,v_starts,v_ends
  FROM public.exam_sessions e
  WHERE e.id = upper(p_session_id);

  IF NOT FOUND THEN
    RETURN QUERY SELECT false,0,0,NULL::uuid,'not_found'::text;
    RETURN;
  END IF;
  IF v_status <> 'open' THEN
    RETURN QUERY SELECT false,0,0,NULL::uuid,'not_open'::text;
    RETURN;
  END IF;
  IF v_starts IS NOT NULL AND v_now < v_starts THEN
    RETURN QUERY SELECT false,0,0,NULL::uuid,'not_started'::text;
    RETURN;
  END IF;
  IF v_ends IS NOT NULL AND v_now > v_ends THEN
    RETURN QUERY SELECT false,0,0,NULL::uuid,'ended'::text;
    RETURN;
  END IF;
  IF NOT private.student_is_targeted_for_exam(upper(p_session_id),v_student) THEN
    RETURN QUERY SELECT false,0,0,NULL::uuid,'not_eligible'::text;
    RETURN;
  END IF;
  -- Level gate: a lower-level student (e.g. SS1-enrolled) attempting a
  -- higher-level class exam (e.g. SS2-targeted) is not qualified. Deny rows
  -- still win above; explicit allow grants do not bypass this gate. Qualifier
  -- exams carry no class targets, so the NULL ordinal leaves them open.
  IF (SELECT private.exam_min_target_ordinal(upper(p_session_id))) IS NOT NULL
    AND private.student_level_ordinal(v_student)
      < (SELECT private.exam_min_target_ordinal(upper(p_session_id))) THEN
    RETURN QUERY SELECT false,0,0,NULL::uuid,'not_qualified'::text;
    RETURN;
  END IF;

  RETURN QUERY
  SELECT
    true,
    private.student_allowed_attempts(upper(p_session_id),v_student),
    count(*)::integer,
    (array_agg(a.id ORDER BY a.attempt_number DESC) FILTER (WHERE a.submitted_at IS NULL))[1],
    NULL::text
  FROM public.exam_attempts a
  WHERE a.session_id = upper(p_session_id)
    AND a.student_id = v_student;
END;
$$;

CREATE OR REPLACE FUNCTION public.allocate_my_exam_attempt(p_session_id text)
RETURNS TABLE(attempt_id uuid,attempt_number integer,resumed boolean)
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public,private
AS $$
DECLARE
  v_student uuid := private.current_school_member_id();
  v_session public.exam_sessions%rowtype;
  v_allowed integer;
  v_used integer;
  v_attempt_id uuid;
  v_attempt_number integer;
  v_now bigint := (extract(epoch FROM clock_timestamp()) * 1000)::bigint;
BEGIN
  IF v_student IS NULL OR NOT EXISTS (
    SELECT 1 FROM public.school_members m
    WHERE m.id=v_student AND m.role='student' AND m.status='active'
  ) THEN
    RAISE EXCEPTION 'student_member_required';
  END IF;

  SELECT * INTO v_session
  FROM public.exam_sessions e
  WHERE e.id = upper(p_session_id);

  IF NOT FOUND THEN RAISE EXCEPTION 'exam_not_found'; END IF;
  IF v_session.status <> 'open' THEN RAISE EXCEPTION 'exam_not_open'; END IF;
  IF v_session.starts_at IS NOT NULL AND v_now < v_session.starts_at THEN RAISE EXCEPTION 'exam_not_started'; END IF;
  IF v_session.ends_at IS NOT NULL AND v_now > v_session.ends_at THEN RAISE EXCEPTION 'exam_ended'; END IF;
  IF NOT private.student_is_targeted_for_exam(v_session.id,v_student) THEN RAISE EXCEPTION 'student_not_eligible'; END IF;
  IF (SELECT private.exam_min_target_ordinal(v_session.id)) IS NOT NULL
    AND private.student_level_ordinal(v_student)
      < (SELECT private.exam_min_target_ordinal(v_session.id)) THEN RAISE EXCEPTION 'student_not_qualified'; END IF;

  PERFORM pg_advisory_xact_lock(hashtextextended(v_session.id || ':' || v_student::text,0));

  SELECT a.id,a.attempt_number
  INTO v_attempt_id,v_attempt_number
  FROM public.exam_attempts a
  WHERE a.session_id = v_session.id
    AND a.student_id = v_student
    AND a.submitted_at IS NULL
  ORDER BY a.attempt_number DESC
  LIMIT 1;

  IF FOUND THEN
    RETURN QUERY SELECT v_attempt_id,v_attempt_number,true;
    RETURN;
  END IF;

  v_allowed := private.student_allowed_attempts(v_session.id,v_student);
  SELECT count(*)::integer INTO v_used
  FROM public.exam_attempts a
  WHERE a.session_id = v_session.id
    AND a.student_id = v_student;

  IF v_used >= v_allowed THEN RAISE EXCEPTION 'attempt_limit_reached'; END IF;

  v_attempt_id := gen_random_uuid();
  v_attempt_number := v_used + 1;
  INSERT INTO public.exam_attempts(
    id,session_id,student_id,attempt_number,context_snapshot,started_at,
    current_index,remaining_seconds,elapsed_active_seconds,last_active_at,
    paper_fingerprint,question_ids,created_at,updated_at
  ) VALUES (
    v_attempt_id,v_session.id,v_student,v_attempt_number,
    jsonb_build_object(
      'sessionTitle',v_session.title,
      'studentName',(SELECT concat_ws(' ',m.first_name,m.last_name) FROM public.school_members m WHERE m.id=v_student),
      'mode',v_session.mode::text,
      'durationSeconds',v_session.duration_seconds,
      'questionCount',v_session.question_count,
      'allowFillQuestions',v_session.allow_fill_questions
    ),
    v_now,0,v_session.duration_seconds,0,v_now,'','{}'::bigint[],v_now,v_now
  );

  RETURN QUERY SELECT v_attempt_id,v_attempt_number,false;
END;
$$;

DROP FUNCTION IF EXISTS public.grant_exam_retake(text,uuid,integer,text);

CREATE FUNCTION public.grant_exam_retake(
  p_session_id text,
  p_student_id uuid,
  p_additional_attempts integer DEFAULT 1,
  p_reason text DEFAULT ''
)
RETURNS uuid
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public,private
AS $$
DECLARE
  v_staff uuid := private.current_school_member_id();
  v_id uuid;
BEGIN
  IF v_staff IS NULL OR NOT private.staff_can_access_exam(v_staff,upper(p_session_id)) THEN
    RAISE EXCEPTION 'exam_staff_access_required';
  END IF;
  IF p_additional_attempts < 1 OR p_additional_attempts > 10 THEN
    RAISE EXCEPTION 'invalid_retake_count';
  END IF;
  IF NOT private.student_is_targeted_for_exam(upper(p_session_id),p_student_id) THEN
    RAISE EXCEPTION 'student_not_eligible';
  END IF;

  INSERT INTO public.exam_retake_grants(
    session_id,student_id,additional_attempts,granted_by_id,reason
  ) VALUES (
    upper(p_session_id),p_student_id,p_additional_attempts,v_staff,left(coalesce(p_reason,''),500)
  ) RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;

REVOKE ALL ON FUNCTION private.current_school_member_id() FROM PUBLIC;
REVOKE ALL ON FUNCTION private.current_member_role() FROM PUBLIC;
REVOKE ALL ON FUNCTION private.is_admin() FROM PUBLIC;
REVOKE ALL ON FUNCTION private.is_staff() FROM PUBLIC;
REVOKE ALL ON FUNCTION private.student_is_enrolled_in_offering(uuid,uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION private.teacher_is_assigned_to_offering(uuid,uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION private.staff_can_access_class(uuid,text) FROM PUBLIC;
REVOKE ALL ON FUNCTION private.staff_can_access_subject(uuid,uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION private.staff_can_access_exam(uuid,text) FROM PUBLIC;
REVOKE ALL ON FUNCTION private.student_is_targeted_for_exam(text,uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION private.student_allowed_attempts(text,uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION private.student_level_ordinal(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION private.exam_min_target_ordinal(text) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION private.current_school_member_id() TO authenticated;
GRANT EXECUTE ON FUNCTION private.current_member_role() TO authenticated;
GRANT EXECUTE ON FUNCTION private.is_admin() TO authenticated;
GRANT EXECUTE ON FUNCTION private.is_staff() TO authenticated;
GRANT EXECUTE ON FUNCTION private.student_is_enrolled_in_offering(uuid,uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION private.teacher_is_assigned_to_offering(uuid,uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION private.staff_can_access_class(uuid,text) TO authenticated;
GRANT EXECUTE ON FUNCTION private.staff_can_access_subject(uuid,uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION private.staff_can_access_exam(uuid,text) TO authenticated;
GRANT EXECUTE ON FUNCTION private.student_is_targeted_for_exam(text,uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION private.student_allowed_attempts(text,uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION private.student_level_ordinal(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION private.exam_min_target_ordinal(text) TO authenticated;

REVOKE ALL ON FUNCTION public.resolve_student_member_by_name(text,text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.resolve_student_member_by_name(text,text) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.resolve_student_member_by_name(text,text) TO service_role;

REVOKE ALL ON FUNCTION public.claim_student_auth_identity(uuid,uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.claim_student_auth_identity(uuid,uuid) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.claim_student_auth_identity(uuid,uuid) TO service_role;

REVOKE ALL ON FUNCTION public.my_exam_access(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.my_exam_access(text) TO authenticated;

REVOKE ALL ON FUNCTION public.allocate_my_exam_attempt(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.allocate_my_exam_attempt(text) TO authenticated;

REVOKE ALL ON FUNCTION public.grant_exam_retake(text,uuid,integer,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.grant_exam_retake(text,uuid,integer,text) TO authenticated;

COMMIT;
