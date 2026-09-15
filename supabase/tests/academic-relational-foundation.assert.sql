-- Fail-fast assertions for the academic relational foundation.
do $$
declare
  student_profile uuid;
  teacher_profile uuid;
  allowed integer;
begin
  select p.id into student_profile
  from public.academic_profiles p where p.legacy_user_id = 'STU-001';
  if student_profile is null then raise exception 'student academic profile was not backfilled'; end if;

  select p.id into teacher_profile
  from public.academic_profiles p where p.legacy_user_id = 'TCH-001';
  if teacher_profile is null then raise exception 'teacher academic profile was not backfilled'; end if;

  if not exists (
    select 1 from public.academic_profiles
    where id = teacher_profile and auth_user_id = '11111111-1111-4111-8111-111111111111'::uuid
  ) then raise exception 'teacher auth.users relationship was not preserved'; end if;

  if not exists (
    select 1 from public.class_enrollments ce
    where ce.student_profile_id = student_profile and ce.class_id = 'CLS-SS1-SCI-A' and ce.status = 'active'
  ) then raise exception 'student class enrollment was not backfilled'; end if;

  if not exists (
    select 1 from public.staff_subject_qualifications q
    where q.staff_profile_id = teacher_profile and q.subject_code = 'MATH'
  ) then raise exception 'staff subject qualification was not backfilled'; end if;

  if not exists (
    select 1 from public.teaching_assignments ta
    where ta.staff_profile_id = teacher_profile and ta.class_id = 'CLS-SS1-SCI-A' and ta.subject_code = 'MATH'
  ) then raise exception 'teacher/class/subject assignment was not backfilled'; end if;

  if not exists (
    select 1 from public.exam_subjects where session_id = 'FST-REL001' and subject_code = 'MATH'
  ) then raise exception 'exam subject link was not backfilled'; end if;

  if not exists (
    select 1 from public.exam_class_targets where session_id = 'FST-REL001' and class_id = 'CLS-SS1-SCI-A'
  ) then raise exception 'science exam class target was not backfilled'; end if;

  if not exists (
    select 1 from public.exam_class_targets where session_id = 'FST-REL002' and class_id = 'CLS-SS1-ART-A'
  ) then raise exception 'arts exam class target was not backfilled'; end if;

  if not exists (
    select 1 from public.exam_staff_assignments
    where session_id = 'FST-REL001' and staff_profile_id = teacher_profile and role = 'cohost'
  ) then raise exception 'exam cohost relationship was not backfilled'; end if;

  if not exists (
    select 1 from public.questions
    where id = 900001 and created_by_profile_id = teacher_profile
  ) then raise exception 'question author profile relationship was not backfilled'; end if;

  if not exists (
    select 1 from public.legacy_student_identity_links
    where student_hash = 'student-hash-john-doe' and student_profile_id = student_profile
  ) then raise exception 'legacy student identity was not safely reconciled'; end if;

  -- Ambiguous same-name roster rows must never be guessed into one identity.
  if exists (
    select 1 from public.legacy_student_identity_links where student_hash = 'student-hash-sam-lee'
  ) then raise exception 'ambiguous same-name student identity was guessed'; end if;
  if not exists (
    select 1 from public.schema_migration_issues
    where entity_key = 'student-hash-sam-lee' and issue_type = 'unresolved_student_identity'
  ) then raise exception 'ambiguous student identity was not surfaced for reconciliation'; end if;

  if not exists (
    select 1 from public.exam_attempts
    where attempt_hash = 'attempt-hash-1'
      and student_profile_id = student_profile
      and attempt_uuid is not null
      and attempt_number = 1
  ) then raise exception 'attempt relationship/ordinal was not backfilled'; end if;

  -- Class membership should grant only the exam targeted to that class.
  if not private.student_is_targeted_for_exam('FST-REL001', student_profile) then
    raise exception 'student target helper rejected valid class enrollment';
  end if;
  if private.student_is_targeted_for_exam('FST-REL002', student_profile) then
    raise exception 'student target helper admitted unrelated class exam';
  end if;
  select private.student_allowed_attempts('FST-REL002', student_profile) into allowed;
  if allowed <> 0 then raise exception 'unrelated exam should permit zero attempts, got %', allowed; end if;

  select private.student_allowed_attempts('FST-REL001', student_profile) into allowed;
  if allowed <> 1 then raise exception 'expected one default attempt, got %', allowed; end if;

  -- Explicit deny takes precedence over class membership and zeroes attempt budget.
  insert into public.exam_student_access(
    session_id, student_profile_id, decision, granted_by_profile_id, reason
  ) values ('FST-REL001', student_profile, 'deny', teacher_profile, 'fixture deny')
  on conflict (session_id, student_profile_id) do update
    set decision = excluded.decision, max_attempts_override = null, reason = excluded.reason;

  if private.student_is_targeted_for_exam('FST-REL001', student_profile) then
    raise exception 'explicit deny did not override class eligibility';
  end if;
  select private.student_allowed_attempts('FST-REL001', student_profile) into allowed;
  if allowed <> 0 then raise exception 'denied exam should permit zero attempts, got %', allowed; end if;

  -- Explicit allow can restore access and override the base attempt policy.
  update public.exam_student_access
  set decision = 'allow', max_attempts_override = 2, reason = 'fixture allow override'
  where session_id = 'FST-REL001' and student_profile_id = student_profile;

  if not private.student_is_targeted_for_exam('FST-REL001', student_profile) then
    raise exception 'explicit allow did not restore exam eligibility';
  end if;
  select private.student_allowed_attempts('FST-REL001', student_profile) into allowed;
  if allowed <> 2 then raise exception 'attempt override expected 2, got %', allowed; end if;

  -- Return to the default policy before checking retake-grant lifecycle.
  update public.exam_student_access
  set max_attempts_override = null
  where session_id = 'FST-REL001' and student_profile_id = student_profile;

  insert into public.exam_retake_grants(
    session_id, student_profile_id, additional_attempts, granted_by_profile_id, reason,
    granted_at, expires_at
  ) values (
    'FST-REL001', student_profile, 5, teacher_profile, 'expired fixture grant',
    now() - interval '2 days', now() - interval '1 day'
  );

  insert into public.exam_retake_grants(
    session_id, student_profile_id, additional_attempts, granted_by_profile_id, reason, revoked_at
  ) values (
    'FST-REL001', student_profile, 4, teacher_profile, 'revoked fixture grant', now()
  );

  select private.student_allowed_attempts('FST-REL001', student_profile) into allowed;
  if allowed <> 1 then raise exception 'expired/revoked retakes must not change budget, got %', allowed; end if;

  insert into public.exam_retake_grants(
    session_id, student_profile_id, additional_attempts, granted_by_profile_id, reason
  ) values ('FST-REL001', student_profile, 1, teacher_profile, 'active fixture retake');

  select private.student_allowed_attempts('FST-REL001', student_profile) into allowed;
  if allowed <> 2 then raise exception 'expected two attempts after active retake grant, got %', allowed; end if;

  if not exists (
    select 1 from public.schema_migration_issues
    where entity_key = 'FST-REL001' and issue_type = 'missing_exam_creator'
  ) then raise exception 'missing legacy creator was not surfaced for reconciliation'; end if;

  if not exists (
    select 1 from public.schema_migration_issues
    where entity_key = '900001' and issue_type = 'unknown_question_created_at'
  ) then raise exception 'unknown legacy question creation time was not surfaced'; end if;
end $$;
