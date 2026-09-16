# Doctrine: Architecture and source ownership

Owner of: surfaces, role ownership, dependency direction, and cross-role boundaries.
Cited by: every role.

## Surface ownership

| Surface | Responsibility | Implementing role |
| --- | --- | --- |
| `src/app/api/**` | Route handlers: admin bootstrap/staff, exam/exams, realtime webhook, student | Backend engineer |
| `src/app/actions/**` | `"use server"` mutations and server reads | Backend engineer |
| `src/lib/supabase/**`, `src/lib/auth/**` | Supabase clients, SSR session, queries, role helpers | Backend engineer |
| Server data libraries | `src/lib/exam-*.ts`, `src/lib/questions*.ts`, `src/lib/subjects-catalog.ts`, `src/lib/fixture-sources.ts`, `src/lib/validation.ts`, `src/lib/assessment.ts` | Backend engineer |
| `prisma/**` | Canonical schema, migrations, seed, relation asserts | Backend engineer |
| `supabase/**` | `auth-rpc.sql`, `rls.sql` platform integration | Backend engineer |
| `scripts/**`, `public/seed/**` | Contracts, validators, canonical fixtures | Backend engineer |
| `src/types/db.ts` | Database row types | Backend engineer |
| `src/app` routes/pages/layouts | Route composition, metadata, loading/error boundaries | Frontend engineer |
| `src/components/**` | shadcn primitives (`ui/`) and product components | Frontend engineer |
| `src/hooks/**` | Client interaction hooks | Frontend engineer |
| `src/proxy.ts` | Supabase session refresh + role gating | Backend engineer (behavior), reviewer (boundary) |
| `prototype/` | Isolated static-HTML reference package | Owning engineer only when the task names it |
| `docs/**` | Specifications, plans, progress ledgers | Planner or owning engineer |
| `.agents/**` | Agent system itself | Orchestrator-routed agent-system work only |

The reviewer is read-only. It runs and assesses checks but does not own implementation files.
Shared code (`src/lib/utils.ts`, `src/lib/nav.ts`, `src/types/admin.ts`, `src/types/exam.ts`) is
edited by the role owning the consuming change.

## Server boundary

Festacol is a single Next.js application whose server surface is **Route Handlers plus Server
Actions**, backed by Supabase Postgres:

```text
browser ──► Route (RSC) ──► Server Action / Route Handler ──► Supabase (PostgREST / RPC) ──► Postgres + RLS
```

- All database access goes through the Supabase JS clients. Never import Prisma Client into
  `src/` runtime code; Prisma owns schema, migrations, seed, and validation only.
- Service-role access (`createSupabaseAdminClient`) is server-only and bypasses RLS — use it
  only for admin provisioning and server writes that genuinely require it, never in client
  components.
- `src/proxy.ts` (Next 16 convention, not `middleware.ts`) refreshes the Supabase session and
  enforces role separation: `/dashboard/*` requires an active `student` (except the public
  `/dashboard/exam` entry), `/admin/*` (except `/admin/login`) requires `teacher` or
  `administrator`; cross-role sessions go to `/denied`, never to the opposite login form.
- `POST /api/admin/bootstrap` (gated by `SETUP_SECRET`) and `POST /api/realtime/webhook`
  (verified by `SUPABASE_WEBHOOK_SECRET`) are the only privileged entry points; keep their
  secrets server-side.

## Dependency direction

```text
route/page ──► product component ──► hook ──► Server Action / Route Handler ──► lib/supabase query ──► Supabase ──► Postgres (RLS/RPC)
```

Rules:

- UI imports server data only through Server Actions, route handlers, or the `lib/supabase`
  query layer — never direct `pg`, never service-role from the browser.
- Fixture and seed code (`prisma/seed.ts`, `scripts/*`, `public/seed/*`) never ships into
  request paths.
- Shared `src/types` carry the wire shape; `src/types/db.ts` mirrors the canonical schema and
  is updated with the migration that changes it.
- Circular dependencies are resolved architecturally, not hidden. Cross-surface orchestration
  belongs to the server surface that owns the user operation.

## Prototype and docs boundaries

- `prototype/` is an isolated package with its own `package.json` and Playwright config — a
  visual/behavioral reference only. Never copy prototype HTML/CSS/JS into React, and never
  import it from `src/`. Prototype validation scripts live in `prototype/scripts/` and run with
  `prototype/` as the working directory.
- Active prototype-revamp work is governed by `docs/superpowers/IMPLEMENTATION-MANIFEST.md`
  (reading order, precedence, PR relationship). The planner maps every such task to its primary
  plan plus governing contracts before sequencing work.

## Structural change rule

A structural change must update all affected imports, types, fixtures, scripts, and entry points
in the same task. Do not leave compatibility stubs or duplicated implementations unless the user
explicitly requests a staged migration.
