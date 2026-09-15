-- 10-exam-runtime-authorization.sql
-- Relational exam authorization and transactional attempt allocation.

begin;
create extension if not exists pgcrypto;

-- Expand a legacy year-wide class+subject teacher assignment to each proven
-- active offering for that class/subject/year. This changes teacher scope only;
-- it never creates student subject eligibility.
insert into public.teaching_assignments(
  id,staff_profile_id,class_id,subject_code,academic_year_id,academic_term_id,
  assignment_role,status,assigned_at,ended_at,subject_id,offering_id
)
select gen_random_uuid(), ta.staff_profile_id,o.class_id,ta.subject_code,o.academic_year_id,o.academic_term_id,
       ta.assignment_role,'active',ta.assigned_at,null,o.subject_id,o.id
from public.teaching_assignments ta
join public.class_subject_offerings o
  on o.class_id=ta.class_id and o.subject_id=ta.subject_id
 and o.academic_year_id=ta.academic_year_id and o.status='active'
where ta.status='active'
  and not exists (
    select 1 from public.teaching_assignments x
    where x.staff_profile_id=ta.staff_profile_id and x.offering_id=o.id and x.status='active'
  );

-- A subject exam is authorized through subject offerings. Class-only targets
-- remain valid only for genuinely general exams without canonical subjects.
create or replace function private.student_is_targeted_for_exam(p_session_id text,p_student_profile_id uuid)
returns boolean language plpgsql stable security definer set search_path=public as $$
declare v_decision text;
begin
  select esa.decision into v_decision
  from public.exam_student_access esa
  where esa.session_id=p_session_id and esa.student_profile_id=p_student_profile_id
    and (esa.valid_from is null or esa.valid_from<=now())
    and (esa.valid_until is null or esa.valid_until>now());
  if v_decision='deny' then return false; end if;
  if v_decision='allow' then return true; end if;

  if exists(select 1 from public.exam_offering_targets t where t.session_id=p_session_id) then
    return exists(
      select 1 from public.exam_offering_targets t
      where t.session_id=p_session_id
        and private.student_is_enrolled_in_offering(t.offering_id,p_student_profile_id)
    );
  end if;

  if exists(select 1 from public.exam_subjects es where es.session_id=p_session_id and es.subject_id is not null) then
    return false;
  end if;

  return exists(
    select 1 from public.exam_class_targets ect
    join public.class_enrollments ce on ce.class_id=ect.class_id
      and ce.student_profile_id=p_student_profile_id and ce.status='active'
    where ect.session_id=p_session_id
  );
end;
$$;

create or replace function private.staff_can_access_exam(p_staff_profile_id uuid,p_session_id text)
returns boolean language sql stable security definer set search_path=public as $$
  select
    exists(select 1 from public.academic_profiles p where p.id=p_staff_profile_id and p.role='administrator' and p.status='active')
    or exists(select 1 from public.exam_sessions e where e.id=p_session_id and e.created_by_profile_id=p_staff_profile_id)
    or exists(select 1 from public.exam_staff_assignments a where a.session_id=p_session_id and a.staff_profile_id=p_staff_profile_id)
    or exists(
      select 1 from public.exam_offering_targets t
      join public.teaching_assignments ta on ta.offering_id=t.offering_id
       and ta.staff_profile_id=p_staff_profile_id and ta.status='active'
      where t.session_id=p_session_id
    );
$$;
create or replace function private.staff_can_access_subject(p_staff_profile_id uuid,p_subject_id uuid)
returns boolean language sql stable security definer set search_path=public as $$
  select
    exists(select 1 from public.academic_profiles p where p.id=p_staff_profile_id and p.role='administrator' and p.status='active')
    or private.teacher_is_qualified_for_subject(p_staff_profile_id,p_subject_id);
$$;
revoke all on function private.staff_can_access_exam(uuid,text) from public;
revoke all on function private.staff_can_access_subject(uuid,uuid) from public;
grant execute on function private.staff_can_access_exam(uuid,text) to authenticated;
grant execute on function private.staff_can_access_subject(uuid,uuid) to authenticated;

