-- Festacol Row Level Security for the canonical Prisma schema.
-- Apply after prisma migration and supabase/auth-rpc.sql.

BEGIN;

ALTER TABLE public.school_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.academic_years ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.academic_terms ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.academic_levels ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.classes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.class_enrollments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subjects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subject_curriculum_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.class_subject_offerings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.student_subject_enrollments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.staff_subject_qualifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.teaching_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.exam_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.exam_class_targets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.exam_offering_targets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.exam_placement_tracks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.exam_session_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.exam_qr_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.exam_staff_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.exam_student_access ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.exam_retake_grants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.exam_attempts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.exam_attempt_responses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.exam_integrity_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.question_academic_levels ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.question_blanks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.whatsapp_groups ENABLE ROW LEVEL SECURITY;

-- Make this integration file idempotent and ensure stale policies cannot survive
-- a contract change.
DO $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT schemaname,tablename,policyname
    FROM pg_policies
    WHERE schemaname='public'
      AND tablename = ANY(ARRAY[
        'school_members','academic_years','academic_terms','academic_levels','classes',
        'class_enrollments','subjects','subject_curriculum_rules','class_subject_offerings',
        'student_subject_enrollments','staff_subject_qualifications','teaching_assignments',
        'exam_sessions','exam_class_targets','exam_offering_targets','exam_placement_tracks',
        'exam_session_links','exam_qr_codes','exam_staff_assignments','exam_student_access',
        'exam_retake_grants','exam_attempts','exam_attempt_responses','exam_integrity_events',
        'questions','question_academic_levels','question_blanks','whatsapp_groups'
      ])
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON %I.%I',r.policyname,r.schemaname,r.tablename);
  END LOOP;
END $$;

GRANT USAGE ON SCHEMA public TO authenticated;

-- Self identity. No authenticated client can alter role, status, identifiers or
-- auth binding through the Data API.
GRANT SELECT ON public.school_members TO authenticated;
GRANT UPDATE(first_name,last_name,guardian,phone,updated_at)
  ON public.school_members TO authenticated;

-- Read-only academic catalog and relationships.
GRANT SELECT ON public.academic_years,public.academic_terms,public.academic_levels,
  public.classes,public.subjects,public.subject_curriculum_rules,
  public.class_enrollments,public.class_subject_offerings,
  public.student_subject_enrollments,public.staff_subject_qualifications,
  public.teaching_assignments TO authenticated;

GRANT SELECT ON public.exam_sessions,public.exam_class_targets,public.exam_offering_targets,
  public.exam_placement_tracks,public.exam_session_links,public.exam_qr_codes,
  public.exam_staff_assignments,public.exam_student_access,public.exam_retake_grants,
  public.exam_attempts TO authenticated;

-- Candidate runtime state lives directly on exam_attempts. Students can update
-- only transient runtime columns while an attempt is open.
GRANT UPDATE(
  current_index,remaining_seconds,elapsed_active_seconds,last_active_at,
  paper_fingerprint,question_ids,updated_at
) ON public.exam_attempts TO authenticated;

-- Students never receive write privilege for grading fields. After submission,
-- the row-level student SELECT policy also stops exposing response rows so
-- correct_answer cannot leak after server-side grading.
GRANT SELECT ON public.exam_attempt_responses TO authenticated;
GRANT INSERT(attempt_id,question_id,response_text,response_values,seconds,flagged,updated_at)
  ON public.exam_attempt_responses TO authenticated;
GRANT UPDATE(response_text,response_values,seconds,flagged,updated_at)
  ON public.exam_attempt_responses TO authenticated;

GRANT SELECT,INSERT ON public.exam_integrity_events TO authenticated;
GRANT USAGE,SELECT ON SEQUENCE public.exam_integrity_events_id_seq TO authenticated;

-- Question rows contain answer keys, so only staff policies below can expose
-- them. There is deliberately no student question policy.
GRANT SELECT ON public.questions,public.question_academic_levels,public.question_blanks
  TO authenticated;
GRANT SELECT ON public.whatsapp_groups TO authenticated;

-- Trusted server mutations use service_role.
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO service_role;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO service_role;

-- ---------------------------------------------------------------- self member
CREATE POLICY school_members_self_read ON public.school_members
  FOR SELECT TO authenticated
  USING (id = private.current_school_member_id());
CREATE POLICY school_members_self_update ON public.school_members
  FOR UPDATE TO authenticated
  USING (id = private.current_school_member_id())
  WITH CHECK (id = private.current_school_member_id());

-- --------------------------------------------------------------- catalog read
CREATE POLICY academic_years_read ON public.academic_years
  FOR SELECT TO authenticated USING (true);
CREATE POLICY academic_terms_read ON public.academic_terms
  FOR SELECT TO authenticated USING (true);
