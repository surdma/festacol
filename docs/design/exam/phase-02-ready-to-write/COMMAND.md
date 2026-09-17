# Phase 02 — Ready to Write design record

Status: Concept B selected — production implementation committed and CI verified
Prerequisite: Phase 01 remains the approved Admission Pass direction.
Governing plan: `docs/plans/2026-09-17-phase-02-ready-to-write.md`

## Selection result

**Selected:** **B — Folded Examination Booklet**.

The A–G comparison gate is closed for Phase 02. The wireframe board remains historical design evidence; production is re-authored in the repository's Next.js 16 / React 19 / shadcn Base Nova / Tailwind v4 stack rather than copied literally.

## Production translation contract

The selected production direction must:

- use one responsive booklet/spread that stacks cleanly on narrow screens;
- bind paper facts to the real `ExamExperienceContext` rather than representative wireframe data;
- show useful examination data including title, mode, subjects, candidate/class information, academic period, duration, question count, availability, attempts and qualifier placement tracks where applicable;
- keep essential answering/navigation/saving/timing/review guidance on the same surface;
- show examination-creator instructions and only the integrity/randomization guidance actually configured for the session;
- render camera setup only when persisted exam configuration resolves to `cameraRequired === true`;
- request webcam permission only after the candidate chooses **Allow camera** and never request microphone permission;
- keep missing class / SS1 placement as a conditional booklet insert rather than a separate progress wizard;
- keep Start/Resume behind `getExamPaperAction` / `allocate_my_exam_attempt`;
- preserve offline, camera-denied/unavailable/disconnected, attempt-limit and resume behavior;
- leave the live question workspace outside Phase 02 scope.

## Implemented source

Production commit: `1cf2e2a84eaba69f9bd35d482566eb7fd191b34a`

- `src/components/exam/exam-preflight.tsx` — selected high-fidelity booklet, real exam configuration, instructions, readiness and Start/Resume strip;
- `src/components/exam/exam-camera-panel.tsx` — on-demand required-camera permission/preview and live-exam camera state; returns `null` when camera is not required;
- `src/components/exam/student-wizard.tsx` — academic exceptions re-authored as a booklet insert without the old progress rail;
- `src/components/exam/exam-workspace-entry.tsx` — active no-camera attempts receive the same booklet before Resume;
- `src/app/(exam)/exam/page.tsx` — routes eligible candidates into the selected Phase 02 entry surface and distinguishes access-service failure from academic configuration.

No schema/RPC change was required. `my_exam_access`, academic server actions, `allocate_my_exam_attempt`, persistence, integrity, scoring, submission and retake contracts remain authoritative.

## Validation

GitHub Actions **Next.js Quality** run #819 (`35256435740`) passed the implementation head, including schema/fixture integration, Prisma migration validation, Supabase/RLS/Realtime integration, TypeScript, production build and Biome.

Vercel reported the implementation preview **Ready**.

Browser-level authenticated Dogfood remains outstanding: the current execution environment does not provide the required `agent-browser` binary, cannot resolve the preview hostname from its container, and had no valid exam token/student session to exercise Phase 02. Do not report `COMPLETE` until the real browser paths and responsive/accessibility states in the governing plan are exercised.