-- ----------------------------------------------------------- runtime state
create table if not exists public.exam_attempt_runtime_states(
  attempt_uuid uuid primary key references public.exam_attempts(attempt_uuid) on delete cascade,
  started_at bigint not null,current_index integer not null default 0,
  remaining_seconds double precision not null,elapsed_active_seconds double precision not null default 0,
  last_active_at bigint not null,paper_fingerprint text not null default '',
  question_ids bigint[] not null default '{}',updated_at bigint not null
);
create table if not exists public.exam_attempt_responses_v2(
  attempt_uuid uuid not null references public.exam_attempts(attempt_uuid) on delete cascade,
  question_id bigint not null references public.questions(id) on delete restrict,
  response_text text,response_values text[] not null default '{}',seconds double precision not null default 0,
  flagged boolean not null default false,updated_at bigint not null,
  primary key(attempt_uuid,question_id)
);
create table if not exists public.exam_integrity_events_v2(
  id bigint generated always as identity primary key,
  attempt_uuid uuid not null references public.exam_attempts(attempt_uuid) on delete cascade,
  type text not null,detail text not null default '',at bigint not null
);
create index if not exists exam_integrity_events_v2_attempt_idx on public.exam_integrity_events_v2(attempt_uuid,at);

alter table public.exam_attempt_runtime_states enable row level security;
alter table public.exam_attempt_responses_v2 enable row level security;
alter table public.exam_integrity_events_v2 enable row level security;

-- Runtime state is allocated only by the SECURITY DEFINER allocator. Students
-- may read/update it, but cannot create/delete an attempt state to bypass limits.
drop policy if exists exam_runtime_student_read on public.exam_attempt_runtime_states;
create policy exam_runtime_student_read on public.exam_attempt_runtime_states for select to authenticated using(exists(
  select 1 from public.exam_attempts a where a.attempt_uuid=exam_attempt_runtime_states.attempt_uuid
    and a.student_profile_id=private.current_academic_profile_id()
));
drop policy if exists exam_runtime_student_update on public.exam_attempt_runtime_states;
create policy exam_runtime_student_update on public.exam_attempt_runtime_states for update to authenticated
  using(exists(select 1 from public.exam_attempts a where a.attempt_uuid=exam_attempt_runtime_states.attempt_uuid
    and a.student_profile_id=private.current_academic_profile_id() and a.submitted_at is null))
  with check(exists(select 1 from public.exam_attempts a where a.attempt_uuid=exam_attempt_runtime_states.attempt_uuid
    and a.student_profile_id=private.current_academic_profile_id() and a.submitted_at is null));

-- Responses are candidate-owned while the attempt is open. Deleting/changing
-- an answer is equivalent to editing an unanswered response, not resetting an attempt.
drop policy if exists exam_response_v2_student_rw on public.exam_attempt_responses_v2;
create policy exam_response_v2_student_rw on public.exam_attempt_responses_v2 for all to authenticated
  using(exists(select 1 from public.exam_attempts a where a.attempt_uuid=exam_attempt_responses_v2.attempt_uuid
    and a.student_profile_id=private.current_academic_profile_id() and a.submitted_at is null))
  with check(exists(select 1 from public.exam_attempts a where a.attempt_uuid=exam_attempt_responses_v2.attempt_uuid
    and a.student_profile_id=private.current_academic_profile_id() and a.submitted_at is null));

-- Integrity records are append-only for the student. They may read/insert but
-- never update/delete evidence once recorded.
drop policy if exists exam_integrity_v2_student_read on public.exam_integrity_events_v2;
create policy exam_integrity_v2_student_read on public.exam_integrity_events_v2 for select to authenticated using(exists(
  select 1 from public.exam_attempts a where a.attempt_uuid=exam_integrity_events_v2.attempt_uuid
    and a.student_profile_id=private.current_academic_profile_id()
));
drop policy if exists exam_integrity_v2_student_insert on public.exam_integrity_events_v2;
create policy exam_integrity_v2_student_insert on public.exam_integrity_events_v2 for insert to authenticated with check(exists(
  select 1 from public.exam_attempts a where a.attempt_uuid=exam_integrity_events_v2.attempt_uuid
    and a.student_profile_id=private.current_academic_profile_id() and a.submitted_at is null
));

