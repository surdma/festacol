-- Festacol prototype — Supabase (Postgres) schema
-- Run this in Supabase Dashboard → SQL Editor (or via psql with your connection string).
-- Connection string pattern:
--   postgresql://postgres:[YOUR-PASSWORD]@db.ktjadzttsziosuhqzupz.supabase.co:5432/postgres
-- This schema is the persistent source of truth for the /prototype static app.
-- The prototype no longer uses localStorage / sessionStorage / in-memory maps
-- as durable storage; those are only ephemeral per-tab pointers or test fallbacks.

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------- sessions
create table if not exists public.exam_sessions (
  id text primary key,
  title text not null,
  class_level text not null check (class_level in ('SS1','SS2','SS3')),
  class_group text not null default 'General',
  academic_session text not null default '2026/2027',
  term text not null default 'First term',
  mode text not null check (mode in ('qualifier','mixed','single','waec')),
  subjects jsonb not null default '[]'::jsonb,
  placement_tracks jsonb not null default '[]'::jsonb,
  duration_seconds integer not null check (duration_seconds between 30 and 10800),
  question_count integer not null check (question_count between 5 and 150),
  status text not null default 'open' check (status in ('open','draft','closed')),
  instructions text not null default '',
  starts_at bigint,
  ends_at bigint,
  attempt_limit integer not null default 1,
  integrity_policy jsonb not null default '{"focusMonitoring":true,"fullscreenPrompt":true,"clipboardGuard":true,"warnAfter":2}'::jsonb,
  randomization jsonb not null default '{"questionOrder":true,"optionOrder":true,"minimizePaperCollisions":true}'::jsonb,
  created_at bigint not null,
  updated_at bigint not null
);

-- ---------------------------------------------------------------- attempts
create table if not exists public.exam_attempts (
  id text not null,
  attempt_hash text primary key,
  candidate_hash text not null,
  student_hash text not null default '',
  paper_fingerprint text not null default '',
  session_id text not null references public.exam_sessions(id) on delete cascade,
  session_title text not null default '',
  first_name text not null default '',
  last_name text not null default '',
  student_name text not null default '',
  class_level text not null default '',
  class_group text not null default '',
  academic_session text not null default '2026/2027',
  mode text not null default '',
  session_status text not null default '',
  session_ends_at bigint,
  subjects jsonb not null default '[]'::jsonb,
  started_at bigint,
  submitted_at bigint,
  remaining_seconds double precision,
  elapsed_active_seconds double precision not null default 0,
  answered integer not null default 0,
  question_count integer not null default 0,
  score double precision,
  correct_count double precision,
  completion double precision,
  pace_index double precision,
  reasoning_index double precision,
  integrity_score double precision,
  integrity_events jsonb not null default '[]'::jsonb,
  subject_stats jsonb not null default '[]'::jsonb,
  placement jsonb,
  details jsonb not null default '[]'::jsonb,
  question_ids jsonb not null default '[]'::jsonb,
  submission_reason text not null default '',
  rewrite_archived_at bigint,
  rewrite_source_attempt_hash text not null default '',
  created_at bigint not null default (extract(epoch from now()) * 1000)::bigint
);
create index if not exists exam_attempts_session_idx on public.exam_attempts (session_id);
create index if not exists exam_attempts_candidate_idx on public.exam_attempts (session_id, candidate_hash);
create index if not exists exam_attempts_student_idx on public.exam_attempts (student_hash);

-- ------------------------------------------------------- student states
create table if not exists public.student_states (
  session_id text not null,
  candidate_hash text not null,
  state jsonb not null,
  updated_at bigint not null,
  primary key (session_id, candidate_hash)
);

-- ------------------------------------------------------ student profiles
create table if not exists public.student_profiles (
  student_hash text primary key,
  candidate_hash text not null default '',
  first_name text not null default '',
  last_name text not null default '',
  full_name text not null default '',
  phone text not null default '',
  guardian text not null default '',
  current_class_id text not null default '',
  academic_session text not null default '2026/2027',
  updated_at bigint not null
);

-- -------------------------------------------------------- reset markers
create table if not exists public.attempt_reset_markers (
  session_id text not null,
  candidate_hash text not null,
  reset_at bigint not null,
  primary key (session_id, candidate_hash)
);

-- ----------------------------------------------------- background markers
-- Replaces the old localStorage background-guard used to reconcile timers
-- when the exam tab is hidden/closed and reopened.
create table if not exists public.background_markers (
  session_id text not null,
  candidate_hash text not null,
  marker jsonb not null,
  updated_at bigint not null,
  primary key (session_id, candidate_hash)
);

-- ------------------------------------------------------------ app users
create table if not exists public.app_users (
  id text primary key,
  full_name text not null,
  first_name text not null default '',
  last_name text not null default '',
  class_id text not null default '',
  role text not null default 'student' check (role in ('student','teacher','administrator')),
  status text not null default 'active' check (status in ('active','inactive')),
  guardian text not null default '',
  academic_session text not null default '2026/2027',
  promotion_status text not null default 'on-track',
  joined_at bigint not null
);

-- -------------------------------------------------------------- classes
create table if not exists public.classes (
  id text primary key,
  class_level text not null,
  name text not null,
  stream text not null default 'General',
  grp text not null default 'General',
  capacity integer not null default 40,
  room text not null default '',
  academic_session text not null default '2026/2027',
  status text not null default 'active' check (status in ('active','archived'))
);

