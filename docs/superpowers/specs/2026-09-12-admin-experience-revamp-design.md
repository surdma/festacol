# Festacol Prototype Architecture and Admin Experience Revamp Design

**Date:** 2026-09-12  
**Status:** Revision requested — awaiting product-owner approval  
**Repository baseline:** `master` at `43313acc38ba682a66bda3706ac444d905da7844`  
**Scope:** `/prototype` only

## 1. Purpose

Rebuild the Festacol prototype into a smaller, clearer browser-local application while delivering a complete teacher-facing administration experience.

This revision has two inseparable goals:

1. **Simplify the prototype runtime** so shared examination/domain behavior lives in one shared JavaScript file and each product surface has only one page-specific runtime.
2. **Completely revamp the administration experience** without losing any working student, examination, class, scoring, placement, rewrite, integrity, QR, Exam ID, camera, timeout, or WhatsApp behavior that already exists.

The resulting product must make this relationship explicit throughout the admin experience:

**Student → Examination → Exact Attempt → Score & subject results → Placement → Integrity log → Rewrite history → Reports/merit**

This remains a browser-local prototype. It is not a backend, authentication, database, deployment, or production security project.

---

## 2. Verified Repository Baseline

The design is based on the current repository, not on earlier conversational assumptions.

### 2.1 Current prototype surfaces

- `prototype/index.html` redirects to `student.html` while preserving the query string.
- `prototype/admin.html` is the administration shell.
- `prototype/student.html` is the student dashboard and contains additional inline Exam ID behavior.
- `prototype/exam.html` is the candidate examination workspace shell.

### 2.2 Current JavaScript fragmentation

The prototype currently ships eight runtime files:

1. `prototype/js/admin-app.js`
2. `prototype/js/assessment-engine.js`
3. `prototype/js/exam-app.js`
4. `prototype/js/proctor-policy.js`
5. `prototype/js/qr.js`
6. `prototype/js/question-data.js`
7. `prototype/js/session-store.js`
8. `prototype/js/student-dashboard.js`

The three product pages chain-load multiple shared scripts. This is unnecessary for a small static prototype and makes behavior ownership harder to reason about.

### 2.3 Current domain behavior that must survive consolidation

Repository inspection confirms the current shared runtime owns or supports:

- examination session encoding/decoding and legacy payload compatibility;
- current internal exam modes `qualifier`, `mixed`, `single`, and `waec`;
- session status, duration, question-count, integrity, and randomization settings;
- browser-local sessions, attempts, students, staff, classes, custom questions, and WhatsApp mappings;
- one current `classId` per student;
- one-attempt behavior unless an administrator authorizes a rewrite;
- unfinished-attempt reset;
- archived submitted attempts using `rewriteArchivedAt`;
- deterministic candidate-paper generation;
- scoring, subject statistics, placement, and integrity scoring;
- camera policy and Exam ID/session-link handling;
- QR generation;
- class WhatsApp group validation and mapping;
- student/exam/attempt relationship helpers.

### 2.4 Current question/scoring limitation

`prototype/data/questions.json` currently contains 43 seed questions. The current scoring answers for IDs 1–43 live separately inside `assessment-engine.js`. That split prevents the question editor from coherently updating both a question and its answer and makes a large scored question bank awkward to maintain.

### 2.5 Current automated browser test infrastructure

The repository currently contains Playwright-specific prototype infrastructure:

- `tests/prototype.spec.js`;
- `playwright.config.js`;
- `@playwright/test` in `package.json`;
- Playwright scripts in `package.json`;
- a `browser-e2e` Playwright job in `.github/workflows/prototype-ui.yml`.

The target design removes this Playwright layer. Browser validation moves to deliberate implementation-time dogfood with the current Dogfood/Chrome DevTools workflow, while deterministic source/state contracts remain lightweight Node scripts.

---

## 3. Target Runtime Architecture

The prototype target is **exactly four runtime JavaScript files**.

```text
prototype/
├── admin.html
├── student.html
├── exam.html
├── index.html
├── data/
│   └── questions.json
└── js/
    ├── shared.js
    ├── admin.js
    ├── student.js
    └── exam.js
```

No additional runtime JavaScript file should be introduced without an explicit architecture revision.

### 3.1 `shared.js`

`shared.js` owns reusable behavior needed by two or more prototype surfaces. It must not own admin/student/exam page rendering.

It exposes one frozen browser namespace:

```js
window.Festacol = Object.freeze({
  store,
  questions,
  assessment,
  proctor,
  qr,
  utils
});
```

Responsibilities consolidated into `shared.js`:

