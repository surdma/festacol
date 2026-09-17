# Phase 02 — Ready to Write

Date: 2026-09-17
Status: PLANNED — seven-option design selection gate
Target PR: #18
Planning owner: `festacol-planner`
Production owner after selection: `festacol-frontend-engineer`

## Product decision

Phase 02 replaces the previous three-phase sequence:

- Academic Eligibility & Placement;
- Briefing & Instructions;
- Device Readiness & Start.

They are now one student-facing phase: **Ready to Write**.

The reason is product simplicity. A candidate came to Festacol to write an examination. The interface should not make them feel that they are completing an administrative workflow before they can begin.

The default experience should therefore be **one coherent pre-examination surface with one obvious outcome: Start Examination** (or Resume Examination for an active attempt).

The system may still perform multiple checks internally, but those checks should not become multiple screens, rails, stages, or technical explanations for the student.

## Student goal

After identity is confirmed, the candidate should only need to understand:

1. **This is my examination.**
2. **These are the few things I need to know before I begin.**
3. **I am ready to start.**

Everything else should be automatic or shown only when it actually needs the candidate's attention.

## Verified current execution path

The current implementation spreads this operation across:

`/exam?token=…`
→ `my_exam_access`
→ `StudentWizard` when academic information is required
→ `ExamWorkspace`
→ `ExamPreflight` stages (`overview`, `instructions`, `readiness`, `final`)
→ Start/Resume
→ `allocate_my_exam_attempt` / paper loading.

Relevant current surfaces:

- `src/app/(exam)/exam/page.tsx` — validates the link, authenticates the student and uses `my_exam_access` before the workspace.
- `src/components/exam/student-wizard.tsx` — collects missing level/class information and SS1 placement consent.
- `src/app/actions/exam-onboarding.ts` — owns class/placement persistence and re-checks examination access.
- `src/components/exam/exam-preflight.tsx` — currently separates overview, instructions, device check and final confirmation into four stages.
- `src/components/exam/exam-workspace.tsx` — owns online/camera/fullscreen capability state and the eventual start/resume action.
- `src/types/exam.ts` — provides the authenticated examination context used by the pre-exam experience.

The new design changes the **presentation and interaction model**, not these server-owned authorities.

## Core design principle: complexity stays behind the interface

### Do automatically

Where the existing data already answers a question, do not ask the student to answer it again.

Examples:

- if the candidate already has a valid academic record, do not show a class-selection step;
- if the examination does not require a camera, do not show camera setup;
- if fullscreen is not required, do not explain fullscreen capability;
- do not mention microphone access because the current examination contract does not require it;
- do not display browser/system diagnostic terminology when the condition is healthy;
- do not make the candidate click through an overview simply to reach instructions and then another screen to start.

### Surface only what needs attention

The candidate should be interrupted only for a real decision or blocker, such as:

- their academic class is missing and must be confirmed;
- they are an incoming SS1 candidate who genuinely needs the placement examination;
- the examination requires camera permission and it is not ready;
- the device is offline;
- examination access is genuinely unavailable;
- their placement attempt has already been used and staff action is required.

When there is no blocker, the candidate should see a calm **Ready to write** state rather than a checklist of internal validations.

## Academic information inside Phase 02

Academic handling remains conditional rather than becoming a permanent first section.

### Candidate already has the required academic record

No academic form is shown.

The interface may display a concise confirmation such as:

**Class: SS2 Science A**

but it should not ask the candidate to reconfirm information the system already accepts.

### Candidate has no class and must establish it

Show one compact academic question in the same Ready to Write experience:

- choose academic level;
- choose the actual class for that level;
- save the initial class record;
- continue directly into the same Ready to Write surface when access is valid.

Do not call this onboarding, setup, configuration, eligibility processing, or a wizard.

### Incoming SS1 qualifier candidate

Only when the verified qualifier + no-class + SS1 condition applies, show the minimum necessary choice:

- **I already know my class** — choose the real SS1 class; the candidate does not write the placement examination; or
- **I need placement** — continue to the placement examination under the existing one-attempt rule.

This decision may use a focused inline panel or dialog, but it must remain part of Phase 02 rather than becoming another numbered phase.

### Actual access denial

A candidate who is genuinely not assigned or not qualified should receive a direct student-friendly explanation and recovery/help route. They should not be sent through irrelevant class/setup screens merely because access failed.

The later production implementation should preserve `my_exam_access` as authority while presenting its outcome more clearly.

## Examination information shown before Start

Keep the main surface concise. It may show:

- examination title;
- subject(s) or examination mode;
- candidate name and useful class label;
- duration;
- question count;
- whether this is a new attempt or a resume;
- examination availability where useful.

Do not turn this into a dense metadata dashboard.

## Instructions: essentials, not a handbook

The candidate should not have to read a separate instruction screen.

Show the few rules needed to write confidently, for example:

- answer questions and move between them freely;
- responses save automatically;
- flagged or unanswered questions can be reviewed before final submission;
- when time reaches zero, saved responses are finalized automatically;
- only show integrity/camera guidance that is actually configured for this examination.

