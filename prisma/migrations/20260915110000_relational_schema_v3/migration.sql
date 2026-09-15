-- Festacol relational schema v3
-- Prisma is the migration authority for the public application schema.
-- This migration is deliberately able to bootstrap a fresh database and to
-- contract the previous legacy/v2 schema without inventing ambiguous identity.

BEGIN;

CREATE EXTENSION IF NOT EXISTS pgcrypto;

DO $$ BEGIN CREATE TYPE academic_role AS ENUM ('student','teacher','administrator'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE record_status AS ENUM ('active','inactive'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE academic_period_status AS ENUM ('planned','active','closed','archived'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE enrollment_status AS ENUM ('active','completed','withdrawn','transferred','ended'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE offering_participation AS ENUM ('required','elective'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE offering_status AS ENUM ('draft','active','ended'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE teaching_assignment_role AS ENUM ('teacher','head_teacher','assistant'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE exam_mode AS ENUM ('qualifier','bece','waec','neco','jamb','mixed','single'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE exam_status AS ENUM ('draft','open','closed'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE exam_staff_role AS ENUM ('cohost','proctor'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE exam_access_decision AS ENUM ('allow','deny'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE question_type AS ENUM ('single','multi','boolean','fill','fill-multi'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Old Supabase webhook triggers must not fire while the ownership migration is
-- rewriting rows. The platform integration is reinstalled from supabase/ only
-- after Prisma migration deployment.
DO $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT n.nspname AS schema_name,c.relname AS table_name,t.tgname AS trigger_name
    FROM pg_trigger t
    JOIN pg_class c ON c.oid=t.tgrelid
    JOIN pg_namespace n ON n.oid=c.relnamespace
    WHERE n.nspname='public' AND NOT t.tgisinternal AND t.tgname LIKE 'festacol_webhook_%'
  LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS %I ON %I.%I',r.trigger_name,r.schema_name,r.table_name);
  END LOOP;
END $$;
DROP FUNCTION IF EXISTS private.notify_festacol_webhook();

-- -------------------------------------------------------------------------
-- Canonical schema. CREATE IF NOT EXISTS supports fresh databases; the upgrade
-- blocks below bring pre-v3 tables to the same contract.
-- -------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.academic_profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  auth_user_id uuid UNIQUE,
  role academic_role NOT NULL,
  status record_status NOT NULL DEFAULT 'active',
  first_name text NOT NULL,
  last_name text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.student_academic_profiles (
  profile_id uuid PRIMARY KEY REFERENCES public.academic_profiles(id) ON DELETE CASCADE,
  student_number text UNIQUE,
  guardian text NOT NULL DEFAULT '',
  phone text NOT NULL DEFAULT '',
  promotion_status text NOT NULL DEFAULT 'on-track',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.staff_academic_profiles (
  profile_id uuid PRIMARY KEY REFERENCES public.academic_profiles(id) ON DELETE CASCADE,
  staff_number text UNIQUE,
  qualifier_access boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.academic_years (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  starts_on date,
  ends_on date,
  status academic_period_status NOT NULL DEFAULT 'planned',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.academic_terms (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  academic_year_id uuid NOT NULL REFERENCES public.academic_years(id) ON DELETE RESTRICT,
  name text NOT NULL,
  sequence integer NOT NULL,
  starts_on date,
  ends_on date,
  status academic_period_status NOT NULL DEFAULT 'planned',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (academic_year_id, sequence),
  UNIQUE (academic_year_id, name)
);

CREATE TABLE IF NOT EXISTS public.academic_levels (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  ordinal integer NOT NULL UNIQUE,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.academic_programmes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.classes (
  id text PRIMARY KEY,
  level_id uuid NOT NULL REFERENCES public.academic_levels(id) ON DELETE RESTRICT,
  programme_id uuid REFERENCES public.academic_programmes(id) ON DELETE RESTRICT,
  academic_year_id uuid NOT NULL REFERENCES public.academic_years(id) ON DELETE RESTRICT,
  arm text NOT NULL DEFAULT '',
  capacity integer NOT NULL DEFAULT 40,
  room text NOT NULL DEFAULT '',
  status record_status NOT NULL DEFAULT 'active',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.class_enrollments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_profile_id uuid NOT NULL REFERENCES public.student_academic_profiles(profile_id) ON DELETE CASCADE,
  class_id text NOT NULL REFERENCES public.classes(id) ON DELETE RESTRICT,
  status enrollment_status NOT NULL DEFAULT 'active',
  enrolled_at timestamptz NOT NULL DEFAULT now(),
  ended_at timestamptz,
  UNIQUE (student_profile_id, class_id)
);

CREATE TABLE IF NOT EXISTS public.subjects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.class_subject_offerings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  class_id text NOT NULL REFERENCES public.classes(id) ON DELETE RESTRICT,
  subject_id uuid NOT NULL REFERENCES public.subjects(id) ON DELETE RESTRICT,
  academic_term_id uuid REFERENCES public.academic_terms(id) ON DELETE RESTRICT,
  participation offering_participation NOT NULL DEFAULT 'required',
  status offering_status NOT NULL DEFAULT 'active',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.student_subject_enrollments (
  student_profile_id uuid NOT NULL REFERENCES public.student_academic_profiles(profile_id) ON DELETE CASCADE,
  offering_id uuid NOT NULL REFERENCES public.class_subject_offerings(id) ON DELETE CASCADE,
  status enrollment_status NOT NULL DEFAULT 'active',
  enrolled_at timestamptz NOT NULL DEFAULT now(),
  ended_at timestamptz,
  PRIMARY KEY (student_profile_id, offering_id)
);

CREATE TABLE IF NOT EXISTS public.staff_subject_qualifications (
  staff_profile_id uuid NOT NULL REFERENCES public.staff_academic_profiles(profile_id) ON DELETE CASCADE,
  subject_id uuid NOT NULL REFERENCES public.subjects(id) ON DELETE RESTRICT,
  active boolean NOT NULL DEFAULT true,
  assigned_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (staff_profile_id, subject_id)
);

CREATE TABLE IF NOT EXISTS public.teaching_assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  staff_profile_id uuid NOT NULL REFERENCES public.staff_academic_profiles(profile_id) ON DELETE CASCADE,
  offering_id uuid NOT NULL REFERENCES public.class_subject_offerings(id) ON DELETE RESTRICT,
  assignment_role teaching_assignment_role NOT NULL DEFAULT 'teacher',
  assigned_at timestamptz NOT NULL DEFAULT now(),
  ended_at timestamptz,
  UNIQUE (staff_profile_id, offering_id)
);

CREATE TABLE IF NOT EXISTS public.exam_sessions (
  id text PRIMARY KEY,
  title text NOT NULL,
  academic_term_id uuid REFERENCES public.academic_terms(id) ON DELETE RESTRICT,
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
  created_by_profile_id uuid REFERENCES public.staff_academic_profiles(profile_id) ON DELETE SET NULL,
  created_at bigint NOT NULL,
  updated_at bigint NOT NULL
);

CREATE TABLE IF NOT EXISTS public.exam_class_targets (
  session_id text NOT NULL REFERENCES public.exam_sessions(id) ON DELETE CASCADE,
  class_id text NOT NULL REFERENCES public.classes(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (session_id, class_id)
);

CREATE TABLE IF NOT EXISTS public.exam_offering_targets (
  session_id text NOT NULL REFERENCES public.exam_sessions(id) ON DELETE CASCADE,
  offering_id uuid NOT NULL REFERENCES public.class_subject_offerings(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (session_id, offering_id)
);

CREATE TABLE IF NOT EXISTS public.exam_placement_programmes (
  session_id text NOT NULL REFERENCES public.exam_sessions(id) ON DELETE CASCADE,
  programme_id uuid NOT NULL REFERENCES public.academic_programmes(id) ON DELETE RESTRICT,
  PRIMARY KEY (session_id, programme_id)
);

CREATE TABLE IF NOT EXISTS public.exam_staff_assignments (
  session_id text NOT NULL REFERENCES public.exam_sessions(id) ON DELETE CASCADE,
  staff_profile_id uuid NOT NULL REFERENCES public.staff_academic_profiles(profile_id) ON DELETE CASCADE,
  role exam_staff_role NOT NULL DEFAULT 'cohost',
  assigned_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (session_id, staff_profile_id)
);

CREATE TABLE IF NOT EXISTS public.exam_student_access (
  session_id text NOT NULL REFERENCES public.exam_sessions(id) ON DELETE CASCADE,
  student_profile_id uuid NOT NULL REFERENCES public.student_academic_profiles(profile_id) ON DELETE CASCADE,
  decision exam_access_decision NOT NULL,
  max_attempts_override integer,
  valid_from timestamptz,
  valid_until timestamptz,
  granted_by_profile_id uuid REFERENCES public.staff_academic_profiles(profile_id) ON DELETE SET NULL,
  reason text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (session_id, student_profile_id)
);

CREATE TABLE IF NOT EXISTS public.exam_retake_grants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id text NOT NULL REFERENCES public.exam_sessions(id) ON DELETE CASCADE,
  student_profile_id uuid NOT NULL REFERENCES public.student_academic_profiles(profile_id) ON DELETE CASCADE,
  additional_attempts integer NOT NULL DEFAULT 1,
  granted_by_profile_id uuid NOT NULL REFERENCES public.staff_academic_profiles(profile_id) ON DELETE RESTRICT,
  reason text NOT NULL DEFAULT '',
  granted_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz,
  revoked_at timestamptz
);

CREATE TABLE IF NOT EXISTS public.questions (
  id bigint PRIMARY KEY,
  subject_id uuid NOT NULL REFERENCES public.subjects(id) ON DELETE RESTRICT,
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
  created_by_profile_id uuid REFERENCES public.staff_academic_profiles(profile_id) ON DELETE SET NULL,
  created_at timestamptz,
  updated_at bigint NOT NULL
);

CREATE TABLE IF NOT EXISTS public.question_academic_levels (
  question_id bigint NOT NULL REFERENCES public.questions(id) ON DELETE CASCADE,
  level_id uuid NOT NULL REFERENCES public.academic_levels(id) ON DELETE RESTRICT,
  PRIMARY KEY (question_id, level_id)
);

CREATE TABLE IF NOT EXISTS public.question_blanks (
  question_id bigint NOT NULL REFERENCES public.questions(id) ON DELETE CASCADE,
  position integer NOT NULL,
  blank_key text NOT NULL,
  placeholder text NOT NULL DEFAULT '',
  accepted text[] NOT NULL DEFAULT '{}',
  PRIMARY KEY (question_id, position),
  UNIQUE (question_id, blank_key)
);

CREATE TABLE IF NOT EXISTS public.exam_attempts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id text NOT NULL REFERENCES public.exam_sessions(id) ON DELETE RESTRICT,
  student_profile_id uuid NOT NULL REFERENCES public.student_academic_profiles(profile_id) ON DELETE RESTRICT,
  attempt_number integer NOT NULL,
  context_snapshot jsonb NOT NULL DEFAULT '{}'::jsonb,
  started_at bigint,
  submitted_at bigint,
  score double precision,
  correct_count double precision,
  completion double precision,
  pace_index double precision,
  reasoning_index double precision,
  integrity_score double precision,
  assigned_track text,
  placement_confidence integer,
  submission_reason text NOT NULL DEFAULT '',
  rewrite_source_attempt_id uuid REFERENCES public.exam_attempts(id) ON DELETE SET NULL,
  created_at bigint NOT NULL DEFAULT (extract(epoch from now()) * 1000)::bigint,
  UNIQUE (session_id, student_profile_id, attempt_number)
);

CREATE TABLE IF NOT EXISTS public.exam_attempt_runtime_states (
  attempt_id uuid PRIMARY KEY REFERENCES public.exam_attempts(id) ON DELETE CASCADE,
  current_index integer NOT NULL DEFAULT 0,
  remaining_seconds double precision NOT NULL,
  elapsed_active_seconds double precision NOT NULL DEFAULT 0,
  last_active_at bigint NOT NULL,
  paper_fingerprint text NOT NULL,
  question_ids bigint[] NOT NULL DEFAULT '{}',
  updated_at bigint NOT NULL
);

CREATE TABLE IF NOT EXISTS public.exam_attempt_responses (
  attempt_id uuid NOT NULL REFERENCES public.exam_attempts(id) ON DELETE CASCADE,
  question_id bigint NOT NULL REFERENCES public.questions(id) ON DELETE RESTRICT,
  response_text text,
  response_values text[] NOT NULL DEFAULT '{}',
  seconds double precision NOT NULL DEFAULT 0,
  flagged boolean NOT NULL DEFAULT false,
  PRIMARY KEY (attempt_id, question_id)
);

CREATE TABLE IF NOT EXISTS public.exam_attempt_answers (
  attempt_id uuid NOT NULL REFERENCES public.exam_attempts(id) ON DELETE CASCADE,
  question_id bigint NOT NULL REFERENCES public.questions(id) ON DELETE RESTRICT,
  correct boolean,
  response_text text,
  response_values text[] NOT NULL DEFAULT '{}',
  correct_answer text NOT NULL DEFAULT '',
  seconds double precision NOT NULL DEFAULT 0,
  PRIMARY KEY (attempt_id, question_id)
);

CREATE TABLE IF NOT EXISTS public.exam_integrity_events (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  attempt_id uuid NOT NULL REFERENCES public.exam_attempts(id) ON DELETE CASCADE,
  type text NOT NULL,
  detail text NOT NULL DEFAULT '',
  at bigint NOT NULL
);

CREATE TABLE IF NOT EXISTS public.whatsapp_groups (
  id text PRIMARY KEY,
  class_id text NOT NULL UNIQUE REFERENCES public.classes(id) ON DELETE CASCADE,
  name text NOT NULL,
  invite_url text NOT NULL,
  created_at bigint NOT NULL,
  updated_at bigint NOT NULL
);

-- -------------------------------------------------------------------------
-- Upgrade the pre-v3 identity graph if it exists.
-- -------------------------------------------------------------------------
ALTER TABLE public.academic_profiles ADD COLUMN IF NOT EXISTS legacy_user_id text;
ALTER TABLE public.academic_profiles ADD COLUMN IF NOT EXISTS full_name text;
ALTER TABLE public.academic_profiles ADD COLUMN IF NOT EXISTS email text NOT NULL DEFAULT '';
CREATE UNIQUE INDEX IF NOT EXISTS academic_profiles_legacy_user_id_key ON public.academic_profiles(legacy_user_id) WHERE legacy_user_id IS NOT NULL;
ALTER TABLE public.academic_profiles ADD COLUMN IF NOT EXISTS first_name_key text;
ALTER TABLE public.academic_profiles ADD COLUMN IF NOT EXISTS last_name_key text;
UPDATE public.academic_profiles
SET first_name_key = lower(regexp_replace(btrim(first_name), '\s+', ' ', 'g'))
WHERE first_name_key IS NULL;
UPDATE public.academic_profiles
SET last_name_key = lower(regexp_replace(btrim(last_name), '\s+', ' ', 'g'))
WHERE last_name_key IS NULL;

DO $$
BEGIN
  IF to_regclass('public.users') IS NOT NULL THEN
    EXECUTE $q$
      INSERT INTO public.academic_profiles(
        auth_user_id, legacy_user_id, role, status, full_name, first_name, last_name,
        first_name_key, last_name_key, email, created_at, updated_at
      )
      SELECT
        CASE WHEN u.auth_user_id ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
             THEN u.auth_user_id::uuid ELSE NULL END,
        u.id,
        u.role::academic_role,
        u.status::record_status,
        u.full_name,
        u.first_name,
        u.last_name,
        lower(regexp_replace(btrim(u.first_name), '\s+', ' ', 'g')),
        lower(regexp_replace(btrim(u.last_name), '\s+', ' ', 'g')),
        u.email,
        to_timestamp(u.joined_at / 1000.0),
        now()
      FROM public.users u
      WHERE NOT EXISTS (
        SELECT 1 FROM public.academic_profiles p
        WHERE p.legacy_user_id = u.id
      )
    $q$;
  END IF;
END $$;

-- Preserve old roster IDs as explicit student/staff numbers. This is identity
-- migration, not a permanent duplicate relationship.
ALTER TABLE public.student_academic_profiles ADD COLUMN IF NOT EXISTS student_number text;
ALTER TABLE public.staff_academic_profiles ADD COLUMN IF NOT EXISTS staff_number text;
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='academic_profiles' AND column_name='legacy_user_id'
  ) THEN
    EXECUTE $q$
      UPDATE public.student_academic_profiles s
      SET student_number = p.legacy_user_id
      FROM public.academic_profiles p
      WHERE s.profile_id=p.id AND s.student_number IS NULL AND p.legacy_user_id IS NOT NULL
    $q$;
    EXECUTE $q$
      UPDATE public.staff_academic_profiles s
      SET staff_number = p.legacy_user_id
      FROM public.academic_profiles p
      WHERE s.profile_id=p.id AND s.staff_number IS NULL AND p.legacy_user_id IS NOT NULL
    $q$;
  END IF;
END $$;

-- If the role-extension rows do not yet exist, create them only from proven
-- academic profile roles. No name-hash table is used as identity.
INSERT INTO public.student_academic_profiles(profile_id, student_number, guardian, phone, promotion_status)
SELECT p.id, NULL, '', '', 'on-track'
FROM public.academic_profiles p
WHERE p.role::text='student'
  AND NOT EXISTS (SELECT 1 FROM public.student_academic_profiles s WHERE s.profile_id=p.id);
INSERT INTO public.staff_academic_profiles(profile_id, staff_number, qualifier_access)
SELECT p.id, NULL, false
FROM public.academic_profiles p
WHERE p.role::text IN ('teacher','administrator')
  AND NOT EXISTS (SELECT 1 FROM public.staff_academic_profiles s WHERE s.profile_id=p.id);


-- -------------------------------------------------------------------------
-- Calendar, classes and subjects.
-- -------------------------------------------------------------------------
ALTER TABLE public.academic_years ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();
ALTER TABLE public.academic_terms ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

INSERT INTO public.academic_levels(name,ordinal)
VALUES ('SS1',1),('SS2',2),('SS3',3)
ON CONFLICT (name) DO UPDATE SET ordinal=EXCLUDED.ordinal, active=true;

ALTER TABLE public.classes ADD COLUMN IF NOT EXISTS level_id uuid;
ALTER TABLE public.classes ADD COLUMN IF NOT EXISTS programme_id uuid;
ALTER TABLE public.classes ADD COLUMN IF NOT EXISTS academic_year_id uuid;
ALTER TABLE public.classes ADD COLUMN IF NOT EXISTS created_at timestamptz NOT NULL DEFAULT now();
ALTER TABLE public.classes ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='classes' AND column_name='class_level') THEN
    EXECUTE $q$UPDATE public.classes c SET level_id=l.id FROM public.academic_levels l WHERE c.level_id IS NULL AND l.name=c.class_level$q$;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='classes' AND column_name='academic_session') THEN
    EXECUTE $q$
      INSERT INTO public.academic_years(name,status)
      SELECT DISTINCT c.academic_session,'active'::academic_period_status FROM public.classes c
      WHERE nullif(btrim(c.academic_session),'') IS NOT NULL
      ON CONFLICT (name) DO NOTHING
    $q$;
    EXECUTE $q$UPDATE public.classes c SET academic_year_id=y.id FROM public.academic_years y WHERE c.academic_year_id IS NULL AND y.name=c.academic_session$q$;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='classes' AND column_name='stream') THEN
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='academic_programmes' AND column_name='normalized_name') THEN
      EXECUTE $q$
        INSERT INTO public.academic_programmes(name,normalized_name)
        SELECT DISTINCT btrim(c.stream),lower(regexp_replace(btrim(c.stream), '\s+', ' ', 'g'))
        FROM public.classes c
        WHERE nullif(btrim(c.stream),'') IS NOT NULL
          AND lower(btrim(c.stream)) <> 'general'
          AND NOT EXISTS (
            SELECT 1 FROM public.academic_programmes p
            WHERE p.normalized_name=lower(regexp_replace(btrim(c.stream), '\s+', ' ', 'g'))
          )
      $q$;
    ELSE
      EXECUTE $q$
        INSERT INTO public.academic_programmes(name)
        SELECT DISTINCT btrim(c.stream)
        FROM public.classes c
        WHERE nullif(btrim(c.stream),'') IS NOT NULL
          AND lower(btrim(c.stream)) <> 'general'
          AND NOT EXISTS (
            SELECT 1 FROM public.academic_programmes p
            WHERE lower(regexp_replace(btrim(p.name), '\s+', ' ', 'g'))=lower(regexp_replace(btrim(c.stream), '\s+', ' ', 'g'))
          )
      $q$;
    END IF;
    EXECUTE $q$
      UPDATE public.classes c SET programme_id=p.id
      FROM public.academic_programmes p
      WHERE c.programme_id IS NULL
        AND lower(regexp_replace(btrim(p.name), '\s+', ' ', 'g'))=lower(regexp_replace(btrim(c.stream), '\s+', ' ', 'g'))
        AND lower(btrim(c.stream)) <> 'general'
    $q$;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM public.classes WHERE level_id IS NULL) THEN
    RAISE EXCEPTION 'schema_v3_unresolved_class_level';
  END IF;
  IF EXISTS (SELECT 1 FROM public.classes WHERE academic_year_id IS NULL) THEN
    RAISE EXCEPTION 'schema_v3_unresolved_class_academic_year';
  END IF;
END $$;
ALTER TABLE public.classes ALTER COLUMN level_id SET NOT NULL;
ALTER TABLE public.classes ALTER COLUMN academic_year_id SET NOT NULL;

-- Subjects gain UUID identity; legacy codes exist only long enough to resolve existing relationships.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='subjects' AND column_name='id') THEN
    ALTER TABLE public.subjects ADD COLUMN id uuid;
  END IF;
END $$;
UPDATE public.subjects SET id=gen_random_uuid() WHERE id IS NULL;
ALTER TABLE public.subjects ALTER COLUMN id SET DEFAULT gen_random_uuid();
ALTER TABLE public.subjects ALTER COLUMN id SET NOT NULL;
ALTER TABLE public.subjects ADD COLUMN IF NOT EXISTS created_at timestamptz NOT NULL DEFAULT now();
ALTER TABLE public.subjects ADD COLUMN IF NOT EXISTS updated_at_v3 timestamptz NOT NULL DEFAULT now();
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='subjects' AND column_name='updated_at_v2') THEN
    EXECUTE 'UPDATE public.subjects SET updated_at_v3=updated_at_v2 WHERE updated_at_v2 IS NOT NULL';
  ELSIF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='subjects' AND column_name='updated_at') THEN
    EXECUTE 'UPDATE public.subjects SET updated_at_v3=to_timestamp(updated_at/1000.0) WHERE updated_at IS NOT NULL';
  END IF;
END $$;

-- -------------------------------------------------------------------------
-- Relationship contraction: class/year and assignment duplicates disappear.
-- -------------------------------------------------------------------------
ALTER TABLE public.class_enrollments ADD COLUMN IF NOT EXISTS status_v3 enrollment_status;
UPDATE public.class_enrollments SET status_v3=status::text::enrollment_status WHERE status_v3 IS NULL;
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='class_enrollments' AND column_name='academic_year_id') THEN
    IF EXISTS (
      SELECT 1 FROM public.class_enrollments ce JOIN public.classes c ON c.id=ce.class_id
      WHERE ce.academic_year_id IS DISTINCT FROM c.academic_year_id
    ) THEN RAISE EXCEPTION 'schema_v3_enrollment_year_mismatch'; END IF;
  END IF;
END $$;

-- Ensure v2 offerings exist for every active teaching tuple before removing
-- duplicated class/subject/year fields from teaching_assignments.
ALTER TABLE public.class_subject_offerings ADD COLUMN IF NOT EXISTS academic_term_id uuid;
ALTER TABLE public.class_subject_offerings ADD COLUMN IF NOT EXISTS participation_v3 offering_participation;
ALTER TABLE public.class_subject_offerings ADD COLUMN IF NOT EXISTS status_v3 offering_status;
UPDATE public.class_subject_offerings SET participation_v3=participation::text::offering_participation WHERE participation_v3 IS NULL;
UPDATE public.class_subject_offerings SET status_v3=status::text::offering_status WHERE status_v3 IS NULL;
ALTER TABLE public.class_subject_offerings ADD COLUMN IF NOT EXISTS created_at timestamptz NOT NULL DEFAULT now();
ALTER TABLE public.class_subject_offerings ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

ALTER TABLE public.student_subject_enrollments ADD COLUMN IF NOT EXISTS status_v3 enrollment_status;
UPDATE public.student_subject_enrollments SET status_v3=status::text::enrollment_status WHERE status_v3 IS NULL;

ALTER TABLE public.staff_subject_qualifications ADD COLUMN IF NOT EXISTS subject_id uuid;
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='staff_subject_qualifications' AND column_name='subject_code') THEN
    EXECUTE $q$UPDATE public.staff_subject_qualifications q SET subject_id=s.id FROM public.subjects s WHERE q.subject_id IS NULL AND s.code=q.subject_code$q$;
  END IF;
END $$;
DO $$ BEGIN IF EXISTS (SELECT 1 FROM public.staff_subject_qualifications WHERE subject_id IS NULL) THEN RAISE EXCEPTION 'schema_v3_unresolved_staff_subject'; END IF; END $$;
ALTER TABLE public.staff_subject_qualifications ALTER COLUMN subject_id SET NOT NULL;

ALTER TABLE public.teaching_assignments ADD COLUMN IF NOT EXISTS offering_id uuid;
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='teaching_assignments' AND column_name='class_id')
     AND EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='teaching_assignments' AND column_name='subject_code') THEN
    EXECUTE $q$
      INSERT INTO public.class_subject_offerings(class_id,subject_id,academic_term_id,participation_v3,status_v3,created_at,updated_at)
      SELECT DISTINCT ta.class_id,s.id,ta.academic_term_id,'elective'::offering_participation,
             CASE WHEN ta.status='active' THEN 'active'::offering_status ELSE 'ended'::offering_status END,
             ta.assigned_at,coalesce(ta.ended_at,now())
      FROM public.teaching_assignments ta
      JOIN public.subjects s ON s.code=ta.subject_code
      WHERE NOT EXISTS (
        SELECT 1 FROM public.class_subject_offerings o
        WHERE o.class_id=ta.class_id AND o.subject_id=s.id
          AND o.academic_term_id IS NOT DISTINCT FROM ta.academic_term_id
      )
    $q$;
    EXECUTE $q$
      UPDATE public.teaching_assignments ta SET offering_id=o.id
      FROM public.subjects s, public.class_subject_offerings o
      WHERE ta.offering_id IS NULL AND s.code=ta.subject_code
        AND o.class_id=ta.class_id AND o.subject_id=s.id
        AND o.academic_term_id IS NOT DISTINCT FROM ta.academic_term_id
    $q$;
  END IF;
END $$;
DO $$ BEGIN IF EXISTS (SELECT 1 FROM public.teaching_assignments WHERE offering_id IS NULL) THEN RAISE EXCEPTION 'schema_v3_unresolved_teaching_offering'; END IF; END $$;
ALTER TABLE public.teaching_assignments ALTER COLUMN offering_id SET NOT NULL;
ALTER TABLE public.teaching_assignments ADD COLUMN IF NOT EXISTS assignment_role_v3 teaching_assignment_role;
UPDATE public.teaching_assignments SET assignment_role_v3=assignment_role::text::teaching_assignment_role WHERE assignment_role_v3 IS NULL;

-- -------------------------------------------------------------------------
-- Questions: subject and level relationships become canonical.
-- -------------------------------------------------------------------------
ALTER TABLE public.questions ADD COLUMN IF NOT EXISTS subject_id uuid;
ALTER TABLE public.questions ADD COLUMN IF NOT EXISTS status record_status NOT NULL DEFAULT 'active';
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='questions' AND column_name='subject_code') THEN
    EXECUTE $q$UPDATE public.questions q SET subject_id=s.id FROM public.subjects s WHERE q.subject_id IS NULL AND s.code=q.subject_code$q$;
  END IF;
END $$;
DO $$ BEGIN IF EXISTS (SELECT 1 FROM public.questions WHERE subject_id IS NULL) THEN RAISE EXCEPTION 'schema_v3_unresolved_question_subject'; END IF; END $$;
ALTER TABLE public.questions ALTER COLUMN subject_id SET NOT NULL;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='questions' AND column_name='levels') THEN
    EXECUTE $q$
      INSERT INTO public.question_academic_levels(question_id,level_id)
      SELECT q.id,l.id FROM public.questions q
      CROSS JOIN LATERAL unnest(q.levels) AS level_name
      JOIN public.academic_levels l ON l.name=level_name
      ON CONFLICT DO NOTHING
    $q$;
    IF EXISTS (
      SELECT 1 FROM public.questions q
      CROSS JOIN LATERAL unnest(q.levels) AS level_name
      LEFT JOIN public.academic_levels l ON l.name=level_name
      WHERE l.id IS NULL
    ) THEN RAISE EXCEPTION 'schema_v3_unresolved_question_level'; END IF;
  END IF;