- session serialization/deserialization and compatibility;
- localStorage/sessionStorage access and normalization;
- sessions and status mutations;
- attempts, candidate state, rewrite/reset behavior;
- users/staff/classes and one-class-per-student rules;
- WhatsApp group persistence and URL validation;
- question loading, validation, eligibility, filtering, overrides, and custom questions;
- generic answer evaluation and scoring;
- deterministic paper allocation and randomization;
- student/candidate hashes and paper/attempt fingerprints;
- placement weighting and recommendations;
- integrity score helpers and normalized integrity events;
- proctor/camera policy persistence and URL decoration;
- QR generation;
- shared escaping, date/duration, clipboard/share, and URL helpers where genuinely reusable.

### 3.2 `admin.js`

`admin.js` owns only administration presentation and teacher interactions:

- URL/query-state routing;
- admin navigation;
- page rendering;
- Flowbite component lifecycle;
- students/staff/classes/questions/examinations/settings workflows;
- exam builder/edit/distribution;
- reports and charts;
- admin modals/popovers/toasts;
- browser-local question overrides and teacher authoring UI.

It consumes `window.Festacol` and must not duplicate domain rules already in `shared.js`.

### 3.3 `student.js`

`student.js` owns student-dashboard presentation and student entry interactions, including the Exam ID flow currently implemented partly inline in `student.html`.

Shared session lookup, candidate identity, URL decoration, storage, and scoring rules remain in `shared.js`.

### 3.4 `exam.js`

`exam.js` owns the candidate examination workspace:

- login/start gate;
- question navigation and responses;
- timer UI;
- camera UI;
- fullscreen/integrity interaction handling;
- review and submit UI;
- resume/recovery presentation;
- submitted/locked/result states.

Persistence, candidate/session normalization, scoring, question eligibility, integrity normalization, and QR/session helpers remain in `shared.js`.

### 3.5 Migration mapping

| Current file/behavior | Target owner |
| --- | --- |
| `session-store.js` | `shared.js` → `Festacol.store` |
| `proctor-policy.js` | `shared.js` → `Festacol.proctor` |
| `question-data.js` | `shared.js` → `Festacol.questions` |
| `assessment-engine.js` | `shared.js` → `Festacol.assessment` |
| `qr.js` | `shared.js` → `Festacol.qr` |
| `admin-app.js` | `admin.js` |
| `student-dashboard.js` | `student.js` |
| inline Exam ID script in `student.html` | `student.js` |
| `exam-app.js` | `exam.js` |

The old runtime files are deleted only after their consumers have been migrated and the behavior-preservation contract passes.

---

## 4. Compatibility Invariants

Runtime consolidation is a refactor, not permission to silently alter working academic behavior.

The following invariants are mandatory:

- Existing localStorage/sessionStorage keys continue to be read correctly or receive an explicit migration path.
- Existing v2/v3 encoded examination links remain decodable where the current runtime already supports them.
- Internal mode identifiers remain `qualifier`, `mixed`, `single`, and `waec` unless a separately approved migration changes them.
- `qualifier` remains restricted to incoming SS1 placement behavior internally.
- Question count remains 5–150.
- Duration remains 30 seconds–3 hours.
- Students have exactly one current `classId`.
- A candidate cannot normally take the same examination twice.
- `authorizeRewrite` archives the submitted attempt and enables a fresh attempt without destroying the archived score/integrity evidence.
- `resetUnfinishedAttempt` invalidates an unfinished attempt and clears its active candidate state.
- Structural paper fields become immutable once a candidate has started where current fairness behavior requires it.
- Exam ID entry resolves the same session as the QR/session URL.
- Required camera permission blocks examination start until granted.
- Timeout automatically submits and clears active candidate authentication.
- Background-time reconciliation remains functional.
- Tab/window and clipboard integrity events remain attributable to the exact attempt.
- WhatsApp class mappings remain one validated group per class.
- Delete-exam behavior may remove the session definition but must not erase retained attempt history.

---

## 5. Admin HTML Contract

The administration page is implemented through:

- `prototype/admin.html`;
- `prototype/js/shared.js`;
- `prototype/js/admin.js`.

There is **no Festacol CSS file loaded by `admin.html`**.

### 5.1 Required head setup

The supplied product styling block is a literal contract. The implementation uses this setup, with the one pinned-dependency correction described below:

