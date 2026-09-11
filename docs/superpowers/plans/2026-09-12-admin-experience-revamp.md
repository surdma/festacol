# Festacol Admin Experience Complete Revamp Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebuild the Festacol prototype admin experience into a responsive teacher-facing examination and academic operations console while preserving the existing exam/session contracts and limiting production admin changes to `prototype/admin.html` and `prototype/js/admin-app.js`.

**Architecture:** Keep the current browser-local prototype and shared `FestacolSessionStore`, assessment, proctor, QR and question-data contracts unchanged. `admin.html` owns the Tailwind/Flowbite shell and required CDN dependencies; `admin-app.js` owns URL-driven route/modal state, presentation, derived analytics and UI event wiring. Validation files are updated first and alongside behavior so contract changes remain explicit.

**Tech Stack:** HTML, vanilla JavaScript, Tailwind CSS browser v4, Flowbite 4.0.1, Flowbite Icons, ApexCharts 3.46.0, Simple-DataTables 9.0.3, Playwright 1.63.0, browser localStorage/sessionStorage.

**Spec:** `docs/superpowers/specs/2026-09-12-admin-experience-revamp-design.md`

## Global Constraints

- Production admin changes are limited to `prototype/admin.html` and `prototype/js/admin-app.js`.
- No standalone admin CSS file may be created or loaded.
- Preserve internal exam mode identifiers `qualifier`, `mixed`, `single`, and `waec` and existing encoded-session compatibility.
- Teacher-facing terminology uses **SS1 Entrance & Placement Exam**, not “Qualifier”.
- Session duration remains 30 seconds–3 hours and question count remains 5–150.
- A user/student has one current `classId`; the UI must not model simultaneous Science/Arts/Social Science membership.
- Use Flowbite components/patterns and Flowbite Icons instead of rebuilding standard primitives.
- Add ApexCharts exactly at 3.46.0 and Simple-DataTables exactly at 9.0.3.
- Do not use record-detail side drawers/sheets.
- Notifications use an anchored popover/dropdown near the bell trigger.
- Query parameters are the source of truth for page, deep record, report view and modal navigation state.
- Charts/tables use real session/attempt/class/question data only; no fabricated analytics.
- The current scored base bank is not expanded in this implementation plan; the 500-question scored-bank work requires a separate scope-expansion PR.
- Existing candidate exam, camera, timeout, reset/rewrite, Exam ID and WhatsApp-class contracts must remain green.

---

## File Structure Map

### Production files

- `prototype/admin.html`
  - Admin shell and accessibility landmarks
  - Required CDN dependencies
  - Supplied Tailwind theme and small inline structural style primitives
  - Mobile navigation dialog, admin modal host, notification popover host and toast host

- `prototype/js/admin-app.js`
  - Route/query parsing and history synchronization
  - Admin information architecture and page rendering
  - Students/staff/classes/exams/questions/reports/settings views
  - Exam builder/edit/distribution workflows
  - Derived analytics and chart/table lifecycle
  - Modal/popover/event handling and mutation feedback

### Validation files

- `scripts/prototype-audit.mjs`
  - Static design-system/source-contract assertions

- `tests/prototype.spec.js`
  - Browser workflow and responsive regression coverage

### Read-only shared dependencies

- `prototype/js/session-store.js`
- `prototype/js/proctor-policy.js`
- `prototype/js/question-data.js`
- `prototype/js/assessment-engine.js`
- `prototype/js/qr.js`
- `prototype/data/questions.json`
- `prototype/exam.html`
- `prototype/js/exam-app.js`
- `prototype/student.html`

---

### Task 1: Lock the New Admin Source Contract Before UI Changes

**Files:**
- Modify: `scripts/prototype-audit.mjs`
- Modify: `tests/prototype.spec.js`
- Read: `prototype/admin.html`
- Read: `prototype/js/admin-app.js`

**Interfaces:**
- Consumes: current admin shell/runtime and existing source-audit selectors.
- Produces: failing tests that describe the intended eight-route IA, exact CDN stack, share controls and no-drawer/no-CSS rules.

