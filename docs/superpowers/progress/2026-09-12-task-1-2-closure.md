# Festacol Revamp — Task 1–2 Closure Evidence

**Planning parent:** PR #10  
**Implementation PR:** PR #11  
**Implementation branch:** `work/admin-experience-complete-revamp`  
**Scope:** Tasks 1 and 2 only  
**Status:** COMPLETE / CI_VERIFIED on the current-master prototype layout

This is the canonical live completion checklist for Tasks 1 and 2. It supplements the original implementation-plan template, whose old pre-move paths and unchecked template boxes are not the live status source. Current repository layout, `IMPLEMENTATION-MANIFEST.md`, this closure checklist, the progress ledger, and PR #11 are the authoritative execution record.

## Explicit scope boundary

Tasks 1 and 2 did **not** expand the Question Bank. `prototype/data/questions.json` remains the existing 43-question seed bank at this milestone. Question schema/answer migration and the approved minimum of **720 validated seed questions** belong to **Task 5**.

## Task 1 — Preservation contracts and migration guardrails

- [x] **Step 1 — Inventory every current shared method and consumer before refactoring**

### Legacy module → target owner → consumers

| Legacy module | Target owner | Preserved public API / responsibility | Current legacy consumers preserved during migration |
| --- | --- | --- | --- |
| `FestacolSessionStore` | `Festacol.store` + `Festacol.utils` | session normalization/encode/decode/linking, session CRUD/status, attempts, rewrite/reset, active candidate/auth, student profile, classes/users, custom questions, WhatsApp, storage clearing, formatting | `admin-app.js`, `student-dashboard.js`, `exam-app.js`, Student Exam-ID flow, prototype state/browser contracts; `question-data.js` custom-question merge; `proctor-policy.js` session decode |
| `FestacolQuestionData` | `Festacol.questions` | `load`, `availableSubjects`, `eligibleQuestions`, `questionsForSession`, `subjectByCode`, `questionById`; plus `validatePayload` exposed for contracts | `admin-app.js`, `student-dashboard.js`, `exam-app.js` |
| `FestacolAssessmentEngine` | `Festacol.assessment` | `TRACKS`, identity/hash helpers, deterministic paper allocation, fingerprints, scoring, answer display/current 43-key parity, placement, answer-reveal policy | `admin-app.js`, `student-dashboard.js`, `exam-app.js`, state contract |
| `FestacolProctorPolicy` | `Festacol.proctor` | admin policy, URL/session policy, camera requirement, candidate-link decoration, session-id extraction | `admin-app.js`, `exam-app.js`, browser contract |
| `FestacolQR` | `Festacol.qr` | real local QR `render` and `svgFor` encoder behavior | `admin-app.js` distribution/WhatsApp QR paths |
| shared pure helpers | `Festacol.utils` | sanitization, normalization, duration formatting, base64url helpers, canonical `index.html?route=...` URL construction | new shared runtime and later page migrations |

`prototype/js/shared.js` keeps temporary compatibility aliases (`FestacolSessionStore`, `FestacolQuestionData`, `FestacolAssessmentEngine`, `FestacolProctorPolicy`, `FestacolQR`) pointing to the new modules so current Admin/Student/Exam consumers continue to run until their own migration tasks.

- [x] **Step 2 — Stage the final four-runtime source contract**
  - `prototype/scripts/prototype-audit.mjs` stages the target `shared.js`, `admin.js`, `student.js`, `exam.js` contract and only activates the complete final-shell assertions after all four target runtimes exist.

- [x] **Step 3 — Define final shell/head/source assertions**
  - The later approved single-shell/Tailwind contract supersedes the original Flowbite-CSS example.
  - The staged final audit requires canonical `index.html`, Tailwind browser/theme configuration, Flowbite JS and `shared.js`, and rejects local/Flowbite CSS and legacy shared script loading once the four-runtime target is active.

- [x] **Step 4 — Add one-class and retained-history executable assertions**
  - `prototype/scripts/state-contract.mjs` verifies `classId` remains one scalar relationship.
  - It verifies deleting an examination definition does not erase attempt history.
  - The contract also preserves v2/v3 session compatibility, deterministic papers, scoring/integrity, rewrite/reset, Exam ID, WhatsApp, and candidate-state semantics.

