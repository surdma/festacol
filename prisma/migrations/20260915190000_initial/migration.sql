-- Festacol canonical initial schema.
-- This migration creates the final relational model directly. There is no
-- compatibility/baseline chain: legacy Supabase schemas are intentionally not
-- replayed.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TYPE member_role AS ENUM ('student','teacher','administrator');
CREATE TYPE record_status AS ENUM ('active','inactive');
CREATE TYPE student_progress_status AS ENUM ('on-track','promoted','repeating','graduated','withdrawn');
CREATE TYPE academic_period_status AS ENUM ('planned','active','closed','archived');
CREATE TYPE academic_track AS ENUM ('science','humanities','business');
CREATE TYPE subject_kind AS ENUM ('curriculum','qualifier');
CREATE TYPE enrollment_status AS ENUM ('active','completed','withdrawn','transferred','ended');
CREATE TYPE offering_participation AS ENUM ('required','elective');
CREATE TYPE offering_status AS ENUM ('draft','active','ended');
CREATE TYPE teaching_assignment_role AS ENUM ('teacher','head_teacher','assistant');
CREATE TYPE exam_mode AS ENUM ('qualifier','bece','waec','neco','jamb','mixed','single');
CREATE TYPE exam_status AS ENUM ('draft','open','closed');
CREATE TYPE exam_staff_role AS ENUM ('cohost','proctor');
CREATE TYPE exam_access_decision AS ENUM ('allow','deny');
CREATE TYPE question_type AS ENUM ('single','multi','boolean','fill','fill-multi');

CREATE TABLE school_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  auth_user_id uuid UNIQUE,
  role member_role NOT NULL,
  status record_status NOT NULL DEFAULT 'active',
  first_name text NOT NULL,
  last_name text NOT NULL,
  student_number text UNIQUE,
  guardian text,
  phone text,
  promotion_status student_progress_status,
  staff_number text UNIQUE,
  qualifier_access boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT school_members_student_fields_check CHECK (
    role = 'student'
    OR (student_number IS NULL AND guardian IS NULL AND phone IS NULL AND promotion_status IS NULL)
  ),
  CONSTRAINT school_members_staff_fields_check CHECK (
    role IN ('teacher','administrator')
    OR (staff_number IS NULL AND qualifier_access = false)
  )
);
CREATE INDEX school_members_role_status_idx ON school_members(role,status);
CREATE INDEX school_members_name_role_status_idx ON school_members(last_name,first_name,role,status);

CREATE TABLE academic_years (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  starts_on date,
  ends_on date,
  status academic_period_status NOT NULL DEFAULT 'planned',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT academic_years_dates_check CHECK (ends_on IS NULL OR starts_on IS NULL OR ends_on >= starts_on)
);

CREATE TABLE academic_terms (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  academic_year_id uuid NOT NULL REFERENCES academic_years(id) ON DELETE RESTRICT,
  name text NOT NULL,
  sequence integer NOT NULL,
  starts_on date,
  ends_on date,
  status academic_period_status NOT NULL DEFAULT 'planned',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT academic_terms_sequence_check CHECK (sequence > 0),
  CONSTRAINT academic_terms_dates_check CHECK (ends_on IS NULL OR starts_on IS NULL OR ends_on >= starts_on),
  UNIQUE (academic_year_id,sequence),
  UNIQUE (academic_year_id,name)
);

CREATE TABLE academic_levels (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  ordinal integer NOT NULL UNIQUE,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT academic_levels_ordinal_check CHECK (ordinal > 0)
);

