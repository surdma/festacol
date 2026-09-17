# Phase 02 — Ready to Write

Date: 2026-09-17
Status: PLANNED — seven-option wireframe selection gate
Target PR: #18
Planning owner: `festacol-planner`
Production owner after selection: `festacol-frontend-engineer`

## Product decision

Phase 02 combines the previous Academic Eligibility & Placement, Briefing & Instructions, and Device Readiness & Start stages into one student-facing phase: **Ready to Write**.

The candidate came to write an examination. The default experience must therefore be one coherent pre-examination surface with one obvious outcome: **Start Examination** or **Resume Examination**.

The system may still perform several checks internally, but the student should not experience a preparation wizard, progress rail, diagnostics dashboard, or sequence of technical screens.

## Student goal

After Phase 01 identity, the candidate should understand only:

1. this is my examination;
2. these are the few things I need to know before I begin;
3. I am ready to start.

Everything else should be automatic or progressively disclosed only when the candidate genuinely needs to act.

## Verified current execution path

Current production behavior is distributed across:

`/exam?token=…`
→ `my_exam_access`
→ `StudentWizard` only when academic information is required
→ `ExamWorkspace`
→ `ExamPreflight`
→ Start/Resume
→ `allocate_my_exam_attempt` / paper loading.

Relevant surfaces remain:

- `src/app/(exam)/exam/page.tsx` — examination link, student access decision and workspace entry;
- `src/components/exam/student-wizard.tsx` — missing class / SS1 placement interaction;
- `src/app/actions/exam-onboarding.ts` — class/placement persistence and access re-check;
- `src/components/exam/exam-preflight.tsx` — current overview/instructions/readiness/final preparation UI;
- `src/components/exam/exam-workspace.tsx` — connectivity, camera/fullscreen capability state and eventual start/resume behavior;
- `src/types/exam.ts` — authenticated examination context.

The Phase 02 redesign changes presentation and interaction, not the server-owned authorities above.

## Core interaction principle

**Complexity stays behind the interface.**

### Do automatically

Do not ask for information the system already knows.

- Existing valid class → show it briefly; do not ask again.
- Camera not required → no camera setup UI.
- Healthy connection/device → no diagnostics table.
- Fullscreen not configured → no fullscreen explanation.
- Microphone is not part of the current contract → do not mention it.
- Long technical explanations should never sit between the candidate and Start.

### Surface only what needs attention

Interrupt the candidate only for a real decision or blocker:

- class information is genuinely missing;
- qualifier + no class + SS1 requires the known-class vs placement choice;
- camera permission is required and not ready;
- connection is unavailable;
- access is genuinely denied;
- the placement attempt is consumed and staff action is required.

Those conditions adapt the same Phase 02 surface. They do not create extra numbered phases.

## Examination information before Start

Keep only useful facts visible:

- examination title;
- subject(s) or examination mode;
- candidate name and useful class label;
- duration;
- question count;
- new attempt vs resume;
- availability when useful.

Do not turn Phase 02 into a metadata dashboard.

## Instructions

Do not create a separate instructions screen. The default surface should communicate only the essential truths:

- move between questions and flag items for review;
- responses save automatically while the examination is active;
- unresolved questions can be reviewed before final submission;
- when time reaches zero, saved responses are finalized;
- show only integrity/camera guidance that is actually configured.

School-authored instructions remain available through progressive disclosure on the same surface.

## Device readiness

Readiness is silent when healthy.

Healthy state may be represented by a restrained phrase or mark such as **Ready**, **Device ready**, or **Ready to write**.

Only a failed requirement expands into a direct action such as:

- Reconnect to continue;
- Allow camera to start this examination;
- This browser cannot use the required camera.

If camera is required, its permission/preview control must stay inside the same Phase 02 surface.

## Start / Resume

The dominant action is:

- **Start Examination** for a new attempt;
- **Resume Examination** for an existing active attempt.

Opening Phase 02 must not allocate an attempt. Attempt allocation remains server-owned and occurs only through the existing start/resume authority.

## Student-facing language

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