```html
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&family=Manrope:wght@500;600;700;800&display=swap" rel="stylesheet">
<script src="https://cdn.jsdelivr.net/npm/@tailwindcss/browser@4"></script>
<link href="https://cdn.jsdelivr.net/npm/flowbite@4.0.1/dist/flowbite.min.css" rel="stylesheet" />
<script src="https://cdn.jsdelivr.net/npm/apexcharts@3.46.0/dist/apexcharts.min.js"></script>
<script src="https://cdn.jsdelivr.net/npm/simple-datatables@9.0.3"></script>
<style type="text/tailwindcss">@theme{--font-sans:"DM Sans",sans-serif;--font-display:"Manrope",sans-serif}html{scroll-behavior:smooth}body{background:#f6f6f7;color:#111}.sidebar-link[aria-current="page"]{background:#171717;color:#fff}.page-enter{animation:page-enter .18s ease-out}@keyframes page-enter{from{opacity:.25;transform:translateY(4px)}to{opacity:1;transform:none}}@media(prefers-reduced-motion:reduce){*{scroll-behavior:auto!important;animation:none!important;transition:none!important}}</style>
<style>:root{--line:#e5e5e5;--line-strong:#d4d4d4;--shadow:0 1px 2px rgba(0,0,0,.035),0 12px 32px rgba(0,0,0,.03)}.surface{background:#fff;border:1px solid var(--line);border-radius:1rem;box-shadow:var(--shadow)}.surface-flat{background:#fff;border:1px solid var(--line);border-radius:1rem}.metric-strip{display:grid;grid-template-columns:repeat(auto-fit,minmax(145px,1fr));background:#fff;border:1px solid var(--line);border-radius:1rem;overflow:hidden}.metric-strip>div{min-width:0;padding:14px 16px;border-right:1px solid var(--line)}.metric-strip>div:last-child{border-right:0}.icon-button{display:grid;width:40px;height:40px;place-items:center;border:1px solid var(--line);border-radius:.75rem;background:#fff}.icon-button:hover{background:#f5f5f5}.fb-icon{display:inline-block;width:18px;height:18px;flex:0 0 auto;color:currentColor}.sidebar-link .fb-icon{width:19px;height:19px;opacity:.82}.sidebar-link[aria-current="page"] .fb-icon{opacity:1}.admin-page button,.admin-page a,.admin-page input,.admin-page select,.admin-page textarea{transition:background-color .15s,border-color .15s,box-shadow .15s,transform .15s}.admin-page button:active,.admin-page a:active{transform:translateY(1px)}.admin-page input,.admin-page select,.admin-page textarea{border-radius:.75rem}.attention-row{display:flex;align-items:flex-start;gap:12px;padding:14px 16px}.attention-row+.attention-row{border-top:1px solid var(--line)}.control-row{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:12px 0}.control-row+.control-row{border-top:1px solid #f0f0f0}.queue-row{display:flex;align-items:center;gap:12px;padding:14px}.queue-row+.queue-row{border-top:1px solid var(--line)}.apexcharts-tooltip{border:1px solid #e5e5e5!important;box-shadow:0 12px 30px rgba(0,0,0,.08)!important}@media(max-width:900px){.metric-strip>div{border-right:0;border-bottom:1px solid var(--line)}.metric-strip>div:last-child{border-bottom:0}}@media(max-width:639px){.metric-strip{grid-template-columns:repeat(2,minmax(0,1fr))}.metric-strip>div:nth-child(odd){border-right:1px solid var(--line)}.metric-strip>div:last-child{border-right:0}}</style>
```

The generic unpinned `<script src="https://cdn.jsdelivr.net/npm/apexcharts"></script>` from the initial skeleton is intentionally replaced by the later explicit requirement for ApexCharts **3.46.0**. There must be only one ApexCharts script tag.

Load Flowbite JavaScript at the end of the document and then load exactly:

```html
<script src="./js/shared.js"></script>
<script src="./js/admin.js"></script>
```

### 5.2 Styling rules

- Use Tailwind CSS v4 utility classes as the default styling mechanism.
- Do not add a local admin stylesheet.
- Do not grow the supplied inline CSS into a second hidden stylesheet; add only a narrowly justified browser primitive when no Tailwind/Flowbite utility can express it.
- Use the black/white/neutral product direction as primary visual language.
- Use color semantically for status, not as the primary layout language.

---

## 6. Flowbite-First Component Policy

Before implementing a common control, check `https://flowbite.com/docs/components/` and use/adapt the matching Flowbite pattern instead of reimplementing a generic component.

Required component mapping:

| Product need | Flowbite pattern |
| --- | --- |
| Navigation | Sidebar, Navbar, Breadcrumb |
| Primary/secondary actions | Buttons, Button Group |
| Metrics/content grouping | Card, Badge, List Group |
| Forms | Input Field, Select, Textarea, Checkbox, Radio, Toggle, Range |
| Builder progression | Stepper |
| Record detail/edit/confirm | Modal |
| Notification/context help | Popover, Dropdown, Tooltip |
| Feedback | Alert, Toast, Spinner, Skeleton, Progress |
| Page subsections | Tabs |
| Large record sets | Tables + Simple-DataTables |
| URL copy | Clipboard pattern |
| Distribution | QR Code pattern plus application QR helper |
| Analytics | ApexCharts using Flowbite chart guidance |

