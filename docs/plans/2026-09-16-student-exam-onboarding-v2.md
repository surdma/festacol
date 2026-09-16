# Student exam onboarding v2 — implementation plan

Date: 2026-09-16

## Outcome

Make `/exam?token=…` the canonical candidate route and keep the entire examination runtime outside the student dashboard shell. An exact exam link remains reachable before sign-in only so a student can identify with first + last name; the examination itself never renders until a real active student session exists.

New or unassigned students complete a server-backed academic configuration step after sign-in. Existing enrolled students may confirm, but not self-transfer from, their persisted class.

For qualifier sessions only, an unassigned student who selects SS1 may explicitly consent to placement. Consent keeps the student class-less (the SS1 holding state), grants access to that qualifier, and sends them into the standalone exam. SS2 and SS3 never receive a placement choice: they identify an active class and then enter the dashboard. An SS1 student who already knows their class may also identify it instead of taking placement and then enters the dashboard.

Normal, non-qualifier exam links keep their normal purpose: after an unassigned student identifies an eligible class, server access is rechecked and the student enters that exact exam; otherwise the server returns a scoped eligibility error.

## Server contract

1. `enterExamByNameAction` authenticates or provisions only. It no longer auto-enrolls an unknown student from the exam target and no longer grants qualifier access before the academic configuration decision. It returns `studentNumber`, `provisioned`, and `next: "configure"`.
2. `getExamEntryWizardDataAction` returns the exact link-resolved exam, active levels/classes, and the caller's current enrollment with its resolved level/class metadata.
3. Add `completeExamOnboardingAction({ token, levelId, classId, placementConsent })`.
   - Revalidate student session, token, link expiry, exam status, active level/class.
   - Existing active enrollment is confirmation-only: submitted class/level must match it.
   - Unassigned class selection upserts one active enrollment after verifying class ↔ level.
   - Placement consent requires: qualifier session, no active class enrollment, SS1, and no explicit deny row. It creates/updates an `allow` access row with `max_attempts_override=1`. Attempt allocation remains enforced by the existing RPC.
   - Qualifier + class identification routes to dashboard rather than the placement paper.
   - Non-qualifier + class confirmation calls `my_exam_access` after configuration and enters the exam only when eligible.
4. Existing `exam_sessions.attempt_limit=1` + `private.student_allowed_attempts` + `exam_retake_grants` remain the only attempt policy. `authorizeRewriteAction` / `grant_exam_retake` remains the staff/admin mechanism for another attempt.
5. Change all generated candidate paths to `/exam?token=…`. `/dashboard/exam` remains compatibility-only and redirects to `/exam`.

## Frontend

- `(exam)/layout.tsx` becomes a neutral standalone shell so anonymous credential/onboarding can render without dashboard chrome.
- `(exam)/exam/page.tsx` owns token validation, anonymous entry, authenticated configuration/runtime selection, and staff denial.
- Move the reusable exam runtime and entry UI out of `src/app/dashboard/exam/**` into `src/components/exam/**`.
- Wizard states: identify level → choose class or SS1 placement path → consent/confirm → server outcome.
- Existing enrollment is displayed as confirmation-only.
- Only qualifier + unassigned SS1 renders placement consent.
- SS2/SS3 and known-class SS1 finish qualifier onboarding at `/dashboard`.

## Security and integrity

- First + last name remain the user-facing credential; Supabase Auth remains the session system.
- Anonymous `/exam` can only resolve the public entry shell. All class writes, access grants, eligibility checks and exam allocation happen in server actions/RPCs.
- No client-provided student id is accepted.
- Existing enrolled students cannot self-transfer.
- Explicit deny rows win.
- Link active/expiry and exam open state are rechecked server-side.
- Placement cannot be attempted twice without an existing staff-scoped retake grant; allocation remains the concurrency-safe enforcement boundary.

## Validation

Run the canonical quality sequence against the exact implementation commit: fixture/runtime contract, Prisma validate/generate, TypeScript, production build and Biome. Exercise the real route for anonymous credential entry, new SS1 placement consent, SS2 class identification, existing enrollment confirmation, second placement allocation lock, staff retake grant, expired link, and staff-on-student denial. Dogfood the standalone route at mobile and desktop with console/network checks.
