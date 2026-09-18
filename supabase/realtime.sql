-- Supabase Realtime integration for exam lifecycle notifications and presence.
-- Durable truth remains in public.exam_retake_grants and public.exam_attempts.
-- Broadcast delivers scoped notifications; Presence reports only ephemeral online state.

BEGIN;

-- Keep Postgres Changes publication membership available for low-volume diagnostics and
-- backwards compatibility. Product notifications below use private Broadcast channels.
DO $$
DECLARE
  v_all_tables boolean;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime'
  ) THEN
    EXECUTE 'CREATE PUBLICATION supabase_realtime';
  END IF;

  SELECT puballtables INTO v_all_tables
  FROM pg_publication
  WHERE pubname = 'supabase_realtime';

  IF NOT coalesce(v_all_tables, false) THEN
    IF NOT EXISTS (
      SELECT 1 FROM pg_publication_tables
      WHERE pubname = 'supabase_realtime'
        AND schemaname = 'public'
        AND tablename = 'exam_retake_grants'
    ) THEN
      EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE public.exam_retake_grants';
    END IF;

    IF NOT EXISTS (
      SELECT 1 FROM pg_publication_tables
      WHERE pubname = 'supabase_realtime'
        AND schemaname = 'public'
        AND tablename = 'exam_attempts'
    ) THEN
      EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE public.exam_attempts';
    END IF;
  END IF;
END $$;

-- --------------------------------------------------------------- retake lineage invariant
-- A newly allocated attempt that exceeds the student's ordinary attempt allowance is a
-- retake. Preserve the immediately preceding submitted attempt as its durable source.
CREATE OR REPLACE FUNCTION private.link_exam_retake_source()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public,private
AS $$
DECLARE
  v_base_allowed integer;
  v_source_attempt uuid;
  v_now bigint := (extract(epoch FROM clock_timestamp()) * 1000)::bigint;
BEGIN
  IF NEW.rewrite_source_attempt_id IS NOT NULL THEN
    RETURN NEW;
  END IF;

  SELECT greatest(
    0,
    coalesce(
      (
        SELECT a.max_attempts_override
        FROM public.exam_student_access a
        WHERE a.session_id = NEW.session_id
          AND a.student_id = NEW.student_id
          AND a.decision = 'allow'
          AND (a.valid_from IS NULL OR a.valid_from <= now())
          AND (a.valid_until IS NULL OR a.valid_until >= now())
      ),
      e.attempt_limit,
      0
    )
  )
  INTO v_base_allowed
  FROM public.exam_sessions e
  WHERE e.id = NEW.session_id;

  IF NEW.attempt_number <= coalesce(v_base_allowed,0) THEN
    RETURN NEW;
  END IF;

  SELECT a.id
  INTO v_source_attempt
  FROM public.exam_attempts a
  WHERE a.session_id = NEW.session_id
    AND a.student_id = NEW.student_id
    AND a.id <> NEW.id
    AND a.submitted_at IS NOT NULL
    AND a.attempt_number < NEW.attempt_number
  ORDER BY a.attempt_number DESC
  LIMIT 1;

  IF v_source_attempt IS NOT NULL THEN
    UPDATE public.exam_attempts
    SET rewrite_source_attempt_id = v_source_attempt,
        updated_at = greatest(updated_at,v_now)
    WHERE id = NEW.id
      AND rewrite_source_attempt_id IS NULL;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS exam_attempt_retake_source_link ON public.exam_attempts;
CREATE TRIGGER exam_attempt_retake_source_link
AFTER INSERT ON public.exam_attempts
FOR EACH ROW
EXECUTE FUNCTION private.link_exam_retake_source();

-- ---------------------------------------------------------------- broadcast producers
-- A retake grant is sent only to the affected student's private notification topic.
CREATE OR REPLACE FUNCTION private.broadcast_exam_retake_event()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public,private,realtime
AS $$
DECLARE
  v_session_title text;
  v_status text;
BEGIN
  SELECT e.title INTO v_session_title
  FROM public.exam_sessions e
  WHERE e.id = NEW.session_id;

  v_status := CASE
    WHEN NEW.revoked_at IS NOT NULL THEN 'revoked'
    WHEN NEW.expires_at IS NOT NULL AND NEW.expires_at <= now() THEN 'expired'
    ELSE 'active'
  END;

  PERFORM realtime.send(
    jsonb_build_object(
      'eventId', gen_random_uuid()::text,
      'grantId', NEW.id,
      'sessionId', NEW.session_id,
      'sessionTitle', coalesce(v_session_title, 'Examination'),
      'studentId', NEW.student_id,
      'additionalAttempts', NEW.additional_attempts,
      'reason', NEW.reason,
      'status', v_status,
      'grantedAt', NEW.granted_at,
      'expiresAt', NEW.expires_at,
      'revokedAt', NEW.revoked_at
    ),
    'exam_retake_changed',
    'student:' || NEW.student_id::text || ':exam',
    true
  );

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS exam_retake_realtime_notify ON public.exam_retake_grants;
CREATE TRIGGER exam_retake_realtime_notify
AFTER INSERT OR UPDATE OF additional_attempts,reason,expires_at,revoked_at
ON public.exam_retake_grants
FOR EACH ROW
EXECUTE FUNCTION private.broadcast_exam_retake_event();