### 6.1 Icon policy

Interface icons must come from `https://flowbite.com/icons/`.

Implementation subplan:

1. Identify the semantic icon name needed, e.g. `copy`, `share`, `bell`, `users`, `chart`, `edit`, `trash`, `check-circle`.
2. Fetch/copy the matching Flowbite SVG path rather than guessing an icon path.
3. Keep one consistent outline/solid family per context.
4. Icon-only buttons require an accessible name at the button level.
5. Do not introduce emoji as interface icons.

### 6.2 Modal policy

- Do not use record-detail side drawers/sheets.
- Use Flowbite modal structure/API for create/edit/detail/confirm experiences that belong in an overlay.
- Use centered or appropriate bounded modal placement, not a side panel disguised as a modal.
- Backdrop must visually de-emphasize the page and include blur, e.g. a dynamic Flowbite backdrop using classes equivalent to `fixed inset-0 z-40 bg-gray-900/50 backdrop-blur-sm`.
- Modal content must fit inside mobile/tablet/desktop viewport heights with an internal content scroller only where required.
- Escape/backdrop close behavior is enabled unless the action is deliberately non-dismissible.
- Focus returns to the originating control.

### 6.3 Popover policy

Notifications and short contextual information use Flowbite Popover/Dropdown behavior relative to their trigger.

The notification panel:

- is anchored beside/below the notification button;
- never appears in the center of the viewport;
- closes on outside interaction/Escape;
- has bounded width on mobile;
- shows actionable items rather than generic decorative notifications.

### 6.4 Tables and charts

- Initialize large/filter-heavy tables using Simple-DataTables 9.0.3 where its sort/search/pagination behavior adds value.
- Use responsive card fallbacks when a desktop table would become unusable on a narrow screen.
- Use ApexCharts 3.46.0 only for real derived analytics.
- Charts require titles, labels/tooltips, readable legends where applicable, and accompanying numerical summaries; color alone cannot encode meaning.

---

## 7. Admin Information Architecture

Top-level teacher-facing routes:

1. **Overview**
2. **Students**
3. **Staff**
4. **Examinations**
5. **Classes**
6. **Question Bank**
7. **Reports**
8. **Settings**

`?page=users` remains a compatibility alias that redirects/replaces to `?page=students` rather than breaking old bookmarks.

Students and Staff are never mixed in one directory or report table.

---

## 8. Query-Parameter Navigation Contract

URL state is the source of truth for meaningful admin navigation.

Examples:

```text
admin.html?page=students
admin.html?page=students&student=ST-2401&tab=exams
admin.html?page=staff
admin.html?page=exams&exam=ABC123&tab=candidates
admin.html?page=classes&class=ss2-science
admin.html?page=questions&level=SS2&pathway=Science&subject=chem
admin.html?page=reports&view=class&class=ss2-science
admin.html?page=reports&view=student&student=ST-2401
admin.html?page=reports&view=integrity&attempt=<attemptHash>
```

Modal examples:

```text
modal=create-exam
modal=edit-exam&exam=ABC123
modal=attempt&attempt=<attemptHash>
modal=edit-question&question=204
modal=class&class=ss2-science
```

Rules:

- one central parser normalizes page/filter/deep-record/modal state;
- one central URL builder performs navigation;
- opening a deep modal pushes meaningful history;
- closing removes only overlay-specific parameters and preserves filters/page state;
- Back/Forward restores the correct page, tab, record, and modal;
- invalid IDs resolve to the parent view with a non-blocking teacher-facing message, not a blank modal;
- builder step state can use `step=` when this improves restore/back behavior.

---

## 9. Overview

The Overview is an operations dashboard, not a collection of generic cards.

It should surface:

- active/open examinations;
- active candidate attempts;
- submissions requiring review;
- integrity exceptions;
- entrance-placement capacity attention;
- recent results;
- concise school/class performance indicators derived from real attempts.

Use the supplied metric strip pattern and an attention queue. One useful chart is preferable to several decorative charts.

---

## 10. Students

Students are the center of the academic relationship model.

### 10.1 Directory

Support:

- name/student-ID search;
- level filter;
- class/pathway filter;
- account status;
- performance/placement state when derivable.

Each student has exactly one current class assignment. Moving a student replaces `classId`; there is no multi-class pathway picker.

### 10.2 Student profile/deep view

The profile must connect:

