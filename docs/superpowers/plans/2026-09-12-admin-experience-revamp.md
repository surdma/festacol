# Festacol Prototype Architecture and Admin Experience Revamp Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Consolidate the Festacol prototype to four JavaScript runtimes and deliver the complete teacher-facing admin revamp without regressing student/exam behavior.

**Architecture:** Replace the current eight-file runtime with `shared.js`, `admin.js`, `student.js`, and `exam.js`. `shared.js` owns all cross-page domain/state/scoring/question/proctor/QR behavior through one `window.Festacol` namespace; page runtimes own only their respective DOM and interaction concerns. Remove Playwright from the prototype and retain lightweight Node source/state contracts plus mandatory browser dogfood before Git handoff.

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
- Seed bank target is approximately 500 validated questions with level/pathway routing that prevents inappropriate questions reaching a candidate.
- Playwright, `playwright.config.js`, `tests/prototype.spec.js`, Playwright package scripts/dependency, and browser CI are removed.
- Permanent automated validation is Node/source/state-contract based; browser behavior is validated by mandatory Dogfood/Chrome DevTools execution.
- Only Git/Release performs final commit/push/PR operations after validation gates; do not commit broken intermediate refactors.

---

## Target File Map

### Runtime files

- `prototype/js/shared.js`
  - storage/state normalization
  - sessions and encoded payload compatibility
  - users/staff/classes/WhatsApp
  - question loading/validation/eligibility/overrides
  - paper allocation/randomization
  - scoring/subject stats/placement
  - integrity/proctor/camera policy
  - QR generation
  - shared utilities

- `prototype/js/admin.js`
  - admin URL state/router
  - Flowbite component lifecycle
  - Overview, Students, Staff, Examinations, Classes, Question Bank, Reports, Settings
  - exam builder/edit/distribution
  - charts/data tables

- `prototype/js/student.js`
  - student dashboard rendering
  - Exam ID modal/form
  - student-facing navigation/interactions

- `prototype/js/exam.js`
  - candidate login/start
  - camera gate/preview
  - exam workspace/questions/timer
  - integrity listeners
  - resume/reconcile/submit/result UI

### Data

- `prototype/data/questions.json`
  - ~500 validated seed questions
  - answer metadata included per question type
  - level/pathway/mode/difficulty/domain metadata

### HTML

- `prototype/admin.html`
- `prototype/student.html`
- `prototype/exam.html`
- `prototype/index.html` (simple redirect retained)

### Permanent validation

- `scripts/prototype-audit.mjs`
- `scripts/state-contract.mjs`
- `package.json`
- `.github/workflows/prototype-ui.yml`

### Files removed after migration

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

## Task 1: Convert Current Behavior Into a Non-Playwright Preservation Contract

**Files:**
- Modify: `scripts/prototype-audit.mjs`
- Modify: `scripts/state-contract.mjs`
- Read: all current prototype HTML/JS files
- Read: `tests/prototype.spec.js`

**Interfaces:**
- Consumes: current runtime behavior and the scenarios encoded in the existing Playwright suite.
- Produces: source/state contracts plus a concrete manual browser acceptance checklist from the design spec.

- [ ] **Step 1: Inventory current public shared methods before refactor**

Record every current method used by page runtimes or contract scripts, including sessions, attempts, rewrite/reset, users/classes, questions, scoring, proctor policy, QR, and candidate identity helpers. Use repository-wide search rather than assuming exports are unused.

Expected result: every current page call site maps to a target `Festacol.<module>.<method>` owner before any old file is deleted.

- [ ] **Step 2: Update the source audit to describe the final four-runtime architecture**

The audit must ultimately require:

```js
const requiredRuntime = [
  'prototype/js/shared.js',
  'prototype/js/admin.js',
  'prototype/js/student.js',
  'prototype/js/exam.js'
];
```

and reject the eight legacy runtime paths after migration.

Do not make this assertion active until the target files exist; structure the refactor so the audit can be switched atomically with the migration.

- [ ] **Step 3: Add final admin head/source contract assertions**

Require the exact pinned resources:

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

Reject local admin CSS and old runtime script tags.

- [ ] **Step 4: Expand `state-contract.mjs` coverage before changing shared behavior**

Keep current session migration/round-trip, deterministic paper, scoring, integrity, rewrite, reset, student relationship, and WhatsApp assertions. Add explicit checks for:

```js
// one current class per student
const before = S.listUsers().find((u) => u.id === 'ST-2401');
S.saveUser({ ...before, classId: 'ss3-science' });
if (S.listUsers().find((u) => u.id === 'ST-2401').classId !== 'ss3-science') {
  throw new Error('single current class assignment failed');
}
```

