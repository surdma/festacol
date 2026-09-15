-- Academic/curriculum v4.
--
-- This migration removes the remaining free-form programme duplication left by
-- relational v3. A class has one finite senior-school track, curriculum
-- eligibility lives on subject_track_rules, concrete teaching lives on
-- class_subject_offerings + teaching_assignments, and exam placement stores the
-- finite track directly. It also restores a stable subject import code and
-- persists exam-session links/QR representations.

BEGIN;

DO $$
BEGIN
  CREATE TYPE public.academic_track AS ENUM ('science', 'art', 'social_science');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- -------------------------------------------------------------------------
-- Classes: programme text/table -> finite track enum.
-- -------------------------------------------------------------------------
ALTER TABLE public.classes
  ADD COLUMN IF NOT EXISTS track public.academic_track;

DO $$
BEGIN
  IF to_regclass('public.academic_programmes') IS NOT NULL
     AND EXISTS (
       SELECT 1
       FROM public.classes c
       JOIN public.academic_programmes p ON p.id = c.programme_id
       WHERE lower(regexp_replace(btrim(p.name), '[^A-Za-z]+', ' ', 'g'))
             NOT IN (
               'science',
               'art', 'arts', 'humanities',
               'commercial', 'commerce', 'business', 'social science', 'social sciences',
               'qualifier', 'pre placement', 'preplacement', 'general'
             )
     ) THEN
    RAISE EXCEPTION 'academic_v4_unmapped_class_programme';
  END IF;
END $$;

UPDATE public.classes c
SET track = CASE
  WHEN n.normalized_name = 'science' THEN 'science'::public.academic_track
  WHEN n.normalized_name IN ('art', 'arts', 'humanities') THEN 'art'::public.academic_track
  WHEN n.normalized_name IN ('commercial', 'commerce', 'business', 'social science', 'social sciences')
    THEN 'social_science'::public.academic_track
  ELSE NULL
END
FROM (
  SELECT id, lower(regexp_replace(btrim(name), '[^A-Za-z]+', ' ', 'g')) AS normalized_name
  FROM public.academic_programmes
) n
WHERE c.programme_id = n.id
  AND c.track IS NULL;

-- -------------------------------------------------------------------------
-- Subjects: UUID remains the relational PK; code is the stable fixture/import
-- key. Known repository subjects receive their canonical codes. Unrecognized
-- existing subjects remain valid and receive a stable row-local legacy code
-- rather than being silently merged with another subject.
-- -------------------------------------------------------------------------
ALTER TABLE public.subjects
  ADD COLUMN IF NOT EXISTS code text;

WITH canonical(normalized_name, code) AS (
  VALUES
    ('english language', 'eng'),
    ('mathematics', 'mat'),
    ('biology', 'bio'),
    ('chemistry', 'chem'),
    ('physics', 'phy'),
    ('economics', 'eco'),
    ('government', 'gov'),
    ('literature in english', 'lit'),
    ('civic education', 'civ'),
    ('geography', 'geo'),
    ('agricultural science', 'agric'),
    ('computer studies', 'comp'),
    ('english studies', 'q-eng'),
    ('mathematics aptitude', 'q-math'),
    ('basic science technology', 'q-bst'),
    ('social citizenship studies', 'q-social'),
    ('business studies', 'q-business'),
    ('digital technologies', 'q-digital'),
    ('further mathematics', 'fmath'),
    ('data processing', 'dproc'),
    ('history', 'hist'),
    ('nigerian history', 'hist-ng'),
    ('christian religious studies', 'crs'),
    ('french', 'french'),
    ('visual art', 'vart'),
    ('financial accounting', 'acct'),
    ('accounting', 'acct-alt'),
    ('commerce', 'comm'),
    ('business management', 'busm'),
    ('marketing', 'mkt')
)
UPDATE public.subjects s
SET code = c.code
FROM canonical c
WHERE s.code IS NULL
  AND lower(regexp_replace(btrim(s.name), '[^A-Za-z0-9]+', ' ', 'g')) = c.normalized_name;

-- Prefer the question-bank code for General Mathematics only when a canonical
-- Mathematics row does not already own it.
UPDATE public.subjects s
SET code = CASE
  WHEN EXISTS (
    SELECT 1 FROM public.subjects m
    WHERE m.id <> s.id
      AND lower(regexp_replace(btrim(m.name), '[^A-Za-z0-9]+', ' ', 'g')) = 'mathematics'
  ) THEN 'gmat'
  ELSE 'mat'
