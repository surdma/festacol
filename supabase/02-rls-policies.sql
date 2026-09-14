-- 02-rls-policies.sql — run SECOND in Supabase SQL editor (after 01).
-- Replaces the prototype's open-anon policies with role-based access:
--   students      → own rows + open sessions (answers stay app-layer gated*)
--   teachers      → own subjects (+qualifier iff granted, +cohosted exams)
--   administrators→ everything, via app_metadata.role (service-role bypasses
--                   RLS entirely and is used for provisioning/bootstrap)
-- Identity source is app_metadata (server-written). user_metadata is NEVER
-- trusted here — it is user-editable.
-- *Students with a valid JWT can technically SELECT questions rows (needed
--  by the paper engine); correct answers never reach the browser because
--  Server Actions strip them (sanitizePaper). Splitting answers into a
--  separate table is the future hardening step.

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------- helpers
create schema if not exists private;

create or replace function private.is_admin()
returns boolean language sql stable as $$
  select coalesce((auth.jwt() -> 'app_metadata' ->> 'role'), '') = 'administrator';
$$;

create or replace function private.my_student_hash()
returns text language sql stable as $$
  select nullif(coalesce(
    (auth.jwt() -> 'app_metadata' ->> 'student_hash'),
    (auth.jwt() -> 'user_metadata' ->> 'student_hash'), ''), '');
$$;

-- SHA-256 hex, byte-identical to the app's candidateHash derivation:
--   festacol-attempt|<UPPER session>|<student_hash>
create or replace function private.expected_candidate(p_session_id text)
returns text language sql stable as $$
  select encode(digest(
    'festacol-attempt|' || upper(p_session_id) || '|' || private.my_student_hash(),
    'sha256'), 'hex');
$$;

-- Teacher access to one exam row: cohost, qualifier privilege, or subject overlap.
create or replace function private.teacher_may_access_session(
  s_subjects jsonb, s_mode text, s_cohosts jsonb
) returns boolean language sql stable as $$
  select exists (
    select 1 from public.users u
    where u.auth_user_id = (select auth.uid())::text
      and u.role = 'teacher'
      and u.status = 'active'
      and (
        coalesce(s_cohosts, '[]'::jsonb) ? u.id
        or (s_mode = 'qualifier' and u.qualifier_access)
        or (s_mode <> 'qualifier' and coalesce(jsonb_array_length(s_subjects), 0) = 0)
        or (coalesce(s_subjects, '[]'::jsonb) ?| array(
              select jsonb_array_elements_text(coalesce(u.subjects, '[]'::jsonb))))
      )
  );
$$;

create or replace function private.teacher_may_access_attempt(p_session_id text)
returns boolean language sql stable as $$
  select exists (
    select 1 from public.exam_sessions s
    where s.id = p_session_id
      and private.teacher_may_access_session(s.subjects, s.mode, s.cohosts)
  );
$$;

-- ------------------------------------------------- anonymous: no access
revoke all on all tables in schema public from anon;
grant select, insert, update, delete on all tables in schema public to authenticated;

-- ------------------------------------------------- drop prototype policies
do $$
declare t text;
begin
  foreach t in array array[
    'classes','users','student_profiles','exam_sessions','exam_attempts',
    'exam_states','exam_reset_markers','exam_background_markers',
    'exam_proctor_policies','whatsapp_groups','questions',
    'question_overrides','question_bank','subjects']
  loop
    execute format('drop policy if exists %I on public.%I', 'prototype anon all ' || t, t);
  end loop;
end $$;