END $$;

-- -------------------------------------------------------------------------
-- Exam graph. Offering targets are the subject source of truth; class targets
-- are only for non-subject/general papers.
-- -------------------------------------------------------------------------
ALTER TABLE public.exam_sessions ADD COLUMN IF NOT EXISTS created_by_profile_id uuid;
ALTER TABLE public.exam_sessions ADD COLUMN IF NOT EXISTS academic_term_id uuid;
ALTER TABLE public.exam_sessions ADD COLUMN IF NOT EXISTS camera_required boolean NOT NULL DEFAULT false;

DO $$
BEGIN
  IF to_regclass('public.exam_proctor_policies') IS NOT NULL THEN
    EXECUTE $q$UPDATE public.exam_sessions e SET camera_required=p.camera_required FROM public.exam_proctor_policies p WHERE p.session_id=e.id$q$;
  END IF;
  IF to_regclass('public.exam_staff_assignments') IS NOT NULL THEN
    EXECUTE $q$
      UPDATE public.exam_sessions e SET created_by_profile_id=a.staff_profile_id
      FROM public.exam_staff_assignments a
      WHERE e.created_by_profile_id IS NULL AND a.session_id=e.id AND a.role IN ('creator','owner')
    $q$;
  END IF;
END $$;

-- Current v2 data already materializes offering targets. If a legacy subject
-- paper still lacks them, fail closed instead of inferring from programme text.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='exam_sessions' AND column_name='subjects') THEN
    IF EXISTS (
      SELECT 1 FROM public.exam_sessions e
      WHERE cardinality(e.subjects)>0
        AND NOT EXISTS (SELECT 1 FROM public.exam_offering_targets t WHERE t.session_id=e.id)
    ) THEN RAISE EXCEPTION 'schema_v3_subject_exam_without_offering_target'; END IF;
  END IF;
