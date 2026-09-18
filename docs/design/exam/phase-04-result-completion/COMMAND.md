# Phase 04 — Result / Completion brainstorm command

Status: ten-direction selection board generated; production selection pending
Governing plan: docs/plans/2026-09-18-phase-04-result-completion.md

## Generation brief

/using-superpowers
/ui-ux-pro-max
/product-designer
/frontend-design

Act as a principal staff UI/UX and product designer for Festacol, an academic electronic examination platform for secondary-school students.

TASK

Design ONLY Phase 04: "Result / Completion" for the production exam journey.

Produce one standalone low-fidelity brainstorm.html containing exactly TEN genuinely different result-screen directions, labelled A–J.

Do not implement production React/Next.js code.

VERIFIED DATA TO PRESERVE

The current student result contract exposes:
- overall numeric score;
- correct count;
- incorrect count;
- unanswered count;
- answered count;
- total question count;
- completion percentage;
- active elapsed time;
- pace index;
- reasoning index;
- per-subject total/correct/percentage/active time;
- optional placement track and confidence;
- attempt reference and submission timestamp.

The authenticated exam workspace already knows the candidate name, candidate number, class label, examination title and subject names.

SECURITY / DOMAIN BOUNDARY

Do NOT invent or display:
- per-question answer review;
- correct answer keys;
- marking explanations;
- pass/fail thresholds;
- letter grades;
- class rank or percentile;
- teacher comments;
- AI coaching;
- AI proctoring claims;
- a self-service retake action.

Retake remains staff-authorized.
The primary completion action is Return to dashboard.
Refresh result may be shown as a secondary recovery action.

REQUIRED STATES

Every direction must be adaptable to:
- rich submitted result;
- single-subject result;
- multi-subject result;
- qualifier result with placement;
- missing subject aggregates;
- successful submission with rich result temporarily unavailable;
- locked/consumed attempt with recorded score when available.

TEN DIRECTIONS

A — Statement of Result
Official academic result document with a score seal, candidate/exam identity, subject table and formal footer.

B — Score Orbit
Large radial score visualization with supporting answer composition and subject ribbon.

C — Subject Columns
Subject performance becomes the main spatial structure using vertical columns/lanes.

D — Folded Result Booklet
Two-page result spread that concludes the examination-booklet metaphor.

E — Debrief Timeline
A short vertical completion timeline: submitted → overall result → subjects → attempt facts.

F — Academic Receipt
Narrow itemized receipt-like proof of completion with perforated footer.

G — Diagnostic Compass
Separate overall score from a radar/diagnostic view of Completion, Pace and Reasoning; subject scores remain bars.

H — Subject Spotlight
Fixed overall score with a subject carousel that gives one subject a large readable stage at a time.

I — Marks Matrix
Table-first modern school mark sheet with totals row and restrained attempt ledger.

J — Result Dossier
Tabbed Summary / Subjects / Attempt dossier inside one calm result frame.

DISTINCTNESS RULE

Do not create ten color themes of the same card dashboard.

Across A–J, vary all of:
- information architecture;
- main visual anchor;
- reading direction;
- dominant component family;
- density;
- progressive-disclosure strategy;
- subject-performance treatment;
- placement treatment;
- action placement.

VIEWPORT SNAP CONTRACT

This requirement is strict.

- html uses scroll-snap-type: y mandatory.
- every concept uses height:100dvh and min-height:100dvh.
- every concept uses scroll-snap-align:start and scroll-snap-stop:always.
- every concept's representative result UI fits inside its own viewport frame.
- concept content must not visually spill into the next concept.
- if content must overflow on short/mobile screens, use an internal scroll region inside that concept, not page-level continuation.
- provide a fixed unobtrusive A–J jump rail.
- each proposal must visibly read as one complete screen.

LOW-FIDELITY RULES

- grayscale / restrained neutral wireframe treatment;
- representative academic result data only;
- simple borders, surfaces, charts and labels;
- no polished brand artwork;
- no giant translucent A–J letters or decorative watermark typography;
- no emojis used as icons;
- keyboard focus is visible;
- actionable targets are approximately 44px minimum;
- status meaning is not color-only;
- motion ideas are subtle and disabled/reduced under prefers-reduced-motion.

RESPONSIVE INTENT

Each proposal should include a small note showing how its desktop composition transforms on mobile.
The board itself must remain selection-oriented rather than trying to reproduce every mobile screen.

PRODUCTION COMPONENT MAPPING

Use the actual installed Festacol component vocabulary when annotating likely production translation:
Accordion, Alert, Avatar, Badge, Button, Button Group, Card, Carousel, Chart, Collapsible, Empty, Hover Card, Item, Popover, Progress, Scroll Area, Separator, Table, Tabs, Tooltip.

Do not import shadcn into the brainstorm artifact. The board is plain HTML/CSS/vanilla JS only.

OUTPUT

Write:
docs/design/exam/phase-04-result-completion/brainstorm.html

The artifact is design-selection evidence only. Nothing in it may be imported into src/** or treated as production until the product owner selects a direction.