-- ------------------------------------------- drop own policies (re-runnable)
drop policy if exists es_admin_all on public.exam_sessions;
drop policy if exists es_open_select on public.exam_sessions;
drop policy if exists es_teacher_select on public.exam_sessions;
drop policy if exists es_teacher_insert on public.exam_sessions;
drop policy if exists es_teacher_update on public.exam_sessions;
drop policy if exists es_teacher_delete on public.exam_sessions;
drop policy if exists ea_admin_all on public.exam_attempts;
drop policy if exists ea_student_select on public.exam_attempts;
drop policy if exists ea_student_insert on public.exam_attempts;
drop policy if exists ea_student_update on public.exam_attempts;
drop policy if exists ea_teacher_select on public.exam_attempts;
drop policy if exists ea_teacher_update on public.exam_attempts;
drop policy if exists est_admin_all on public.exam_states;
drop policy if exists est_student_all on public.exam_states;
drop policy if exists est_teacher_all on public.exam_states;
drop policy if exists erm_admin_all on public.exam_reset_markers;
drop policy if exists erm_teacher_all on public.exam_reset_markers;
drop policy if exists ebm_admin_all on public.exam_background_markers;
drop policy if exists ebm_teacher_all on public.exam_background_markers;
drop policy if exists epp_admin_all on public.exam_proctor_policies;
drop policy if exists epp_open_select on public.exam_proctor_policies;
drop policy if exists epp_teacher_select on public.exam_proctor_policies;
drop policy if exists epp_teacher_write on public.exam_proctor_policies;
drop policy if exists u_admin_all on public.users;
drop policy if exists u_self_select on public.users;
drop policy if exists u_student_select on public.users;
drop policy if exists u_teacher_insert on public.users;
drop policy if exists u_teacher_update on public.users;
drop policy if exists sp_admin_all on public.student_profiles;
drop policy if exists sp_own_select on public.student_profiles;
drop policy if exists sp_own_update on public.student_profiles;
drop policy if exists c_admin_all on public.classes;
drop policy if exists c_read on public.classes;
drop policy if exists w_admin_all on public.whatsapp_groups;
drop policy if exists w_read on public.whatsapp_groups;
drop policy if exists q_admin_all on public.questions;
drop policy if exists q_read on public.questions;
drop policy if exists q_teacher_insert on public.questions;
drop policy if exists q_teacher_write on public.questions;
drop policy if exists q_teacher_delete on public.questions;
drop policy if exists qo_admin_all on public.question_overrides;
drop policy if exists qo_read on public.question_overrides;
drop policy if exists qb_admin_all on public.question_bank;
drop policy if exists qb_read on public.question_bank;
drop policy if exists sub_admin_all on public.subjects;
drop policy if exists sub_read on public.subjects;

-- ---------------------------------------------------------- exam_sessions
create policy es_admin_all on public.exam_sessions
  for all to authenticated
  using (private.is_admin()) with check (private.is_admin());

create policy es_open_select on public.exam_sessions
  for select to authenticated using (status = 'open');

create policy es_teacher_select on public.exam_sessions
  for select to authenticated
  using (private.teacher_may_access_session(subjects, mode, cohosts));

create policy es_teacher_insert on public.exam_sessions
  for insert to authenticated
  with check (private.teacher_may_access_session(subjects, mode, cohosts));

create policy es_teacher_update on public.exam_sessions
  for update to authenticated
  using (private.teacher_may_access_session(subjects, mode, cohosts))
  with check (private.teacher_may_access_session(subjects, mode, cohosts));

create policy es_teacher_delete on public.exam_sessions
  for delete to authenticated
  using (private.teacher_may_access_session(subjects, mode, cohosts));

-- ----------------------------------------------------------- exam_attempts
create policy ea_admin_all on public.exam_attempts
  for all to authenticated
  using (private.is_admin()) with check (private.is_admin());

create policy ea_student_select on public.exam_attempts
  for select to authenticated
  using (student_hash = private.my_student_hash());

create policy ea_student_insert on public.exam_attempts
  for insert to authenticated
  with check (student_hash = private.my_student_hash());

create policy ea_student_update on public.exam_attempts
  for update to authenticated
  using (student_hash = private.my_student_hash() and submitted_at is null)
  with check (student_hash = private.my_student_hash());

create policy ea_teacher_select on public.exam_attempts
  for select to authenticated
  using (session_id is not null and private.teacher_may_access_attempt(session_id));

create policy ea_teacher_update on public.exam_attempts
  for update to authenticated
  using (session_id is not null and private.teacher_may_access_attempt(session_id))
  with check (session_id is not null and private.teacher_may_access_attempt(session_id));

-- ------------------------------------------------------------- exam_states
create policy est_admin_all on public.exam_states
  for all to authenticated
  using (private.is_admin()) with check (private.is_admin());

create policy est_student_all on public.exam_states
  for all to authenticated
  using (candidate_hash = private.expected_candidate(session_id))
  with check (candidate_hash = private.expected_candidate(session_id));

create policy est_teacher_all on public.exam_states
  for all to authenticated
  using (private.teacher_may_access_attempt(session_id))
  with check (private.teacher_may_access_attempt(session_id));

-- --------------------------------------- reset + background markers (staff)
create policy erm_admin_all on public.exam_reset_markers
  for all to authenticated
  using (private.is_admin()) with check (private.is_admin());

create policy erm_teacher_all on public.exam_reset_markers
  for all to authenticated
  using (private.teacher_may_access_attempt(session_id))
  with check (private.teacher_may_access_attempt(session_id));

create policy ebm_admin_all on public.exam_background_markers
  for all to authenticated
  using (private.is_admin()) with check (private.is_admin());

create policy ebm_teacher_all on public.exam_background_markers
  for all to authenticated
  using (private.teacher_may_access_attempt(session_id))
  with check (private.teacher_may_access_attempt(session_id));

-- ----------------------------------------------------- proctor policies
create policy epp_admin_all on public.exam_proctor_policies
  for all to authenticated
  using (private.is_admin()) with check (private.is_admin());

