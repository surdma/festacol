-- Festacol prototype — migration: standardize table names + real relations.
-- Run ONCE in Supabase Dashboard → SQL Editor, AFTER seed_classes.sql.
-- Renames preserve every row; old split question tables are merged into the
-- one questions store automatically when present. Do not run twice.

-- ------------------------------------------------- 1. rename (data kept)
alter table if exists public.app_users rename to users;
alter table if exists public.student_states rename to exam_states;
alter table if exists public.attempt_reset_markers rename to exam_reset_markers;
alter table if exists public.background_markers rename to exam_background_markers;
alter table if exists public.proctor_policies rename to exam_proctor_policies;

-- ----------------------------------- 2. attempts keep history, not cascade
alter table public.exam_attempts drop constraint if exists exam_attempts_session_id_fkey;
alter table public.exam_attempts alter column session_id drop not null;
alter table public.exam_attempts
  add constraint exam_attempts_session_id_fkey
  foreign key (session_id) references public.exam_sessions(id) on delete set null;

-- ------------------------------------------------- 3. users link to classes
update public.users set class_id = null where class_id = '';
alter table public.users drop constraint if exists users_class_id_fkey;
alter table public.users
  add constraint users_class_id_fkey
  foreign key (class_id) references public.classes(id) on delete set null;

-- ----------------------------------------- 4. control rows die with session
alter table public.exam_states drop constraint if exists exam_states_session_id_fkey;
alter table public.exam_states
  add constraint exam_states_session_id_fkey
  foreign key (session_id) references public.exam_sessions(id) on delete cascade;

alter table public.exam_reset_markers drop constraint if exists exam_reset_markers_session_id_fkey;
alter table public.exam_reset_markers
  add constraint exam_reset_markers_session_id_fkey
  foreign key (session_id) references public.exam_sessions(id) on delete cascade;

alter table public.exam_background_markers drop constraint if exists exam_background_markers_session_id_fkey;
alter table public.exam_background_markers
  add constraint exam_background_markers_session_id_fkey
  foreign key (session_id) references public.exam_sessions(id) on delete cascade;

alter table public.exam_proctor_policies drop constraint if exists exam_proctor_policies_session_id_fkey;
alter table public.exam_proctor_policies
  add constraint exam_proctor_policies_session_id_fkey
  foreign key (session_id) references public.exam_sessions(id) on delete cascade;

alter table public.whatsapp_groups drop constraint if exists whatsapp_groups_class_id_fkey;
alter table public.whatsapp_groups
  add constraint whatsapp_groups_class_id_fkey
  foreign key (class_id) references public.classes(id) on delete cascade;

-- ------------------------------------- 5. one question store (seed+teacher)
create table if not exists public.questions (
  id bigint primary key,
  origin text not null default 'seed' check (origin in ('seed','teacher')),
  data jsonb not null,
  subject_code text not null default '',
  updated_at bigint not null
);
create index if not exists questions_origin_idx on public.questions (origin);
create index if not exists questions_subject_idx on public.questions (subject_code);

create table if not exists public.question_bank (
  id integer primary key,
  question_set_id text not null,
  subject_catalog jsonb not null,
  assessment_alignment jsonb,
  question_count integer not null default 0,
  updated_at bigint not null
);

-- Move any rows from the old split tables, then retire them.
do $$
begin
  if to_regclass('public.custom_questions') is not null then
    insert into public.questions (id, origin, data, subject_code, updated_at)
    select id, 'teacher', data, coalesce(data->>'subjectCode',''), coalesce((data->>'updatedAt')::bigint, (extract(epoch from now())*1000)::bigint)
    from public.custom_questions
    on conflict (id) do nothing;
  end if;
  if to_regclass('public.question_bank_items') is not null then
    insert into public.questions (id, origin, data, subject_code, updated_at)
    select id, 'seed', data, coalesce(data->>'subjectCode',''), coalesce((data->>'updatedAt')::bigint, (extract(epoch from now())*1000)::bigint)
    from public.question_bank_items
    on conflict (id) do nothing;
  end if;
  if to_regclass('public.question_bank_meta') is not null then
    insert into public.question_bank (id, question_set_id, subject_catalog, assessment_alignment, question_count, updated_at)
    select id, question_set_id, subject_catalog, assessment_alignment, question_count, updated_at
    from public.question_bank_meta
    on conflict (id) do nothing;
  end if;
end $$;

drop table if exists public.custom_questions;
drop table if exists public.question_bank_items;
drop table if exists public.question_bank_meta;

alter table public.question_overrides drop constraint if exists question_overrides_question_id_fkey;
alter table public.question_overrides
  add constraint question_overrides_question_id_fkey
  foreign key (question_id) references public.questions(id) on delete cascade;

-- ----------------------------------------- 6. policies follow the new names
alter table public.questions enable row level security;
alter table public.question_bank enable row level security;

do $$
begin
  if not exists (select 1 from pg_policies where policyname = 'prototype anon all users') then
    create policy "prototype anon all users" on public.users for all to anon using (true) with check (true);
  end if;
  if not exists (select 1 from pg_policies where policyname = 'prototype anon all exam_states') then
    create policy "prototype anon all exam_states" on public.exam_states for all to anon using (true) with check (true);
  end if;
  if not exists (select 1 from pg_policies where policyname = 'prototype anon all exam_reset_markers') then
    create policy "prototype anon all exam_reset_markers" on public.exam_reset_markers for all to anon using (true) with check (true);
  end if;
  if not exists (select 1 from pg_policies where policyname = 'prototype anon all exam_background_markers') then
    create policy "prototype anon all exam_background_markers" on public.exam_background_markers for all to anon using (true) with check (true);
  end if;
  if not exists (select 1 from pg_policies where policyname = 'prototype anon all exam_proctor_policies') then
    create policy "prototype anon all exam_proctor_policies" on public.exam_proctor_policies for all to anon using (true) with check (true);
  end if;
  if not exists (select 1 from pg_policies where policyname = 'prototype anon all questions') then
    create policy "prototype anon all questions" on public.questions for all to anon using (true) with check (true);
  end if;
  if not exists (select 1 from pg_policies where policyname = 'prototype anon all question_bank') then
    create policy "prototype anon all question_bank" on public.question_bank for all to anon using (true) with check (true);
  end if;
  -- Retire policies still named after the old tables (renames carried them over).
  drop policy if exists "prototype anon all app_users" on public.users;
  drop policy if exists "prototype anon all student_states" on public.exam_states;
  drop policy if exists "prototype anon all reset_markers" on public.exam_reset_markers;
  drop policy if exists "prototype anon all background_markers" on public.exam_background_markers;
  drop policy if exists "prototype anon all proctor_policies" on public.exam_proctor_policies;
  drop policy if exists "prototype anon all custom_questions" on public.questions;
  drop policy if exists "prototype anon all question_bank_meta" on public.question_bank;
  drop policy if exists "prototype anon all question_bank_items" on public.questions;
end $$;