- [x] **Step 5 — Preserve old browser expectations as Dogfood scenarios**
  - `docs/superpowers/specs/2026-09-12-admin-experience-revamp-design.md` Section 22 retains Admin navigation/overflow, Exam ID, camera denial/retry, timeout/auth cleanup, rewrite, edit locks, WhatsApp validation, attempt integrity drill-down, viewport containment, and mobile behavior as mandatory browser acceptance paths.

- [x] **Step 6 — Verify the pre-mutation baseline**
  - GitHub Actions **Prototype UI Quality** run `34624502020` on `master` SHA `43313acc38ba682a66bda3706ac444d905da7844` completed successfully before the shared-runtime replacement work.

## Task 2 — Consolidate shared domain behavior into `shared.js`

- [x] **Step 1 — Move store/session/attempt/user/class/WhatsApp logic without changing storage contracts**
  - `Festacol.store` preserves the original store keys, payload version `3`, v2/v3 decode, session normalization, one-attempt/reset/rewrite behavior, active candidate/auth, student profile, class/user/custom-question/WhatsApp operations, and prototype clearing behavior.
  - The legacy `FestacolSessionStore` export list is preserved through the compatibility alias.

- [x] **Step 2 — Move proctor policy to `Festacol.proctor`**
  - Public methods are preserved: `getAdminPolicy`, `setAdminPolicy`, `policyFromUrl`, `rememberFromUrl`, `isCameraRequired`, `decorateStudentLink`, `sessionIdFromLink`.

- [x] **Step 3 — Move QR behavior to `Festacol.qr`**
  - The real local Reed–Solomon QR implementation is consolidated, not replaced with a placeholder.
  - Public methods remain `render` and `svgFor`.

- [x] **Step 4 — Move current assessment behavior before the Task 5 answer-model change**
  - Hashing, deterministic randomization, paper allocation, paper/attempt fingerprints, score construction, integrity scoring, placement weighting, answer reveal and the current 43-question hardcoded answer-key parity are preserved.
  - The hardcoded key is intentionally removed only in Task 5 when question records receive validated answer metadata.

- [x] **Step 5 — Move current question loading/eligibility behavior**
  - `Festacol.questions` preserves seed loading, custom-question merge, subject availability, eligibility, mixed-subject interleaving, session question selection and lookup behavior.
  - `validatePayload` is additionally exposed for executable contracts.

- [x] **Step 6 — Point the state contract to `shared.js` only**
  - `prototype/scripts/state-contract.mjs` executes `prototype/js/shared.js` in the VM and binds `Festacol.store`, `.questions`, `.assessment`, `.proctor`, `.qr`, and `.utils` rather than loading the five legacy domain files.

- [x] **Step 7 — Execute and verify the shared-runtime contract**
  - Current-master reconciliation run `34696743263` passed both **Source & design-system contract** and **Chromium exam workflow**.
  - The source job output explicitly reports `state/shared contract: PASS`.
  - That same run reports the current question inventory as **43 questions**, confirming Task 5 has not been falsely included in Task 1 or 2.

## Reviewer closure

**Verdict: APPROVE for Task 1–2 closure.**

Evidence supports that the shared-domain consolidation and preservation guardrails required by Tasks 1 and 2 are present in PR #11 and validated against current master. The remaining legacy page consumers and compatibility aliases are expected and are removed only during Tasks 3, 4, 6 and 12. The Question Bank expansion is explicitly not part of this closure.

## Git/PR closure

- [x] Task 1 implementation/evidence is present in PR #11.
- [x] Task 2 implementation/evidence is present in PR #11.
- [x] Current-layout files use `/prototype` package paths.
- [x] PR #11 targets `master` and is not behind the verified master baseline at this closure point.
- [x] Task 1–2 current-master validation is green.
- [x] PR #11 body marks Tasks 1 and 2 complete.
- [x] Progress ledger marks Tasks 1 and 2 complete.
- [x] This canonical detailed checklist has every Task 1–2 step checked with evidence.