- [ ] **Step 1: Add source-audit assertions for the exact admin head dependencies**

Add checks equivalent to:

```js
const adminHtml = read('prototype/admin.html');
for (const token of [
  '@tailwindcss/browser@4',
  'flowbite@4.0.1/dist/flowbite.min.css',
  'flowbite@4.0.1/dist/flowbite.min.js',
  'apexcharts@3.46.0/dist/apexcharts.min.js',
  'simple-datatables@9.0.3'
]) {
  if (!adminHtml.includes(token)) throw new Error(`Admin shell missing ${token}`);
}
for (const forbidden of ['festacol.css', 'academic-v3.css', 'admin-detail-drawer', 'admin-drawer-scrim']) {
  if (adminHtml.includes(forbidden)) throw new Error(`Admin shell contains forbidden layer: ${forbidden}`);
}
```

- [ ] **Step 2: Replace the obsolete QR-only sharing assertion with the new clean-distribution contract**

Keep the existing prohibition on a visible raw URL input, but require copy/share actions in `admin-app.js`:

```js
for (const token of ['Copy address', 'Share examination', 'navigator.share', 'navigator.clipboard']) {
  if (!admin.includes(token)) throw new Error(`Admin sharing contract missing ${token}`);
}
if (admin.includes('input[readonly][value*="http"]')) {
  throw new Error('Admin must not render a raw examination URL field.');
}
```

Do not keep `Copy exam link` as the product label; use **Copy address**.

- [ ] **Step 3: Add Playwright navigation tests for eight top-level routes and the legacy users alias**

Add assertions equivalent to:

```js
await expect(page.locator('#desktop-nav [data-admin-route]')).toHaveCount(8);
for (const route of ['overview','students','staff','exams','classes','questions','reports','settings']) {
  await page.goto(`/prototype/admin.html?page=${route}`);
  await expectNoHorizontalOverflow(page);
}
await page.goto('/prototype/admin.html?page=users');
await expect(page).toHaveURL(/page=students/);
```

- [ ] **Step 4: Add failing tests for Students/Staff separation and anchored notifications**

```js
await page.goto('/prototype/admin.html?page=students');
await expect(page.getByText('Examination Administrator', { exact: true })).toHaveCount(0);
await page.goto('/prototype/admin.html?page=staff');
await expect(page.getByText('Amina Yusuf Bello', { exact: true })).toHaveCount(0);
await page.locator('#admin-notifications').click();
await expect(page.locator('#notification-popover')).toBeVisible();
await expect(page.locator('#admin-dialog[open]')).toHaveCount(0);
```

- [ ] **Step 5: Run the focused static and browser tests and confirm they fail for the intended reasons**

Run:

```bash
node scripts/prototype-audit.mjs
npx playwright test tests/prototype.spec.js --project=chromium --grep "admin|Students|Staff|notification"
```

Expected: failures for missing ApexCharts/Simple-DataTables, missing new routes/alias behavior, missing share controls and missing anchored popover.

- [ ] **Step 6: Commit the contract-first tests**

```bash
git add scripts/prototype-audit.mjs tests/prototype.spec.js
git commit -m "test(admin): Define complete revamp contracts"
```

---

### Task 2: Rebuild the Admin Shell and URL State Model

**Files:**
- Modify: `prototype/admin.html`
- Modify: `prototype/js/admin-app.js`
- Test: `tests/prototype.spec.js`

**Interfaces:**
- Consumes: browser History API, existing `admin-root`, dialogs and shared runtime globals.
- Produces: `readAdminState()`, `buildAdminUrl(state)`, `navigateAdmin(next, options)`, and `syncOverlayFromUrl()` behavior used by all later tasks.

- [ ] **Step 1: Update `admin.html` head and shell**

Keep the required fonts/Tailwind/Flowbite setup and add:

```html
<script src="https://cdn.jsdelivr.net/npm/apexcharts@3.46.0/dist/apexcharts.min.js"></script>
<script src="https://cdn.jsdelivr.net/npm/simple-datatables@9.0.3"></script>
```

