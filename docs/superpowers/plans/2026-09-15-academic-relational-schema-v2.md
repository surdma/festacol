# Festacol Academic Relational Schema v2

## Status

`PLANNED` → Task 1 implementation in progress on `work/academic-relational-schema-v2`.

This redesign treats Supabase `auth.users` as the authentication authority. Festacol does **not** create a second authentication-user table. `public.academic_profiles` is an application/academic profile keyed to `auth.users.id` when an account exists.

## Verified defects in the legacy model

Repository tracing established these concrete failures:

- `public.users.subjects[]` stores teacher subject scope without teacher ↔ class ↔ subject assignments.
- `exam_sessions.subjects[]` and `cohosts[]` encode relationships as arrays.
- exam creator is not persisted by `createExamAction`.
- exam audience is represented by copied `class_level` / `class_group`, not class foreign keys.
- `/dashboard/exam` opens any existing session link before class/audience eligibility is checked.
- `attempt_limit` is stored but the start path simply locks after any submitted attempt; reset markers stand in for explicit retake authorization.
- student roster rows (`public.users`) and login profiles (`student_profiles`) are separate identities.
- student Auth accounts are derived from first/last name hashes and are not linked back to the roster row.
- attempts copy student/session/class labels and use `attempt_hash` as the relational primary key.
- question authorship has only legacy `created_by`; the original creation timestamp was never stored.
- RLS teacher scope repeats the same array-overlap assumptions, so data-model flaws directly affect authorization.

## Target invariants

1. **Authentication:** Supabase `auth.users.id` is authoritative. Academic data references an application `academic_profiles` row; it never stores or verifies passwords.
2. **Students:** one academic profile, one student extension, historical class enrolments, explicit exam audience/overrides, attempts tied to student profile ID.
3. **Staff:** one academic profile, one staff extension, subject qualifications separated from actual teacher ↔ class ↔ subject assignments.
4. **Exams:** explicit creator, staff roles, subjects and class targets. Legacy arrays become compatibility fields only during migration.
5. **Questions:** explicit subject and author profile; all newly created questions receive `created_at` and `updated_at`.
6. **Attempts:** durable UUID identity plus public/audit hash; explicit attempt number per student+exam; database-enforced uniqueness.
7. **Retakes:** default exam attempt policy plus explicit per-student access override and auditable retake grants.
8. **Authorization:** RLS and server actions derive access from relations, not copied names, subject arrays or possession of an exam link.
9. **Analytics:** joins are based on stable foreign keys; copied labels may survive only as intentionally documented historical snapshots.
10. **Migration:** never infer ambiguous relationships. Unresolved legacy facts are recorded in `schema_migration_issues` and block contract cleanup.

## Implementation slices

### Task 1 — Relational foundation

- create academic profile/student/staff extensions;
- create academic year/term models;
- create class enrolments, staff subject qualifications and teaching assignments;
- create exam subject/class/staff/access/retake relationships;
- add question author profile/created timestamp columns;
- add attempt UUID/student profile/attempt number columns;
- safely backfill only provable relationships;
- record unresolved creator/class/student/timestamp gaps;
- add future authorization helper functions;
- add a real PostgreSQL CI migration/backfill/idempotency test.

Acceptance: zero destructive legacy drops; Prisma validates/generates; SQL applies twice to a fixture database; relationship assertions pass.

### Task 2 — Identity + roster cutover

- provision/read `academic_profiles` from Supabase Auth;
- make student sign-in resolve one roster student instead of creating an independent name-hash profile;
- handle ambiguous duplicate names explicitly rather than guessing;
- migrate staff provisioning to profile + staff extension + qualifications/teaching assignments;
- update RLS self/staff helpers to use `auth.uid() → academic_profiles`.

Acceptance: every authenticated staff/student session resolves exactly one academic profile; no new legacy `student_profiles` identities are created.

### Task 3 — Exam ownership, audience and teacher scope

- write exam creator, class targets, subject links and staff roles transactionally;
- replace array-overlap teacher authorization with teaching/exam assignments;
- require explicit class targets or student overrides before publishing.

Acceptance: teacher can only create/manage exams for assigned class+subject relationships; exam creator/cohosts are queryable relationally.

### Task 4 — Student eligibility + retakes

- enforce exam audience at link resolution and start/resume boundaries;
- calculate allowed attempts from exam policy + explicit access override + active retake grants;
- allocate attempt numbers transactionally;
- replace reset-marker-as-retake semantics with explicit grants.

Acceptance: an unrelated student cannot open/start an exam; duplicate starts cannot exceed policy; a permitted retake creates the next ordinal exactly once.

### Task 5 — Question authorship and assessment structure

- write author profile and timestamps on create/update;
- move class-level/exam-mode compatibility into explicit relationships or curriculum rules where required;
- retain immutable answer/audit snapshots only where pedagogically/audit necessary.

### Task 6 — Attempt/detail foreign-key cutover

- make UUID attempt identity primary relational key;
- migrate answers/stats/integrity/state records from hashes/candidate hashes to attempt/student IDs;
- retain hashes as unique public/audit identifiers only.

### Task 7 — Query/API/admin/reporting cutover

- rewrite Supabase queries, server actions, API routes and admin/student pages around relational IDs;
- provide teacher/student/class/exam records and analytics through explicit joins/views.

### Task 8 — RLS/realtime hardening

- replace legacy array/hash policies;
- ensure student visibility is self + eligible exams only;
- ensure teacher visibility follows teaching/exam assignments;
- update realtime tables/policies.

### Task 9 — Contract cleanup

Only after all preceding slices and authenticated Dogfood pass:

- remove legacy `users.subjects`, `users.class_id` role-overloads, `student_profiles`, session subject/cohost arrays and copied target fields;
- remove attempt copied identity fields that are not explicitly retained historical snapshots;
- remove obsolete hash-based state/authorization paths;
- update fresh-environment baseline so no compatibility migration is required.

## Validation chain

For every slice:

1. Prisma validate + generate.
2. SQL migration applied against PostgreSQL fixture with `ON_ERROR_STOP=1`.
3. Migration re-run to prove idempotency where applicable.
4. Focused database assertions for constraints/backfill/authorization helpers.
5. Typecheck + production Next.js build + lint.
6. Independent code review.
7. Integration/Dogfood of affected authenticated workflows when runtime behavior changes.
8. Git/Release gate before PR handoff.
