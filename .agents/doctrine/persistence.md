# Doctrine: Supabase Postgres and Prisma migrations

Owner of: database implementation, Prisma lifecycle, seed data, query quality, RLS/RPC
integration, and persistence verification.
Cited by: backend engineer, planner, reviewer.

## Standard

Supabase Postgres is the application database. The app reads and writes it **only through the
Supabase JS clients** (`src/lib/supabase/*`). Prisma is the schema and migration system — it is
not a runtime data layer.

Do not introduce a second ORM, scattered `pg` request connections, direct frontend database
access, or Prisma Client imports in `src/` runtime code. (`prisma/seed.ts` legitimately uses raw
`pg` for seeding; that is the single exception and it never runs in request paths.)

## Prisma client

The generated client (`src/generated/prisma`) exists for codegen/validation workflows and is
gitignored — regenerate with `pnpm db:generate`, never commit it, never import it from runtime
code.

Keep generated Prisma types out of the wire. `src/types/db.ts` is the hand-maintained row-type
surface the app actually uses; update it with the migration that changes the shape.

## Schema ownership

`prisma/schema.prisma` is the source of truth for application tables, relations, uniqueness,
indexes, and enums. Enforce invariants in both Zod validation and database constraints. Service
checks alone are insufficient for uniqueness, foreign keys, and concurrency-sensitive rules such
as `(session_id, student_id, attempt_number)`.

## Migrations

The checked-in history starts at `20260915190000_initial` plus the schema-reconciliation
migrations after it — currently exactly three. CI asserts this set and the absence of
`supabase/schema.sql` and numbered `supabase/NN-*.sql` files.

Required sequence for every schema change:

1. update `prisma/schema.prisma`;
2. `pnpm exec prisma validate` and `pnpm db:generate`;
3. generate a named migration (`prisma migrate dev`);
4. inspect the SQL;
5. apply to development or CI Postgres (`prisma migrate deploy`);
6. reseed and run `prisma/tests/seed-relations.sql`;
7. commit schema and migration together.

Never edit a migration already applied to a shared environment. Create a corrective migration.
Never use `db push` as the production migration process. Never recreate removed legacy Supabase
schema files or add a second baseline.

## Supabase platform integration

Prisma owns the application schema; Supabase owns `auth.users`, RLS, and security-definer RPCs.
After migrations, apply in order:

1. `supabase/auth-rpc.sql` — `my_exam_access`, `allocate_my_exam_attempt`, `grant_exam_retake`;
2. `supabase/rls.sql` — row-level-security policies and grants (including
   `exam_attempt_responses`).

CI asserts the RPCs exist and the policies are present. A data change is not complete until both
files still apply cleanly against the migrated database.

## Connection discipline

- Local/CI `DATABASE_URL` points at the migration target. Against Supabase, use the
  **session-mode pooler `:5432`** — the direct `db.[REF]` host is IPv6-only and fails with
  P1001 on IPv4-only networks.
- The app runtime path uses the transaction pooler (`:6543?pgbouncer=true`) where a driver
  adapter is involved.
- Keep transactions short. Never perform slow network work inside a database transaction.
- Operations vulnerable to duplicate delivery (attempt allocation, webhook ingestion) must rely
  on database-backed idempotency: unique constraints, stored operation state, deterministic
  repeated-request handling.

## Query design

- Select only fields required by the operation (`src/lib/supabase/queries.ts` helpers).
- Prevent N+1 access with deliberate batched reads.
- Use database aggregation for counts and totals.
- Add indexes for measured or evident lookup, join, ordering, and uniqueness patterns.
- Keep ordering deterministic; do not load unbounded collections into memory.
- Never concatenate user-controlled SQL. Prefer the Supabase query builder; parameterized raw
  SQL only where the builder cannot express the operation, kept in the owning server module and
  covered by an assert.

## Seed and test data

- Canonical fixtures live under `public/seed/` (`subjects.json`, `classes.json`,
  `questions.json`, `questions/`). `pnpm seed:check` validates the fixture contract before
  `pnpm db:seed` touches the database.
- Seed scripts are deterministic and idempotent. Production request paths must not import or
  execute seed code.
- Persistence behavior is verified against real Postgres (`migrate deploy` → `db:seed` →
  `seed-relations.sql` → RPC/RLS asserts), not only against mocks.