CREATE POLICY academic_levels_read ON public.academic_levels
  FOR SELECT TO authenticated USING (true);
CREATE POLICY classes_read ON public.classes
  FOR SELECT TO authenticated USING (true);
CREATE POLICY subjects_read ON public.subjects
  FOR SELECT TO authenticated USING (true);
CREATE POLICY subject_curriculum_rules_read ON public.subject_curriculum_rules
  FOR SELECT TO authenticated USING (true);

-- ---------------------------------------------------------- academic relations
CREATE POLICY class_enrollments_student_read ON public.class_enrollments
  FOR SELECT TO authenticated
  USING (student_id = private.current_school_member_id());
CREATE POLICY class_enrollments_staff_read ON public.class_enrollments
  FOR SELECT TO authenticated
  USING (private.staff_can_access_class(private.current_school_member_id(),class_id));

CREATE POLICY class_offerings_student_read ON public.class_subject_offerings
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.class_enrollments ce
      WHERE ce.class_id = class_subject_offerings.class_id
        AND ce.student_id = private.current_school_member_id()
        AND ce.status='active'
        AND ce.ended_at IS NULL
    )
  );
CREATE POLICY class_offerings_staff_read ON public.class_subject_offerings
  FOR SELECT TO authenticated
  USING (private.staff_can_access_class(private.current_school_member_id(),class_id));

CREATE POLICY student_subject_enrollments_student_read ON public.student_subject_enrollments
  FOR SELECT TO authenticated
  USING (student_id = private.current_school_member_id());
CREATE POLICY student_subject_enrollments_staff_read ON public.student_subject_enrollments
  FOR SELECT TO authenticated
  USING (
    private.is_admin()
    OR private.teacher_is_assigned_to_offering(private.current_school_member_id(),offering_id)
  );

CREATE POLICY staff_qualifications_self_read ON public.staff_subject_qualifications
  FOR SELECT TO authenticated
  USING (staff_id = private.current_school_member_id() OR private.is_admin());
CREATE POLICY teaching_assignments_self_read ON public.teaching_assignments
  FOR SELECT TO authenticated
  USING (staff_id = private.current_school_member_id() OR private.is_admin());

-- --------------------------------------------------------------- exam metadata
CREATE POLICY exam_sessions_student_read ON public.exam_sessions
  FOR SELECT TO authenticated
  USING (private.student_is_targeted_for_exam(id,private.current_school_member_id()));
CREATE POLICY exam_sessions_staff_read ON public.exam_sessions
  FOR SELECT TO authenticated
  USING (private.staff_can_access_exam(private.current_school_member_id(),id));

CREATE POLICY exam_class_targets_access_read ON public.exam_class_targets
  FOR SELECT TO authenticated
  USING (
    private.student_is_targeted_for_exam(session_id,private.current_school_member_id())
    OR private.staff_can_access_exam(private.current_school_member_id(),session_id)
  );
CREATE POLICY exam_offering_targets_access_read ON public.exam_offering_targets
  FOR SELECT TO authenticated
  USING (
    private.student_is_targeted_for_exam(session_id,private.current_school_member_id())
    OR private.staff_can_access_exam(private.current_school_member_id(),session_id)
  );
CREATE POLICY exam_placement_tracks_access_read ON public.exam_placement_tracks
  FOR SELECT TO authenticated
  USING (
    private.student_is_targeted_for_exam(session_id,private.current_school_member_id())
    OR private.staff_can_access_exam(private.current_school_member_id(),session_id)
  );
CREATE POLICY exam_staff_assignments_access_read ON public.exam_staff_assignments
  FOR SELECT TO authenticated
  USING (
    staff_id = private.current_school_member_id()
    OR private.staff_can_access_exam(private.current_school_member_id(),session_id)
  );
CREATE POLICY exam_student_access_access_read ON public.exam_student_access
  FOR SELECT TO authenticated
  USING (
    student_id = private.current_school_member_id()
    OR private.staff_can_access_exam(private.current_school_member_id(),session_id)
  );
CREATE POLICY exam_retake_grants_access_read ON public.exam_retake_grants
  FOR SELECT TO authenticated
  USING (
    student_id = private.current_school_member_id()
    OR private.staff_can_access_exam(private.current_school_member_id(),session_id)
  );

CREATE POLICY exam_session_links_access_read ON public.exam_session_links
  FOR SELECT TO authenticated
  USING (
    private.student_is_targeted_for_exam(session_id,private.current_school_member_id())
    OR private.staff_can_access_exam(private.current_school_member_id(),session_id)
  );
CREATE POLICY exam_qr_codes_access_read ON public.exam_qr_codes
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.exam_session_links l
      WHERE l.id = exam_qr_codes.link_id
        AND (
          private.student_is_targeted_for_exam(l.session_id,private.current_school_member_id())
          OR private.staff_can_access_exam(private.current_school_member_id(),l.session_id)
        )
    )
  );

