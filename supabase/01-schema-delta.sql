-- 01-schema-delta.sql — run FIRST in Supabase SQL editor.
-- Adds the staff-identity + cohost columns (Prisma schema already includes
-- them; this is the one-time catch-up because the live DB predates them).
-- After this, Prisma owns all future schema changes (`prisma migrate dev`).
-- NOTE: needs the pooler (6543) or SQL editor — direct 5432 may be blocked.

alter table public.users
  add column if not exists auth_user_id text unique;
alter table public.users
  add column if not exists email text not null default '';
alter table public.users
  add column if not exists subjects jsonb not null default '[]'::jsonb;
alter table public.users
  add column if not exists qualifier_access boolean not null default false;

alter table public.exam_sessions
  add column if not exists cohosts jsonb not null default '[]'::jsonb;