-- Staff reads require an actual exam relationship.
drop policy if exists exam_runtime_staff_read on public.exam_attempt_runtime_states;
create policy exam_runtime_staff_read on public.exam_attempt_runtime_states for select to authenticated using(exists(
  select 1 from public.exam_attempts a where a.attempt_uuid=exam_attempt_runtime_states.attempt_uuid
    and a.session_id is not null and private.staff_can_access_exam(private.current_academic_profile_id(),a.session_id)
));
drop policy if exists exam_response_v2_staff_read on public.exam_attempt_responses_v2;
create policy exam_response_v2_staff_read on public.exam_attempt_responses_v2 for select to authenticated using(exists(
  select 1 from public.exam_attempts a where a.attempt_uuid=exam_attempt_responses_v2.attempt_uuid
    and a.session_id is not null and private.staff_can_access_exam(private.current_academic_profile_id(),a.session_id)
));
drop policy if exists exam_integrity_v2_staff_read on public.exam_integrity_events_v2;
create policy exam_integrity_v2_staff_read on public.exam_integrity_events_v2 for select to authenticated using(exists(
  select 1 from public.exam_attempts a where a.attempt_uuid=exam_integrity_events_v2.attempt_uuid
    and a.session_id is not null and private.staff_can_access_exam(private.current_academic_profile_id(),a.session_id)
));

-- ---------------------------------------------------------- access status RPC
create or replace function public.my_exam_access(p_session_id text)
returns table(eligible boolean,allowed_attempts integer,used_attempts integer,active_attempt_uuid uuid,denial_reason text)
language plpgsql stable security definer set search_path=public,private as $$
declare
  v_profile uuid:=private.current_academic_profile_id(); v_status text; v_starts bigint; v_ends bigint;
  v_now bigint:=(extract(epoch from now())*1000)::bigint;
begin
  if v_profile is null then return query select false,0,0,null::uuid,'not_authenticated'::text; return; end if;
  select status,starts_at,ends_at into v_status,v_starts,v_ends from public.exam_sessions where id=upper(p_session_id);
  if not found then return query select false,0,0,null::uuid,'not_found'::text; return; end if;
  if v_status<>'open' then return query select false,0,0,null::uuid,'not_open'::text; return; end if;
  if v_starts is not null and v_now<v_starts then return query select false,0,0,null::uuid,'not_started'::text; return; end if;
  if v_ends is not null and v_now>v_ends then return query select false,0,0,null::uuid,'ended'::text; return; end if;
  if not private.student_is_targeted_for_exam(upper(p_session_id),v_profile) then
    return query select false,0,0,null::uuid,'not_eligible'::text; return;
  end if;
  return query
  select true,private.student_allowed_attempts(upper(p_session_id),v_profile),count(*)::integer,
    (array_agg(a.attempt_uuid order by a.attempt_number desc) filter(where a.submitted_at is null and a.rewrite_archived_at is null))[1],
    null::text
  from public.exam_attempts a
  where a.session_id=upper(p_session_id) and a.student_profile_id=v_profile
    and a.attempt_number is not null and a.rewrite_archived_at is null;
end;
$$;
revoke all on function public.my_exam_access(text) from public;
grant execute on function public.my_exam_access(text) to authenticated;

-- ----------------------------------------------------- atomic attempt allocator
create or replace function public.allocate_my_exam_attempt(p_session_id text)
returns table(attempt_uuid uuid,attempt_number integer,resumed boolean)
language plpgsql volatile security definer set search_path=public,private as $$
declare
  v_profile uuid:=private.current_academic_profile_id(); v_session public.exam_sessions%rowtype;
  v_person public.academic_profiles%rowtype; v_allowed integer; v_used integer; v_uuid uuid; v_number integer;
  v_now bigint:=(extract(epoch from clock_timestamp())*1000)::bigint;
