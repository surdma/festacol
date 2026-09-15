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

create or replace function private.current_academic_role()
returns academic_role
language sql
stable
security definer
set search_path = public, auth
as $$
  select p.role
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
    from public.class_subject_offerings o
    join public.classes c on c.id = o.class_id and c.status = 'active'
    join public.class_enrollments ce
      on ce.class_id = o.class_id
     and ce.student_profile_id = p_student_profile_id
     and ce.status = 'active'
    where o.id = p_offering_id
      and o.status = 'active'
      and (
        o.participation = 'required'
        or exists (
          select 1
          from public.student_subject_enrollments se
          where se.offering_id = o.id
            and se.student_profile_id = p_student_profile_id
            and se.status = 'active'
        )
      )
  );
$$;

create or replace function private.teacher_is_qualified_for_subject(
  p_staff_profile_id uuid,
  p_subject_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.staff_subject_qualifications q
    where q.staff_profile_id = p_staff_profile_id
      and q.subject_id = p_subject_id
      and q.active
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
  select exists (
    select 1
    from public.teaching_assignments ta
    where ta.staff_profile_id = p_staff_profile_id
      and ta.offering_id = p_offering_id
      and ta.ended_at is null
  );
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
  select
    exists (
      select 1 from public.academic_profiles p
      where p.id = p_staff_profile_id
        and p.role = 'administrator'
        and p.status = 'active'
    )
    or exists (
      select 1
      from public.teaching_assignments ta
      join public.class_subject_offerings o on o.id = ta.offering_id
      where ta.staff_profile_id = p_staff_profile_id
        and ta.ended_at is null
        and o.class_id = p_class_id
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
  select
    exists (
      select 1 from public.academic_profiles p
      where p.id = p_staff_profile_id
        and p.role = 'administrator'
        and p.status = 'active'
    )
    or private.teacher_is_qualified_for_subject(p_staff_profile_id,p_subject_id);
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
  select
    exists (
      select 1 from public.academic_profiles p
      where p.id = p_staff_profile_id
        and p.role = 'administrator'
        and p.status = 'active'
    )
    or exists (
      select 1 from public.exam_sessions e
      where e.id = p_session_id
        and e.created_by_profile_id = p_staff_profile_id
    )
    or exists (
      select 1 from public.exam_staff_assignments a
      where a.session_id = p_session_id
        and a.staff_profile_id = p_staff_profile_id
    )
    or exists (
      select 1
      from public.exam_offering_targets t
      join public.teaching_assignments ta on ta.offering_id = t.offering_id
      where t.session_id = p_session_id
        and ta.staff_profile_id = p_staff_profile_id
        and ta.ended_at is null
    )
    or exists (
      select 1
      from public.exam_sessions e
      join public.staff_academic_profiles sp on sp.profile_id = p_staff_profile_id
      where e.id = p_session_id
        and e.mode = 'qualifier'
        and sp.qualifier_access
    );
$$;

create or replace function private.student_is_targeted_for_exam(
  p_session_id text,
  p_student_profile_id uuid
)
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_decision exam_access_decision;
begin
  select esa.decision into v_decision
  from public.exam_student_access esa
  where esa.session_id = p_session_id
    and esa.student_profile_id = p_student_profile_id
    and (esa.valid_from is null or esa.valid_from <= now())
    and (esa.valid_until is null or esa.valid_until > now());

  if v_decision = 'deny' then return false; end if;
  if v_decision = 'allow' then return true; end if;

  if exists (select 1 from public.exam_offering_targets t where t.session_id = p_session_id) then
    return exists (
      select 1
      from public.exam_offering_targets t
      where t.session_id = p_session_id
        and private.student_is_enrolled_in_offering(t.offering_id,p_student_profile_id)
    );
  end if;

  return exists (
    select 1
    from public.exam_class_targets t
    join public.class_enrollments ce
      on ce.class_id = t.class_id
     and ce.student_profile_id = p_student_profile_id
     and ce.status = 'active'
    where t.session_id = p_session_id
  );
end;
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
  select case
    when not private.student_is_targeted_for_exam(p_session_id,p_student_profile_id) then 0
    else greatest(
      0,
      coalesce(
        (
          select esa.max_attempts_override
          from public.exam_student_access esa
          where esa.session_id = p_session_id
            and esa.student_profile_id = p_student_profile_id
            and esa.decision = 'allow'
            and (esa.valid_from is null or esa.valid_from <= now())
            and (esa.valid_until is null or esa.valid_until > now())
        ),
        (select e.attempt_limit from public.exam_sessions e where e.id = p_session_id),
        0
      )
      + coalesce((
        select sum(g.additional_attempts)::integer
        from public.exam_retake_grants g
        where g.session_id = p_session_id
          and g.student_profile_id = p_student_profile_id
          and g.revoked_at is null
          and (g.expires_at is null or g.expires_at > now())
      ),0)
    )
  end;
$$;

create or replace function public.my_exam_access(p_session_id text)
returns table(
  eligible boolean,
  allowed_attempts integer,
  used_attempts integer,
  active_attempt_id uuid,
  denial_reason text
)
language plpgsql
stable
security definer
set search_path = public, private
as $$
declare
  v_profile uuid := private.current_academic_profile_id();
  v_status exam_status;
  v_starts bigint;
  v_ends bigint;
  v_now bigint := (extract(epoch from now()) * 1000)::bigint;
begin
  if v_profile is null then
    return query select false,0,0,null::uuid,'not_authenticated'::text;
    return;
  end if;

  select e.status,e.starts_at,e.ends_at into v_status,v_starts,v_ends
  from public.exam_sessions e
  where e.id = upper(p_session_id);

  if not found then return query select false,0,0,null::uuid,'not_found'::text; return; end if;
  if v_status <> 'open' then return query select false,0,0,null::uuid,'not_open'::text; return; end if;
  if v_starts is not null and v_now < v_starts then return query select false,0,0,null::uuid,'not_started'::text; return; end if;
  if v_ends is not null and v_now > v_ends then return query select false,0,0,null::uuid,'ended'::text; return; end if;
  if not private.student_is_targeted_for_exam(upper(p_session_id),v_profile) then
    return query select false,0,0,null::uuid,'not_eligible'::text;
    return;
  end if;

  return query
  select
    true,
    private.student_allowed_attempts(upper(p_session_id),v_profile),
    count(*)::integer,
    (array_agg(a.id order by a.attempt_number desc) filter (where a.submitted_at is null))[1],
    null::text
  from public.exam_attempts a
  where a.session_id = upper(p_session_id)
    and a.student_profile_id = v_profile;
end;
$$;

create or replace function public.allocate_my_exam_attempt(p_session_id text)
returns table(attempt_id uuid,attempt_number integer,resumed boolean)
language plpgsql
volatile
security definer
set search_path = public, private
as $$
declare
  v_profile uuid := private.current_academic_profile_id();
  v_session public.exam_sessions%rowtype;
  v_person public.academic_profiles%rowtype;
  v_allowed integer;
  v_used integer;
  v_id uuid;
  v_number integer;
  v_now bigint := (extract(epoch from clock_timestamp()) * 1000)::bigint;
  v_snapshot jsonb;
begin
  if v_profile is null then raise exception 'not_authenticated'; end if;

  select * into v_person
  from public.academic_profiles p
  where p.id = v_profile and p.role = 'student' and p.status = 'active';
  if not found then raise exception 'student_profile_required'; end if;

  select * into v_session
  from public.exam_sessions e
  where e.id = upper(p_session_id);
  if not found then raise exception 'exam_not_found'; end if;
  if v_session.status <> 'open' then raise exception 'exam_not_open'; end if;
  if v_session.starts_at is not null and v_now < v_session.starts_at then raise exception 'exam_not_started'; end if;
  if v_session.ends_at is not null and v_now > v_session.ends_at then raise exception 'exam_ended'; end if;
  if not private.student_is_targeted_for_exam(v_session.id,v_profile) then raise exception 'student_not_eligible'; end if;

  perform pg_advisory_xact_lock(hashtextextended(v_session.id || ':' || v_profile::text,0));

  select a.id,a.attempt_number into v_id,v_number
  from public.exam_attempts a
  where a.session_id = v_session.id
    and a.student_profile_id = v_profile
    and a.submitted_at is null
  order by a.attempt_number desc
  limit 1;
  if found then
    return query select v_id,v_number,true;
    return;
  end if;

  v_allowed := private.student_allowed_attempts(v_session.id,v_profile);
  select count(*)::integer into v_used
  from public.exam_attempts a
  where a.session_id = v_session.id
    and a.student_profile_id = v_profile;
  if v_used >= v_allowed then raise exception 'attempt_limit_reached'; end if;

  select jsonb_build_object(
    'sessionTitle',v_session.title,
    'studentName',concat_ws(' ',v_person.first_name,v_person.last_name),
    'className',(
      select concat_ws(' ',l.name,nullif(c.arm,''))
      from public.class_enrollments ce
      join public.classes c on c.id=ce.class_id
      join public.academic_levels l on l.id=c.level_id
      where ce.student_profile_id=v_profile and ce.status='active'
      limit 1
    ),
    'programmeName',(
      select p.name
      from public.class_enrollments ce
      join public.classes c on c.id=ce.class_id
      left join public.academic_programmes p on p.id=c.programme_id
      where ce.student_profile_id=v_profile and ce.status='active'
      limit 1
    ),
    'academicYear',(
      select y.name
      from public.class_enrollments ce
      join public.classes c on c.id=ce.class_id
      join public.academic_years y on y.id=c.academic_year_id
      where ce.student_profile_id=v_profile and ce.status='active'
      limit 1
    ),
    'academicTerm',(
      select t.name from public.academic_terms t where t.id=v_session.academic_term_id
    ),
    'mode',v_session.mode::text,
    'subjectNames',coalesce((
      select jsonb_agg(distinct s.name order by s.name)
      from public.exam_offering_targets et
      join public.class_subject_offerings o on o.id=et.offering_id
      join public.subjects s on s.id=o.subject_id
      where et.session_id=v_session.id
    ),'[]'::jsonb)
  ) into v_snapshot;

  v_id := gen_random_uuid();
  v_number := v_used + 1;

  insert into public.exam_attempts(
    id,session_id,student_profile_id,attempt_number,context_snapshot,
    started_at,submission_reason,created_at
  ) values(
    v_id,v_session.id,v_profile,v_number,v_snapshot,v_now,'',v_now
  );

  insert into public.exam_attempt_runtime_states(
    attempt_id,current_index,remaining_seconds,elapsed_active_seconds,
    last_active_at,paper_fingerprint,question_ids,updated_at
  ) values(
    v_id,0,v_session.duration_seconds,0,v_now,'','{}',v_now
  );

  return query select v_id,v_number,false;
end;
$$;

create or replace function public.grant_exam_retake(
  p_session_id text,
  p_student_profile_id uuid,
  p_additional_attempts integer default 1,
  p_reason text default ''
)
returns uuid
language plpgsql
volatile
security definer
set search_path = public, private
as $$
declare
  v_staff uuid := private.current_academic_profile_id();
  v_id uuid;
begin
  if v_staff is null or not private.staff_can_access_exam(v_staff,upper(p_session_id)) then
    raise exception 'exam_staff_access_required';
  end if;
  if p_additional_attempts < 1 or p_additional_attempts > 10 then
    raise exception 'invalid_retake_count';
  end if;
  if not private.student_is_targeted_for_exam(upper(p_session_id),p_student_profile_id) then
    raise exception 'student_not_eligible';
  end if;

  insert into public.exam_retake_grants(
    session_id,student_profile_id,additional_attempts,granted_by_profile_id,reason
  ) values(
    upper(p_session_id),p_student_profile_id,p_additional_attempts,v_staff,left(coalesce(p_reason,''),500)
  ) returning id into v_id;

  return v_id;
end;
$$;

-- Harden execution privileges. PUBLIC must not inherit SECURITY DEFINER RPCs.
revoke all on function public.resolve_student_profile_by_name(text,text) from public;
revoke all on function public.claim_student_auth_identity(uuid,uuid) from public;
revoke all on function public.my_exam_access(text) from public;
revoke all on function public.allocate_my_exam_attempt(text) from public;
revoke all on function public.grant_exam_retake(text,uuid,integer,text) from public;

grant execute on function public.resolve_student_profile_by_name(text,text) to service_role;
grant execute on function public.claim_student_auth_identity(uuid,uuid) to service_role;
grant execute on function public.my_exam_access(text) to authenticated;
grant execute on function public.allocate_my_exam_attempt(text) to authenticated;
grant execute on function public.grant_exam_retake(text,uuid,integer,text) to authenticated;

revoke all on function private.current_academic_profile_id() from public;
revoke all on function private.current_academic_role() from public;
revoke all on function private.is_admin() from public;
revoke all on function private.is_staff() from public;
revoke all on function private.student_is_enrolled_in_offering(uuid,uuid) from public;
revoke all on function private.teacher_is_qualified_for_subject(uuid,uuid) from public;
revoke all on function private.teacher_is_assigned_to_offering(uuid,uuid) from public;
revoke all on function private.staff_can_access_class(uuid,text) from public;
revoke all on function private.staff_can_access_subject(uuid,uuid) from public;
revoke all on function private.staff_can_access_exam(uuid,text) from public;
revoke all on function private.student_is_targeted_for_exam(text,uuid) from public;
revoke all on function private.student_allowed_attempts(text,uuid) from public;

grant execute on function private.current_academic_profile_id() to authenticated;
grant execute on function private.current_academic_role() to authenticated;
grant execute on function private.is_admin() to authenticated;
grant execute on function private.is_staff() to authenticated;
grant execute on function private.student_is_enrolled_in_offering(uuid,uuid) to authenticated;
grant execute on function private.teacher_is_qualified_for_subject(uuid,uuid) to authenticated;
grant execute on function private.teacher_is_assigned_to_offering(uuid,uuid) to authenticated;
grant execute on function private.staff_can_access_class(uuid,text) to authenticated;
grant execute on function private.staff_can_access_subject(uuid,uuid) to authenticated;
grant execute on function private.staff_can_access_exam(uuid,text) to authenticated;
grant execute on function private.student_is_targeted_for_exam(text,uuid) to authenticated;
grant execute on function private.student_allowed_attempts(text,uuid) to authenticated;

commit;
