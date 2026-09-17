# Phase 03 — Focus Capsule production contract

Status: selected and implemented; validation pending
Selected wireframe: **F — Focus Capsule**
Governing plan: `docs/plans/2026-09-17-phase-03-write-examination.md`

## Selected composition

The live examination must preserve Focus Capsule's recognizable structure:

- large centered rounded capsule containing the question;
- calm colored progress band + completion milestones;
- desktop left question rail;
- desktop right compact webcam/completion utility;
- desktop capsule footer with Prev / icon Flag / Next and meaningful completion action;
- mobile/tablet bottom nav with Prev / Flag / Questions / Next / Submit;
- mobile/tablet navigator opens as a bottom Sheet;
- compact webcam never grows into a page-width/full-screen camera block.

## High-fidelity direction

Use semantic Tailwind/shadcn tokens and restrained color:

- primary tint for selected answers/current progress;
- success tint for saved/answered/completed states;
- warning/destructive only for real time/save/camera/connection attention;
- card/background gradients only as subtle depth around the capsule;
- rounded 2xl/3xl geometry where the wireframe calls for a capsule, dock, camera or submit confirmation;
- Lucide icons for navigation, flag, questions, submit and attention states.

Do not turn the selected design into a dashboard/card wall.

## Writing controls

Visible controls:

- **Prev**
- icon-only Flag with accessible name
- **Questions**
- **Next**
- **Submit exam**

There is no Clear response and no separate Review phase.

When questions remain unresolved, provide **Go to unanswered (N)**. When all are answered, provide a positive completion state.

## Submission

Submit exam opens one final Alert Dialog containing:

- answered / total;
- unresolved count;
- flagged count;
- remaining time;
- Continue writing;
- Go to unanswered when relevant;
- final Submit exam.

Submission remains server-owned and duplicate safe.

## Answer-key security

Candidate code consumes only `ExamPaperQuestionDTO`.

Never send candidate components:

- correct answers;
- accepted blank values;
- internal scoring fields;
- correctness checks;
- marking explanations.

`sanitizePaper` must explicitly project safe fields.

`scoreAttempt` remains server-side and must not be imported by candidate components.

Candidate result and analytics UI must not render or receive per-question correct answers, even after close. Aggregate server-computed performance is allowed.

## Responsive requirements

### Mobile / tablet

- fixed bottom navigation, safe-area aware;
- navigator opens from bottom, not right;
- Sheet max height below full viewport;
- webcam stays thumbnail-scale;
- no page-level horizontal overflow;
- question remains first visual priority.

### Desktop

- left rail and right utilities visually orbit the capsule;
- utilities may be sticky/absolute but must remain reachable on short viewports;
- the question capsule stays the dominant central surface.

## Edge cases

Explicitly preserve or handle:

- first/last question;
- unanswered/incomplete multi-part response;
- flag-only unanswered question;
- no camera configured;
- denied/unavailable/disconnected camera;
- offline while answering;
- save error;
- reconnect and forced save;
- tab/background elapsed-time reconciliation;
- time warning and expiration;
- submission offline;
- submission service error;
- duplicate/already-submitted recovery;
- missing current question;
- locked/no attempts remaining;
- active attempt resume;
- result service temporarily unavailable after successful submission.

## Non-goals

- no schema or RPC redesign;
- no client grading;
- no answer-key release;
- no correctness feedback during the paper;
- no microphone monitoring;
- no points/XP/leaderboard/streak mechanic.