Retain the supplied two inline style blocks. Do not add a stylesheet link for Festacol admin styling.

Add an anchored notification host associated with the bell button, for example:

```html
<div id="notification-popover" role="dialog" aria-label="Notifications" class="absolute right-0 top-full z-50 mt-2 hidden w-[min(22rem,calc(100vw-2rem))] ..."></div>
```

The implementation may use Flowbite popover/dropdown initialization, but the host must remain physically and semantically associated with the trigger.

- [ ] **Step 2: Define one URL-state parser in `admin-app.js`**

Implement a normalized state object with these keys:

```js
{
  page: 'overview',
  view: '',
  tab: '',
  modal: '',
  student: '',
  staff: '',
  exam: '',
  classId: '',
  question: '',
  attempt: '',
  q: '',
  status: '',
  level: '',
  pathway: '',
  subject: '',
  type: '',
  source: ''
}
```

Normalize `page=users` to `page=students` with `replaceState` so legacy bookmarks resolve without adding a second history entry.

- [ ] **Step 3: Centralize URL construction and mutation**

Do not hand-build query strings in individual pages. All page/deep-link/modal actions call one helper that preserves unrelated applicable filter state and removes incompatible keys intentionally.

- [ ] **Step 4: Define eight navigation items and render desktop/mobile navigation from the same source**

Use labels:

```js
['overview','Overview']
['students','Students']
['staff','Staff']
['exams','Examinations']
['classes','Classes']
['questions','Question Bank']
['reports','Reports']
['settings','Settings']
```

Use Flowbite Icons SVGs only.

- [ ] **Step 5: Make overlay state reversible through History API**

Opening a record/modal must push URL state. Closing must return to the same parent page/filter state. `popstate` must rerender the page and reopen/close the correct overlay.

- [ ] **Step 6: Define invalid deep-link fallback**

A missing student/exam/class/question/attempt ID clears only the invalid deep-link keys, keeps the parent page/filter state, and shows a nonblocking teacher-facing toast. It must not leave an empty dialog open.

- [ ] **Step 7: Run source and navigation tests**

```bash
node --check prototype/js/admin-app.js
node scripts/prototype-audit.mjs
npx playwright test tests/prototype.spec.js --project=chromium --grep "navigation|dialog|notification"
```

Expected: source/head/navigation tests pass; later feature tests may still fail.

- [ ] **Step 8: Commit shell and navigation state**

```bash
git add prototype/admin.html prototype/js/admin-app.js scripts/prototype-audit.mjs tests/prototype.spec.js
git commit -m "feat(admin): Rebuild shell and deep navigation"
```

---

### Task 3: Separate Students and Staff, Then Make Student Drill-Down Academic

**Files:**
- Modify: `prototype/js/admin-app.js`
- Modify: `tests/prototype.spec.js`

**Interfaces:**
- Consumes: `Store.listUsers()`, `Store.listClasses()`, `Store.attemptsForStudent()`, `Engine.studentHash()`.
- Produces: Students page, Staff page, student deep view and exact student-attempt drill-down used by reports.

- [ ] **Step 1: Write failing tests for page isolation and one-class presentation**

```js
await page.goto('/prototype/admin.html?page=students');
await expect(page.getByText('Examination Administrator', { exact: true })).toHaveCount(0);
await page.locator('[data-student-detail="ST-2401"]').click();
await expect(page.getByText('SS2 Science', { exact: true })).toBeVisible();
await expect(page.getByText(/Exam history/i)).toBeVisible();

await page.goto('/prototype/admin.html?page=staff');
await expect(page.getByText('Examination Administrator', { exact: true })).toBeVisible();
await expect(page.getByText('Amina Yusuf Bello', { exact: true })).toHaveCount(0);
```

- [ ] **Step 2: Implement `studentsPage()` with teacher-friendly filters**

Filters consume only existing metadata: search, level, class/pathway and account status. Student rows/cards show current class, attempt count, submitted average and integrity summary when available.

- [ ] **Step 3: Implement `staffPage()` using only teacher/administrator roles**

Do not reuse the student academic columns for staff. Show identity, role and account status.

