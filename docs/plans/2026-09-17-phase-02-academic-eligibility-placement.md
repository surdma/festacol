# Phase 02 — Academic Eligibility & Placement

Date: 2026-09-17
Status: PLANNED — design selection gate only
Target PR: #18
Production owner after selection: `festacol-frontend-engineer`
Planning owner: `festacol-planner`

## Purpose

Phase 02 begins **after candidate identity has been confirmed** and before examination briefing/readiness. Its job is to help the authenticated student verify the academic record Festacol should use for the examination and, only where the existing server contract permits it, choose the SS1 placement route.

This phase is not a generic onboarding wizard. It is an academic-record and placement decision checkpoint in a high-stakes examination journey.

No Phase 02 production implementation starts until the product owner selects one of seven low-fidelity design directions (or an explicit hybrid).

## Verified execution path

The current production path is:

`/exam?token=…` → authenticated student → `my_exam_access` indicates academic configuration is required → `StudentWizard` → `getExamOnboardingDataAction(token)` → candidate reviews academic state → `completeExamOnboardingAction(...)` → either `/exam` or `/dashboard`.

Authoritative surfaces inspected on the current PR head:

- `src/app/(exam)/exam/page.tsx` — decides whether academic onboarding is required and mounts `StudentWizard`.
- `src/components/exam/student-wizard.tsx` — current Phase 02 client interaction.
- `src/app/actions/exam-onboarding.ts` — authoritative academic level/class/enrollment and placement rules.
- `prisma/schema.prisma` — academic levels, classes, tracks, enrollments, examination access and attempts.

## Verified server data available to Phase 02

After authentication, the existing onboarding action provides:

- examination: id, title, mode, status, startsAt, endsAt;
- active academic levels: id, name, ordinal;
- active classes: id, academic level, academic track, arm;
- the candidate's single active persisted class enrollment, when one exists.

The current contract does **not** provide a Phase 02-specific subject list, placement score, rank, predicted result, recommended track, class capacity decision, teacher recommendation, or automated transfer authority. The design must not imply those exist.

## Authoritative behavior branches to preserve

### 1. Existing active enrollment

If the candidate already has one active class enrollment:

- that persisted class is the academic truth for this checkpoint;
- the candidate may confirm it;
- the candidate may not self-transfer to another class;
- any class change requires staff action;
- placement consent is not allowed;
- for a qualifier examination, a candidate who already has a confirmed class is returned to the dashboard instead of writing the placement examination;
- for a normal examination, the server re-checks access through `my_exam_access` before continuing.

The UI must present this as **record verification**, not as a selectable class list.

### 2. No active enrollment, normal examination

If there is no persisted class and the examination is not a qualifier:

- the candidate chooses their current active academic level;
- the candidate chooses an active class belonging to that level;
- the class is persisted as the candidate's initial class enrollment;
- concurrent first-time confirmations converge to one persisted class;
- after persistence, normal examination eligibility is re-checked through `my_exam_access`.

The UI must make clear that this is an academic-record confirmation, not a temporary examination filter.

### 3. No active enrollment, SS1 qualifier

If the examination is a qualifier, the candidate has no active class, and the selected academic level is SS1, the server permits two distinct routes:

**A. Placement route**
- candidate confirms they are entering SS1 and are not yet placed into Science, Humanities or Business;
- candidate does not choose a class;
- server creates/allows examination access with a one-attempt override;
- `my_exam_access` is re-checked;
- if the placement attempt has already been consumed and there is no active attempt, a teacher or administrator must explicitly grant a retake.

**B. Known-class route**
- candidate chooses their actual SS1 class;
- class is persisted;
- because they already know their class, they do not write the placement examination and return to the dashboard.

These routes must never be visually conflated. The placement choice has materially different academic consequences.

### 4. Error and recovery states

The Phase 02 design must explicitly account for:

- academic configuration cannot be loaded;
- more than one active class exists for the candidate;
- persisted class is no longer active;
- no active classes exist for the selected level;
- selected class does not belong to selected level;
- class was confirmed concurrently in another session;
- placement link is not a qualifier;
- placement selected outside SS1;
- explicit examination access denial;
- consumed placement attempt requiring staff retake authority;
- pending server save and route transition.

## Academic terminology standard

Student-facing language in Phase 02 should use terms such as:

- Candidate
- Academic record
- Academic level
- Confirmed class
- Class arm
- Academic track
- SS1 placement
- Placement examination
- Placement route
- Examination eligibility
- Staff correction / staff update

Avoid generic product language such as `setup`, `wizard`, `path`, `profile configuration`, `flow`, or `step` in prominent student-facing headings when an academic term is available.

`Science`, `Humanities`, and `Business` are the current canonical academic-track labels. Do not rename the stored track values or invent a fourth track in this phase.

## Phase 02 design objective

The candidate should be able to answer, without ambiguity:

