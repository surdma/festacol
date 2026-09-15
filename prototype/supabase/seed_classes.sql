-- Festacol prototype — seed the initial school classes (SS1–SS3 + Qualifier).
-- Arms follow the Nigerian school pattern: Science A/B, Art C, Commercial D.
-- Run in Supabase Dashboard → SQL Editor. Safe to re-run (inserts are ignored
-- when a class id already exists).

insert into public.classes (id, class_level, name, stream, grp, arm, capacity, room, academic_session, status) values
  ('ss1-qualifier',   'SS1', 'SS1 Qualifier Pool', 'Qualifier', 'Qualifier', '', 240, 'Admissions', '2026/2027', 'active'),
  ('ss1-science-a',   'SS1', 'SS1 Science A', 'Science', 'Science', 'A', 60, 'Science Wing', '2026/2027', 'active'),
  ('ss1-science-b',   'SS1', 'SS1 Science B', 'Science', 'Science', 'B', 60, 'Science Wing', '2026/2027', 'active'),
  ('ss1-art-c',       'SS1', 'SS1 Art C', 'Art', 'Art', 'C', 55, 'Humanities Wing', '2026/2027', 'active'),
  ('ss1-commercial-d','SS1', 'SS1 Commercial D', 'Commercial', 'Commercial', 'D', 60, 'Commerce Wing', '2026/2027', 'active'),
  ('ss2-science-a',   'SS2', 'SS2 Science A', 'Science', 'Science', 'A', 55, 'Science Wing', '2026/2027', 'active'),
  ('ss2-science-b',   'SS2', 'SS2 Science B', 'Science', 'Science', 'B', 55, 'Science Wing', '2026/2027', 'active'),
  ('ss2-art-a',       'SS2', 'SS2 Art A', 'Art', 'Art', 'A', 50, 'Humanities Wing', '2026/2027', 'active'),
  ('ss2-commercial-a','SS2', 'SS2 Commercial A', 'Commercial', 'Commercial', 'A', 55, 'Commerce Wing', '2026/2027', 'active'),
  ('ss3-science-a',   'SS3', 'SS3 Science A', 'Science', 'Science', 'A', 52, 'Science Wing', '2026/2027', 'active'),
  ('ss3-art-a',       'SS3', 'SS3 Art A', 'Art', 'Art', 'A', 48, 'Humanities Wing', '2026/2027', 'active'),
  ('ss3-commercial-a','SS3', 'SS3 Commercial A', 'Commercial', 'Commercial', 'A', 50, 'Commerce Wing', '2026/2027', 'active')
on conflict (id) do nothing;