- [ ] **Step 4: Build student deep view with tabs controlled by `tab=`**

Tabs:

- Summary
- Examinations
- Performance
- Integrity
- Placement (only when placement data exists)

Exam/attempt buttons deep-link to the exact attempt or exam using query state.

- [ ] **Step 5: Keep user mutation behavior regression-safe**

Retain add/edit/suspend/activate behavior. Editing a student class writes exactly one `classId`; the UI must describe this as a class move, not multi-select membership.

- [ ] **Step 6: Run focused tests**

```bash
npx playwright test tests/prototype.spec.js --project=chromium --grep "Students|Staff|student|class assignment"
```

Expected: isolation, drill-down and existing user mutation tests pass.

- [ ] **Step 7: Commit student/staff separation**

```bash
git add prototype/js/admin-app.js tests/prototype.spec.js
git commit -m "feat(admin): Separate students and staff workflows"
```

---

### Task 4: Redesign Examinations List, Detail, Share and Edit Controls

**Files:**
- Modify: `prototype/js/admin-app.js`
- Modify: `scripts/prototype-audit.mjs`
- Modify: `tests/prototype.spec.js`

**Interfaces:**
- Consumes: `Store.listSessions()`, `Store.attemptsForSession()`, `Store.getSessionLink()`, `Proctor.decorateStudentLink()`, `QR.render()`.
- Produces: examination list filters, examination deep view, clean distribution actions and lifecycle controls.

- [ ] **Step 1: Add failing tests for distribution actions and lifecycle controls**

After creating an exam, require:

```js
await expect(page.locator('#exam-detail-qr svg')).toBeVisible();
await expect(page.getByText('Exam ID', { exact: true })).toBeVisible();
await expect(page.getByRole('button', { name: 'Copy address' })).toBeVisible();
await expect(page.getByRole('button', { name: 'Share examination' })).toBeVisible();
await expect(page.locator('input[readonly][value*="http"]')).toHaveCount(0);
```

Also retain close/reopen, duplicate, delete, edit, reset unfinished and authorize rewrite coverage.

- [ ] **Step 2: Implement examination list filters**

Support search + status + level + purpose using query parameters. Use responsive cards on mobile and a table/data table on desktop when useful.

- [ ] **Step 3: Rebuild examination detail around Distribute / Control / Candidates / Results**

Use tabs or clear sections, not a side sheet. Preserve exact attempt links and show active/submitted/previous counts.

- [ ] **Step 4: Add clean copy and native share helpers**

Implement:

```js
async function copyExamAddress(session) {
  const url = directExamLink(session);
  await navigator.clipboard.writeText(url);
}

async function shareExam(session) {
  const url = directExamLink(session);
  if (navigator.share) {
    await navigator.share({ title: session.title, text: `Festacol examination: ${session.title}`, url });
    return;
  }
  await navigator.clipboard.writeText(url);
}
```

Catch rejected Web Share/clipboard operations and report a nontechnical error toast. User cancellation of Web Share should not be shown as a destructive error.

- [ ] **Step 5: Preserve structural edit locking after an attempt starts**

Retain test selectors `#exam-edit-count`, `#exam-edit-duration`, `#exam-edit-title`, `#exam-edit-camera` and explain locked fields with helper text.

- [ ] **Step 6: Run existing and new examination tests**

```bash
node scripts/prototype-audit.mjs
npx playwright test tests/prototype.spec.js --project=chromium --grep "exam|rewrite|settings|share|QR"
```

Expected: old rewrite/edit semantics and new share/distribution behavior pass.

- [ ] **Step 7: Commit examination management redesign**

```bash
git add prototype/js/admin-app.js scripts/prototype-audit.mjs tests/prototype.spec.js
git commit -m "feat(admin): Redesign examination management"
```

---

### Task 5: Rebuild the Five-Stage Examination Builder

**Files:**
- Modify: `prototype/js/admin-app.js`
- Modify: `tests/prototype.spec.js`