-- Start/submission events are fan-out broadcasts to every active staff member who can
-- legitimately access the examination, plus the owning student so the candidate page can
-- attach/detach its Presence state without client-side polling.
CREATE OR REPLACE FUNCTION private.broadcast_exam_attempt_lifecycle()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public,private,realtime
AS $$
DECLARE
  v_started boolean := false;
  v_submitted boolean := false;
  v_session_title text;
  v_student_name text;
  v_recipient uuid;
  v_payload jsonb;
BEGIN
  IF TG_OP = 'INSERT' THEN
    v_started := NEW.started_at IS NOT NULL;
    v_submitted := NEW.submitted_at IS NOT NULL;
  ELSE
    v_started := OLD.started_at IS NULL AND NEW.started_at IS NOT NULL;
    v_submitted := OLD.submitted_at IS NULL AND NEW.submitted_at IS NOT NULL;
  END IF;

  IF NOT v_started AND NOT v_submitted THEN
    RETURN NEW;
  END IF;

  SELECT e.title
  INTO v_session_title
  FROM public.exam_sessions e
  WHERE e.id = NEW.session_id;

  SELECT concat_ws(' ',m.first_name,m.last_name)
  INTO v_student_name
  FROM public.school_members m
  WHERE m.id = NEW.student_id;

  -- The student's personal channel never exposes another candidate's lifecycle data.
  IF v_started THEN
    v_payload := jsonb_build_object(
      'eventId', 'start:' || NEW.id::text || ':' || coalesce(NEW.started_at,0)::text,
      'eventType', 'exam_started',
      'attemptId', NEW.id,
      'attemptNumber', NEW.attempt_number,
      'sessionId', NEW.session_id,
      'sessionTitle', coalesce(v_session_title, 'Examination'),
      'studentId', NEW.student_id,
      'studentName', coalesce(nullif(v_student_name,''), 'Student'),
      'startedAt', NEW.started_at
    );
    PERFORM realtime.send(v_payload,'exam_started','student:' || NEW.student_id::text || ':exam',true);
  END IF;

  IF v_submitted THEN
    v_payload := jsonb_build_object(
      'eventId', 'submit:' || NEW.id::text || ':' || coalesce(NEW.submitted_at,0)::text,
      'eventType', 'exam_submitted',
      'attemptId', NEW.id,
      'attemptNumber', NEW.attempt_number,
      'sessionId', NEW.session_id,
      'sessionTitle', coalesce(v_session_title, 'Examination'),
      'studentId', NEW.student_id,
      'studentName', coalesce(nullif(v_student_name,''), 'Student'),
      'startedAt', NEW.started_at,
      'submittedAt', NEW.submitted_at,
      'score', NEW.score,
      'completion', NEW.completion
    );
    PERFORM realtime.send(v_payload,'exam_submitted','student:' || NEW.student_id::text || ':exam',true);
  END IF;

  -- Reuse the same durable authorization rule as RLS so realtime never widens or
  -- narrows a teacher's subject-scoped workspace independently.
  FOR v_recipient IN
    SELECT m.id
    FROM public.school_members m
    WHERE m.status = 'active'
      AND m.role IN ('teacher','administrator')
      AND private.staff_can_access_exam(m.id,NEW.session_id)
  LOOP
    IF v_started THEN
      v_payload := jsonb_build_object(
        'eventId', 'start:' || NEW.id::text || ':' || coalesce(NEW.started_at,0)::text,
        'eventType', 'exam_started',
        'attemptId', NEW.id,
        'attemptNumber', NEW.attempt_number,
        'sessionId', NEW.session_id,
        'sessionTitle', coalesce(v_session_title, 'Examination'),
        'studentId', NEW.student_id,
        'studentName', coalesce(nullif(v_student_name,''), 'Student'),
        'startedAt', NEW.started_at
      );
      PERFORM realtime.send(v_payload,'exam_started','staff:' || v_recipient::text || ':exam',true);
    END IF;

    IF v_submitted THEN
      v_payload := jsonb_build_object(
        'eventId', 'submit:' || NEW.id::text || ':' || coalesce(NEW.submitted_at,0)::text,
        'eventType', 'exam_submitted',
        'attemptId', NEW.id,
        'attemptNumber', NEW.attempt_number,
        'sessionId', NEW.session_id,
        'sessionTitle', coalesce(v_session_title, 'Examination'),
        'studentId', NEW.student_id,
        'studentName', coalesce(nullif(v_student_name,''), 'Student'),
        'startedAt', NEW.started_at,
        'submittedAt', NEW.submitted_at,
        'score', NEW.score,
        'completion', NEW.completion
      );
      PERFORM realtime.send(v_payload,'exam_submitted','staff:' || v_recipient::text || ':exam',true);
    END IF;
  END LOOP;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS exam_attempt_lifecycle_realtime_notify ON public.exam_attempts;