END $$;

-- Qualifier placement programmes are relational outcomes, not string labels.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='exam_sessions' AND column_name='placement_tracks') THEN
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='academic_programmes' AND column_name='normalized_name') THEN
      INSERT INTO public.academic_programmes(name,normalized_name)
      SELECT DISTINCT btrim(track_name),lower(regexp_replace(btrim(track_name), '\s+', ' ', 'g'))
      FROM public.exam_sessions e CROSS JOIN LATERAL unnest(e.placement_tracks) AS track_name
      WHERE nullif(btrim(track_name),'') IS NOT NULL
        AND NOT EXISTS (SELECT 1 FROM public.academic_programmes p WHERE p.normalized_name=lower(regexp_replace(btrim(track_name), '\s+', ' ', 'g')));
    ELSE
      INSERT INTO public.academic_programmes(name)
      SELECT DISTINCT btrim(track_name)
      FROM public.exam_sessions e CROSS JOIN LATERAL unnest(e.placement_tracks) AS track_name
      WHERE nullif(btrim(track_name),'') IS NOT NULL
        AND NOT EXISTS (SELECT 1 FROM public.academic_programmes p WHERE lower(regexp_replace(btrim(p.name), '\s+', ' ', 'g'))=lower(regexp_replace(btrim(track_name), '\s+', ' ', 'g')));
    END IF;

    INSERT INTO public.exam_placement_programmes(session_id,programme_id)
    SELECT DISTINCT e.id,p.id
    FROM public.exam_sessions e
    CROSS JOIN LATERAL unnest(e.placement_tracks) AS track_name
    JOIN public.academic_programmes p
      ON lower(regexp_replace(btrim(p.name), '\s+', ' ', 'g')) = lower(regexp_replace(btrim(track_name), '\s+', ' ', 'g'))
    ON CONFLICT DO NOTHING;

    IF EXISTS (
      SELECT 1 FROM public.exam_sessions e
      CROSS JOIN LATERAL unnest(e.placement_tracks) AS track_name
      LEFT JOIN public.academic_programmes p
        ON lower(regexp_replace(btrim(p.name), '\s+', ' ', 'g')) = lower(regexp_replace(btrim(track_name), '\s+', ' ', 'g'))
      WHERE p.id IS NULL
    ) THEN
      RAISE EXCEPTION 'schema_v3_unresolved_exam_placement_programme';
    END IF;
  END IF;
