# Next.js Task 7 Production Adaptation Progress

**Implementation PR:** #12 — `work/nextjs-admin-prototype-parity`  
**Requirement source:** PR #11 Task 7 + governing Admin design/UI contracts  
**Started:** 2026-09-15  
**Status:** IMPLEMENTED IN PROGRESS / PUSHED / NOT YET VALIDATED

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
- [ ] Remove the legacy empty-subject fallback recursion from the old action module.
- [x] Ensure question-bank synchronization creates required subjects before inserting questions so the foreign-key contract is satisfied on a fresh database.
- [x] Keep the 720-question answer-aware payload as the import representation and translate it at the server boundary rather than duplicating relational database rows in JSON.
- [ ] Execute production loader validation proving the normalized rows still reconstruct the stable examination `QuestionDTO` shape.

## Task 7 production adaptation plan

- [x] Students directory: search/filter by level, class/pathway, status and derived performance state; expose submitted average and latest placement.
- [x] Student deep record: identity → current class → exact exam attempts → subject performance → placement → integrity → rewrite lineage.
- [ ] Student mutation UX: one current `classId` and explicit move semantics are implemented; suspend/activate control still needs to be re-exposed in the new deep record.
- [x] Staff: existing PR #12 staff route remains separate for teacher/administrator records and does not use student academic metrics.
- [x] Classes: group by SS level/pathway and expose capacity, occupancy, remaining places, room, roster, class-matched exams, WhatsApp mapping and performance context.
- [x] Safe class deletion: reject while students remain assigned and explain the required move.
- [ ] WhatsApp: official host validation and one mapping per class are implemented; delete control still needs to be mounted in the new class-owned workflow.
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

## Validation ledger

No new seed or Task 7 production change is claimed validated yet. The user explicitly requested commit-first iteration on PR #12; executable validation will be recorded only after it actually runs against the pushed branch.

## Immediate remaining implementation

1. Restore suspend/activate in the new student academic record.
2. Add delete to the one-group-per-class WhatsApp workflow.
3. Remove the legacy empty-subject recursion so there is no alternate broken subject-loading path.
4. Run the production validation chain against the accumulated pushed commits and record failures/fixes as additional small commits.
