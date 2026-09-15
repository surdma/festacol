# Next.js Task 7 Production Adaptation Progress

**Implementation PR:** #12 — `work/nextjs-admin-prototype-parity`  
**Requirement source:** PR #11 Task 7 + governing Admin design/UI contracts  
**Started:** 2026-09-15  
**Status:** IMPLEMENTED / CI_VALIDATED / AUTHENTICATED DB + BROWSER DOGFOOD PENDING

## Working rules for this task

- PR #12 is the implementation branch; PR #11 remains the Task 7 requirement source.
- The current Next.js/Supabase/Prisma architecture controls production persistence and routing.
- The prototype is the product/interaction source of truth, not a production runtime to copy verbatim.
- Every meaningful coherent implementation change is committed and pushed immediately instead of being accumulated for one milestone commit.
- Validation may run after commits land, but untested work is not represented as validated or complete.

## Verified current architecture

- Prisma `Question.subjectCode` is a required relation to `Subject.code`.
- The production question model stores normalized typed columns; fill answers live in `QuestionBlank` rows.
- `public/seed/questions.json` is an answer-aware import payload containing both `subjectCatalog` and `questions`; it is not the database row format.
- The production seed boundary now translates that payload into `Subject → Question → QuestionBlank` records instead of duplicating relational rows into JSON.
- The new production bank sync guarantees missing subject rows before inserting questions, satisfying the `questions.subject_code → subjects.code` foreign key on a fresh database.
- Settings now loads subjects from the same bank subject catalog instead of the separate hard-coded WAEC list.
- Legacy `getActiveSubjectsAction()` / `getSubjectsAction()` still contain an empty-table fallback recursion in the old action module; the new bank/subject production loading path no longer traverses that fallback, but source cleanup remains pending.

## Pre-Task-7 blocker plan

- [x] Make the public seed catalog a supported production import source for normalized `Subject` rows.
- [ ] Remove the legacy empty-subject fallback recursion from the old action module. This is no longer on the production bank/settings load path, but remains source debt.
- [x] Ensure question-bank synchronization creates required subjects before inserting questions so the foreign-key contract is satisfied on a fresh database.
- [x] Keep the 720-question answer-aware payload as the import representation and translate it at the server boundary rather than duplicating relational database rows in JSON.
- [x] Verify the Next.js/Prisma compilation contract for the normalized loader. Authenticated Supabase execution against a real database remains a Dogfood boundary.

## Task 7 production adaptation plan

- [x] Students directory: search/filter by level, class/pathway, status and derived performance state; expose submitted average and latest placement.
- [x] Student deep record: identity → current class → exact exam attempts → subject performance → placement → integrity → rewrite lineage.
- [x] Student mutation UX: one current `classId`; reassignment is an explicit move; suspend/activate remains available on desktop and mobile.
- [x] Staff: existing PR #12 staff route remains separate for teacher/administrator records and does not use student academic metrics.
- [x] Classes: group by SS level/pathway and expose capacity, occupancy, remaining places, room, roster, class-matched exams, WhatsApp mapping and performance context.
- [x] Safe class deletion: reject while students remain assigned and explain the required move.
- [x] WhatsApp: official host validation, one mapping per class, create/update/delete and safe external open behavior are wired through the class relationship.
- [x] Settings: add explicitly scoped production data-management controls with confirmation text and admin-only visibility.
- [x] Adapt UI behavior to production Next.js/shadcn/Tailwind/Supabase actions rather than adding prototype local-storage/Flowbite runtime behavior.

## Commit ledger

- `5ed9c437da1c17d905e654e23fbd26fa7288e16d` — `docs(admin): track Next.js Task 7 implementation`
- `58fe25abef82c8c1650994e820bbe8b80b4136a6` — `fix(seed): adapt question bank to normalized schema`
- `ff2c05041d9a45dc5891d7d14cca51f1595bd3dc` — `fix(questions): seed subjects before bank import`
- `369cdf6fe65444a019dd855201e760d86445f9e5` — `fix(settings): seed subjects from question bank catalog`
- `9aed8854e080a5d0953fb70a448f3783d7ed2b1b` — `feat(admin): add Task 7 relationship actions`
- `e1ee53a40c2c1f2d9fb0507717e34e9d5c4f0bea` — `feat(admin): deepen student and class records`
- `841d48cf86f21fec15396180be2c031fc8eebdb5` — `feat(admin): route Task 7 academic records`
- `d58c7b04741758cd1bfe903d46c636d25cc3389d` — `feat(admin): align class form with current pathways`
- `f71eb3019c5843d000a453718c3a410532f35f6a` — `feat(admin): route current class structure form`
- `162d9a587cdc4e14cfedb44c5c266d9c99adcba1` — `feat(admin): enforce class-owned WhatsApp form`
- `aca23a5e079eba1f8ce198dc123b055a2c4e50b7` — `feat(admin): route one-group WhatsApp workflow`
- `1e8075d8946afdf0d5dccbb8b1e3ecdc9d464abb` — `feat(admin): deepen student directory filters`
- `201178210b13024c5f8503f2f4860348982f5ed1` — `feat(admin): organize classes by level and pathway`
- `60b57258dd1080a3f4996203b6b0db1aac9fe07f` — `feat(admin): make student class changes explicit moves`
- `bd359cf22d4a1add69961b4646484188e7062cdb` — `feat(admin): route explicit student move workflow`
- `949cc8a9a802c83d04e6e25bcfab917b91867c03` — `feat(settings): add scoped production data cleanup`
- `fb854124a15510acab2802a389801f16eb3b79cd` — `feat(settings): add scoped data management controls`
- `db1577a0369b8aab5f601348ba3ca9c6b0f9f2b9` — `feat(settings): mount administrator data controls`
- `a0e7f2c78ac40e4aac7c50eb49351cce12c81a32` — `feat(admin): restore student status control`
- `80ecaa1789018854726966fd7ece28094a6ee13c` — `feat(admin): expose suspend and activate in students`
- `009165fcce9369ab6f66cdffa21c773a36b235e4` — `feat(admin): complete WhatsApp mapping CRUD`

## Validation ledger

`Next.js Quality` run `34911719075` executed against implementation head `009165fcce9369ab6f66cdffa21c773a36b235e4` and passed:

- dependency installation;
- Prisma schema validation;
- Prisma Client generation;
- TypeScript typecheck;
- optimized Next.js production build;
- focused Biome lint for the Admin migration surface.

This proves the pushed Task 7 code compiles and builds against the current production schema. It does **not** prove authenticated Supabase mutations or responsive browser journeys; those remain separate integration/Dogfood evidence.

## Remaining boundaries

1. Remove the legacy unused empty-subject recursion from the old action module when that legacy surface is cleaned up or safely patched.
2. Exercise `Load bank subjects` and `Load question bank` against an authenticated Supabase database and confirm normalized `subjects`, `questions`, and `question_blanks` rows are materialized as intended.
3. Exercise Task 7 in an authenticated browser at mobile/tablet/desktop widths, including student move/status, class safe-delete rejection, one-group WhatsApp CRUD and scoped Settings cleanup.
