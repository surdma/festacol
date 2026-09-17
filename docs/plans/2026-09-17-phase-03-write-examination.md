# Phase 03 — Write Examination

Date: 2026-09-17
Status: IMPLEMENTED — Focus Capsule selected; production validation pending
Target PR: #18
Selected direction: **F — Focus Capsule**

## Product decision

Phase 03 is no longer open for A–J selection.

The selected live examination direction is **Focus Capsule (F)**. Production must preserve the selected wireframe's spatial grammar rather than reinterpret it as a generic examination dashboard:

- one dominant rounded question capsule;
- compact supporting instruments around the capsule instead of large permanent sidebars;
- desktop question rail on the left;
- compact conditional webcam on the right;
- calm progress milestones above the question;
- **Prev**, icon-only **Flag**, **Next** as the writing controls;
- mobile/tablet fixed bottom navigation;
- mobile/tablet question navigator expands from the bottom as a Sheet;
- diagram/media questions stay first-class through the existing enlarge-capable question media surface;
- final submission is a deliberate **Submit exam** action, not a separate dense review page.

## Student-facing hierarchy

The writing surface permanently exposes only:

1. short examination title and current subject;
2. current question position;
3. remaining time;
4. save/sync state;
5. completion progress;
6. current question and response controls;
7. Prev / icon Flag / Next;
8. question navigator access;
9. compact webcam only when required;
10. Submit exam.

Class/session/student-number grids, detailed integrity telemetry, camera-source controls, attempt metadata and other secondary information stay outside the primary writing hierarchy unless an error requires action.

## Meaningful completion actions

The wireframe's generic Finish / Check steps are not production controls.

Production uses:

- **Go to unanswered (N)** while unresolved questions remain;
- **All questions answered** when the paper is complete;
- **Submit exam** as the deliberate final action.

Submit opens one confirmation surface containing only decision-relevant information:

- answered / total;
- unresolved count;
- flagged count;
- remaining time;
- reconnect guidance when offline;
- **Continue writing**;
- **Go to unanswered** when needed;
- final **Submit exam**.

There is no Clear response action and no separate student-facing Review phase.

## Responsive contract

### Desktop / large screens

- centered Focus Capsule;
- small scrollable question rail orbiting the left edge;
- compact webcam / completion utility orbiting the right edge;
- Prev / Flag / Next and completion actions inside the capsule footer.

### Tablet and mobile

- question capsule receives nearly all available width;
- webcam remains a compact header instrument and must never take over the screen;
- fixed safe-area-aware bottom navigation contains:
  - Prev;
  - icon-only Flag;
  - Questions;
  - Next;
  - Submit;
- Questions opens a bottom Sheet capped below full viewport height;
- Sheet contains the real question navigator and restores focus/position after a jump.

## Question contract

The current production question types remain supported:

- single answer;
- multiple answer with required-selection count;
- true / false;
- fill one blank;
- fill multiple blanks;
- reading passage;
- question image / diagram / figure with enlarge interaction.

The Focus Capsule changes presentation only. It must not add correctness feedback while the examination is active.

## Security boundary — candidate must never receive answer keys

This implementation strengthens the existing boundary.

### Candidate paper

A dedicated `ExamPaperQuestionDTO` is the only question shape allowed into candidate components. It contains presentation fields only and **cannot contain**:

- `answer`;
- accepted blank-answer lists;
- correct-answer arrays;
- explanations used for marking;
- scoring metadata.

`sanitizePaper` uses an explicit allow-list projection instead of object spread. Adding a new internal scoring field to `QuestionDTO` therefore cannot silently expose it to the browser.

### Grading

Correct answers are loaded through the server-side service-role question loader and grading remains entirely inside the Server Action/server library path:

`submitExamAction`
→ full server-only paper
→ `scoreAttempt`
→ persisted grading / aggregate result.

No candidate component imports or executes `scoreAttempt`, answer matching or correctness logic.

