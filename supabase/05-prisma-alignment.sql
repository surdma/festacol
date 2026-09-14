-- 05-prisma-alignment.sql — post-normalization integrity gate.
-- Run after 04-normalize.sql on an existing prototype database.
-- This script is intentionally non-destructive: it adds the missing relational
-- constraint and fails loudly if legacy JSON/JSONB application columns remain.

begin;

do $$
begin
  alter table public.exam_responses
    add constraint exam_responses_state_fkey
    foreign key (session_id, candidate_hash)
    references public.exam_states(session_id, candidate_hash)
    on delete cascade;
exception
  when duplicate_object then null;
end $$;

create index if not exists exam_integrity_events_attempt_idx
  on public.exam_integrity_events(attempt_hash)
  where attempt_hash is not null;

-- The normalized application schema must not keep opaque domain blobs. Arrays
-- of scalar values (text[]/bigint[]) are allowed; structured records live in
-- their own tables.
do $$
declare
  leftovers text;
begin
  select string_agg(format('%I.%I', table_name, column_name), ', ' order by table_name, column_name)
    into leftovers
  from information_schema.columns
  where table_schema = 'public'
    and data_type in ('json', 'jsonb')
    and table_name in (
      'classes', 'subjects', 'users', 'student_profiles', 'exam_sessions',
      'questions', 'question_blanks', 'exam_attempts', 'exam_attempt_answers',
      'exam_attempt_subject_stats', 'exam_integrity_events', 'exam_states',
      'exam_responses', 'exam_reset_markers', 'exam_background_markers',
      'exam_proctor_policies', 'whatsapp_groups'
    );

  if leftovers is not null then
    raise exception 'Legacy JSON/JSONB columns remain after normalization: %', leftovers;
  end if;
end $$;

-- attempt_hash is the public/audit identity used by every detail table. Fail
-- rather than silently letting Prisma drift to the unrelated UUID `id` column.
do $$
declare
  primary_columns text[];
begin
  select array_agg(a.attname::text order by key_columns.ordinality)
    into primary_columns
  from pg_constraint c
  cross join lateral unnest(c.conkey) with ordinality as key_columns(attnum, ordinality)
  join pg_attribute a on a.attrelid = c.conrelid and a.attnum = key_columns.attnum
  where c.conrelid = 'public.exam_attempts'::regclass
    and c.contype = 'p';

  if primary_columns is distinct from array['attempt_hash']::text[] then
    raise exception 'exam_attempts primary key must be attempt_hash, found %', primary_columns;
  end if;
end $$;

commit;