create policy epp_open_select on public.exam_proctor_policies
  for select to authenticated
  using (exists (select 1 from public.exam_sessions s where s.id = session_id and s.status = 'open'));

create policy epp_teacher_select on public.exam_proctor_policies
  for select to authenticated
  using (private.teacher_may_access_attempt(session_id));

create policy epp_teacher_write on public.exam_proctor_policies
  for insert to authenticated
  with check (private.teacher_may_access_attempt(session_id));

-- ------------------------------------------------------------------- users
create policy u_admin_all on public.users
  for all to authenticated
  using (private.is_admin()) with check (private.is_admin());

create policy u_self_select on public.users
  for select to authenticated
  using (auth_user_id = (select auth.uid())::text);

create policy u_student_select on public.users
  for select to authenticated
  using (role = 'student');

create policy u_teacher_insert on public.users
  for insert to authenticated
  with check (
    role = 'student'
    and (auth.jwt() -> 'app_metadata' ->> 'role') = 'teacher');

create policy u_teacher_update on public.users
  for update to authenticated
  using (
    role = 'student'
    and (auth.jwt() -> 'app_metadata' ->> 'role') = 'teacher')
  with check (role = 'student');

-- -------------------------------------------------------- student_profiles
create policy sp_admin_all on public.student_profiles
  for all to authenticated
  using (private.is_admin()) with check (private.is_admin());

create policy sp_own_select on public.student_profiles
  for select to authenticated
  using (student_hash = private.my_student_hash());

-- UPDATE needs its own SELECT policy (present above) to return rows.
create policy sp_own_update on public.student_profiles
  for update to authenticated
  using (student_hash = private.my_student_hash())
  with check (student_hash = private.my_student_hash());

-- ------------------------------------------------- read-mostly tables
create policy c_admin_all on public.classes
  for all to authenticated
  using (private.is_admin()) with check (private.is_admin());
create policy c_read on public.classes
  for select to authenticated using (true);

create policy w_admin_all on public.whatsapp_groups
  for all to authenticated
  using (private.is_admin()) with check (private.is_admin());
create policy w_read on public.whatsapp_groups
  for select to authenticated using (true);

create policy q_admin_all on public.questions
  for all to authenticated
  using (private.is_admin()) with check (private.is_admin());
create policy q_read on public.questions
  for select to authenticated using (true);
create policy q_teacher_insert on public.questions
  for insert to authenticated
  with check (
    (auth.jwt() -> 'app_metadata' ->> 'role') = 'teacher'
    and subject_code in (
      select jsonb_array_elements_text(coalesce(u.subjects, '[]'::jsonb))
      from public.users u
      where u.auth_user_id = (select auth.uid())::text));
create policy q_teacher_write on public.questions
  for update to authenticated
  using (
    (auth.jwt() -> 'app_metadata' ->> 'role') = 'teacher'
    and subject_code in (
      select jsonb_array_elements_text(coalesce(u.subjects, '[]'::jsonb))
      from public.users u
      where u.auth_user_id = (select auth.uid())::text))
  with check (
    (auth.jwt() -> 'app_metadata' ->> 'role') = 'teacher'
    and subject_code in (
      select jsonb_array_elements_text(coalesce(u.subjects, '[]'::jsonb))
      from public.users u
      where u.auth_user_id = (select auth.uid())::text));
-- NOTE: seed-row protection stays in the app (origin check); policy only
-- scopes by subject.
create policy q_teacher_delete on public.questions
  for delete to authenticated
  using (
    (auth.jwt() -> 'app_metadata' ->> 'role') = 'teacher'
    and subject_code in (
      select jsonb_array_elements_text(coalesce(u.subjects, '[]'::jsonb))
      from public.users u
      where u.auth_user_id = (select auth.uid())::text));

create policy qo_admin_all on public.question_overrides
  for all to authenticated
  using (private.is_admin()) with check (private.is_admin());
create policy qo_read on public.question_overrides
  for select to authenticated using (true);

create policy qb_admin_all on public.question_bank
  for all to authenticated
  using (private.is_admin()) with check (private.is_admin());
create policy qb_read on public.question_bank
  for select to authenticated using (true);

alter table public.subjects enable row level security;
create policy sub_admin_all on public.subjects
  for all to authenticated
  using (private.is_admin()) with check (private.is_admin());
create policy sub_read on public.subjects
  for select to authenticated using (active = true or private.is_admin());

-- --------------------------------- realtime payloads (updates + deletes)
alter table public.exam_sessions replica identity full;
alter table public.exam_attempts replica identity full;
alter table public.users replica identity full;
alter table public.classes replica identity full;
alter table public.questions replica identity full;
alter table public.exam_states replica identity full;
alter table public.whatsapp_groups replica identity full;
alter table public.question_bank replica identity full;
alter table public.subjects replica identity full;
