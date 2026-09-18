# Phase 02 — Ready to Write

Date: 2026-09-17
Status: CI_VERIFIED — corrected Concept B implementation passes repository CI; browser interaction validation remains
Target PR: #18
Planning owner: `festacol-planner`
Production owner: `festacol-frontend-engineer`

## Selection result

The product owner selected **Concept B — Folded Examination Booklet**.

Phase 02 is no longer an A–G selection exercise. The production direction is one high-fidelity, responsive examination-booklet surface that combines the previous academic eligibility/placement, instructions, device readiness and Start/Resume stages.

The governing product rule remains: **the system handles complexity; the student sees clarity.**

## Production interaction

The production surface must preserve the selected wireframe's **actual spatial grammar**, not merely borrow booklet styling:

- **literal flat two-page spread** with a visible center fold; no external application header, rounded dashboard shell, or sidebar composition;
- **left page** — examination title and exactly four primary facts: **Candidate, Class, Questions, Duration**. Subjects, academic period, availability, attempt/resume state and qualifier tracks remain secondary text only when useful. No translucent phase numeral or other watermark is used;
- **facing page** — exactly three primary rules: navigate/flag, quiet autosave, and review/finalization. Examination-creator instructions stay available through restrained progressive disclosure;
- **readiness stamp** — healthy device/connection state is represented by the stamp, not a diagnostics panel;
- **conditional camera** — nothing renders when `cameraRequired === false`; when true, camera permission and a small live preview stay inside the facing page and appear only on demand;
- **perforated dark strip** — one dominant **Start Examination** or **Resume Examination** action.

Opening the booklet does not allocate an attempt. Fullscreen, integrity and randomization remain real runtime policy, but they must not become extra student-facing configuration sections unless the candidate has an actionable requirement.

## Academic exception behavior

Academic setup is deliberately reduced to the minimum information the server truly lacks:

- existing confirmed enrollment → no academic questionnaire; the class is already authoritative;
- qualifier + no enrollment → the candidate already opened an SS1 placement examination, so there is no level/path/class questionnaire; one direct **Continue to placement exam** action grants the existing placement access and then opens Ready to Write;
- normal examination + no enrollment → ask only for the candidate's existing class in one grouped class selector; derive the level from that class;
- an enrolled candidate who is not eligible for the paper gets a concise explanation and return action rather than being pushed through a form that cannot change their class.

`completeExamOnboardingAction` remains the only class/placement write path. The simplification changes interaction, not authority.

## Start and resume authority

The redesign changes presentation, not examination authority.

- `my_exam_access` remains the access authority;
- class and SS1 placement writes remain server-owned;
- `getExamPaperAction` remains the paper-loading boundary;
- `allocate_my_exam_attempt` remains the Start/Resume attempt authority;
- existing persistence, integrity recording, scoring, submission and retake behavior remains in `ExamWorkspace` and its server actions.

Every eligible new or active attempt now enters the same selected booklet in `ExamWorkspace`. The obsolete `ExamWorkspaceEntry` compatibility gate is removed, and the old `overview → instructions → readiness → final` client-stage state is removed. **Resume Examination** still restores through `getExamPaperAction`, which reconciles server-calculated time before the live paper opens.

## Production files

Implementation commit: `1cf2e2a84eaba69f9bd35d482566eb7fd191b34a`

Changed production files:

- `src/app/(exam)/exam/page.tsx`
- `src/components/exam/exam-preflight.tsx`
- `src/components/exam/exam-camera-panel.tsx`
- `src/components/exam/student-wizard.tsx`

No Prisma schema, migration, Supabase SQL, fixture or RPC contract was changed for Phase 02.

## Validation

The previous implementation commit `1cf2e2a84eaba69f9bd35d482566eb7fd191b34a` passed Next.js Quality run #819, but product review found a **wireframe-fidelity defect**: the production UI had drifted into a rounded application shell with too much metadata and onboarding ceremony.

Correction commit `3a9ca893d484308621f4c06958c3f8aae241db0f` passed GitHub Actions **Next.js Quality** run #821 (`35279960669`). The successful job covered fixture/runtime-schema validation, canonical migrations, Prisma validate/generate/migrate, relational seed assertions, Supabase auth/RLS/Realtime integration, TypeScript typecheck, production build and Biome.

Before this correction can be called `COMPLETE`, still required:

- independent source review of the final branch diff;
- authenticated browser dogfood for camera-required, camera-not-required, placement, normal missing-class onboarding, existing-class denial, offline and active-attempt resume;
- responsive checks at 360×640, 375×812, 768×1024, 1280×800 and short viewport, plus keyboard/focus, reduced motion and console/network checks.

CI and deployment readiness are not substitutes for browser integration evidence.