- identity/account status;
- current class and pathway;
- examination history;
- exact attempts per examination;
- submitted score and subject statistics;
- current/unfinished attempt when present;
- placement recommendation/result when present;
- integrity summary;
- exact event log by attempt;
- rewrite history;
- merit/ranking context where meaningful.

Actions include edit profile/class and suspend/activate account. Destructive deletion, if retained, must be clearly distinguished from suspension and must not silently orphan attempt history.

---

## 11. Staff

Staff is separate from Students.

Display only `teacher` and `administrator` records. Provide add/edit/status controls appropriate to the prototype.

Do not show student score, merit, placement, or exam-attempt columns as staff attributes.

---

## 12. Classes and Pathways

Organize actual senior classes by level first, then pathway/group:

- SS1;
- SS2;
- SS3;

and within each level where applicable:

- Science;
- Arts;
- Social Science;
- General/other configured group.

Each class view shows:

- class name/level;
- pathway/group;
- capacity;
- current occupancy derived from student `classId`;
- remaining places;
- room/location;
- current students;
- WhatsApp group mapping and QR;
- class performance deep link.

### 12.1 Class safety rules

- A student cannot simultaneously belong to Science, Arts, and Social Science classes.
- Reassignment is an explicit move.
- Delete class is disabled/rejected while students are assigned; the UI tells the administrator to move students first.
- WhatsApp links must retain current secure host validation.
- Add/edit/delete WhatsApp group behavior and QR rendering are preserved.

### 12.2 Entrance candidate pool

The internal legacy `ss1-qualifier` staging record is not presented as a normal classroom. Entrance candidates belong to the admissions/placement workflow until assigned to an actual SS1 class.

---

## 13. SS1 Entrance & Placement Exam

Teacher-facing name: **SS1 Entrance & Placement Exam**.

Internal compatibility mode: `qualifier`.

Purpose: assess incoming JSS3/BECE-level applicants and recommend a suitable SS1 pathway based on foundational performance.

### 13.1 Lighter builder path

Entrance creation should avoid irrelevant class-assessment configuration. Required setup:

1. admission session/title;
2. eligible pathways;
3. question count and duration;
4. integrity/camera controls;
5. review/publish.

Entrance subject coverage uses the `q-*` foundational domains.

### 13.2 Capacity and placement

For Science, Arts, and Social Science show:

- configured class capacity;
- current enrolled occupancy;
- places remaining;
- number recommended by entrance results;
- number already placed/assigned;
- candidates awaiting placement.

A candidate not recommended for Science is not automatically a failure. If the placement engine recommends Arts or Social Science, show that recommendation. A generic pass/fail label requires an explicit academic threshold rule and must not be invented by the UI.

---

## 14. Examination Management

### 14.1 List

Filters:

- search by title/Exam ID;
- status;
- level;
- purpose/type;
- class/pathway;
- subject where relevant.

Each record exposes title, intended audience, coverage, question count, duration, candidate/submission counts, status, and detail navigation.

### 14.2 Detail structure

Design around four teacher jobs:

1. **Distribute** — QR, Exam ID, Copy address, Share examination.
2. **Control** — status, delivery settings, integrity/camera settings.
3. **Monitor** — candidates, active/unfinished attempts.
4. **Review** — submissions, scores, merit, integrity, rewrites, analytics.

Preserve:

- close/reopen;
- duplicate as draft;
- delete session definition while retaining attempts;
- reset unfinished attempt;
- authorize rewrite;
- archived attempt history;
- edit settings with structural locking after a candidate starts.

### 14.3 Distribution

Keep QR and Exam ID prominent.

Add:

- a Flowbite copy/clipboard control labelled **Copy address**;
- a **Share examination** action using `navigator.share` when available;
- clipboard fallback when Web Share is unavailable;
- nontechnical success/error feedback.

Do not render a giant raw URL text field just to make the link copyable.

### 14.4 Edit examination redesign

Use a structured Flowbite modal/page composition with sections such as:

- Examination identity;
- Audience & coverage;
- Paper settings;
- Delivery window/status;
- Integrity & camera;
- Candidate instructions.

Locked structural fields show an explanation such as “Locked because a candidate has already started this paper.” Do not rely on disabled controls without context.

---

## 15. Examination Builder

Use a high-quality five-stage Flowbite Stepper with clear active/completed state, sticky footer actions where useful, meaningful transitions, and reduced-motion support.

### Stage 1 — Purpose & Audience

Teacher chooses:

- SS1 Entrance & Placement Exam;
- Class Assessment;
- External Exam Practice.

Class Assessment resolves internally to single/mixed mode based on coverage. External Exam Practice uses the existing compatible `waec` internal mode unless a separately approved mode migration occurs.

### Stage 2 — Coverage

