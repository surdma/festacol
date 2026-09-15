-- Assertions for 10-exam-runtime-authorization.sql.
do $$
declare
  john_profile uuid;
  arts_profile uuid;
  math_id uuid;
  science_math_offering uuid;
  active_term uuid;
  first_attempt uuid;
  resumed_attempt uuid;
  second_attempt uuid;
  first_number integer;
  resumed_flag boolean;
  v_access record;
begin
  select id into john_profile from public.academic_profiles where legacy_user_id='STU-001';
  select id into arts_profile from public.academic_profiles where legacy_user_id='STU-AMB2';
  select id into math_id from public.subjects where code='MATH';
  select o.id into science_math_offering
  from public.class_subject_offerings o
  where o.class_id='CLS-SS1-SCI-A' and o.subject_id=math_id and o.status='active';
  select id into active_term from public.academic_terms order by sequence limit 1;

  if not private.student_is_targeted_for_exam('FST-REL001',john_profile) then
    raise exception 'Science student lost eligibility for explicit Mathematics offering';
  end if;
  if private.student_is_targeted_for_exam('FST-REL002',john_profile) then
    raise exception 'Science student incorrectly inherited Arts Mathematics eligibility';
  end if;

  -- New exam uses canonical subject + offering target. Legacy class strings are
  -- snapshots only and do not grant access.
  insert into public.exam_sessions(
    id,title,class_level,class_group,academic_session,term,mode,subjects,
    duration_seconds,question_count,status,instructions,attempt_limit,created_at,updated_at,academic_term_id
  ) values (
    'FST-V2A','V2 Mathematics','SS1','General','2026/2027','First term','single','{}',
    1800,10,'open','',1,1800000000000,1800000000000,active_term
  ) on conflict (id) do nothing;
  insert into public.exam_subjects(session_id,subject_code,position,subject_id)
  values ('FST-V2A','MATH',0,math_id)
  on conflict (session_id,subject_code) do update set subject_id=excluded.subject_id;
  insert into public.exam_class_targets(session_id,class_id)
  values ('FST-V2A','CLS-SS1-SCI-A') on conflict do nothing;

  -- A subject exam with only a class target must fail closed.
  if private.student_is_targeted_for_exam('FST-V2A',john_profile) then
    raise exception 'subject exam incorrectly fell back to broad class membership';
  end if;
  insert into public.exam_offering_targets(session_id,offering_id)
  values ('FST-V2A',science_math_offering) on conflict do nothing;
  if not private.student_is_targeted_for_exam('FST-V2A',john_profile) then
    raise exception 'offering target did not authorize enrolled Mathematics student';
  end if;
  if private.student_is_targeted_for_exam('FST-V2A',arts_profile) then
    raise exception 'offering target admitted student from a different class offering';
  end if;
end $$;

-- The identity assertion linked John to this Auth UUID. Drive auth.uid() from
-- that value to exercise public RPCs as an authenticated student.
create or replace function auth.uid()
returns uuid language sql stable as $$
  select '22222222-2222-4222-8222-222222222222'::uuid
$$;

do $$
declare
  a1 uuid; n1 integer; r1 boolean;
  a2 uuid; n2 integer; r2 boolean;
  student_profile uuid;
  grant_id uuid;
begin
  select attempt_uuid,attempt_number,resumed into a1,n1,r1
  from public.allocate_my_exam_attempt('fst-v2a');
  if a1 is null or n1<>1 or r1 then raise exception 'first allocation was not a fresh attempt #1'; end if;
  if not exists (select 1 from public.exam_attempt_runtime_states where attempt_uuid=a1) then
    raise exception 'runtime state was not created with allocated attempt';
  end if;

  select attempt_uuid,attempt_number,resumed into a2,n2,r2
  from public.allocate_my_exam_attempt('FST-V2A');
  if a2<>a1 or n2<>1 or not r2 then raise exception 'concurrent/repeated allocation did not resume active attempt'; end if;

  update public.exam_attempts set submitted_at=1800001000000 where attempt_uuid=a1;
  begin
    perform * from public.allocate_my_exam_attempt('FST-V2A');
    raise exception 'attempt limit did not block a second allocation';
  exception when others then
    if sqlerrm not like '%attempt_limit_reached%' then raise; end if;
  end;

  select id into student_profile from public.academic_profiles where legacy_user_id='STU-001';
end $$;

-- Switch to the linked Mathematics teacher. Their actual teaching assignment
-- to the targeted offering permits a retake grant.
create or replace function auth.uid()
returns uuid language sql stable as $$
  select '11111111-1111-4111-8111-111111111111'::uuid
$$;

do $$
declare
  student_profile uuid;
  grant_id uuid;
begin
  select id into student_profile from public.academic_profiles where legacy_user_id='STU-001';
  grant_id := public.grant_exam_retake('FST-V2A',student_profile,1,'approved retake');
  if grant_id is null then raise exception 'teacher could not grant relationship-scoped retake'; end if;
end $$;

-- Student can now allocate attempt #2, proving retake entitlement is additive
-- and transactional rather than a reset-marker deletion.
create or replace function auth.uid()
returns uuid language sql stable as $$
  select '22222222-2222-4222-8222-222222222222'::uuid
$$;

do $$
declare a2 uuid; n2 integer; r2 boolean;
begin
  select attempt_uuid,attempt_number,resumed into a2,n2,r2
  from public.allocate_my_exam_attempt('FST-V2A');
  if a2 is null or n2<>2 or r2 then raise exception 'retake grant did not allocate fresh attempt #2'; end if;
end $$;
