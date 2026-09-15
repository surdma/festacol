-- The v3 cutover promotes subjects.id (UUID) to the canonical primary key.
-- questions.subject_id is backfilled and validated before that swap, but the
-- legacy questions.subject_code FK still depends on subjects(code), preventing
-- PostgreSQL from dropping the old subjects primary key. Remove only that
-- superseded FK here; v3 later drops subject_code and installs the UUID FK.
ALTER TABLE public.questions
  DROP CONSTRAINT IF EXISTS questions_subject_code_fkey;