**Interfaces:**
- Consumes: `Data.subjectCatalog`, `data.questions`, `Store.TRACKS`, `Store.saveSession()`, `Proctor.setAdminPolicy()`.
- Produces: compatible session objects using existing `qualifier|mixed|single|waec` values.

- [ ] **Step 1: Add failing builder tests for teacher-facing copy and internal compatibility**

Test that the button/card says **SS1 Entrance & Placement Exam** but saved mode remains `qualifier`:

```js
await page.getByRole('button', { name: /SS1 Entrance & Placement Exam/i }).click();
// complete the flow
const stored = await page.evaluate(() => window.FestacolSessionStore.listSessions()[0]);
expect(stored.mode).toBe('qualifier');
expect(stored.classLevel).toBe('SS1');
```

- [ ] **Step 2: Implement step 1, Purpose & Audience**

Use large selectable Flowbite-style cards with circular selected indicators. Preserve internal mode values. Entrance mode hard-locks level to SS1 in presentation because the store already requires it.

- [ ] **Step 3: Implement step 2, Coverage**

Use available subjects from real question metadata. Mixed mode requires at least two; single/waec one; entrance uses `q-*` domains and at least one placement track.

- [ ] **Step 4: Implement step 3, Paper**

Retain selectors `#duration-range` and `#question-count-range`, min/max 30–10800 seconds and 5–150 questions. Show live matching inventory and block Continue when fewer than five matching questions exist or selected count exceeds inventory.

- [ ] **Step 5: Implement step 4, Integrity**

Retain `[data-proctor-camera]` and integrity policy controls. Use accessible toggles/check controls and preserve warn-after limits.

- [ ] **Step 6: Implement step 5, Review & Publish**

Summarize every value that will be saved. Keep the Create button disabled/blocked if state became invalid through previous navigation.

- [ ] **Step 7: Add motion and focus behavior**

Use the existing `.page-enter`/reduced-motion contract. After step change, focus the step heading or first invalid field instead of silently rerendering below the viewport.

- [ ] **Step 8: Run builder and camera tests**

```bash
npx playwright test tests/prototype.spec.js --project=chromium --grep "wizard|builder|camera|Entrance"
```

Expected: 5–150, camera requirement, matching inventory and internal qualifier compatibility pass.

- [ ] **Step 9: Commit builder redesign**

```bash
git add prototype/js/admin-app.js tests/prototype.spec.js
git commit -m "feat(admin): Rebuild examination builder"
```

---

### Task 6: Reorganize Classes and Entrance Placement Capacity

**Files:**
- Modify: `prototype/js/admin-app.js`
- Modify: `tests/prototype.spec.js`

**Interfaces:**
- Consumes: `Store.listClasses()`, `Store.listUsers()`, `Store.listWhatsAppGroups()`, submitted attempts with `placement`.
- Produces: level/pathway class board, class detail and derived Entrance placement-capacity view.

- [ ] **Step 1: Add failing tests that the legacy qualifier pool is not displayed as a classroom**

```js
await page.goto('/prototype/admin.html?page=classes');
await expect(page.getByText('SS1 Qualifier Pool', { exact: true })).toHaveCount(0);
await expect(page.getByText('SS1 Science', { exact: true })).toBeVisible();
```

- [ ] **Step 2: Implement class grouping by level and pathway**

Show SS1, SS2 and SS3 groups with capacity, occupancy, available places and WhatsApp status. Occupancy is:

```js
Store.listUsers().filter(user => user.role === 'student' && user.classId === classItem.id).length
```

- [ ] **Step 3: Preserve class create/edit/delete and WhatsApp mapping**

Do not allow destructive deletion to silently orphan a currently assigned student. Before deletion, derive assigned-student count and disable/reject delete with a clear teacher-facing message when nonzero.

- [ ] **Step 4: Build an Entrance admissions summary from existing data**

For SS1 Science/Arts/Social Science show:

```js
{
  capacity: classItem.capacity,
  enrolled: studentCount,
  available: Math.max(0, classItem.capacity - studentCount),
  recommended: submittedEntranceAttempts.filter(a => a.placement?.assignedTrack === classItem.stream).length
}
```