Also add final assertions for seed-question override/reset and answer-aware custom-question scoring once those APIs are implemented in Task 5.

- [ ] **Step 5: Extract browser scenarios from the old Playwright file into the implementation Dogfood checklist**

Ensure the final execution checklist explicitly includes:

- admin eight-route navigation and no overflow;
- Exam ID login path;
- camera denial/retry;
- timeout auto-submit;
- rewrite archive/fresh attempt;
- structural edit locks;
- WhatsApp valid/invalid link;
- exact integrity event drill-down;
- modal viewport bounds;
- mobile navigation/cards.

The scenarios remain requirements even though the Playwright implementation is removed later.

- [ ] **Step 6: Run current pre-refactor contracts**

Run:

```bash
npm run check
node --check tests/prototype.spec.js
```

Expected: current baseline passes before production mutation. If it does not, classify failures before proceeding.

---

## Task 2: Build `shared.js` and Preserve Storage/Session Compatibility

**Files:**
- Create: `prototype/js/shared.js`
- Modify: `scripts/state-contract.mjs`
- Read/migrate from: `session-store.js`, `proctor-policy.js`, `question-data.js`, `assessment-engine.js`, `qr.js`

**Interfaces:**
- Produces: `window.Festacol = Object.freeze({ store, questions, assessment, proctor, qr, utils })`.
- Consumed later by: `admin.js`, `student.js`, `exam.js`.

- [ ] **Step 1: Create the namespace skeleton without page DOM rendering**

Use one IIFE:

```js
(() => {
  'use strict';

  const utils = Object.freeze({ /* shared pure helpers */ });
  const store = Object.freeze({ /* persistence/domain state */ });
  const questions = Object.freeze({ /* question access */ });
  const assessment = Object.freeze({ /* paper/scoring/placement */ });
  const proctor = Object.freeze({ /* integrity/camera policy */ });
  const qr = Object.freeze({ /* SVG QR rendering */ });

  window.Festacol = Object.freeze({ store, questions, assessment, proctor, qr, utils });
})();
```

Do not expose page renderer functions here.

- [ ] **Step 2: Move storage/session/user/class/WhatsApp behavior from `session-store.js`**

Preserve existing storage keys and compatibility behavior. Keep normalization rules and method semantics for:

- `listSessions`, `saveSession`, `findSessionById`, status/delete/link helpers;
- attempts and exact student/session relationships;
- active candidate/auth/student state;
- rewrite/reset;
- profile;
- classes/users/status/promotion;
- WhatsApp groups;
- granular clear functions.

- [ ] **Step 3: Move proctor policy into `Festacol.proctor`**

Preserve camera-required and integrity policy storage semantics and URL/session decoration behavior.

- [ ] **Step 4: Move QR renderer into `Festacol.qr`**

Keep deterministic SVG generation used by examination and WhatsApp distribution.

- [ ] **Step 5: Temporarily retain existing answer behavior while moving assessment functions**

Move candidate/student hashing, deterministic randomization, paper fingerprint, attempt hash, score result construction, integrity scoring, and placement weighting into `Festacol.assessment` without changing answers yet. Task 5 replaces hardcoded answers only after the new question schema is available.

- [ ] **Step 6: Move question loading/eligibility into `Festacol.questions`**

Preserve current subject catalogue and mode/level filtering.

- [ ] **Step 7: Point `state-contract.mjs` at only `shared.js`**

Replace multi-file VM loading with:

```js
vm.runInContext(
  fs.readFileSync(new URL('../prototype/js/shared.js', import.meta.url), 'utf8'),
  ctx,
  { filename: 'shared.js' }
);
const { store: S, assessment: A, questions: Q } = ctx.Festacol;
```

- [ ] **Step 8: Run shared contract**

```bash
node --check prototype/js/shared.js
node scripts/state-contract.mjs
```

Expected: current state/session/assessment contract passes before any consumer is migrated.

---

## Task 3: Migrate the Student Surface to `student.js`

**Files:**
- Create: `prototype/js/student.js`
- Modify: `prototype/student.html`
- Read/migrate from: `prototype/js/student-dashboard.js`
- Read/migrate from: inline Exam ID script in `student.html`

**Interfaces:**
- Consumes: `window.Festacol`.
- Produces: student dashboard and Exam ID interaction with no other local runtime dependency.

- [ ] **Step 1: Move student-dashboard DOM logic into `student.js`**

Replace references such as `FestacolSessionStore`/`FestacolAssessmentEngine` with destructured shared modules:

