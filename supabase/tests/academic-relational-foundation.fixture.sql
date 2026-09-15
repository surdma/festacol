-- Legacy-shaped fixture used to prove the v2 relational backfill.
insert into auth.users(id) values ('11111111-1111-4111-8111-111111111111'::uuid)
on conflict do nothing;

insert into public.classes(id, class_level, name, stream, grp, arm, capacity, room, academic_session, status)
values
  ('CLS-SS1-SCI-A', 'SS1', 'SS1 Science A', 'Science', 'Science', 'A', 40, 'R1', '2026/2027', 'active'),
  ('CLS-SS1-ART-A', 'SS1', 'SS1 Arts A', 'Arts', 'Arts', 'A', 40, 'R2', '2026/2027', 'active')
on conflict (id) do nothing;

insert into public.subjects(code, name, category, streams, active, updated_at)
values ('MATH', 'Mathematics', 'core', array['Science','Arts'], true, 1)
on conflict (code) do nothing;

insert into public.users(
  id, full_name, first_name, last_name, class_id, role, status, guardian,
  academic_session, promotion_status, joined_at, auth_user_id, email, subjects, qualifier_access
) values
  ('STU-001', 'John Doe', 'John', 'Doe', 'CLS-SS1-SCI-A', 'student', 'active', 'Jane Doe', '2026/2027', 'on-track', 1700000000000, null, '', '{}', false),
  ('STU-AMB1', 'Sam Lee', 'Sam', 'Lee', 'CLS-SS1-SCI-A', 'student', 'active', '', '2026/2027', 'on-track', 1700000000000, null, '', '{}', false),
  ('STU-AMB2', 'Sam Lee', 'Sam', 'Lee', 'CLS-SS1-ART-A', 'student', 'active', '', '2026/2027', 'on-track', 1700000001000, null, '', '{}', false),
  ('TCH-001', 'Ada Teacher', 'Ada', 'Teacher', 'CLS-SS1-SCI-A', 'teacher', 'active', '', '2026/2027', 'on-track', 1700000000000, '11111111-1111-4111-8111-111111111111', 'ada@example.test', array['MATH'], false)
on conflict (id) do nothing;

insert into public.student_profiles(
  student_hash, candidate_hash, first_name, last_name, full_name, phone, guardian,
  current_class_id, academic_session, updated_at
) values
  ('student-hash-john-doe', '', 'John', 'Doe', 'John Doe', '08000000000', 'Jane Doe', 'CLS-SS1-SCI-A', '2026/2027', 1700000000000),
  ('student-hash-sam-lee', '', 'Sam', 'Lee', 'Sam Lee', '', '', '', '2026/2027', 1700000000000)
on conflict (student_hash) do nothing;

insert into public.exam_sessions(
  id, title, class_level, class_group, academic_session, term, mode, subjects,
  placement_tracks, duration_seconds, question_count, status, instructions,
  attempt_limit, cohosts, created_at, updated_at
) values
  ('FST-REL001', 'Mathematics Test', 'SS1', 'Science', '2026/2027', 'First term', 'single', array['MATH'], '{}', 3600, 20, 'open', '', 1, array['TCH-001'], 1700000000000, 1700000000000),
  ('FST-REL002', 'Arts Mathematics Test', 'SS1', 'Arts', '2026/2027', 'First term', 'single', array['MATH'], '{}', 3600, 20, 'open', '', 1, '{}', 1700000000000, 1700000000000)
on conflict (id) do nothing;

insert into public.questions(
  id, subject_code, subject_name, label, qtype, prompt, options, correct_answers,
  levels, exam_modes, difficulty, domain, explanation, created_by, updated_at
) values (
  900001, 'MATH', 'Mathematics', 'Mathematics', 'single', '2 + 2 = ?',
  array['3','4'], array['4'], array['SS1'], array['single'], 'easy', '', '',
  'TCH-001', 1700000000000
) on conflict (id) do nothing;

insert into public.exam_attempts(
  id, attempt_hash, candidate_hash, student_hash, session_id, session_title,
  first_name, last_name, student_name, class_level, class_group, academic_session,
  mode, session_status, submitted_at, score, created_at
) values (
  'legacy-attempt-id', 'attempt-hash-1', 'candidate-hash-1', 'student-hash-john-doe',
  'FST-REL001', 'Mathematics Test', 'John', 'Doe', 'John Doe', 'SS1', 'Science',
  '2026/2027', 'single', 'open', 1700003600000, 80, 1700000000000
) on conflict (attempt_hash) do nothing;
