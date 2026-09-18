# Phase 04 — Result / Completion

Date: 2026-09-18
Status: SELECTED — D Folded Result Booklet chosen for production; implementation validation pending
Target PR: #18
Planning owner: festacol-planner
Production owner after selection: festacol-frontend-engineer

## Product objective

Close the examination journey with a result experience that feels substantial, academic and memorable without becoming an administrator analytics dashboard.

The board is no longer a light low-fidelity layout exercise. It is a **high-depth wireframe selection artifact**: still grayscale/neutral and non-production, but rich enough to compare real hierarchy, metrics, charts, state behavior, component density, motion intent and responsive composition.

The student should be able to answer, in order:

1. Is my attempt safely completed and recorded?
2. What was my overall result?
3. What does that result consist of?
4. How did I perform by subject?
5. How much of the paper did I complete and how much time did I use?
6. What is the placement/progression outcome when this is that kind of examination?
7. What useful achievement or strength can be stated directly from the stored result?
8. What can I do next?

The result must remain serious enough for an academic assessment and engaging enough that a student can understand it without reading a report written for staff.

## Verified current result contract

Current path:

exam-workspace.tsx
→ getExamResultAction
→ persisted submitted exam_attempt
→ server-side exam_attempt_responses aggregation
→ ExamResultSummary
→ exam-results.tsx

The current candidate result exposes:

- attempt reference;
- submitted timestamp;
- started timestamp when present;
- overall numeric score;
- answered count;
- correct count;
- incorrect count;
- unanswered count;
- total question count;
- completion percentage;
- elapsed active seconds;
- pace index;
- reasoning index;
- per-subject total, correct count, percentage and active seconds;
- optional placement track and placement confidence.

ExamExperienceContext already provides:

- candidate name;
- student number;
- class label;
- examination title;
- mode;
- academic session;
- term;
- configured examination duration;
- allocated question count;
- subject names;
- whether the exam required a camera.

These values are sufficient for a much richer result composition without changing the server contract.

## Normal versus Placement / Promotion comparison mode

Every A–J proposal must contain an explicit segmented control:

- **Normal Exam**
- **Placement / Promotion**

The switch is part of the wireframe comparison, not a production promise.

### Normal Exam

Use only current result/context data. Prioritize:

- overall score;
- answer composition;
- subject performance;
- completion;
- active time versus configured duration;
- pace and reasoning indicators;
- attempt reference;
- candidate/class/exam context;
- derived strengths or milestones that are mathematically evident from the stored result.

### Placement / Promotion

The current DTO already supports **placement** through assignedTrack + confidence. The wireframe may therefore make placement outcome a first-class result.

A true **promotion decision** such as “Promoted to SS3” is not present in the current ExamResultSummary. The alternate wireframe is allowed to explore where and how such a decision would appear, but any promotion-only field must be marked **Future result contract** in the board/spec. Production cannot ship that content until the backend exposes an authoritative promotion outcome.

The alternate mode should materially change hierarchy, not only copy the normal screen with a different badge. It may prioritize:

- placement / progression outcome;
- assigned track and confidence;
- core subject evidence supporting the outcome;
- overall score as supporting evidence;
- readiness/progression visual treatment;
- next-class or promotion decision placeholder only when explicitly marked as future-contract design exploration.

## Security and truth boundary

Phase 04 must not expose or invent:

- per-question correct answers;
- accepted blank values;
- answer-key explanations;
- per-question correctness review;
- hidden scoring metadata;
- unpersisted pass/fail thresholds;
- unpersisted letter grades;
- class rank or percentile;
- teacher comments that do not exist;
- AI-generated coaching presented as authoritative;
- AI proctoring claims;
- integrity scores not present in this result DTO;
- self-service retake authority.

The screen may derive plain facts from stored values, for example:

- “96% of the paper completed”;
- “Strongest subject: Mathematics” when Mathematics has the highest stored subject percentage;
- “17m 42s remained from a 60-minute paper” when duration context and elapsed time support it;
- “Science placement · 84% confidence” when the placement field exists.

These are calculations/labels, not new academic judgments.

