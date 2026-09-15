-- Assertions for 11-runtime-consumer-cutover.sql

do $$
declare n integer;
begin
  select count(*) into n from information_schema.columns
  where table_schema='public' and table_name='exam_attempt_answers' and column_name in ('attempt_uuid','subject_id');
  if n<>2 then raise exception 'exam_attempt_answers canonical FKs missing'; end if;
  select count(*) into n from information_schema.columns
  where table_schema='public' and table_name='exam_attempt_subject_stats' and column_name in ('attempt_uuid','subject_id');
  if n<>2 then raise exception 'exam_attempt_subject_stats canonical FKs missing'; end if;
end $$;

-- Existing legacy result rows must be linked to the canonical attempt UUID.
do $$
begin
  if exists(select 1 from public.exam_attempt_answers where attempt_uuid is null) then
    raise exception 'attempt answer without attempt_uuid after v2 backfill';
  end if;
  if exists(select 1 from public.exam_attempt_subject_stats where attempt_uuid is null) then
    raise exception 'subject stat without attempt_uuid after v2 backfill';
  end if;
end $$;

-- Answer-bearing question rows are no longer broadly readable by authenticated users.
do $$
begin
  if exists(select 1 from pg_policies where schemaname='public' and tablename='questions' and policyname='q_read') then
    raise exception 'legacy broad question read policy still exists';
  end if;
  if not exists(select 1 from pg_policies where schemaname='public' and tablename='questions' and policyname='questions_staff_read_v2') then
    raise exception 'relationship-scoped staff question policy missing';
  end if;
end $$;

-- Correct-answer-bearing attempt details must have no direct student policy.
do $$;
begin
  if exists(
    select 1 from pg_policies
    where schemaname='public' and tablename='exam_attempt_answers'
      and policyname in ('eab_student_rw','exam_attempt_answers_student_profile_read','exam_attempt_answers_student_v2')
  ) then raise exception 'student can directly read answer-bearing result detail'; end if;
  if not exists(select 1 from pg_policies where schemaname='public' and tablename='exam_attempt_answers' and policyname='exam_attempt_answers_staff_v2') then
    raise exception 'staff answer-detail read policy missing';
  end if;
end $$;

-- Students cannot directly create/update authoritative attempt result rows.
do $$
begin
  if exists(
    select 1 from pg_policies
    where schemaname='public' and tablename='exam_attempts'
      and policyname in ('ea_student_insert','ea_student_update')
  ) then raise exception 'legacy direct student attempt mutation policy still exists'; end if;
  if not exists(select 1 from pg_policies where schemaname='public' and tablename='exam_attempts' and policyname='exam_attempt_student_read_v2') then
    raise exception 'relational attempt read policy missing';
  end if;
end $$;

-- Metadata eligibility uses the same target graph as allocation.
do $$
begin
  if not exists(select 1 from pg_policies where schemaname='public' and tablename='exam_subjects' and policyname='exam_subjects_runtime_read') then
    raise exception 'exam subject runtime policy missing';
  end if;
  if not exists(select 1 from pg_policies where schemaname='public' and tablename='exam_offering_targets' and policyname='exam_offering_targets_runtime_read') then
    raise exception 'exam offering runtime policy missing';
  end if;
end $$;

-- Touched admin policies must now use the relational v2 identity boundary.
do $$
begin
  if exists(select 1 from pg_policies where schemaname='public' and tablename='exam_sessions' and policyname='es_admin_all') then
    raise exception 'legacy exam admin policy still exists';
  end if;
  if not exists(select 1 from pg_policies where schemaname='public' and tablename='exam_sessions' and policyname='es_admin_all_v2') then
    raise exception 'v2 relational exam admin policy missing';
  end if;
end $$;
