# Festacol Agent Protocol

This file is the shared operating contract for every Festacol engineering agent. It tells each role
how to start, how to invoke other roles, and what a complete handoff looks like. Standards stay in
[doctrine](README.md); sequencing stays in [workflows](workflows/); this file only binds them into
one startup and reporting behavior.

## Startup

Every role, in every harness (OpenCode, Claude Code, Codex), performs this startup before acting:

1. Read the root `AGENTS.md` and [authority doctrine](doctrine/00-authority.md).
2. Read this protocol and your own role file under [roles/](roles/).
3. Use the one workflow supplied by the orchestrator under [workflows/](workflows/), or select the
   single shortest applicable one when you are the orchestrator.
4. Before any software-development work, load `using-superpowers`; you are not exempt unless you
   were dispatched as a subagent executing a specific assigned task.
5. Load only the skills your role and changed scope require ([toolchain doctrine](
   doctrine/toolchain-and-skills.md) lists the mandatory ones). Do not bulk-load skills.
6. Inspect current branch, status, affected code, scripts, versions, tests, and specifications
   before changing anything.
7. For implementation, bug fixes, feature review, or code review, apply
   [validation and reporting](doctrine/validation-and-reporting.md) and the global `dogfood`
   skill (`/dogfood`), using the repository runtime facts (commands, ports, routes) documented
   in the root `AGENTS.md`.

## Stable agent names

Agents invoke each other by these stable names — never by reconstructed prompt paths or ad-hoc
prompt copies:

| Stable name | Mode | Role file |
| --- | --- | --- |
| `festacol-orchestrator` | primary | [roles/orchestrator.md](roles/orchestrator.md) |
| `festacol-planner` | subagent | [roles/planner.md](roles/planner.md) |
| `festacol-backend-engineer` | subagent | [roles/backend-engineer.md](roles/backend-engineer.md) |
| `festacol-frontend-engineer` | subagent | [roles/frontend-engineer.md](roles/frontend-engineer.md) |
| `festacol-reviewer` | subagent | [roles/reviewer.md](roles/reviewer.md) |

There are exactly five roles. There is no contracts engineer (schema, RPC/RLS, and fixture
ownership lives with the backend engineer), no separate auth engineer (Supabase Auth lives with
the backend engineer), no GitHub-mechanics role (orchestrator routes PR actions through the
`create-pr` skill), and no integration-linker role (the server/client seam is owned by the
data-contract barrier in each workflow). Do not invent additional roles; if coordination hurts,
fix the workflow.

## Ownership map

Authoritative surface ownership is defined in [architecture doctrine](
doctrine/architecture.md). Summary:

- `festacol-backend-engineer`: `src/app/api/**`, `src/app/actions/**`, `src/lib/supabase/**`,
  `src/lib/auth/**`, server data libraries (`src/lib/exam-*.ts`, `src/lib/questions*.ts`,
  `src/lib/subjects-catalog.ts`, `src/lib/validation.ts`), `prisma/**`, `supabase/**`,
  `scripts/**`, `public/seed/**`, `src/types/db.ts`;
- `festacol-frontend-engineer`: `src/app` routes/pages/layouts, `src/components/**`, `src/hooks/**`;
- planner: planning artifacts under `docs/**` only;
- orchestrator and reviewer: no product source.

## Cross-surface barrier

When a change crosses the server/client seam (schema, RPC/RLS, fixture shape, Server Action or
API shape consumed by UI):

1. The backend engineer produces the migration, RPC/RLS change, fixture shape, and working server
   surface first.
2. The frontend engineer consumes exactly that real shape — never a local copy or a fixture
   standing in for available server capability.
3. Visual shell work may proceed independently; data-backed work may not.
4. The reviewer verifies the real seam with the real route, server surface, and rendered states.

Do not run backend and frontend implementation in parallel against an unresolved shape.

## Questions and alternatives

Ask when repository evidence cannot resolve a material decision affecting product behavior,
authorization, persistence, exam integrity, design direction, or architecture. For consequential
choices, record in the handoff: the chosen approach, one credible alternative, when the
alternative would win, and why the current constraints favor the choice made.

## Maintainability

Prefer the smallest complete solution. Reuse existing modules, primitives, tokens, types, and
conventions. Do not add speculative infrastructure, parallel subsystems, duplicate schemas, or
abstraction without demonstrated need. Complete the requested scope; do not substitute plans,
TODOs, fixtures, or placeholders for implementation.

## Standard handoff envelope

Every inter-role handoff and completion report uses these fields (detail for each lives in
[validation and reporting](doctrine/validation-and-reporting.md)):

- `STATUS`: done / blocked / partial, with reason;
- `SCOPE`: what this role was asked to own;
- `CHANGED`: files and surfaces actually changed;
- `CONTRACTS`: schema/migration/fixture/RPC/RLS impact and compatibility class, or `none`;
- `VERIFIED`: exact commands run and their real results — for server/data changes this MUST
  include the Festacol gate sequence (`seed:check`, runtime-contract check, `prisma validate`,
  `db:generate`, `tsc --noEmit`, `build`, scoped `biome lint`) plus, when Postgres was touched,
  migration/seed/RPC evidence per validation-and-reporting; handoffs without it are incomplete;
- `BROWSER`: browser scenarios exercised (routes, viewports, themes, states), or `N/A` + why;
- `API`: route/server checks performed with live evidence, or `N/A` + why — never `passed` on
  compilation alone;
- `DOGFOOD`: result of the global `dogfood` skill (`/dogfood`) gate, or `N/A` + why;
- `RISKS`: remaining limitations relevant to the requested scope;
- `QUESTIONS`: material questions the user must answer, or `none`;
- `ALTERNATIVES`: recorded consequential choices as described above;
- `NEXT OWNER`: who acts next, or `reviewer` at implementation handoffs;
- `QUALITY BAR`: confirmation that no gate was skipped, suppressed, or assumed — including live verification.

Never claim a command, test, migration, browser check, dogfood pass, skill, or integration ran
unless it actually ran. Use the authority-doctrine statuses precisely: passed, failed, blocked,
not applicable, not run. A `VERIFIED: pnpm build passed` without exercising the changed runtime
surface is `not run` for the runtime gate.