```js
const { store, assessment, proctor, utils } = window.Festacol;
```

- [ ] **Step 2: Move inline Exam ID script into `student.js`**

Preserve:

- case-insensitive Exam ID lookup;
- missing/draft exam errors;
- camera-aware decorated examination URL;
- modal close/backdrop/Escape/focus behavior.

- [ ] **Step 3: Simplify `student.html` local scripts**

The final local runtime sequence is exactly:

```html
<script src="./js/shared.js"></script>
<script src="./js/student.js"></script>
```

Keep Flowbite CDN loading before those files.

- [ ] **Step 4: Run syntax/source contract in transitional mode**

```bash
node --check prototype/js/student.js
node --check prototype/js/shared.js
```

- [ ] **Step 5: Browser-smoke the student dashboard and Exam ID form manually**

Using the local static server, confirm the dashboard renders and a known session ID can route to the exam login. This is a focused implementation smoke, not the final Dogfood gate.

---

## Task 4: Migrate the Candidate Examination Surface to `exam.js`

**Files:**
- Create: `prototype/js/exam.js`
- Modify: `prototype/exam.html`
- Read/migrate from: `prototype/js/exam-app.js`

**Interfaces:**
- Consumes: `Festacol.store`, `.questions`, `.assessment`, `.proctor`, `.utils`.
- Produces: complete candidate examination UI/runtime.

- [ ] **Step 1: Port exam DOM/workspace logic without simplifying behavior**

Preserve all current states and handlers before changing visual details:

- login;
- before-you-begin state;
- camera gate/retry/preview;
- question response types;
- timer;
- review;
- submit modal;
- result/locked state;
- resume unfinished state.

- [ ] **Step 2: Preserve integrity listeners and background reconciliation**

Keep tab/window visibility/blur, clipboard, fullscreen, elapsed-active-time, timeout and persisted background marker behavior.

- [ ] **Step 3: Preserve session/candidate cleanup rules**

Timeout and successful submission still clear active auth/candidate state at the correct time.

- [ ] **Step 4: Simplify `exam.html` local scripts**

Final local runtime sequence:

```html
<script src="./js/shared.js"></script>
<script src="./js/exam.js"></script>
```

- [ ] **Step 5: Run syntax/shared-state checks**

```bash
node --check prototype/js/exam.js
node scripts/state-contract.mjs
```

- [ ] **Step 6: Focused browser smoke**

Manually exercise one normal candidate start/answer/submit path and one camera-required start. Do not delete old exam runtime until this succeeds.

---

## Task 5: Make the Question Bank Answer-Aware and Scale the Seed Data

**Files:**
- Modify: `prototype/data/questions.json`
- Modify: `prototype/js/shared.js`
- Modify: `scripts/state-contract.mjs`
- Modify: `scripts/prototype-audit.mjs`

**Interfaces:**
- Produces: generic answer-aware question records, override APIs, ~500-question validated seed bank.
- Consumed by: admin builder/question bank and candidate scoring.

- [ ] **Step 1: Define answer-aware validation in `Festacol.questions`**

Validate by type:

```js
if (q.type === 'single' && !q.options.includes(q.answer)) throw new Error(...);
if (q.type === 'boolean' && typeof q.answer !== 'boolean') throw new Error(...);
if (q.type === 'multi' && (!Array.isArray(q.answers) || q.answers.length !== q.requiredSelections)) throw new Error(...);
if ((q.type === 'fill' || q.type === 'fill-multi') && !q.acceptedAnswers) throw new Error(...);
```

Also validate level/pathway/mode/subject/difficulty metadata.

- [ ] **Step 2: Replace hardcoded ID answer keys with generic scoring**

`assessment.scoreQuestion(question, response)` reads the answer fields from the question itself. Preserve existing normalization behavior such as trimmed/case-normalized fill answers.

No `ANSWER_KEYS = { 1: ..., 43: ... }` table remains.

- [ ] **Step 3: Add seed-question override persistence**

Add shared store APIs with explicit names:

```js
listQuestionOverrides()
saveQuestionOverride(questionId, patch)
resetQuestionOverride(questionId)
listCustomQuestions()
saveCustomQuestion(question)
deleteCustomQuestion(questionId)
```

`questions.load()` merges in this order:

1. seed JSON;
2. seed overrides by ID;
3. teacher-authored questions.

- [ ] **Step 4: Migrate the existing 43 seed questions to answer metadata**

Use the current answer key as the source of truth so existing scores do not change.

- [ ] **Step 5: Expand to the approved ~500-question target**

