# Phase 03 — Write Examination

Date: 2026-09-17
Status: PLANNED — dense seven-option wireframe selection gate
Target PR: #18
Planning owner: `festacol-planner`
Production owner after selection: `festacol-frontend-engineer`

## Product direction

The first Phase 03 board was intentionally discarded after product-owner review. It was too sparse for a real computer-based examination workspace and underrepresented the information density required during an active examination.

The replacement board must show a **complete examination workstation on every concept page**. The student should be able to understand the current question, their progress, remaining time, candidate/exam identity, save/network condition, camera state when required, and all navigation/review controls from one coherent workspace.

Density is intentional. The constraint is not “minimal UI”; it is **high information density without generic dashboard/card composition**.

## Verified runtime contract

The live path remains:

`ExamWorkspace`
→ `getExamPaperAction`
→ `allocate_my_exam_attempt`
→ restored/allocated `ExamStateDTO`
→ `QuestionCard`
→ `saveProgressAction`
→ Phase 04 Review & Submit.

No Phase 03 wireframe may create new client authority for timing, persistence, access, scoring, placement, retakes, or integrity.

## Complete examination anatomy

Every A–G concept must visibly provide placeholders for the following real surfaces.

### Candidate and exam identity

- examination title;
- examination mode;
- academic session and term;
- subject / mixed-subject context;
- candidate full name;
- student number when present;
- class label;
- active-attempt state.

### Time and progress

- persistent server-calculated time remaining;
- question position (`Question N of M`);
- answered count;
- unanswered / incomplete count;
- flagged count;
- overall progress indicator;
- subject/section stepper for mixed papers where applicable.

### Question work area

- subject;
- optional domain;
- question type;
- question-specific instruction;
- question prompt;
- response control;
- conditional reading-passage region;
- conditional diagram / media region with enlarge affordance;
- representative adaptation note for single, multi, true/false, fill and fill-multi questions.

### Navigation and response controls

- previous;
- next;
- flag/unflag;
- clear response;
- direct question jump;
- full question navigator;
- navigator filters for all/open/flagged;
- answered / incomplete / visited / flagged / current legend;
- explicit Review & Submit handoff.

### Reliability / integrity instruments

- autosave state;
- network state;
- offline/save-failure placeholder;
- focus-monitoring / clipboard-guard status when configured;
- fullscreen status when configured;
- webcam placeholder and live status when `cameraRequired === true`;
- camera source placeholder when multiple devices exist.

## Webcam requirement

The brainstorm intentionally shows a webcam placeholder on every concept so spatial composition can be evaluated before selection.

The production rule remains conditional:

- if `cameraRequired === false`, the entire camera surface disappears;
- if `cameraRequired === true`, the camera stays visible but secondary to the question;
- microphone is not requested or represented.

## Design rules

### Dense, not dashboard-like

A dense exam surface may use one or two cards where the content benefits from containment, especially the question paper or webcam preview. It must not become a dashboard composed of many unrelated rounded cards.

Prefer:

- rails;
- ruled sections;
- partitioned asides;
- strips;
- instrument bars;
- paper surfaces;
- fixed question maps;
- bottom consoles;
- chapter/section dividers;
- flat bordered regions.

Avoid:

- bento grids;
- KPI tiles;
- generic admin cards;
- repeated rounded panels;
- decorative gradients;
- marketing layouts;
- enormous empty whitespace;
- giant decorative phase numbers or concept-letter watermarks.

### Question remains primary

Density must not demote the question. Prompt and response controls receive the largest usable central region on every desktop concept.

### Camera stays peripheral

The webcam can occupy a real persistent placeholder, but it must never be larger or visually louder than the question work area.

### Navigation must be visible

Unlike the first board, every desktop concept must visibly show both:

1. a progress/section stepper; and
2. a direct question navigator.

On small screens these may collapse to a Sheet/Drawer interaction, but the wireframe must indicate where those controls move.

## Seven dense spatial architectures

### A — Three-Zone Exam Desk

Left rail: candidate/exam details + section stepper.  
Center: primary question paper.  
Right rail: timer/progress + webcam + navigator + Review.

### B — Paper + Instrument Spine

Wide question paper dominates the page. A narrow permanent instrument spine combines timer, save/network, camera and compact navigator. Exam metadata runs in a top strip and question progress runs below the paper.

### C — Dual-Aside Command Layout

Left aside: exam map, subjects and progress.  
Center: question/response paper.  
Right aside: candidate identity, webcam/integrity, timer and final-review control.

### D — Passage / Diagram Studio

For context-heavy examinations. Left context pane handles passage/media, center question pane handles response, and a right utility spine carries webcam, timer, progress and navigator. Non-passage questions replace the context pane with exam details and question-type support.

### E — Navigator-First Cockpit

A visible large question map forms the left edge, the center is the question paper, and the right utility column holds webcam plus candidate/exam facts. A top instrument strip carries timer/save and subject stepper.

### F — Full-Width Paper + Bottom Console

No permanent sidebars. A dense top identity/instrument strip includes candidate, exam, timer and webcam thumbnail. The question gets full width. Progress stepper, navigator, status legend and navigation controls become a substantial bottom console.

### G — Adaptive Exam Matrix

A structured desktop matrix with a compact candidate/webcam column, large central question region, right navigator column and top/bottom instrument bands. It is the most configurable option but must remain flat and utilitarian rather than card-based.

## Low-fidelity artifact contract

`docs/design/exam/phase-03-write-examination/brainstorm.html` must:

- contain exactly seven concepts A–G;
- contain **no giant translucent A–G markers, phase numerals or other watermark text**;
- give every concept at least `100dvh`;
- use `scroll-snap-type: y mandatory` and `scroll-snap-align: start`;
- retain a small fixed A–G navigation control;
- remain grayscale/low fidelity;
- make every screen dense enough to show the complete exam anatomy above;
- include a visible webcam placeholder in every concept, annotated as conditional in production;
- include both a question stepper/progress surface and a direct navigator in every concept;
- include candidate/exam details in every concept;
- include a main question surface plus current answer controls;
- represent passage/media and alternate response-type adaptations;
- remain usable at 360×640, 375×812, 768×1024, 1280×800 and short desktop heights;
- preserve visible keyboard focus and ~44px principal targets;
- honor `prefers-reduced-motion`;
- use static representative content only and no fake backend logic.

## Selection gate

Phase 03 production UI remains blocked until the product owner selects **A, B, C, D, E, F, G, or an explicit hybrid**.

The selected concept must then be re-authored in React/shadcn/Tailwind and mapped to the existing `ExamWorkspace`, `ExamQuestionNavigator`, `QuestionCard`, `ExamCameraPanel`, timer, save and integrity behaviors.

## Production acceptance criteria after selection

- question remains the primary work surface;
- every supported question type fits without creating a separate visual product;
- webcam disappears completely when not configured;
- dense desktop information does not create inaccessible mobile overflow;
- timer, progress, save/network, candidate/exam identity and navigator stay discoverable;
- direct jump, flag, clear, previous, next and Review remain real controls;
- active attempt restoration preserves responses, position, flags and server time;
- offline/save error and camera interruption remain actionable;
- keyboard/focus, responsive, reduced-motion, console/network and real authenticated browser checks pass before `COMPLETE`.