-- ----------------------------------------------------- custom questions
create table if not exists public.custom_questions (
  id bigint primary key,
  data jsonb not null,
  created_at bigint not null default (extract(epoch from now()) * 1000)::bigint
);

-- --------------------------------------------------- question overrides
create table if not exists public.question_overrides (
  question_id bigint primary key,
  patch jsonb not null,
  updated_at bigint not null
);

-- ------------------------------------------------------- whatsapp groups
create table if not exists public.whatsapp_groups (
  id text primary key,
  class_id text not null,
  name text not null,
  invite_url text not null,
  created_at bigint not null,
  updated_at bigint not null
);

-- ------------------------------------------------------- proctor policies
create table if not exists public.proctor_policies (
  session_id text primary key,
  camera_required boolean not null default false,
  updated_at bigint not null
);

-- --------------------------------------------------- question bank (seed)
-- Replaces data/questions.json as the runtime source of truth.
-- Admin "Sync questions.json to database" upserts the seed file here;
-- the exam runtime loads from these tables (filtered by exam config).
create table if not exists public.question_bank_meta (
  id integer primary key,
  question_set_id text not null,
  subject_catalog jsonb not null,
  assessment_alignment jsonb,
  question_count integer not null default 0,
  updated_at bigint not null
);
create table if not exists public.question_bank_items (
  id bigint primary key,
  data jsonb not null,
  subject_code text not null default '',
  updated_at bigint not null
);
create index if not exists question_bank_items_subject_idx on public.question_bank_items (subject_code);

-- ------------------------------------------------------------------ RLS
-- Prototype uses the anon key directly, so enable permissive RLS policies.
-- Tighten these before any production use (authenticated roles + server checks).
alter table public.exam_sessions enable row level security;
alter table public.exam_attempts enable row level security;
alter table public.student_states enable row level security;
alter table public.student_profiles enable row level security;
alter table public.attempt_reset_markers enable row level security;
alter table public.background_markers enable row level security;
alter table public.app_users enable row level security;
alter table public.classes enable row level security;
alter table public.custom_questions enable row level security;
alter table public.question_overrides enable row level security;
alter table public.whatsapp_groups enable row level security;
alter table public.proctor_policies enable row level security;
alter table public.question_bank_meta enable row level security;
alter table public.question_bank_items enable row level security;

do $$
begin
  if not exists (select 1 from pg_policies where policyname = 'prototype anon all exam_sessions') then
    create policy "prototype anon all exam_sessions" on public.exam_sessions for all to anon using (true) with check (true);
  end if;
  if not exists (select 1 from pg_policies where policyname = 'prototype anon all exam_attempts') then
    create policy "prototype anon all exam_attempts" on public.exam_attempts for all to anon using (true) with check (true);
  end if;
  if not exists (select 1 from pg_policies where policyname = 'prototype anon all student_states') then
    create policy "prototype anon all student_states" on public.student_states for all to anon using (true) with check (true);
  end if;
  if not exists (select 1 from pg_policies where policyname = 'prototype anon all student_profiles') then
    create policy "prototype anon all student_profiles" on public.student_profiles for all to anon using (true) with check (true);
  end if;
  if not exists (select 1 from pg_policies where policyname = 'prototype anon all reset_markers') then
    create policy "prototype anon all reset_markers" on public.attempt_reset_markers for all to anon using (true) with check (true);
  end if;
  if not exists (select 1 from pg_policies where policyname = 'prototype anon all background_markers') then
    create policy "prototype anon all background_markers" on public.background_markers for all to anon using (true) with check (true);
  end if;
  if not exists (select 1 from pg_policies where policyname = 'prototype anon all app_users') then
    create policy "prototype anon all app_users" on public.app_users for all to anon using (true) with check (true);
  end if;
  if not exists (select 1 from pg_policies where policyname = 'prototype anon all classes') then
    create policy "prototype anon all classes" on public.classes for all to anon using (true) with check (true);
  end if;
  if not exists (select 1 from pg_policies where policyname = 'prototype anon all custom_questions') then
    create policy "prototype anon all custom_questions" on public.custom_questions for all to anon using (true) with check (true);
  end if;
  if not exists (select 1 from pg_policies where policyname = 'prototype anon all question_overrides') then
    create policy "prototype anon all question_overrides" on public.question_overrides for all to anon using (true) with check (true);
  end if;
  if not exists (select 1 from pg_policies where policyname = 'prototype anon all whatsapp_groups') then
    create policy "prototype anon all whatsapp_groups" on public.whatsapp_groups for all to anon using (true) with check (true);
  end if;
  if not exists (select 1 from pg_policies where policyname = 'prototype anon all proctor_policies') then
    create policy "prototype anon all proctor_policies" on public.proctor_policies for all to anon using (true) with check (true);
  end if;
  if not exists (select 1 from pg_policies where policyname = 'prototype anon all question_bank_meta') then
    create policy "prototype anon all question_bank_meta" on public.question_bank_meta for all to anon using (true) with check (true);
  end if;
  if not exists (select 1 from pg_policies where policyname = 'prototype anon all question_bank_items') then
    create policy "prototype anon all question_bank_items" on public.question_bank_items for all to anon using (true) with check (true);
  end if;
end $$;