Use academically coherent original items. Every item must have explicit metadata and a valid answer. Distribution must provide practical coverage for:

- Entrance/BECE readiness `q-*` domains;
- SS1 core/common and pathway subjects;
- SS2 core/common and pathway subjects;
- SS3/external-practice senior subjects.

Do not simply tag one senior question as valid for all SS1–SS3 when its difficulty/content is level-specific. Most new senior items should carry the actual intended level(s).

- [ ] **Step 6: Enforce pathway compatibility**

Question eligibility is the intersection of:

```text
session mode
∩ class level
∩ selected subject
∩ selected/current pathway where applicable
```

Common/core subjects can list multiple pathways. Science-only content does not silently enter Arts/Social Science papers.

- [ ] **Step 7: Audit inventory coverage**

`prototype-audit.mjs` must fail if:

- question IDs duplicate;
- answers are malformed;
- total validated bank does not meet the approved target;
- any advertised subject/level/mode has no eligible questions;
- required response types disappear.

Do not fake a 500 label independently of loaded data.

- [ ] **Step 8: Extend state contract for question edits and scoring**

Add checks proving:

- seed answer scores correctly;
- seed override changes the rendered/scored answer consistently;
- reset restores seed answer;
- custom question with answer can be scored;
- SS1 eligibility excludes an SS2/SS3-only item;
- pathway filter excludes an incompatible subject/item.

- [ ] **Step 9: Run data/shared contracts**

```bash
node --check prototype/js/shared.js
npm run audit:prototype
npm run test:contract
```

Expected: all seed questions validate and generic scorer passes preserved/current cases.

---

## Task 6: Rebuild `admin.html` Shell and Create `admin.js`

**Files:**
- Modify: `prototype/admin.html`
- Create: `prototype/js/admin.js`
- Read/migrate from: `prototype/js/admin-app.js`
- Modify: `scripts/prototype-audit.mjs`

**Interfaces:**
- Consumes: `window.Festacol`, Flowbite, ApexCharts, Simple-DataTables.
- Produces: admin shell, routing, overlay/popover lifecycle used by later admin tasks.

- [ ] **Step 1: Install the exact required admin head contract**

Use the exact fonts/Tailwind/Flowbite/two supplied inline style blocks from the design specification.

Replace the unpinned ApexCharts skeleton line with exactly:

```html
<script src="https://cdn.jsdelivr.net/npm/apexcharts@3.46.0/dist/apexcharts.min.js"></script>
<script src="https://cdn.jsdelivr.net/npm/simple-datatables@9.0.3"></script>
```

Do not add local admin CSS.

- [ ] **Step 2: Load Flowbite plus only the two local admin runtimes**

```html
<script src="https://cdn.jsdelivr.net/npm/flowbite@4.0.1/dist/flowbite.min.js"></script>
<script src="./js/shared.js"></script>
<script src="./js/admin.js"></script>
```

- [ ] **Step 3: Implement centralized URL state**

Use one state parser/builder supporting:

```js
{
  page, view, tab, modal, step,
  student, staff, exam, classId, question, attempt,
  q, status, level, pathway, subject, type, difficulty, source
}
```

Normalize legacy `page=users` to Students with `history.replaceState`.

- [ ] **Step 4: Render eight routes from one navigation definition**

```js
const ROUTES = [
  ['overview', 'Overview'],
  ['students', 'Students'],
  ['staff', 'Staff'],
  ['exams', 'Examinations'],
  ['classes', 'Classes'],
  ['questions', 'Question Bank'],
  ['reports', 'Reports'],
  ['settings', 'Settings']
];
```

Desktop and mobile nav consume the same list.

- [ ] **Step 5: Use Flowbite Icons instead of guessed SVG paths**

For each required icon, fetch the matching SVG from Flowbite Icons and store only its verified markup/path in the runtime. Cover at least navigation, bell, search, add, copy, share, edit, delete, check, warning, chart/report, QR, camera, and back/close.

- [ ] **Step 6: Implement Flowbite modal lifecycle with blurred dynamic backdrop**

Use Flowbite Modal or matching component contract with backdrop classes equivalent to:

```js
'bg-gray-900/50 fixed inset-0 z-40 backdrop-blur-sm'
```

Do not use a record-detail side drawer.

- [ ] **Step 7: Implement notification Flowbite Popover/Dropdown anchored to the bell**

The target/trigger relationship must be explicit. Never reuse the centered admin modal for notifications.

- [ ] **Step 8: Wire `popstate` and deep-modal restoration**

Back/Forward must open/close the correct overlay and preserve parent filters.

