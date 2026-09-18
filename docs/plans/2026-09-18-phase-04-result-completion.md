# Phase 04 — Result / Completion

Date: 2026-09-18
Status: PLANNED — ten-option low-fidelity board generated; product selection required
Target PR: #18
Planning owner: festacol-planner
Production owner after selection: festacol-frontend-engineer

## Product objective

Close the examination journey with a result experience that feels like the conclusion of a serious academic assessment, not a generic analytics dashboard.

The student should understand the result in this order:

1. the attempt is complete and safely recorded;
2. the overall score;
3. the answer composition and completion state;
4. subject-level performance when available;
5. optional qualifier placement outcome when present;
6. secondary attempt indicators such as active time, pace and reasoning;
7. the next action, normally Return to dashboard.

The result should be reassuring, legible and academically credible without inventing pass/fail language, ranks, grades, recommendations or answer review that the current client contract does not provide.

## Verified current result contract

The current result path is:

exam-workspace.tsx
→ getExamResultAction
→ persisted submitted exam_attempt
→ server-side exam_attempt_responses aggregation
→ ExamResultSummary
→ exam-results.tsx

The candidate-facing summary currently provides:

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

The authenticated ExamWorkspace already has candidate name, student number, class label, session title and subject names in ExamExperienceContext. A selected production result design may consume those already-available values without requiring a new backend capability.

## Security and truth boundary

Phase 04 must preserve the current candidate-result boundary.

Do not send or render:

- per-question correct answers;
- accepted blank values;
- answer-key explanations;
- per-question correctness review;
- hidden scoring metadata;
- pass/fail thresholds that are not stored;
- letter grades that are not stored;
- rank, percentile or cohort comparison;
- teacher comments that do not exist;
- AI-generated coaching or recommendations presented as authoritative;
- AI proctoring claims or integrity scores not present in this result contract.

The screen may explain persisted aggregate metrics in plain student language, but it must not reinterpret them as a new academic judgment.

## Required result states

The selected direction must have coherent variants for all existing completion states.

### Rich submitted result

Show the full ExamResultSummary with score, answer composition, subject performance, attempt facts and optional placement outcome.

### Single-subject result

A one-subject exam must not look broken or artificially sparse. The subject treatment should collapse elegantly to one meaningful subject summary.

### Multi-subject result

Multiple subjects must remain comparable without requiring the student to decode a dense analytics dashboard.

### Qualifier placement result

When placement exists, the assigned track and confidence may become a meaningful outcome block, but the numeric examination score remains independently visible.

### No subject aggregates

If subjectStats is empty, show a clean absence state rather than an empty chart shell.

### Submission fallback

A successful final submission may temporarily have only the fallback summary while the richer result service is unavailable. The completion screen must clearly distinguish "submission recorded" from "full result details still loading".

### Locked / consumed attempt

When no further attempt is available, show Attempt complete, the recorded score when available, Return to dashboard, and Refresh result. Retake remains staff-authorized; do not imply the student can self-create one.

## Interaction hierarchy

Primary action:
- Return to dashboard.

Secondary action:
- Refresh result only when it can recover a richer/updated persisted result.

Optional progressive disclosure:
- subject details;
- attempt facts;
- metric explanation;
- qualifier placement detail.

Do not add a student-facing "Retake now" control unless a future server contract explicitly grants that ability.

## Viewport and responsive contract

The brainstorm comparison board contains exactly ten concepts, A–J.

Every concept:
- occupies exactly one 100dvh selection frame;
- uses vertical mandatory scroll snapping;
- uses scroll-snap-align:start and scroll-snap-stop:always;
- keeps its representative result composition inside that frame;
- may use an internal ScrollArea-style region only for overflow content, never page-level spill into the next concept;
- demonstrates desktop composition and a small responsive/mobile transformation note;
- reserves 44px-ish targets for actionable controls;
- preserves keyboard focus visibility and reduced-motion intent.

Production will later be re-authored responsively for 360×640, 375×812, 768×1024, 1280×800 and short desktop.

## Ten design directions

### A — Statement of Result

Metaphor: an official academic result statement.

Composition:
- formal document sheet;
- score seal as the dominant numeric element;
- candidate/exam identity header;
- subject marks table;
- answer-composition footer strip;
- optional placement endorsement.

Likely production primitives:
Card, Table, Badge, Separator, Button.

Why it is distinct:
Document-first, formal and printable in feel. It behaves like an academic record rather than an app dashboard.

### B — Score Orbit

Metaphor: one central outcome with supporting measures orbiting it.

Composition:
- large radial overall-score chart;
- compact correct/incorrect/unanswered ring legend;
- subjects as radial spokes or a lower performance ribbon;
- active time and indicators as quiet satellites.

Likely production primitives:
Chart, Progress, Tooltip, Badge, Button.

Why it is distinct:
Chart-first and visually immediate. It reduces the page to one focal score visualization rather than rows of cards.

### C — Subject Columns

Metaphor: a results hall with each subject occupying its own vertical lane.

