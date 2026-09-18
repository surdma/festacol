# Festacol `exam/**` design program

Date: 2026-09-17
Status: Phases 01–03 selected/implemented; Phase 04 Result / Completion ten-option board generated; product selection pending
Target branch: `design/exam-flow-phase-01-brainstorm`

## Product objective

Redesign the student electronic-examination experience as a purpose-built academic assessment journey rather than a sequence of generic application screens.

The product owner has simplified the journey further: students should not experience internal eligibility, instruction, browser-readiness and attempt-preparation mechanics as separate phases. They came to Festacol to identify themselves, understand the paper, write it, submit it and finish.

The redesign may substantially change composition, hierarchy, navigation, motion and visual language. It must not change examination authority, scoring, persistence, access, integrity or retake semantics merely to support a visual idea.

The program separates **low-fidelity design selection** from **high-fidelity Next.js implementation**. A production phase begins only after the product owner selects a brainstorm direction for that phase.

## Verified current lifecycle

Current production behavior resolves to these states:

`examination link → candidate identity/authentication → academic information when required → examination overview/instructions/device checks/final start → paper allocation/resume → live examination with in-place submit confirmation → processing → result or locked state`

Authoritative implementation surfaces include:

- `src/app/(exam)/exam/page.tsx` — token validation, authentication handoff, access decision and examination workspace entry.
- `src/app/page.tsx` — candidate identity/authentication surface when an examination link redirects an anonymous candidate.
- `src/components/exam/student-wizard.tsx` — minimal academic exception surface when the candidate still lacks required class/placement information.
- `src/app/actions/exam-onboarding.ts` — class/placement persistence and access re-check.
- `src/components/exam/exam-preflight.tsx` — selected single-surface Folded Examination Booklet for instructions, readiness and Start/Resume.
- `src/components/exam/exam-workspace.tsx` — paper restore, attempt start/resume, Focus Capsule live examination, autosave, timer, camera/integrity states, in-place submit confirmation, processing, result/fallback and locked recovery states.
- `src/components/exam/exam-results.tsx` — candidate-facing aggregate persisted result presentation; no per-question answer-key review.
- `prisma/schema.prisma` and Supabase RPCs — examination session/access/attempt/response/integrity/retake persistence and authority.

## Non-negotiable domain contracts

The visual redesign preserves the current server-owned contracts:

- opaque examination-link validation and examination-window checks;
- student/staff role separation;
- `my_exam_access` as access authority;
- `allocate_my_exam_attempt` as the start/resume allocation authority;
- existing class/SS1 placement semantics;
- persisted responses, current question, flags, timing and remaining time;
- automatic progress saving and recovery behavior;
- camera requirement and integrity-policy behavior where configured;
- canonical question types: `single`, `multi`, `boolean`, `fill`, `fill-multi`;
- one deliberate final submission path plus timeout finalization;
- result values from persisted/scored attempt data;
- candidate result remains aggregate-only; per-question correct answers and answer-key review are not sent to the candidate client;
- explicit staff retake authority after a consumed attempt.

No design concept may invent pass/fail thresholds, ranks, AI-proctor scores, microphone requirements, biometric claims, question data, or server capabilities that do not exist.

## Four student-facing design phases

The old seven-phase design decomposition is superseded. Academic eligibility/placement, briefing/instructions and device readiness/start are now one phase because they are one student job: **get ready and begin writing**.

Each phase receives its own low-fi `brainstorm.html` before high-fidelity production implementation. Phases 01–02 retain their historical seven-option boards; the mature comparison gate used for Phases 03–04 is **ten full-screen alternatives**.

| Phase | Student operation | Current production owner(s) | Status / gate |
| --- | --- | --- | --- |
| 01. Arrival & Identity | Understand the examination link and identify/sign in as the candidate | `/exam` + root student auth | **Option A selected and implemented** |
| 02. Ready to Write | Resolve missing academic information only when necessary, understand the essential examination instructions, satisfy only required device conditions, then Start/Resume | `student-wizard.tsx` + `exam-preflight.tsx` + pre-exam state in `exam-workspace.tsx` | **Folded Examination Booklet selected and implemented** |
| 03. Write & Submit Examination | Read, answer, navigate, flag, save, monitor time and required camera/integrity state, then confirm submission in place | `exam-workspace.tsx`, Focus Capsule, question/navigator/camera/submission components | **Focus Capsule implemented; Review & Submit merged here** |
| 04. Result / Completion | Interpret aggregate score, answer composition, subject performance, optional placement and attempt facts, or understand fallback/locked state | `exam-results.tsx` + submitted/fallback/locked states in `exam-workspace.tsx` | **Ten-option snapped board generated; product selection required** |

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

At the implemented head, the `Next.js Quality` workflow previously passed the complete repository validation path for the Phase 01 implementation, including fixture/runtime schema checks, Prisma validation/generation/migrations, seed assertions, Supabase auth/RLS/Realtime SQL application, TypeScript, production build and Biome lint.

