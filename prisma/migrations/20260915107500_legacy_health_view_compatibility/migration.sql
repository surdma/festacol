-- Retire the Supabase migration-readiness view before Prisma v3 contracts the
-- legacy relationship columns it observes. This view is tooling-only and is
-- not part of the Prisma-owned application schema.
DROP VIEW IF EXISTS public.academic_schema_health;
