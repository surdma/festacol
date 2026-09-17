# Phase 02 — Ready to Write

Date: 2026-09-17
Status: CI_VERIFIED — Concept B selected and implemented; browser interaction validation remains
Target PR: #18
Planning owner: `festacol-planner`
Production owner: `festacol-frontend-engineer`

## Selection result

The product owner selected **Concept B — Folded Examination Booklet**.

Phase 02 is no longer an A–G selection exercise. The production direction is one high-fidelity, responsive examination-booklet surface that combines the previous academic eligibility/placement, instructions, device readiness and Start/Resume stages.

The governing product rule remains: **the system handles complexity; the student sees clarity.**

## Production interaction

The selected booklet uses:

- **left page** — real examination and candidate data from `ExamExperienceContext`: title, mode, subjects, candidate name/student number/class, class level/arm, academic session/term, duration, question count, availability, qualifier placement tracks when relevant, and attempt/resume state;
- **facing page** — the essential answering, navigation, autosave, timer, review/submission instructions; examination-creator instructions; configured integrity guidance; and configured paper-randomization guidance;
- **conditional readiness** — healthy connectivity remains quiet; offline state becomes a direct blocker;
- **conditional camera** — no camera component is rendered when `cameraRequired === false`; when `cameraRequired === true`, the booklet shows a camera requirement and requests webcam permission only after the candidate chooses **Allow camera**. Microphone access is never requested;
- **perforated start strip** — one dominant **Start Examination** or **Resume Examination** action.

Opening the booklet does not allocate an attempt.

## Academic exception behavior

`StudentWizard` has been re-authored into the same booklet language rather than retaining the old four-step setup/progress rail.

Server-owned behavior is preserved:

- a valid existing class is displayed read-only; the candidate cannot self-transfer;
- a candidate without an enrollment chooses only the academic level/class information that is actually missing;
- only qualifier + no enrollment + SS1 candidates see the known-class versus placement choice;
- a known-class qualifier candidate returns to the dashboard rather than writing placement;
- placement consent remains subject to the existing one-attempt/staff-retake rule;
- `completeExamOnboardingAction` persists the academic decision and re-checks access.

## Start and resume authority

The redesign changes presentation, not examination authority.

- `my_exam_access` remains the access authority;
- class and SS1 placement writes remain server-owned;
- `getExamPaperAction` remains the paper-loading boundary;
- `allocate_my_exam_attempt` remains the Start/Resume attempt authority;
- existing persistence, integrity recording, scoring, submission and retake behavior remains in `ExamWorkspace` and its server actions.

A small `ExamWorkspaceEntry` gate ensures an active attempt without camera monitoring also sees the selected booklet and an explicit **Resume Examination** action before the existing workspace restores the paper. Camera-monitored resumes continue through the existing workspace pre-exam boundary.

## Production files

Implementation commit: `1cf2e2a84eaba69f9bd35d482566eb7fd191b34a`

Changed production files:

- `src/app/(exam)/exam/page.tsx`
- `src/components/exam/exam-preflight.tsx`
- `src/components/exam/exam-camera-panel.tsx`
- `src/components/exam/student-wizard.tsx`
- `src/components/exam/exam-workspace-entry.tsx`

No Prisma schema, migration, Supabase SQL, fixture or RPC contract was changed for Phase 02.

## Validation evidence

GitHub Actions **Next.js Quality** run #819 (`35256435740`) passed on the implementation commit.

The successful job covered:

- fixture contract validation;
- runtime schema contract validation;
- canonical migration-history assertions;
- Prisma validate, generate and migrate;
- canonical relational seed graph;
- Supabase auth, RLS and Realtime integration assertions;
- TypeScript typecheck;
- production build;
- Biome lint.

Vercel also reported the implementation-head preview **Ready**.

Source-level review confirmed that the new UI continues to call the existing server authorities rather than duplicating access, attempt or academic rules in the browser.

## Remaining validation boundary

Phase 02 is `IMPLEMENTED` and `CI_VERIFIED`; it is **not yet `COMPLETE`**.

The current execution environment does not expose the required `agent-browser` Dogfood binary, its container cannot resolve the deployed preview hostname, and no valid examination token/student session was available for authenticated browser testing.

Before `COMPLETE`, exercise the deployed Phase 02 workflow with real test data for:

- new attempt, camera not required;
- new attempt, camera required, including allow/deny/retry;
- active-attempt resume;
- missing academic class;
- SS1 qualifier known-class and placement choices;
- offline Start/Resume blocker;
- long creator-authored instructions;
- 360×640, 375×812, 768×1024, 1280×800 and short-height layouts;
- light/dark themes;
- keyboard/focus and reduced-motion behavior;
- clean browser console/network behavior.

CI and Vercel deployment readiness are not substitutes for browser interaction validation.

## Non-goals

Phase 02 does not redesign the live question workspace, examination review/final submission, results, placement scoring, staff academic management or staff retake controls. Those remain later phases or existing staff workflows.
