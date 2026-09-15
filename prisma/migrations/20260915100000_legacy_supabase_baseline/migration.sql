-- Prisma adoption baseline for Festacol's pre-existing Supabase-managed public schema.
--
-- Existing deployments must mark this migration as applied once before running
-- `prisma migrate deploy`:
--   prisma migrate resolve --applied 20260915100000_legacy_supabase_baseline
--
-- The next migration performs the actual legacy-to-Prisma relational cutover.
-- This baseline is intentionally a no-op so migration history has an explicit
-- boundary without recreating or duplicating tables that already exist.
SELECT 1;
