# Festacol Prototype Architecture and Admin Experience Revamp Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Consolidate the Festacol prototype to four JavaScript runtimes and deliver the complete teacher-facing admin revamp without regressing student or examination behavior.

**Architecture:** Replace the current eight-file runtime with `shared.js`, `admin.js`, `student.js`, and `exam.js`. `shared.js` owns cross-page domain/state/scoring/question/proctor/QR behavior through one `window.Festacol` namespace; page runtimes own only their respective DOM and interaction concerns. Remove Playwright from the prototype and retain lightweight Node source/state contracts plus mandatory browser dogfood before Git handoff.

**Tech Stack:** Static HTML, vanilla JavaScript, browser localStorage/sessionStorage, Tailwind CSS browser v4, Flowbite 4.0.1, Flowbite Icons, ApexCharts 3.46.0, Simple-DataTables 9.0.3, Node.js source/state contract scripts.

**Spec:** `docs/superpowers/specs/2026-09-12-admin-experience-revamp-design.md`

## Global Constraints

- Scope is `/prototype` and prototype-specific validation/CI only.
- Target runtime is exactly `prototype/js/shared.js`, `prototype/js/admin.js`, `prototype/js/student.js`, and `prototype/js/exam.js`.
- `admin.html` loads no Festacol CSS file.
- `admin.html` loads only `shared.js` and `admin.js` as local runtime scripts.
- Use Tailwind CSS browser v4 and Flowbite 4.0.1; do not reimplement standard Flowbite components.
- Interface SVGs come from Flowbite Icons; do not guess icon paths.
- ApexCharts is exactly `https://cdn.jsdelivr.net/npm/apexcharts@3.46.0/dist/apexcharts.min.js`.
- Simple-DataTables is exactly `https://cdn.jsdelivr.net/npm/simple-datatables@9.0.3`.
- Preserve internal mode identifiers `qualifier`, `mixed`, `single`, and `waec` and current supported session-link compatibility.
- Teacher-facing terminology uses **SS1 Entrance & Placement Exam**, never “Qualifier” as the main UI term.
- Session duration remains 30 seconds–3 hours; question count remains 5–150 and never exceeds eligible inventory.
- A student has exactly one current `classId`.
- Existing one-attempt, reset, rewrite/archive, camera, Exam ID, QR, timeout, integrity, and WhatsApp behavior must survive consolidation.
- Record detail/edit/report workflows must not use side drawers.
- Notifications use an anchored Flowbite Popover/Dropdown beside the bell trigger.
- Query parameters drive meaningful page, tab, record, filter, report, modal, and builder-step state.
- Question scoring reads answer metadata from question records; do not keep a hardcoded ID→answer table.
- Seed bank target is at least 500 validated questions unless the product owner explicitly revises that target before execution.
- Playwright, `playwright.config.js`, `tests/prototype.spec.js`, Playwright package scripts/dependency, and browser CI are removed.
- Permanent automated validation is Node/source/state-contract based; browser behavior is validated by mandatory Dogfood/Chrome DevTools execution.
- Only Git/Release performs final commit/push/PR operations after validation gates; do not commit broken intermediate refactors.

---

## Target File Map

### Runtime files

- `prototype/js/shared.js`
  - storage/state normalization;
  - sessions and encoded payload compatibility;
  - users/staff/classes/WhatsApp;
  - question loading/validation/eligibility/overrides;
  - paper allocation/randomization;
  - scoring/subject stats/placement;
  - integrity/proctor/camera policy;
  - QR generation;
  - shared utilities.

- `prototype/js/admin.js`
  - admin URL state/router;
  - Flowbite component lifecycle;
  - Overview, Students, Staff, Examinations, Classes, Question Bank, Reports, Settings;
  - exam builder/edit/distribution;
  - charts/data tables.

- `prototype/js/student.js`
  - student dashboard rendering;
  - Exam ID modal/form;
  - student-facing navigation/interactions.

- `prototype/js/exam.js`
  - candidate login/start;
  - camera gate/preview;
  - exam workspace/questions/timer;
  - integrity listeners;
  - resume/reconcile/submit/result UI.

### Data

- `prototype/data/questions.json`
  - at least 500 validated seed questions;
  - answer metadata per response type;
  - level/pathway/mode/difficulty/domain metadata.

### HTML

- `prototype/admin.html`
- `prototype/student.html`
- `prototype/exam.html`
- `prototype/index.html` — retain simple redirect to `student.html`.

### Permanent validation

- `scripts/prototype-audit.mjs`
- `scripts/state-contract.mjs`
- `package.json`
- `.github/workflows/prototype-ui.yml`

### Files removed after successful migration

- `prototype/js/admin-app.js`
- `prototype/js/assessment-engine.js`
- `prototype/js/exam-app.js`
- `prototype/js/proctor-policy.js`
- `prototype/js/qr.js`
- `prototype/js/question-data.js`
- `prototype/js/session-store.js`
- `prototype/js/student-dashboard.js`
- `tests/prototype.spec.js`
- `playwright.config.js`

---

## Task 1: Convert Existing Behavior Into a Non-Playwright Preservation Contract