School-authored instructions remain available, but should be presented without overwhelming the primary Start action. Long instructions may use progressive disclosure on the same surface.

## Device readiness: silent when healthy

Device readiness should behave as an automatic background check.

### Healthy state

Use a small calm status such as:

**Device ready**

or individual concise confirmations only where useful.

Do not show a technical capabilities table when everything is working.

### Blocked state

Only the failed requirement expands into an action:

- **Reconnect to continue**;
- **Allow camera to start this examination**;
- **This browser cannot use the required camera**;
- a configured fullscreen limitation if it genuinely prevents the expected experience.

If a camera is required, show the real camera permission/preview control inline on the same Phase 02 surface. If it is not required, the camera section should not appear.

## Start / Resume behavior

The primary action is the dominant action on the surface:

- **Start Examination** for a new attempt;
- **Resume Examination** when an attempt already exists.

The button must remain disabled only for genuine blockers.

Starting or resuming must continue to use the existing attempt authority; the redesign must not allocate an attempt merely because the candidate opened Phase 02.

## Student-facing language

Prefer simple examination language:

- Ready to write
- Your examination
- Your class
- Important instructions
- Device ready
- Camera required
- Start Examination
- Resume Examination
- Need help?

Avoid student-facing terms such as:

- eligibility processing;
- onboarding;
- preflight;
- checkpoint;
- configuration;
- environment validation;
- capability detection;
- system readiness pipeline;
- academic workflow;
- Step 1 / Step 2 / Step 3 / Step 4.

Technical terminology may remain in code and internal documentation where necessary; it should not become the candidate's experience.

## Required design exploration

Create exactly one Phase 02 selection board:

`docs/design/exam/phase-02-ready-to-write/brainstorm.html`

It must contain exactly seven materially different **single-surface** concepts A–G for the same Ready to Write operation.

Every concept must demonstrate the happy path without multi-screen navigation. Across the board, the concepts should also show how the same surface adapts when:

- class information is missing;
- SS1 placement is genuinely required;
- camera permission is required;
- connection is unavailable;
- an attempt is being resumed.

The concepts may use inline disclosure, dialog/sheet treatment, or expandable details for exceptional cases, but must not recreate a four-step wizard inside one phase.

## Seven concept territories

The board should explore genuinely different interaction/composition models, such as:

A. **Exam Cover Sheet** — a formal paper-cover metaphor with essentials, concise instructions, readiness confirmation and Start on one sheet.

B. **Start Desk** — examination briefing on one side and one compact candidate/readiness action area on the other.

C. **One Focus** — extremely minimal centered composition; details progressively disclose beneath a dominant Start action.

D. **Readiness Ribbon** — examination summary with a compact horizontal readiness/status band; only failed requirements expand.

E. **Candidate Brief** — an institutional briefing-note treatment with three essential rules and a persistent Start dock.

F. **Adaptive Decision Surface** — standard candidates see Ready to Write immediately; the same layout transforms only when class/SS1 placement input is actually required.

G. **Quiet Start Console** — a restrained high-clarity surface with examination facts, three plain-language truths, unobtrusive status and one Start action.

These are territories, not mandatory final names. They must not collapse into seven card/color variants.

## Selection-stage compatibility

This brainstorm stage is **docs-only**.

No `src/**`, Prisma, Supabase, migration, fixture, RPC or runtime contract change is required to create or select the Phase 02 concept.

The eventual production implementation may consolidate `StudentWizard` and `ExamPreflight` presentation substantially, but it must preserve server-owned access, placement, attempt, persistence and integrity behavior.

## Acceptance criteria for the selected Phase 02 direction

Before production implementation can be considered successful, the selected direction must satisfy all of the following:

- the normal candidate reaches one Ready to Write surface after identity rather than multiple preparation screens;
- there is no preparation stepper or progress rail;
- already-known academic information is not requested again;
- class/SS1 placement input appears only when genuinely necessary;
- concise essential instructions are available on the same surface;
- healthy device checks stay quiet;
- only blocking device conditions demand action;
- camera UI appears only when required;
- the primary Start/Resume action is visually dominant and unambiguous;
- opening the surface does not allocate an attempt;
- the existing server-owned access and attempt authorities remain intact;
- actual access denial is explained directly rather than disguised as onboarding;
- the surface remains usable on phone, tablet and small/large desktop sizes;
- keyboard/focus, accessible labels, contrast and reduced-motion behavior are preserved;
- browser-level workflow validation and independent review occur before completion is claimed.

## Explicit non-goals

Phase 02 does not redesign:

- the live question-answering workspace;
- question navigation during the examination;
- final review/submission;
- result interpretation;
- staff academic-management screens;
- placement scoring logic;
- retake-grant controls;
- examination authority rules merely to simplify the UI.

Those belong to later phases or existing staff workflows.

## Gate

**Stop after the seven-option Phase 02 board is generated and verified.**

Do not implement the selected production experience until the product owner chooses A, B, C, D, E, F, G, or an explicit hybrid.