## High-depth wireframe quality bar

Every proposal must visibly contain a deliberate subset of these layers:

### 1. Exam identity
- examination title;
- exam type/mode;
- academic session + term;
- candidate identity;
- class/level;
- attempt reference;
- result-recorded state.

### 2. Score and response evidence
- overall score;
- correct / incorrect / unanswered;
- answered/total;
- completion;
- a chart or structural visualization appropriate to the concept.

### 3. Subject evidence
- subject percentages;
- raw correct/total;
- subject active time;
- meaningful comparison or progressive disclosure.

### 4. Attempt performance
- active time;
- configured duration;
- pace index;
- reasoning index;
- restrained explanation that these are attempt indicators, not ranks.

### 5. Achievement / gamification layer
Use academically restrained, directly derivable achievements such as:
- strongest subject;
- high completion;
- all questions answered when true;
- completed within configured time;
- placement outcome;
- “result recorded” milestone.

Do not turn the result into a game scoreboard.

### 6. Motion intent
The wireframe must statically annotate and/or lightly demonstrate:
- score count/reveal;
- chart sweep/fill;
- sequential subject reveal;
- outcome stamp/reveal;
- tab/carousel transitions where relevant;
- reduced-motion behavior.

Motion should support comprehension and completion, not celebration for its own sake.

### 7. Actions and recovery
- Return to dashboard remains primary;
- Refresh result remains recovery/secondary;
- Print/save may appear as an optional client-side design affordance, not a backend promise;
- fallback/locked states stay represented.

## Density target

The board should be information-rich but not exhausting.

Do:
- 5–8 purposeful visual zones per screen;
- one dominant focal result;
- one secondary analytical area;
- one restrained metadata/achievement layer;
- progressive disclosure where the concept calls for it;
- compact data visualizations instead of repeated generic metric cards.

Avoid:
- empty oversized hero areas;
- four-card dashboard templates repeated across A–J;
- a wall of ten metrics with equal visual weight;
- excessive rounded cards;
- soft pastel “student dashboard” styling;
- admin-report density;
- decorative components with no result meaning.

## Required result states

The selected direction must support:

### Rich submitted result
Full ExamResultSummary and available ExamExperienceContext.

### Single-subject
Subject treatment expands intentionally rather than leaving blank comparison slots.

### Multi-subject
Subjects remain comparable and legible.

### Placement result
Assigned track + confidence becomes a first-class outcome when present.

### Promotion concept state
The board may show where an authoritative promotion result would appear. Mark this as **Future result contract** until such a field exists.

### No subject aggregates
Use an Empty/absence treatment rather than an empty chart.

### Submission fallback
Show “submission recorded” and clearly separate that fact from “full result details still loading”.

### Locked / consumed attempt
Show completion/recorded score, dashboard action and refresh/recovery. Retake remains staff-controlled.

## Viewport and responsive contract

Exactly ten concepts, A–J.

Every concept:
- occupies exactly one 100dvh frame;
- uses vertical mandatory scroll snapping;
- uses scroll-snap-align:start;
- uses scroll-snap-stop:always;
- contains its Normal/Placement-Promotion toggle inside the frame;
- keeps representative result UI inside that frame;
- uses an internal scroll region when short/mobile content overflows;
- never visually bleeds into the next proposal;
- includes a concise mobile transformation note;
- reserves approximately 44px targets;
- keeps keyboard focus visible;
- respects prefers-reduced-motion.

Production acceptance later covers:
360×640, 375×812, 768×1024, 1280×800 and short desktop.

## Ten directions — upgraded component/depth contract

### A — Statement of Result
Formal academic document.
Must include: result seal, candidate identity band, response composition strip, subject marks table with mini bars, attempt facts, achievement stamps and placement/promotion endorsement area.
Placement mode converts the endorsement area into the visual conclusion of the document.

### B — Score Orbit
Score-centric analytical instrument.
Must include: central score ring, response-composition arcs, subject satellites, time/completion orbit, achievement chips and placement-target orbit.
Placement mode changes the center hierarchy from score-first to outcome-first.

