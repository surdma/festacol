# Festacol Admin Experience Complete Revamp Design

**Date:** 2026-09-12  
**Status:** Planning specification  
**Repository baseline:** `master` at `43313acc38ba682a66bda3706ac444d905da7844`  
**Primary surface:** `/prototype/admin.html`  
**Primary runtime:** `/prototype/js/admin-app.js`

## 1. Purpose

Redesign the Festacol prototype administration experience into a coherent, teacher-friendly academic and examination workspace without changing the established candidate exam runtime or the browser-local prototype architecture.

The admin experience must make the relationship between **student → examination → attempt → score → integrity log → placement/performance analytics** explicit. It must also separate student management from staff management, make class/pathway administration understandable to school staff, and turn examination creation and question-bank management into structured workflows rather than generic CRUD screens.

This is a prototype/product-design revamp, not a backend, authentication, database, or deployment project.

## 2. Verified Repository Baseline

The specification is based on the current repository, not prior chat claims.

- `prototype/admin.html` is a Tailwind CSS v4 + Flowbite shell with desktop navigation, mobile navigation dialog, one general admin dialog, an alert host, and a toast stack.
- `prototype/js/admin-app.js` is the single admin runtime expected by the current source audit.
- `prototype/js/session-store.js` owns browser-local examination sessions, attempts, users, classes, WhatsApp group mappings, custom questions, reset/rewrite semantics, and one `classId` per user.
- Internal examination modes are `qualifier`, `mixed`, `single`, and `waec`. Existing encoded session payloads depend on these identifiers and must remain compatible.
- `qualifier` is constrained to SS1 and placement-domain subjects, and placement tracks are Science, Arts, and Social Science.
- Session question count is currently constrained to 5–150, attempt limit is one, and submitted-attempt rewrite preserves the prior submission through `rewriteArchivedAt`.
- `prototype/js/question-data.js` loads `prototype/data/questions.json`, validates the shared catalogue, and merges locally authored custom questions.
- `prototype/js/assessment-engine.js` currently contains scored answer keys for question IDs 1–43 and the placement weighting logic.
- `scripts/prototype-audit.mjs`, `scripts/state-contract.mjs`, and `tests/prototype.spec.js` form the existing contract and browser regression gates.

## 3. Scope Boundary

### 3.1 Production runtime files in scope

The admin revamp must change only these production-facing admin files:

1. `prototype/admin.html`
2. `prototype/js/admin-app.js`

No standalone admin CSS file may be created or loaded.

### 3.2 Validation files may change

The following non-production validation files may be updated when selectors or intentional product contracts change:

- `scripts/prototype-audit.mjs`
- `tests/prototype.spec.js`

`tests` and source-audit changes must validate the new behavior rather than weaken existing guarantees.

### 3.3 Shared runtime files are compatibility dependencies, not revamp targets

The revamp must consume, not rewrite, these contracts:

- `prototype/js/session-store.js`
- `prototype/js/proctor-policy.js`
- `prototype/js/question-data.js`
- `prototype/js/assessment-engine.js`
- `prototype/js/qr.js`
- `prototype/data/questions.json`
- `prototype/exam.html`
- `prototype/js/exam-app.js`
- `prototype/student.html`
- `prototype/js/student-dashboard.js`

Any requirement that needs those files to change is a separate follow-up scope and must not be disguised as part of the two-file admin revamp.

## 4. Non-Negotiable Frontend Stack

`prototype/admin.html` must include the specified resources and preserve the exact product direction:

- Google Fonts: DM Sans 400/500/600/700 and Manrope 500/600/700/800.
- Tailwind CSS browser v4: `https://cdn.jsdelivr.net/npm/@tailwindcss/browser@4`.
- Flowbite 4.0.1 CSS and JavaScript.
- ApexCharts 3.46.0: `https://cdn.jsdelivr.net/npm/apexcharts@3.46.0/dist/apexcharts.min.js`.
- Simple-DataTables 9.0.3: `https://cdn.jsdelivr.net/npm/simple-datatables@9.0.3`.
- The supplied inline `type="text/tailwindcss"` theme block with DM Sans/Manrope, smooth scrolling, page-entry motion, and reduced-motion handling.
- The supplied small inline structural style block for surfaces, metric strips, icon buttons, queue rows, chart tooltip border/shadow, and responsive metric-strip behavior.