- [ ] **Step 9: Run syntax/source audit**

```bash
node --check prototype/js/admin.js
node scripts/prototype-audit.mjs
```

---

## Task 7: Implement Students, Staff, Classes and Settings Without Lost Behavior

**Files:**
- Modify: `prototype/js/admin.js`

**Interfaces:**
- Consumes: `Festacol.store` users/classes/WhatsApp/attempt APIs and `Festacol.assessment.studentHash`.
- Produces: academic management pages and student relationship drill-down.

- [ ] **Step 1: Build Students directory**

Filters: search, level, pathway/class, status, performance/placement state when derivable. Use Simple-DataTables on suitable desktop tables and responsive cards on narrow screens.

- [ ] **Step 2: Build student deep profile**

Tabs/sections connect identity → current class → exams → exact attempts → performance → placement → integrity → rewrites.

- [ ] **Step 3: Preserve student mutations**

Add/edit and suspend/activate remain available. Class edit is a single-select move, never a multi-pathway assignment.

- [ ] **Step 4: Build Staff page separately**

Only teacher/administrator roles appear. Preserve appropriate add/edit/status controls.

- [ ] **Step 5: Rebuild Classes by SS level then pathway**

Show capacity, occupancy, remaining places, room, student list, WhatsApp status, and performance deep link.

- [ ] **Step 6: Enforce safe class deletion**

Before delete:

```js
const assigned = store.listUsers().filter((u) => u.role === 'student' && u.classId === classId);
if (assigned.length) {
  // reject and tell administrator to move students first
}
```

- [ ] **Step 7: Preserve WhatsApp group CRUD and QR**

Keep secure invite-host validation and one mapping per class.

- [ ] **Step 8: Build Settings with granular data controls**

Preserve clear sessions, attempts, WhatsApp, question overrides/authored items, student runtime state where supported, and full reset. Confirm destructive actions.

- [ ] **Step 9: Run syntax/state contracts**

```bash
node --check prototype/js/admin.js
npm run test:contract
```

---

## Task 8: Redesign Examination Management, Edit and Distribution

**Files:**
- Modify: `prototype/js/admin.js`

**Interfaces:**
- Consumes: sessions, attempts, proctor policy, QR, share/clipboard helpers.
- Produces: examination list/detail/edit/distribution/lifecycle controls.

- [ ] **Step 1: Build filterable Examinations list**

Support title/ID search plus status, level, purpose, class/pathway, and subject where applicable.

- [ ] **Step 2: Build deep detail around four jobs**

Sections/tabs:

- Distribute;
- Control;
- Candidates;
- Results/Analytics.

No side drawer.

- [ ] **Step 3: Add QR, Exam ID, Copy address and Share examination**

Use Flowbite Clipboard/copy pattern and a verified Flowbite copy icon.

Shared helper behavior:

```js
async function shareExam(session) {
  const url = Festacol.store.getSessionLink(session, location.href);
  if (navigator.share) {
    try {
      await navigator.share({ title: session.title, url });
      return { shared: true };
    } catch (error) {
      if (error?.name === 'AbortError') return { cancelled: true };
    }
  }
  await navigator.clipboard.writeText(url);
  return { copied: true };
}
```

Do not display a giant raw URL field.

- [ ] **Step 4: Preserve lifecycle actions**

- close/reopen;
- duplicate as draft;
- delete session definition without deleting historical attempts;
- reset unfinished attempt;
- authorize rewrite and preserve archived attempt.

- [ ] **Step 5: Redesign Edit Examination**

Use clear sections: identity, audience/coverage, paper, delivery, integrity/camera, instructions. When attempts exist, locked structural controls show explanatory text.

- [ ] **Step 6: Make exact attempts navigable**

Candidate/submission rows link with `attempt=` and preserve examination context.

- [ ] **Step 7: Run shared contract plus focused browser smoke**

```bash
node --check prototype/js/admin.js
npm run test:contract
```

Manually create an exam, copy/share it, close/reopen it, and inspect an attempt.

---

## Task 9: Rebuild the Five-Stage Examination Builder

**Files:**
- Modify: `prototype/js/admin.js`

**Interfaces:**
- Consumes: question inventory/eligibility, session normalization, class/pathway data, proctor policy.
- Produces: normal class assessment, Entrance Exam, and external-practice creation flows.

- [ ] **Step 1: Use the Flowbite Stepper pattern**

Five stages:

1. Purpose & Audience
2. Coverage
3. Paper
4. Integrity & Delivery
5. Review & Publish

Show active/completed state with circular indicators/checks.

