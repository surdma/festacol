# Next.js Task 7 Production Adaptation Progress

**Implementation PR:** #12 — `work/nextjs-admin-prototype-parity`  
**Requirement source:** PR #11 Task 7 + governing Admin design/UI contracts  
**Started:** 2026-09-15  
**Status:** INVESTIGATED / PLANNED

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
- `syncQuestionBankAction()` currently translates the public payload into normalized `questions` / `question_blanks` rows, but does not first guarantee corresponding subject rows.
- `getActiveSubjectsAction()` and `getSubjectsAction()` recurse into each other when the `subjects` table is empty.
- `seedSubjectsAction()` currently uses the separate hard-coded `WAEC_SUBJECTS` catalog rather than the subject catalog bundled with the question seed, allowing bank/subject seed drift.

## Pre-Task-7 blocker plan

- [ ] Make the public seed catalog a supported production import source for normalized `Subject` rows.
- [ ] Remove the empty-subject fallback recursion.
- [ ] Ensure question-bank synchronization seeds/updates required subjects before inserting questions so the foreign-key contract is satisfied on a fresh database.
- [ ] Keep the 720-question answer-aware payload as the import representation and translate it at the server boundary rather than duplicating relational database rows in JSON.
- [ ] Verify the production question loader still reconstructs the stable examination `QuestionDTO` shape from normalized database rows.

## Task 7 production adaptation plan

- [ ] Students directory: search/filter by level, class/pathway, status and derived academic state.
- [ ] Student deep record: identity → current class → exam history → exact attempts → subject performance → placement → integrity → rewrite/merit context.
- [ ] Student mutation UX: one current `classId`; reassignment is an explicit move; preserve suspend/activate.
- [ ] Staff: separate teacher/administrator directory and record treatment with no student academic metrics.
- [ ] Classes: group by SS level/pathway; expose capacity, occupancy, remaining places, room, roster, WhatsApp mapping and performance navigation.
- [ ] Safe class deletion: reject while students remain assigned and explain the required move.
- [ ] WhatsApp: preserve validated host, one mapping per class, CRUD and QR/open behavior.
- [ ] Settings: clearly scoped destructive data-management controls with explicit confirmation text.
- [ ] Adapt all UI behavior to production Next.js/shadcn/Tailwind/Supabase actions rather than adding prototype local-storage/Flowbite runtime behavior.

## Commit ledger

- Planning checkpoint: this file establishes the evidence-based Task 7 production plan before mutation.

## Validation ledger

No new Task 7 production change is claimed validated yet. Validation evidence will be added only after it actually runs against pushed commits.