Composition:
- overall score bar across the top;
- subject columns with percentage height and raw correct/total values;
- answer composition aligned beneath the columns;
- single-subject mode expands one lane rather than showing empty lanes.

Likely production primitives:
Chart, Progress, HoverCard, Separator, Button.

Why it is distinct:
Subject comparison is the spatial structure. The score is context, not the only hero.

### D — Folded Result Booklet

Metaphor: the examination booklet closes into a result spread.

Composition:
- two-page fold that visually echoes Phase 02 without copying it;
- left page: completion, score, candidate and attempt reference;
- right page: subject breakdown and attempt indicators;
- perforated footer strip for dashboard/refresh;
- optional placement stamp.

Likely production primitives:
Card, Separator, Collapsible, Badge, Button.

Why it is distinct:
A narrative continuation of the earlier paper metaphor, using a spread rather than a dashboard or chart canvas.

### E — Debrief Timeline

Metaphor: the completed attempt explained as a short sequence.

Composition:
- vertical line with four stops: Submitted, Overall result, Subject performance, Attempt facts;
- score and subject values live on timeline stops;
- optional placement becomes the final outcome stop for qualifier exams;
- fallback result can stop at Submitted and show the richer-result recovery state.

Likely production primitives:
Item, Progress, Tooltip, Collapsible, Button.

Why it is distinct:
Temporal and explanatory rather than spatially tabular.

### F — Academic Receipt

Metaphor: a compact proof-of-completion receipt.

Composition:
- narrow centered receipt sheet;
- large score line;
- itemized subjects;
- totals for correct/incorrect/unanswered;
- attempt reference and active time in receipt metadata;
- perforated action footer.

Likely production primitives:
Table, Separator, Badge, Button.

Why it is distinct:
Dense but calm, intentionally narrow, almost no card chrome, and optimized for quick scanning.

### G — Diagnostic Compass

Metaphor: a balanced performance instrument.

Composition:
- radar chart for Completion, Pace and Reasoning only;
- overall score remains a separate large numeric value;
- subject percentages use independent bars so unlike measures are not conflated;
- plain-language metric explanations available through tooltips.

Likely production primitives:
Chart, Progress, Tooltip, Popover, Button.

Why it is distinct:
Diagnostic visualization separates result score from behavioral/attempt indicators instead of mixing them into one number.

### H — Subject Spotlight

Metaphor: one subject at a time under a result spotlight.

Composition:
- fixed overall score anchor;
- subject carousel with one large subject performance panel per slide;
- persistent mini index shows all subjects and current position;
- answer composition and attempt facts remain fixed outside the carousel.

Likely production primitives:
Carousel, Progress, Badge, Button, ButtonGroup.

Why it is distinct:
Interaction-first. It trades simultaneous comparison for large, readable subject storytelling.

### I — Marks Matrix

Metaphor: a modern school mark sheet.

Composition:
- table-first result matrix with subject, correct/total, percent and active time;
- overall score and completion occupy the matrix header;
- answer composition becomes the totals row;
- pace/reasoning and placement sit in a restrained side ledger.

Likely production primitives:
Table, Badge, Separator, ScrollArea, Button.

Why it is distinct:
Data-first and academically familiar, with almost no decorative charting.

### J — Result Dossier

Metaphor: a compact examination dossier with layered detail.

Composition:
- one score cover panel;
- Tabs for Summary, Subjects and Attempt inside the same viewport;
- Summary shows score + answer composition;
- Subjects shows subject aggregates;
- Attempt shows time, pace, reasoning, reference and optional placement;
- locked/fallback states reuse the same dossier shell with unavailable sections disabled.

Likely production primitives:
Tabs, Card, Progress, Badge, Empty, Button.

Why it is distinct:
Progressive disclosure is the interaction model. It keeps the viewport calm by never showing every metric simultaneously.

## Selection criteria

When choosing A–J, evaluate:

- Can a student identify the score in under two seconds?
- Does the screen read as an examination result rather than an admin analytics surface?
- Does it work for one subject and many subjects?
- Does optional qualifier placement fit naturally?
- Can completion, pace and reasoning remain secondary?
- Does the design avoid implying pass/fail, rank or recommendations?
- Can the whole primary result experience fit a short desktop viewport without page-level sprawl?
- Can the same concept transform cleanly to 360px mobile?
- Is the primary Return to dashboard action obvious without competing with data?
- Does the design remain useful when subject aggregates are absent?

## Production gate

Do not modify src/components/exam/exam-results.tsx or the result server contract until the product owner selects A–J or an explicit hybrid.

After selection:
1. convert the selected spatial grammar into a high-fidelity React/shadcn/Tailwind contract;
2. map only real ExamResultSummary and existing ExamExperienceContext data;
3. implement success, fallback and locked variants;
4. validate single-subject, multi-subject and qualifier cases;
5. run TypeScript, production build, scoped Biome and React diagnostics;
6. browser-test all required viewports, keyboard/focus, reduced motion, light/dark, console and network;
7. independently review before Git completion.
