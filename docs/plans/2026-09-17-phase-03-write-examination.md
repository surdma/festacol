# Phase 03 — Write Examination

Date: 2026-09-17
Status: PLANNED — seven-option wireframe selection gate
Target PR: #18
Planning owner: `festacol-planner`
Production owner after selection: `festacol-frontend-engineer`

## Product decision

Phase 03 begins only after Phase 02 **Ready to Write** hands the candidate into an allocated/restored examination paper.

This phase is the actual writing environment. Its design goal is not to expose application mechanics; it is to keep the candidate oriented around three things:

1. the current question;
2. the remaining examination time;
3. a safe way to move, answer, flag and recover progress.

The question must remain the visual priority. Timer, save state, camera state and navigation are supporting instruments, not competing dashboards.

## Verified runtime contract

The current production path is:

`ExamWorkspace`
→ `getExamPaperAction`
→ `allocate_my_exam_attempt`
→ persisted/restored paper state
→ live `QuestionCard`
→ autosave through `saveProgressAction`
→ Phase 04 Review & Submit.

Phase 03 planning is constrained by the existing server/runtime behavior rather than a prototype-only data model.

### Real question capabilities

`QuestionDTO` currently supports:

- `single` — one answer;
- `multi` — multiple answers, including configured required-selection count;
- `boolean` — true/false;
- `fill` — one blank;
- `fill-multi` — multiple blanks.

Question content can also contain:

- a reading passage;
- a question illustration/media asset with an enlarge action;
- subject and optional domain metadata;
- question-specific instruction text.

No Phase 03 concept may invent unsupported essay grading, drawing canvases, scratch-work uploads, live chat, AI hints, answer correctness while writing, or other capabilities that are not in the current contract.

## Existing examination behavior to preserve

Every selected Phase 03 implementation must preserve:

- server-calculated remaining time and automatic expiration;
- restored active attempts with saved responses/current question/flags/timing;
- quiet autosave after edits and periodic forced persistence;
- offline state without destroying the on-screen response;
- reconciliation of elapsed/remaining time after leaving and returning to the page;
- flag/unflag current question;
- clear current response;
- previous/next navigation;
- direct question jump;
- answered/incomplete/unanswered/visited/flagged states;
- mixed-subject grouping where the paper actually contains multiple subjects;
- configured focus/clipboard integrity recording;
- required camera monitoring only when `cameraRequired === true`;
- deliberate transition to Phase 04 Review & Submit;
- automatic finalization when time reaches zero.

## Product principles

### 1. Question first

The prompt and answer controls get the strongest visual hierarchy. A candidate should never have to visually search past status panels before reading the question.

### 2. Time is visible, not alarming by default

The countdown remains persistent and readable. It becomes more urgent only near configured warning thresholds; it must not dominate the page for most of the examination.

### 3. Saving is quiet

A healthy save state should be subtle. Only offline/error states deserve expanded attention. Do not turn autosave into a constant notification system.

### 4. Navigation is predictable

Previous, Next, Flag and Review must remain findable on phone, tablet and desktop. Direct question jump must be available without permanently sacrificing the question area on small screens.

### 5. Conditional monitoring stays peripheral

If camera monitoring is required, its live status/preview must remain compact and secondary to the paper. If camera is not required, no camera component exists.

### 6. Question types share one examination grammar

Single choice, multi-select, true/false, fill blanks, passage and media questions should feel like variants of one paper—not six unrelated mini-apps.

## Phase boundary

Phase 03 includes:

- live question presentation;
- response entry;
- question navigation;
- flag/clear controls;
- timer/save/connectivity/camera status needed while writing;
- the action that moves into Review & Submit.

Phase 03 does **not** redesign:

- Phase 02 readiness/onboarding;
- the Phase 04 review screen or final confirmation modal;
- Phase 05 results;
- scoring, placement calculation or answer-review policy;
- staff authoring or exam configuration.

