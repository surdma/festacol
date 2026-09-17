# Phase 02 — Ready to Write design record

Status: Concept B selected — production implementation committed and CI verified
Prerequisite: Phase 01 remains the approved Admission Pass direction.
Governing plan: `docs/plans/2026-09-17-phase-02-ready-to-write.md`

## Selection result

**Selected:** **B — Folded Examination Booklet**.

The A–G comparison gate is closed for Phase 02. The wireframe board remains historical design evidence; production is re-authored in the repository's Next.js 16 / React 19 / shadcn Base Nova / Tailwind v4 stack rather than copied literally.

## Production translation contract

Concept B is a composition contract, not a loose theme reference:

- use a **flat two-page examination spread** with a visible center fold;
- use no large translucent phase number, ghost concept letter, or other watermark-like decorative text;
- no external app header, rounded dashboard shell, sidebar, progress rail, or multi-screen preparation sequence;
- left page keeps exactly four primary facts: **Candidate, Class, Questions, Duration**;
- right page keeps exactly three primary rules, a readiness stamp, and only restrained progressive disclosure for school-authored instructions;
- secondary real exam metadata may appear only as small supporting text and must not become additional panels;
- camera is absent when not required; when required it is a small on-demand booklet element with no microphone request;
- placement candidates do not answer level/path/class questions; one direct placement continuation is enough;
- normal candidates with no enrollment choose only their existing class;
- Start/Resume remains behind `getExamPaperAction` / `allocate_my_exam_attempt`;
- the live question workspace remains Phase 03 scope.

## Corrected source target

- `src/components/exam/exam-preflight.tsx` — literal Concept B spread, four facts, three rules, readiness stamp and perforated Start/Resume strip;
- `src/components/exam/exam-camera-panel.tsx` — compact booklet camera variant while preserving existing live-exam camera behavior;
- `src/components/exam/student-wizard.tsx` — narrow academic insert with direct placement continuation or one class selector;
- `src/components/exam/exam-workspace.tsx` — one pre-exam state for new and active attempts; no legacy preparation stages;
- `src/app/(exam)/exam/page.tsx` — routes denial reason into the minimal academic insert and eligible candidates directly into `ExamWorkspace`;
- `src/components/exam/exam-workspace-entry.tsx` — removed as obsolete compatibility glue.

No schema/RPC change is required. Server access, academic persistence, attempt allocation, autosave, integrity, scoring, submission and retake contracts stay authoritative.

## Validation

The earlier implementation passed CI but failed product fidelity review against the selected Concept B wireframe. The correction must be revalidated as a new implementation.

Validated correction: `3a9ca893d484308621f4c06958c3f8aae241db0f` passed Next.js Quality run #821 (`35279960669`), including TypeScript, production build and Biome.

Still required:
- independent browser review/dogfood;
- browser dogfood when a valid authenticated examination session and browser runner are available.

Do not report Phase 02 `COMPLETE` from CI alone.