CREATE TABLE classes (
  id text PRIMARY KEY,
  level_id uuid NOT NULL REFERENCES academic_levels(id) ON DELETE RESTRICT,
  track academic_track NOT NULL,
  academic_year_id uuid NOT NULL REFERENCES academic_years(id) ON DELETE RESTRICT,
  arm text NOT NULL,
  capacity integer NOT NULL DEFAULT 40,
  room text NOT NULL DEFAULT '',
  status record_status NOT NULL DEFAULT 'active',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT classes_capacity_check CHECK (capacity > 0),
  CONSTRAINT classes_arm_check CHECK (length(btrim(arm)) > 0)
);
CREATE INDEX classes_track_status_idx ON classes(academic_year_id,level_id,track,status);
CREATE UNIQUE INDEX classes_identity_idx
  ON classes(academic_year_id,level_id,track,lower(btrim(arm)));

CREATE TABLE class_enrollments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id uuid NOT NULL REFERENCES school_members(id) ON DELETE CASCADE,
  class_id text NOT NULL REFERENCES classes(id) ON DELETE RESTRICT,
  status enrollment_status NOT NULL DEFAULT 'active',
  enrolled_at timestamptz NOT NULL DEFAULT now(),
  ended_at timestamptz,
  UNIQUE (student_id,class_id)
);
CREATE INDEX class_enrollments_class_status_idx ON class_enrollments(class_id,status);
CREATE UNIQUE INDEX class_enrollments_one_active_idx
  ON class_enrollments(student_id)
  WHERE status='active' AND ended_at IS NULL;

CREATE TABLE subjects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  name text NOT NULL,
  kind subject_kind NOT NULL DEFAULT 'curriculum',
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT subjects_code_check CHECK (length(btrim(code)) > 0),
  CONSTRAINT subjects_name_check CHECK (length(btrim(name)) > 0)
);
CREATE INDEX subjects_kind_active_name_idx ON subjects(kind,active,name);

CREATE TABLE subject_curriculum_rules (
  subject_id uuid NOT NULL REFERENCES subjects(id) ON DELETE CASCADE,
  level_id uuid NOT NULL REFERENCES academic_levels(id) ON DELETE RESTRICT,
  track academic_track NOT NULL,
  participation offering_participation NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (subject_id,level_id,track)
);
CREATE INDEX subject_curriculum_rules_lookup_idx
  ON subject_curriculum_rules(level_id,track,participation);

CREATE TABLE class_subject_offerings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  class_id text NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
  subject_id uuid NOT NULL REFERENCES subjects(id) ON DELETE RESTRICT,
  status offering_status NOT NULL DEFAULT 'active',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (class_id,subject_id)
);
CREATE INDEX class_subject_offerings_subject_status_idx
  ON class_subject_offerings(subject_id,status);

CREATE TABLE student_subject_enrollments (
  student_id uuid NOT NULL REFERENCES school_members(id) ON DELETE CASCADE,
  offering_id uuid NOT NULL REFERENCES class_subject_offerings(id) ON DELETE CASCADE,
  status enrollment_status NOT NULL DEFAULT 'active',
  enrolled_at timestamptz NOT NULL DEFAULT now(),
  ended_at timestamptz,
  PRIMARY KEY (student_id,offering_id)
);
CREATE INDEX student_subject_enrollments_offering_status_idx
  ON student_subject_enrollments(offering_id,status);

CREATE TABLE staff_subject_qualifications (
  staff_id uuid NOT NULL REFERENCES school_members(id) ON DELETE CASCADE,
  subject_id uuid NOT NULL REFERENCES subjects(id) ON DELETE RESTRICT,
  active boolean NOT NULL DEFAULT true,
  assigned_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (staff_id,subject_id)
);
CREATE INDEX staff_subject_qualifications_subject_active_idx
  ON staff_subject_qualifications(subject_id,active);

CREATE TABLE teaching_assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  staff_id uuid NOT NULL REFERENCES school_members(id) ON DELETE CASCADE,
  offering_id uuid NOT NULL REFERENCES class_subject_offerings(id) ON DELETE RESTRICT,
  assignment_role teaching_assignment_role NOT NULL DEFAULT 'teacher',
  assigned_at timestamptz NOT NULL DEFAULT now(),
  ended_at timestamptz,
  UNIQUE (staff_id,offering_id)
);
CREATE INDEX teaching_assignments_offering_active_idx
  ON teaching_assignments(offering_id,ended_at);