**Files:**
- Modify: `scripts/prototype-audit.mjs`
- Modify: `scripts/state-contract.mjs`
- Read: all current prototype HTML/JS files
- Read: `tests/prototype.spec.js`

**Interfaces:**
- Consumes: current runtime behavior and scenarios encoded in the existing Playwright suite.
- Produces: executable source/state contracts and the manual browser acceptance matrix in the design spec.

- [ ] **Step 1: Inventory every current shared method and consumer before refactoring**

Search all HTML, runtime JS, Node contracts, and the Playwright suite for current `FestacolSessionStore`, `FestacolQuestionData`, `FestacolAssessmentEngine`, `FestacolProctorPolicy`, and `FestacolQR` calls. Produce a working mapping from each method to its target `Festacol.store`, `.questions`, `.assessment`, `.proctor`, `.qr`, or `.utils` owner.

Acceptance: no legacy export is deleted until every repository consumer has a target mapping.

- [ ] **Step 2: Stage the final four-runtime source contract in `prototype-audit.mjs`**

The final runtime assertion is:

```js
const requiredRuntime = [
  'prototype/js/shared.js',
  'prototype/js/admin.js',
  'prototype/js/student.js',
  'prototype/js/exam.js'
];
for (const file of requiredRuntime) {
  if (!fs.existsSync(path.join(root, file))) throw new Error(`Missing target prototype runtime: ${file}`);
}
```

Keep this final assertion disabled only while consumers are being migrated; activate it atomically in Task 12 when all four files are live.

- [ ] **Step 3: Define the final admin head/source assertions**

The final audit must require:

```js
for (const token of [
  '@tailwindcss/browser@4',
  'flowbite@4.0.1/dist/flowbite.min.css',
  'apexcharts@3.46.0/dist/apexcharts.min.js',
  'simple-datatables@9.0.3',
  './js/shared.js',
  './js/admin.js'
]) {
  if (!adminHtml.includes(token)) throw new Error(`Admin shell missing ${token}`);
}
```

It must reject local admin CSS links and all old admin runtime script tags.

- [ ] **Step 4: Expand `state-contract.mjs` with one-class and retained-history assertions**

Keep current session migration/round-trip, deterministic paper, scoring, integrity, rewrite, reset, student relationship, and WhatsApp assertions. Add a one-class assertion by saving one known student with a different `classId` and verifying the stored record contains one class value, not an array or multiple memberships.

Also assert that deleting a session definition does not remove already-recorded attempts for that session ID.

- [ ] **Step 5: Preserve current browser scenarios as mandatory Dogfood scenarios**

Carry these old Playwright expectations into the manual acceptance matrix without weakening them:

- admin navigation and no horizontal overflow;
- Exam ID login;
- camera denial/retry;
- timeout auto-submit and auth cleanup;
- rewrite archive plus fresh attempt;
- structural edit locks;
- WhatsApp valid/invalid URL handling;
- exact integrity-event drill-down;
- modal viewport containment;
- mobile navigation and touch-friendly record presentation.

- [ ] **Step 6: Execute the current baseline before production mutation**

Run:

```bash
npm run check
node --check tests/prototype.spec.js
```

Expected: the current source/state contracts and Playwright source syntax pass before consolidation begins. If a task-related failure exists, classify and resolve or record it before continuing.

---

## Task 2: Consolidate Shared Domain Logic Into `shared.js`

**Files:**
- Create: `prototype/js/shared.js`
- Modify: `scripts/state-contract.mjs`
- Read/migrate from: `session-store.js`, `proctor-policy.js`, `question-data.js`, `assessment-engine.js`, `qr.js`

**Interfaces:**
- Produces: `window.Festacol = Object.freeze({ store, questions, assessment, proctor, qr, utils })`.
- Consumed later by: `admin.js`, `student.js`, `exam.js`.

The exact public module ownership is:

```text
Festacol.store       persistence, sessions, attempts, users, classes, WhatsApp, overrides
Festacol.questions   loading, validation, merge, subject lookup, eligibility
Festacol.assessment  identity hashes, paper allocation, scoring, placement, integrity score
Festacol.proctor     camera/integrity policy and decorated candidate-link behavior
Festacol.qr          QR SVG generation/rendering
Festacol.utils       pure shared formatting/escaping/clipboard/URL helpers
```

- [ ] **Step 1: Move storage/session/attempt/user/class/WhatsApp logic without changing storage keys**

Preserve the current keys, payload version handling, v2/v3 decode behavior, normalization, and semantics for session, attempt, rewrite/reset, active-candidate, student-auth, class, user, and WhatsApp operations.

- [ ] **Step 2: Move proctor policy into `Festacol.proctor`**

Preserve camera-required and integrity-policy storage semantics and current candidate-link decoration behavior.

- [ ] **Step 3: Move QR behavior into `Festacol.qr`**

Preserve SVG output used by exam distribution and WhatsApp QR display.

- [ ] **Step 4: Move current assessment behavior into `Festacol.assessment` before changing the answer model**

Move candidate/student hashing, deterministic randomization, paper fingerprint, attempt hash, score result construction, integrity scoring, and placement weighting without changing current outcomes.

