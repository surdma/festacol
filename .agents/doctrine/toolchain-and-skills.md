# Doctrine: Toolchain and mandatory skills

Owner of: engineering skill use, repository commands, dependency-version awareness, and tool
honesty.
Cited by: every engineering role.

## Repository tools are authoritative

Inspect before acting: root `package.json`, the `packageManager` field and lockfile, workspace
configuration, `tsconfig.json`, `biome.json`, test scripts, framework versions,
`components.json` (style `base-nova`, RSC, Tailwind v4, lucide), and the `prototype/`
package when touching the prototype. Use repository scripts rather than remembered commands.

## Mandatory process skills

- Before any software-development work, load `using-superpowers` (no exemption for primary
  agents; subagents executing a specific assigned task are exempt).
- Use `find-skills` when a task needs a capability outside the mandatory sets below.
- Route PR actions through the `create-pr` skill.

## Server/data skills

For every implementation or review touching `src/app/api/**`, `src/app/actions/**`,
`src/lib/supabase/**`, `src/lib/auth/**`, `prisma/**`, `supabase/**`, or `public/seed/**`,
load and actively apply:

- `supabase` — SSR/browser/admin clients, Auth, RLS-aware access patterns;
- `supabase-postgres-best-practices` — Postgres performance and RLS correctness;
- the vendored Prisma skills as applicable (`prisma-cli`, `prisma-client-api`,
  `prisma-database-setup`, `prisma-postgres`, `prisma-postgres-setup`);
- `error-handling-patterns` for failure-path design.

Translations for Festacol: Prisma Client generation serves schema validation and migration
workflows, not runtime reads; `db push` never replaces `migrate deploy`; Better Auth or
class-validator patterns from generic NestJS guidance do not apply — auth is Supabase Auth and
validation is Zod at server boundaries.

## Frontend skills

For every Next.js or React implementation and frontend review, load and actively apply:

- `next-best-practices` — App Router conventions, RSC boundaries, async APIs, metadata, errors;
- `vercel-react-best-practices` — waterfalls, bundles, rendering quality;
- `vercel-composition-patterns` — variants, compound components, provider boundaries;
- `shadcn` — project inspection, component selection, composition, form structure, tokens.

For defects, risky refactors, and final frontend self-review, use `react-doctor`.
For product-facing design judgment, `product-designer`, `frontend-design`, and
`web-design-guidelines` apply — but the incoming spec or governing contract controls the
aesthetic; do not invent a replacement visual direction.

## Reviewer skills

The reviewer loads skills by changed scope: data skills for server/data changes, mandatory
frontend skills for UI changes, `react-doctor` for material component work, systematic
debugging when behavior is not understood. PR-creation skill only on user request.

## Version-aware use

Do not copy framework examples without checking installed versions — especially Next.js 16
(`proxy.ts`, async request APIs), React 19 composition and ref behavior, `@supabase/ssr`
cookie handling, Prisma 7 migration commands, Tailwind v4 tokens, shadcn `base-nova`
component APIs, and Biome 2.x command behavior. Use official primary documentation when
current behavior is uncertain.

## Tool honesty

Do not claim browser, database, migration, seed, email, accessibility, visual, webhook, or
subagent verification when only documentation or compilation was performed. Do not report Biome,
typecheck, tests, build, React diagnostics, browser checks, or live route behavior as passing
unless the exact command or behavior was actually executed.
