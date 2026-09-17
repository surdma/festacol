-- Supabase Realtime publication membership for durable exam events.
-- Row Level Security in supabase/rls.sql remains the authorization boundary
-- for which authenticated recipients can receive each changed row.

BEGIN;

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
      SELECT 1
      FROM pg_publication_tables
      WHERE pubname = 'supabase_realtime'
        AND schemaname = 'public'
        AND tablename = 'exam_retake_grants'
    ) THEN
      EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE public.exam_retake_grants';
    END IF;

    IF NOT EXISTS (
      SELECT 1
      FROM pg_publication_tables
      WHERE pubname = 'supabase_realtime'
        AND schemaname = 'public'
        AND tablename = 'exam_attempts'
    ) THEN
      EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE public.exam_attempts';
    END IF;
  END IF;
END $$;

COMMIT;