- [ ] **Step 5: Move current question loading/eligibility into `Festacol.questions`**

Preserve subject catalogue, level/mode eligibility, interleaving, question lookup, and current custom-question merge behavior until Task 5 upgrades the schema.

- [ ] **Step 6: Point `state-contract.mjs` to `shared.js` only**

Load one runtime in the VM and bind the submodules:

```js
vm.runInContext(
  fs.readFileSync(new URL('../prototype/js/shared.js', import.meta.url), 'utf8'),
  ctx,
  { filename: 'shared.js' }
);
const S = ctx.Festacol.store;
const A = ctx.Festacol.assessment;
const Q = ctx.Festacol.questions;
```

- [ ] **Step 7: Execute the shared contract**

```bash
node --check prototype/js/shared.js
node scripts/state-contract.mjs
```

Expected: the existing state/session/assessment behavior passes before any page runtime is switched to the new namespace.

---

## Task 3: Migrate the Student Surface to `student.js`

**Files:**
- Create: `prototype/js/student.js`
- Modify: `prototype/student.html`
- Read/migrate from: `prototype/js/student-dashboard.js`
- Read/migrate from: inline Exam ID script in `student.html`

**Interfaces:**
- Consumes: `window.Festacol`.
- Produces: student dashboard and Exam ID interactions with no additional local runtime dependency.

- [ ] **Step 1: Move all student-dashboard DOM/render logic into `student.js`**

At the top of `student.js`, fail fast if shared dependencies are unavailable and bind only the modules actually used:

```js
const { store, assessment, proctor, utils } = window.Festacol || {};
if (!store || !assessment || !proctor || !utils) throw new Error('Festacol student dependencies are unavailable.');
```

- [ ] **Step 2: Move the inline Exam ID modal/form behavior into `student.js`**

Preserve case-insensitive lookup, missing/draft/closed session messaging according to current rules, decorated candidate link behavior, and modal Escape/backdrop/focus restoration.

- [ ] **Step 3: Simplify local script loading in `student.html`**

Final local runtime sequence:

```html
<script src="./js/shared.js"></script>
<script src="./js/student.js"></script>
```

Flowbite CDN remains before these local scripts.

- [ ] **Step 4: Execute syntax checks**

```bash
node --check prototype/js/shared.js
node --check prototype/js/student.js
```

- [ ] **Step 5: Focused browser smoke**

Serve the repository and verify the student dashboard renders, the Exam ID modal opens/closes, and a known open session ID reaches the same exam login URL as the session link.

---

## Task 4: Migrate the Candidate Examination Surface to `exam.js`

**Files:**
- Create: `prototype/js/exam.js`
- Modify: `prototype/exam.html`
- Read/migrate from: `prototype/js/exam-app.js`

**Interfaces:**
- Consumes: `Festacol.store`, `.questions`, `.assessment`, `.proctor`, `.utils`.
- Produces: complete candidate examination workspace.

- [ ] **Step 1: Port all current examination UI states before redesigning anything**

Preserve login, before-you-begin state, camera gate/retry/preview, every current question response type, timer, question navigation, review, submit modal, result/locked state, and unfinished-attempt resume.

- [ ] **Step 2: Preserve integrity and elapsed-time behavior**

Keep window/tab visibility/blur handling, clipboard events, fullscreen events, elapsed-active-time tracking, background marker reconciliation, and timeout submission.

- [ ] **Step 3: Preserve auth/candidate cleanup semantics**

Timeout and successful submission clear the active student auth/candidate state at the same lifecycle points as the current runtime.

- [ ] **Step 4: Simplify local scripts in `exam.html`**

Final local runtime sequence:

```html
<script src="./js/shared.js"></script>
<script src="./js/exam.js"></script>
```

- [ ] **Step 5: Execute syntax/state checks**

```bash
node --check prototype/js/exam.js
node scripts/state-contract.mjs
```

- [ ] **Step 6: Focused browser smoke**

Exercise one normal candidate start/answer/submit path and one camera-required start with denial then retry. Do not delete `exam-app.js` until both paths work through `exam.js`.

---

## Task 5: Make Questions Answer-Aware and Expand the Bank

**Files:**
- Modify: `prototype/data/questions.json`
- Modify: `prototype/js/shared.js`
- Modify: `scripts/state-contract.mjs`
- Modify: `scripts/prototype-audit.mjs`

**Interfaces:**
- Produces: generic answer-aware records, browser-local overrides, and at least 500 validated seed questions.
- Consumed by: candidate scoring, builder inventory, and Question Bank administration.

- [ ] **Step 1: Implement exact answer-shape validation**

Add a shared validator with concrete failures:

```js
const validateAnswerShape = (q) => {
  if (q.type === 'single' && (!Array.isArray(q.options) || !q.options.includes(q.answer))) {
    throw new Error(`Question ${q.id} has an invalid single-choice answer.`);
  }
  if (q.type === 'boolean' && typeof q.answer !== 'boolean') {
    throw new Error(`Question ${q.id} has an invalid true/false answer.`);
  }
  if (q.type === 'multi' && (!Array.isArray(q.answers) || q.answers.length !== q.requiredSelections || q.answers.some((answer) => !q.options.includes(answer)))) {
    throw new Error(`Question ${q.id} has invalid multiple-choice answers.`);
  }
  if ((q.type === 'fill' || q.type === 'fill-multi') && (!Array.isArray(q.acceptedAnswers) || q.acceptedAnswers.length === 0)) {
    throw new Error(`Question ${q.id} needs accepted fill answers.`);
  }
};
```

Validate `levels`, `pathways`, `examModes`, `subjectCode`, `domain`, and `difficulty` in the same question-validation pass.

- [ ] **Step 2: Replace the hardcoded answer-key table with generic scoring**

Implement `assessment.scoreQuestion(question, response)` so:

- single and boolean compare normalized scalar values;
- multi compares the exact required answer set independent of selection order;
- fill/fill-multi compare normalized text against accepted-answer entries;
- unanswered/invalid responses score incorrect without throwing.

Delete the 1–43 answer-key object only after the current 43 seed records contain equivalent answer metadata.

- [ ] **Step 3: Add exact question-override APIs**

`Festacol.store` must expose:

```text
listQuestionOverrides() -> Array<QuestionOverride>
saveQuestionOverride(questionId, patch) -> QuestionOverride
resetQuestionOverride(questionId) -> void
listCustomQuestions() -> Array<Question>
saveCustomQuestion(question) -> Question
deleteCustomQuestion(questionId) -> void
```

`questions.load()` returns the validated seed bank with seed overrides merged by ID, followed by teacher-authored questions, and rejects duplicate final IDs.

- [ ] **Step 4: Migrate the existing 43 questions to answer metadata without changing their current scored result**

For each existing ID, use the current `assessment-engine.js` key as the migration source. Run the state contract against representative single, multi, boolean, and fill items before deleting the old key table.

- [ ] **Step 5: Expand the seed dataset to at least 500 original validated items**

Required coverage groups:

- incoming SS1 Entrance/BECE readiness across all `q-*` subjects;
- SS1 core/common and pathway subjects;
- SS2 core/common and pathway subjects;
- SS3 senior/external-practice subjects.

Each new senior item carries the actual intended `levels` and `pathways`. Do not mark a level-specific item as valid for all SS1–SS3 merely to increase eligible counts.

- [ ] **Step 6: Make eligibility the intersection of mode, level, subject, and pathway**

Common/core questions may list multiple pathways. Science-only questions require Science compatibility; Arts/Social Science routing follows their declared pathway metadata.

- [ ] **Step 7: Make the source audit fail on incomplete bank quality**

Audit failures must include duplicate IDs, malformed answer metadata, fewer than 500 validated seed questions, missing supported response types, or any advertised subject/level/mode slice with zero eligible items.

- [ ] **Step 8: Extend `state-contract.mjs`**

Add executable checks proving:

- migrated seed answer scoring matches prior behavior;
- a seed override changes both loaded content and scoring answer;
- reset restores seed behavior;
- a teacher-authored answer-aware question scores correctly;
- SS1 eligibility excludes a question restricted to SS2/SS3;
- a non-Science pathway excludes a Science-only question.

- [ ] **Step 9: Execute data/shared contracts**

```bash
node --check prototype/js/shared.js
npm run audit:prototype
npm run test:contract
```

Expected: all seed records validate and generic scoring/eligibility contracts pass.

---

## Task 6: Rebuild the Admin Shell and Create `admin.js`

**Files:**
- Modify: `prototype/admin.html`
- Create: `prototype/js/admin.js`
- Read/migrate from: `prototype/js/admin-app.js`
- Modify: `scripts/prototype-audit.mjs`

**Interfaces:**
- Consumes: `window.Festacol`, Flowbite, ApexCharts, Simple-DataTables.
- Produces: admin routing, overlay/popover lifecycle, eight-route shell.

- [ ] **Step 1: Install the exact required admin head contract**

Use the exact fonts, Tailwind, Flowbite CSS, and supplied inline style blocks in the design specification. Use only the pinned plugin scripts:

```html
<script src="https://cdn.jsdelivr.net/npm/apexcharts@3.46.0/dist/apexcharts.min.js"></script>
<script src="https://cdn.jsdelivr.net/npm/simple-datatables@9.0.3"></script>
```

Do not include the generic unpinned ApexCharts script and do not load local admin CSS.

- [ ] **Step 2: Load Flowbite plus only the two local admin runtimes**

```html
<script src="https://cdn.jsdelivr.net/npm/flowbite@4.0.1/dist/flowbite.min.js"></script>
<script src="./js/shared.js"></script>
<script src="./js/admin.js"></script>
```

- [ ] **Step 3: Implement one URL-state parser/builder**

The normalized state keys are:

```text
page view tab modal step student staff exam classId question attempt
q status level pathway subject type difficulty source
```

Normalize legacy `page=users` to `page=students` with `history.replaceState`.

- [ ] **Step 4: Render eight routes from one source**

