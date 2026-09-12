# Festacol Admin Experience Revamp — Implementation Progress

**Started:** 2026-09-12  
**Implementation branch:** `work/admin-experience-complete-revamp`  
**Planning parent:** [PR #10](https://github.com/surdma/festacol/pull/10)  
**Implementation PR:** [PR #11](https://github.com/surdma/festacol/pull/11)  
**Mandatory task map:** [`docs/superpowers/IMPLEMENTATION-MANIFEST.md`](../IMPLEMENTATION-MANIFEST.md)  
**Policy:** Every completed milestone must be validated, checked here, committed, pushed, and verified on the remote branch before the next milestone is represented as complete.

## Repository-layout checkpoint

Current `master` moved the Next.js app to repository root and isolated the prototype as its own package under `/prototype`. PR #11 has been synchronized to that current master/planning lineage. Prototype validation files therefore live under `prototype/scripts/`, not the pre-move root `scripts/` directory.

The synchronized Task 1–2 contracts passed the current-layout CI gate in Prototype UI Quality run `34696743263` at head `07fb649150edd865a0f976cf31acf877c37964eb`: **Source & design-system contract passed** and **Chromium exam workflow passed**.

## Milestone checklist

- [x] **Task 1 — Preservation contracts and migration guardrails**
  - [x] Inventory legacy shared globals and map them to `Festacol.store`, `.questions`, `.assessment`, `.proctor`, `.qr`, and `.utils`.
  - [x] Stage the four-runtime source contract without forcing an unsafe flag-day migration.
  - [x] Stage the canonical `index.html`/route-alias/Tailwind-only final-shell assertions.
  - [x] Add one-current-class and retained-attempt-history executable assertions.
  - [x] Preserve the old Playwright journeys in the manual Dogfood acceptance matrix.
  - [x] Verify the pre-mutation runtime baseline from the successful original prototype workflow at `43313acc38ba682a66bda3706ac444d905da7844`.
  - [x] Original Task 1 commit `8bc3e909f0831fcfdfd433c63310563624cdf325` passed its source/state and Chromium regression workflow before the repository layout move.
  - [x] Port the preservation audit to current master layout at `prototype/scripts/prototype-audit.mjs`.
- [x] **Task 2 — Consolidate shared domain behavior into `shared.js`**
  - [x] Move storage/session/attempt/user/class/WhatsApp behavior into `Festacol.store` without changing storage keys or v2/v3 compatibility.
  - [x] Move camera/proctor policy and decorated candidate-link behavior into `Festacol.proctor`.
  - [x] Move the real local QR encoder into `Festacol.qr`.
  - [x] Move question loading/validation/eligibility into `Festacol.questions` while keeping answer-key migration for Task 5.
  - [x] Move assessment identity/deterministic-paper/scoring/placement logic into `Festacol.assessment`.
  - [x] Add canonical `index.html?route=...` URL construction in `Festacol.utils`.
  - [x] Keep temporary legacy globals only as migration aliases until Student/Exam/Admin consumers move.
  - [x] Original Task 2 implementation commit `a49f10861cae568d81ec0f6ae7223f363bdd8d90` passed its source/state and Chromium regression workflow before the repository layout move.
  - [x] Preserve `prototype/js/shared.js` while synchronizing PR #11 to current master.
  - [x] Port the shared-runtime state contract to `prototype/scripts/state-contract.mjs`.
- [x] **Current-master reconciliation gate before Task 3**
  - [x] PR #10 contains the authoritative planning docs and implementation manifest.
  - [x] PR #11 explicitly descends from the current planning/master lineage.
  - [x] PR #11 uses current isolated `/prototype` package paths.
  - [x] Task 1–2 contracts are ported to `prototype/scripts/`.
  - [x] Current synchronized PR #11 CI passed source/state contract and Chromium regression jobs in run `34696743263`.
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

The preservation layer guards the existing exam/session/user/class/attempt behavior before consumer migration. It includes one-current-class, retained attempt history, rewrite/reset boundaries, source-contract staging for the four-runtime target, and compatibility routing requirements.

## Task 2 evidence

`prototype/js/shared.js` is a single self-contained runtime. It does not dynamically load the legacy JavaScript files and can initialize without a DOM, allowing the Node state contract to execute the exact browser-domain runtime. Temporary `FestacolSessionStore`, `FestacolQuestionData`, `FestacolAssessmentEngine`, `FestacolProctorPolicy`, and `FestacolQR` aliases intentionally point to the new `Festacol` modules until later consumer migrations remove them.

The original Task 2 contracts covered namespace wiring, v2/v3 compatibility, canonical exam routing, deterministic papers, scoring parity, rewrite/reset, one-class storage, retained history, WhatsApp, proctor links, QR SVG generation, invalid sessions/questions, reset equality boundaries, route normalization, answer-order parity, and QR capacity guards.

## Current status

**Task 1: COMPLETE / CI_VERIFIED on the approved behavior contract and current layout.**  
**Task 2: COMPLETE / CI_VERIFIED on the approved shared-runtime contract and current layout.**  
**Current-master reconciliation: COMPLETE / CI_VERIFIED via run `34696743263`.**  
**Task 3: READY TO START, but not started.**
