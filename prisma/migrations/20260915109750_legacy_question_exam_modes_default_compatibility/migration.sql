-- Legacy questions.exam_modes is a text[] column with a text[] default.
-- PostgreSQL cannot automatically cast that default while relational v3
-- changes the column to exam_mode[]. Remove only the legacy default here;
-- the canonical enum[] default is restored after v3 completes.
DO $$
BEGIN
  IF to_regclass('public.questions') IS NOT NULL
     AND EXISTS (
       SELECT 1
       FROM information_schema.columns
       WHERE table_schema = 'public'
         AND table_name = 'questions'
         AND column_name = 'exam_modes'
     ) THEN
    ALTER TABLE public.questions
      ALTER COLUMN exam_modes DROP DEFAULT;
  END IF;
END $$;