No additional CSS file is permitted for the admin page. New visual styling should primarily use Tailwind v4 utilities. Inline CSS must remain limited to the supplied design primitives or a narrowly justified browser behavior that Tailwind/Flowbite cannot express.

## 5. Component Policy

Do not reimplement standard UI primitives that Flowbite already provides.

Use Flowbite component patterns for:

- Sidebar/navigation shell
- Buttons and button groups
- Cards
- Badges
- Alerts
- Avatar
- Breadcrumbs
- Dropdowns
- Popovers
- Modals and destructive confirmations
- Tabs
- Tables
- Forms, inputs, selects, textareas, checkboxes, radios, toggles and range controls
- Tooltips
- Progress indicators
- Stepper patterns
- Toast feedback

Use Flowbite Icons SVGs for interface icons. Do not guess icon paths or mix icon families. When an icon is needed during implementation, fetch or copy the matching SVG from `https://flowbite.com/icons/` and preserve its accessible label at the button level.

Use Simple-DataTables for genuinely large or filter-heavy desktop tables. Use ApexCharts for analytical visualizations. Do not use charts as decorative dashboard filler.

## 6. Visual and Interaction Direction

The admin should feel like a focused school operations console: restrained black/white primary palette, neutral surfaces, clear hierarchy, high information density without clutter, and academic terminology rather than technical/developer language.

### 6.1 Layout

- Keep one stable desktop navigation sidebar.
- Do not use side drawers/sheets for record detail, editing, or report drill-down.
- On mobile, navigation remains a modal/off-canvas navigation control only.
- Record details use deep-linked modal/dialog or full page state, depending on information density.
- Primary page content uses a wide but bounded container with responsive cards/tables.

### 6.2 Motion

- Meaningful transitions: 150–300 ms.
- Animate opacity/transform where possible, not layout dimensions.
- Step changes in the exam builder should indicate progression, not decorate the interface.
- Respect `prefers-reduced-motion` and disable nonessential motion.

### 6.3 Accessibility

- WCAG AA contrast target for normal text.
- Visible keyboard focus indicators.
- Minimum comfortable touch target approximately 44×44 px.
- No icon-only control without `aria-label` or visible text.
- Form controls require visible labels and inline errors.
- Do not communicate status by color alone.
- Modal/dialog flows must support Escape and predictable focus restoration.

## 7. Information Architecture

The current combined “Students & staff” mental model is replaced by distinct teacher-facing areas.

### 7.1 Top-level admin routes

1. **Overview** — academic/exam operations summary and actionable queue.
2. **Students** — student accounts, current class, exams, results, merit, integrity and admission/placement history.
3. **Staff** — teacher and administrator records only. Student records never appear here.
4. **Examinations** — exam lifecycle, distribution, candidates, results, rewrite controls and per-exam analytics.
5. **Classes** — SS1/SS2/SS3 class/pathway organization, capacity, occupancy and class communication mapping.
6. **Question Bank** — question inventory, filters, authoring, answer review and compatibility visibility.
7. **Reports** — class, pathway/category, exam, student, merit, entrance-placement and integrity analytics.
8. **Settings** — browser-local prototype controls and explicit prototype limitations.

### 7.2 Compatibility route

The existing `?page=users` URL should remain a compatibility alias that resolves to the Students page. The implementation and tests may update the visible route count from seven to eight, but old bookmarks must not dead-end.

## 8. Query-Parameter Navigation Contract

Admin state that a teacher may reasonably bookmark, share internally, navigate back to, or restore after refresh must be represented in the URL.

### 8.1 Canonical page examples

- `admin.html?page=overview`
- `admin.html?page=students`
- `admin.html?page=staff`
- `admin.html?page=exams`
- `admin.html?page=classes`
- `admin.html?page=questions`
- `admin.html?page=reports&view=overview`
- `admin.html?page=settings`

### 8.2 Deep record examples

- `?page=students&student=ST-2401&tab=exams`
- `?page=exams&exam=ABC123&tab=candidates`
- `?page=classes&class=ss2-science`
- `?page=questions&question=43`
- `?page=reports&view=class&class=ss2-science`
- `?page=reports&view=exam&exam=ABC123`
- `?page=reports&view=student&student=ST-2401`
- `?page=reports&view=integrity&attempt=<attemptHash>`

### 8.3 Modal examples