CREATE TABLE exam_sessions (
  id text PRIMARY KEY,
  title text NOT NULL,
  academic_term_id uuid REFERENCES academic_terms(id) ON DELETE RESTRICT,
  mode exam_mode NOT NULL,
  status exam_status NOT NULL DEFAULT 'draft',
  duration_seconds integer NOT NULL,
  question_count integer NOT NULL,
  instructions text NOT NULL DEFAULT '',
  starts_at bigint,
  ends_at bigint,
  attempt_limit integer NOT NULL DEFAULT 1,
  focus_monitoring boolean NOT NULL DEFAULT true,
  fullscreen_prompt boolean NOT NULL DEFAULT true,
  clipboard_guard boolean NOT NULL DEFAULT true,
  camera_required boolean NOT NULL DEFAULT false,
  warn_after integer NOT NULL DEFAULT 2,
  question_order boolean NOT NULL DEFAULT true,
  option_order boolean NOT NULL DEFAULT true,
  minimize_collisions boolean NOT NULL DEFAULT true,
  created_by_id uuid REFERENCES school_members(id) ON DELETE SET NULL,
  created_at bigint NOT NULL DEFAULT ((extract(epoch FROM now()) * 1000)::bigint),
  updated_at bigint NOT NULL DEFAULT ((extract(epoch FROM now()) * 1000)::bigint),
  CONSTRAINT exam_sessions_duration_check CHECK (duration_seconds BETWEEN 30 AND 10800),
  CONSTRAINT exam_sessions_question_count_check CHECK (question_count BETWEEN 1 AND 150),
  CONSTRAINT exam_sessions_attempt_limit_check CHECK (attempt_limit > 0),
  CONSTRAINT exam_sessions_warn_after_check CHECK (warn_after > 0),
  CONSTRAINT exam_sessions_window_check CHECK (ends_at IS NULL OR starts_at IS NULL OR ends_at >= starts_at)
);
CREATE INDEX exam_sessions_status_window_idx ON exam_sessions(status,starts_at,ends_at);
CREATE INDEX exam_sessions_creator_idx ON exam_sessions(created_by_id);

CREATE TABLE exam_class_targets (
  session_id text NOT NULL REFERENCES exam_sessions(id) ON DELETE CASCADE,
  class_id text NOT NULL REFERENCES classes(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (session_id,class_id)
);

CREATE TABLE exam_offering_targets (
  session_id text NOT NULL REFERENCES exam_sessions(id) ON DELETE CASCADE,
  offering_id uuid NOT NULL REFERENCES class_subject_offerings(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (session_id,offering_id)
);
CREATE INDEX exam_offering_targets_offering_idx ON exam_offering_targets(offering_id);

CREATE TABLE exam_placement_tracks (
  session_id text NOT NULL REFERENCES exam_sessions(id) ON DELETE CASCADE,
  track academic_track NOT NULL,
  PRIMARY KEY (session_id,track)
);
CREATE INDEX exam_placement_tracks_track_idx ON exam_placement_tracks(track);

CREATE TABLE exam_session_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id text NOT NULL UNIQUE REFERENCES exam_sessions(id) ON DELETE CASCADE,
  token varchar(96) NOT NULL UNIQUE,
  active boolean NOT NULL DEFAULT true,
  expires_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT exam_session_links_token_check CHECK (length(token) >= 32)
);
CREATE INDEX exam_session_links_active_expiry_idx ON exam_session_links(active,expires_at);

CREATE TABLE exam_qr_codes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  link_id uuid NOT NULL UNIQUE REFERENCES exam_session_links(id) ON DELETE CASCADE,
  revision integer NOT NULL DEFAULT 1,
  content_type text NOT NULL DEFAULT 'image/svg+xml',
  rendered_data text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT exam_qr_codes_revision_check CHECK (revision > 0)
);

