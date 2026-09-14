# Festacol

Festacol is a Next.js examination platform backed by Supabase Postgres and Prisma.

## Local development

```bash
pnpm install
pnpm dev
```

## Database source of truth

The production database is normalized. New environments must start from:

1. `supabase/schema.sql` — typed baseline with no JSON/JSONB domain blobs.
2. `supabase/02-rls-policies.sql` — authenticated role policies.
3. `supabase/03-realtime-webhooks.sql` — realtime/webhook configuration.
4. Seed/import data as required by the environment.

`prisma/schema.prisma` mirrors that normalized shape for Prisma Client and future Prisma migrations. After changing the Prisma schema, run:

```bash
pnpm db:generate
pnpm exec prisma validate
```

### Existing prototype databases

Older installations created structured application state in JSONB columns. Do **not** recreate those columns in a new environment. Back up the database, then use the legacy upgrade path:

1. `supabase/01-schema-delta.sql`
2. `supabase/04-normalize.sql`
3. `supabase/05-prisma-alignment.sql`
4. `supabase/02-rls-policies.sql`
5. `supabase/03-realtime-webhooks.sql`

`04-normalize.sql` backfills the old JSONB payloads into typed scalar columns, PostgreSQL scalar arrays, and related detail tables before dropping the legacy blob columns. `05-prisma-alignment.sql` then verifies that no JSON/JSONB application columns remain, asserts the `exam_attempts.attempt_hash` primary-key contract, and adds the normalized response-state foreign key expected by Prisma.

The files under `prototype/supabase/` document the original prototype bootstrap/migration history. They are not the production baseline for a new Next.js deployment.

## Quality checks

```bash
pnpm lint
pnpm exec tsc --noEmit
pnpm exec prisma validate
pnpm db:generate
pnpm build
```
