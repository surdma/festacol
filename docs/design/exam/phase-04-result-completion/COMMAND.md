# Phase 04 — Result / Completion high-depth wireframe generation command

Status: selection artifact complete — D Folded Result Booklet selected for production
Governing plan: docs/plans/2026-09-18-phase-04-result-completion.md

## Skills

/using-superpowers
/ui-ux-pro-max
/product-designer
/frontend-design

Act as Festacol's principal UI/UX and product designer for a secondary-school electronic examination platform.

## TASK

Regenerate ONLY Phase 04: Result / Completion as one standalone selection artifact:

docs/design/exam/phase-04-result-completion/brainstorm.html

Produce exactly TEN directions, A–J.

This is a **high-depth wireframe**, not production UI and not a lightweight box diagram.

Do not modify src/**.

## MANDATORY RESULT-TYPE SWITCH

Every A–J direction contains a functional segmented toggle:

- Normal Exam
- Placement / Promotion

Switching mode must materially change that concept's hierarchy/content.

Normal mode uses current result/context fields.

Placement mode may use the current assignedTrack + confidence contract.

A true promotion decision is not currently present in ExamResultSummary. If the alternate wireframe shows a concrete promotion decision or next-class outcome, label it visibly as:

Future result contract

Do not make a future promotion field look production-supported.

## VERIFIED CURRENT DATA

ExamResultSummary:
- overall score;
- correct;
- incorrect;
- unanswered;
- answered;
- total;
- completion;
- active elapsed time;
- pace index;
- reasoning index;
- per-subject total/correct/percentage/active time;
- optional assigned placement track + confidence;
- attempt reference;
- submitted timestamp;
- started timestamp.

ExamExperienceContext:
- candidate name;
- student number;
- class label;
- examination title;
- mode;
- academic session;
- term;
- configured duration;
- question count;
- subject names;
- camera-required flag.

## REQUIRED RESULT ANATOMY

Every direction must provide a deliberate, design-specific treatment for most of:

- result-recorded state;
- candidate identity;
- exam identity/mode;
- class/session/term;
- overall score;
- correct / incorrect / unanswered;
- answered/total;
- completion;
- time used and configured duration;
- pace;
- reasoning;
- subject percentages;
- subject correct/total;
- subject active time;
- attempt reference;
- placement outcome when applicable;
- restrained achievement/milestone;
- motion annotation;
- Return to dashboard;
- Refresh result;
- optional Print/Save as a client-side design affordance.

Do not simply put all items into equal-sized cards.

## METRICS / CHART QUALITY

Use meaningful chart representations according to each direction:

- radial rings;
- stacked response distribution;
- subject bars/columns;
- mini spark bars;
- radar only for Completion/Pace/Reasoning;
- time-used versus duration;
- placement-confidence ring;
- matrix micro-bars;
- outcome pathway;
- carousel subject stage.

Do not manufacture rank, percentile, class comparison, grade, pass/fail or trend history.

## ACADEMIC GAMIFICATION

Represent motivation without becoming childish.

Allowed when directly derivable:
- strongest subject;
- high completion;
- all answered when true;
- completed within configured duration;
- recorded-result milestone;
- placement outcome;
- subject strength marker.

Use restrained ribbons, stamps, badges, seals, milestone markers or achievement chips.

Do not create points, coins, XP, leaderboards, ranks or fictional awards.

## MOTION / ANIMATION INTENT

Even as a wireframe, every direction must show motion thinking.

Use a combination of:
- subtle working CSS transitions/animations in the board;
- visible motion-note annotations such as “score count-up”, “ring sweep”, “subject stagger”, “outcome stamp reveal”, “carousel slide”.

All motion must respect prefers-reduced-motion.

## DENSITY / DEPTH

Target controlled density.

Each concept should feel complete at 1280×800:
- 5–8 purposeful visual zones;
- one dominant result focal point;
- one secondary analytical area;
- one restrained metadata/achievement layer;
- meaningful charting or structured data display;
- compact recovery/actions.

Avoid:
- giant empty hero space;
- four-card generic dashboards;
- repetitive rounded-card grids;
- excessive soft styling;
- admin-report overload;
- ten concepts that differ only by color or component order.

## EXACT TEN DIRECTIONS

A — Statement of Result
Formal document / result certificate architecture.

B — Score Orbit
Radial score and satellite-metric architecture.

C — Subject Columns
Vertical subject-comparison architecture.

D — Folded Result Booklet
Two-page academic report spread.

E — Debrief Timeline
Result explained as an event/outcome sequence.

F — Academic Receipt
Compact itemized result proof.

G — Diagnostic Compass
Analytical instrument separating score, response mix and attempt indicators.

H — Subject Spotlight
Fixed score with interactive subject carousel/pager.

I — Marks Matrix
Table-first modern marks sheet with micro-bars and outcome ledger.

J — Result Dossier
Tabbed progressive-disclosure result record.

## DISTINCTNESS GATE

Across A–J vary:
- information architecture;
- primary focal point;
- reading direction;
- dominant primitive family;
- chart form;
- density strategy;
- subject-performance treatment;
- placement/promotion treatment;
- achievement treatment;
- motion idea;
- action placement.

Reject any concept that is merely another card dashboard.

## SNAP / VIEWPORT CONTRACT

Strict:
- html { scroll-snap-type:y mandatory; }
- each concept is height:100dvh and min-height:100dvh;
- each concept uses scroll-snap-align:start;
- each concept uses scroll-snap-stop:always;
- each screen contains its own Normal/Placement-Promotion segmented control;
- no concept visually spills into the next;
- short/mobile overflow uses an internal scroller;
- fixed A–J jump navigation;
- one representative complete screen per concept.

## RESPONSIVE / ACCESSIBILITY

- visible keyboard focus;
- semantic buttons for all toggles/tabs/carousel controls;
- ~44px interactive targets;
- not color-only;
- responsive transformation note on every concept;
- reduced-motion CSS;
- no emoji icons;
- no giant decorative A–J watermark letters.

## PRODUCTION COMPONENT ANNOTATION

Annotate likely translation using installed Festacol primitives where relevant:
Accordion, Alert, Avatar, Badge, Button, Button Group, Card, Carousel, Chart, Collapsible, Empty, Hover Card, Item, Popover, Progress, Scroll Area, Separator, Table, Tabs, Tooltip.

Do not import shadcn into the wireframe file. brainstorm.html remains plain HTML/CSS/vanilla JS.

## REPRESENTATIVE NORMAL DATA

Use internally consistent sample data such as:
- candidate Amina Yusuf / FST-02418 / SS2 Science;
- 50 questions / 60 minutes;
- 42m 18s active;
- score 72%;
- correct 36 / incorrect 12 / unanswered 2 / answered 48;
- completion 96%;
- pace 81;
- reasoning 76;
- Mathematics 78% (14/18, 17m06s);
- English 67% (10/15, 11m49s);
- Chemistry 71% (12/17, 13m23s).

Derived labels may include:
- strongest subject Mathematics;
- 17m42s remained;
- 96% complete.

## REPRESENTATIVE PLACEMENT DATA

Use a distinct but internally consistent placement example such as:
- score 84%;
- 42/50 correct;
- 8 incorrect;
- 0 unanswered;
- completion 100%;
- active time 46m 12s of 60m;
- pace 78;
- reasoning 88;
- Mathematics 90% (18/20);
- Basic Science 87% (13/15);
- English 70% (7/10);
- Social Studies 80% (4/5);
- assignedTrack Science;
- placement confidence 92%.

If showing “Promoted to SS3” or another promotion-only outcome, label the UI element **Future result contract**.

## OUTPUT QUALITY CHECK

Before finalizing:
- exactly 10 concept sections;
- every section has a functional result-mode switch;
- every switch changes content/hierarchy;
- every section includes at least one meaningful visual metric/chart;
- every section includes one academic achievement/milestone treatment;
- every section includes motion intent;
- every section shows exam/candidate context;
- all sample arithmetic reconciles;
- no answer key or rank leakage;
- no production source files changed.