END $$;

-- Preserve cohost relations before dropping the legacy array.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='exam_sessions' AND column_name='cohosts')
     AND EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='academic_profiles' AND column_name='legacy_user_id') THEN
    EXECUTE $q$
      INSERT INTO public.exam_staff_assignments(session_id,staff_profile_id,role,assigned_at)
      SELECT e.id,p.id,'cohost',now()
      FROM public.exam_sessions e
      CROSS JOIN LATERAL unnest(e.cohosts) AS legacy_staff_id
      JOIN public.academic_profiles p ON p.legacy_user_id=legacy_staff_id
      ON CONFLICT DO NOTHING
    $q$;
  END IF;
END $$;

-- Creator is provenance, not an access-assignment row.
DELETE FROM public.exam_staff_assignments WHERE role::text IN ('creator','owner');

-- -------------------------------------------------------------------------
-- Attempts: UUID becomes the sole durable identity. All repeated live-domain
-- labels move into one explicit immutable context_snapshot for audit history.
-- -------------------------------------------------------------------------
ALTER TABLE public.exam_attempts ADD COLUMN IF NOT EXISTS id_v3 uuid;
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='exam_attempts' AND column_name='attempt_uuid') THEN
    EXECUTE 'UPDATE public.exam_attempts SET id_v3=attempt_uuid WHERE id_v3 IS NULL';
  END IF;
