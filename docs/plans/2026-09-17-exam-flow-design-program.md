# Festacol `exam/**` design program

Date: 2026-09-17
Status: Phase 01 Option A implemented; Phase 02 remains selection-gated
Target branch: `design/exam-flow-phase-01-brainstorm`

## Product objective

Redesign the student electronic-examination experience as a purpose-built academic assessment journey rather than a sequence of generic cards. The redesign may substantially change composition, hierarchy, navigation, motion and visual language, including restrained gamification where it improves orientation and progress. It must not change examination authority, scoring, persistence, access, integrity or retake semantics merely to support a visual idea.

The program separates **low-fidelity decision work** from **high-fidelity Next.js implementation**. A production phase begins only after the product owner selects a brainstorm direction for that phase.

## Verified current lifecycle

Current production behavior resolves to these states:

`examination link → candidate identity/authentication → academic eligibility/placement when needed → examination overview/instructions/readiness/final start → paper allocation/resume → live examination → review/final submit → processing → result or locked state`

Authoritative implementation surfaces include:

- `src/app/(exam)/exam/page.tsx` — token validation, authentication handoff, access decision and examination workspace entry.
- `src/app/page.tsx` — candidate identity/authentication surface when an examination link redirects an anonymous candidate.
- `src/components/exam/student-wizard.tsx` — level/class/SS1 placement onboarding.
- `src/components/exam/exam-preflight.tsx` — overview, instructions, device check and final start/resume checkpoint.
- `src/components/exam/exam-workspace.tsx` — paper restore, live examination, autosave, timer, camera/integrity states, review, processing and submission recovery.
- `src/components/exam/exam-results.tsx` — persisted result interpretation and policy-gated answer review.
- `prisma/schema.prisma` — examination session/access/attempt/response/integrity/retake/support persistence model.

## Non-negotiable domain contracts

The visual redesign preserves the current server-owned contracts:

- opaque examination-link validation and examination-window checks;
- student/staff role separation;
- `my_exam_access` as access authority;
- `allocate_my_exam_attempt` as the only start/resume allocation authority;
- existing class/SS1 placement semantics;
- persisted responses, current question, flags, timing and remaining time;
- automatic progress saving and recovery behavior;
- camera requirement and integrity-policy behavior where configured;
- canonical question types: `single`, `multi`, `boolean`, `fill`, `fill-multi`;
- one deliberate final submission path plus timeout finalization;
- result values from persisted/scored attempt data;
- answer review only when the existing reveal policy permits it;
- explicit staff retake authority after a consumed attempt.

No design concept may invent pass/fail thresholds, ranks, AI-proctor scores, microphone requirements, biometric claims, question data, or server capabilities that do not exist.

## Seven self-contained design phases

Each phase receives its own low-fi `brainstorm.html` with **at least seven full-screen alternatives** before any high-fidelity implementation for that phase begins.

| Phase | Student operation | Current production owner | Status / gate |
| --- | --- | --- | --- |
| 01. Arrival & Identity | Understand the examination link, verify context, identify/sign in | `/exam` + root student auth | **Option A selected and implemented** |
| 02. Academic Eligibility & Placement | Confirm level/class or choose SS1 placement path | `student-wizard.tsx` | Seven low-fi alternatives required before production changes |
| 03. Briefing & Instructions | Understand examination purpose, policy, questions, duration and navigation | `exam-preflight.tsx` overview/instructions | Seven low-fi alternatives first |
| 04. Device Readiness & Start | Prove required connection/camera/fullscreen readiness and deliberately start/resume | `exam-preflight.tsx` readiness/final | Seven low-fi alternatives first |
| 05. Live Examination | Read, answer, navigate, flag, save, monitor time and required camera | `exam-workspace.tsx`, question/navigator/camera components | Seven low-fi alternatives first |
| 06. Review, Submit & Processing | Resolve unanswered/flagged items, confirm once, survive submission/retry/timeout | `exam-workspace.tsx` review/processing/failure | Seven low-fi alternatives first |
| 07. Result, Review & Locked | Interpret score/subject performance, review released answers, understand retake lock | `exam-results.tsx` + locked state | Seven low-fi alternatives first |

## Phase 01 data boundary

Before authentication, the examination-link context safely exposes only:

- examination ID;
- title;
- mode;
- open status;
- start timestamp when present;
- end timestamp when present.

Candidate identity, class, subjects, duration, question count, attempt state and richer runtime policy are resolved later. Phase 01 therefore does **not** pretend those details are available before sign-in. Identity remains the existing first-name / last-name student authentication mechanism.

## Phase 01 selected direction — Option A: Admission Pass

The product owner selected **Option A** on 2026-09-17. The selected metaphor is an official electronic examination admission pass with a detachable candidate-identity stub.

High-fidelity production implementation includes:

- a purpose-built examination admission-pass layout, re-authored in React/Tailwind/shadcn rather than copying prototype HTML;
- verified-link status, examination title, examination mode, examination window, access status and examination ID using only pre-authentication-safe data;
- the real QR code for the exact opaque examination URL, generated with the already-installed `qrcode.react` package;
- candidate first-name / last-name authentication using the existing server action and destination-preserving redirect contract;
- academic candidate terminology and a candidate-number acknowledgement state for newly provisioned student accounts;
- an admission-pass-themed invalid/expired/not-started/closed recovery surface;
- a `Need examination help?` dialog with candidate name, academic support category and bounded message input;
- durable `exam_support_requests` persistence addressed to the active staff member who created the examination;
- one-minute exact-message duplicate suppression;
- private Supabase Realtime broadcast only to the examination creator's staff topic;
- immediate staff toast plus a durable staff bell notification reconstructed from the persisted support request;
- no examination attempt allocation, academic-record mutation or hidden access bypass as a side effect of asking for support.

## Phase 01 validation record

At the implemented head, the `Next.js Quality` workflow passed all of the following against PostgreSQL and Supabase stubs:

- fixture contract;
- runtime schema contract;
- canonical migration-history assertion;
- Prisma schema validation and client generation;
- migration deploy including `20260917180000_exam_support_requests`;
- deterministic seed and seed-relationship assertions;
- Supabase auth/RLS/Realtime SQL application;
- support-table RLS and support-broadcast trigger assertions;
- TypeScript typecheck;
- production Next.js build;
- Biome lint on canonical migration/server surfaces.

Vercel also produced a successful preview deployment for the branch. Browser-level Dogfood and React Doctor still require an executable browser/local checkout and must not be reported as passed unless they are actually exercised.

## Brainstorm artifact contract

For every later phase:

1. `COMMAND.md` records the exact `/using-superpowers` + `/ui-ux-pro-max` generation instruction and design-system search command used as the reproducible design brief.
2. `brainstorm.html` contains at least seven alternatives for that one phase only.
3. Every alternative occupies one viewport and uses `scroll-snap-align: start`; the page uses vertical mandatory snap scrolling.
4. Alternatives must differ in interaction model, spatial composition, hierarchy and motion idea, not merely colors or rounded corners.
5. The artifact remains low fidelity: grayscale/wireframe semantics, representative labels, no claim of production fidelity and no backend simulation.
6. Accessibility and reduced-motion intent must remain visible even in the wireframe.
7. The artifact is a visual reference only. Prototype HTML/CSS/JS is never copied or imported into `src/**`; the selected direction is re-authored with the installed Next.js/shadcn/Tailwind system.

## Next gate

Phase 01 is implemented. **Do not redesign Phase 02 production UI yet.** The next design action is to generate the seven-option low-fidelity Phase 02 Academic Eligibility & Placement brainstorm, then wait for a product-owner selection before implementing that phase.
