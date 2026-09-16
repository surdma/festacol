# Doctrine: Fixture contracts, runtime schema contract, exam-link invariants

Owner of: canonical fixture shapes, the banned-token runtime contract, seed-graph asserts, and
exam candidate-link invariants.
Cited by: backend engineer, frontend engineer, planner, reviewer.

## Fixture ownership

The backend engineer owns `public/seed/` and `scripts/validate-question-bank-contract.ts`:

- `subjects.json` — canonical subjects by `code`, with curriculum rules per level/track.
- `classes.json` — academic year, terms, levels, and classes with their subject offerings.
- `questions.json` + `questions/` — questions referencing canonical subject `code`s.

Subject and class definitions live in their own fixture files. Never duplicate them inside
question rows, and never invent a parallel fixture layout. `pnpm seed:check` (which also runs
the question-bank contract validator) must pass before `pnpm db:seed`.

## Runtime schema contract

`scripts/validate-runtime-schema-contract.mjs` scans `src/` for retired vocabulary and fails the
build gate on any match, including:

- `programme*` variants (`academic_programmes`, `exam_placement_programmes`, `programme_id`, …);
- task-number filenames (`task\d+`) and `task7` tokens;
- legacy hash/snapshot columns (`attempt_hash`, `candidate_hash`, `student_hash`,
  `rewrite_archived_at`, `rewrite_source_attempt_hash`);
- `exam_attempt_subject_stats`, `encodeSession`/`decodeSession`, `class_level`, `class_group`,
  `academic_session`.

Use the current domain names: `class_subject_offerings`, `teaching_assignments`,
`staff_subject_qualifications`, `student_subject_enrollments`, `exam_session_links`,
`exam_qr_codes`. When the data model genuinely needs a new term, add the concept through a
migration plus fixture/type updates — never by reviving a banned token.

## Seed-graph asserts

`prisma/tests/seed-relations.sql` asserts the canonical seed graph (offerings resolve to real
classes and subjects, assignments resolve to real offerings, exam targets resolve to real
audiences). Any change to seed logic, fixtures, or relations must keep this assert green against
a freshly migrated and seeded database.

## Exam candidate-link invariants

- Candidate share links are persisted opaque tokens in `exam_session_links`; QR payloads carry
  versioned metadata in `exam_qr_codes`. Never encode/decode session identity in the browser and
  never Mint link tokens outside the audited server path (`src/lib/exam-links.ts` and its
  Server Actions).
- Exam attempts use durable UUID identities with relational context snapshots. Retries and
  rewrites reference `rewrite_source_attempt_id`; history is preserved, never overwritten.
- Per-student access overrides (`exam_student_access`) and retake grants (`exam_retake_grants`)
  always record grantor, reason, and expiry. The frontend may surface them but never forges them.

## Consumer seam

Before changing a fixture shape, RPC result, Server Action payload, or API response consumed by
UI, the backend engineer inspects the consuming hook, action caller, and rendered states. The
frontend engineer states the consumer requirement when the existing shape is insufficient. Both
sides use the same shape; neither creates a duplicate.
