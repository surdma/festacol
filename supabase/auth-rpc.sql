-- Festacol Supabase platform integration: Auth-linked helpers and RPCs.
--
-- IMPORTANT: This file does NOT own public application tables or migrations.
-- Run `prisma migrate deploy` first. This file may then be applied from the
-- Supabase SQL editor (or equivalent deployment step) because it references
-- Supabase-managed auth.uid(), auth.users and database roles.

begin;

create extension if not exists pgcrypto;
create schema if not exists private;

-- Prisma owns academic_profiles, but Supabase owns auth.users. This is the one
-- intentional cross-schema FK that stays in the Supabase integration layer.
alter table public.academic_profiles
  drop constraint if exists academic_profiles_auth_user_fk;
alter table public.academic_profiles
  add constraint academic_profiles_auth_user_fk
  foreign key (auth_user_id) references auth.users(id) on delete set null;

create or replace function private.current_academic_profile_id()
returns uuid
language sql
stable
security definer
set search_path = public, auth
as $$
  select p.id
  from public.academic_profiles p
  where p.auth_user_id = auth.uid()
    and p.status = 'active'
  limit 1;
$$;

-- Keep the helper's SQL contract as text across the legacy -> Prisma enum
-- cutover. Authorization consumers compare stable role labels; exposing the
-- physical enum type here would make CREATE OR REPLACE incompatible with the
-- already-deployed legacy function and unnecessarily couple Supabase helpers
-- to Prisma's storage representation.
create or replace function private.current_academic_role()
returns text
language sql
stable
security definer
set search_path = public, auth
as $$
  select p.role::text
  from public.academic_profiles p
  where p.auth_user_id = auth.uid()
    and p.status = 'active'
  limit 1;
$$;

create or replace function private.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public, auth
as $$
  select coalesce(private.current_academic_role() = 'administrator', false);
$$;

create or replace function private.is_staff()
returns boolean
language sql
stable
security definer
set search_path = public, auth
as $$
  select coalesce(private.current_academic_role() in ('teacher','administrator'), false);
$$;

-- Student login resolution intentionally does not create an academic identity.
-- It is service-role only because it runs before the student's Auth session
-- exists. Normalization is calculated at query time, avoiding duplicated
-- first_name_key/last_name_key columns in public schema.
create or replace function public.resolve_student_profile_by_name(
  p_first_name text,
  p_last_name text
)
returns table(
  profile_id uuid,
  auth_user_id uuid,
  first_name text,
  last_name text,
  student_number text
)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_first text := lower(regexp_replace(btrim(coalesce(p_first_name,'')), '\s+', ' ', 'g'));
  v_last text := lower(regexp_replace(btrim(coalesce(p_last_name,'')), '\s+', ' ', 'g'));
  v_count integer;
begin
  if v_first = '' or v_last = '' then
    return;
  end if;

  select count(*)::integer into v_count
  from public.academic_profiles p
  join public.student_academic_profiles s on s.profile_id = p.id
  where p.role = 'student'
    and p.status = 'active'
    and lower(regexp_replace(btrim(p.first_name), '\s+', ' ', 'g')) = v_first
    and lower(regexp_replace(btrim(p.last_name), '\s+', ' ', 'g')) = v_last;

  if v_count > 1 then
    raise exception 'student_identity_ambiguous';
  end if;

  return query
  select p.id,p.auth_user_id,p.first_name,p.last_name,s.student_number
  from public.academic_profiles p
  join public.student_academic_profiles s on s.profile_id = p.id
  where p.role = 'student'
    and p.status = 'active'
    and lower(regexp_replace(btrim(p.first_name), '\s+', ' ', 'g')) = v_first
    and lower(regexp_replace(btrim(p.last_name), '\s+', ' ', 'g')) = v_last
  limit 1;
end;
$$;

-- Atomically attach a pre-existing academic student to a Supabase Auth UUID.
-- No domain student is ever created by this function.
create or replace function public.claim_student_auth_identity(
  p_profile_id uuid,
  p_auth_user_id uuid
)
returns uuid
language plpgsql
volatile
security definer
set search_path = public, auth
as $$
declare
  v_profile public.academic_profiles%rowtype;
begin
  select * into v_profile
  from public.academic_profiles p
  where p.id = p_profile_id
  for update;

  if not found or v_profile.role <> 'student' or v_profile.status <> 'active' then
    raise exception 'student_profile_required';
  end if;

  if not exists (select 1 from auth.users u where u.id = p_auth_user_id) then
    raise exception 'auth_user_not_found';
  end if;

  if v_profile.auth_user_id is null then
    begin
      update public.academic_profiles
      set auth_user_id = p_auth_user_id, updated_at = now()
      where id = p_profile_id;
    exception when unique_violation then
      raise exception 'auth_identity_already_claimed';
    end;
  elsif v_profile.auth_user_id <> p_auth_user_id then
    raise exception 'student_identity_already_linked';
  end if;

  return p_profile_id;
end;
$$;

create or replace function private.student_is_enrolled_in_offering(
  p_offering_id uuid,
  p_student_profile_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.student_subject_enrollments e
    where e.offering_id = p_offering_id
      and e.student_profile_id = p_student_profile_id
      and e.status = 'active'
  );
$$;