CREATE TABLE exam_staff_assignments (
  session_id text NOT NULL REFERENCES exam_sessions(id) ON DELETE CASCADE,
  staff_id uuid NOT NULL REFERENCES school_members(id) ON DELETE CASCADE,
  role exam_staff_role NOT NULL DEFAULT 'cohost',
  assigned_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (session_id,staff_id)
);

CREATE TABLE exam_student_access (
  session_id text NOT NULL REFERENCES exam_sessions(id) ON DELETE CASCADE,
  student_id uuid NOT NULL REFERENCES school_members(id) ON DELETE CASCADE,
  decision exam_access_decision NOT NULL,
  max_attempts_override integer,
  valid_from timestamptz,
  valid_until timestamptz,
  granted_by_id uuid REFERENCES school_members(id) ON DELETE SET NULL,
  reason text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (session_id,student_id),
  CONSTRAINT exam_student_access_attempts_check CHECK (max_attempts_override IS NULL OR max_attempts_override > 0),
  CONSTRAINT exam_student_access_window_check CHECK (valid_until IS NULL OR valid_from IS NULL OR valid_until >= valid_from)
);

CREATE TABLE exam_retake_grants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id text NOT NULL REFERENCES exam_sessions(id) ON DELETE CASCADE,
  student_id uuid NOT NULL REFERENCES school_members(id) ON DELETE CASCADE,
  additional_attempts integer NOT NULL DEFAULT 1,
  granted_by_id uuid NOT NULL REFERENCES school_members(id) ON DELETE RESTRICT,
  reason text NOT NULL DEFAULT '',
  granted_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz,
  revoked_at timestamptz,
  CONSTRAINT exam_retake_grants_count_check CHECK (additional_attempts > 0)
);
CREATE INDEX exam_retake_grants_lookup_idx
  ON exam_retake_grants(session_id,student_id,revoked_at,expires_at);

CREATE TABLE exam_attempts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id text NOT NULL REFERENCES exam_sessions(id) ON DELETE RESTRICT,
  student_id uuid NOT NULL REFERENCES school_members(id) ON DELETE RESTRICT,
  attempt_number integer NOT NULL,
  context_snapshot jsonb NOT NULL DEFAULT '{}'::jsonb,
  started_at bigint,
  submitted_at bigint,
  score double precision,
  correct_count integer,
  completion double precision,
  pace_index double precision,
  reasoning_index double precision,
  integrity_score double precision,
  assigned_track academic_track,
  placement_confidence integer,
  submission_reason text NOT NULL DEFAULT '',
  rewrite_source_attempt_id uuid REFERENCES exam_attempts(id) ON DELETE SET NULL,
  current_index integer NOT NULL DEFAULT 0,
  remaining_seconds double precision,
  elapsed_active_seconds double precision NOT NULL DEFAULT 0,
  last_active_at bigint,
  paper_fingerprint text NOT NULL DEFAULT '',
  question_ids bigint[] NOT NULL DEFAULT '{}',
  created_at bigint NOT NULL DEFAULT ((extract(epoch FROM now()) * 1000)::bigint),
  updated_at bigint NOT NULL DEFAULT ((extract(epoch FROM now()) * 1000)::bigint),
  CONSTRAINT exam_attempts_number_check CHECK (attempt_number > 0),
  CONSTRAINT exam_attempts_current_index_check CHECK (current_index >= 0),
  CONSTRAINT exam_attempts_remaining_check CHECK (remaining_seconds IS NULL OR remaining_seconds >= 0),
  CONSTRAINT exam_attempts_elapsed_check CHECK (elapsed_active_seconds >= 0),
  UNIQUE (session_id,student_id,attempt_number)
);
CREATE INDEX exam_attempts_student_created_idx ON exam_attempts(student_id,created_at);
CREATE INDEX exam_attempts_session_created_idx ON exam_attempts(session_id,created_at);

