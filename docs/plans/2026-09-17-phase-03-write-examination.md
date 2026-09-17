# Phase 03 — Write Examination

Date: 2026-09-17
Status: PLANNED — third-round ten-concept wireframe selection gate
Target PR: #18
Planning owner: `festacol-planner`
Production owner after selection: `festacol-frontend-engineer`

## Product correction

The previous seven-concept Phase 03 board is superseded.

It became too information-dense for the student task. The live examination does not need to expose every exam record, integrity state, status legend, and recovery instrument at the same time. The new direction uses **progressive disclosure** and a calmer, more mature examination hierarchy.

The student should primarily see:

1. the current question;
2. the answer controls;
3. remaining time;
4. current position/progress;
5. **Prev** and **Next**;
6. an icon-only flag action;
7. the question navigator;
8. a small webcam surface only when monitoring is required;
9. a clear route to **Submit exam**.

Everything else is secondary.

## Verified runtime boundary

The real runtime still supports:

- server-calculated timer and expiry;
- autosave / restore;
- single, multi-select, boolean, fill and fill-multi responses;
- reading passages;
- question media / diagrams with enlarge;
- direct question jump;
- flagging;
- conditional camera monitoring;
- final submission through the existing review/submission state.

This redesign is a **wireframe/product exploration only**. It does not alter `ExamWorkspace`, persistence, timing, access, scoring, integrity or submission contracts.

## Simplified persistent information

### Always visible

- short exam title;
- current subject;
- question position;
- remaining time;
- overall completion/progress;
- save state;
- current question and response;
- Prev / Next;
- icon-only Flag;
- navigator affordance;
- Submit exam affordance.

### Contextual / on demand

- full exam metadata;
- student number and class;
- session / term;
- attempt metadata;
- detailed connectivity diagnostics;
- integrity policy details;
- camera-source switching;
- detailed navigator legend.

These may exist behind an info trigger, popover, drawer or secondary sheet, but must not occupy permanent desktop real estate.

## Navigation simplification

The wireframe must not show:

- **Clear response**;
- a text-labelled Flag button;
- **Review & Submit** as the primary phrase;
- **Next question**;
- a permanent dense status legend.

Visible movement controls are simply:

- **Prev**
- icon-only flag
- **Next**

A separate **Submit exam** action initiates the finish process.

## Webcam

Every concept includes a small webcam placeholder so the composition can be assessed.

Production rule remains:

- camera surface disappears completely when `cameraRequired === false`;
- when required, camera remains secondary to the question;
- no microphone UI.

## Diagram and media provision

Every concept must demonstrate a credible place for:

- inline question diagrams;
- larger diagrams / figures;
- reading passages;
- enlarge/view controls.

The question layout must remain coherent when no diagram or passage exists.

## Mature gamification

Gamification must support orientation and completion rather than entertainment.

Allowed patterns:

- calm progress trails;
- question checkpoints;
- section milestones;
- completion rings;
- subtle “section complete” states;
- a finish-line endpoint;
- a three-stage submit checkpoint.

Do **not** add:

- points;
- XP;
- leaderboards;
- competitive ranks;
- streak pressure;
- cartoon badges;
- confetti during the active exam;
- correctness feedback before submission.

## Submission journey

Each concept must include a restrained gamified finish interaction.

The intended product sequence is:

1. **Finish** — candidate deliberately enters the submit checkpoint;
2. **Check** — show only unresolved/flagged counts, not a dense review dashboard;
3. **Submit exam** — final irreversible confirmation.

The visual metaphor can vary by concept (finish line, seal, checkpoint, completion ring, final stop), but it must remain academically serious.

This is still a representation of the existing final-submission contract; it does not invent a new scoring or reward service.

## Visual direction

The next board should feel:

- mature;
- modern;
- calm under pressure;
- exam-specific;
- spacious but not empty;
- rounded where containment improves clarity;
- tactile without becoming skeuomorphic;
- distinct from admin/dashboard UI.

Rounded borders are encouraged for:

- the primary question surface;
- webcam preview;
- navigator dock/drawer;
- submit checkpoint;
- compact progress/timer surfaces.

Avoid turning the entire page into a collection of rounded cards.

## Ten spatial concepts

### A — Focus Rail

Slim numbered navigator rail + expansive question canvas + compact camera/timer column.

### B — Horizon Paper

Full-width question paper with top progress horizon and floating bottom Prev/Flag/Next dock.

### C — Diagram Studio

Large media/diagram stage beside a focused answer panel, with navigator and camera tucked into edge utilities.

### D — Chapter Path

Subject/section milestones form a calm horizontal journey above the question; finishing the last milestone leads naturally to Submit.

### E — Paper Stack

Current question appears as the front sheet of a restrained stack; question map is represented by sheet-edge tabs and a compact camera pod.

### F — Focus Capsule

A centered, rounded question capsule dominates the screen; supporting tools orbit its edges without forming sidebars.

### G — Timeline Exam

Question milestones form a vertical progress timeline. The current question lives beside it; Submit is the final timeline stop.

### H — Split Horizon

Question/diagram context occupies the upper field; answers occupy the lower field; navigation lives in a thin right edge and controls float at the bottom.

### I — Studio Dock

Large question workspace with a modular bottom dock for navigator, camera, progress and Prev/Next. Desktop has no permanent sidebar.

### J — Finish Line

A modern completion-oriented layout where the paper stays central and the bottom progress trail visibly ends at the Submit exam checkpoint.

## Full-screen wireframe contract

`docs/design/exam/phase-03-write-examination/brainstorm.html` must:

- contain exactly **10** concepts A–J;
- use no watermark / giant concept letter / phase numeral;
- make each concept exactly one full snapped design viewport with `min-height: 100dvh`;
- use `scroll-snap-type: y mandatory` and `scroll-snap-align: start`;
- include a small fixed A–J comparison navigator;
- use the entire available screen for the concept rather than placing a small mockup in the middle;
- remain grayscale / low-fidelity, but use mature radius, spacing, hierarchy and subtle depth;
- show only the simplified persistent information above;
- include diagram/media provision in all ten concepts;
- include webcam provision in all ten concepts, marked conditional in production;
- include **Prev** and **Next** on all ten concepts;
- include icon-only Flag on all ten concepts;
- contain no Clear response action;
- contain no visible Review action;
- contain no “Next question” label;
- include a Submit exam / finish checkpoint in all ten concepts;
- include mature progress gamification in all ten concepts;
- remain usable at 360×640, 375×812, 768×1024, 1280×800 and short viewports;
- preserve visible focus, reasonable touch targets and reduced-motion support;
- remain static design evidence, not fake production logic.

## Selection gate

No Phase 03 production redesign is approved until the product owner selects **A, B, C, D, E, F, G, H, I, J, or an explicit hybrid**.

After selection, production translation must use the existing React/shadcn/Tailwind stack and preserve the real exam runtime contract.