begin
  if v_profile is null then raise exception 'not_authenticated'; end if;
  select * into v_person from public.academic_profiles where id=v_profile and role='student' and status='active';
  if not found then raise exception 'student_profile_required'; end if;
  select * into v_session from public.exam_sessions where id=upper(p_session_id);
  if not found then raise exception 'exam_not_found'; end if;
  if v_session.status<>'open' then raise exception 'exam_not_open'; end if;
  if v_session.starts_at is not null and v_now<v_session.starts_at then raise exception 'exam_not_started'; end if;
  if v_session.ends_at is not null and v_now>v_session.ends_at then raise exception 'exam_ended'; end if;
  if not private.student_is_targeted_for_exam(v_session.id,v_profile) then raise exception 'student_not_eligible'; end if;

  perform pg_advisory_xact_lock(hashtextextended(v_session.id||':'||v_profile::text,0));
  select a.attempt_uuid,a.attempt_number into v_uuid,v_number
  from public.exam_attempts a where a.session_id=v_session.id and a.student_profile_id=v_profile
    and a.attempt_number is not null and a.submitted_at is null and a.rewrite_archived_at is null
  order by a.attempt_number desc limit 1;
  if found then return query select v_uuid,v_number,true; return; end if;

  v_allowed:=private.student_allowed_attempts(v_session.id,v_profile);
  select count(*)::integer into v_used from public.exam_attempts a
  where a.session_id=v_session.id and a.student_profile_id=v_profile
    and a.attempt_number is not null and a.rewrite_archived_at is null;
  if v_used>=v_allowed then raise exception 'attempt_limit_reached'; end if;

  v_uuid:=gen_random_uuid(); v_number:=v_used+1;
  insert into public.exam_attempts(
    id,attempt_hash,attempt_uuid,student_profile_id,attempt_number,candidate_hash,student_hash,paper_fingerprint,
    session_id,session_title,first_name,last_name,student_name,class_level,class_group,academic_session,mode,
    session_status,session_ends_at,started_at,submitted_at,remaining_seconds,elapsed_active_seconds,answered,
    question_count,submission_reason,created_at
  ) values(
    v_uuid::text,'v2:'||v_uuid::text,v_uuid,v_profile,v_number,'','','',v_session.id,v_session.title,
    v_person.first_name,v_person.last_name,v_person.full_name,v_session.class_level,v_session.class_group,
    v_session.academic_session,v_session.mode,v_session.status,v_session.ends_at,v_now,null,
    v_session.duration_seconds,0,0,v_session.question_count,'',v_now
  );
  insert into public.exam_attempt_runtime_states(
    attempt_uuid,started_at,current_index,remaining_seconds,elapsed_active_seconds,last_active_at,paper_fingerprint,question_ids,updated_at
  ) values(v_uuid,v_now,0,v_session.duration_seconds,0,v_now,'','{}',v_now);
  return query select v_uuid,v_number,false;
end;
$$;
revoke all on function public.allocate_my_exam_attempt(text) from public;
grant execute on function public.allocate_my_exam_attempt(text) to authenticated;

-- ---------------------------------------------------------- staff retake grant
create or replace function public.grant_exam_retake(p_session_id text,p_student_profile_id uuid,p_additional_attempts integer default 1,p_reason text default '')
returns uuid language plpgsql volatile security definer set search_path=public,private as $$
declare v_staff uuid:=private.current_academic_profile_id(); v_id uuid;
begin
  if v_staff is null or not private.staff_can_access_exam(v_staff,upper(p_session_id)) then raise exception 'exam_staff_access_required'; end if;
  if p_additional_attempts<1 or p_additional_attempts>10 then raise exception 'invalid_retake_count'; end if;
  if not private.student_is_targeted_for_exam(upper(p_session_id),p_student_profile_id) then raise exception 'student_not_eligible'; end if;
  insert into public.exam_retake_grants(session_id,student_profile_id,additional_attempts,granted_by_profile_id,reason)
  values(upper(p_session_id),p_student_profile_id,p_additional_attempts,v_staff,left(coalesce(p_reason,''),500)) returning id into v_id;
  return v_id;
end;
$$;
revoke all on function public.grant_exam_retake(text,uuid,integer,text) from public;
grant execute on function public.grant_exam_retake(text,uuid,integer,text) to authenticated;

commit;
