# Festacol `exam/**` design program

Date: 2026-09-17
Status: design exploration only
Target branch: `design/exam-flow-phase-01-brainstorm`

## Product objective

Redesign the student electronic-examination experience as a purpose-built academic assessment journey rather than a sequence of generic cards. The redesign may substantially change composition, hierarchy, navigation, motion and visual language, including restrained gamification where it improves orientation and progress. It must not change examination authority, scoring, persistence, access, integrity or retake semantics merely to support a visual idea.

This program deliberately separates **low-fidelity decision work** from **high-fidelity Next.js implementation**. No production `src/**` exam UI is changed until a phase direction is selected.

## Verified current lifecycle

Current production behavior resolves to these states:

`exam link → student identity/auth → academic eligibility/placement when needed → exam overview/instructions/readiness/final start → paper allocation/resume → live examination → review/final submit → processing → result or locked state`

Authoritative implementation surfaces inspected on current `master`:

- `src/app/(exam)/exam/page.tsx` — token validation, auth handoff, access decision and exam workspace entry.
- `src/app/page.tsx` — student identity/auth surface when an exam link redirects an anonymous candidate.
- `src/components/exam/student-wizard.tsx` — level/class/SS1 placement onboarding.
- `src/components/exam/exam-preflight.tsx` — overview, instructions, device check and final start/resume checkpoint.
- `src/components/exam/exam-workspace.tsx` — paper restore, live exam, autosave, timer, camera/integrity states, review, processing and submission recovery.
- `src/components/exam/exam-results.tsx` — persisted result interpretation and policy-gated answer review.
- `prisma/schema.prisma` — exam session/access/attempt/response/integrity/retake persistence model.

## Non-negotiable domain contracts

The visual redesign must preserve the current server-owned contracts:

- opaque exam-link validation and examination-window checks;
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

| Phase | Student operation | Current production owner | Selection gate |
| --- | --- | --- | --- |
| 01. Arrival & Identity | Understand the exam link, verify context, identify/sign in | `/exam` + root student auth | Select A–G before changing production auth/exam arrival UI |
| 02. Academic Eligibility & Placement | Confirm level/class or choose SS1 placement path | `student-wizard.tsx` | Seven low-fi alternatives first |
| 03. Briefing & Instructions | Understand exam purpose, policy, questions, duration and navigation | `exam-preflight.tsx` overview/instructions | Seven low-fi alternatives first |
| 04. Device Readiness & Start | Prove required connection/camera/fullscreen readiness and deliberately start/resume | `exam-preflight.tsx` readiness/final | Seven low-fi alternatives first |
| 05. Live Examination | Read, answer, navigate, flag, save, monitor time and required camera | `exam-workspace.tsx`, question/navigator/camera components | Seven low-fi alternatives first |
| 06. Review, Submit & Processing | Resolve unanswered/flagged items, confirm once, survive submission/retry/timeout | `exam-workspace.tsx` review/processing/failure | Seven low-fi alternatives first |
| 07. Result, Review & Locked | Interpret score/subject performance, review released answers, understand retake lock | `exam-results.tsx` + locked state | Seven low-fi alternatives first |

## Phase 01 data boundary

Before authentication, the current exam-link context safely exposes only:

- examination ID;
- title;
- mode;
- open status;
- start timestamp when present;
- end timestamp when present.

Candidate identity, class, subjects, duration, question count, attempt state and richer runtime policy are resolved later. Therefore Phase 01 concepts intentionally do **not** pretend those details are available before sign-in. Identity remains the existing first-name / last-name student authentication mechanism.

## Brainstorm artifact contract

For every phase:

1. `COMMAND.md` records the exact `/using-superpowers` + `/ui-ux-pro-max` generation instruction and design-system search command used as the reproducible design brief.
2. `brainstorm.html` contains at least seven alternatives for that one phase only.
3. Every alternative occupies one viewport and uses `scroll-snap-align: start`; the page uses vertical mandatory snap scrolling.
4. Alternatives must differ in interaction model, spatial composition, hierarchy and motion idea, not merely colors or rounded corners.
5. The artifact remains low fidelity: grayscale/wireframe semantics, representative labels, no claim of production fidelity and no backend simulation.
6. Accessibility and reduced-motion intent must remain visible even in the wireframe.
7. The artifact is a visual reference only. Per repository rules, prototype HTML/CSS/JS is never copied or imported into `src/**`; the selected direction is re-authored with the installed Next.js/shadcn/Tailwind system.

## Phase 01 acceptance criteria

The first selection artifact is accepted when:

- exactly seven clearly labelled concepts can be compared by scrolling one screen at a time;
- each concept represents the same Arrival & Identity operation and uses only the verified pre-auth data boundary;
- at least one concept explores restrained gamification without turning a high-stakes exam into an entertainment UI;
- at least one concept is deliberately minimal and calm;
- at least one concept emphasizes security/trust and one emphasizes academic/editorial identity;
- each concept has an explicit primary action, secondary/support action and error/state location;
- the concepts are meaningfully different enough that choosing one is a product decision;
- no production `src/**`, schema, migration, Supabase policy or runtime contract is modified.

## Implementation sequence after product selection

For each phase, repeat this gate:

`inspect current master → generate seven-option low-fi brainstorm → product owner selects option → define selected interaction contract → implement high-fidelity Next.js surface → static/runtime/accessibility validation → independent review/dogfood → commit/update PR → move to next phase brainstorm`

A later phase cannot silently redesign an already selected earlier phase. Cross-phase changes are called out explicitly so the overall journey stays coherent.
