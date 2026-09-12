# Festacol Admin Experience Revamp — Implementation Progress

**Started:** 2026-09-12  
**Implementation branch:** `work/admin-experience-complete-revamp`  
**Approved planning head:** `3549633877bcd257f5a42967e5e3507a980bf24a`  
**Policy:** Every completed milestone must be validated, checked here, committed, pushed, and verified on the remote branch before the next milestone is represented as complete.

## Milestone checklist

- [x] **Task 1 — Preservation contracts and migration guardrails**
  - [x] Inventory legacy shared globals and map them to `Festacol.store`, `.questions`, `.assessment`, `.proctor`, `.qr`, and `.utils`.
  - [x] Stage the four-runtime source contract without forcing an unsafe flag-day migration.
  - [x] Stage the canonical `index.html`/route-alias/Tailwind-only final-shell assertions.
  - [x] Add one-current-class and retained-attempt-history executable assertions.
  - [x] Preserve the old Playwright journeys in the manual Dogfood acceptance matrix.
  - [x] Verify the pre-mutation runtime baseline from the successful `master` workflow at `43313acc38ba682a66bda3706ac444d905da7844` (Prototype UI Quality run `34624502020`).
  - [x] Verify the pushed Task 1 commit `8bc3e909f0831fcfdfd433c63310563624cdf325` with Prototype UI Quality run `34687063219`: source/state contract **success**, Chromium workflow **success**.
- [ ] **Task 2 — Consolidate shared domain behavior into `shared.js`**
  - [x] Move storage/session/attempt/user/class/WhatsApp behavior into `Festacol.store` without changing storage keys or v2/v3 compatibility.
  - [x] Move camera/proctor policy and decorated candidate-link behavior into `Festacol.proctor`.
  - [x] Move the real local QR encoder into `Festacol.qr`.
  - [x] Move current hashing/randomization/scoring/placement behavior into `Festacol.assessment` without yet changing the 1–43 answer model.
  - [x] Move current question loading/validation/eligibility/custom-question merge into `Festacol.questions`.
  - [x] Add `Festacol.utils` with shared sanitation/formatting and canonical `index.html?route=...` URL generation.
  - [x] Preserve temporary legacy globals as aliases to the new modules until Student/Exam/Admin consumers migrate.
  - [x] Point `scripts/state-contract.mjs` at `shared.js` only.
  - [x] Local primary contract passed: namespace wiring, v2/v3 session compatibility, canonical exam route, deterministic papers, scoring parity, rewrite/reset, one-class storage, retained history, WhatsApp, proctor links, QR SVG.
  - [x] Independent adversarial contract passed: invalid sessions/questions, reset equality boundary, route normalization, answer-order parity, proctor false/true policy, QR capacity guard.
  - [x] Independent code review: **APPROVE WITH NON-BLOCKING NOTE** — no consumer is switched in Task 2; browser-specific local smoke is blocked by this container's Chromium policy, so pushed CI is the browser-regression gate.
  - [ ] Pushed Task 2 commit passes GitHub source/state and Chromium workflow checks.
- [ ] **Task 3 — Migrate Student surface to `student.js`**
- [ ] **Task 4 — Migrate candidate Exam surface to `exam.js`**
- [ ] **Task 5 — Answer-aware Question Bank and expanded validated seed bank (minimum 720 validated seed questions)**
- [ ] **Task 6 — Rebuild canonical shell/Admin runtime**
- [ ] **Task 7 — Students, Staff, Classes, WhatsApp, Settings**
- [ ] **Task 8 — Examination management and lifecycle**
- [ ] **Task 9 — Five-stage exam builder**
- [ ] **Task 10 — Advanced Question Bank administration**
- [ ] **Task 11 — Reports, merit, placement, integrity**
- [ ] **Task 12 — Remove legacy runtimes/CSS/Playwright and simplify CI**
- [ ] **Task 13 — Independent Test, Review, and UX-aware Dogfood gates**
- [ ] **Task 14 — Git/Release final implementation PR and CI verification**

## Task 1 evidence

### Legacy → target ownership map

| Legacy global | Target owner | Primary preserved responsibilities |
| --- | --- | --- |
| `FestacolSessionStore` | `Festacol.store` + `Festacol.utils` | sessions, attempts, rewrite/reset, users/classes, WhatsApp, browser persistence, session-link helpers |
| `FestacolQuestionData` | `Festacol.questions` | seed/custom loading, validation, subjects, eligibility, lookup |
| `FestacolAssessmentEngine` | `Festacol.assessment` | identity hashes, deterministic papers, scoring, placement, attempt/paper fingerprints |
| `FestacolProctorPolicy` | `Festacol.proctor` | camera policy, URL policy persistence/decorating |
| `FestacolQR` | `Festacol.qr` | QR SVG creation/rendering |

Primary current consumers to preserve during migration are `admin-app.js`, `student-dashboard.js`, `exam-app.js`, the inline Student Exam-ID flow, `scripts/state-contract.mjs`, and the browser acceptance journeys formerly encoded in `tests/prototype.spec.js`.

### Baseline and pushed evidence

The exact production runtime baseline on `master` (`43313acc38ba682a66bda3706ac444d905da7844`) completed **Prototype UI Quality** successfully in workflow run `34624502020`. Task 1 was committed as `8bc3e909f0831fcfdfd433c63310563624cdf325`; GitHub Actions run `34687063219` completed successfully with both **Source & design-system contract** and **Chromium exam workflow** passing.

## Task 2 evidence before push

`prototype/js/shared.js` is a single self-contained runtime. It does not dynamically load the legacy JavaScript files and can initialize without a DOM, which allows the Node state contract to execute the exact browser-domain runtime. The current legacy page runtimes remain untouched in this milestone and are migrated in later tasks, so temporary `FestacolSessionStore`, `FestacolQuestionData`, `FestacolAssessmentEngine`, `FestacolProctorPolicy`, and `FestacolQR` aliases intentionally point to the new `Festacol` modules.

Executed locally before Git handoff:

```text
node --check prototype/js/shared.js                         PASS
node --check scripts/state-contract.mjs                   PASS
node scripts/state-contract.mjs                           state/shared contract: PASS
independent Task 2 adversarial contract                   PASS
```

A local Chromium process is installed, but this container redirects local HTTP/file navigation to `chrome-error://chromewebdata/`; therefore no local browser-success claim is made. The branch's existing GitHub Chromium job is required to remain green before Task 2 is checked complete.

## Current status

**Task 1: COMPLETE / CI_VERIFIED.**  
**Task 2: COMMIT_READY / local contracts and independent review passed; remote CI pending after push.**  
**Next gate:** Git/Release commit → push → verify remote SHA → verify GitHub source/state + Chromium workflow → check Task 2 complete.
