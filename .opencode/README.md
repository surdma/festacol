# Festacol OpenCode setup

This directory is a thin OpenCode adapter over Festacol's existing agent architecture. It does not create a second source of truth.

## Authority

1. The root `AGENTS.md` is automatically discovered by OpenCode and remains the project entry point.
2. `.agents/**` is the canonical doctrine, role, workflow, and repository-local skill system.
3. `.codex/agents/**` and `.claude/agents/**` are tool-specific callers that point back to the same canonical roles.

If a thin caller disagrees with `.agents/**`, fix the caller. Do not fork the doctrine.

## Agents

- `festacol-orchestrator` — primary entry point and delivery controller.
- `festacol-planner` — repository-grounded planning for non-trivial work.
- `festacol-backend-engineer` — Server Actions, Route Handlers, Supabase, Auth, Prisma/RPC/RLS, fixtures, scripts.
- `festacol-frontend-engineer` — Next.js routes, React, hooks, shadcn, Tailwind, UX.
- `festacol-reviewer` — independent quality, security, architecture, accessibility, and completion gate.

The orchestrator is intentionally the only primary agent. Workers report back to the orchestrator instead of creating nested agent trees.

## Commands

`.opencode/commands/*.md` are thin invocable entries (`implement`, `review`, `bug-fix`,
`feature-review`) that point back at [`.agents/commands/**`](../.agents/commands/) and dispatch
through `festacol-orchestrator`. They contain no role content of their own.

## Project-level choices

- No model or provider is pinned. OpenCode inherits the user's global/provider selection.
- No MCP server is enabled by the repository. MCPs are opt-in because large tool catalogs increase context and credential coupling.
- Secret files are denied by default while `.env.example` remains readable.
- Generated/build/cache directories are ignored by the watcher.

## Maintenance rule

Keep this layer thin. Add an OpenCode-specific file only when OpenCode needs configuration that cannot live in `AGENTS.md` or `.agents/**`. Do not duplicate architecture, product rules, or framework guidance here.
