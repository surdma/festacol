-- 08-academic-identity-cutover.sql
-- Moves runtime identity to auth.users.id -> academic_profiles.
-- No typed login value may create an academic person. Supabase Auth remains
-- the authentication authority; public academic tables hold domain identity.

begin;

alter table public.academic_profiles
  add column if not exists first_name_key text,
  add column if not exists last_name_key text;

create or replace function private.identity_name_key(p_value text)
returns text
language sql
immutable
strict
as $$
  select lower(regexp_replace(btrim(p_value), '\s+', ' ', 'g'));
$$;

update public.academic_profiles
set first_name_key = private.identity_name_key(first_name),
    last_name_key = private.identity_name_key(last_name)
where first_name_key is null or last_name_key is null;

alter table public.academic_profiles
  alter column first_name_key set not null,
  alter column last_name_key set not null;

create index if not exists academic_profiles_student_login_idx
  on public.academic_profiles(role, status, first_name_key, last_name_key);

create or replace function private.set_academic_profile_name_keys()
returns trigger
language plpgsql
set search_path = public, private
as $$
begin
  new.first_name_key := private.identity_name_key(new.first_name);
  new.last_name_key := private.identity_name_key(new.last_name);
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists academic_profiles_name_keys_trg on public.academic_profiles;
create trigger academic_profiles_name_keys_trg
before insert or update of first_name, last_name on public.academic_profiles
for each row execute function private.set_academic_profile_name_keys();

-- Service-role-only atomic claim. This is deliberately not executable by an
-- authenticated browser session: a candidate cannot bind an arbitrary roster
-- profile to their own Auth UUID.
create or replace function public.claim_student_auth_identity(
  p_profile_id uuid,
  p_auth_user_id uuid
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_current uuid;
  v_role text;
  v_status text;
begin
  select auth_user_id, role, status
    into v_current, v_role, v_status
  from public.academic_profiles
  where id = p_profile_id
  for update;

  if not found or v_role <> 'student' or v_status <> 'active' then
    return false;
  end if;

  if v_current is not null then
    return v_current = p_auth_user_id;
  end if;

  if exists (
    select 1 from public.academic_profiles
    where auth_user_id = p_auth_user_id and id <> p_profile_id
  ) then
    return false;
  end if;

  update public.academic_profiles
  set auth_user_id = p_auth_user_id, updated_at = now()
  where id = p_profile_id and auth_user_id is null;

  return found;
end;
$$;

revoke all on function public.claim_student_auth_identity(uuid, uuid) from public;
revoke all on function public.claim_student_auth_identity(uuid, uuid) from authenticated;
grant execute on function public.claim_student_auth_identity(uuid, uuid) to service_role;

create or replace function private.current_academic_role()
returns text
language sql
stable
security definer
set search_path = public, auth
as $$
  select p.role
  from public.academic_profiles p
  where p.auth_user_id = auth.uid() and p.status = 'active'
  limit 1;
$$;

create or replace function private.is_admin_v2()
returns boolean
language sql
stable
security definer
set search_path = public, auth
as $$
  select coalesce(private.current_academic_role() = 'administrator', false);
$$;

create or replace function private.is_staff_v2()
returns boolean
language sql
stable
security definer
set search_path = public, auth
as $$
  select coalesce(private.current_academic_role() in ('teacher','administrator'), false);
$$;

revoke all on function private.current_academic_role() from public;
revoke all on function private.is_admin_v2() from public;
revoke all on function private.is_staff_v2() from public;
grant execute on function private.current_academic_role() to authenticated;
grant execute on function private.is_admin_v2() to authenticated;
grant execute on function private.is_staff_v2() to authenticated;

-- Own academic role extension and enrollment reads.
drop policy if exists student_profiles_self_update_v2 on public.student_academic_profiles;
create policy student_profiles_self_update_v2 on public.student_academic_profiles
  for update to authenticated
  using (profile_id = private.current_academic_profile_id())
  with check (profile_id = private.current_academic_profile_id());

drop policy if exists class_enrollments_self_read_v2 on public.class_enrollments;
create policy class_enrollments_self_read_v2 on public.class_enrollments
  for select to authenticated
  using (student_profile_id = private.current_academic_profile_id());

drop policy if exists staff_subject_qualifications_self_read_v2 on public.staff_subject_qualifications;
create policy staff_subject_qualifications_self_read_v2 on public.staff_subject_qualifications
  for select to authenticated
  using (staff_profile_id = private.current_academic_profile_id());

drop policy if exists teaching_assignments_self_read_v2 on public.teaching_assignments;
create policy teaching_assignments_self_read_v2 on public.teaching_assignments
  for select to authenticated
  using (staff_profile_id = private.current_academic_profile_id());

-- Student attempt reads now key from the academic profile. Legacy hash policies
-- remain only until the later attempt/RLS contract migration removes them.
drop policy if exists ea_student_profile_select_v2 on public.exam_attempts;
create policy ea_student_profile_select_v2 on public.exam_attempts
  for select to authenticated
  using (student_profile_id = private.current_academic_profile_id());

commit;