```js
const ROUTES = Object.freeze([
  ['overview', 'Overview'],
  ['students', 'Students'],
  ['staff', 'Staff'],
  ['exams', 'Examinations'],
  ['classes', 'Classes'],
  ['questions', 'Question Bank'],
  ['reports', 'Reports'],
  ['settings', 'Settings']
]);
```

Desktop and mobile navigation consume this same array.

- [ ] **Step 5: Fetch and use verified Flowbite Icons**

For navigation, bell, search, add, copy, share, edit, delete, check, warning, chart/report, QR, camera, back, and close, copy the corresponding SVG from `https://flowbite.com/icons/`. Do not use handwritten substitute glyphs or another icon family.

- [ ] **Step 6: Use Flowbite Modal with a blurred dynamic backdrop**

Configure the modal backdrop with classes equivalent to:

```js
const backdropClasses = 'bg-gray-900/50 fixed inset-0 z-40 backdrop-blur-sm';
```

Use a bounded centered/modal placement for record detail/edit/confirm. Do not implement a record side drawer.

- [ ] **Step 7: Use Flowbite Popover/Dropdown for notifications**

The notification target is positioned relative to the bell trigger, closes on outside/Escape, and is never rendered by the centered modal host.

- [ ] **Step 8: Restore overlays from URL on `popstate`**

Opening/closing a modal changes only its URL keys. Browser Back/Forward restores the same page, filters, tab, record, and overlay state.

- [ ] **Step 9: Execute source checks**

```bash
node --check prototype/js/admin.js
node scripts/prototype-audit.mjs
```

---

## Task 7: Implement Students, Staff, Classes, WhatsApp, and Settings

**Files:**
- Modify: `prototype/js/admin.js`

**Interfaces:**
- Consumes: `Festacol.store` users/classes/WhatsApp/attempt APIs and `Festacol.assessment.studentHash`.
- Produces: academic management pages and relationship drill-down.

- [ ] **Step 1: Build Students directory**

Filters: search, level, class/pathway, account status, and derived performance/placement state. Use Simple-DataTables on large desktop tables and responsive cards on narrow screens.

- [ ] **Step 2: Build student deep profile**

The profile connects identity → current class → examinations → exact attempts → performance → placement → integrity → rewrites. Every attempt link carries the exact attempt hash.

- [ ] **Step 3: Preserve student add/edit/suspend/activate behavior**

Class assignment is a single select. Saving a new class replaces the previous `classId`; the UI describes this as moving the student.

- [ ] **Step 4: Build Staff separately**

Only `teacher` and `administrator` roles render in Staff. Preserve appropriate add/edit/status actions without student academic columns.

- [ ] **Step 5: Rebuild Classes by SS level then pathway**

Show capacity, occupancy, remaining places, room, student list, WhatsApp mapping, and class-performance deep link.

- [ ] **Step 6: Enforce safe class deletion**

Use this decision before invoking `store.deleteClass(classId)`:

```js
const assignedStudents = store.listUsers().filter((user) => user.role === 'student' && user.classId === classId);
if (assignedStudents.length > 0) {
  throw new Error(`Move ${assignedStudents.length} assigned student${assignedStudents.length === 1 ? '' : 's'} before deleting this class.`);
}
store.deleteClass(classId);
```

Show the error as a teacher-facing alert/toast rather than allowing destructive deletion.

- [ ] **Step 7: Preserve WhatsApp group CRUD and QR**

Keep secure WhatsApp host validation, one group per class, add/edit/delete, and QR rendering.

- [ ] **Step 8: Preserve granular Settings data controls**

Keep clear sessions, attempts, WhatsApp mappings, local question overrides/authored questions, student runtime state where supported, and full reset. Each destructive action confirms exactly what is removed.

- [ ] **Step 9: Execute contracts**

```bash
node --check prototype/js/admin.js
npm run test:contract
```

---

## Task 8: Redesign Examination List, Detail, Edit, Distribution, and Lifecycle

**Files:**
- Modify: `prototype/js/admin.js`

**Interfaces:**
- Consumes: sessions, attempts, proctor policy, QR, clipboard/share helpers.
- Produces: complete examination-management workflow.

- [ ] **Step 1: Build filterable Examinations list**

Filters: title/Exam ID, status, level, purpose, class/pathway, and subject when relevant. Show title, audience, coverage, question count, duration, candidates/submissions, and status.

- [ ] **Step 2: Build deep detail around four teacher jobs**

Sections/tabs: Distribute, Control, Candidates, Results & Analytics. No side drawer.

- [ ] **Step 3: Add QR, Exam ID, Copy address, and Share examination**

Use Flowbite Clipboard/copy visual treatment and the verified Flowbite copy/share icons. Use `navigator.share` when available; if Web Share is unavailable, copy the URL with `navigator.clipboard.writeText`. Treat `AbortError` as user cancellation, not a failure toast.

Do not render a large raw URL input.

- [ ] **Step 4: Preserve lifecycle actions**

Keep close/reopen, duplicate as draft, delete session definition while retaining attempts, reset unfinished attempt, and authorize rewrite with archived prior attempt.

- [ ] **Step 5: Redesign Edit Examination**

