-- Assertions for 08-academic-identity-cutover.sql.
do $$
declare
  john_profile uuid;
  sam_profiles integer;
  claim_auth uuid := '22222222-2222-4222-8222-222222222222'::uuid;
begin
  select id into john_profile
  from public.academic_profiles
  where legacy_user_id = 'STU-001';

  if john_profile is null then
    raise exception 'fixture student profile missing';
  end if;

  if not exists (
    select 1 from public.academic_profiles
    where id = john_profile
      and first_name_key = 'john'
      and last_name_key = 'doe'
  ) then
    raise exception 'normalized identity keys were not populated';
  end if;

  select count(*) into sam_profiles
  from public.academic_profiles
  where role = 'student' and status = 'active'
    and first_name_key = 'sam' and last_name_key = 'lee';
  if sam_profiles <> 2 then
    raise exception 'duplicate-name fixture must remain ambiguous, got % rows', sam_profiles;
  end if;

  insert into auth.users(id) values (claim_auth) on conflict do nothing;
  if not public.claim_student_auth_identity(john_profile, claim_auth) then
    raise exception 'existing student profile could not be atomically claimed';
  end if;
  if not public.claim_student_auth_identity(john_profile, claim_auth) then
    raise exception 'identity claim was not idempotent for same auth user';
  end if;
  if public.claim_student_auth_identity(john_profile, '33333333-3333-4333-8333-333333333333'::uuid) then
    raise exception 'claimed student profile was re-bound to another auth user';
  end if;
  if not exists (
    select 1 from public.academic_profiles
    where id = john_profile and auth_user_id = claim_auth
  ) then
    raise exception 'student auth relationship was not persisted';
  end if;
end $$;
