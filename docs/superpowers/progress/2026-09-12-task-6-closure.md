# Task 6 Closure — Canonical Admin Shell and Runtime

**Task:** 6 — Canonical index shell + Admin runtime  
**Branch:** `work/admin-experience-complete-revamp`  
**Status:** COMPLETE / CI_VERIFIED  
**Implementation commit:** `984a2bb45f9753e0483eb3a30bc105e12ff21be0`  
**Verification workflow:** Prototype UI Quality run `34755012162`

## Acceptance evidence

- [x] `prototype/index.html` is the canonical application shell and directly allowlists `student.js`, `admin.js`, and `exam.js` after `shared.js`.
- [x] `prototype/admin.html` remains a thin query-preserving compatibility alias and no longer owns an independent Admin shell or runtime stack.
- [x] `prototype/js/admin.js` consumes `window.Festacol` rather than the migrated legacy Admin globals.
- [x] One Admin route definition drives all eight top-level areas: Overview, Students, Staff, Examinations, Classes, Question Bank, Reports, and Settings.
- [x] Legacy `page=users` now normalizes to `page=students` without being overwritten by the invalid-route fallback.
- [x] Canonical Admin URLs preserve meaningful page/filter/tab/record/modal state through `URL` / `URLSearchParams` and History API navigation.
- [x] Browser Back closes a query-backed record overlay and restores its exact parent page/search state; reload restores the exam-created overlay.
- [x] Admin overlays use the Flowbite modal lifecycle/structure with a bounded centered panel and dimmed blurred backdrop; native `<dialog>` / `showModal()` ownership is removed from the migrated runtime.
- [x] Notifications use an anchored Flowbite dropdown/popover target rather than the centered modal host.
- [x] Desktop and mobile navigation consume the same eight-route model; the desktop sidebar remains exactly `w-64` / 256px with matching `lg:pl-64` content offset.
- [x] Verified Flowbite Icons are used for navigation and operational controls, including the new QR external-link affordance.
- [x] The Admin Overview is a denser academic-operations dashboard based only on real stored state: six operational metrics, active/recent exams, candidate activity, workspace readiness, and a derived attention queue for drafts, live attempts, integrity events, capacity, communication gaps, and inactive records.
- [x] Admin motion is state-driven through the shared Tailwind theme (`admin-enter`, `admin-pop`, `toast-in`) and the existing `prefers-reduced-motion` contract reduces it to effectively zero duration.
- [x] Exam-created QR, exam-detail QR, and WhatsApp-group QR surfaces provide a visible **Open link** action that opens the exact validated destination in a new tab with `target="_blank"` and `rel="noopener noreferrer"` while raw candidate URLs remain hidden from the exam distribution UI.
- [x] Existing exam creation/edit, camera policy, timeout auto-submit, rewrite retention, class/WhatsApp, integrity/report, responsive modal and mobile-navigation workflows remain covered by the browser regression suite.
- [x] Canonical Admin styling remains Tailwind-authored through the shared index shell; no Flowbite CSS or page-specific Admin stylesheet was introduced.

## Executed validation

GitHub Actions executed the exact pushed PR implementation through the repository workflow:

```text
Prototype UI Quality run 34755012162
Source & design-system contract   PASS
Chromium exam workflow            PASS — 14/14 tests
```

The source job executes:

```text
for file in js/*.js; do node --check "$file"; done
node --check scripts/prototype-audit.mjs
node --check scripts/state-contract.mjs
node --check tests/prototype.spec.js
npm run audit:prototype
npm run test:contract
```

The permanent source audit now additionally guards the Task 6 Admin migration, legacy normalization tokens, dense dashboard contract, unchanged sidebar width, shared motion/reduced-motion theme, QR new-tab safety attributes, canonical runtime ownership, thin alias ownership, and legacy-runtime exclusions.

## Browser / integration verification

The Chromium job executed 14 real browser journeys and reported **14 passed (48.3s)**. The Task 6-specific evidence includes:

- [x] canonical Admin shell renders the denser dashboard, six operational metrics and attention queue;
- [x] desktop sidebar computed width remains **256px**;
- [x] all eight desktop routes navigate canonically without horizontal overflow;
- [x] `admin.html?page=users&q=Amina` forwards and normalizes to canonical `page=students` while preserving `q=Amina`;
- [x] Admin compatibility alias preserves nested query state and Browser Back closes URL-backed record overlays;
- [x] exam-created modal survives reload and renders its QR;
- [x] exam-created and exam-detail QR surfaces expose safe new-tab candidate links;
- [x] WhatsApp QR management exposes a safe new-tab validated group link;
- [x] invalid WhatsApp hosts are rejected inline and not stored;
- [x] exam settings lock structural fields after candidate activity while preserving allowed edits;
- [x] camera denial/retry, timeout auto-submit, rewrite preservation, exact attempt integrity linkage and mobile/tablet/desktop modal bounds remain green;
- [x] mobile navigation exposes all eight destinations and the Student directory collapses to touch-friendly cards without horizontal overflow.

## Independent review verdict

**APPROVE WITH NON-BLOCKING NOTES.** The Task 6 diff was reviewed against the current routing/UI governance contracts and the prior Admin behavior before branch advancement. No blocking partial wiring, lost domain workflow, route-state regression, unsafe QR link, sidebar-width regression, CSS-system regression, or failing acceptance path remains.

The final repository-wide exploratory UX/Dogfood sweep is intentionally **not** claimed here; it remains the separately planned **Task 13** milestone.

## Git / Release evidence

- [x] Implementation commit `984a2bb45f9753e0483eb3a30bc105e12ff21be0` is a fast-forward descendant of the previous PR #11 head `7df217773706c6214009cd77d215cd3ed760f1c2`.
- [x] The implementation was pushed directly to `work/admin-experience-complete-revamp`; no side implementation PR was created.
- [x] PR #11 resolves to the implementation commit before closure-document finalization.
- [x] Prototype UI Quality run `34755012162` completed successfully with both required jobs green.
- [x] PR #11 remained open, draft, and mergeable after the Task 6 implementation push.

**Task 6 is COMPLETE / CI_VERIFIED.** Tasks 7–14 remain separate milestones and are not implied complete by this closure.