END
WHERE s.code IS NULL
  AND lower(regexp_replace(btrim(s.name), '[^A-Za-z0-9]+', ' ', 'g')) = 'general mathematics';

-- Preserve old bank-only subject rows without conflating them with the current
-- canonical qualifier subjects.
WITH legacy(normalized_name, code) AS (
  VALUES
    ('english legacy bank', 'q-eng-legacy'),
    ('mathematics legacy bank', 'q-math-legacy'),
    ('basic science legacy bank', 'q-bst-legacy'),
    ('social studies legacy bank', 'q-social-legacy'),
    ('business legacy bank', 'q-business-legacy'),
    ('digital ict legacy bank', 'q-digital-legacy')
)
UPDATE public.subjects s
SET code = l.code
FROM legacy l
WHERE s.code IS NULL
  AND lower(regexp_replace(btrim(s.name), '[^A-Za-z0-9]+', ' ', 'g')) = l.normalized_name;

UPDATE public.subjects
SET code = 'subject-' || substr(replace(id::text, '-', ''), 1, 12)
WHERE code IS NULL OR nullif(btrim(code), '') IS NULL;

DO $$
BEGIN
  IF EXISTS (
    SELECT lower(code)
    FROM public.subjects
    GROUP BY lower(code)
    HAVING count(*) > 1
  ) THEN
    RAISE EXCEPTION 'academic_v4_duplicate_subject_code';
  END IF;
END $$;

ALTER TABLE public.subjects
  ALTER COLUMN code SET NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS subjects_code_key
  ON public.subjects(code);

-- Curriculum eligibility is distinct from a concrete class offering. Existing
-- offerings provide a lossless initial rule set; fixture seeding can add the
-- wider curriculum catalog without changing teaching assignments.
CREATE TABLE IF NOT EXISTS public.subject_track_rules (
  subject_id uuid NOT NULL,
  track public.academic_track NOT NULL,
  participation public.offering_participation NOT NULL DEFAULT 'elective',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT subject_track_rules_pkey PRIMARY KEY (subject_id, track),
  CONSTRAINT subject_track_rules_subject_fk
    FOREIGN KEY (subject_id) REFERENCES public.subjects(id) ON DELETE CASCADE
);

INSERT INTO public.subject_track_rules(subject_id, track, participation)
SELECT
  o.subject_id,
  c.track,
  CASE
    WHEN bool_or(o.participation = 'required'::public.offering_participation)
      THEN 'required'::public.offering_participation
    ELSE 'elective'::public.offering_participation
  END
FROM public.class_subject_offerings o
JOIN public.classes c ON c.id = o.class_id
WHERE c.track IS NOT NULL
GROUP BY o.subject_id, c.track
ON CONFLICT (subject_id, track) DO UPDATE
SET participation = EXCLUDED.participation,
    updated_at = now();

CREATE INDEX IF NOT EXISTS subject_track_rules_track_participation_idx
  ON public.subject_track_rules(track, participation);

-- -------------------------------------------------------------------------
-- Qualifier placement: finite track relation replaces free-form programmes.
-- -------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.exam_placement_tracks (
  session_id text NOT NULL,
  track public.academic_track NOT NULL,
  CONSTRAINT exam_placement_tracks_pkey PRIMARY KEY (session_id, track),
  CONSTRAINT exam_placement_tracks_session_fk
    FOREIGN KEY (session_id) REFERENCES public.exam_sessions(id) ON DELETE CASCADE
);

DO $$
BEGIN
  IF to_regclass('public.exam_placement_programmes') IS NOT NULL
     AND EXISTS (
       SELECT 1
       FROM public.exam_placement_programmes ep
       JOIN public.academic_programmes p ON p.id = ep.programme_id
       WHERE lower(regexp_replace(btrim(p.name), '[^A-Za-z]+', ' ', 'g'))
             NOT IN (
               'science',
               'art', 'arts', 'humanities',
               'commercial', 'commerce', 'business', 'social science', 'social sciences',
               'qualifier', 'pre placement', 'preplacement', 'general'
             )
     ) THEN
    RAISE EXCEPTION 'academic_v4_unmapped_exam_placement_programme';
  END IF;
END $$;

INSERT INTO public.exam_placement_tracks(session_id, track)
SELECT
  ep.session_id,
  CASE
    WHEN n.normalized_name = 'science' THEN 'science'::public.academic_track
    WHEN n.normalized_name IN ('art', 'arts', 'humanities') THEN 'art'::public.academic_track
    WHEN n.normalized_name IN ('commercial', 'commerce', 'business', 'social science', 'social sciences')
      THEN 'social_science'::public.academic_track
    ELSE NULL
  END
