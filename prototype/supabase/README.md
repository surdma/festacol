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

Tables: `exam_sessions`, `exam_attempts`, `student_states`,
`student_profiles`, `attempt_reset_markers`, `background_markers`,
`app_users`, `classes`, `custom_questions`, `question_overrides`,
`whatsapp_groups`, `proctor_policies`, `question_bank_meta`,
`question_bank_items`.

> If you ran the base `schema.sql` before the question bank existed, run
> `prototype/supabase/migration_question_bank.sql` in SQL Editor too.

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
2. The status card shows database count / sync state (or a missing-migration
   warning before `migration_question_bank.sql` is run).
3. Click **Sync questions.json to database** — validates all 720 seeds,
   upserts the catalogue + items, resets the local cache and reloads from
   the database. Student papers (`eligibleQuestions` / `paperForStudent`)
   are then generated from DB questions filtered by the exam config
   (class level, mode, subjects, pathway).