Sections: Examination identity, Audience & coverage, Paper, Delivery, Integrity & camera, Candidate instructions. When a candidate has started, locked paper-identity fields show an explanation stating why they are locked.

- [ ] **Step 6: Make candidate/submission records deep-link to exact attempts**

Use `attempt=` and preserve the parent `exam=` context in the URL.

- [ ] **Step 7: Execute contracts and a focused browser smoke**

```bash
node --check prototype/js/admin.js
npm run test:contract
```

Then manually create an exam, copy/share it, close/reopen it, inspect an attempt, and confirm delete-session does not erase attempt history.

---

## Task 9: Rebuild the Five-Stage Examination Builder

**Files:**
- Modify: `prototype/js/admin.js`

**Interfaces:**
- Consumes: question inventory/eligibility, session normalization, class/pathway data, proctor policy.
- Produces: class assessment, Entrance Exam, and external-practice creation flows.

- [ ] **Step 1: Use the Flowbite Stepper pattern**

Stages:

1. Purpose & Audience
2. Coverage
3. Paper
4. Integrity & Delivery
5. Review & Publish

Completed steps use circular check indicators and the active step remains visually and semantically distinct.

- [ ] **Step 2: Implement purpose-specific branching**

Entrance Exam uses the lighter configuration path with internal `qualifier`. Class Assessment resolves valid single/mixed behavior. External Exam Practice uses current `waec` compatibility mode.

- [ ] **Step 3: Use real radio/checkbox semantics for selection cards**

The visible circular selection indicator mirrors a native radio/checkbox input. Keyboard activation and focus must work without custom click-only div logic.

- [ ] **Step 4: Calculate eligible inventory before paper size**

Selected mode, level, pathway, and subject filters produce an `eligibleQuestions` array. Show its length before Stage 3.

- [ ] **Step 5: Implement range bounds from real data**

Question range maximum is `Math.min(150, eligibleQuestions.length)` and minimum remains 5. Duration remains 30–10800 seconds. If eligible count is below 5, block publishing and explain that more compatible questions are required.

- [ ] **Step 6: Implement integrity controls with Flowbite form patterns**

Focus monitoring, fullscreen prompt, clipboard guard, camera requirement, warn threshold, and initial status use Flowbite checkbox/toggle/radio/range patterns.

- [ ] **Step 7: Build final review summary and publish**

Show audience, pathway/class, subjects, available/requested questions, duration, integrity/camera, and status. Successful save transitions directly to distribution with QR, Exam ID, Copy address, and Share examination.

- [ ] **Step 8: Focused browser smoke both creation paths**

Create one SS2 class assessment and one SS1 Entrance & Placement Exam. Verify saved mode, level, subjects, question count, duration, policy, and status.

---

## Task 10: Build the Advanced Question Bank UI

**Files:**
- Modify: `prototype/js/admin.js`

**Interfaces:**
- Consumes: merged answer-aware question inventory and question override/custom mutation APIs.
- Produces: teacher question management without attempting to rewrite the static JSON file from the browser.

- [ ] **Step 1: Show real inventory metrics**

Read counts from the loaded validated bank. Show total plus useful level/pathway/subject/source counts. Never hardcode the 500 count in UI copy.

- [ ] **Step 2: Add query-backed advanced filters**

Filters: search, SS level, pathway/category, subject, domain/topic, response type, difficulty, exam purpose, and seed/edited/teacher-authored source.

- [ ] **Step 3: Use Simple-DataTables for large record navigation**

Use its sort/search/pagination where useful. Keep academic/domain filters outside the table rather than implementing a second pagination/search engine.

- [ ] **Step 4: Build question detail with hidden answer by default**

Provide explicit **Reveal answer**. When revealed, show answer and explanation without exposing them in the collapsed list view.

- [ ] **Step 5: Build one type-aware question/answer editor**

Single choice requires options and one selected answer; boolean requires true/false; multi requires the declared selection count and matching answer set; fill/fill-multi requires one or more normalized accepted answers. Save rejects malformed combinations before persistence.

- [ ] **Step 6: Persist seed edits as overrides and support reset**

Seed save calls `saveQuestionOverride(questionId, patch)`; Restore original calls `resetQuestionOverride(questionId)`. New teacher-authored records use `saveCustomQuestion` and can be edited/deleted.

- [ ] **Step 7: Show compatibility preview**

Display the levels, pathways, subjects, and exam purposes that can receive the question so administrators can see routing impact before saving.

- [ ] **Step 8: Execute contracts and prove one edited answer end-to-end**

```bash
npm run check
```

Then edit a compatible question answer through Admin, launch a candidate paper containing the edited record, submit the edited correct answer, and verify scoring uses the override.

---

## Task 11: Implement Relationship-Based Reports, Merit, Placement, and Integrity

**Files:**
- Modify: `prototype/js/admin.js`

**Interfaces:**
- Consumes: exact attempts, sessions, students, classes, subject stats, placement results, integrity events.
- Produces: real-data reports with source-record deep links.

- [ ] **Step 1: Implement report views**

Canonical `view=` values are `overview`, `class`, `pathway`, `exam`, `student`, `merit`, `placement`, and `integrity`.

