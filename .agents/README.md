# Festacol agent system

This directory is the complete operating system for **repository engineering agents** in the Festacol codebase. It defines stable engineering doctrine, professional roles, and executable workflows. Entry-point files outside this directory may point here, but must not duplicate these instructions.

## Design principles

1. **One owner per concern.** Every source surface has one implementing engineering role.
2. **Doctrine owns standards; roles own work; workflows own sequencing.** Do not duplicate a standard inside several role files.
3. **No speculative delivery.** Engineering agents implement the user's requested scope completely and verify it. They do not replace implementation with plans, TODOs, placeholders, or future promises.
4. **Repository evidence outranks assumptions.** Inspect current code, dependency versions, scripts, and active specifications before acting.
5. **Professional judgment over pattern collection.** Use an abstraction only when current complexity, risk, or reuse justifies it.

## Structure

```text
.agents/
├── doctrine/    stable repository-wide engineering standards
├── roles/       professional engineering responsibilities and source ownership
├── workflows/   sequencing and engineering handoff rules
├── commands/    operational entries for implement / review / bug-fix / feature-review
└── skills/      vendored repository-local skills (Prisma family)
```

## Operating files

- [protocol](protocol.md): shared engineering startup contract, stable engineering-agent names, cross-surface barrier, and standard engineering handoff envelope.
- [commands/implement](commands/implement.md), [commands/review](commands/review.md), [commands/bug-fix](commands/bug-fix.md), [commands/feature-review](commands/feature-review.md): operational entries binding workflows to verification gates and engineering handoffs.
- The global `dogfood` skill (`/dogfood`) is the completion gate for code agents. Festacol keeps no local copy; feed it runtime facts from the root `AGENTS.md`, per [validation and reporting](doctrine/validation-and-reporting.md).

## Stable engineering-agent names

Engineering agents spawn each other by stable name in every harness:

| Stable name | Mode | Role |
| --- | --- | --- |
| `festacol-orchestrator` | primary | [orchestrator](roles/orchestrator.md) |
| `festacol-planner` | subagent | [planner](roles/planner.md) |
| `festacol-backend-engineer` | subagent | [backend-engineer](roles/backend-engineer.md) |
| `festacol-frontend-engineer` | subagent | [frontend-engineer](roles/frontend-engineer.md) |
| `festacol-reviewer` | subagent | [reviewer](roles/reviewer.md) |

Considered and intentionally rejected: a separate contracts engineer (schema/RPC/fixture ownership lives with the backend engineer), a separate auth engineer (Supabase Auth ownership lives with the backend engineer), a GitHub-mechanics role (orchestrator routes PR actions through the `create-pr` skill), and an integration-linker role (the server/client seam is owned by the data-contract barrier in each workflow). Do not invent additional roles; if coordination hurts, fix the workflow.

## Roles

| Role | Professional stance | Source ownership |
| --- | --- | --- |
| [orchestrator](roles/orchestrator.md) | Engineering lead and task router | No product source |
| [planner](roles/planner.md) | Staff-level delivery planner | Planning artifacts only when requested |
| [backend-engineer](roles/backend-engineer.md) | Senior server and data engineer | `src/app/api/**`, `src/app/actions/**`, `src/lib/supabase/**`, `src/lib/auth/**`, `prisma/**`, `supabase/**`, `scripts/**`, `public/seed/**` |
| [frontend-engineer](roles/frontend-engineer.md) | Principal frontend and product-experience engineer | `src/app` routes/pages, `src/components/**`, `src/hooks/**` |
| [reviewer](roles/reviewer.md) | Principal quality and security reviewer | No product source |

Shared code (`src/types/**`, `src/lib/utils.ts`, `src/lib/nav.ts`) is edited by the role that owns the consuming change; schema-adjacent types (`src/types/db.ts`) belong to the backend engineer.

## Doctrine ownership

| File | Owns |
| --- | --- |
| [00-authority](doctrine/00-authority.md) | Instruction precedence, evidence, overrides |
| [product](doctrine/product.md) | Product truth, safety boundaries, domain language |
| [architecture](doctrine/architecture.md) | Surfaces, engineering-role ownership, dependencies |
| [engineering-discipline](doctrine/engineering-discipline.md) | Evidence-driven implementation and judgment |
| [conventions](doctrine/conventions.md) | Naming, files, imports, TypeScript, scope |
| [persistence](doctrine/persistence.md) | Supabase Postgres, Prisma migrations, seed, RLS/RPC |
| [data-contracts](doctrine/data-contracts.md) | Fixture contracts, runtime schema contract, exam-link invariants |
| [authentication-and-security](doctrine/authentication-and-security.md) | Supabase Auth, authorization, HTTP security, abuse controls |
| [frontend-architecture](doctrine/frontend-architecture.md) | Next.js/RSC boundaries, Server Actions, API consumption, type/runtime safety |
| [state-and-data](doctrine/state-and-data.md) | Server state, URL state, form state, hooks |
| [ui-and-design-system](doctrine/ui-and-design-system.md) | shadcn components, Tailwind tokens, themes, responsive UI, accessibility |
| [toolchain-and-skills](doctrine/toolchain-and-skills.md) | Mandatory engineering skills, version-aware tool use, package manager |
| [validation-and-reporting](doctrine/validation-and-reporting.md) | Test gates, behavioral proof, completion reports |

## Workflows

- [feature](workflows/feature.md): new or changed capability
- [bugfix](workflows/bugfix.md): defect or regression
- [ui-change](workflows/ui-change.md): presentation or interaction change without server behavior

## Editing this system

- Put a new standard in the doctrine file that owns the concept.
- Put engineering source ownership and professional behavior in a role file.
- Put engineering sequencing and handoff barriers in a workflow file.
- Put repeatable engineering operational loops in `commands/**`, pointing at workflows/doctrine instead of restating them.
- Harness adapters under `.opencode/**`, `.claude/**`, and `.codex/**` must stay thin callers that point back at canonical engineering files here; they may carry tool-specific permissions but never product or doctrine content.
- Do not add current debt lists, implementation roadmaps, or unbuilt target claims to doctrine. Repository state is inspected at task time and reported as evidence.
- When a structural rule is machine-checkable, add/update the corresponding repository check (script, SQL assert, or CI step) in the same implementation that changes the rule.