- `modal=create-exam`
- `modal=edit-exam&exam=ABC123`
- `modal=attempt&attempt=<attemptHash>`
- `modal=question&question=43`
- `modal=edit-question&question=100001`
- `modal=class&class=ss2-science`

Rules:

- Opening a deep modal pushes browser history.
- Closing a deep modal removes only the modal-specific parameters and preserves page/filter state.
- Back/forward must reopen/close the correct modal and restore the selected tab/view.
- Invalid/missing IDs must fall back to the parent page with a nonblocking error toast/alert, never a broken blank dialog.

## 9. Notifications and Contextual Help

The notification control must use an anchored popover/dropdown positioned beside the bell button. It must never open as a centered modal.

The popover may include:

- Draft examinations requiring attention
- Active attempts
- Exams approaching close time when derivable from existing session data
- Entrance Exam capacity warnings when derivable from class capacities and placement results
- Integrity exceptions requiring review

Contextual explanations that are short and local should use tooltip/popover patterns. Long workflows should use the normal page or modal structure.

## 10. Students and Staff

### 10.1 Students

Students are the central academic relationship entity. The student directory should support:

- Search by name/student ID.
- Filter by SS level, current pathway/class, account status and performance status where data exists.
- Current class shown as exactly one class assignment because the store owns a single `classId`.
- Direct drill-down to student profile.

Student profile sections:

- Identity and current class
- Examination history
- Current/in-progress examination state
- Scores and subject performance
- Merit/performance summary derived from submitted attempts
- Entrance Exam placement result when present
- Integrity summary and exact attempt logs
- Rewrite history

The product must not imply a student can simultaneously belong to Science, Arts and Social Science classes. Reassignment is a move from one class to another.

### 10.2 Staff

Staff is a separate page showing only `teacher` and `administrator` roles.

Do not display student performance, exam history or placement analytics as if they were staff attributes.

## 11. Classes and Pathways

Organize classes first by level (SS1, SS2, SS3), then by school pathway/group such as Science, Arts, Social Science and General where records exist.

Each class summary should show:

- Class name and level
- Pathway/group
- Capacity
- Current occupancy derived from student `classId`
- Available places
- Room/location if present
- WhatsApp group mapping status
- Student list drill-down
- Class performance report link

### 11.1 Entrance candidate pool is not presented as a normal class

The existing `ss1-qualifier` record is a legacy/internal staging representation. The new UI must present it as admissions/entrance activity, not as a normal SS1 classroom alongside Science/Arts/Social Science.

Do not delete or migrate the internal record in the two-file revamp. Hide/reinterpret it at the admin presentation layer for compatibility.

## 12. Entrance Exam Product Model

The teacher-facing term is **SS1 Entrance & Placement Exam**. Do not show “Qualifier” as the primary product term.

The internal mode remains `qualifier` so encoded exam links, scoring, placement weighting and stored sessions remain compatible.

### 12.1 Purpose

This exam is for incoming students at JSS3/BECE level who are seeking admission into SS1. It measures foundational readiness and produces a placement recommendation among Science, Arts and Social Science using the current placement engine.

### 12.2 Creation should be intentionally lighter

Unlike a normal class assessment, the Entrance Exam should require minimal teacher setup:

1. Admission session/title
2. Eligible placement pathways
3. Question count and duration
4. Integrity/camera controls
5. Review and publish

Foundational entrance subjects should be sensible defaults from the existing `q-*` subject catalogue.

### 12.3 Capacity and outcomes

The admin should derive pathway capacity from existing SS1 pathway classes rather than invent a new persistent admissions database.

For each pathway display where the current prototype has enough data:

- Capacity
- Current enrolled occupancy
- Available places
- Number of Entrance Exam candidates recommended for the pathway
- Number already assigned to that pathway

Candidate outcome labels should distinguish:

- Recommended pathway
- Assigned/placed when the student’s current class matches a pathway
- Awaiting placement where recommendation exists but no matching class assignment exists

Do not invent “failed” solely because a candidate was not assigned to Science. A candidate can be recommended to Arts or Social Science based on the placement output. Any future pass/fail threshold policy requires a separate explicit rule in the shared domain contract.

## 13. Examination Management

### 13.1 Examination list

Provide useful filters:

- Status: open, scheduled, draft, closed
- Level: SS1/SS2/SS3
- Type/purpose
- Class/pathway
- Search by title/Exam ID

