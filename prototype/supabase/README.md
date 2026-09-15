# Festacol prototype — Supabase setup

The `/prototype` static app no longer uses `localStorage` / `sessionStorage` /
in-memory maps as durable storage. All durable entities live in Supabase
Postgres. Ephemeral per-tab pointers (current auth hash, active candidate,
camera session flags) live only in JS memory.

## 1. Create the tables

In Supabase Dashboard → SQL Editor, run `prototype/supabase/schema.sql`.
Or via psql with your connection string:

```sh
psql "postgresql://postgres:[YOUR-PASSWORD]@db.ktjadzttsziosuhqzupz.supabase.co:5432/postgres" -f prototype/supabase/schema.sql
```

Tables: `classes`, `users`, `student_profiles`, `exam_sessions`,
`exam_attempts`, `exam_states`, `exam_reset_markers`,
`exam_background_markers`, `exam_proctor_policies`, `whatsapp_groups`,
`questions` (seed + teacher rows, told apart by `origin`),
`question_overrides`, `question_bank`.

Every cross-table reference is a foreign key: users and WhatsApp groups belong
to classes; attempts survive their session (link nulled, history kept) while
in-progress states, reset/background markers, and proctor policies are removed
with it; seed edits patch questions without deleting them.

> If your database still has the old names (`app_users`, `student_states`,
> `custom_questions`, …), run `prototype/supabase/migration_standardize.sql`
> once in SQL Editor — it renames tables with data kept, adds the foreign
> keys, merges the old split question tables into `questions`, and retires
> the outdated policies.
>
> If admin Question Bank fails with `column questions.created_by does not exist`
> (or overview/reports stay blank), your database predates the typed question
> schema that `prototype/js/shared.js` now expects. Run
> `prototype/supabase/migration_normalize.sql` once in SQL Editor — it adds
> `created_by` + typed question columns, `subjects`, `question_blanks`,
> `exam_attempt_answers` / `exam_attempt_subject_stats` / `exam_integrity_events`
> / `exam_responses`, typed `exam_states` / `exam_background_markers` columns
> and the matching RLS policies, migrating existing rows in place. The prototype
> also falls back to the old `origin`/`data` shape pre-migration so pages keep
> loading, but teacher-question writes need the migration.

To seed the initial school classes (SS1–SS3 + Qualifier pool), run
`prototype/supabase/seed_classes.sql` — safe to re-run, existing ids are
kept.

## 2. Configure the browser client

Browsers cannot use `postgres://` directly. The prototype uses
`@supabase/supabase-js` (PostgREST) with an anon key.

1. Supabase Dashboard → Project Settings → API → copy `URL` and `anon public` key.
2. Edit `prototype/js/supabase-config.js`:
   - `window.FESTACOL_SUPABASE_URL = 'https://ktjadzttsziosuhqzupz.supabase.co'`
   - `window.FESTACOL_SUPABASE_ANON_KEY = '<your anon key>'`
3. `prototype/index.html` already loads (in order):
   `supabase-js UMD → supabase-config.js → supabase-client.js → shared.js`.

No Next.js code was touched. Behaviour is unchanged; only the persistence
layer moved. When Supabase is unconfigured, the app uses an in-memory Map
fallback with identical semantics (used by `npm run check` / Playwright).

## 3. Sync the question bank (replaces questions.json at runtime)

The exam runtime loads questions from Supabase, never from
`public/seed/questions.json`. The JSON file is only the sync source:

1. Open the prototype Admin → Question Bank.
2. The status card shows database count / sync state.
3. Click **Load question bank** — validates all 720 seeds,
   upserts the catalogue + items, resets the local cache and reloads from
   the database. Student papers (`eligibleQuestions` / `paperForStudent`)
   are then generated from DB questions filtered by the exam config
   (class level, mode, subjects, pathway).