- level/class/pathway where applicable;
- compatible subjects only;
- pathway-aware subject availability;
- entrance placement pathways;
- live available-question count.

### Stage 3 — Paper

- duration range: 30 seconds–3 hours;
- question-count range: 5–150 and never above current eligible inventory;
- visible selected value and useful min/max context;
- candidate instructions.

### Stage 4 — Integrity & Delivery

- tab/window monitoring;
- fullscreen prompt;
- clipboard guard;
- warn-after threshold;
- candidate camera requirement;
- initial status/schedule where current contract supports it.

### Stage 5 — Review & Publish

Show a readable summary of audience, coverage, question inventory, duration, integrity controls, and status before saving. Success transitions immediately to distribution with QR/Exam ID/copy/share actions.

### 15.1 Selection controls

Selection cards/buttons use circular selected indicators/checks and proper radio/checkbox semantics. Do not build click-only divs that imitate controls without accessibility semantics.

### 15.2 Inventory safety

The builder cannot publish a requested count greater than the number of eligible questions after level/pathway/subject/mode filtering.

---

## 16. Question Bank and 500-Question Target

The revised plan brings the expanded bank into scope.

Target: **approximately 500 validated seed questions** with enough distribution that the builder can assemble meaningful papers across supported routes.

### 16.1 Academic alignment

Entrance items:

- JSS3/BECE-level foundational readiness for incoming SS1;
- English Studies;
- Mathematics Aptitude;
- Basic Science & Technology;
- Social & Citizenship Studies;
- Business Studies;
- Digital Technologies.

Senior items:

- SS1 questions match SS1 curriculum readiness;
- SS2 questions may build on SS1 but cannot assume SS3-only coverage;
- SS3/external-practice items can use WAEC/NECO/JAMB-style senior-secondary rigor where academically appropriate;
- a lower class must not receive an item tagged only for a higher class;
- Science-only subjects/items are not routed to Arts/Social Science unless the subject is genuinely common;
- common/core subjects may be shared across pathways when their `levels`/`pathways` metadata allows it.

### 16.2 Question schema

Seed and teacher-authored records should support:

```js
{
  id,
  subject,
  subjectCode,
  domain,
  levels,
  pathways,
  examModes,
  type,
  difficulty,
  label,
  prompt,
  options,
  requiredSelections,
  fillTemplate,
  answer,
  answers,
  acceptedAnswers,
  explanation
}
```

Only fields relevant to a question type are populated.

Suggested answer contract:

- single choice: `answer` string;
- boolean: `answer` boolean;
- multiple choice: `answers` array;
- fill/fill-multi: normalized `acceptedAnswers` data.

The generic scorer reads the answer definition from the question record rather than a hardcoded ID→answer table.

Because this is a browser-local prototype, these answers are inspectable by a determined user. The UI must not describe the client-side answer bank as a security boundary.

### 16.3 Question overrides and authoring

A static browser page cannot rewrite `questions.json` at runtime. Therefore “Edit question” means:

- seed questions remain in `questions.json`;
- edits to a seed question are stored as a browser-local override keyed by question ID;
- `shared.js` merges overrides over seed records when loading the bank;
- the administrator can reset an override to restore the seed version;
- new teacher-authored questions are stored locally with unique IDs;
- the editor updates both question content and answer definition coherently.

### 16.4 Question Bank UI

Advanced filters:

- search;
- level;
- pathway/category;
- subject;
- domain/topic;
- response type;
- difficulty;
- exam purpose/mode;
- seed/edited/teacher-authored source.

Question detail/editor supports:

- prompt and metadata;
- options/blank structure;
- answer editing;
- admin-only **Reveal answer** action;
- explanation/teacher note where present;
- duplicate/create;
- delete teacher-authored item;
- reset seed override;
- compatibility preview showing which levels/pathways/exam purposes can receive the question.

Always report the actual loaded/valid question count. Never display “500 questions” unless the loaded bank really satisfies that count.

---

## 17. Integrity and Attempt Model

Integrity belongs to an exact attempt, not merely to a student or examination summary.

Attempt detail shows:

- candidate/student;
- examination;
- started/submitted timestamps;
- score/completion;
- subject statistics;
- placement result where applicable;
- integrity score;
- chronological integrity/proctor log;
- submission reason;
- rewrite/archive relationship.

Relevant event types remain readable in teacher language while preserving exact stored type for debugging/traceability, e.g. window/tab leave, clipboard copy/paste, fullscreen exit, camera issues where recorded.

Submitted attempts remain immutable evidence. Authorize Rewrite creates a new opportunity while retaining the archived prior result.

---

## 18. Reports and Analytics

Reporting uses real class/session/attempt data only.