### Candidate result surfaces

Candidate-facing result and analytics surfaces return/show only aggregate server-computed metrics. Per-question correct answers and answer-review payloads are not returned to the candidate client, even after the examination closes.

Trusted server persistence may retain grading details for staff/audit operations, protected by the existing RLS/service-role boundary.

## Runtime behavior preserved

Focus Capsule keeps the established exam state machine and server authority:

- allocation / resume through `allocate_my_exam_attempt`;
- immutable question IDs for resumed attempts;
- server-reconciled remaining time;
- local response continuity while offline;
- debounced autosave plus periodic forced save;
- forced save on background transition;
- elapsed-time reconciliation after returning to the tab;
- flag persistence;
- camera ended/restored integrity events when monitoring is configured;
- automatic time-expiry submission;
- duplicate-submit recovery;
- submission retry without losing the visible response state;
- no-attempt / locked flow;
- server result restoration after an already-submitted response.

## Edge-state requirements

### Offline while writing

The current on-screen response remains intact. Save state visibly changes to Offline and reconnect forces persistence.

### Manual submission while offline

Submit confirmation stays available for orientation but final submission is disabled until connectivity returns.

### Time expires while offline

The attempt enters the existing submission-recovery state. The candidate is instructed to keep the page open and retry once connected.

### Save failure

A prominent but non-destructive alert is shown; the paper remains usable and the current response is not cleared.

### Camera interruption

The compact webcam changes to an actionable retry/error state without covering the question. Integrity records the interruption/restoration.

### Camera not configured

No camera UI exists.

### Missing current question

The capsule shows an explicit unavailable-question alert while navigator access remains usable.

### First / last question

Prev / Next are disabled at their respective boundary. Submission remains a separate action rather than replacing Next.

### Incomplete multi-part answer

The existing response-status contract marks the item incomplete so it appears in the unresolved navigator/Go-to-unanswered path.

## Production files

Primary production changes:

- `src/components/exam/exam-focus-capsule.tsx` — selected Focus Capsule experience;
- `src/components/exam/exam-workspace.tsx` — live state machine now renders Focus Capsule and removes the old review/clear flow;
- `src/components/exam/question-card.tsx` — answer-safe Focus visual variant and existing media/diagram support;
- `src/components/exam/exam-question-navigator.tsx` — consumes the explicit candidate-safe paper type;
- `src/components/exam/exam-camera-panel.tsx` — compact capsule camera variant;
- `src/types/exam.ts` — explicit `ExamPaperQuestionDTO` security boundary;
- `src/lib/questions.ts` — explicit paper allow-list projection;
- `src/app/actions/exam-state.ts` — safe paper action contract; server grading remains authoritative;
- `src/app/actions/exam-experience.ts` — aggregate candidate result only; no answer-key payload;
- `src/components/exam/exam-results.tsx` — aggregate result presentation only;
- `src/app/dashboard/analytics/page.tsx` — aggregate analytics only; no correct-answer rendering.

No schema, migration or RPC signature change is required.

## Validation gate

Before this phase can be called COMPLETE:

- source/type security audit proves candidate paper/result types contain no answer key;
- repository fixture/runtime-schema/Prisma/Supabase integration gates pass;
- TypeScript passes;
- production build passes;
- Biome passes;
- independent review finds no blocking security/responsive/state defect;
- authenticated browser Dogfood exercises:
  - new attempt;
  - active-attempt resume;
  - single/multi/boolean/fill/fill-multi;
  - passage + diagram/media;
  - mobile 360×640 and 375×812;
  - tablet 768×1024;
  - desktop 1280×800;
  - short viewport;
  - bottom-sheet navigator;
  - camera required / not required / interrupted;
  - offline save/reconnect;
  - submit with unresolved questions;
  - submit with all questions answered;
  - timer expiry;
  - duplicate-submit recovery;
  - keyboard/focus and reduced motion.

CI alone is not browser integration evidence.
