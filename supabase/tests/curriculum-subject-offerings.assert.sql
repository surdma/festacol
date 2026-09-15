-- Assertions for 09-curriculum-subject-offerings.sql.
do $$
declare
  math_id uuid;
  bio_id uuid;
  lit_id uuid;
  fmath_id uuid;
  science_math_offering uuid;
  arts_math_offering uuid;
  science_bio_offering uuid;
  arts_lit_offering uuid;
  john_profile uuid;
  arts_profile uuid;
  teacher_profile uuid;
  active_year uuid;
begin
  select id into math_id from public.subjects where code = 'MATH';
  if math_id is null then raise exception 'Mathematics did not receive a canonical subject UUID'; end if;
  if not exists (select 1 from public.subject_legacy_aliases where alias = 'MATH' and subject_id = math_id) then
    raise exception 'legacy subject code was not preserved as an alias';
  end if;

  -- Add subjects after the UUID migration to prove codes are only aliases and
  -- programme metadata alone creates no offering/eligibility.
  insert into public.subjects(code, name, category, streams, active, updated_at, id, normalized_name)
  values
    ('BIO-V2','Biology','science',array['Science'],true,1,gen_random_uuid(),'biology'),
    ('LIT-V2','Literature in English','art',array['Arts'],true,1,gen_random_uuid(),'literature in english'),
    ('FMATH-V2','Further Mathematics','science',array['Science'],true,1,gen_random_uuid(),'further mathematics')
  on conflict (code) do nothing;
  insert into public.subject_legacy_aliases(alias,subject_id,source)
  select code,id,'fixture' from public.subjects where code in ('BIO-V2','LIT-V2','FMATH-V2')
  on conflict (alias) do update set subject_id = excluded.subject_id;
  select id into bio_id from public.subjects where code='BIO-V2';
  select id into lit_id from public.subjects where code='LIT-V2';
  select id into fmath_id from public.subjects where code='FMATH-V2';

  if exists (select 1 from public.class_subject_offerings where subject_id = fmath_id) then
    raise exception 'Further Mathematics offering was incorrectly inferred from subject.streams';
  end if;

  select p.id into john_profile from public.academic_profiles p where p.legacy_user_id='STU-001';
  select p.id into arts_profile from public.academic_profiles p where p.legacy_user_id='STU-AMB2';
  select p.id into teacher_profile from public.academic_profiles p where p.legacy_user_id='TCH-001';
  select id into active_year from public.academic_years where name='2026/2027';

  select o.id into science_math_offering
  from public.class_subject_offerings o
  where o.class_id='CLS-SS1-SCI-A' and o.subject_id=math_id and o.status='active';
  select o.id into arts_math_offering
  from public.class_subject_offerings o
  where o.class_id='CLS-SS1-ART-A' and o.subject_id=math_id and o.status='active';
  if science_math_offering is null or arts_math_offering is null then
    raise exception 'legacy class+exam evidence did not create required Mathematics offerings';
  end if;
  if not private.student_is_enrolled_in_offering(science_math_offering,john_profile) then
    raise exception 'Science student was not eligible for required Mathematics offering';
  end if;
  if not private.student_is_enrolled_in_offering(arts_math_offering,arts_profile) then
    raise exception 'Arts student was not eligible for required Mathematics offering';
  end if;

  -- Explicit Science-only Biology offering. Arts programme membership must not
  -- leak eligibility into it.
  insert into public.class_subject_offerings(class_id,subject_id,academic_year_id,participation,status,source)
  values ('CLS-SS1-SCI-A',bio_id,active_year,'required','active','explicit')
  returning id into science_bio_offering;
  if not private.student_is_enrolled_in_offering(science_bio_offering,john_profile) then
    raise exception 'Science class student should receive explicit required Biology offering';
  end if;
  if private.student_is_enrolled_in_offering(science_bio_offering,arts_profile) then
    raise exception 'Arts student was admitted to Science Biology by programme inference';
  end if;

  -- Elective Literature in the Arts class requires an individual subject
  -- enrollment; class/programme membership alone is insufficient.
  insert into public.class_subject_offerings(class_id,subject_id,academic_year_id,participation,status,source)
  values ('CLS-SS1-ART-A',lit_id,active_year,'elective','active','explicit')
  returning id into arts_lit_offering;
  if private.student_is_enrolled_in_offering(arts_lit_offering,arts_profile) then
    raise exception 'elective Literature was granted from class/programme membership alone';
  end if;
  insert into public.student_subject_enrollments(student_profile_id,offering_id,status)
  values (arts_profile,arts_lit_offering,'active');
  if not private.student_is_enrolled_in_offering(arts_lit_offering,arts_profile) then
    raise exception 'explicit elective subject enrollment did not grant Literature participation';
  end if;

  -- Ada is a Mathematics teacher only. A class relationship must not expand
  -- her subject visibility.
  if not private.teacher_is_qualified_for_subject(teacher_profile,math_id) then
    raise exception 'Mathematics teacher qualification did not migrate to subject UUID';
  end if;
  if private.teacher_is_qualified_for_subject(teacher_profile,bio_id) then
    raise exception 'Mathematics teacher incorrectly gained Biology qualification';
  end if;

  if not exists (
    select 1 from public.questions q
    where q.id=900001 and q.subject_id=math_id
  ) then raise exception 'question did not link to canonical subject UUID'; end if;
  if not exists (
    select 1 from public.exam_subjects es
    where es.session_id='FST-REL001' and es.subject_id=math_id
  ) then raise exception 'exam subject did not link to canonical subject UUID'; end if;
  if not exists (
    select 1 from public.exam_offering_targets t
    where t.session_id='FST-REL001' and t.offering_id=science_math_offering
  ) then raise exception 'science Mathematics exam did not target its subject offering'; end if;
  if not exists (
    select 1 from public.exam_offering_targets t
    where t.session_id='FST-REL002' and t.offering_id=arts_math_offering
  ) then raise exception 'arts Mathematics exam did not target its subject offering'; end if;
end $$;