Do not persist a new admissions-slot model.

- [ ] **Step 5: Deep-link class cards to class detail and report**

Class detail must include student list and `Reports` action with `?page=reports&view=class&class=<id>`.

- [ ] **Step 6: Run class and WhatsApp tests**

```bash
npx playwright test tests/prototype.spec.js --project=chromium --grep "class|WhatsApp|Entrance"
```

Expected: legacy pool presentation is removed, class membership stays singular, WhatsApp validation remains green.

- [ ] **Step 7: Commit class/admissions presentation**

```bash
git add prototype/js/admin-app.js tests/prototype.spec.js
git commit -m "feat(admin): Organize classes and entrance capacity"
```

---

### Task 7: Turn Question Bank Into a Real Management Workspace Without Faking Base Edits

**Files:**
- Modify: `prototype/js/admin-app.js`
- Modify: `tests/prototype.spec.js`

**Interfaces:**
- Consumes: `data.questions`, `data.subjectCatalog`, `Engine.answerDisplay()`, `Store.listCustomQuestions()`, `Store.saveCustomQuestion()`, `Store.deleteCustomQuestion()`.
- Produces: filterable question inventory, deliberate answer reveal, custom-question editor and honest base-question read-only state.

- [ ] **Step 1: Add failing question-management tests**

Cover filters and answer reveal:

```js
await page.goto('/prototype/admin.html?page=questions&level=SS2&subject=mat&type=single');
expect(await page.locator('[data-question-row]').count()).toBeGreaterThan(0);
await page.locator('[data-question-detail]').first().click();
await expect(page.getByText(/Correct answer/i)).toHaveCount(0);
await page.getByRole('button', { name: 'Reveal answer' }).click();
await expect(page.getByText(/Correct answer/i)).toBeVisible();
```

Add one base question assertion that no fake Save/Edit action is offered and one custom-question assertion that editing persists through `Store.saveCustomQuestion()`.

- [ ] **Step 2: Implement real-metadata filter state**

Filters: search, level, subject, mode, response type, source. Do not add a pathway filter unless the displayed value is explicitly derived and labeled as such.

- [ ] **Step 3: Implement base/custom badges and detail**

Base records show **Built-in question**; custom records show **Teacher question**. Include levels, subject/domain, compatible exam purpose and response format.

- [ ] **Step 4: Implement answer reveal as explicit local state**

Do not put the answer in the initial visible markup. On Reveal answer, call `Engine.answerDisplay(question)` and render it. Explain in Settings/prototype boundary that answers remain client-inspectable in this prototype.

- [ ] **Step 5: Implement custom-question create/edit/delete**

Editing a custom question calls `Store.saveCustomQuestion()` with the same numeric `id`. Do not offer persisted base-question editing in this PR.

- [ ] **Step 6: Make large-inventory UI ready for ~500 questions**

Use Simple-DataTables for desktop question inventory after render and destroy the prior instance before rerender. Mobile uses cards/list rows. Display the real `data.questions.length` count.

- [ ] **Step 7: Run question tests**

```bash
npx playwright test tests/prototype.spec.js --project=chromium --grep "Question|question|answer"
```

Expected: filters, answer reveal, custom edit and base read-only behavior pass.

- [ ] **Step 8: Commit question management redesign**

```bash
git add prototype/js/admin-app.js tests/prototype.spec.js
git commit -m "feat(admin): Upgrade question bank management"
```

---

### Task 8: Build Relationship-Based Reports With ApexCharts and Data Tables

**Files:**
- Modify: `prototype/js/admin-app.js`
- Modify: `tests/prototype.spec.js`

**Interfaces:**
- Consumes: sessions, users, classes and attempt fields `score`, `subjectStats`, `placement`, `integrityScore`, `integrityEvents`, `submittedAt`, `rewriteArchivedAt`.
- Produces: report views and reusable `mountChart`, `destroyCharts`, `mountDataTable`, `destroyDataTables` lifecycle helpers.

- [ ] **Step 1: Add failing report drill-down tests**

Seed/produce submitted attempts and verify:

```js
await page.goto(`/prototype/admin.html?page=reports&view=exam&exam=${id}`);
await expect(page.locator('[data-report-chart]')).toBeVisible();
await page.locator('[data-attempt-detail]').first().click();
await expect(page.getByText('Integrity / proctor log')).toBeVisible();
```

Add class, student and integrity deep-link cases.

- [ ] **Step 2: Define one analytics derivation layer inside `admin-app.js`**

Pure helper functions should derive:

- submitted current attempts: `submittedAt && !rewriteArchivedAt`
- averages
- score bands
- class/pathway groupings
- subject-stat aggregates
- merit ordering with ties preserved
- placement counts
- integrity event list

Do not write synthetic fallback values when arrays are empty.

- [ ] **Step 3: Implement chart lifecycle helpers**

```js
const chartInstances = new Map();
function destroyCharts() {
  for (const chart of chartInstances.values()) chart.destroy();
  chartInstances.clear();
}
```

Call cleanup before route rerender. Create charts only for visible report sections.

- [ ] **Step 4: Implement reports**

Views: overview, class, pathway, exam, student, merit, placements, integrity. Use a chart only where it clarifies comparison/trend/distribution; keep record detail in table/list form.

- [ ] **Step 5: Implement data-table lifecycle for dense desktop result grids**

Destroy/recreate Simple-DataTables as routes change. Do not initialize hidden mobile tables that are not intended for interaction.

- [ ] **Step 6: Add accessible chart context**

Every chart container has a meaningful heading/description and a table/list alternative nearby for exact values. Do not rely on chart color alone.

- [ ] **Step 7: Run report tests**

```bash
npx playwright test tests/prototype.spec.js --project=chromium --grep "report|performance|merit|integrity|placement"
```

Expected: report drill-down, exact attempt relationship and empty-state behavior pass.

- [ ] **Step 8: Commit reports**

```bash
git add prototype/js/admin-app.js tests/prototype.spec.js
git commit -m "feat(admin): Add academic performance reports"
```

---

### Task 9: Finish Notifications, Feedback, Responsive States and Accessibility

**Files:**
- Modify: `prototype/admin.html`
- Modify: `prototype/js/admin-app.js`
- Modify: `tests/prototype.spec.js`

**Interfaces:**
- Consumes: all page/workflow renderers from Tasks 2–8.
- Produces: consistent final interaction quality across viewports.

- [ ] **Step 1: Add failing tests for notification placement, focus and responsive bounds**

Validate 390×844, 820×1000 and 1440×1000. Verify notification popover bounding box remains close to the bell button and the centered admin dialog is not opened.

- [ ] **Step 2: Centralize toast/alert/confirmation patterns**

All store mutation failures display teacher-friendly messages. Destructive actions use one confirmation modal pattern with backdrop blur. Successful mutations use toasts.

- [ ] **Step 3: Add keyboard/focus restoration**

- Escape closes modal/popover where appropriate.
- Closing an overlay restores trigger focus when possible.
- Route transitions focus the page heading/main landmark.
- Invalid builder submission focuses the first invalid control.

- [ ] **Step 4: Verify touch targets and form labels**

Icon buttons use at least `size-10`/equivalent and all have accessible names. Inputs/selects/textareas have explicit visible labels.

- [ ] **Step 5: Verify reduced-motion behavior**

Keep supplied reduced-motion block and avoid JavaScript-only animations that ignore the preference.

- [ ] **Step 6: Run responsive and accessibility-oriented browser checks**

```bash
npx playwright test tests/prototype.spec.js --project=chromium --grep "mobile|dialog|overflow|notification|keyboard"
```

Expected: no horizontal overflow and all modal/popover bounds/focus behaviors pass.

- [ ] **Step 7: Commit final interaction polish**

```bash
git add prototype/admin.html prototype/js/admin-app.js tests/prototype.spec.js
git commit -m "fix(admin): Complete responsive interaction polish"
```

---

### Task 10: Full Regression, Independent Review, Dogfood and Release Gate

**Files:**
- Review all changed files.
- No new production files expected.