create or replace function private.student_is_targeted_for_exam(
  p_session_id text,
  p_student_profile_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select case
    when exists (
      select 1
      from public.exam_student_access esa
      where esa.session_id = p_session_id
        and esa.student_profile_id = p_student_profile_id
        and esa.decision = 'deny'
        and (esa.valid_from is null or esa.valid_from <= now())
        and (esa.valid_until is null or esa.valid_until >= now())
    ) then false
    when exists (
      select 1
      from public.exam_student_access esa
      where esa.session_id = p_session_id
        and esa.student_profile_id = p_student_profile_id
        and esa.decision = 'allow'
        and (esa.valid_from is null or esa.valid_from <= now())
        and (esa.valid_until is null or esa.valid_until >= now())
    ) then true
    when exists (
      select 1
      from public.exam_offering_targets eot
      join public.class_subject_offerings o on o.id = eot.offering_id
      join public.class_enrollments ce on ce.class_id = o.class_id
      where eot.session_id = p_session_id
        and ce.student_profile_id = p_student_profile_id
        and ce.status = 'active'
        and (
          o.participation = 'required'
          or exists (
            select 1
            from public.student_subject_enrollments sse
            where sse.offering_id = o.id
              and sse.student_profile_id = p_student_profile_id
              and sse.status = 'active'
          )
        )
    ) then true
    else exists (
      select 1
      from public.exam_class_targets ect
      join public.class_enrollments ce on ce.class_id = ect.class_id
      join public.exam_sessions es on es.id = ect.session_id
      where ect.session_id = p_session_id
        and ce.student_profile_id = p_student_profile_id
        and ce.status = 'active'
        and ce.academic_year_id = es.academic_year_id
        and not exists (
          select 1 from public.exam_offering_targets eot
          where eot.session_id = p_session_id
        )
    )
  end;
$$;

create or replace function private.staff_can_access_class(
  p_staff_profile_id uuid,
  p_class_id text
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select private.is_admin()
    or exists (
      select 1
      from public.staff_academic_profiles sap
      where sap.profile_id = p_staff_profile_id
        and sap.is_class_teacher = true
        and sap.class_teacher_class_id = p_class_id
    )
    or exists (
      select 1
      from public.teaching_assignments ta
      join public.class_subject_offerings o on o.id = ta.offering_id
      where ta.staff_profile_id = p_staff_profile_id
        and ta.status = 'active'
        and o.class_id = p_class_id
        and o.status = 'active'
    );
$$;

create or replace function private.staff_can_access_subject(
  p_staff_profile_id uuid,
  p_subject_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select private.is_admin()
    or exists (
      select 1
      from public.staff_subject_qualifications q
      where q.staff_profile_id = p_staff_profile_id
        and q.subject_id = p_subject_id
    )
    or exists (
      select 1
      from public.teaching_assignments ta
      join public.class_subject_offerings o on o.id = ta.offering_id
      where ta.staff_profile_id = p_staff_profile_id
        and ta.status = 'active'
        and o.subject_id = p_subject_id
        and o.status = 'active'
    );
$$;

create or replace function private.teacher_is_assigned_to_offering(
  p_staff_profile_id uuid,
  p_offering_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select private.is_admin()
    or exists (
      select 1
      from public.teaching_assignments ta
      where ta.staff_profile_id = p_staff_profile_id
        and ta.offering_id = p_offering_id
        and ta.status = 'active'
    );
$$;

create or replace function private.staff_can_access_exam(
  p_staff_profile_id uuid,
  p_session_id text
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select private.is_admin()
    or exists (
      select 1
      from public.exam_sessions es
      where es.id = p_session_id
        and es.created_by_profile_id = p_staff_profile_id
    )
    or exists (
      select 1
      from public.exam_staff_assignments esa
      where esa.session_id = p_session_id
        and esa.staff_profile_id = p_staff_profile_id
    )
    or exists (
      select 1
      from public.exam_offering_targets eot
      where eot.session_id = p_session_id
        and private.teacher_is_assigned_to_offering(p_staff_profile_id,eot.offering_id)
    )
    or exists (
      select 1
      from public.exam_class_targets ect
      where ect.session_id = p_session_id
        and private.staff_can_access_class(p_staff_profile_id,ect.class_id)
    );
$$;

create or replace function private.student_allowed_attempts(
  p_session_id text,
  p_student_profile_id uuid
)
returns integer
language sql
stable
security definer
set search_path = public
as $$
  select greatest(
    0,
    coalesce(
      (
        select esa.max_attempts_override
        from public.exam_student_access esa
        where esa.session_id = p_session_id
          and esa.student_profile_id = p_student_profile_id
          and esa.decision = 'allow'
          and (esa.valid_from is null or esa.valid_from <= now())
          and (esa.valid_until is null or esa.valid_until >= now())
      ),
      (select es.attempt_limit from public.exam_sessions es where es.id = p_session_id),
      0
    )
    + coalesce(
      (
        select sum(r.additional_attempts)::integer
        from public.exam_retake_grants r
        where r.session_id = p_session_id
          and r.student_profile_id = p_student_profile_id
          and r.revoked_at is null
          and (r.expires_at is null or r.expires_at >= now())
      ),
      0
    )
  );
$$;

revoke all on function public.resolve_student_profile_by_name(text,text) from public;
revoke all on function public.resolve_student_profile_by_name(text,text) from authenticated;
grant execute on function public.resolve_student_profile_by_name(text,text) to service_role;

revoke all on function public.claim_student_auth_identity(uuid,uuid) from public;
revoke all on function public.claim_student_auth_identity(uuid,uuid) from authenticated;
grant execute on function public.claim_student_auth_identity(uuid,uuid) to service_role;

commit;
