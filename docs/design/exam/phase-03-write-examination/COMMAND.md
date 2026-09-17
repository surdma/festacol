# Phase 03 — Write Examination brainstorm command

Status: planned — low-fidelity A–G selection board
Prerequisite: Phase 02 Concept B remains the selected Ready to Write direction.
Governing plan: `docs/plans/2026-09-17-phase-03-write-examination.md`

## Generation brief

```text
/using-superpowers
/ui-ux-pro-max
/product-designer
/frontend-design

Design ONLY Phase 03: "Write Examination" for Festacol's student examination journey.

CONTEXT
The candidate has passed identity and Ready to Write. Their attempt is now allocated or restored. This is the live examination workspace.

PRIMARY USER GOAL
Read the current question, answer confidently, move through the paper, and know that work is safe.

REAL QUESTION CONTRACT
Support all existing variants:
- single choice;
- multiple choice with required selection count;
- true / false;
- fill in one blank;
- fill in multiple blanks;
- reading passage attached to a question;
- question illustration/media with enlarge;
- subject/domain metadata and question-specific instruction.

REAL RUNTIME BEHAVIOR TO REPRESENT
- persistent server-calculated countdown;
- automatic expiration/finalization;
- autosave and periodic persistence;
- offline/save failure recovery without clearing the on-screen response;
- previous / next;
- direct question jump;
- flag / unflag;
- clear current response;
- answered / incomplete / unanswered / visited / flagged states;
- mixed-subject grouping when present;
- compact required-camera state only when configured;
- deliberate transition to Review & Submit.

DO NOT INVENT
- essay grading;
- scratch-work upload;
- drawing/whiteboard answers;
- AI hints;
- correctness feedback while writing;
- microphone monitoring;
- live chat;
- unsupported proctoring/biometrics.

DESIGN PRINCIPLES
1. The question is the strongest visual object.
2. Timer is always legible but quiet until time pressure is real.
3. Healthy save state is subtle; failures become actionable.
4. Navigation is predictable and reachable.
5. Camera, when required, stays peripheral.
6. All question types belong to one examination grammar.
7. Do not redesign Phase 04 review/submit; only provide the handoff action.

LOW-FIDELITY BOARD
Create exactly seven genuinely different full-screen concepts:
A — Question Paper + Answer Rail
B — Focus Tunnel
C — Ledger Spread
D — Desk Stack
E — Subject Chapters
F — Answer Book Margin
G — Exam Instrument

ANTI-GENERIC RULES
Do not produce seven versions of cards, dashboards, sticky-header + panel + footer, left-content/right-sidebar, or rounded app shells. Every concept must have a distinct spatial grammar before labels are read.

WIREFRAME REQUIREMENTS
- grayscale only;
- exactly seven A–G concepts;
- each concept at least 100dvh;
- vertical mandatory scroll snap;
- fixed A–G navigation;
- visible keyboard focus;
- approximately 44px action targets;
- responsive down to 360px;
- short-viewport handling;
- prefers-reduced-motion support;
- representative question/answer controls are static wireframe content, not fake backend logic;
- annotate how passage/media, multi-select/fill, offline, camera-required and resume adapt each concept without making every exception permanently visible.

SELECTION GATE
Do not implement production Phase 03 React/Next.js UI. Stop after the A–G comparison board so the product owner can select a direction or explicit hybrid.
```

## Review checklist

- exactly seven A–G concepts;
- each has a materially different information architecture/spatial metaphor;
- question remains dominant in every concept;
- all real question variants can fit each concept;
- timer/save/nav/flag/review are represented without admin-dashboard density;
- camera is conditional and peripheral;
- direct jump remains possible on desktop and small screens;
- passage/media do not break the layout;
- responsive, focus and reduced-motion intent are visible;
- no unsupported product capability is implied;
- no production `src/**`, Prisma, Supabase, migration or fixture change is part of this brainstorm.