END $$;
UPDATE public.exam_attempts SET id_v3=gen_random_uuid() WHERE id_v3 IS NULL;
ALTER TABLE public.exam_attempts ALTER COLUMN id_v3 SET NOT NULL;

ALTER TABLE public.exam_attempts ADD COLUMN IF NOT EXISTS context_snapshot jsonb NOT NULL DEFAULT '{}'::jsonb;
ALTER TABLE public.exam_attempts ADD COLUMN IF NOT EXISTS rewrite_source_attempt_id uuid;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='exam_attempts' AND column_name='session_title') THEN
    EXECUTE $q$
      UPDATE public.exam_attempts a
      SET context_snapshot=jsonb_build_object(
        'sessionTitle',coalesce(a.session_title,''),
        'studentName',coalesce(a.student_name,''),
        'className',nullif(concat_ws(' ',nullif(a.class_level,''),nullif(a.class_group,'')),''),
        'academicYear',nullif(a.academic_session,''),
        'academicTerm',(SELECT t.name FROM public.exam_sessions e LEFT JOIN public.academic_terms t ON t.id=e.academic_term_id WHERE e.id=a.session_id),
        'mode',coalesce(a.mode,''),
        'subjectNames',coalesce((SELECT jsonb_agg(DISTINCT s.name ORDER BY s.name)
          FROM public.exam_offering_targets ot
          JOIN public.class_subject_offerings o ON o.id=ot.offering_id
          JOIN public.subjects s ON s.id=o.subject_id
          WHERE ot.session_id=a.session_id),'[]'::jsonb)
      )
      WHERE a.context_snapshot='{}'::jsonb
    $q$;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='exam_attempts' AND column_name='rewrite_source_attempt_hash')
     AND EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='exam_attempts' AND column_name='attempt_hash') THEN
    EXECUTE $q$
      UPDATE public.exam_attempts a SET rewrite_source_attempt_id=src.id_v3
      FROM public.exam_attempts src
      WHERE a.rewrite_source_attempt_id IS NULL
        AND nullif(a.rewrite_source_attempt_hash,'') IS NOT NULL
        AND src.attempt_hash=a.rewrite_source_attempt_hash
    $q$;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM public.exam_attempts WHERE session_id IS NULL) THEN RAISE EXCEPTION 'schema_v3_attempt_without_session'; END IF;
  IF EXISTS (SELECT 1 FROM public.exam_attempts WHERE student_profile_id IS NULL) THEN RAISE EXCEPTION 'schema_v3_attempt_without_student_profile'; END IF;
  IF EXISTS (SELECT 1 FROM public.exam_attempts WHERE attempt_number IS NULL) THEN RAISE EXCEPTION 'schema_v3_attempt_without_number'; END IF;
END $$;

-- Move answer/stat relations from hashes to canonical attempt IDs.
ALTER TABLE public.exam_attempt_answers ADD COLUMN IF NOT EXISTS attempt_id uuid;
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='exam_attempt_answers' AND column_name='attempt_uuid') THEN
    EXECUTE 'UPDATE public.exam_attempt_answers SET attempt_id=attempt_uuid WHERE attempt_id IS NULL';
  ELSIF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='exam_attempt_answers' AND column_name='attempt_hash') THEN
    EXECUTE $q$UPDATE public.exam_attempt_answers d SET attempt_id=a.id_v3 FROM public.exam_attempts a WHERE d.attempt_id IS NULL AND d.attempt_hash=a.attempt_hash$q$;
  END IF;
END $$;
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM public.exam_attempt_answers WHERE attempt_id IS NULL OR question_id IS NULL) THEN RAISE EXCEPTION 'schema_v3_unresolved_attempt_answer_fk'; END IF;
END $$;

-- Runtime v2 tables become the only runtime state/event tables.
DO $$
BEGIN
  DROP TABLE IF EXISTS public.exam_responses CASCADE;

  IF to_regclass('public.exam_attempt_responses_v2') IS NOT NULL THEN
    INSERT INTO public.exam_attempt_responses(
      attempt_id,question_id,response_text,response_values,seconds,flagged
    )
    SELECT a.id_v3,r.question_id,r.response_text,r.response_values,r.seconds,r.flagged
    FROM public.exam_attempt_responses_v2 r
    JOIN public.exam_attempts a ON a.attempt_uuid=r.attempt_uuid
    ON CONFLICT (attempt_id,question_id) DO UPDATE SET
      response_text=excluded.response_text,
      response_values=excluded.response_values,
      seconds=excluded.seconds,
      flagged=excluded.flagged;
    DROP TABLE public.exam_attempt_responses_v2 CASCADE;
  END IF;

  IF to_regclass('public.exam_integrity_events_v2') IS NOT NULL THEN
    DROP TABLE IF EXISTS public.exam_integrity_events CASCADE;
    ALTER TABLE public.exam_integrity_events_v2 RENAME TO exam_integrity_events;
  END IF;
END $$;
ALTER TABLE public.exam_attempt_runtime_states ADD COLUMN IF NOT EXISTS attempt_id uuid;
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='exam_attempt_runtime_states' AND column_name='attempt_uuid') THEN
    EXECUTE 'UPDATE public.exam_attempt_runtime_states SET attempt_id=attempt_uuid WHERE attempt_id IS NULL';
  END IF;
END $$;
ALTER TABLE public.exam_attempt_responses ADD COLUMN IF NOT EXISTS attempt_id uuid;
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='exam_attempt_responses' AND column_name='attempt_uuid') THEN
    EXECUTE 'UPDATE public.exam_attempt_responses SET attempt_id=attempt_uuid WHERE attempt_id IS NULL';
  END IF;
END $$;
ALTER TABLE public.exam_integrity_events ADD COLUMN IF NOT EXISTS attempt_id uuid;
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='exam_integrity_events' AND column_name='attempt_uuid') THEN
    EXECUTE 'UPDATE public.exam_integrity_events SET attempt_id=attempt_uuid WHERE attempt_id IS NULL';
  END IF;
END $$;

-- -------------------------------------------------------------------------
-- Destructive contraction. Every drop below is preceded by a proof/guard.
-- Existing Supabase RLS policies are removed first because many reference
-- legacy columns that are about to disappear. supabase/rls.sql reinstalls the
-- canonical policies after `prisma migrate deploy`. This creates a deliberate
-- fail-closed deployment boundary instead of preserving stale policy logic.
-- -------------------------------------------------------------------------
DO $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT schemaname,tablename,policyname
    FROM pg_policies
    WHERE schemaname='public'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON %I.%I',r.policyname,r.schemaname,r.tablename);
  END LOOP;
END $$;
-- Remove old constraints that depend on columns being contracted.
ALTER TABLE public.class_enrollments DROP CONSTRAINT IF EXISTS class_enrollments_student_profile_id_class_id_academic_year_id_key;
DROP INDEX IF EXISTS class_enrollments_one_active_year_idx;
ALTER TABLE public.class_enrollments DROP COLUMN IF EXISTS academic_year_id;
ALTER TABLE public.class_enrollments DROP COLUMN IF EXISTS status;
ALTER TABLE public.class_enrollments RENAME COLUMN status_v3 TO status;

ALTER TABLE public.class_subject_offerings DROP COLUMN IF EXISTS academic_year_id;
ALTER TABLE public.class_subject_offerings DROP COLUMN IF EXISTS source;
ALTER TABLE public.class_subject_offerings DROP COLUMN IF EXISTS participation;
ALTER TABLE public.class_subject_offerings RENAME COLUMN participation_v3 TO participation;
ALTER TABLE public.class_subject_offerings DROP COLUMN IF EXISTS status;
ALTER TABLE public.class_subject_offerings RENAME COLUMN status_v3 TO status;

ALTER TABLE public.student_subject_enrollments DROP COLUMN IF EXISTS status;
ALTER TABLE public.student_subject_enrollments RENAME COLUMN status_v3 TO status;

ALTER TABLE public.staff_subject_qualifications DROP CONSTRAINT IF EXISTS staff_subject_qualifications_pkey;
ALTER TABLE public.staff_subject_qualifications DROP COLUMN IF EXISTS subject_code;
ALTER TABLE public.staff_subject_qualifications ADD PRIMARY KEY (staff_profile_id,subject_id);

DROP INDEX IF EXISTS teaching_assignments_identity_idx;
DROP INDEX IF EXISTS teaching_assignments_class_subject_idx;
ALTER TABLE public.teaching_assignments DROP COLUMN IF EXISTS class_id;
ALTER TABLE public.teaching_assignments DROP COLUMN IF EXISTS subject_code;
ALTER TABLE public.teaching_assignments DROP COLUMN IF EXISTS subject_id;
ALTER TABLE public.teaching_assignments DROP COLUMN IF EXISTS academic_year_id;
ALTER TABLE public.teaching_assignments DROP COLUMN IF EXISTS academic_term_id;
ALTER TABLE public.teaching_assignments DROP COLUMN IF EXISTS assignment_role;
ALTER TABLE public.teaching_assignments RENAME COLUMN assignment_role_v3 TO assignment_role;
ALTER TABLE public.teaching_assignments DROP COLUMN IF EXISTS status;

