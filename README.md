# Festacol

Festacol is a Next.js examination platform backed by Supabase Postgres and Prisma.

## Local development

```bash
pnpm install
pnpm dev
```

Copy `.env.example` to `.env` and provide the required Supabase and database credentials. Do not commit `.env`.

## Database source of truth

The production database is normalized. The canonical schema and migration history live in:

- `prisma/schema.prisma` — application data model and relations.
- `prisma/migrations/` — ordered Prisma migration history used by `prisma migrate deploy`.
- `prisma/seed.ts` — canonical academic, class, subject and question fixture seeding.
- `supabase/auth-rpc.sql` — Supabase authentication/RPC integration applied after Prisma migrations.
- `supabase/rls.sql` — row-level-security policies and grants applied after Prisma migrations.

The current migration history starts with `20260915190000_initial` and includes the checked-in schema-reconciliation migrations that follow it. Do not recreate removed legacy Supabase schema files or add a second baseline.

After changing the Prisma schema, validate and generate the client before creating or applying migrations:

```bash
pnpm exec prisma validate
pnpm db:generate
```

For a deployment target, apply the checked-in history and canonical seed data with:

```bash
pnpm exec prisma migrate deploy
pnpm db:seed
```

Supabase auth/RPC and RLS integration must then be applied from the two SQL files above. The CI workflow exercises this complete sequence against PostgreSQL before typecheck and build.

## Academic data model

Festacol models curriculum and teaching relationships explicitly rather than duplicating programme/class/subject labels:

- classes reference an academic level, academic year and canonical track;
- `class_subject_offerings` relate classes to subjects;
- `teaching_assignments` relate staff to concrete class-subject offerings;
- `staff_subject_qualifications` describe subject qualifications independently of class assignments;
- `student_subject_enrollments` record per-student subject participation;
- exam class/offering targets define the audience for an examination;
- exam attempts use durable UUID identities and preserve relational context snapshots;
- candidate share links use persisted opaque `exam_session_links` tokens, with versioned QR payload metadata in `exam_qr_codes`.

## Seed fixtures

Canonical fixtures live under `public/seed/` and are validated before database seeding:

```bash
pnpm seed:check
```

The question fixture references canonical subject codes; subject and class definitions are maintained in their own fixture files rather than duplicated inside every question row.

## Quality checks

```bash
pnpm seed:check
pnpm exec prisma validate
pnpm db:generate
pnpm exec tsc --noEmit
pnpm build
pnpm lint
```
