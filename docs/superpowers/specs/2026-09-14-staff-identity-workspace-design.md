# Staff identity, provisioning & teacher workspace — design spec

Date: 2026-09-14. Status: approved for implementation (user: "brainstorm, plan and execute").

## 1. Unblockers (no code)

- **app_metadata not visible**: Dashboard → Authentication → Users → click the
  row (not the checkbox) → side panel has **App Metadata** JSON editor. If the
  panel lacks it, use SQL editor as superuser:
  `update auth.users set raw_app_meta_data = coalesce(raw_app_meta_data,'{}'::jsonb)
   || '{"role":"administrator"}' where email='admin@school.edu';`
  then Auth → Users → … → Refresh session (user must sign in again for new JWT claims).
- **Two `users` stores is not a conflict**: `auth.users` = credentials owned by
  Supabase Auth; `public.users` = app roster (directory, class, subjects).
  Fix = link them with `public.users.auth_user_id → auth.users.id` (nullable,
  unique) instead of treating either as redundant.

## 2. Decisions

- Teachers sign in with email+password on `/admin/login` (same gate as admins).
  Proxy allows `administrator` + `teacher`; every admin page stays protected,
  and the sidebar no longer renders for signed-out visitors (layout checks role).
- Teacher = `public.users` row with `subjects: string[]` (usually one code,
  may be many) + `qualifier_access: bool`. Subject scopes exams, questions,
  reports. Classes SS1–SS3 (+qualifier) are fixed and visible to all staff.
- Teachers are read-scoped: no user management, no exam create/edit/delete,
  no bank sync. They see: own-subject exams (+qualifier exams iff
  `qualifier_access`, +cohosted exams), own-subject questions, classes,
  scoped reports. Server actions keep `requireAdmin()`; UI hides the buttons.
- Cohost = `exam_sessions.cohosts: string[]` (public.users ids), editable by
  admins in the exam detail dialog. Cohosted exams bypass subject scoping.
- Provisioning is REST (explicit user request): `POST /api/admin/bootstrap`
  (first admin, `SETUP_SECRET`-gated) and `POST/PATCH /api/admin/staff`
  (admin-session-gated). Both create the auth user (pre-confirmed,
  `app_metadata.role`) AND the linked roster row atomically.

## 3. Data changes (Prisma = migrations only)

- `users`: `+ auth_user_id String? unique`, `+ email String default ""`,
  `+ subjects Json default []`, `+ qualifier_access Boolean default false`.
- `exam_sessions`: `+ cohosts Json default []`.

## 4. Endpoints

- `POST /api/admin/bootstrap {email,password,setupSecret}` → 403 on bad
  secret; refuses when an admin roster row already exists unless
  `allowIfExists:false`… (final: refuses if any `role=administrator` row
  exists — recovery is via Supabase web + SQL above).
- `POST /api/admin/staff` (admin session) `{email,fullName,subjects,
  qualifierAccess,classId?}` → creates auth user + roster row.
- `PATCH /api/admin/staff` (admin session) `{id,subjects?,qualifierAccess?,
  classId?,status?}` → updates auth app_metadata + roster row.
- All failures return `{error}` with 4xx; never leak service-role details.

## 5. UI gating

- `lib/auth/staff.ts: currentStaff()` → `{role, isAdmin, subjects,
  qualifierAccess, staffId}` from session + roster row.
- Exams/questions pages filter server-side by scope; management buttons render
  only when `isAdmin`. Exam detail dialog shows cohost manager only to admins.
- Staff "Add staff" opens provisioning dialog (email + subjects + qualifier)
  calling the REST endpoint with the admin session cookie.

## 6. Test plan

- `tsc` + `next build` green.
- Manual: bootstrap first admin → sign in → provision teacher → teacher sees
  only own-subject exams/questions; staff endpoints 401/403 when signed out
  or signed in as teacher; sidebar absent on `/admin/login`.

## 7. Out of scope

- RLS tightening (separate `supabase/rls-hardening.sql` still pending run).
- Per-class teacher assignment, cohost notifications.

## 8. Addendum (2026-09-14): teacher scoped CRUD + majors

- Teachers perform full CRUD on students (role forced to `student`),
  exams, questions and attempt records — every mutation checks
  `requireStaff()` + subject scope (`subjects ⊆ teacher.subjects`,
  qualifier requires `qualifier_access`). Admin-only: staff provisioning,
  classes/WhatsApp, bank sync, cohost management, status of out-of-scope rows.
- Major selection is dual: admin sets subjects at provisioning (or PATCH),
  teacher self-selects via `MajorPicker` onboarding card + `updateMySubjectsAction`
  (`qualifier_access` never self-editable).
- `GET` detail readers enforce the same scope (out-of-scope → empty).
- Blocker found: live DB unreachable on direct 5432 from this network, so the
  new columns must be added once via SQL editor (see chat); afterwards
  `prisma migrate dev` owns schema evolution.

## 9. Addendum (2026-09-14): Nigerian school model (web-research grounded)

Research (WASSCE syllabus index + WAEC Nigeria approved-subject list, 2026):
core for all = English/Mathematics/Civic Education (+ trade); departments
Science / Art / Commercial; FG 2025: cross-track subject choice allowed,
ICT renamed Digital Technology. Live bank reality (720 rows): 12 short codes
(eng/mat/civ/phy/chem/bio/agric/geo/comp/eco/gov/lit ×50) + 6 q-* legacy (×20).
- Levels stay SS1–SS3; streams Science/Art/Commercial (+Qualifier pool);
  `classes.arm` added (Science A/B, Art C, Commercial D …), 12 seeded arms.
- `subjects` table (code PK = bank subject_code, name, category, streams,
  active): seeded from `lib/subjects-catalog.ts` via Settings → Seed WAEC
  catalog; admin-extensible; drives wizard, major picker, teacher scopes.
- Exam modes widened: qualifier | bece | waec | neco | jamb | mixed | single
  (paper engine groups bece/neco/jamb like waec; live mode CHECK widened in 01).