-- exam_subjects is superseded by offering targets and still references subjects(code).
DROP TABLE IF EXISTS public.exam_subjects CASCADE;

-- Subject table: UUID is the relational PK; legacy arrays/timestamps leave.
DO $$
DECLARE pk_name text;
BEGIN
  SELECT c.conname INTO pk_name FROM pg_constraint c
  JOIN pg_class r ON r.oid=c.conrelid JOIN pg_namespace n ON n.oid=r.relnamespace
  WHERE n.nspname='public' AND r.relname='subjects' AND c.contype='p';
  IF pk_name IS NOT NULL THEN EXECUTE format('ALTER TABLE public.subjects DROP CONSTRAINT %I',pk_name); END IF;
END $$;
ALTER TABLE public.subjects ADD PRIMARY KEY (id);
ALTER TABLE public.subjects DROP COLUMN IF EXISTS streams;
ALTER TABLE public.subjects DROP COLUMN IF EXISTS normalized_name;
ALTER TABLE public.subjects DROP COLUMN IF EXISTS code;
ALTER TABLE public.subjects DROP COLUMN IF EXISTS category;
ALTER TABLE public.subjects DROP COLUMN IF EXISTS updated_at;
ALTER TABLE public.subjects DROP COLUMN IF EXISTS updated_at_v2;
ALTER TABLE public.subjects RENAME COLUMN updated_at_v3 TO updated_at;

ALTER TABLE public.questions DROP COLUMN IF EXISTS subject_code;
ALTER TABLE public.questions DROP COLUMN IF EXISTS subject_name;
ALTER TABLE public.questions DROP COLUMN IF EXISTS label;
ALTER TABLE public.questions DROP COLUMN IF EXISTS levels;
ALTER TABLE public.questions DROP COLUMN IF EXISTS created_by;
ALTER TABLE public.questions ALTER COLUMN qtype DROP DEFAULT;
ALTER TABLE public.questions ALTER COLUMN qtype TYPE question_type USING qtype::text::question_type;
ALTER TABLE public.questions ALTER COLUMN exam_modes TYPE exam_mode[] USING exam_modes::text[]::exam_mode[];

-- Exam staff assignment PK no longer includes role, so one staff member has one
-- explicit access role per exam. Creator lives on exam_sessions.
ALTER TABLE public.exam_staff_assignments DROP CONSTRAINT IF EXISTS exam_staff_assignments_pkey;
ALTER TABLE public.exam_staff_assignments ALTER COLUMN role DROP DEFAULT;
ALTER TABLE public.exam_staff_assignments ALTER COLUMN role TYPE exam_staff_role USING role::text::exam_staff_role;
ALTER TABLE public.exam_staff_assignments ALTER COLUMN role SET DEFAULT 'cohost';
ALTER TABLE public.exam_staff_assignments ADD PRIMARY KEY (session_id,staff_profile_id);

ALTER TABLE public.exam_student_access ALTER COLUMN decision TYPE exam_access_decision USING decision::text::exam_access_decision;
ALTER TABLE public.exam_sessions ALTER COLUMN mode TYPE exam_mode USING mode::text::exam_mode;
ALTER TABLE public.exam_sessions ALTER COLUMN status DROP DEFAULT;
ALTER TABLE public.exam_sessions ALTER COLUMN status TYPE exam_status USING status::text::exam_status;
ALTER TABLE public.exam_sessions ALTER COLUMN status SET DEFAULT 'draft';

DROP TABLE IF EXISTS public.exam_proctor_policies CASCADE;
ALTER TABLE public.exam_sessions DROP COLUMN IF EXISTS class_level;
ALTER TABLE public.exam_sessions DROP COLUMN IF EXISTS class_group;
ALTER TABLE public.exam_sessions DROP COLUMN IF EXISTS academic_session;
ALTER TABLE public.exam_sessions DROP COLUMN IF EXISTS term;
ALTER TABLE public.exam_sessions DROP COLUMN IF EXISTS subjects;
ALTER TABLE public.exam_sessions DROP COLUMN IF EXISTS cohosts;
ALTER TABLE public.exam_sessions DROP COLUMN IF EXISTS placement_tracks;

-- Canonical attempt ID and detail keys. Drop dependencies on the old
-- attempt_hash/attempt_uuid keys before re-keying exam_attempts.
ALTER TABLE public.exam_attempt_answers DROP CONSTRAINT IF EXISTS exam_attempt_answers_attempt_hash_fkey;
ALTER TABLE public.exam_attempt_answers DROP CONSTRAINT IF EXISTS exam_attempt_answers_attempt_uuid_fk;
ALTER TABLE public.exam_attempt_answers DROP CONSTRAINT IF EXISTS exam_attempt_answers_question_id_fkey;
ALTER TABLE public.exam_attempt_runtime_states DROP CONSTRAINT IF EXISTS exam_attempt_runtime_states_attempt_uuid_fkey;
ALTER TABLE public.exam_integrity_events DROP CONSTRAINT IF EXISTS exam_integrity_events_v2_attempt_uuid_fkey;
ALTER TABLE public.exam_integrity_events DROP CONSTRAINT IF EXISTS exam_integrity_events_attempt_uuid_fkey;
ALTER TABLE public.exam_attempt_answers DROP CONSTRAINT IF EXISTS exam_attempt_answers_pkey;
DROP TABLE IF EXISTS public.exam_attempt_subject_stats CASCADE;
ALTER TABLE public.exam_attempt_answers DROP COLUMN IF EXISTS id;
ALTER TABLE public.exam_attempt_answers DROP COLUMN IF EXISTS attempt_hash;
ALTER TABLE public.exam_attempt_answers DROP COLUMN IF EXISTS attempt_uuid;
ALTER TABLE public.exam_attempt_answers DROP COLUMN IF EXISTS session_id;
ALTER TABLE public.exam_attempt_answers DROP COLUMN IF EXISTS candidate_hash;
ALTER TABLE public.exam_attempt_answers DROP COLUMN IF EXISTS subject_code;
ALTER TABLE public.exam_attempt_answers DROP COLUMN IF EXISTS subject_name;
ALTER TABLE public.exam_attempt_answers DROP COLUMN IF EXISTS subject_id;
ALTER TABLE public.exam_attempt_answers ALTER COLUMN attempt_id SET NOT NULL;
ALTER TABLE public.exam_attempt_answers ALTER COLUMN question_id SET NOT NULL;
ALTER TABLE public.exam_attempt_answers ADD PRIMARY KEY (attempt_id,question_id);

-- Re-key attempt table after all child rows are mapped.
DO $$
DECLARE pk_name text;
BEGIN
  SELECT c.conname INTO pk_name FROM pg_constraint c
  JOIN pg_class r ON r.oid=c.conrelid JOIN pg_namespace n ON n.oid=r.relnamespace
  WHERE n.nspname='public' AND r.relname='exam_attempts' AND c.contype='p';
  IF pk_name IS NOT NULL THEN EXECUTE format('ALTER TABLE public.exam_attempts DROP CONSTRAINT %I CASCADE',pk_name); END IF;
END $$;
ALTER TABLE public.exam_attempts DROP COLUMN IF EXISTS id;
ALTER TABLE public.exam_attempts DROP COLUMN IF EXISTS attempt_hash;
ALTER TABLE public.exam_attempts DROP COLUMN IF EXISTS attempt_uuid;
ALTER TABLE public.exam_attempts RENAME COLUMN id_v3 TO id;
ALTER TABLE public.exam_attempts ADD PRIMARY KEY (id);
ALTER TABLE public.exam_attempts ALTER COLUMN session_id SET NOT NULL;
ALTER TABLE public.exam_attempts ALTER COLUMN student_profile_id SET NOT NULL;
ALTER TABLE public.exam_attempts ALTER COLUMN attempt_number SET NOT NULL;
ALTER TABLE public.exam_attempts DROP COLUMN IF EXISTS candidate_hash;
ALTER TABLE public.exam_attempts DROP COLUMN IF EXISTS student_hash;
ALTER TABLE public.exam_attempts DROP COLUMN IF EXISTS session_title;
ALTER TABLE public.exam_attempts DROP COLUMN IF EXISTS first_name;
ALTER TABLE public.exam_attempts DROP COLUMN IF EXISTS last_name;
ALTER TABLE public.exam_attempts DROP COLUMN IF EXISTS student_name;
ALTER TABLE public.exam_attempts DROP COLUMN IF EXISTS class_level;
ALTER TABLE public.exam_attempts DROP COLUMN IF EXISTS class_group;
ALTER TABLE public.exam_attempts DROP COLUMN IF EXISTS academic_session;
ALTER TABLE public.exam_attempts DROP COLUMN IF EXISTS mode;
ALTER TABLE public.exam_attempts DROP COLUMN IF EXISTS session_status;
ALTER TABLE public.exam_attempts DROP COLUMN IF EXISTS session_ends_at;
ALTER TABLE public.exam_attempts DROP COLUMN IF EXISTS paper_fingerprint;
ALTER TABLE public.exam_attempts DROP COLUMN IF EXISTS remaining_seconds;
ALTER TABLE public.exam_attempts DROP COLUMN IF EXISTS elapsed_active_seconds;
ALTER TABLE public.exam_attempts DROP COLUMN IF EXISTS answered;
ALTER TABLE public.exam_attempts DROP COLUMN IF EXISTS question_count;
ALTER TABLE public.exam_attempts DROP COLUMN IF EXISTS rewrite_archived_at;
ALTER TABLE public.exam_attempts DROP COLUMN IF EXISTS rewrite_source_attempt_hash;

