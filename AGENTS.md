<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# AGENTS.md

This file provides guidance to engineering agents when working with code in this repository.

## Agent system

`.agents/**` is the single source of truth for how agents work here. This file is a thin entry
point — when it and doctrine disagree, doctrine wins and this file gets fixed.

- [`.agents/README.md`](.agents/README.md) — the map.
- [`.agents/protocol.md`](.agents/protocol.md) — shared operating contract every role reads first.
- [`.agents/doctrine/**`](.agents/doctrine/) — stable rules, one owner per concern.
- [`.agents/roles/**`](.agents/roles/) — five roles and their owned surfaces.
- [`.agents/workflows/**`](.agents/workflows/) — role sequencing for feature / bugfix / ui-change.
- [`.agents/commands/**`](.agents/commands/) — operational entries for implement / review / bug-fix / feature-review.
- The global `dogfood` skill (`/dogfood`) is the repo-agnostic completion gate for code agents; Festacol runtime facts it needs (commands, routes, privileged endpoints) live in this file.
- `.opencode/agents/festacol-*.md`, `.claude/agents/festacol-*.md`, `.codex/agents/festacol-*.toml` — thin spawnable stubs pointing back at the canonical roles.

Start with [`.agents/doctrine/00-authority.md`](.agents/doctrine/00-authority.md) for instruction
precedence.

## Project

Festacol is a Next.js 16 / React 19 examination platform backed by Supabase Postgres and Prisma
(schema and migrations only — runtime reads go through Supabase JS, never Prisma Client).

**Auth boundary.** `src/proxy.ts` refreshes the Supabase session and enforces role separation:
`/dashboard/*` requires an active `student` (except the public `/dashboard/exam` entry);
`/admin/*` (except `/admin/login`) requires `teacher`/`administrator`; cross-role sessions go
to `/denied`. Preserve `?next=` redirect behavior.

**Prototype-revamp work.** `docs/superpowers/IMPLEMENTATION-MANIFEST.md` is the mandatory entry
document: read the manifest, the task's primary plan, and every governing contract before
editing. Current `master` controls physical paths; the manifest controls reading order and the
PR relationship.

## Layout

- `src/app/actions/**` — `"use server"` mutations and server reads (backend-owned).
- `src/app/api/**` — Route Handlers: `admin/` (bootstrap, staff), `exam/`, `exams/`,
  `realtime/` (Supabase webhook), `student/`.
- `src/lib/supabase/**` — browser/server/admin clients, SSR session, queries. Service-role
  client is server-only.
- `src/lib/auth/**` — server-side role helpers.
- `prisma/` — canonical schema, ordered migrations, `seed.ts` (raw `pg`), relation asserts.
- `supabase/` — `auth-rpc.sql` then `rls.sql`, applied after Prisma migrations.
- `public/seed/` — canonical fixtures (`subjects.json`, `classes.json`, `questions.json`,
  `questions/`).
- `prototype/` — isolated static-HTML reference package. Visual reference only; never copy
  prototype HTML/CSS/JS into React and never import it from `src/`.

## Commands

`pnpm@10.33.2`, lockfile `pnpm-lock.yaml` — never create npm/yarn/bun lockfiles. Biome is the
only lint/format tool (`pnpm lint` = `biome check`); do not reintroduce ESLint.

```bash
pnpm install
pnpm dev
pnpm seed:check
node scripts/validate-runtime-schema-contract.mjs
pnpm exec prisma validate
pnpm db:generate
pnpm exec tsc --noEmit
pnpm build
pnpm lint
```

Database targets (see [persistence](.agents/doctrine/persistence.md)):

```bash
pnpm exec prisma migrate deploy
pnpm db:seed
```

Then apply `supabase/auth-rpc.sql` followed by `supabase/rls.sql`. The CI workflow
(`nextjs-quality.yml`) exercises this complete sequence against PostgreSQL before typecheck
and build.

Add shadcn components non-interactively: `pnpm dlx shadcn@latest add <component> --yes`. If
shadcn wants to overwrite an existing file, stop and inspect the local file first.

## Architecture notes

- Single Next.js app: Route (RSC) → Server Action / Route Handler → Supabase → Postgres +
  RLS. Generated Prisma client (`src/generated/prisma`) is gitignored — regenerate, don't
  commit, never import at runtime.
- Migration history is exactly `20260915190000_initial` plus its two reconciliation
  migrations. Do not add a baseline, `supabase/schema.sql`, or numbered `supabase/NN-*.sql` —
  CI asserts their absence.
- `DATABASE_URL` must be the Supabase session pooler `:5432` (direct `db.[REF]` host is
  IPv6-only, P1001 on IPv4 networks). Required secrets: Supabase URL/anon/service-role,
  `SUPABASE_WEBHOOK_SECRET`, `SETUP_SECRET` (gates `POST /api/admin/bootstrap`; rotate after
  first-admin provisioning). Never commit `.env`.
- Fixtures reference canonical subject codes; never duplicate subject/class definitions into
  question rows. The runtime schema contract bans retired tokens (`programme*`, task-number
  filenames, legacy hash columns, `encodeSession`/`decodeSession`, …) — see
  [data contracts](.agents/doctrine/data-contracts.md).
- `components.json` style is `base-nova` (Tailwind v4, lucide). Path alias `@/*` → `./src/*`.

## Verification before handoff

Run the gate sequence above in order, plus the data asserts (`seed-relations.sql`, RPC/RLS
applies) when data changes. For UI work also verify both themes, required viewports,
keyboard/focus behavior, and clean console/network. Full gate definitions live in
[validation and reporting](.agents/doctrine/validation-and-reporting.md).