-- ------------------------------------------------------------ attempt boundary
CREATE POLICY exam_attempts_student_read ON public.exam_attempts
  FOR SELECT TO authenticated
  USING (student_id = private.current_school_member_id());
CREATE POLICY exam_attempts_student_runtime_update ON public.exam_attempts
  FOR UPDATE TO authenticated
  USING (
    student_id = private.current_school_member_id()
    AND submitted_at IS NULL
  )
  WITH CHECK (
    student_id = private.current_school_member_id()
    AND submitted_at IS NULL
  );
CREATE POLICY exam_attempts_staff_read ON public.exam_attempts
  FOR SELECT TO authenticated
  USING (private.staff_can_access_exam(private.current_school_member_id(),session_id));

CREATE POLICY attempt_responses_student_read_open ON public.exam_attempt_responses
  FOR SELECT TO authenticated
  USING (
    graded_at IS NULL
    AND EXISTS (
      SELECT 1 FROM public.exam_attempts a
      WHERE a.id = exam_attempt_responses.attempt_id
        AND a.student_id = private.current_school_member_id()
        AND a.submitted_at IS NULL
    )
  );
CREATE POLICY attempt_responses_student_insert_open ON public.exam_attempt_responses
  FOR INSERT TO authenticated
  WITH CHECK (
    correct IS NULL
    AND correct_answer IS NULL
    AND graded_at IS NULL
    AND EXISTS (
      SELECT 1 FROM public.exam_attempts a
      WHERE a.id = exam_attempt_responses.attempt_id
        AND a.student_id = private.current_school_member_id()
        AND a.submitted_at IS NULL
    )
  );
CREATE POLICY attempt_responses_student_update_open ON public.exam_attempt_responses
  FOR UPDATE TO authenticated
  USING (
    graded_at IS NULL
    AND EXISTS (
      SELECT 1 FROM public.exam_attempts a
      WHERE a.id = exam_attempt_responses.attempt_id
        AND a.student_id = private.current_school_member_id()
        AND a.submitted_at IS NULL
    )
  )
  WITH CHECK (
    correct IS NULL
    AND correct_answer IS NULL
    AND graded_at IS NULL
    AND EXISTS (
      SELECT 1 FROM public.exam_attempts a
      WHERE a.id = exam_attempt_responses.attempt_id
        AND a.student_id = private.current_school_member_id()
        AND a.submitted_at IS NULL
    )
  );
CREATE POLICY attempt_responses_staff_read ON public.exam_attempt_responses
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.exam_attempts a
      WHERE a.id = exam_attempt_responses.attempt_id
        AND private.staff_can_access_exam(private.current_school_member_id(),a.session_id)
    )
  );

CREATE POLICY integrity_student_read ON public.exam_integrity_events
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.exam_attempts a
      WHERE a.id = exam_integrity_events.attempt_id
        AND a.student_id = private.current_school_member_id()
    )
  );
CREATE POLICY integrity_student_insert ON public.exam_integrity_events
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.exam_attempts a
      WHERE a.id = exam_integrity_events.attempt_id
        AND a.student_id = private.current_school_member_id()
        AND a.submitted_at IS NULL
    )
  );
CREATE POLICY integrity_staff_read ON public.exam_integrity_events
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.exam_attempts a
      WHERE a.id = exam_integrity_events.attempt_id
        AND private.staff_can_access_exam(private.current_school_member_id(),a.session_id)
    )
  );

-- ------------------------------------------------------------- question bank
CREATE POLICY questions_staff_read ON public.questions
  FOR SELECT TO authenticated
  USING (
    status='active'
    AND private.staff_can_access_subject(private.current_school_member_id(),subject_id)
  );
CREATE POLICY question_levels_staff_read ON public.question_academic_levels
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.questions q
      WHERE q.id = question_academic_levels.question_id
        AND private.staff_can_access_subject(private.current_school_member_id(),q.subject_id)
    )
  );
CREATE POLICY question_blanks_staff_read ON public.question_blanks
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.questions q
      WHERE q.id = question_blanks.question_id
        AND private.staff_can_access_subject(private.current_school_member_id(),q.subject_id)
    )
  );

-- --------------------------------------------------------------- communication
CREATE POLICY whatsapp_student_read ON public.whatsapp_groups
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.class_enrollments ce
      WHERE ce.class_id = whatsapp_groups.class_id
        AND ce.student_id = private.current_school_member_id()
        AND ce.status='active'
        AND ce.ended_at IS NULL
    )
  );
CREATE POLICY whatsapp_staff_read ON public.whatsapp_groups
  FOR SELECT TO authenticated
  USING (private.staff_can_access_class(private.current_school_member_id(),class_id));

COMMIT;