Avoid prominent student-facing terms such as onboarding, eligibility processing, preflight, checkpoint, configuration, system validation, capability detection, workflow, or Step 1/2/3/4.

## Wireframe design direction

The selection artifact is intentionally a **wireframe study**, not a polished interface mockup.

It should still demonstrate strong product design through composition, hierarchy, spatial metaphor, and interaction placement. The low-fidelity constraint does **not** justify generic SaaS layouts.

### Anti-generic constraints

The seven concepts must not reduce to:

- repeated cards;
- dashboard grids;
- a standard left-content/right-sidebar pattern repeated seven times;
- stacked rounded panels;
- status pills used as the main visual system;
- cosmetic variants of the same information architecture;
- different colors around the same layout.

Each concept must have a recognizably different spatial grammar before any labels are read.

## Redesigned seven concept territories

The current board explores seven deliberately different wireframe metaphors:

A. **Examination Threshold** — preparation and the paper are separated by a literal visual threshold. The Start action bridges the boundary.

B. **Folded Examination Booklet** — a two-page printed booklet with a center fold, inside-cover rules and a perforated Start strip.

C. **Candidate Desk Plan** — a top-down desk composition using an examination sheet, candidate slip, readiness stamp and Start tab.

D. **Start Instrument** — a radial examination instrument where the Start action is the visual center and paper/readiness facts orbit it.

E. **Invigilator Board** — an exam-hall board with pinned instruction notices and a start bench rather than application panels.

F. **Academic Broadsheet** — an institutional/editorial notice layout using masthead, columns and a press-bar Start action.

G. **Projection Stage** — the examination is presented as the event on a stage; system checks stay visually "off-stage" and enter only when needed.

These are low-fidelity territories, not final production styling.

## Wireframe artifact contract

`docs/design/exam/phase-02-ready-to-write/brainstorm.html` must:

- contain exactly seven A–G concepts;
- use grayscale/wireframe semantics;
- make every concept at least `100dvh`;
- use vertical mandatory scroll snapping for comparison;
- provide fixed A–G navigation;
- keep keyboard-visible focus and approximately 44px interactive targets;
- remain responsive down to 360px;
- respect `prefers-reduced-motion`;
- keep Start/Resume as the obvious primary action;
- annotate how missing class, SS1 placement, camera, offline state and resume adapt the same surface;
- avoid unsupported data/capabilities;
- change no production `src/**`, Prisma, Supabase, migration, fixture or RPC surface.

## Selection-stage compatibility

This is a docs/design-only selection stage. Production source remains untouched until the product owner selects A–G or an explicit hybrid.

The later implementation may substantially consolidate the current `StudentWizard` and `ExamPreflight` presentation, but it must preserve:

- `my_exam_access` as access authority;
- server-owned class/placement persistence;
- `allocate_my_exam_attempt` as start/resume attempt authority;
- existing integrity, persistence, scoring and retake semantics.

## Acceptance criteria for the selected production direction

Before Phase 02 can be called complete:

- normal candidates reach one Ready to Write surface rather than multiple preparation screens;
- no preparation stepper/progress rail exists;
- known academic information is not requested again;
- missing class / SS1 placement appears only when necessary;
- concise instructions live on the same surface;
- healthy device checks stay quiet;
- camera UI appears only when required;
- blockers are direct and actionable;
- Start/Resume is unmistakably dominant;
- opening Phase 02 does not allocate an attempt;
- server authority remains unchanged;
- phone/tablet/desktop layouts work;
- keyboard/focus/contrast/reduced-motion requirements are preserved;
- browser workflow validation and independent review occur before completion is claimed.

## Explicit non-goals

Phase 02 does not redesign:

- live question answering/navigation;
- review/final submission;
- result interpretation;
- staff academic-management screens;
- placement scoring;
- retake-grant controls;
- examination authority rules.

## Gate

**Stop after the seven-option Phase 02 wireframe board is generated and verified.**

Do not implement the production Phase 02 experience until the product owner selects A, B, C, D, E, F, G, or an explicit hybrid.