**Interfaces:**
- Consumes: complete implementation and validation suite.
- Produces: release evidence for Git/PR handoff.

- [ ] **Step 1: Re-open and inspect every changed file**

Expected production diff remains limited to:

```text
prototype/admin.html
prototype/js/admin-app.js
```

Expected supporting validation diff may include:

```text
scripts/prototype-audit.mjs
tests/prototype.spec.js
```

No unexpected shared runtime/data file may appear.

- [ ] **Step 2: Run static/source contract checks**

```bash
for file in prototype/js/*.js; do node --check "$file"; done
node --check scripts/prototype-audit.mjs
node --check scripts/state-contract.mjs
node --check tests/prototype.spec.js
npm run check
```

Expected: PASS.

- [ ] **Step 3: Run the full Chromium suite**

```bash
npm run test:e2e -- --project=chromium
```

Expected: PASS with no failed tests.

- [ ] **Step 4: Independent Test Engineer challenge**

Independently verify happy path, failure path and regression-sensitive behavior for:

- Entrance Exam creation
- Standard exam creation
- share/copy fallback
- student/staff isolation
- class assignment
- custom question edit + answer reveal
- attempt reset/rewrite
- report deep links
- mobile/tablet/desktop overlays

A green preexisting suite is insufficient if any new acceptance criterion is untested.

- [ ] **Step 5: Independent Code Reviewer verdict**

Reviewer inspects the full diff plus shared dependencies and returns `APPROVE` or `APPROVE WITH NON-BLOCKING NOTES`. Any blocking finding routes back to the owning implementation task.

- [ ] **Step 6: Integration/Dogfood browser pass**

Exercise as a teacher:

1. Open Overview.
2. Open notification popover.
3. Find a student and drill into an exam attempt/integrity log.
4. Create an Entrance Exam.
5. Create a standard class exam.
6. Copy/share the exam address.
7. Open exam detail and edit settings.
8. Inspect classes/capacity.
9. Filter/reveal/edit a question as permitted.
10. Open class/exam/student/integrity reports.
11. Repeat critical flows at mobile/tablet/desktop widths.

Capture any reproducible blocking issue before Git handoff.

- [ ] **Step 7: Git/Release pre-commit gate**

```bash
git status
git diff --stat master...HEAD
git diff master...HEAD -- prototype/admin.html prototype/js/admin-app.js scripts/prototype-audit.mjs tests/prototype.spec.js
git log master..HEAD --oneline
```

Verify no secrets, temporary diagnostics, generated browser artifacts, unrelated files or placeholder logic.

- [ ] **Step 8: Final implementation PR**

Use a conforming title such as:

```text
feat(admin): Complete academic administration revamp
```

PR body lists exact validation commands/results and explicitly notes that the 500-question scored-bank expansion remains a separate follow-up unless its scope was separately approved.

---

## Deferred Dependent Workstream: 500-Question Scored Bank

This work is deliberately **not** part of the two-file admin implementation plan.

A separate approved scope should modify at minimum:

- `prototype/data/questions.json`
- `prototype/js/assessment-engine.js`
- `prototype/js/question-data.js` only if new metadata/schema is required
- `scripts/prototype-audit.mjs`
- `scripts/state-contract.mjs`
- `tests/prototype.spec.js`

That follow-up must ensure every scored question has a compatible answer key and class/mode/subject metadata, with a balanced coverage matrix for Entrance/SS1/SS2/SS3 and Science/Arts/Social Science/common subjects. The admin page must continue to report the actual loaded inventory size until the data PR is merged.

## Plan Self-Review Record

- Spec coverage: every product requirement in the design spec maps to Tasks 1–10 or the explicit deferred bank workstream.
- Production scope consistency: only `admin.html` and `admin-app.js` are production admin mutation targets.
- Compatibility consistency: no task renames internal `qualifier`, expands mode enums, changes session payload versions, or changes candidate runtime files.
- Validation consistency: source contract and E2E tests are changed before/with behavior and never removed to force green output.
- Completeness scan: every implementation task contains explicit files, behavior, verification commands and expected outcomes.
