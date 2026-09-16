# Guest exam-link entry → wizard → standalone exam + hard delete — executable plan

Date: 2026-09-16 · Branch: `work/academic-relational-schema-v2-validation` · Owner sequence: planner → backend → frontend → reviewer

## 1. User outcome + acceptance evidence

A guest opening an exam link (`/dashboard/exam?token=…`, later the standalone exam route) can:

1. Create a student account inline (first + last name only — already the credential in `src/lib/auth/student.ts` / `enterExamByNameAction`).
2. Be shown their new **student ID (FST-XXXXX) with an explicit "write this down" step** before continuing.
3. Complete a **buttons-only pre-exam wizard** (no text input): Level buttons (SS1/SS2/SS3) → arm/class buttons (arm A per `public/seed/classes.json`; track comes from placement auto-suggest for unassigned, not typed) → exam-session confirm.
4. Be routed by eligibility:
   - SS1-enrolled student opening an SS2-targeted exam → **blocked, "not qualified"** (deny wins, no retry into same exam).
   - SS1-holding/unassigned student with no account history → **placement (qualifier) exam** whose score **auto-suggests Science/Business/Humanities**, then **staff confirms promotion into a real SS1 class** (existing `upsertUserAction({classId})` path).
   - Unassigned students **stay in the SS1 holding pool** (no active `class_enrollments` row) until placement is decided — never auto-promoted to a real class id.
5. Write the exam **end-to-end in a shell completely separated from the dashboard shell** (no sidebar/header chrome), then submit.
6. Admin can **fully hard-delete a student or staff account** (auth user + member + attempts/results; audit log row only).

Acceptance evidence (live, not compile-only): guest link → provisioned account → ID reveal → wizard (3 button steps) → placement attempt → auto-suggest visible to staff → staff promotion → class exam entry → standalone submit; plus one failure path each for expired link, closed exam, deny/not-qualified, and cross-role (staff session on exam link). Admin hard-delete verified by member + auth-user absence and audit row presence.

## 2. Server/data impact

- **Auth signup shape** (`src/lib/auth/student.ts#provisionNewStudentAccount`, consumed by `src/app/actions/exam-entry.ts` + `src/app/actions/student.ts`): keep member-first provisioning (member row → `admin.auth.admin.createUser(student.<memberId>@festacol.local)` → `claim_student_auth_identity`). Change: **return `studentNumber` to the caller** so the entry result can carry it to the ID-reveal state. No new credential fields (names stay the credential; speed requirement).
- **Member row — holding vs real class**: unassigned = `school_members` row with **zero active `class_enrollments`** (already what provisioning produces; `upsertUserAction` already supports create-without-enrollment and explicit unassign `classId:""`). No new "holding class" id — `classes.json` 9 real classes (level × track, arm A) stay the only class ids. Wizard "SS1 holding pool" is a UI label for the no-enrollment state, not a class row. Fixture-compatibility: none (no fixture change).
- **Placement attempt + auto-suggest rule**: reuse qualifier mode. `submitExamAction` already writes `assigned_track` + `placement_confidence` from `scoreAttempt` placement output. Backend adds a small read surface (staff-visible suggested track per unassigned student, e.g. extend `getUserDetailAction`/attempt detail — exact shape owned by backend) and keeps **staff-confirmed promotion** as the only writer (`upsertUserAction` with target `ss1-<track>-a`). Students never self-promote (RLS: no client enrollment writes exist — keep it that way).
- **Eligibility check SS1 vs SS2**: extend server-side gating, not just `student_is_targeted_for_exam`. Rule: resolve student's level ordinal from active enrollment (`classes → academic_levels.ordinal`; unassigned = ordinal 1 holding) vs exam target level ordinal(s) (from `exam_class_targets` + offering classes). If `studentOrdinal < minTargetOrdinal` (e.g. SS1 → SS2 exam) return `not_eligible`/`not-qualified`. Deny rows still win over everything. Implement in `enterExamByNameAction` (entry hint), `my_exam_access` denial path (surface), and `allocate_my_exam_attempt` (enforcement). RPC change is additive (new reason string + ordinal comparison; no signature break).
- **Hard-delete cascade** (new admin-only Server Action, e.g. in `src/app/actions/admin.ts`): order — retake grants/access rows → attempt responses → integrity events → attempts (note: `ExamAttempt.session` is `Restrict`, `student` is `Restrict`, so attempts must be deleted explicitly before member) → subject/teaching/qualification rows → enrollments → member row → `admin.auth.admin.deleteUser`. Applies to student **and** staff targets (staff path also clears qualifications/assignments/created-exam creator→null via existing `SetNull`). Require administrator (`requireAdmin`), require typed confirmation input, write one audit row (only retained record). No audit table exists in `prisma/schema` today — backend owns adding the minimal one via migration.
- **RLS/RPC changes**: `supabase/auth-rpc.sql` (eligibility ordinal rule + hard-delete helper RPC if backend chooses RPC over ordered service-role deletes; either way service-role-only for deletes), `supabase/rls.sql` (audit table policies: admin-write/staff-read or admin-only; no student access). No student-writable surface is added.
- **Migration order**: `prisma migrate` (audit table only, if added; no changes to existing tables) → `pnpm db:seed` unchanged → apply `supabase/auth-rpc.sql` **then** `supabase/rls.sql` (repo-mandated order). `seed:check` + runtime-contract check must stay green — no banned tokens (`programme*`, hash columns, `class_level`, …).
- **Exact compatibility class**: **additive backward-compatible** — new nullable/audit-only tables, new RPC reason branch, extended (not narrowed) Server Action result fields (`studentNumber`, `next` hints). No renames, no removed columns, no fixture reshapes, no client-write expansion.

