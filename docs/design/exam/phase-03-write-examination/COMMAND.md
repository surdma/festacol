# Phase 03 — Write Examination brainstorm command

Status: third redesign round — mature ten-concept selection board
Prerequisite: Phase 01/02 remain selected; Phase 03 production remains unselected.
Governing plan: `docs/plans/2026-09-17-phase-03-write-examination.md`

## Skills

Use the current:

- `using-superpowers`;
- `ui-ux-pro-max`;
- `product-designer`;
- `frontend-design`;
- `tailwindcss` principles for responsive composition, even though this artifact remains standalone HTML/CSS.

## Generation brief

```text
Completely redesign Festacol Phase 03: Write Examination from scratch.

The previous dense board is rejected.

PRODUCT GOAL
Create a mature, modern, calm computer-based exam interface for secondary-school students. The exam should feel focused and trustworthy, not like an admin dashboard and not like a toy.

REDUCE COGNITIVE LOAD
Do NOT permanently show:
- class/session/student-number grids;
- attempt metadata;
- integrity diagnostics;
- dense status legends;
- detailed connectivity panels;
- large exam-detail panels.

Persistent information should be limited to:
- short exam title;
- subject;
- question position;
- timer;
- progress;
- save state;
- current question/answers;
- navigator access;
- optional webcam;
- finish/submit.

CONTROL CHANGES
- remove Clear response completely;
- do not use Review as a visible exam control;
- do not label a button "Next question";
- visible navigation wording is exactly "Prev" and "Next";
- Flag is icon-only, with an accessible label in production;
- provide a separate "Submit exam" path.

QUESTION CONTENT
Support the real current contract:
single, multi-select, true/false, fill, fill-multi, passage and question media.

Every concept must visibly reserve a credible region for diagrams / figures / images and indicate enlarge behavior.

WEBCAM
Every wireframe concept includes a small webcam placeholder for layout evaluation.
Annotate that it disappears entirely when the exam does not require camera monitoring.
Do not show microphone.

GAMIFICATION
Use restrained, mature gamification:
- progress trails;
- checkpoints;
- section milestones;
- completion rings;
- finish-line endpoints;
- calm completion feedback.

Do not use points, XP, streak pressure, leaderboard, childish badges or active-exam confetti.

SUBMISSION
Each concept must include a compact three-stage finish process:
1. Finish
2. Check unresolved / flagged count
3. Submit exam

The final submission must feel deliberate and rewarding but academically serious.

ROUNDED GEOMETRY
Use modern rounded corners where they improve containment:
- question surface;
- webcam;
- navigator dock;
- finish checkpoint;
- timer/progress.
Do not make a wall of generic rounded cards.

FULL SCREEN
Each concept must use the entire snapped screen. Do not center a small mockup with empty space around it.

TEN DISTINCT CONCEPTS
A — Focus Rail
B — Horizon Paper
C — Diagram Studio
D — Chapter Path
E — Paper Stack
F — Focus Capsule
G — Timeline Exam
H — Split Horizon
I — Studio Dock
J — Finish Line

Each concept must differ in composition, not just styling.

WIREFRAME RULES
- exactly ten A–J concepts;
- no giant A–J background marks;
- no phase watermark;
- grayscale / low fidelity;
- min-height: 100dvh per concept;
- mandatory vertical scroll snap;
- fixed small A–J comparison navigation;
- responsive to 360px;
- visible keyboard focus;
- ~44px primary targets;
- reduced-motion support;
- no production backend simulation.

OUTPUT
Replace:
docs/design/exam/phase-03-write-examination/brainstorm.html

Do not modify Phase 03 production React in this design-selection step.
```

## Acceptance checklist

- exactly ten full-screen A–J concepts;
- all concepts use the viewport rather than a centered small mockup;
- no watermark typography;
- no Clear response text/action;
- no visible Review action;
- no “Next question” wording;
- all concepts show Prev and Next;
- all concepts use icon-only flag;
- all concepts show diagram/media provision;
- all concepts show conditional webcam provision;
- all concepts show a mature progress mechanic;
- all concepts show a Finish → Check → Submit exam journey;
- no dense candidate/exam metadata grid;
- no generic dashboard/card-wall composition;
- rounded geometry is intentional rather than universal;
- responsive/focus/reduced-motion intent exists;
- no production `src/**` changes.
