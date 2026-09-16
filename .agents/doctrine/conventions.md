# Doctrine: Conventions

Owner of: naming, files, imports, TypeScript style, package management, and change hygiene.
Cited by: implementing roles and reviewer.

## General file discipline

- One cohesive responsibility per file.
- Follow established repository naming unless this doctrine states otherwise.
- Files and directories use `kebab-case`.
- React components use `PascalCase`.
- Server Action modules live in `src/app/actions/` as `<domain>.ts` (`exams.ts`,
  `question-bank.ts`, `academic-records.ts`); each exports async server functions, not
  components.
- Do not create broad barrels that expose a feature's private internals.
- Public `index.ts` files export only stable capabilities used outside the feature.
- Remove dead exports and dependencies introduced or orphaned by the current change.

## Server naming

- Route handlers: `src/app/api/<area>/route.ts` (or nested `[...]` segments) with explicit
  `GET`/`POST` exports.
- Supabase helpers: `src/lib/supabase/<client|server|admin|middleware|queries>.ts` — do not
  proliferate parallel clients.
- Data libraries: `src/lib/<domain>.ts` (`exam-session.ts`, `exam-links.ts`, `questions.ts`,
  `subjects-catalog.ts`, `assessment.ts`, `validation.ts`).
- Migrations: `prisma/migrations/<timestamp>_<name>/migration.sql` in strict timestamp order;
  never edit an applied migration.

## Frontend naming

Use names that reveal product responsibility:

```text
<feature>-view.tsx        route/domain composition
<product-concept>.tsx     intentional product component
use-<interaction>.ts(x)   a real reusable hook, not extracted line reduction
```

Local shadcn files retain their installed names under `src/components/ui`.

Do not create feature or component CSS files. Do not add `*.module.css` naming conventions.

Avoid generic names such as `DataCard`, `InfoBox`, `CommonModal`, `GenericTable`,
`ReusableComponent`, `Helper`, or `Utils` for unrelated functions.

## Imports

- Respect the `@/*` → `./src/*` alias and the shadcn aliases in `components.json`.
- Client components must not import server-only modules (`supabase/admin.ts`, `pg`,
  `prisma/seed.ts`, webhook secrets, `SETUP_SECRET`).
- Runtime `src/` code must not import Prisma Client or the generated client.
- Seed and script code must not be imported by request paths.
- `prototype/` is never imported by `src/`.
- Avoid broad barrel imports that conceal server-only imports in client bundles.
- Import heavy client dependencies (charts, QR, exam runners) at their usage boundary.

## TypeScript

- Keep strict type checking enabled.
- Prefer explicit public return types on Server Actions, route handlers, exported hooks, and
  query helpers.
- Prefer `satisfies` when checking a value without losing inference.
- Use exhaustive switches for discriminated unions.
- Do not throw strings.
- Do not duplicate Zod-derived or DB row types as parallel interfaces.
- Do not make every property optional to avoid modeling states correctly.
- Do not introduce `any`, `@ts-ignore`, broad assertions, or non-null assertions to make a
  change compile.
- Narrow `unknown` at runtime.
- Treat indexed access, URL data, storage data, and API data as potentially absent until validated.
- Do not export internal component props or view-model types without a consumer.

## React props

- Name props by product meaning.
- Prefer required props when the component cannot render correctly without the value.
- Prefer composition over a growing set of boolean customization props.
- Use semantic variant unions for intentional variants.
- Do not accept arbitrary `className` on a product component merely to make every caller redesign
  it. Expose a stable variant or compose at the parent when customization is legitimate.
- Forward DOM props only on design-system primitives that intentionally model a DOM control.

## Package manager and formatting

The root `packageManager` field (`pnpm@10.33.2`), lockfile, workspace configuration, and
repository scripts are authoritative. Use them exactly.

- Never create npm/yarn/bun lockfiles. Run from the repo root, except `prototype/` tasks which
  run with `prototype/` as the working directory.
- Biome is the only lint/format tool (`pnpm lint` = `biome check`). Do not reintroduce ESLint.
- Add shadcn components non-interactively (`pnpm dlx shadcn@latest add <component> --yes`);
  if shadcn wants to overwrite an existing file, stop and inspect the local file first.

## Change hygiene

- Keep dependency additions deliberate and explained.
- Do not combine visual redesign, data migration, and feature behavior unless the user
  explicitly requests the combined change.
- Do not rename stable domain language opportunistically (see the banned-token contract).
- Correct directly related raw native component reimplementations, unsafe types, and styling
  violations in the touched component scope; do not turn the task into a repository-wide rewrite.
- Do not commit `.env`, secrets, logs, or database dumps.
- Do not report a command as successful unless it ran.