### C — Subject Columns
Subject-comparison hall.
Must include: overall result rail, subject columns, raw score/time footers, response composition, strongest-subject marker and outcome threshold/placement overlay.
Placement mode highlights core subjects supporting placement/progression.

### D — Folded Result Booklet
Premium academic report spread.
Must include: result cover page, score/completion, subject analytics page, attempt facts, achievement ribbon and outcome insert/stamp.
Placement mode turns the right page into placement/progression evidence.

### E — Debrief Timeline
Narrative result sequence.
Must include: recorded submission, score event, subject event, completion/time event, achievement event and outcome event.
Placement mode ends on the outcome milestone; fallback can terminate after submission recorded.

### F — Academic Receipt
Compact, intentionally dense result receipt.
Must include: itemized subjects, response totals, score stamp, active time, completion, achievements, attempt metadata and detachable outcome/action footer.
Placement mode adds outcome receipt lines and a future-contract promotion line when explored.

### G — Diagnostic Compass
Most analytical direction.
Must include: independent overall score, response distribution chart, completion/pace/reasoning radar, subject bars, time usage and achievement/strength interpretation.
Placement mode adds placement confidence and core-subject evidence without conflating them with the radar.

### H — Subject Spotlight
Interaction-rich subject story.
Must include: fixed overall result anchor, subject carousel/pager, subject score/raw/time, strongest-subject achievement, response composition and outcome footer.
Placement mode orders/reframes the spotlight around core placement subjects.

### I — Marks Matrix
Modern academic mark sheet.
Must include: subject matrix, raw/percent/time columns, inline micro-bars, totals row, response composition, attempt ledger, achievement markers and placement/promotion decision ledger.
Placement mode adds an outcome column/panel rather than replacing the matrix.

### J — Result Dossier
Highest progressive-disclosure depth.
Must include: score cover, Summary/Subjects/Performance/Outcome tabs, charts appropriate to each tab, achievements, attempt facts and fallback/locked handling.
Placement mode promotes Outcome to the first active tab and changes the cover language.

## Selection criteria

Evaluate A–J on:

- score comprehension in under two seconds;
- exam-specific identity;
- useful visual depth without admin-dashboard overload;
- Normal versus Placement/Promotion differentiation;
- single- versus multi-subject resilience;
- quality of chart/metric representation;
- academic credibility of gamification;
- motion serving comprehension;
- mobile transformation;
- one-screen snap integrity;
- clear dashboard/recovery actions;
- honesty about current versus future contracts.

## Selected production direction — D Folded Result Booklet

The product owner selected **D — Folded Result Booklet** on 2026-09-18.

Production requirements:

- re-author the booklet in React/shadcn/Tailwind rather than copying prototype HTML/CSS/JS;
- use the persisted submitted attempt as the result authority;
- expose frozen attempt title/name/mode/duration/question count from the existing context snapshot so later administrator edits do not rewrite result history;
- preserve aggregate-only result security: no answer keys or per-question correctness review;
- automatically elevate a real placement outcome when `assignedTrack` + confidence exist;
- do not render a promotion decision until an authoritative promotion result contract exists;
- implement rich-result, temporary rich-result fallback, and consumed/locked-attempt states in the same visual language;
- use semantic theme tokens for all Folded Result Booklet colors in both light and dark themes;
- provide real Refresh result and browser Print / Save behavior;
- use restrained result-entry motion that respects reduced motion;
- preserve staff-controlled retake authority.

### Validation gate

The implementation is not complete until:

1. the server/client result contract compiles with the frozen attempt fields;
2. fixture/runtime/security-boundary validators pass;
3. Prisma validate/generate pass;
4. TypeScript passes;
5. production Next.js build passes;
6. scoped Biome includes the result component and passes;
7. React Doctor is run when an executable checkout is available;
8. real browser Dogfood covers rich normal result, placement result, fallback/locked state, responsive viewports, themes, keyboard/focus, reduced motion, print affordance, console and network when an authenticated runnable environment is available;
9. an independent review finds no blocking result-authority, UI, accessibility or contract issue.
