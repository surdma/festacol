# Phase 01 — Arrival & Identity brainstorm command

This command is the reproducible design brief used for the low-fidelity Phase 01 comparison artifact before high-fidelity implementation.

## Design-system search

Run the current `ui-ux-pro-max` design-system search first:

```bash
python3 skills/ui-ux-pro-max/scripts/search.py \
  "academic electronic examination secondary school student secure identity focused calm restrained gamification" \
  --design-system \
  -p "Festacol Exam — Phase 01 Arrival & Identity"
```

## Generation command

```text
/using-superpowers
/ui-ux-pro-max

Act as a principal staff UI/UX and product designer for Festacol, an academic electronic examination platform for secondary-school students.

TASK
Design ONLY Phase 01: "Arrival & Identity" for the production exam journey. Produce a single standalone low-fidelity `brainstorm.html` containing exactly seven genuinely different UI/UX directions, labelled A–G. Do not implement production React/Next.js code.

REPOSITORY EVIDENCE TO PRESERVE
- An exam link is validated before authentication.
- Before authentication, the safe exam context contains only exam ID, title, mode, open status, startsAt and endsAt.
- Anonymous students authenticate with the existing first-name / last-name student credentials and must return to the same exam destination.
- Staff accounts cannot write a student exam.
- Invalid, expired, not-started and closed links need clear recovery states.
- Do not surface candidate class, subjects, duration, question count, attempt status or richer policy before auth because those are resolved later.
- Do not invent pass/fail, rank, AI proctoring, microphone, biometric or other backend capabilities.

DESIGN PURPOSE
The current flow feels like a generic portal/card login. Reimagine it as a distinct, trustworthy gateway into a serious academic assessment. The student should immediately understand: (1) the exam link is recognized, (2) which examination they are about to enter, (3) that their identity must be confirmed, and (4) what happens next.

SEVEN DIRECTIONS
Each direction must solve the same operation but use a different information architecture and interaction metaphor. Across A–G include:
- a calm minimal direction;
- a secure checkpoint direction;
- an academic/editorial direction;
- a restrained gamified journey direction;
- an asymmetric desk/workstation direction;
- a ticket/admission-pass direction;
- a quiet command-console direction.
Do not make seven color variants of the same card.

LOW-FIDELITY RULES
- Wireframe only: grayscale, simple borders/surfaces, representative text and abstract shapes.
- Avoid polished brand imagery, decorative gradients and production-level visual finishing.
- Each concept occupies at least 100dvh.
- The document uses `scroll-snap-type: y mandatory` and every concept uses `scroll-snap-align: start` so one option snaps to one screen.
- Provide an unobtrusive fixed A–G navigation rail.
- Show the primary action, a secondary/help action, the authentication/error location, and where the verified exam context appears.
- Use only inline HTML/CSS/vanilla JS if interaction is needed. No framework or dependency is required.
- Motion ideas may be indicated with restrained CSS transitions. Respect `prefers-reduced-motion`.
- Maintain strong keyboard focus, labels, 44px-ish interactive targets and non-color-only status meaning.
- No emojis as interface icons.

OUTPUT
Write the artifact to:
`docs/design/exam/phase-01-arrival-identity/brainstorm.html`

The artifact is for design selection only. It must not import into or be copied verbatim into `src/**`. Once an option is selected, the production version will be re-authored with the repository's Next.js 16 / React 19 / shadcn Base Nova / Tailwind v4 stack and existing server contracts.
```

## Selection result

**Selected:** Option A — Admission Pass, selected by the product owner on 2026-09-17.

The high-fidelity implementation is now authored in production Next.js/React rather than copied from the wireframe. Its main production surfaces are:

- `src/components/exam/exam-admission-pass.tsx` — official examination admission pass, verified context and live QR;
- `src/app/page.tsx` — anonymous examination-link handoff to the admission pass;
- `src/components/exam/exam-help-dialog.tsx` — candidate support request flow;
- `src/app/actions/exam-support.ts` — validated server-side support delivery;
- `prisma/migrations/20260917180000_exam_support_requests/migration.sql` — durable support persistence;
- `supabase/realtime.sql` — private creator-only support broadcast;
- `src/lib/admin-notifications.ts` and `src/components/shell/realtime-notification-sync.tsx` — durable and live staff notification surfaces.

## Phase gate

Phase 01 production implementation is complete at source/integration-CI level. The next design phase is **Phase 02 — Academic Eligibility & Placement**. Generate and review its seven-option low-fidelity brainstorm before changing Phase 02 production UI.