-- Runtime tables use attempt_id only.
ALTER TABLE public.exam_attempt_runtime_states DROP CONSTRAINT IF EXISTS exam_attempt_runtime_states_pkey;
ALTER TABLE public.exam_attempt_runtime_states DROP COLUMN IF EXISTS attempt_uuid;
ALTER TABLE public.exam_attempt_runtime_states DROP COLUMN IF EXISTS started_at;
ALTER TABLE public.exam_attempt_runtime_states ALTER COLUMN attempt_id SET NOT NULL;
ALTER TABLE public.exam_attempt_runtime_states ADD PRIMARY KEY (attempt_id);
ALTER TABLE public.exam_attempt_responses DROP CONSTRAINT IF EXISTS exam_attempt_responses_v2_pkey;
ALTER TABLE public.exam_attempt_responses DROP CONSTRAINT IF EXISTS exam_attempt_responses_pkey;
ALTER TABLE public.exam_attempt_responses DROP COLUMN IF EXISTS attempt_uuid;
ALTER TABLE public.exam_attempt_responses ALTER COLUMN attempt_id SET NOT NULL;
ALTER TABLE public.exam_attempt_responses ADD PRIMARY KEY (attempt_id,question_id);
ALTER TABLE public.exam_integrity_events DROP COLUMN IF EXISTS attempt_uuid;
ALTER TABLE public.exam_integrity_events ALTER COLUMN attempt_id SET NOT NULL;

DROP TABLE IF EXISTS public.exam_states CASCADE;
DROP TABLE IF EXISTS public.exam_reset_markers CASCADE;
DROP TABLE IF EXISTS public.exam_background_markers CASCADE;

-- normalized_name was a duplicated migration-era helper; name is canonical.
ALTER TABLE public.academic_programmes DROP COLUMN IF EXISTS normalized_name;

-- Remove old class labels after all relations have been materialized.
ALTER TABLE public.classes DROP COLUMN IF EXISTS class_level;
ALTER TABLE public.classes DROP COLUMN IF EXISTS stream;
ALTER TABLE public.classes DROP COLUMN IF EXISTS grp;
ALTER TABLE public.classes DROP COLUMN IF EXISTS academic_session;
ALTER TABLE public.classes DROP COLUMN IF EXISTS name;
ALTER TABLE public.classes ALTER COLUMN status DROP DEFAULT;
ALTER TABLE public.classes ALTER COLUMN status TYPE record_status USING CASE WHEN status::text='archived' THEN 'inactive'::record_status ELSE status::text::record_status END;
ALTER TABLE public.classes ALTER COLUMN status SET DEFAULT 'active';

-- Convert remaining status/role columns to canonical enum types.
ALTER TABLE public.academic_profiles ALTER COLUMN role TYPE academic_role USING role::text::academic_role;
ALTER TABLE public.academic_profiles ALTER COLUMN status DROP DEFAULT;
ALTER TABLE public.academic_profiles ALTER COLUMN status TYPE record_status USING status::text::record_status;
ALTER TABLE public.academic_profiles ALTER COLUMN status SET DEFAULT 'active';
ALTER TABLE public.academic_years ALTER COLUMN status DROP DEFAULT;
ALTER TABLE public.academic_years ALTER COLUMN status TYPE academic_period_status USING status::text::academic_period_status;
ALTER TABLE public.academic_years ALTER COLUMN status SET DEFAULT 'planned';
ALTER TABLE public.academic_terms ALTER COLUMN status DROP DEFAULT;
ALTER TABLE public.academic_terms ALTER COLUMN status TYPE academic_period_status USING status::text::academic_period_status;
ALTER TABLE public.academic_terms ALTER COLUMN status SET DEFAULT 'planned';

-- Old status columns on relationship tables were already swapped for enum columns.

-- One canonical offering row per class/subject/term, including all-year null term.
DROP INDEX IF EXISTS class_subject_offerings_identity_idx;
CREATE UNIQUE INDEX IF NOT EXISTS class_subject_offerings_identity_idx
ON public.class_subject_offerings(class_id,subject_id,coalesce(academic_term_id,'00000000-0000-0000-0000-000000000000'::uuid));
CREATE UNIQUE INDEX IF NOT EXISTS teaching_assignments_staff_offering_key ON public.teaching_assignments(staff_profile_id,offering_id);
CREATE UNIQUE INDEX IF NOT EXISTS class_enrollments_student_class_key ON public.class_enrollments(student_profile_id,class_id);
CREATE UNIQUE INDEX IF NOT EXISTS class_enrollments_one_active_class_per_student_idx ON public.class_enrollments(student_profile_id) WHERE status='active';
CREATE UNIQUE INDEX IF NOT EXISTS classes_section_identity_idx ON public.classes(academic_year_id,level_id,coalesce(programme_id,'00000000-0000-0000-0000-000000000000'::uuid),lower(btrim(arm)));
CREATE UNIQUE INDEX IF NOT EXISTS whatsapp_groups_class_key ON public.whatsapp_groups(class_id);
CREATE UNIQUE INDEX IF NOT EXISTS exam_attempts_student_number_key ON public.exam_attempts(session_id,student_profile_id,attempt_number);