- [ ] **Step 2: Implement purpose-specific branching**

Entrance Exam uses the lighter configuration path and internal `qualifier`. Class Assessment resolves valid single/mixed behavior. External Exam Practice uses existing `waec` compatibility mode.

- [ ] **Step 3: Use semantic circular selection controls**

Cards wrap real radio/checkbox inputs. Do not use click-only div state.

- [ ] **Step 4: Filter coverage before the teacher chooses a paper size**

Selected level/pathway/mode/subject drives `questions.eligible(...)`. Display the eligible count before continuing.

- [ ] **Step 5: Implement improved range controls**

Question count:

```js
const maxQuestions = Math.min(150, eligible.length);
```

Duration remains 30–10800 seconds. Show selected value and meaningful endpoints beside the Flowbite range control.

- [ ] **Step 6: Implement integrity controls**

Use Flowbite checkbox/toggle/radio patterns for focus monitoring, fullscreen prompt, clipboard guard, camera requirement, warn threshold, and status.

- [ ] **Step 7: Build final review summary**

Teacher sees audience, pathway/class, subjects, eligible/requested questions, duration, integrity/camera, and status before publish.

- [ ] **Step 8: Publish directly into distribution state**

Success opens the distribution UI with QR, Exam ID, copy, and share controls.

- [ ] **Step 9: Focused browser smoke both branches**

Create:

- one SS2 class assessment;
- one SS1 Entrance & Placement Exam.

Confirm each saved session has valid mode/level/subjects/count/policy.

---

## Task 10: Build the Advanced Question Bank UI

**Files:**
- Modify: `prototype/js/admin.js`

**Interfaces:**
- Consumes: answer-aware merged question inventory from `Festacol.questions` and override/custom mutation APIs from `Festacol.store`.
- Produces: teacher question management without directly mutating the static JSON file at runtime.

- [ ] **Step 1: Show actual inventory metrics**

Display total loaded/valid questions and useful counts by level/pathway/subject/source. Never hardcode “500”.

- [ ] **Step 2: Add advanced filters**

Query-backed filters:

- search;
- SS1/SS2/SS3;
- Science/Arts/Social Science/Common;
- subject;
- domain;
- response type;
- difficulty;
- exam purpose;
- seed/edited/teacher-authored.

- [ ] **Step 3: Use Simple-DataTables where it improves large-bank navigation**

Do not duplicate its search/sort/pagination with a second custom implementation. Keep domain filters outside/above the table.

- [ ] **Step 4: Build question detail with Reveal answer**

Answer starts hidden. An explicit administrator action reveals answer + explanation. The page should still make the question readable when answer is hidden.

- [ ] **Step 5: Build one coherent editor for question and answer**

Editor supports type-specific fields. For example, a single-choice question requires options and one answer; multi-choice requires exact required selections and matching answers.

- [ ] **Step 6: Persist seed edits as overrides**

Saving a seed item calls `saveQuestionOverride(id, patch)`. “Restore original” calls `resetQuestionOverride(id)`.

- [ ] **Step 7: Preserve teacher-authored CRUD**

New local questions can be created/edited/deleted with valid answers and metadata.

- [ ] **Step 8: Add compatibility preview**

Show which levels/pathways/exam purposes are eligible to receive the question. This should help prevent accidental Science/Arts or SS-level routing mistakes.

- [ ] **Step 9: Run contracts and manually score an edited item**

```bash
npm run check
```

Then create/edit a local question through Admin, launch a compatible paper, answer it, and confirm scoring uses the saved answer definition.

---

## Task 11: Implement Relationship-Based Reports and Integrity/Placement Drill-Down

**Files:**
- Modify: `prototype/js/admin.js`

**Interfaces:**
- Consumes: exact attempts, sessions, students, classes, subject stats, placement and integrity events.
- Produces: real-data reports with deep links to source records.

- [ ] **Step 1: Create report routing**

Views:

```text
overview
class
pathway
exam
student
merit
placement
integrity
```

All report filters/deep links use query parameters.

- [ ] **Step 2: Build class performance**

Show submissions/participation, average/median when data exists, subject results, merit context, and student drill-down.

- [ ] **Step 3: Build pathway/category performance**

Compare Science/Arts/Social Science only from actual enrolled class assignments and submitted attempts.

- [ ] **Step 4: Build examination analytics and merit**

Use real submissions for score distribution, subject performance, rankings, and integrity exceptions.

- [ ] **Step 5: Build individual student performance**

Every chart/table point must remain traceable to exact exam/attempt data.

- [ ] **Step 6: Build Entrance placement capacity analytics**