- [ ] **Step 2: Class performance**

Show participation/submissions, average and median where data exists, subject results, merit context, and student drill-down.

- [ ] **Step 3: Pathway/category performance**

Compare Science, Arts, and Social Science from actual enrolled class assignments and submitted attempts only.

- [ ] **Step 4: Examination performance and merit**

Show score distribution, subject performance, ranking/merit, and integrity exceptions from the exact examination submissions.

- [ ] **Step 5: Individual student performance**

Show exam history, score/subject stats, trend where meaningful, merit context, placement, and integrity history. Every row/chart point can navigate to the source exam/attempt.

- [ ] **Step 6: Entrance placement capacity analytics**

For each pathway show configured capacity, enrolled occupancy, places remaining, number recommended, number already placed, and number awaiting placement.

- [ ] **Step 7: Exact integrity report**

Each integrity record includes student, examination, exact attempt, event type, and event time and deep-links to the attempt log.

- [ ] **Step 8: Use ApexCharts only for supported analytical relationships**

Every chart has title/labels/tooltips and a nearby numeric/table summary. Destroy stale chart instances before rendering replacement route data.

- [ ] **Step 9: Focused browser drill-down**

Navigate Class report → Student → Examination → Attempt → Integrity log and verify query state/back navigation remains coherent.

---

## Task 12: Atomically Remove Legacy Runtimes and Playwright, Then Simplify CI

**Files:**
- Delete: eight legacy runtime files listed in Target File Map
- Delete: `tests/prototype.spec.js`
- Delete: `playwright.config.js`
- Modify: `package.json`
- Modify: `.github/workflows/prototype-ui.yml`
- Finalize: `scripts/prototype-audit.mjs`

**Interfaces:**
- Produces: final four-runtime prototype with dependency-light Node validation.

- [ ] **Step 1: Verify no live consumer references an old runtime filename**

Search every prototype HTML/JS/script/workflow file. Old runtime filenames may remain only in documentation/history, not in runtime consumers.

- [ ] **Step 2: Delete the eight replaced runtime files**

Remove:

```text
prototype/js/admin-app.js
prototype/js/assessment-engine.js
prototype/js/exam-app.js
prototype/js/proctor-policy.js
prototype/js/qr.js
prototype/js/question-data.js
prototype/js/session-store.js
prototype/js/student-dashboard.js
```

- [ ] **Step 3: Delete Playwright-specific files**

Remove `tests/prototype.spec.js` and `playwright.config.js`.

- [ ] **Step 4: Simplify `package.json`**

Remove `@playwright/test`, `test:e2e`, and `test:e2e:report`. Final scripts are:

```json
{
  "scripts": {
    "audit:prototype": "node scripts/prototype-audit.mjs",
    "test:contract": "node scripts/state-contract.mjs",
    "check": "node --check prototype/js/shared.js && node --check prototype/js/admin.js && node --check prototype/js/student.js && node --check prototype/js/exam.js && node --check scripts/prototype-audit.mjs && node --check scripts/state-contract.mjs && npm run audit:prototype && npm run test:contract"
  }
}
```

If no dependency remains, remove the empty `devDependencies` object rather than leaving stale package metadata.

- [ ] **Step 5: Remove the browser job from `.github/workflows/prototype-ui.yml`**

Keep a single source/domain contract job that checks out the repo, sets up Node 22, and runs `npm run check`. Do not install browser binaries or upload Playwright artifacts.

- [ ] **Step 6: Activate the final source audit**

The audit must prove:

- exactly the four target runtime files exist under `prototype/js/`;
- old runtime files do not exist;
- admin exact required CDN/head tokens exist;
- admin loads no local CSS;
- admin local scripts are `shared.js` then `admin.js`;
- student local scripts are `shared.js` then `student.js`;
- exam local scripts are `shared.js` then `exam.js`;
- question schema/count/coverage is valid;
- required shared/admin behavior markers exist;
- Playwright config/import references are gone from executable project files.

- [ ] **Step 7: Execute the final automated validation**

```bash
npm run check
```

Expected: PASS without installing Playwright or Chromium.

---

## Task 13: Independent Test Review, Code Review, and Browser Dogfood

**Files:**
- No production mutation unless a failed gate is returned to the owning implementation task.

**Interfaces:**
- Consumes: completed implementation and acceptance criteria.
- Produces: LOCALLY_VALIDATED → REVIEWED → INTEGRATION_VERIFIED evidence.

- [ ] **Step 1: Independent Test Engineer executes Node contracts**

```bash
npm run check
```

The Test Engineer must inspect the assertions and confirm they would fail for a missing target runtime, malformed question answer, broken rewrite/reset, lost attempt history, and invalid level/pathway eligibility.

- [ ] **Step 2: Independent Code Reviewer challenges the full replacement**

Review old behavior and new consumers, not only the final diff shape. Blocking areas:

- storage/session compatibility;
- behavior omitted during consolidation;
- duplicated domain rules outside `shared.js`;
- question-answer/scoring consistency;
- one-class invariant;
- delete/rewrite history safety;
- query Back/Forward correctness;
- accessibility/focus/modal/popover behavior;
- unnecessary custom components where Flowbite exists;
- guessed/non-Flowbite icons;
- stale Playwright runtime/config references.