## 3. Route/state impact

- **Public exam-link entry** (`src/app/dashboard/exam/page.tsx`, public via `src/proxy.ts` `/dashboard/exam*` carve-out): keep token-as-navigation-identity + server recheck. Add post-provision **ID-reveal state** (new `studentNumber` in `ExamEntryResult`; client holds it in local state until acknowledged — never in URL).
- **Wizard steps as buttons**: new client wizard component fed by server data (levels SS1/SS2/SS3 from `academic_levels`; class/arm buttons from active `classes`; session confirm from link-resolved exam metadata). Steps: 1) Level buttons → 2) arm/class buttons (track prefilled from placement suggest for unassigned; selectable only where staff scope allows otherwise) → 3) session-confirm button. No text inputs in wizard. Server/Client boundary: wizard is client state machine; every transition validated by a Server Action/RPC recheck before `allocate_my_exam_attempt`.
- **Standalone exam shell outside dashboard layout**: move the exam runtime (`ExamWorkspace` in `src/app/dashboard/exam/workspace.tsx`) under a route **outside `src/app/dashboard/layout.tsx`** (e.g. a new `(exam)` route group reusing the same token + `my_exam_access` checks) so signed-in students get zero sidebar/header chrome. Keep `/dashboard/exam?token=` as the entry/compat path (proxy carve-out + `?next=` preserved) redirecting or handing off to the standalone shell. Deny explicitly on staff sessions (existing `AccessDenied` pattern, keep `?next=` + `from`/`reason` params).
- **Denied/not-qualified states**: distinct copy — `not-eligible` (explicit deny), `not-qualified` (SS1→SS2 level block), `placement-first` (multi-class ambiguity → placement), expired/invalid link, closed/not-started. Token-probing rule stays: `not_found` and `not_eligible` share one message at the link-resolution layer (see `denialMessage` in `page.tsx`).
- **Server/Client boundaries**: all eligibility, provisioning, promotion, delete, and grading stay in Server Actions/RPC/service-role. Client holds only wizard step state, ID-acknowledged flag, and exam runtime UI state.

## 4. Exam-integrity implications

- Link token stays opaque (`exam_session_links.token`; QR in `exam_qr_codes`); never mint in browser; expiry + `active` rechecked at entry, page load, and allocation.
- Role re-checks at every layer: proxy (staff→`/denied`, anon→`?next=` login), layout defense-in-depth, `enterExamByNameAction` staff guard, `my_exam_access`/`allocate_my_exam_attempt` student-only enforcement.
- Closed/not-started/ended exams blocked at `my_exam_access` + allocation (existing `not_open`/`not_started`/`ended` reasons preserved).
- Attempt limits + retake grants unchanged; no reset path (per `resetUnfinishedAttemptAction` removal — retake grant only).
- Placement suggest is advisory (`assigned_track` on attempt); promotion is a separate staff write — a suggested track never grants class-exam access by itself.
- Hard delete preserves exam-session aggregates only via audit row; deleted attempts are gone (by design — confirm copy must say so).

## 5. Responsive + accessibility expectations

- Wizard: full-width ≥44px buttons, one decision per screen, visible focus rings, `aria-live` announcements for step changes and ID reveal, keyboard-operable (roving tab / native buttons), works at 360px wide and desktop; both themes; no console/network errors.
- Exam shell: same standalone shell at mobile + desktop, timer + progress perceivable without color alone, keyboard navigation for questions, focus trap only where dialogs require it, reduced-motion respected.
- Delete confirm: admin-only two-step confirm (type-to-confirm for hard delete), `role="alertdialog"`, destructive styling + explicit scope copy (auth + member + attempts), keyboard accessible, audit-row confirmation shown after.

## 6. Role order + explicit exclusions

1. **Backend first**: migration (audit table if needed) → RPC (`not-qualified` ordinal rule) → RLS → Server Action shapes (`ExamEntryResult.studentNumber`, wizard data + transition check, staff promotion read, admin hard delete) + **live evidence** (seeded DB: provision → wizard data → placement submit → suggest → promote → level-block → hard delete).
2. **Frontend second**: consumes the exact real shapes — ID-reveal state, button wizard, standalone shell route, denied/not-qualified/expired/closed states, admin delete dialog. No local shape copies, no fixture stand-ins.
3. **Reviewer**: real route + real server surface + rendered states per cross-surface barrier.

Exclusions (non-goals): no new auth provider or password change; no self-service promotion; no holding-class fixture rows; no client-side eligibility logic; no prototype copy/import (`prototype/` visual reference only); no ESLint reintroduction (Biome only); no npm/yarn/bun lockfiles; no speculative infra (no new realtime channel, no new storage bucket, no parallel exam runtime).

## 7. Acceptance gates

Festacol gate sequence in order: `pnpm seed:check` → `node scripts/validate-runtime-schema-contract.mjs` → `pnpm exec prisma validate` → `pnpm db:generate` → `pnpm exec tsc --noEmit` → `pnpm build` → `pnpm lint` (biome). Data changes add: migrate deploy → seed → apply `auth-rpc.sql` then `rls.sql` → seed-relations assert. Live evidence required: success path (guest link → account → ID reveal → wizard → placement → suggest → staff promote → class exam submit in standalone shell → admin hard delete with audit row) **plus one failure path** (expired link **or** closed exam **or** deny/not-qualified **or** unauthenticated/forbidden). Dogfood (`/dogfood`) gate per validation-and-reporting; browser matrix (both themes, mobile + desktop viewports, keyboard-only pass) for wizard + shell + delete dialog.