For each pathway show capacity, occupancy, places remaining, recommended, placed, and awaiting placement.

- [ ] **Step 7: Build exact integrity report**

Show student + exam + exact attempt + chronological event type/time. Deep link to attempt detail.

- [ ] **Step 8: Use ApexCharts only where it communicates a real relationship**

Charts receive accessible title/labels/tooltips plus an adjacent numerical/table summary. Destroy/recreate chart instances cleanly when route state changes.

- [ ] **Step 9: Browser-smoke chart/report drill-down**

From class report click student → exam → attempt → integrity log and verify URL/state remains coherent.

---

## Task 12: Atomically Remove Legacy Runtimes and Playwright, Then Simplify CI

**Files:**
- Delete: eight legacy/runtime files replaced above
- Delete: `tests/prototype.spec.js`
- Delete: `playwright.config.js`
- Modify: `package.json`
- Modify: `.github/workflows/prototype-ui.yml`
- Modify/finalize: `scripts/prototype-audit.mjs`

**Interfaces:**
- Produces: final four-runtime prototype and dependency-free Node validation flow.

- [ ] **Step 1: Verify all HTML consumers use target runtimes before deletion**

Search for every old filename. Expected references after migration: zero outside planning/history documentation.

- [ ] **Step 2: Delete the legacy runtime files**

Delete:

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

- [ ] **Step 3: Remove Playwright files**

Delete:

```text
tests/prototype.spec.js
playwright.config.js
```

- [ ] **Step 4: Simplify `package.json`**

Remove `@playwright/test`, `test:e2e`, and `test:e2e:report`.

Keep scripts equivalent to:

```json
{
  "scripts": {
    "audit:prototype": "node scripts/prototype-audit.mjs",
    "test:contract": "node scripts/state-contract.mjs",
    "check": "node --check prototype/js/shared.js && node --check prototype/js/admin.js && node --check prototype/js/student.js && node --check prototype/js/exam.js && node --check scripts/prototype-audit.mjs && node --check scripts/state-contract.mjs && npm run audit:prototype && npm run test:contract"
  }
}
```

If no other dependency remains, keep `devDependencies` empty or remove it rather than retaining unused browser tooling.

- [ ] **Step 5: Remove browser job from `.github/workflows/prototype-ui.yml`**

Keep one source/domain contract job that sets up Node and runs:

```bash
npm run check
```

Do not install Chromium/Playwright and do not upload browser test artifacts.

- [ ] **Step 6: Finalize source audit**

Assert:

- exact four runtime files exist;
- old runtime files do not exist;
- admin exact head/CDNs exist;
- admin no local CSS;
- admin loads only shared.js/admin.js locally;
- student loads shared.js/student.js;
- exam loads shared.js/exam.js;
- question data meets schema/count/coverage contract;
- required shared/admin behavior markers exist;
- no Playwright config/test import remains.

- [ ] **Step 7: Run full local static/domain validation**

```bash
npm run check
```

Expected: PASS with no Playwright installation required.

---

## Task 13: Independent Test Review, Code Review and Browser Dogfood

**Files:**
- No production mutation unless a gate returns a defect to the owning implementation task.

**Interfaces:**
- Consumes: completed implementation and spec acceptance criteria.
- Produces: LOCALLY_VALIDATED → REVIEWED → INTEGRATION_VERIFIED evidence.

- [ ] **Step 1: Independent Test Engineer validates Node contracts**

Execute independently:

```bash
npm run check
```

Confirm the contract would fail for missing runtime files, malformed questions, broken scoring/rewrite, and incompatible eligibility rather than merely printing green output.

- [ ] **Step 2: Independent Code Reviewer inspects the full refactor, not only admin.js**

Reviewer must compare removed/replaced behavior against old consumers and specifically challenge:

- localStorage/session compatibility;
- hidden behavior lost in consolidation;
- duplicate domain rules outside shared.js;
- question-answer/scoring consistency;
- one-class invariant;
- delete/rewrite history safety;
- query/back-forward behavior;
- accessibility/focus/modal/popover behavior;
- unnecessary custom components where Flowbite exists;
- accidental use of raw/guessed icons;
- stale Playwright references.

Blocking verdict returns work to the appropriate task.

- [ ] **Step 3: Integration/Dogfood Engineer runs real browser exploration**

Use the current `dogfood` and browser/Chrome DevTools workflow, not Playwright.

Serve the repository locally, then exercise at:

```text
390×844
820×1000
1440×1000
```

- [ ] **Step 4: Dogfood admin shell and navigation**