CREATE TABLE questions (
  id bigint PRIMARY KEY,
  subject_id uuid NOT NULL REFERENCES subjects(id) ON DELETE RESTRICT,
  qtype question_type NOT NULL,
  prompt text NOT NULL,
  options text[] NOT NULL DEFAULT '{}',
  correct_answers text[] NOT NULL DEFAULT '{}',
  fill_template text,
  instruction text NOT NULL DEFAULT '',
  exam_modes exam_mode[] NOT NULL DEFAULT '{}',
  difficulty text NOT NULL DEFAULT 'medium',
  domain text NOT NULL DEFAULT '',
  explanation text NOT NULL DEFAULT '',
  status record_status NOT NULL DEFAULT 'active',
  creator_id uuid REFERENCES school_members(id) ON DELETE SET NULL,
  created_at timestamptz,
  updated_at bigint NOT NULL DEFAULT ((extract(epoch FROM now()) * 1000)::bigint)
);
CREATE INDEX questions_subject_idx ON questions(subject_id);
CREATE INDEX questions_creator_idx ON questions(creator_id);

CREATE TABLE question_academic_levels (
  question_id bigint NOT NULL REFERENCES questions(id) ON DELETE CASCADE,
  level_id uuid NOT NULL REFERENCES academic_levels(id) ON DELETE RESTRICT,
  PRIMARY KEY (question_id,level_id)
);
CREATE INDEX question_academic_levels_level_idx ON question_academic_levels(level_id);

CREATE TABLE question_blanks (
  question_id bigint NOT NULL REFERENCES questions(id) ON DELETE CASCADE,
  position integer NOT NULL,
  blank_key text NOT NULL,
  placeholder text NOT NULL DEFAULT '',
  accepted text[] NOT NULL DEFAULT '{}',
  PRIMARY KEY (question_id,position),
  UNIQUE (question_id,blank_key),
  CONSTRAINT question_blanks_position_check CHECK (position >= 0)
);

CREATE TABLE exam_attempt_responses (
  attempt_id uuid NOT NULL REFERENCES exam_attempts(id) ON DELETE CASCADE,
  question_id bigint NOT NULL REFERENCES questions(id) ON DELETE RESTRICT,
  response_text text,
  response_values text[] NOT NULL DEFAULT '{}',
  seconds double precision NOT NULL DEFAULT 0,
  flagged boolean NOT NULL DEFAULT false,
  correct boolean,
  correct_answer text,
  graded_at bigint,
  updated_at bigint NOT NULL DEFAULT ((extract(epoch FROM now()) * 1000)::bigint),
  PRIMARY KEY (attempt_id,question_id),
  CONSTRAINT exam_attempt_responses_seconds_check CHECK (seconds >= 0)
);

CREATE TABLE exam_integrity_events (
  id bigserial PRIMARY KEY,
  attempt_id uuid NOT NULL REFERENCES exam_attempts(id) ON DELETE CASCADE,
  type text NOT NULL,
  detail text NOT NULL DEFAULT '',
  at bigint NOT NULL
);
CREATE INDEX exam_integrity_events_attempt_at_idx ON exam_integrity_events(attempt_id,at);

CREATE TABLE whatsapp_groups (
  id text PRIMARY KEY,
  class_id text NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
  name text NOT NULL,
  invite_url text NOT NULL,
  created_at bigint NOT NULL,
  updated_at bigint NOT NULL
);
CREATE INDEX whatsapp_groups_class_idx ON whatsapp_groups(class_id);

-- -------------------------------------------------------------------------
-- Cross-table integrity guards. These enforce the relationship rules without
-- duplicating class/track/subject facts into assignment or offering rows.
-- -------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION validate_class_enrollment_member()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM school_members m
    WHERE m.id=NEW.student_id AND m.role='student' AND m.status='active'
  ) THEN
    RAISE EXCEPTION 'class_enrollment_requires_active_student';
  END IF;
  RETURN NEW;
END $$;