Primary views:

### 18.1 Class performance

- class mean/median where enough data exists;
- participation/submission count;
- subject performance;
- distribution/trend chart where meaningful;
- student drill-down.

### 18.2 Pathway/category performance

- Science vs Arts vs Social Science using actual enrolled class assignments;
- participation and average performance;
- no comparison when the underlying data does not support it.

### 18.3 Examination performance

- submissions;
- score distribution;
- subject performance;
- merit/ranking;
- integrity exceptions;
- candidate drill-down.

### 18.4 Individual student performance

- exam history;
- scores/subject stats;
- performance trend;
- merit placement within comparable exam/class context;
- integrity history linked to exact attempts.

### 18.5 Entrance placement

- pathway capacity;
- recommendations;
- placed vs awaiting placement;
- candidate drill-down to exact entrance attempt.

### 18.6 Integrity

- event count by type;
- attempts with exceptions;
- student/exam filters;
- direct link to the exact attempt log.

A chart must always lead back to the underlying student/exam/attempt records.

---

## 19. Settings and Data Management

Settings keeps prototype-only management separate from academic pages.

Preserve granular clear controls for:

- sessions/examinations;
- attempts;
- WhatsApp mappings;
- locally authored/overridden questions;
- student runtime state where the current store supports it;
- full browser-local reset.

Destructive actions require explicit confirmation and explain which records will remain or be removed.

---

## 20. Playwright Removal and Validation Strategy

Playwright is removed from the prototype target architecture.

Remove:

- `tests/prototype.spec.js`;
- `playwright.config.js`;
- `@playwright/test` dependency;
- `test:e2e` / `test:e2e:report` scripts;
- the Playwright browser job in `.github/workflows/prototype-ui.yml`.

Do **not** compensate by deleting behavioral expectations from the engineering process.

### 20.1 Permanent lightweight contracts

Keep/update:

- `scripts/prototype-audit.mjs` — source/runtime architecture, required CDN/head tokens, forbidden legacy runtime/CSS layers, question-bank/schema sanity;
- `scripts/state-contract.mjs` — executable shared-domain contract for session compatibility, paper allocation, scoring, placement, attempts, rewrite/reset, class/WhatsApp/question-override behavior.

`package.json` should expose a simple `check` command running JavaScript syntax validation plus these two Node contracts. No browser-testing package is required.

### 20.2 CI

`.github/workflows/prototype-ui.yml` becomes a lightweight source/domain contract workflow only. It should:

- `node --check` the four target runtime files and contract scripts;
- run `npm run audit:prototype`;
- run `npm run test:contract` or the consolidated `npm run check`;
- not install Playwright or browser binaries.

### 20.3 Required implementation-time dogfood

Meaningful implementation cannot be declared complete from Node checks alone.

The Integration/Dogfood Engineer must use the browser directly (Dogfood/Chrome DevTools workflow) and exercise the real static prototype at minimum at:

- 390×844 mobile;
- 820×1000 tablet;
- 1440×1000 desktop.

Core manual browser acceptance journeys are listed in Section 22.

---

## 21. Responsive and Accessibility Requirements

- no page-level horizontal overflow;
- touch targets approximately 44×44 px or larger for important controls;
- mobile tables collapse or transform into understandable cards where necessary;
- dialogs stay inside viewport bounds;
- focus rings remain visible;
- keyboard order follows visual order;
- icon-only controls have accessible names;
- labels are visible, not placeholder-only;
- error messages appear next to the relevant action/field;
- reduced-motion setting disables nonessential animation;
- status is not communicated by color alone;
- deep pages/modals have an obvious back/close path;
- charts have textual summaries.

---

## 22. Manual Browser Acceptance Matrix

The implementation is not Integration Verified until the following real workflows are exercised.

### Admin shell/navigation

- eight top-level routes render;
- `?page=users` resolves to Students;
- browser Back/Forward restores deep views and modals;
- notification popover opens beside the bell, never centered;
- modal backdrop visibly dims/blurs the page;
- no record-detail side drawer exists;
- no admin local CSS file is loaded.

### Students/Staff

- students never appear in Staff;
- staff never appear in Students;
- student profile reaches exact examination/attempt;
- suspend/activate works;
- moving class results in one current class only.

### Classes/WhatsApp

- classes grouped by level/pathway;
- capacity/occupancy/remaining values are coherent;
- assigned-student class cannot be deleted;
- empty class can be deleted;
- WhatsApp valid link saves and renders QR;
- invalid non-WhatsApp link is rejected.

### Examination creation/distribution

