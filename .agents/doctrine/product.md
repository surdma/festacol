# Doctrine: Product truth and domain language

Owner of: product purpose, prohibited capability, and authoritative domain terms.
Cited by: planner, backend engineer, frontend engineer, reviewer.

## Product purpose

Festacol is a Next.js examination platform for a school: staff author curriculum-aligned question
banks and examinations; students sit timed exams under integrity monitoring; staff review attempts,
retakes, placement, and reports. The production database is normalized and curriculum relationships
are modeled explicitly rather than duplicated as labels.

## Prohibited capability

Agents must not implement or imply:

- fabricated questions, scores, attempts, attendance, or placement outcomes;
- grade or placement changes outside the audited grant/assignment paths (retake grants, access
  decisions, staff assignments);
- bypassing authentication, role gating (`src/proxy.ts`), or row-level security;
- exposing service-role credentials, exam content, or other students' attempts to unauthorized roles;
- presenting a mock, fixture, or prototype surface as a live examination result.

A task that crosses this boundary must be stopped and returned to the user for a product decision.

## Integrity standard

Exam work must:

- distinguish observed attempt data from derived scores and placement conclusions;
- state uncertainty and missing evidence instead of inventing results;
- preserve relational context snapshots on attempts; never rewrite history silently;
- validate fixture and runtime input with Zod before use;
- return an honest insufficient-evidence result instead of inventing data.

## Domain language

These terms are authoritative (see `prisma/schema.prisma`):

- **Academic level / year / term**: curriculum ladder, school year, and its sequenced terms.
- **Class**: a level + track + arm cohort in an academic year; never a free-text label.
- **Subject / curriculum rule**: canonical subjects (`code`, `kind`) and their per-level/track
  participation (`required` / `elective`).
- **Class-subject offering**: the concrete class × subject unit students enroll in.
- **Teaching assignment**: staff member assigned to a concrete offering with a role
  (`teacher` / `head_teacher` / `assistant`); distinct from subject qualification.
- **Exam session**: an examination with a mode (`qualifier` / `bece` / `waec` / `neco` / `jamb` /
  `mixed` / `single`), status (`draft` / `open` / `closed`), class/offering targets, and
  placement tracks.
- **Exam attempt**: a student's durable-UUID attempt with context snapshot, responses, integrity
  events, and scoring; identified by `(session, student, attemptNumber)`.
- **Candidate link / QR**: persisted opaque `exam_session_links` tokens with versioned
  `exam_qr_codes` payload metadata — never ad-hoc encoded session blobs.
- **Retake grant / access decision**: audited per-student overrides with grantor, reason, and expiry.

Use the names already established by the repository. Do not perform an opportunistic rename
(including retired terms banned by `scripts/validate-runtime-schema-contract.mjs`) inside an
unrelated task.
