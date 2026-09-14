-- Festacol prototype — seed the initial school classes (SS1–SS3 + Qualifier).
-- Run in Supabase Dashboard → SQL Editor. Safe to re-run (inserts are ignored
-- when a class id already exists).

insert into public.classes (id, class_level, name, stream, grp, capacity, room, academic_session, status) values
  ('ss1-qualifier', 'SS1', 'SS1 Qualifier Pool', 'Qualifier', 'Qualifier', 240, 'Admissions', '2026/2027', 'active'),
  ('ss1-science',   'SS1', 'SS1 Science', 'Science', 'Science', 72, 'Science Wing', '2026/2027', 'active'),
  ('ss1-arts',      'SS1', 'SS1 Arts', 'Arts', 'Arts', 64, 'Humanities Wing', '2026/2027', 'active'),
  ('ss1-social',    'SS1', 'SS1 Social Science', 'Social Science', 'Social Science', 68, 'Commerce Wing', '2026/2027', 'active'),
  ('ss1-general',   'SS1', 'SS1 General', 'General', 'General', 80, 'Senior Block A', '2026/2027', 'active'),
  ('ss2-science',   'SS2', 'SS2 Science', 'Science', 'Science', 64, 'Science Wing', '2026/2027', 'active'),
  ('ss2-arts',      'SS2', 'SS2 Arts', 'Arts', 'Arts', 58, 'Humanities Wing', '2026/2027', 'active'),
  ('ss2-social',    'SS2', 'SS2 Social Science', 'Social Science', 'Social Science', 62, 'Commerce Wing', '2026/2027', 'active'),
  ('ss2-general',   'SS2', 'SS2 General', 'General', 'General', 60, 'Senior Block B', '2026/2027', 'active'),
  ('ss3-science',   'SS3', 'SS3 Science', 'Science', 'Science', 60, 'Science Wing', '2026/2027', 'active'),
  ('ss3-arts',      'SS3', 'SS3 Arts', 'Arts', 'Arts', 54, 'Humanities Wing', '2026/2027', 'active'),
  ('ss3-social',    'SS3', 'SS3 Social Science', 'Social Science', 'Social Science', 56, 'Commerce Wing', '2026/2027', 'active'),
  ('ss3-general',   'SS3', 'SS3 General', 'General', 'General', 50, 'Senior Block C', '2026/2027', 'active')
on conflict (id) do nothing;
