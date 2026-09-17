# `/exam` examination experience redesign

Date: 2026-09-17
Branch: `work/student-exam-onboarding-v2`

## Objective

Rebuild the production `/exam?token=…` route as a purpose-built computer-based examination environment while preserving the existing authoritative Supabase access, allocation, persistence, integrity, retake and scoring contracts.

The experience is one connected flow:

`access/auth → academic onboarding when required → overview → instructions → device/camera readiness → final confirmation → live examination → review → processing → completion/results`.

The live examination workspace is the primary surface and must remove unrelated application chrome.

## Verified current path

- `/exam` validates the opaque session link, redirects anonymous candidates through the shared student login, and re-checks `my_exam_access` after authentication.
- `StudentWizard` owns initial class confirmation / SS1 placement consent when access is not yet eligible.
- `allocate_my_exam_attempt` is the concurrency-safe attempt authority and remains the only way to start/resume a paper.
- `getExamPaperAction` resolves the immutable paper, persisted responses, current index, flags and remaining time.
- `saveProgressAction` persists progress; `submitExamAction` finalizes and grades the attempt.
- `loadExamRuntimeSession` already resolves the real academic level, target subjects, term/year, instructions, integrity policy, randomization and camera requirement.
- The current client UI underuses that metadata, presents only a single briefing card, renders the live paper as generic cards, and immediately stops the webcam stream after permission instead of maintaining a preview.
- The canonical Question row already persists `prompt`, `instruction`, `difficulty`, `domain`, response options/fill template and answer metadata. `src/lib/questions.ts` currently discards the safe presentation metadata before browser delivery.
- Fixture `requiredSelections` is not persisted as a separate column, but the human-readable persisted instruction already states exact selection counts for those seeded items.

## Product / interaction contract

### Pre-exam

1. **Overview** — candidate, exam, subject(s), level/class, academic period, duration, question count, mode and attempt/resume state from persisted data.
2. **Instructions** — session instructions plus concise system truths: autosave, navigation, flagging, timeout, final submission and integrity policy.
3. **Readiness** — browser/connectivity state, fullscreen capability where configured, and a persistent real webcam preview when `camera_required=true`. No microphone request unless a future persisted policy requires it. No face-recognition or invented stream-health scores.
4. **Final confirmation** — readiness summary and consequential Start/Resume action. Attempt allocation happens only here.

### Live examination

- Slim sticky exam header with exam/subject identity, save state, connection state and tabular timer.
- Dominant question region plus compact desktop utility rail.
- Persistent camera panel when required; a truthful “camera not required” state otherwise.
- Intelligent navigator distinguishing current, answered, incomplete, visited-unanswered, not-yet-visited and flagged using more than colour alone.
- Navigator filters for all / needs answer / flagged and scalable scrolling for large papers.
- Stable Previous / Flag / Clear / Next controls; Submit is visually and behaviorally separate.
- Responsive tablet/mobile utility Sheet with timer and question actions always reachable.
- Quiet save/connection feedback; no save-toasts.
- Controlled timer urgency without flashing.

### Question rendering

Use the canonical five response types end-to-end:

- `single` — full-row RadioGroup selection;
- `multi` — full-row Checkbox selection and an exact-selection hint derived from the persisted instruction where configured;
- `boolean` — large accessible true/false selection;
- `fill` / `fill-multi` — integrated text inputs following the stored fill template.

Safe question metadata (`instruction`, `domain`, `difficulty`) is delivered to the browser; explanations/correct answers remain server-only during an active exam.

Rich content uses the already-persisted question content contract rather than a parallel presentation table:

- a prompt may begin with a local Markdown image directive `![alt](/exam-assets/file.svg)`; the runtime extracts and renders only same-origin `/exam-assets/...` media and keeps the remaining prompt as the question text;
- a comprehension prompt may use `PASSAGE:\n…\n\nQUESTION:\n…`; the runtime presents the passage and question as separate reading/answer regions while the stored prompt remains meaningful plain text if rendered elsewhere.

Representative seeded questions use these conventions so image and passage states are production-data-backed rather than hard-coded component demos. No remote tracking image URL is accepted.

### Submission / results

- Review screen summarizes answered, unresolved and flagged counts and lets candidates jump directly back to those questions.
- One final irreversible confirmation; no dialog chain.
- Dedicated manual/time-expired processing state.
- Completion state includes real attempt/submission identity and completed count.
- Results emphasize interpretation: score, correct/incorrect/unanswered, completion, elapsed time, integrity and subject breakdown using existing scored data.
- Detailed correct-answer/explanation review is exposed only when the existing answer-reveal policy permits it; otherwise the UI states that review is not yet available.
- Do not invent pass/fail thresholds, class ranking, result-release controls, marks weighting or proctoring AI.

## Implementation sequence

1. **Experience contract/data** — expose full runtime session/candidate/access context and safe question presentation metadata; seed one persisted passage example and one same-origin diagram-backed example.
2. **Pre-exam + camera** — build connected preparation flow and persistent camera lifecycle.
3. **Live workstation** — rebuild question renderer, header, navigator, utility rail, save/connectivity states and responsive transformation.
4. **Submission/results** — review, processing, success, score interpretation and policy-gated detailed review.
5. **Validation/review** — exact-head fixture/runtime/Prisma/RPC/RLS/type/build/lint CI, independent source review and real browser dogfood where tooling permits.

## Acceptance criteria

- Existing token/auth/class/placement/access semantics are unchanged.
- Attempt allocation still occurs only through `allocate_my_exam_attempt`.
- Required camera permission blocks Start and the stream remains active throughout a live attempt until submission/unmount.
- Answers, flags, index and remaining time resume from persisted state.
- Every canonical question type remains answerable and uses local shadcn controls rather than raw interactive reimplementations.
- Seeded passage and diagram content reaches the live paper through the canonical question store, not component constants.
- Submission cannot happen by a single accidental click and unresolved questions are directly reachable from review.
- Timeout visibly transitions through finalization rather than abruptly replacing the workspace.
- Result metrics come from persisted/scored attempt data; answer disclosure follows the existing reveal policy.
- No unrelated dashboard/sidebar navigation appears during an active exam.
- 360×640, 375×812, 768×1024 and 1280×800 layouts have no ordinary page-level horizontal overflow; camera never covers the answer region.
- Keyboard focus, accessible labels/live status and reduced-motion behavior are preserved.
- Existing canonical migration history is untouched; no schema change is required for this presentation redesign.

## Main regression risks

- allocating an attempt during preparation instead of final Start;
- accidentally leaking correct answers/explanations in the browser paper payload;
- losing a required-camera stream during question transitions;
- autosave or timer regression during the UI rewrite;
- treating offline state as if the server save succeeded;
- breaking large-paper navigation or small laptop widths;
- changing qualifier/retake authorization while changing presentation;
- malformed rich prompt content causing unsafe or broken media rendering.
