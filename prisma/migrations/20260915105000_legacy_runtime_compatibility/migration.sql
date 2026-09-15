-- Compatibility shim for the legacy Supabase runtime immediately before the
-- relational v3 cutover.
--
-- Legacy exam_attempts.id is an application label, not a relational key. The
-- v3 migration promotes attempt_uuid/id_v3 to the canonical UUID primary key.
-- If the legacy runtime is present, create the new response table without an
-- attempt foreign key so v3 can copy response rows before re-keying attempts.
-- v3 installs exam_response_attempt_fk only after the UUID primary key exists.
DO $$
BEGIN
  IF to_regclass('public.exam_attempts') IS NOT NULL
     AND to_regclass('public.exam_attempt_responses_v2') IS NOT NULL
     AND to_regclass('public.exam_attempt_responses') IS NULL THEN
    CREATE TABLE public.exam_attempt_responses (
      attempt_id uuid NOT NULL,
      question_id bigint NOT NULL REFERENCES public.questions(id) ON DELETE RESTRICT,
      response_text text,
      response_values text[] NOT NULL DEFAULT '{}',
      seconds double precision NOT NULL DEFAULT 0,
      flagged boolean NOT NULL DEFAULT false,
      PRIMARY KEY (attempt_id, question_id)
    );
  END IF;
END $$;
