# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Agent system

`.agents/**` is the single source of truth for how agents work here. This file is a thin entry
point — when it and doctrine disagree, doctrine wins and this file gets fixed.

- [`.agents/README.md`](.agents/README.md) — the map.
- [`.agents/doctrine/**`](.agents/doctrine/) — stable rules, one owner per concern.
- [`.agents/roles/**`](.agents/roles/) — five roles and their owned surfaces.
- [`.agents/workflows/**`](.agents/workflows/) — role sequencing for feature / bugfix / ui-change.
- `.claude/agents/festacol-*.md` — spawnable stubs (`festacol-orchestrator`, `festacol-planner`,
  `festacol-backend-engineer`, `festacol-frontend-engineer`, `festacol-reviewer`).

There is no separate contracts or auth engineer: schema, fixtures, RPC/RLS, and server work
belong to backend ownership, and the frontend engineer owns both frontend implementation and
UI/UX execution.

Start with [`.agents/doctrine/00-authority.md`](.agents/doctrine/00-authority.md) for instruction
precedence.

## Project

Festacol is a Next.js 16 / React 19 examination platform backed by Supabase Postgres and Prisma
(schema and migrations only — runtime reads go through Supabase JS, never Prisma Client).

Full project guidance — layout, commands, database order, env quirks, verification — lives in
[`AGENTS.md`](AGENTS.md). Read it before acting. For prototype-revamp work, the mandatory entry
document is `docs/superpowers/IMPLEMENTATION-MANIFEST.md` (reading order, precedence, PR
relationship).