Verify eight routes, legacy users alias, mobile nav, no overflow, deep modal history, blurred backdrop, anchored notifications, no side detail drawer, no local admin CSS.

- [ ] **Step 5: Dogfood Students/Staff/Classes**

Verify separation, profile/exam/attempt drill-down, suspend/activate, one-class move, class capacity, safe delete, WhatsApp valid/invalid CRUD and QR.

- [ ] **Step 6: Dogfood builder/exam distribution**

Create normal class assessment and Entrance Exam; verify eligibility, count sliders, integrity/camera, publish, QR, Exam ID, Copy address, Share fallback.

- [ ] **Step 7: Dogfood candidate workflows**

Exercise Exam ID, candidate login, camera denial/retry, normal answering/resume/submit, integrity events, timeout auto-submit, one-attempt lock, reset unfinished, rewrite authorization and archived prior result.

- [ ] **Step 8: Dogfood Question Bank**

Filter a large bank, reveal answer, edit seed override, reset override, create/edit/delete teacher question, and prove the edited answer affects a compatible candidate score.

- [ ] **Step 9: Dogfood Reports**

Verify class, pathway, exam, student, merit, placement, and integrity reports use real records and deep-link to the exact attempt.

- [ ] **Step 10: Document defects with reproducible evidence**

Any blocking defect returns to the owning implementation task. Do not proceed to Git while known requested behavior is broken.

---

## Task 14: Git/Release Handoff and Implementation PR

**Files:**
- Entire intended implementation diff.

**Interfaces:**
- Consumes: COMMIT_READY evidence from Lead after Test, Review and Dogfood gates.
- Produces: verified commit, pushed branch, implementation PR and CI status.

- [ ] **Step 1: Git/Release independently verifies repository state**

Inspect:

```bash
git status
git diff --stat
git diff
git log --oneline --decorate -n 10
```

Confirm there are no temporary harnesses, unrelated files, generated browser artifacts, or incomplete migrations.

- [ ] **Step 2: Verify the final changed-file set is explained**

Expected categories:

- four target runtime files + deletion of legacy runtimes;
- prototype HTML consumer updates;
- question dataset;
- source/state contract scripts;
- package/CI cleanup removing Playwright.

Any extra file requires explicit explanation.

- [ ] **Step 3: Run final validation again immediately before commit**

```bash
npm run check
```

Expected: PASS.

- [ ] **Step 4: Commit only after COMMIT_READY**

Use logical commits only if each commit is a coherent, validated repository state. Do not commit an intermediate state in which HTML points to deleted/missing runtimes.

- [ ] **Step 5: Push and verify remote SHA**

Verify the remote implementation branch points at the intended commit SHA.

- [ ] **Step 6: Use the current `create-pr` skill**

PR title follows conventional format, for example:

```text
feat(prototype): Consolidate runtime and revamp admin experience
```

PR body lists:

- four-file runtime architecture;
- admin/UI/product changes;
- 500-question schema/data/scoring changes;
- removed Playwright infrastructure;
- `npm run check` evidence;
- independent review verdict;
- browser Dogfood evidence and any known limitations.

- [ ] **Step 7: Verify PR base/head/diff and available CI**

Do not claim COMPLETE until the remote source/state contract check is green and the PR diff matches the validated local implementation.

---

## Final Acceptance Gate

The implementation may be marked COMPLETE only when all of these are proven:

- exactly four prototype runtime JS files remain;
- `shared.js` contains shared domain logic and page runtimes do not duplicate it;
- all current supported state/link compatibility passes;
- student/exam workflows still work in real browser use;
- admin no-CSS/head/Flowbite requirements are satisfied;
- Flowbite Icons and components are used rather than guessed/reimplemented primitives;
- Students and Staff are separated;
- one-class-per-student behavior and safe class deletion work;
- Entrance Exam placement/capacity behavior is coherent;
- exam builder/edit/distribution/lifecycle/rewrite behavior works;
- Question Bank is answer-aware, editable through overrides, heavily filterable, and meets the approved large-bank target;
- class/pathway/level routing prevents inappropriate questions;
- Student → Exam → Attempt → Score/Placement/Integrity/Rewrite deep relationships work;
- reports/charts use real data and support drill-down;
- Playwright infrastructure is gone;
- Node source/state contracts pass;
- independent review has no blocking findings;
- manual browser Dogfood passes mobile/tablet/desktop core workflows;
- Git/Release verifies commit, push, PR diff, and available CI.

This plan replaces the earlier two-file-admin-only/Playwright-based plan. Production execution must not begin until the product owner approves the revised specification and plan.