-- Recreate canonical foreign keys that may have been lost when old PKs/columns
-- were contracted. Duplicate-object handling keeps the migration idempotent at
-- the SQL level while Prisma records it exactly once.
ALTER TABLE public.academic_terms DROP CONSTRAINT IF EXISTS academic_terms_academic_year_id_fkey;
DO $$ BEGIN ALTER TABLE public.academic_terms ADD CONSTRAINT academic_terms_year_fk FOREIGN KEY(academic_year_id) REFERENCES public.academic_years(id) ON DELETE RESTRICT; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
ALTER TABLE public.exam_sessions DROP CONSTRAINT IF EXISTS exam_sessions_academic_term_fk;
ALTER TABLE public.exam_sessions DROP CONSTRAINT IF EXISTS exam_sessions_academic_term_id_fkey;
DO $$ BEGIN ALTER TABLE public.exam_sessions ADD CONSTRAINT exam_sessions_term_fk FOREIGN KEY(academic_term_id) REFERENCES public.academic_terms(id) ON DELETE RESTRICT; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
ALTER TABLE public.exam_attempts DROP CONSTRAINT IF EXISTS exam_attempts_session_id_fkey;
ALTER TABLE public.exam_attempts DROP CONSTRAINT IF EXISTS exam_attempts_student_profile_fk;
DO $$ BEGIN ALTER TABLE public.exam_attempts ADD CONSTRAINT exam_attempts_session_fk FOREIGN KEY(session_id) REFERENCES public.exam_sessions(id) ON DELETE RESTRICT; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.exam_attempts ADD CONSTRAINT exam_attempts_student_fk FOREIGN KEY(student_profile_id) REFERENCES public.student_academic_profiles(profile_id) ON DELETE RESTRICT; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.classes ADD CONSTRAINT classes_level_fk FOREIGN KEY(level_id) REFERENCES public.academic_levels(id) ON DELETE RESTRICT; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.classes ADD CONSTRAINT classes_programme_fk FOREIGN KEY(programme_id) REFERENCES public.academic_programmes(id) ON DELETE RESTRICT; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.classes ADD CONSTRAINT classes_year_fk FOREIGN KEY(academic_year_id) REFERENCES public.academic_years(id) ON DELETE RESTRICT; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.staff_subject_qualifications ADD CONSTRAINT staff_subject_qualification_subject_fk FOREIGN KEY(subject_id) REFERENCES public.subjects(id) ON DELETE RESTRICT; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.teaching_assignments ADD CONSTRAINT teaching_assignment_offering_fk FOREIGN KEY(offering_id) REFERENCES public.class_subject_offerings(id) ON DELETE RESTRICT; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.questions ADD CONSTRAINT questions_subject_fk FOREIGN KEY(subject_id) REFERENCES public.subjects(id) ON DELETE RESTRICT; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
ALTER TABLE public.exam_sessions DROP CONSTRAINT IF EXISTS exam_sessions_creator_profile_fk;
ALTER TABLE public.exam_sessions DROP CONSTRAINT IF EXISTS exam_sessions_creator_fk;
DO $$ BEGIN ALTER TABLE public.exam_sessions ADD CONSTRAINT exam_sessions_creator_fk FOREIGN KEY(created_by_profile_id) REFERENCES public.staff_academic_profiles(profile_id) ON DELETE SET NULL; EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE public.exam_staff_assignments DROP CONSTRAINT IF EXISTS exam_staff_assignments_staff_profile_id_fkey;
DO $$ BEGIN ALTER TABLE public.exam_staff_assignments ADD CONSTRAINT exam_staff_assignments_staff_fk FOREIGN KEY(staff_profile_id) REFERENCES public.staff_academic_profiles(profile_id) ON DELETE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
ALTER TABLE public.exam_student_access DROP CONSTRAINT IF EXISTS exam_student_access_granted_by_profile_id_fkey;
DO $$ BEGIN ALTER TABLE public.exam_student_access ADD CONSTRAINT exam_student_access_grantor_fk FOREIGN KEY(granted_by_profile_id) REFERENCES public.staff_academic_profiles(profile_id) ON DELETE SET NULL; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
ALTER TABLE public.exam_retake_grants DROP CONSTRAINT IF EXISTS exam_retake_grants_granted_by_profile_id_fkey;
DO $$ BEGIN ALTER TABLE public.exam_retake_grants ADD CONSTRAINT exam_retake_grants_grantor_fk FOREIGN KEY(granted_by_profile_id) REFERENCES public.staff_academic_profiles(profile_id) ON DELETE RESTRICT; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
ALTER TABLE public.questions DROP CONSTRAINT IF EXISTS questions_creator_profile_fk;
ALTER TABLE public.questions DROP CONSTRAINT IF EXISTS questions_created_by_profile_id_fkey;
DO $$ BEGIN ALTER TABLE public.questions ADD CONSTRAINT questions_creator_fk FOREIGN KEY(created_by_profile_id) REFERENCES public.staff_academic_profiles(profile_id) ON DELETE SET NULL; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.exam_attempts ADD CONSTRAINT exam_attempts_rewrite_source_fk FOREIGN KEY(rewrite_source_attempt_id) REFERENCES public.exam_attempts(id) ON DELETE SET NULL; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.exam_attempt_answers ADD CONSTRAINT exam_attempt_answers_attempt_fk FOREIGN KEY(attempt_id) REFERENCES public.exam_attempts(id) ON DELETE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.exam_attempt_answers ADD CONSTRAINT exam_attempt_answers_question_fk FOREIGN KEY(question_id) REFERENCES public.questions(id) ON DELETE RESTRICT; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.exam_attempt_runtime_states ADD CONSTRAINT exam_runtime_attempt_fk FOREIGN KEY(attempt_id) REFERENCES public.exam_attempts(id) ON DELETE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.exam_attempt_responses ADD CONSTRAINT exam_response_attempt_fk FOREIGN KEY(attempt_id) REFERENCES public.exam_attempts(id) ON DELETE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.exam_integrity_events ADD CONSTRAINT exam_integrity_attempt_fk FOREIGN KEY(attempt_id) REFERENCES public.exam_attempts(id) ON DELETE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Legacy identity/migration tables are no longer runtime dependencies.
ALTER TABLE public.academic_profiles DROP COLUMN IF EXISTS legacy_user_id;
ALTER TABLE public.academic_profiles DROP COLUMN IF EXISTS full_name;
ALTER TABLE public.academic_profiles DROP COLUMN IF EXISTS email;
ALTER TABLE public.academic_profiles DROP COLUMN IF EXISTS first_name_key;
ALTER TABLE public.academic_profiles DROP COLUMN IF EXISTS last_name_key;
DROP TABLE IF EXISTS public.legacy_student_identity_links CASCADE;
DROP TABLE IF EXISTS public.schema_migration_issues CASCADE;
DROP TABLE IF EXISTS public.subject_legacy_aliases CASCADE;
DROP TABLE IF EXISTS public.student_profiles CASCADE;
DROP TABLE IF EXISTS public.users CASCADE;

-- Canonical natural-identity preflight. Do not silently merge distinct rows.
DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM public.subjects
    GROUP BY lower(regexp_replace(btrim(name), '\s+', ' ', 'g')) HAVING count(*) > 1
  ) THEN RAISE EXCEPTION 'schema_v3_duplicate_normalized_subject_name'; END IF;
  IF EXISTS (
    SELECT 1 FROM public.academic_programmes
    GROUP BY lower(regexp_replace(btrim(name), '\s+', ' ', 'g')) HAVING count(*) > 1
  ) THEN RAISE EXCEPTION 'schema_v3_duplicate_normalized_programme_name'; END IF;
  IF EXISTS (
    SELECT 1 FROM public.classes
    GROUP BY academic_year_id,level_id,coalesce(programme_id,'00000000-0000-0000-0000-000000000000'::uuid),lower(btrim(arm))
    HAVING count(*) > 1
  ) THEN RAISE EXCEPTION 'schema_v3_duplicate_class_section_identity'; END IF;
  IF EXISTS (
    SELECT student_profile_id FROM public.class_enrollments WHERE status='active' GROUP BY student_profile_id HAVING count(*) > 1
  ) THEN RAISE EXCEPTION 'schema_v3_multiple_active_class_enrollments'; END IF;
END $$;

-- Final indexes.
CREATE INDEX IF NOT EXISTS academic_profiles_role_status_idx ON public.academic_profiles(role,status);
CREATE INDEX IF NOT EXISTS academic_profiles_name_lookup_idx ON public.academic_profiles(first_name,last_name,role,status);
CREATE INDEX IF NOT EXISTS classes_year_level_programme_idx ON public.classes(academic_year_id,level_id,programme_id,status);
CREATE INDEX IF NOT EXISTS class_enrollments_class_status_idx ON public.class_enrollments(class_id,status);
CREATE INDEX IF NOT EXISTS subjects_active_name_idx ON public.subjects(active,name);
CREATE UNIQUE INDEX IF NOT EXISTS subjects_normalized_name_key ON public.subjects ((lower(regexp_replace(btrim(name), '\s+', ' ', 'g'))));
CREATE UNIQUE INDEX IF NOT EXISTS academic_programmes_normalized_name_key ON public.academic_programmes ((lower(regexp_replace(btrim(name), '\s+', ' ', 'g'))));
CREATE INDEX IF NOT EXISTS class_subject_offerings_class_status_idx ON public.class_subject_offerings(class_id,status);
CREATE INDEX IF NOT EXISTS class_subject_offerings_subject_status_idx ON public.class_subject_offerings(subject_id,status);
CREATE INDEX IF NOT EXISTS student_subject_enrollments_offering_idx ON public.student_subject_enrollments(offering_id,status);
CREATE INDEX IF NOT EXISTS staff_subject_qualifications_subject_idx ON public.staff_subject_qualifications(subject_id,active);
CREATE INDEX IF NOT EXISTS teaching_assignments_offering_active_idx ON public.teaching_assignments(offering_id,ended_at);
CREATE INDEX IF NOT EXISTS exam_sessions_status_time_idx ON public.exam_sessions(status,starts_at,ends_at);
CREATE INDEX IF NOT EXISTS exam_sessions_creator_idx ON public.exam_sessions(created_by_profile_id);
CREATE INDEX IF NOT EXISTS exam_offering_targets_offering_idx ON public.exam_offering_targets(offering_id);
CREATE INDEX IF NOT EXISTS exam_placement_programmes_programme_idx ON public.exam_placement_programmes(programme_id);
CREATE INDEX IF NOT EXISTS exam_retake_grants_lookup_idx ON public.exam_retake_grants(session_id,student_profile_id,revoked_at,expires_at);
CREATE INDEX IF NOT EXISTS exam_attempts_student_created_idx ON public.exam_attempts(student_profile_id,created_at);
CREATE INDEX IF NOT EXISTS exam_attempts_session_created_idx ON public.exam_attempts(session_id,created_at);
CREATE INDEX IF NOT EXISTS exam_integrity_events_attempt_at_idx ON public.exam_integrity_events(attempt_id,at);
CREATE INDEX IF NOT EXISTS questions_subject_idx ON public.questions(subject_id);
CREATE INDEX IF NOT EXISTS question_academic_levels_level_idx ON public.question_academic_levels(level_id);


COMMIT;