- [ ] **Step 3: Integration/Dogfood Engineer serves the real static prototype**

Use the current `dogfood` and Chrome DevTools/browser workflow, not Playwright. Exercise at:

```text
390×844 mobile
820×1000 tablet
1440×1000 desktop
```

- [ ] **Step 4: Dogfood admin shell/navigation**

Verify eight routes, legacy users alias, mobile navigation, no horizontal overflow, deep-modal history, blurred backdrop, anchored notification popover, no record-detail drawer, and no local admin CSS request.

- [ ] **Step 5: Dogfood Students/Staff/Classes**

Verify directory separation, student profile/exam/attempt drill-down, suspend/activate, single-class move, class capacity, blocked occupied-class deletion, empty-class deletion, WhatsApp valid/invalid CRUD and QR.

- [ ] **Step 6: Dogfood builder and examination distribution**

Create one normal assessment and one Entrance Exam; verify eligibility, range bounds, integrity/camera controls, publish, QR, Exam ID, Copy address, native Share where supported, and clipboard fallback.

- [ ] **Step 7: Dogfood candidate workflows**

Exercise Exam ID, login, camera denial/retry, answer/resume/submit, integrity events, timeout auto-submit/auth cleanup, one-attempt lock, unfinished reset, rewrite authorization, and archived prior result.

- [ ] **Step 8: Dogfood Question Bank**

Verify actual inventory count, combined filters, Reveal answer, seed override edit/reset, teacher-authored create/edit/delete, routing compatibility preview, and end-to-end scoring of an edited answer.

- [ ] **Step 9: Dogfood Reports**

Verify class, pathway, examination, student, merit, placement, and integrity views use real records and deep-link to exact attempts.

- [ ] **Step 10: Record reproducible evidence for any defect**

Any blocking defect routes back to the implementation owner. Do not advance to Git with known requested behavior broken.

---

## Task 14: Git/Release Handoff and Implementation PR

**Files:**
- Entire intended implementation diff.

**Interfaces:**
- Consumes: COMMIT_READY evidence after Test, Review, and Dogfood gates.
- Produces: verified commit, pushed branch, implementation PR, and CI status.

- [ ] **Step 1: Git/Release independently verifies repository state**

Run and inspect:

```bash
git status
git diff --stat
git diff
git log --oneline --decorate -n 10
```

Reject temporary harnesses, unrelated files, generated browser artifacts, and incomplete migrations.

- [ ] **Step 2: Verify the changed-file set**

Expected categories: four target runtimes plus old-runtime deletions; prototype HTML consumer updates; question dataset; source/state contracts; package/CI cleanup removing Playwright. Any additional file requires explicit justification.

- [ ] **Step 3: Re-run final validation immediately before commit**

```bash
npm run check
```

Expected: PASS.

- [ ] **Step 4: Commit only coherent validated states**

Do not commit a state where HTML references missing/deleted runtimes. Git/Release chooses logical commit boundaries only after the corresponding repository state is executable and validated.

- [ ] **Step 5: Push and verify the remote SHA**

Confirm the remote implementation branch points to the intended commit.

- [ ] **Step 6: Use the current `create-pr` skill**

Use a conventional title such as:

```text
feat(prototype): Consolidate runtime and revamp admin experience
```

PR body must list the four-file runtime architecture, admin/product changes, answer-aware 500+ question-bank changes, removed Playwright infrastructure, `npm run check` evidence, independent review verdict, Dogfood evidence, and remaining limitations.

- [ ] **Step 7: Verify PR base/head/diff and CI**

Do not claim COMPLETE until the remote source/state contract is green and the PR diff matches the independently validated implementation.

---

## Final Acceptance Gate

The implementation is COMPLETE only when all are proven:

- exactly four prototype runtime JS files remain;
- shared domain logic is centralized in `shared.js` and page runtimes do not duplicate it;
- supported stored/session-link compatibility passes;
- student/exam workflows work in real browser use;
- admin no-CSS/head/Flowbite requirements are satisfied;
- Flowbite Icons/components are used rather than guessed/reimplemented primitives;
- Students and Staff are separate;
- one-class-per-student and safe class deletion work;
- Entrance Exam placement/capacity behavior is coherent;
- exam builder/edit/distribution/lifecycle/rewrite behavior works;
- Question Bank is answer-aware, editable through overrides, heavily filterable, and contains at least 500 validated seed questions;
- class/pathway/level routing prevents inappropriate questions;
- Student → Exam → Attempt → Score/Placement/Integrity/Rewrite relationships work;
- reports/charts use real data and support source-record drill-down;
- Playwright infrastructure is gone;
- Node source/state contracts pass;
- independent review has no blocking findings;
- manual browser Dogfood passes mobile/tablet/desktop workflows;
- Git/Release verifies commit, push, PR diff, and available CI.

This plan supersedes the earlier two-file-admin-only/Playwright-based plan. Production execution must not begin until the product owner approves this revised specification and plan.