## Wireframe comparison gate

Before high-fidelity Phase 03 implementation, create exactly seven low-fidelity concepts A–G. They must compare **interaction architecture and spatial composition**, not colors or card styles.

### A — Question Paper + Answer Rail

A large examination sheet owns most of the viewport. A thin OMR-inspired vertical rail carries question numbers/status, while timer/save state behave like printed paper marks rather than app widgets.

### B — Focus Tunnel

Only the current question and its answer choices occupy the main field. Timer/progress becomes a thin beam at the top and the full navigator stays behind an explicit question-index control. Maximum concentration, minimum permanent chrome.

### C — Ledger Spread

A bound two-page writing spread. Passage/media/context uses the left page when present; the active question and answer controls use the right page. Without passage content, the left page becomes a restrained paper index/subject context rather than empty dashboard space.

### D — Desk Stack

The current question is the top sheet in a physical stack. Previous/next questions are implied by sheet edges, Flag behaves like a paper clip/tab, and a small examination ticket carries time/save state.

### E — Subject Chapters

The paper is organized as visible subject/section chapters. A mixed paper exposes chapter bands and per-subject position; a single-subject paper expands one chapter. The current question remains central while the chapter structure explains where the candidate is.

### F — Answer Book Margin

A ruled examination-book page with a strong numbered margin. Question number, status and flag live in the margin; the prompt and response flow in the main writing column; the bottom margin becomes the compact direct-jump index.

### G — Exam Instrument

A deliberately utilitarian, keyboard-friendly examination workstation. A narrow instrument strip holds time/save/connectivity, the question occupies the central field, and navigation is expressed as precise controls rather than cards or decorative paper metaphors.

## Anti-generic constraints

The seven concepts must not collapse into repeated:

- dashboard cards;
- left-content/right-sidebar shells;
- sticky header + card body + footer bars with only cosmetic variation;
- repeated rounded containers;
- identical question layouts with different labels;
- large camera/status panels competing with the question;
- dense admin-style metadata.

Each concept should still be recognizable if all text is blurred.

## Wireframe artifact contract

`docs/design/exam/phase-03-write-examination/brainstorm.html` must:

- contain exactly seven concepts A–G;
- give each concept at least `100dvh`;
- use vertical `scroll-snap-type: y mandatory` and `scroll-snap-align: start`;
- include fixed A–G comparison navigation;
- stay intentionally grayscale/low fidelity;
- represent the current question, answer controls, timer, save state, flagging, direct navigation and Review transition;
- annotate passage/media, multi-select/fill, offline, camera-required and active-attempt behavior without turning all of them into permanent panels;
- remain usable down to 360px and at short desktop viewport heights;
- preserve visible keyboard focus and approximately 44px primary hit targets;
- honor `prefers-reduced-motion`;
- contain no production backend simulation and make no production `src/**` changes.

## Selection gate

Phase 03 production UI remains blocked until the product owner selects **A, B, C, D, E, F, G, or an explicit hybrid**.

After selection, the chosen concept must be re-authored in the current Next.js / React / shadcn Base Nova / Tailwind stack and independently validated against the real `ExamWorkspace` state machine.

## Acceptance criteria for eventual production implementation

- the question/prompt is the strongest visual object at all target viewports;
- all current question types render correctly;
- passage/media questions remain readable without breaking navigation;
- keyboard operation and focus visibility are preserved;
- timer remains persistent and legible without unnecessary alarm;
- healthy autosave is quiet; offline/save failure is actionable;
- flag, clear, previous, next and direct jump remain discoverable;
- current/answered/incomplete/visited/flagged states remain understandable;
- required camera is compact and absent when not configured;
- active attempt restore does not lose responses, flags, question position or server-calculated time;
- the Review action clearly hands off to Phase 04;
- no new client-side authority replaces server persistence, timing or integrity behavior;
- phone/tablet/desktop and short-viewport browser validation passes before completion is claimed.