- five-step builder completes normal class assessment;
- Entrance Exam uses lighter entrance flow;
- incompatible class/pathway/subject questions are excluded;
- count cannot exceed eligible inventory;
- camera/integrity options persist;
- success displays QR + Exam ID + Copy address + Share examination;
- share fallback copies address when Web Share is unavailable.

### Examination management

- edit layout is understandable;
- structural fields lock after candidate start;
- safe delivery settings remain editable;
- close/reopen works;
- duplicate-as-draft works;
- delete definition retains attempt history;
- reset unfinished attempt works;
- authorize rewrite archives old submitted attempt and allows a new one.

### Student/Exam journey

- Exam ID reaches the same candidate login session as QR link;
- candidate can start a normal exam;
- required camera denial blocks start and retry can recover;
- answers persist/resume;
- tab/window and clipboard events attach to the attempt;
- timeout auto-submits and clears active auth;
- normal submitted attempt cannot be retaken without rewrite authorization.

### Question Bank

- actual inventory count is displayed;
- advanced filters work together;
- seed answer can be revealed by admin;
- seed question edit persists as override;
- reset override restores seed;
- teacher-authored question/answer can be created, edited, and removed;
- scoring uses edited/created answer data correctly;
- lower-level/pathway-incompatible questions never appear in an eligible paper.

### Reports

- class, pathway, examination, student, merit, entrance-placement, and integrity views use real attempts;
- chart/table drill-down resolves to exact student/exam/attempt;
- integrity report shows exact stored events;
- entrance recommendations and assigned pathway/slots agree with source records.

---

## 23. Explicitly Preserved Existing Features

The revamp must not accidentally remove the following capabilities:

- Exam ID manual entry;
- QR examination distribution;
- clean link copy/share;
- camera requirement and preview/retry;
- focus/fullscreen/clipboard integrity controls;
- background-time reconciliation and timeout auto-submit;
- deterministic/randomized candidate papers;
- one-attempt rule;
- unfinished-attempt reset;
- submitted-attempt rewrite authorization with archive preservation;
- exam close/reopen;
- duplicate exam as draft;
- delete session definition without deleting historical attempts;
- structural edit locking after candidate start;
- student add/edit/suspend/activate;
- staff add/edit/status management;
- class add/edit/safe delete;
- class WhatsApp group add/edit/delete/QR;
- granular local data clearing;
- student current class, exam history, result, placement, integrity, and rewrite drill-down;
- responsive mobile navigation;
- query-addressable admin deep pages.

---

## 24. Out of Scope

- production authentication/authorization;
- server-side answer security;
- database persistence;
- backend APIs;
- real camera video recording/storage;
- remote proctoring;
- parent/teacher messaging backend;
- production WhatsApp API integration;
- automated Playwright/browser test infrastructure;
- deployment changes unrelated to serving this static prototype.

---

## 25. Acceptance Criteria

The design is satisfied only when all of the following are true:

1. Prototype runtime is reduced from eight JS files to exactly `shared.js`, `admin.js`, `student.js`, and `exam.js`.
2. Shared domain behavior is centralized rather than duplicated across page runtimes.
3. Existing encoded/local browser state remains compatible with the current supported contracts.
4. `admin.html` loads no Festacol CSS file and uses the specified Tailwind/Flowbite/head contract.
5. ApexCharts is pinned to 3.46.0 and Simple-DataTables to 9.0.3.
6. Standard controls use Flowbite patterns and icons come from Flowbite Icons.
7. Students and Staff are separate admin areas.
8. Classes enforce one current class per student and safe deletion.
9. SS1 Entrance & Placement Exam is teacher-facing while `qualifier` remains internal compatibility terminology.
10. Entrance pathway capacity, recommendation, placement, and waiting states are visible without inventing unsupported failure rules.
11. Examination builder/edit/detail/distribution are fully redesigned while retaining the existing functional purpose and fairness locks.
12. QR, Exam ID, Copy address, and Share examination all work.
13. Question Bank supports real answer-aware editing/reveal plus level/pathway/subject/domain/type/difficulty filters.
14. The seed bank reaches the approved ~500-question target with class/pathway eligibility that prevents inappropriate questions from routing to students.
15. Scoring is generic from question answer metadata rather than a hardcoded 1–43 answer map.
16. Student → exam → exact attempt → score/placement/integrity/rewrite deep links work throughout reports.
17. Class, pathway, exam, individual student, merit, entrance-placement, and integrity reports use real data.
18. Existing candidate camera, resume, timeout, integrity, rewrite/reset, and one-attempt workflows still work.
19. Playwright/config/browser CI is removed; Node source/state contracts remain green.
20. Independent review finds no blocking regression and manual Dogfood verifies the real browser workflows across mobile, tablet, and desktop.

Until the product owner approves this revised specification, production implementation should not begin.