CREATE TRIGGER class_enrollment_member_guard
BEFORE INSERT OR UPDATE OF student_id ON class_enrollments
FOR EACH ROW EXECUTE FUNCTION validate_class_enrollment_member();

CREATE OR REPLACE FUNCTION validate_class_subject_offering()
RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  v_level uuid;
  v_track academic_track;
BEGIN
  SELECT c.level_id,c.track INTO v_level,v_track
  FROM classes c WHERE c.id=NEW.class_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'class_subject_offering_class_not_found';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM subjects s
    JOIN subject_curriculum_rules r ON r.subject_id=s.id
    WHERE s.id=NEW.subject_id
      AND s.kind='curriculum'
      AND s.active=true
      AND r.level_id=v_level
      AND r.track=v_track
  ) THEN
    RAISE EXCEPTION 'subject_not_allowed_for_class_curriculum';
  END IF;

  RETURN NEW;
END $$;

CREATE TRIGGER class_subject_offering_curriculum_guard
BEFORE INSERT OR UPDATE OF class_id,subject_id ON class_subject_offerings
FOR EACH ROW EXECUTE FUNCTION validate_class_subject_offering();

CREATE OR REPLACE FUNCTION validate_student_subject_enrollment()
RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  v_class_id text;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM school_members m
    WHERE m.id=NEW.student_id AND m.role='student' AND m.status='active'
  ) THEN
    RAISE EXCEPTION 'subject_enrollment_requires_active_student';
  END IF;

  SELECT o.class_id INTO v_class_id
  FROM class_subject_offerings o
  WHERE o.id=NEW.offering_id AND o.status='active';

  IF v_class_id IS NULL OR NOT EXISTS (
    SELECT 1 FROM class_enrollments ce
    WHERE ce.student_id=NEW.student_id
      AND ce.class_id=v_class_id
      AND ce.status='active'
      AND ce.ended_at IS NULL
  ) THEN
    RAISE EXCEPTION 'subject_enrollment_requires_matching_active_class';
  END IF;

  RETURN NEW;
END $$;

CREATE TRIGGER student_subject_enrollment_guard
BEFORE INSERT OR UPDATE OF student_id,offering_id ON student_subject_enrollments
FOR EACH ROW EXECUTE FUNCTION validate_student_subject_enrollment();

CREATE OR REPLACE FUNCTION validate_staff_qualification()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM school_members m
    WHERE m.id=NEW.staff_id
      AND m.role IN ('teacher','administrator')
      AND m.status='active'
  ) THEN
    RAISE EXCEPTION 'subject_qualification_requires_active_staff';
  END IF;
  RETURN NEW;
END $$;

CREATE TRIGGER staff_subject_qualification_guard
BEFORE INSERT OR UPDATE OF staff_id ON staff_subject_qualifications
FOR EACH ROW EXECUTE FUNCTION validate_staff_qualification();

CREATE OR REPLACE FUNCTION validate_teaching_assignment()
RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  v_subject_id uuid;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM school_members m
    WHERE m.id=NEW.staff_id
      AND m.role IN ('teacher','administrator')
      AND m.status='active'
  ) THEN
    RAISE EXCEPTION 'teaching_assignment_requires_active_staff';
  END IF;

  SELECT o.subject_id INTO v_subject_id
  FROM class_subject_offerings o
  WHERE o.id=NEW.offering_id AND o.status='active';

  IF v_subject_id IS NULL OR NOT EXISTS (
    SELECT 1 FROM staff_subject_qualifications q
    WHERE q.staff_id=NEW.staff_id
      AND q.subject_id=v_subject_id
      AND q.active=true
  ) THEN
    RAISE EXCEPTION 'teaching_assignment_requires_subject_qualification';
  END IF;

  RETURN NEW;
END $$;

CREATE TRIGGER teaching_assignment_guard
BEFORE INSERT OR UPDATE OF staff_id,offering_id ON teaching_assignments
FOR EACH ROW EXECUTE FUNCTION validate_teaching_assignment();