Rows/cards should expose title, audience, question count, duration, candidate/submission counts, status and an obvious route to detail.

### 13.2 Examination detail

The examination detail experience must be redesigned around four teacher jobs:

1. **Distribute** — QR, Exam ID, Copy address, Share.
2. **Control** — open/close, integrity/camera settings, editable delivery settings.
3. **Monitor** — candidate progress and active attempts.
4. **Review** — scores, merit, integrity logs, rewrite history and analytics.

Required actions retained from existing behavior:

- Edit settings
- Close/reopen examination
- Duplicate as draft
- Delete session definition while retaining attempt history
- Reset unfinished attempt
- Authorize rewrite for submitted attempt while preserving the prior submission

### 13.3 Share and copy

The previous QR-only source audit is superseded by this product requirement.

- Keep QR and Exam ID prominent.
- Add a copy icon/action that copies the generated examination URL without displaying a giant raw URL field.
- Add a Share action using `navigator.share` when available.
- Provide clipboard copy fallback when Web Share is unavailable.
- Keep teacher-facing copy concise: **Copy address** and **Share examination**.

Update source-audit/browser tests so they validate secure/clean presentation rather than forbidding all sharing capability.

### 13.4 Edit lock behavior

Once any candidate has started an examination, fields that would change paper identity or fairness remain structurally locked according to existing behavior. Delivery/settings fields that are already safely editable remain editable.

The UI must explain why a field is locked rather than merely disabling it.

## 14. Examination Builder

Use a high-quality five-stage stepper with sticky actions and clear validation.

### Stage 1: Purpose & Audience

Teacher chooses:

- SS1 Entrance & Placement Exam (`qualifier` internally)
- Class assessment (single/mixed depending subject selection)
- Senior external-exam practice using the compatible existing mode

Then choose the relevant level/class/pathway where supported.

Do not create unsupported backend modes for NECO or JAMB. The current shared runtime only has a `waec` senior-practice mode. The admin may describe the desired academic standard more broadly, but stored mode values must remain valid.

### Stage 2: Coverage

- Subject cards/selection controls
- Entrance pathways for Entrance Exam
- Available-question count shown before continuation
- Only subjects compatible with selected class level/mode are selectable

### Stage 3: Paper

- Duration range 30 seconds–3 hours, retaining current contract
- Question count range 5–150, retaining current contract
- Live matching-question count
- Candidate instructions
- Clear inline validation when requested count exceeds matching inventory

### Stage 4: Integrity

- Tab/window monitoring
- Fullscreen prompt
- Clipboard guard
- Candidate camera requirement
- Warn-after threshold
- Initial status

Use Flowbite-style toggles/check controls with circle-check selected states where appropriate.

### Stage 5: Review & Publish

Summarize:

- Title
- Audience
- Purpose
- Subjects
- Question count
- Duration
- Integrity policy
- Camera requirement
- Available question inventory
- Initial status

Creation must be impossible while required selections are invalid or insufficient matching questions exist.

## 15. Question Bank

### 15.1 Inventory experience

Question Bank should be an academic management tool, not a raw list.

Filters should cover the metadata the existing question contracts actually expose:

- Search prompt/label/domain
- Class level: SS1/SS2/SS3
- Subject
- Examination mode/purpose
- Response type: single choice, multiple choice, true/false, fill, fill-multi
- Custom/base source

Where pathway relevance can only be inferred from subjects rather than stored explicitly, label it as inferred or omit the filter rather than fabricating metadata.

### 15.2 Detail and answer reveal

Question detail shows:

- Class level(s)
- Subject/domain
- Exam compatibility
- Response type
- Prompt
- Diagram indicator when present
- Options/blank structure

The administrator may explicitly reveal the correct answer through the existing assessment engine. The answer should be hidden by default and exposed only after a deliberate **Reveal answer** action.

### 15.3 Editing contract

Within the two-file admin scope:

- Locally authored custom questions may be created, edited by saving an updated custom record, and deleted.
- Base questions from `questions.json` are inspectable but cannot be truthfully persisted as edited without changing the shared data source.
- Base answer keys cannot be truthfully changed without changing `assessment-engine.js`.

The UI must not show a Save action for a base question that pretends to persist when the shared data remains unchanged.

## 16. 500-Question Scored Bank: Separate Follow-Up Workstream

