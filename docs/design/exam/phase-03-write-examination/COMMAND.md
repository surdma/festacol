# Phase 03 — Write Examination brainstorm command

Status: redesign round — dense A–G selection board
Prerequisite: Phase 02 Concept B remains selected and watermark-free.
Governing plan: `docs/plans/2026-09-17-phase-03-write-examination.md`

## Skills used

Use the current:

- `using-superpowers`;
- `ui-ux-pro-max`;
- `product-designer`;
- `frontend-design`.

The design must follow the real repository contract, accessibility/touch requirements, responsive hierarchy and intentional product-composition guidance from those skills.

## Generation brief

```text
Design ONLY Phase 03: "Write Examination" for Festacol.

The first Phase 03 board is rejected as too sparse. Rebuild it from scratch.

GOAL
Every concept must look and behave like a complete high-density computer-based examination workstation, not a minimal demo and not a generic admin/dashboard UI.

REQUIRED ON EVERY A–G SCREEN

IDENTITY / EXAM
- examination title
- mode
- academic session + term
- subject / mixed-subject context
- candidate name
- student number placeholder
- class
- active attempt indicator

TIME / PROGRESS
- persistent countdown
- Question N of M
- answered count
- open/incomplete count
- flagged count
- progress bar / progress meter
- subject/section question stepper

QUESTION WORK
- question subject
- optional domain
- question type
- instruction line
- prompt
- answer controls
- conditional passage area
- conditional diagram/image area + enlarge affordance
- adaptation indication for single, multi-select, true/false, fill and fill-multi

NAVIGATION
- previous
- next
- flag/unflag
- clear
- direct jump
- full navigator
- navigator filters: All / Open / Flagged
- state legend: current / answered / incomplete / visited / flagged
- Review & Submit action

RELIABILITY / INTEGRITY
- autosave state
- online/offline state
- save failure placeholder
- focus/clipboard monitoring state when configured
- fullscreen state when configured
- WEB CAM PLACEHOLDER on every concept so layout can be evaluated
- webcam annotated: conditional in production; no microphone
- optional camera-source placeholder

COMPOSITION
A few cards are acceptable when justified, especially the main question paper or webcam preview.
Do NOT construct the screen as a grid of generic rounded cards.
Use rails, flat partitions, asides, paper surfaces, instrument strips, chapter bars, bottom consoles and ruled regions.

NO WATERMARKS
No giant translucent A–G letters.
No giant phase number.
No ghost typography behind content.

SEVEN DIFFERENT ARCHITECTURES
A — Three-Zone Exam Desk
B — Paper + Instrument Spine
C — Dual-Aside Command Layout
D — Passage / Diagram Studio
E — Navigator-First Cockpit
F — Full-Width Paper + Bottom Console
G — Adaptive Exam Matrix

RESPONSIVE
- desktop can use one or two asides
- tablet may collapse one utility region
- mobile puts the question first and moves navigator/details/webcam to explicit sheets/drawers
- no horizontal scrolling
- ~44px touch targets
- visible focus
- reduced motion
- dense desktop content must still work at short viewport heights

REAL CONTRACT
Support only current Festacol behavior:
single, multi, boolean, fill, fill-multi, passage/media, timer, autosave, offline recovery, flagging, direct jump, camera when required, focus/clipboard integrity recording, fullscreen prompt and Review & Submit handoff.

Do not invent essay grading, scratch-work upload, live chat, AI hints, answer correctness during the exam, microphone monitoring or biometrics.

OUTPUT
Replace:
docs/design/exam/phase-03-write-examination/brainstorm.html

Stop after the A–G comparison artifact. Do not implement Phase 03 production React yet.
```

## Review checklist

- exactly seven concepts;
- zero watermark/ghost concept identifiers;
- each screen is visibly dense;
- every screen includes webcam placeholder;
- every screen includes candidate/exam facts;
- every screen includes timer/progress/stepper;
- every screen includes question navigator + legend;
- every screen includes main question and answer controls;
- every screen includes previous/next/flag/clear/review;
- every screen indicates passage/media and alternate question-type adaptation;
- concepts remain structurally different when text is blurred;
- no generic dashboard/bento/card-wall treatment;
- responsive/focus/reduced-motion intent is present;
- no production `src/**` change belongs to the Phase 03 brainstorm.
