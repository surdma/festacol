# Festacol Task 4 — Candidate Exam Surface Migration Closure

**Date:** 2026-09-12  
**Planning parent:** [PR #10](https://github.com/surdma/festacol/pull/10)  
**Implementation PR:** [PR #11](https://github.com/surdma/festacol/pull/11)  
**Implementation branch:** `work/admin-experience-complete-revamp`  
**Status:** COMPLETE / CI_VERIFIED

This file is the canonical per-step completion record for Task 4. The later approved single-shell/Tailwind routing contract supersedes the older standalone `exam.html` script-loading example in the original implementation plan.

## Governing contracts applied

- `docs/superpowers/IMPLEMENTATION-MANIFEST.md`
- main implementation plan — Task 4
- single-shell/Tailwind routing execution — Gate F
- single-shell/Tailwind routing contract — Exam section
- main product/design specification — candidate Exam behavior
- UI/UX governance and depth contract
- current Engineering Lead, Repository Investigator, UI/UX Product, Frontend, Refactor/Maintenance, Test, Reviewer, Integration/Dogfood and Git/Release guidance
- `using-superpowers`, `frontend-design`, `ui-ux-pro-max`, `product-designer`, `tailwindcss`, `dogfood`, `chrome-devtools`, `create-pr`, and `breakdown-plan`

## Task 4 checklist

- [x] **Step 1 — Port the complete candidate examination runtime to `prototype/js/exam.js`.**
  - `exam.js` consumes `Festacol.store`, `.questions`, `.assessment`, `.proctor`, and `.utils` directly and fails fast when those dependencies are unavailable.
  - Candidate authentication, before-you-begin state, camera gate/retry/local preview, single/multi/boolean/fill/fill-multi responses, passages/tables/diagram rendering, timer, navigation, flags, review, submit dialog, result/locked states and unfinished-attempt resume remain wired.
  - The migrated runtime contains no `FestacolSessionStore`, `FestacolQuestionData`, `FestacolAssessmentEngine`, `FestacolProctorPolicy`, `./exam.html`, or `./student.html` dependency.
  - Task 4 intentionally does not change scoring keys or the Question Bank; those remain Task 5.

- [x] **Step 2 — Preserve integrity and elapsed-time behavior.**
  - Window blur, document visibility, clipboard copy/cut/paste, fullscreen enter/exit, camera-ended and focus-return events remain recorded through the shared attempt state.
  - `festacol.exam.background-guard.v2:<session>:<candidate>` persistence and `background-resume-reconciled` elapsed-time accounting are preserved.
  - Timeout and session-ended paths continue to auto-submit.

- [x] **Step 3 — Preserve authentication/candidate cleanup and rewrite/reset semantics.**
  - Timeout/session-ended automatic submission clears Student authentication and the active candidate at the same lifecycle point as the legacy runtime.
  - Manual submission preserves the established behavior.
  - Administrator reset invalidation signs the stale attempt out and requires fresh authentication.
  - Submitted-attempt lock and authorized rewrite behavior remained green in the Chromium regression suite.

- [x] **Step 4 — Apply the approved canonical Exam routing architecture.**
  - `prototype/index.html?route=exam&...` now loads `./js/exam.js` directly from the shared shell.
  - `prototype/exam.html` is now a thin query-preserving compatibility alias that forwards to `index.html` and sets `route=exam`.
  - The alias loads no Tailwind, Flowbite, local CSS, `shared.js`, `exam.js`, legacy domain scripts, or `exam-app.js`.
  - `index.html` retains the explicit allowlist `student -> student.js`, `exam -> exam.js`; Admin remains the transitional legacy bridge until Task 6.
  - The canonical shell has no Flowbite CSS dependency; Exam UI styling is authored through Tailwind utilities.

- [x] **Step 5 — Execute syntax/source/state validation.**
  - Local `node --check` passed for the authored `exam.js`, `prototype-audit.mjs`, and updated `prototype.spec.js` before Git handoff.
  - Local source assertions verified all critical Exam behavior tokens and zero legacy Exam globals/direct page links.
  - Prototype UI Quality run `34708086401` passed **Source & design-system contract** at implementation commit `e7ccfffd13af96ea061833fa5c24ad890a037dcb`.

- [x] **Step 6 — Focused browser integration smoke and regression proof.**
  - Prototype UI Quality run `34708086401` passed **Chromium exam workflow**.
  - Existing browser paths remained green for candidate login/start/submit, camera denial then retry, timeout/background reconciliation, rewrite/archive plus fresh attempt, structural edit locks, exact integrity logging, Admin dialogs/mobile behavior, WhatsApp validation, and Student Exam-ID access.
  - A new browser assertion proves `exam.html?...` preserves `session` and additional query state while forwarding to canonical `index.html?route=exam...`.

## Independent review verdict

**APPROVE.** The implementation is behavior-preserving within Task 4 boundaries. The changed runtime owns the full candidate Exam path through `window.Festacol`, the canonical shell owns dependencies/theme/routing, the compatibility alias remains thin, and the real Chromium regression suite demonstrates the affected workflows. No Task 5 or Admin-runtime completion is claimed.

## Dogfood boundary

The prescribed local `agent-browser` helper is unavailable in this session, so no manual screenshot/video Dogfood claim is made. The Task 4 focused integration requirement is satisfied by the repository's real Chromium workflow. Full UX-aware exploratory Dogfood remains a mandatory Task 13 gate.

## Task boundary

- `prototype/js/exam-app.js` is intentionally retained as a legacy rollback/reference artifact until Task 12 removes migrated runtimes atomically.
- Temporary shared legacy global aliases remain until all consumers migrate and Task 12 removes them.
- Admin remains on its current verified shell until Task 6.
- The verified Question Bank remains 43 questions; answer-aware migration and expansion to at least 720 validated seed questions are Task 5.

## Completion evidence

Implementation commit: `e7ccfffd13af96ea061833fa5c24ad890a037dcb`  
GitHub Actions: Prototype UI Quality run `34708086401`  
Source & design-system contract: **SUCCESS**  
Chromium exam workflow: **SUCCESS**