The desired target is a large question bank of approximately 500 valid, scored questions with academic-level alignment:

- Entrance/placement: JSS3/BECE-level readiness for incoming SS1
- SS1: SS1-appropriate content only
- SS2: SS2-appropriate content only
- SS3: senior-secondary content aligned with WAEC/NECO/JAMB style while respecting taught level and subject/pathway
- Common subjects available across pathways where academically appropriate
- Science-only, Arts-only and Social-Science-specific subjects not incorrectly offered to unrelated pathways

This cannot be completed honestly by changing only `admin.html` and `admin-app.js` because:

- Base questions live in `prototype/data/questions.json`.
- Validation/eligibility logic lives in `prototype/js/question-data.js`.
- Automatic scoring keys currently live in `prototype/js/assessment-engine.js`.

Therefore the 500-question bank must be a separate dependent PR with explicit permission to change those shared files and their tests. The admin revamp should be built to handle a 500-question catalogue, but it must report the real inventory size until that follow-up lands.

## 17. Reports and Analytics

Reports must be based on real attempt/session/class relationships. No placeholder or fabricated chart series.

### 17.1 Report views

1. **Overview** — submitted attempts, average score, completion, integrity exceptions, recent trends where data exists.
2. **Class performance** — class average, distribution, subject performance, students needing review.
3. **Pathway/category performance** — Science vs Arts vs Social Science class performance where records exist.
4. **Examination performance** — score distribution, submissions, active attempts, subject statistics, integrity exceptions.
5. **Student performance** — exam history, score trend, subject strengths, integrity summary, merit position where meaningful.
6. **Merit** — transparent ranking from submitted attempts for a chosen examination/class; ties must not be hidden.
7. **Entrance placement** — recommendations, pathway counts, capacity/occupancy context and candidate drill-down.
8. **Integrity** — exact events attached to exact student attempt and examination.

### 17.2 Chart policy

Use ApexCharts only where a chart improves comprehension:

- Bar/column: class/pathway comparison
- Line/area: performance trend over multiple exams
- Donut/radial: limited composition/status summary when labels remain clear
- Distribution bar: score bands

Detailed candidate records remain tables/lists. Charts require labels/tooltips and cannot rely on color alone.

### 17.3 Data tables

Use Simple-DataTables on dense desktop tables requiring search/sort/pagination. On narrow screens, provide responsive card/list alternatives rather than horizontally squeezing desktop tables.

Destroy table/chart instances before rerendering a route to prevent duplicate listeners, leaked instances, or stale charts.

## 18. Integrity and Rewrite Model

Integrity is never a disconnected global score. Every integrity event must remain traceable to:

**Student → Examination → Attempt → Event**

Attempt detail should show:

- Student
- Examination
- Attempt state
- Score if submitted
- Integrity score
- Event count and event timeline
- Submission reason
- Rewrite history

Rewrite semantics must preserve the existing archive behavior:

- Submitted attempt remains recorded.
- Its score and integrity log remain visible.
- A new active attempt becomes possible only through the explicit administrator rewrite action.
- An unfinished reset is a separate action and does not masquerade as a submitted rewrite.

## 19. State, Feedback and Failure Handling

Every major page/workflow needs:

- Meaningful empty state
- Inline form validation
- Success toast after completed mutation
- Error toast/alert when a store operation rejects
- Confirmation modal for destructive or audit-affecting actions
- Disabled/loading state when an action is in flight

Do not open a centered notification modal for routine updates. Do not swallow store errors.

## 20. Responsive Requirements

Validate at minimum:

- Mobile: 390×844
- Tablet: 820×1000
- Desktop: 1440×1000

Required behavior:

- No document-level horizontal overflow.
- Modal fits viewport and uses internal vertical scrolling where necessary.
- Mobile navigation remains usable.
- Dense desktop tables become mobile cards/lists.
- Exam builder actions remain reachable without horizontal scrolling.
- Charts resize without clipping labels or forcing page overflow.

## 21. Prototype Security Boundary

This remains a browser/localStorage prototype.

The admin revamp must not claim:

- tamper-proof authentication,
- protected answer-key secrecy,
- server-enforced roles,
- cross-device single-attempt enforcement,
- durable centralized audit logs,
- production invigilation guarantees.

Those require a protected backend. The UI may demonstrate the intended product flow using the existing local contracts.

## 22. Testing and Release Gates