FROM public.exam_placement_programmes ep
JOIN (
  SELECT id, lower(regexp_replace(btrim(name), '[^A-Za-z]+', ' ', 'g')) AS normalized_name
  FROM public.academic_programmes
) n ON n.id = ep.programme_id
WHERE n.normalized_name NOT IN ('qualifier', 'pre placement', 'preplacement', 'general')
ON CONFLICT DO NOTHING;

CREATE INDEX IF NOT EXISTS exam_placement_tracks_track_idx
  ON public.exam_placement_tracks(track);

-- Attempt outcomes use the same enum; snapshots remain intentionally immutable
-- audit context and are not a live duplicate of class/subject relations.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM public.exam_attempts
    WHERE assigned_track IS NOT NULL
      AND nullif(btrim(assigned_track), '') IS NOT NULL
      AND lower(regexp_replace(btrim(assigned_track), '[^A-Za-z]+', ' ', 'g'))
          NOT IN (
            'science',
            'art', 'arts', 'humanities',
            'commercial', 'commerce', 'business', 'social science', 'social sciences'
          )
  ) THEN
    RAISE EXCEPTION 'academic_v4_unmapped_attempt_track';
  END IF;
END $$;

UPDATE public.exam_attempts
SET assigned_track = CASE
  WHEN assigned_track IS NULL OR nullif(btrim(assigned_track), '') IS NULL THEN NULL
  WHEN lower(regexp_replace(btrim(assigned_track), '[^A-Za-z]+', ' ', 'g')) = 'science' THEN 'science'
  WHEN lower(regexp_replace(btrim(assigned_track), '[^A-Za-z]+', ' ', 'g')) IN ('art', 'arts', 'humanities') THEN 'art'
  ELSE 'social_science'
END;

ALTER TABLE public.exam_attempts
  ALTER COLUMN assigned_track TYPE public.academic_track
  USING assigned_track::public.academic_track;

-- -------------------------------------------------------------------------
-- Persistent exam navigation. The opaque token identifies the session link;
-- authorization remains relational and must still be checked at exam entry.
-- QR rows reference the link as their source of truth. rendered_data is
-- optional cached representation, not a second session/link identity.
-- -------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.exam_session_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id text NOT NULL UNIQUE,
  token varchar(96) NOT NULL UNIQUE,
  active boolean NOT NULL DEFAULT true,
  expires_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT exam_session_links_session_fk
    FOREIGN KEY (session_id) REFERENCES public.exam_sessions(id) ON DELETE CASCADE
);

INSERT INTO public.exam_session_links(session_id, token)
SELECT
  e.id,
  replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', '')
FROM public.exam_sessions e
ON CONFLICT (session_id) DO NOTHING;

CREATE INDEX IF NOT EXISTS exam_session_links_active_expiry_idx
  ON public.exam_session_links(active, expires_at);

CREATE TABLE IF NOT EXISTS public.exam_qr_codes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  link_id uuid NOT NULL UNIQUE,
  revision integer NOT NULL DEFAULT 1 CHECK (revision > 0),
  content_type text NOT NULL DEFAULT 'image/svg+xml',
  rendered_data text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT exam_qr_codes_link_fk
    FOREIGN KEY (link_id) REFERENCES public.exam_session_links(id) ON DELETE CASCADE
);

INSERT INTO public.exam_qr_codes(link_id)
SELECT id FROM public.exam_session_links
ON CONFLICT (link_id) DO NOTHING;

-- -------------------------------------------------------------------------
-- Retire the free-form programme graph only after all live references are
-- converted. Keep the offering/assignment graph unchanged.
-- -------------------------------------------------------------------------
ALTER TABLE public.classes
  DROP CONSTRAINT IF EXISTS classes_programme_fk,
  DROP CONSTRAINT IF EXISTS classes_programme_id_fkey;

DROP INDEX IF EXISTS classes_section_identity_idx;
DROP INDEX IF EXISTS classes_academic_year_id_level_id_programme_id_status_idx;

DROP TABLE IF EXISTS public.exam_placement_programmes;
ALTER TABLE public.classes DROP COLUMN IF EXISTS programme_id;
DROP TABLE IF EXISTS public.academic_programmes;

CREATE INDEX IF NOT EXISTS classes_track_status_idx
  ON public.classes(academic_year_id, level_id, track, status);
CREATE UNIQUE INDEX IF NOT EXISTS classes_section_identity_idx
  ON public.classes(
    academic_year_id,
    level_id,
    track,
    lower(btrim(arm))
  ) NULLS NOT DISTINCT;

COMMIT;
