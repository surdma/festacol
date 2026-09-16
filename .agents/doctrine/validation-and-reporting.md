# Doctrine: Validation and completion reporting

Owner of: evidence required for completion and the final implementation report.
Cited by: every role and workflow.

## Validation principle

The implementing engineer runs checks for its own work. The reviewer independently inspects the
diff, reruns or samples critical gates, and issues the verdict.

A passing typecheck does not prove a route, Server Action, migration, auth cookie, responsive
layout, theme, or accessibility behavior. Match evidence to the changed behavior.

## Baseline gates

Use actual repository scripts. For every source change, run the applicable equivalents of the
root `AGENTS.md` verification order:

```bash
pnpm seed:check
node scripts/validate-runtime-schema-contract.mjs
pnpm exec prisma validate
pnpm db:generate
pnpm exec tsc --noEmit
pnpm build
pnpm lint
```

Do not invent command names. Record the exact commands used. Do not bypass a gate with an
ignore comment, disabled rule, unsafe cast, skipped check, or relaxed configuration unless the
user explicitly approves the underlying tradeoff and the reason is recorded.

`pnpm lint` is `biome check`. During iteration a scoped check is acceptable; before handoff run
the CI-scoped surfaces (`prisma.config.ts`, `prisma/seed.ts`, `src/app/actions`,
`src/app/api/admin`, `src/lib/auth`, `src/lib/exam-session.ts`, `src/lib/supabase/queries.ts`,
`src/types/db.ts`) at minimum.

## Data gates

For schema, fixture, seed, RPC, or RLS changes, add as applicable — against real Postgres
(local or CI service), never mocks alone:

- `pnpm exec prisma migrate deploy` on a clean database;
- `pnpm db:seed`;
- `psql -f prisma/tests/seed-relations.sql`;
- apply `supabase/auth-rpc.sql` then `supabase/rls.sql`, and assert the platform integration
  (RPCs `my_exam_access`, `allocate_my_exam_attempt`, `grant_exam_retake` exist; RLS policies
  such as `exam_attempt_responses` are present) — the same asserts CI runs;
- migration SQL review: no data loss, no edited applied migration, corrective migration for
  shared environments.

A data change is NOT verified until the migrated, seeded database passes the relation asserts
and the RPC/RLS files apply cleanly. Unit prose about the schema is not evidence.

## Server gates

For Server Action, Route Handler, auth, or gating changes, add as applicable:

- boot the dev server (`pnpm dev`) and exercise the changed surface with real HTTP:
  `GET /health`-style liveness where applicable plus one success and one relevant failure path
  (invalid body, unauthenticated, forbidden role, expired link, closed exam);
- `POST /api/admin/bootstrap` changes: prove `SETUP_SECRET` gating (missing secret rejected,
  valid secret provisions exactly once);
- `POST /api/realtime/webhook` changes: prove `SUPABASE_WEBHOOK_SECRET` verification (bad
  signature rejected, good signature ingested idempotently);
- `src/proxy.ts` changes: prove student/staff/cross-role/anonymous routing (`/dashboard`,
  `/dashboard/exam`, `/admin`, `/denied`, `?next=` preservation);
- attempt-allocation or access-grant changes: prove duplicate-safe behavior and audited
  grantor/reason/expiry.

Record exact commands, statuses, and truncated bodies. A handoff that lists only
`tsc`/`build` without live surface evidence is incomplete and the reviewer must block it.

## Frontend static gates

For every frontend source change: scoped Biome check while iterating, full scoped lint before
handoff, full typecheck, production Next.js build, and `react-doctor` for material component
work, refactors, and bugfixes.

No new lint suppression, TypeScript suppression, `any` escape, non-null assertion hiding
runtime absence, hydration warning, console error, unhandled rejection, unstable key, invalid
DOM nesting, raw native recreation of an available shadcn primitive, or component stylesheet /
inline style.

## Frontend behavioral gates

For data-backed or interactive changes: the real route loads; the real Server Action or
endpoint is called; the response parses into typed shapes; auth session behavior is correct;
loading, slow-loading, empty, partial, one, many, error, unauthorized, forbidden, and
unavailable states behave; mutation pending/success/conflict/retry/duplicate-submit behave;
route `loading`, `error`, and `not-found` boundaries behave where changed; browser back/forward
stays correct; no failed or duplicate network requests without explanation.

Do not complete a data-backed feature against fixtures when the requested server capability is
available or part of the same task.

## UI and accessibility gates

For every material UI change: correct local shadcn usage with no raw interactive replacement;
semantic Tailwind tokens in light and dark themes meeting contrast requirements; keyboard
navigation and focus order with visible focus and restoration; accessible names, labels,
descriptions, errors, and live status; reduced-motion behavior; required viewport behavior
(360×640 minimum, 375×812, 768×1024, 1280×800, short desktop for overlays) with no page-level
horizontal overflow; reachable overlay actions; appropriate touch targets; long-text and zoom
behavior. Automated checks never replace keyboard and visual inspection.

## Dogfood completion gate

For every implementation completion, bug fix after the fix, and feature acceptance, the
implementing engineer and the reviewer apply the global `dogfood` skill (`/dogfood`): exercise
the changed surface as a real user against the real running product — browser flows for routes
and UI, real HTTP checks for server surfaces — before any Pass. Feed it Festacol's runtime
facts from the root `AGENTS.md` (dev command, routes, privileged endpoints, gate sequence).

When a category has no runnable surface (for example, doctrine-only changes), record it as
`not applicable` with the reason. Do not claim a browser or runtime check passed without
executing it, and do not let compilation stand in for an available live check.

## Reviewer verdict

Use:

- **Pass**: applicable gates and behavior are evidenced; no blocking finding.
- **Pass with noted pre-existing issues**: current change is sound and unrelated existing issues
  are evidenced.
- **Block**: a new defect, security issue, contract mismatch, migration defect, missing required
  implementation, or unverified critical path remains.

Findings use:

- **Critical**: security, authorization, data integrity, exam-integrity breach, migration
  defect, secret exposure, resource leak, inaccessible critical task, or false completion claim;
- **Warning**: likely correctness, runtime safety, operability, responsive, theme,
  accessibility, visual-system, or maintainability defect in changed scope;
- **Suggestion**: non-blocking improvement with clear value.

Every Critical and Warning includes file/line evidence and a concrete remediation.

## Completion report

Every implementing handoff states: what changed and why; owned surfaces and important files;
Server/Client decisions where relevant; schema/migration/fixture/RPC/RLS implications;
security and authorization behavior; shadcn primitives, tokens, and product components
introduced or changed; exact commands actually run with result; runtime behavior actually
exercised; responsive, theme, accessibility, and browser evidence for UI work; blockers or
unverified paths; material doctrine/skill translation or user override.

Do not add generic future improvements. Report only actual remaining limitations relevant to
the requested scope.