CREATE TRIGGER exam_attempt_lifecycle_realtime_notify
AFTER INSERT OR UPDATE OF started_at,submitted_at
ON public.exam_attempts
FOR EACH ROW
EXECUTE FUNCTION private.broadcast_exam_attempt_lifecycle();

-- Candidate support requests are durable rows. Broadcast only to the staff member who
-- created the examination; the bell can reconstruct the same message from the durable row.
CREATE OR REPLACE FUNCTION private.broadcast_exam_support_request()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public,private,realtime
AS $$
DECLARE
  v_session_title text;
BEGIN
  SELECT e.title INTO v_session_title
  FROM public.exam_sessions e
  WHERE e.id = NEW.session_id;

  PERFORM realtime.send(
    jsonb_build_object(
      'eventId', 'support:' || NEW.id::text,
      'requestId', NEW.id,
      'sessionId', NEW.session_id,
      'sessionTitle', coalesce(v_session_title, 'Examination'),
      'requesterName', NEW.requester_name,
      'category', NEW.category,
      'message', NEW.message,
      'createdAt', NEW.created_at
    ),
    'exam_help_requested',
    'staff:' || NEW.recipient_staff_id::text || ':exam',
    true
  );

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS exam_support_request_realtime_notify ON public.exam_support_requests;
CREATE TRIGGER exam_support_request_realtime_notify
AFTER INSERT ON public.exam_support_requests
FOR EACH ROW
EXECUTE FUNCTION private.broadcast_exam_support_request();

-- Exam availability changes fan out to every student who already has an attempt for
-- the session. Active writers receive the close event immediately; previously submitted
-- candidates receive the same event so their dashboard can refresh its durable signal.
CREATE OR REPLACE FUNCTION private.broadcast_exam_session_event()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public,private,realtime
AS $$
DECLARE
  v_recipient uuid;
  v_payload jsonb;
BEGIN
  IF OLD.status IS NOT DISTINCT FROM NEW.status THEN
    RETURN NEW;
  END IF;

  v_payload := jsonb_build_object(
    'eventId', 'session:' || NEW.id || ':' || NEW.updated_at::text,
    'sessionId', NEW.id,
    'sessionTitle', NEW.title,
    'status', NEW.status::text,
    'previousStatus', OLD.status::text,
    'updatedAt', NEW.updated_at
  );

  FOR v_recipient IN
    SELECT DISTINCT a.student_id
    FROM public.exam_attempts a
    WHERE a.session_id = NEW.id
  LOOP
    PERFORM realtime.send(
      v_payload,
      'exam_session_changed',
      'student:' || v_recipient::text || ':exam',
      true
    );
  END LOOP;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS exam_session_realtime_notify ON public.exam_sessions;
CREATE TRIGGER exam_session_realtime_notify
AFTER UPDATE OF status ON public.exam_sessions
FOR EACH ROW
EXECUTE FUNCTION private.broadcast_exam_session_event();

-- ---------------------------------------------------------------- authorization
-- Supabase owns realtime.messages and already enables RLS on it. Only policies are managed here.
DROP POLICY IF EXISTS festacol_realtime_receive ON realtime.messages;
CREATE POLICY festacol_realtime_receive
ON realtime.messages
FOR SELECT
TO authenticated
USING (
  (
    realtime.messages.extension = 'broadcast'
    AND (
      (
        private.current_member_role() = 'student'
        AND (SELECT realtime.topic()) = 'student:' || private.current_school_member_id()::text || ':exam'
      )
      OR (
        private.current_member_role() IN ('teacher','administrator')
        AND (SELECT realtime.topic()) = 'staff:' || private.current_school_member_id()::text || ':exam'
      )
    )
  )
  OR (
    realtime.messages.extension = 'presence'
    AND split_part((SELECT realtime.topic()),':',1) = 'exam'
    AND split_part((SELECT realtime.topic()),':',3) = 'presence'
    AND private.current_member_role() IN ('teacher','administrator')
    AND private.staff_can_access_exam(
      private.current_school_member_id(),
      upper(split_part((SELECT realtime.topic()),':',2))
    )
  )
);

DROP POLICY IF EXISTS festacol_realtime_presence_track ON realtime.messages;
CREATE POLICY festacol_realtime_presence_track
ON realtime.messages
FOR INSERT
TO authenticated
WITH CHECK (
  realtime.messages.extension = 'presence'
  AND split_part((SELECT realtime.topic()),':',1) = 'exam'
  AND split_part((SELECT realtime.topic()),':',3) = 'presence'
  AND (
    (
      private.current_member_role() = 'student'
      AND EXISTS (
        SELECT 1
        FROM public.exam_attempts a
        WHERE a.session_id = upper(split_part((SELECT realtime.topic()),':',2))
          AND a.student_id = private.current_school_member_id()
          AND a.submitted_at IS NULL
      )
    )
    OR (
      private.current_member_role() IN ('teacher','administrator')
      AND private.staff_can_access_exam(
        private.current_school_member_id(),
        upper(split_part((SELECT realtime.topic()),':',2))
      )
    )
  )
);

COMMIT;