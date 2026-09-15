-- 01-schema-delta.sql — LEGACY UPGRADE STEP ONLY.
-- Do not use this file to bootstrap a new environment; use supabase/schema.sql.
-- This file catches an older prototype database up to the pre-normalization
-- shape so 04-normalize.sql can backfill and remove its historical JSONB
-- columns safely. 05-prisma-alignment.sql verifies the final typed shape.
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

-- Live DB drift: class_id is NOT NULL there (prototype schema says nullable).
alter table public.users
  alter column class_id drop not null;

-- Class arms (Science A / Art C / Commercial D …).
alter table public.classes
  add column if not exists arm text not null default '';

-- Exam modes: qualifier, BECE, WAEC/NECO/JAMB practice, mixed, single.
do $$
declare cname text;
begin
  select conname into cname from pg_constraint
    where conrelid = 'public.exam_sessions'::regclass and contype = 'c'
      and pg_get_constraintdef(oid) like '%mode%';
  if cname is not null then
    execute format('alter table public.exam_sessions drop constraint %I', cname);
  end if;
  alter table public.exam_sessions
    add constraint exam_sessions_mode_check
    check (mode in ('qualifier','bece','waec','neco','jamb','mixed','single'));
exception when duplicate_object then null;
end $$;

-- Legacy catalog starts in the historical JSONB shape only so 04 can migrate
-- it using the same path as an already-existing prototype database.
create table if not exists public.subjects (
  code text primary key,
  name text not null,
  category text not null default 'elective',
  streams jsonb not null default '[]'::jsonb,
  active boolean not null default true,
  updated_at bigint not null
);