1. What academic record does Festacol currently have for me?
2. Am I confirming an existing record or creating my initial class record?
3. If I am an incoming SS1 candidate, do I already know my class or do I require placement?
4. What academic consequence follows from each choice?
5. Which choices become staff-controlled after confirmation?
6. Where will I go after confirmation: examination or dashboard?

The visual design should feel like an official academic placement/record checkpoint that continues naturally from Phase 01's Admission Pass, without simply duplicating the ticket layout.

## Required seven-option brainstorm

Before production changes, create:

`docs/design/exam/phase-02-academic-eligibility-placement/brainstorm.html`

with exactly seven genuinely different full-screen directions. Each direction must implement the same verified branches but vary information architecture, decision model, spatial composition and motion idea.

Across the seven directions, explore at least:

- an academic record verification / registrar metaphor;
- a placement decision desk comparing known-class vs placement consequences;
- a restrained academic journey/progression model;
- a formal candidate dossier / record sheet;
- an asymmetric school registration desk/workstation;
- a progressive-disclosure focus model;
- a calm compact console or decision matrix.

The alternatives must not be seven card variants or color themes.

## Brainstorm constraints

Every Phase 02 concept must:

- use only the verified post-authentication onboarding data above;
- show existing-enrollment and first-time-enrollment states;
- show the SS1 qualifier fork only when that server condition is true;
- make placement consent a deliberate high-consequence confirmation;
- make staff-only class changes explicit after confirmation;
- include primary action, back/recovery action and error placement;
- represent loading and unavailable-academic-record states;
- remain low fidelity and grayscale;
- occupy at least 100dvh per option;
- use vertical mandatory scroll snap for A–G comparison;
- include keyboard focus intent and accessible control labels;
- respect `prefers-reduced-motion`;
- avoid invented backend capabilities, scores, subjects, ranks or placement recommendations.

## Existing branch contamination rule

The current PR head already contains an unselected refactor touching `student-wizard.tsx`, `exam-preflight.tsx`, `exam-workspace.tsx`, `exam-results.tsx`, `exam-camera-panel.tsx`, `question-card.tsx`, and a shared checkpoint rail.

Those changes are **not accepted as the Phase 02 design merely because they are present on the branch**.

For Phase 02:

- the verified server behavior above is authoritative;
- the current `StudentWizard` implementation may be used to understand behavior, not as the selected visual direction;
- no Phase 02 high-fidelity design is approved until the product owner selects one of the seven new Phase 02 concepts;
- unrelated Phase 03–07 presentation changes must not be counted as Phase 02 completion.

## Expected compatibility class

For the design-selection stage: **docs-only, no runtime contract change**.

For the later high-fidelity implementation, current evidence suggests the existing onboarding server shape is sufficient. Therefore the expected implementation is UI-only unless the selected concept exposes a real missing capability. If a missing capability is discovered, stop and re-plan through the feature workflow instead of inventing browser-side data.

## Implementation sequence after selection

1. Re-read current branch and selected Phase 02 concept.
2. Reconfirm `StudentWizard` → onboarding action → Supabase/Postgres execution path.
3. Define exact interaction contract for the selected concept.
4. Preserve Phase 01 arrival/identity behavior unchanged.
5. Implement only Phase 02 production surfaces required by the selected concept.
6. Verify TypeScript, Biome, React diagnostics and production build.
7. Browser-test real Phase 02 states at 360×640, 375×812, 768×1024 and 1280×800, including short-height behavior.
8. Verify keyboard/focus, accessible labels/announcements, both themes and reduced motion.
9. Exercise real server-backed branches: existing enrollment, first-time normal class confirmation, SS1 placement, known-class qualifier redirect and meaningful failure states where test data permits.
10. Independent reviewer and Dogfood gate.
11. Only then update the PR as Phase 02 implemented.

## Phase 02 acceptance criteria

Phase 02 cannot be called COMPLETE until:

- one A–G concept is explicitly selected by the product owner;
- selected hi-fi production UI is implemented without changing academic authority semantics;
- existing enrollment cannot be self-transferred;
- initial class confirmation persists only a valid class from the selected level;
- SS1 placement is available only for the verified qualifier/no-enrollment/SS1 condition;
- known-class qualifier candidates do not accidentally enter the placement examination;
- placement consent clearly communicates the one-attempt/retake constraint without fabricating outcome guarantees;
- `my_exam_access` remains the post-confirmation examination eligibility authority;
- loading/error/pending/recovery states are designed and functional;
- responsive, keyboard, focus, theme and reduced-motion checks pass;
- real browser/server workflow evidence is captured;
- independent review and Dogfood have no blocking findings.

## Explicit non-goals

Phase 02 does not redesign:

- examination instructions or briefing;
- camera/fullscreen/device readiness;
- live question answering/navigation;
- submission/review/results;
- staff class-management screens;
- placement scoring logic;
- retake-grant staff controls;
- academic curriculum or subject assignment;
- database schema merely for visual convenience.

Those remain owned by later phases or existing staff workflows.