### 22.1 Source/design-system checks

Update `scripts/prototype-audit.mjs` to validate intentional new contracts, including:

- exact required CDN dependencies,
- no admin CSS files,
- canonical admin runtime,
- no legacy detail drawer/sheet layers,
- expected top-level routes,
- expected share/copy behavior without a raw URL field,
- key builder/detail/integrity contracts.

### 22.2 State contract

The admin revamp must not weaken `scripts/state-contract.mjs` guarantees for:

- mode compatibility,
- 5–150 question bounds,
- deterministic candidate paper behavior,
- scoring/integrity relationships,
- submitted rewrite preservation,
- unfinished-attempt reset,
- WhatsApp class association.

### 22.3 Browser E2E

Extend `tests/prototype.spec.js` to cover at least:

- eight-route admin IA plus legacy `page=users` redirect/alias,
- Students and Staff isolation,
- query-driven deep modal restoration/back navigation,
- Entrance Exam user-facing copy while stored mode remains `qualifier`,
- exam builder happy path and validation failure path,
- QR + Exam ID + Copy address + Share fallback,
- structural edit lock after candidate starts,
- rewrite history preservation,
- class occupancy and one-class student assignment,
- question filters and answer reveal,
- base-question non-editability vs custom-question editability,
- report drill-down from class/exam/student/integrity,
- anchored notification popover,
- mobile/tablet/desktop viewport bounds and no overflow.

Existing exam runtime tests for camera, timeout, direct Exam ID entry and submission must stay green.

### 22.4 Independent gates

Before implementation PR handoff:

1. `npm run check`
2. JavaScript syntax checks
3. `npm run test:e2e -- --project=chromium` or equivalent repository command
4. Independent code review
5. Browser dogfood of core admin workflows at mobile/tablet/desktop
6. Git diff review confirming no unrelated production files changed

## 23. Acceptance Criteria

The admin revamp is acceptable when all of the following are true:

- Only `prototype/admin.html` and `prototype/js/admin-app.js` are changed as production admin runtime files.
- No admin CSS file is introduced or loaded.
- The required Tailwind v4, Flowbite, ApexCharts and Simple-DataTables resources are present at the specified versions.
- Standard Flowbite patterns are used instead of custom reimplementations when a suitable component exists.
- Students and Staff are separate teacher-facing areas.
- A student has one current class assignment in the UI.
- SS1 Entrance & Placement Exam replaces “Qualifier” in teacher-facing copy while internal compatibility remains intact.
- Entrance placement views use existing class capacity/occupancy and real placement results rather than invented persistence.
- Examination creation, editing, distribution, monitoring, integrity review and rewrite behavior are coherent and regression-safe.
- QR, Exam ID, Copy address and Share examination are available without displaying a raw URL field.
- Question Bank offers advanced real-metadata filters, explicit answer reveal, custom-question editing and honest base-question limitations.
- Reports cover class, pathway/category, examination, student, merit, placement and integrity relationships using real data.
- Notifications are anchored to the trigger, not centered.
- Deep links and modals are represented by query parameters and survive back/forward navigation.
- Mobile/tablet/desktop layouts meet the responsive requirements.
- Existing state/source contracts and candidate exam workflows remain green.
- The UI reports the real current question inventory; it does not falsely claim 500 scored questions before the separate bank-expansion PR lands.

## 24. Decision Log

### Decision A: Preserve internal `qualifier`; rename only the product language

**Chosen because:** encoded sessions, validation and placement logic already depend on `qualifier`. UI-only renaming achieves the teacher-facing goal without corrupting existing links.

### Decision B: Separate the 500-question bank from the admin revamp

**Chosen because:** data and scoring keys live outside the permitted two production admin files. Pretending otherwise would produce unscored or nonpersistent questions.

### Decision C: Keep one stable sidebar but eliminate detail side sheets

**Chosen because:** the navigation sidebar is a legitimate app shell, while record/detail drawers create cramped, inconsistent admin workflows and poor mobile behavior.

### Decision D: Prefer query-driven state over hidden in-memory modal state

**Chosen because:** deep pages, back/forward navigation and reviewability are explicit requirements, and the prototype has no router framework.

### Decision E: Analytics are derived, never mocked

**Chosen because:** the existing attempt/session/class data already supports meaningful reports, while fake dashboard numbers would undermine the prototype’s purpose.