Vercel also produced a successful preview deployment for the Phase 01 implementation branch state.

Browser-level Dogfood and React Doctor were not executed in the available environment and must not be reported as passed.

## Phase 02 product contract — Ready to Write

### One surface, not four preparation screens

The default authenticated candidate experience should be one coherent pre-exam surface.

Do **not** expose the current internal sequence as:

`Overview → Instructions → Device check → Ready`.

There should be no candidate-facing preparation stepper or progress rail.

### Hide already-resolved academic work

If the candidate's current academic record already satisfies the examination access contract, do not ask them to confirm it again.

Only show academic input when a real missing record or SS1 placement choice requires candidate action.

### Keep instructions concise

Show the essential examination truths on the same surface:

- navigate and revisit questions;
- responses save automatically;
- unresolved/flagged questions are reviewed before final submission;
- timeout finalizes saved responses;
- only configured integrity/camera guidance is shown.

Long school-authored instructions may be progressively disclosed without becoming another screen.

### Make healthy device checks quiet

Connection, camera and fullscreen capability checks may still happen internally, but a healthy system should look simply **Ready** or **Device ready**.

Only a real blocker should expand into an action such as reconnecting or allowing a required camera.

Do not mention microphone access because the current examination contract does not require it.

### Start is the point of consequence

The dominant primary action is:

- **Start Examination** for a new attempt;
- **Resume Examination** for an existing attempt.

Opening Phase 02 must not allocate the attempt. Attempt allocation remains owned by the existing server authority when Start/Resume is invoked.

### Plain student language

Prefer:

- Ready to write
- Your examination
- Your class
- Important instructions
- Device ready
- Camera required
- Start Examination
- Resume Examination
- Need help?

Avoid prominent candidate-facing terms such as `onboarding`, `preflight`, `eligibility processing`, `checkpoint`, `configuration`, `capability detection`, `environment validation`, or numbered preparation steps.

## Phase 02 selection artifact

The governing Phase 02 plan is:

`docs/plans/2026-09-17-phase-02-ready-to-write.md`

The reproducible design brief is:

`docs/design/exam/phase-02-ready-to-write/COMMAND.md`

The seven-option low-fidelity comparison board is:

`docs/design/exam/phase-02-ready-to-write/brainstorm.html`

The board explores seven **single-surface** directions:

- A — Exam Cover Sheet
- B — Start Desk
- C — One Focus
- D — Readiness Ribbon
- E — Candidate Brief
- F — Adaptive Decision Surface
- G — Quiet Start Console

All seven preserve the same server-owned behavior while reducing visible process. They are selection references only, not production implementations.

## Brainstorm artifact contract

For Phase 04 and any later comparison board derived from this program:

1. `COMMAND.md` records the exact `/using-superpowers` + design-skill generation brief and any relevant repository evidence.
2. `brainstorm.html` contains exactly ten alternatives, A–J.
3. Every alternative occupies exactly one `100dvh` selection frame and uses `scroll-snap-align: start` plus `scroll-snap-stop: always`; the page uses vertical mandatory snap scrolling.
4. Alternatives must differ in interaction model, spatial composition, dominant component family, hierarchy, density and data treatment, not merely colors or rounded corners.
5. Overflow on short/mobile viewports stays inside the concept frame through an internal scroll region; concept content must not spill into the next snapped proposal.
6. The artifact remains low fidelity: restrained neutral wireframe semantics, representative labels, no claim of production fidelity and no backend simulation.
7. Accessibility, keyboard focus, 44px-ish targets and reduced-motion intent remain visible even in the wireframe.
8. Prototype HTML/CSS/JS is never copied or imported into `src/**`; the selected direction is re-authored with the installed Next.js/shadcn/Tailwind system.
9. Phase 04 concepts may use only the verified candidate result contract; no concept may invent answer keys, ranks, pass/fail thresholds, letter grades or self-service retake authority.

## Phase 04 selection artifact

The governing Phase 04 plan is:

`docs/plans/2026-09-18-phase-04-result-completion.md`

The reproducible design brief is:

`docs/design/exam/phase-04-result-completion/COMMAND.md`

The ten-option snapped comparison board is:

`docs/design/exam/phase-04-result-completion/brainstorm.html`

The board explores:

- A — Statement of Result
- B — Score Orbit
- C — Subject Columns
- D — Folded Result Booklet
- E — Debrief Timeline
- F — Academic Receipt
- G — Diagnostic Compass
- H — Subject Spotlight
- I — Marks Matrix
- J — Result Dossier

All ten use the same aggregate persisted result boundary and are selection references only.

## Next gate

**Do not implement the Phase 04 production result redesign yet.**

The next product decision is to select **A, B, C, D, E, F, G, H, I, J, or an explicit hybrid** from the Result / Completion board. After selection, the chosen spatial grammar can be re-authored in production React/shadcn/Tailwind while preserving the aggregate-only result security boundary and existing server authority.
