-- 04-normalize.sql — TOTAL shape fix: jsonb blobs → typed columns/rows.
-- Run AFTER 01 in Supabase SQL editor. Idempotent where cheap; back up first
-- (Supabase → Database → Backups) because old columns are DROPPED at the end.
-- Live data (1 attempt, 720 questions) is migrated inline before each drop.

-- ============================================================ 0. arrays
-- NOTE: Postgres forbids subqueries in ALTER ... USING (error 0A000
-- "cannot use subquery in transform expression"), so NEVER do:
--   ALTER TABLE t ALTER COLUMN c TYPE text[]
--     USING (coalesce(array(select jsonb_array_elements_text(c)), '{}'));
-- jsonb -> text[] is done add/update/drop/rename (UPDATE allows the subquery).
do $$ begin
  if exists (select 1 from information_schema.columns where table_schema='public' and table_name='subjects' and column_name='streams' and data_type = 'jsonb') then
    alter table public.subjects add column if not exists streams_new text[] not null default '{}';
    update public.subjects set streams_new = case
      when jsonb_typeof(streams) = 'array'
        then coalesce((select array_agg(x) from jsonb_array_elements_text(streams) as x), '{}')
      else '{}' end;
    alter table public.subjects drop column streams;
    alter table public.subjects rename column streams_new to streams;
  end if;
end $$;
alter table public.subjects alter column streams set default '{}';

do $$ begin
  -- 02-policies reference users.subjects (q_teacher_* + qbl_teacher_write via
  -- the teacher helper). Drop them first; re-run 02-rls-policies.sql after 04.
  drop policy if exists q_teacher_insert on public.questions;
  drop policy if exists q_teacher_write on public.questions;
  drop policy if exists q_teacher_delete on public.questions;
  drop policy if exists qbl_teacher_write on public.question_blanks;
  drop function if exists private.teacher_may_access_session(text[], text, text[]) cascade;
  if exists (select 1 from information_schema.columns where table_schema='public' and table_name='users' and column_name='subjects' and data_type = 'jsonb') then
    alter table public.users add column if not exists subjects_new text[] not null default '{}';
    update public.users set subjects_new = case
      when jsonb_typeof(subjects) = 'array'
        then coalesce((select array_agg(x) from jsonb_array_elements_text(subjects) as x), '{}')
      else '{}' end;
    alter table public.users drop column subjects;
    alter table public.users rename column subjects_new to subjects;
  end if;
end $$;
alter table public.users alter column subjects set default '{}';

-- ============================================================ 1. sessions
alter table public.exam_sessions
  add column if not exists focus_monitoring boolean not null default true,
  add column if not exists fullscreen_prompt boolean not null default true,
  add column if not exists clipboard_guard boolean not null default true,
  add column if not exists warn_after integer not null default 2,
  add column if not exists question_order boolean not null default true,
  add column if not exists option_order boolean not null default true,
  add column if not exists minimize_collisions boolean not null default true,
  add column if not exists subjects_new text[] not null default '{}',
  add column if not exists placement_tracks_new text[] not null default '{}',
  add column if not exists cohosts_new text[] not null default '{}';

do $$ begin
  if exists (select 1 from information_schema.columns where table_schema='public' and table_name='exam_sessions' and column_name='integrity_policy') then
    update public.exam_sessions set
      warn_after = coalesce((integrity_policy->>'warnAfter')::int, warn_after),
      focus_monitoring = coalesce((integrity_policy->>'focusMonitoring')::boolean, focus_monitoring),
      fullscreen_prompt = coalesce((integrity_policy->>'fullscreenPrompt')::boolean, fullscreen_prompt),
      clipboard_guard = coalesce((integrity_policy->>'clipboardGuard')::boolean, clipboard_guard);
  end if;
  if exists (select 1 from information_schema.columns where table_schema='public' and table_name='exam_sessions' and column_name='randomization') then
    update public.exam_sessions set
      question_order = coalesce((randomization->>'questionOrder')::boolean, question_order),
      option_order = coalesce((randomization->>'optionOrder')::boolean, option_order),
      minimize_collisions = coalesce((randomization->>'minimizePaperCollisions')::boolean, minimize_collisions);
  end if;
  if exists (select 1 from information_schema.columns where table_schema='public' and table_name='exam_sessions' and column_name='subjects' and data_type = 'jsonb') then
    update public.exam_sessions set subjects_new = case
      when jsonb_typeof(subjects) = 'array'
        then coalesce((select array_agg(x) from jsonb_array_elements_text(subjects) as x), '{}')
      else '{}' end;
  end if;
  if exists (select 1 from information_schema.columns where table_schema='public' and table_name='exam_sessions' and column_name='placement_tracks' and data_type = 'jsonb') then
    update public.exam_sessions set placement_tracks_new = case
      when jsonb_typeof(placement_tracks) = 'array'
        then coalesce((select array_agg(x) from jsonb_array_elements_text(placement_tracks) as x), '{}')
      else '{}' end;
  end if;
  if exists (select 1 from information_schema.columns where table_schema='public' and table_name='exam_sessions' and column_name='cohosts' and data_type = 'jsonb') then
    update public.exam_sessions set cohosts_new = case
      when jsonb_typeof(cohosts) = 'array'
        then coalesce((select array_agg(x) from jsonb_array_elements_text(cohosts) as x), '{}')
      else '{}' end;
  end if;
end $$;

alter table public.exam_sessions
  drop column if exists integrity_policy,
  drop column if exists randomization;
do $$ begin
  if exists (select 1 from information_schema.columns where table_schema='public' and table_name='exam_sessions' and column_name='subjects' and data_type = 'jsonb') then
    alter table public.exam_sessions drop column subjects;
    alter table public.exam_sessions rename column subjects_new to subjects;
  else
    alter table public.exam_sessions drop column if exists subjects_new;
  end if;
  if exists (select 1 from information_schema.columns where table_schema='public' and table_name='exam_sessions' and column_name='placement_tracks' and data_type = 'jsonb') then
    alter table public.exam_sessions drop column placement_tracks;
    alter table public.exam_sessions rename column placement_tracks_new to placement_tracks;
  else
    alter table public.exam_sessions drop column if exists placement_tracks_new;
  end if;
  if exists (select 1 from information_schema.columns where table_schema='public' and table_name='exam_sessions' and column_name='cohosts' and data_type = 'jsonb') then
    alter table public.exam_sessions drop column cohosts;
    alter table public.exam_sessions rename column cohosts_new to cohosts;
  else
    alter table public.exam_sessions drop column if exists cohosts_new;
  end if;
end $$;

-- ============================================================ 2. questions
alter table public.questions
  add column if not exists subject_name text not null default '',
  add column if not exists label text not null default '',
  add column if not exists qtype text not null default 'single',
  add column if not exists prompt text not null default '',
  add column if not exists options text[] not null default '{}',
  add column if not exists correct_answers text[] not null default '{}',
  add column if not exists fill_template text,
  add column if not exists instruction text not null default '',
  add column if not exists levels text[] not null default '{}',
  add column if not exists exam_modes text[] not null default '{}',
  add column if not exists difficulty text not null default 'medium',
  add column if not exists domain text not null default '',
  add column if not exists explanation text not null default '',
  add column if not exists created_by text;

do $$ begin
if exists (select 1 from information_schema.columns where table_schema='public' and table_name='questions' and column_name='data') then
update public.questions set
  subject_name = coalesce(data->>'subject', subject_name),
  label = coalesce(data->>'label', label),
  qtype = coalesce(data->>'type', qtype),
  prompt = coalesce(data->>'prompt', prompt),
  options = coalesce(array(select jsonb_array_elements_text(data->'options')), '{}'),
  correct_answers = case
    when coalesce(data->>'type', 'single') in ('fill', 'fill-multi') then '{}'
    when coalesce(data->>'type', 'single') = 'boolean' then array[(data->>'answer')]
    when jsonb_typeof(data->'answers') = 'array'
      then coalesce(array(select jsonb_array_elements_text(data->'answers')), '{}')
    when jsonb_typeof(data->'answer') = 'array'
      then coalesce(array(select jsonb_array_elements_text(data->'answer')), '{}')
    when data ? 'answer' then array[data->>'answer']
    else '{}' end,
  fill_template = case
    when coalesce(data->>'type', 'single') in ('fill', 'fill-multi') then (
      select string_agg(
        case when (p ? 'blank')
          then '{{' || (idx - 1) || '}}'
          else coalesce(p->>'text', '') end, '' order by idx)
      from jsonb_array_elements(data->'fillTemplate') with ordinality as t(p, idx))
    end,
  instruction = coalesce(data->>'instruction', instruction),
  levels = coalesce(array(select jsonb_array_elements_text(data->'levels')), levels),
  exam_modes = coalesce(array(select jsonb_array_elements_text(data->'examModes')), exam_modes),
  difficulty = coalesce(data->>'difficulty', difficulty),
  domain = coalesce(data->>'domain', domain),
  explanation = coalesce(data->>'explanation', explanation);
end if;
end $$;

create table if not exists public.question_blanks (
  question_id bigint not null references public.questions(id) on delete cascade,
  position integer not null,
  blank_key text not null default '',
  placeholder text not null default '',
  accepted text[] not null default '{}',
  primary key (question_id, position)
);

do $$ begin
if exists (select 1 from information_schema.columns where table_schema='public' and table_name='questions' and column_name='data') then
insert into public.question_blanks (question_id, position, blank_key, placeholder, accepted)
select b.qid, b.rn - 1, b.bk, b.ph,
  case when jsonb_typeof((b.answers)->(b.rn - 1)) = 'array'
    then coalesce(array(select jsonb_array_elements_text((b.answers)->(b.rn - 1))), '{}')
    else array[coalesce((b.answers)->>(b.rn - 1), '')] end
from (
  select q2.id as qid, q2.data->'acceptedAnswers' as answers,
    t.p->>'blank' as bk, coalesce(t.p->>'placeholder', '') as ph,
    row_number() over (partition by q2.id order by t.idx) as rn
  from public.questions q2,
    jsonb_array_elements(q2.data->'fillTemplate') with ordinality as t(p, idx)
  where coalesce(q2.data->>'type', '') in ('fill', 'fill-multi')
    and t.p ? 'blank'
) b
on conflict do nothing;
end if;
end $$;

alter table public.questions drop column if exists data;
alter table public.questions drop column if exists origin;
do $$ begin
  alter table public.questions
    add constraint questions_subject_fk foreign key (subject_code)
    references public.subjects(code);
exception when duplicate_object then null; end $$;
do $$ begin
  alter table public.questions
    add constraint questions_creator_fk foreign key (created_by)
    references public.users(id) on delete set null;
exception when duplicate_object then null; end $$;

drop table if exists public.question_overrides;
drop table if exists public.question_bank;

-- ============================================================ 3. attempts
alter table public.exam_attempts
  add column if not exists assigned_track text,
  add column if not exists placement_confidence integer;

do $$ begin
if exists (select 1 from information_schema.columns where table_schema='public' and table_name='exam_attempts' and column_name='placement') then
update public.exam_attempts set
  assigned_track = placement->>'assignedTrack',
  placement_confidence = (placement->>'confidence')::int
  where placement is not null;
end if;
end $$;

create table if not exists public.exam_attempt_answers (
  id bigint generated always as identity primary key,
  attempt_hash text not null references public.exam_attempts(attempt_hash) on delete cascade,
  session_id text,
  candidate_hash text not null default '',
  question_id bigint references public.questions(id) on delete set null,
  subject_code text not null default '',
  subject_name text not null default '',
  correct boolean,
  response_text text,
  response_values text[] not null default '{}',
  correct_answer text not null default '',
  seconds double precision not null default 0
);
create index if not exists exam_attempt_answers_attempt_idx
  on public.exam_attempt_answers (attempt_hash);

do $$ begin
if exists (select 1 from information_schema.columns where table_schema='public' and table_name='exam_attempts' and column_name='details') then
insert into public.exam_attempt_answers
  (attempt_hash, session_id, candidate_hash, question_id, subject_code,
   subject_name, correct, response_text, response_values, correct_answer, seconds)
select a.attempt_hash, a.session_id, a.candidate_hash,
  (d->>'questionId')::bigint, coalesce(d->>'subjectCode', ''),
  coalesce(d->>'subject', ''),
  (d->>'correct')::boolean,
  case jsonb_typeof(d->'response')
    when 'string' then d #>> '{response}'
    when 'boolean' then (d->>'response')
    when 'object' then (
      select v from (select value as v from jsonb_each_text(d->'response') order by key limit 1) s)
    end,
  case jsonb_typeof(d->'response')
    when 'array' then coalesce(array(select jsonb_array_elements_text(d->'response')), '{}')
    when 'object' then coalesce(array(select value from jsonb_each_text(d->'response') order by key), '{}')
    else '{}' end,
  coalesce(d->>'correctAnswer', ''),
  coalesce((d->>'seconds')::double precision, 0)
from public.exam_attempts a,
  jsonb_array_elements(a.details) as d;
end if;
end $$;

create table if not exists public.exam_attempt_subject_stats (
  attempt_hash text not null references public.exam_attempts(attempt_hash) on delete cascade,
  subject_code text not null default '',
  subject_name text not null default '',
  total integer not null default 0,
  correct integer not null default 0,
  seconds double precision not null default 0,
  percent integer not null default 0,
  primary key (attempt_hash, subject_code)
);

do $$ begin
if exists (select 1 from information_schema.columns where table_schema='public' and table_name='exam_attempts' and column_name='subject_stats') then
insert into public.exam_attempt_subject_stats
  (attempt_hash, subject_code, subject_name, total, correct, seconds, percent)
select a.attempt_hash, coalesce(s->>'subjectCode', ''),
  coalesce(s->>'subject', ''),
  coalesce((s->>'total')::int, 0), coalesce((s->>'correct')::int, 0),
  coalesce((s->>'seconds')::double precision, 0),
  coalesce((s->>'percent')::int, 0)
from public.exam_attempts a,
  jsonb_array_elements(a.subject_stats) as s
on conflict do nothing;
end if;
end $$;

create table if not exists public.exam_integrity_events (
  id bigint generated always as identity primary key,
  session_id text not null default '',
  candidate_hash text not null default '',
  attempt_hash text,
  type text not null default '',
  detail text not null default '',
  at bigint not null default 0
);
create index if not exists exam_integrity_events_session_idx
  on public.exam_integrity_events (session_id, candidate_hash);

do $$ begin
if exists (select 1 from information_schema.columns where table_schema='public' and table_name='exam_attempts' and column_name='integrity_events') then
insert into public.exam_integrity_events (session_id, candidate_hash, attempt_hash, type, detail, at)
select a.session_id, a.candidate_hash, a.attempt_hash,
  e->>'type', coalesce(e->>'detail', ''), coalesce((e->>'at')::bigint, 0)
from public.exam_attempts a, jsonb_array_elements(a.integrity_events) as e;
end if;
if exists (select 1 from information_schema.columns where table_schema='public' and table_name='exam_states' and column_name='state') then
insert into public.exam_integrity_events (session_id, candidate_hash, attempt_hash, type, detail, at)
select s.session_id, s.candidate_hash, nullif(s.state->>'attemptHash', ''),
  e->>'type', coalesce(e->>'detail', ''), coalesce((e->>'at')::bigint, 0)
from public.exam_states s, jsonb_array_elements(s.state->'integrityEvents') as e;
end if;
end $$;

alter table public.exam_attempts
  drop column if exists details,
  drop column if exists subject_stats,
  drop column if exists integrity_events,
  drop column if exists question_ids,
  drop column if exists placement,
  drop column if exists subjects;

-- ============================================================ 4. states
create table if not exists public.exam_responses (
  session_id text not null,
  candidate_hash text not null,
  question_id bigint not null,
  response_text text,
  response_values text[] not null default '{}',
  seconds double precision not null default 0,
  flagged boolean not null default false,
  primary key (session_id, candidate_hash, question_id)
);

do $$ begin
if exists (select 1 from information_schema.columns where table_schema='public' and table_name='exam_states' and column_name='state') then
insert into public.exam_responses
  (session_id, candidate_hash, question_id, response_text, response_values, seconds, flagged)
select s.session_id, s.candidate_hash, r.key::bigint,
  case jsonb_typeof(r.value)
    when 'string' then r.value #>> '{}'
    when 'boolean' then (r.value)::text
    when 'object' then (
      select v from (
        select count(*) over () as n, value as v, row_number() over (order by key) as rn
        from jsonb_each_text(r.value)) s2 where s2.n = 1)
    end,
  case jsonb_typeof(r.value)
    when 'array' then coalesce(array(select jsonb_array_elements_text(r.value)), '{}')
    when 'object' then coalesce(array(select value from jsonb_each_text(r.value) order by key), '{}')
    else '{}' end,
  coalesce((s.state->'questionTimings'->>r.key)::double precision, 0),
  coalesce(s.state->'flagged', '[]'::jsonb) ? r.key
from public.exam_states s,
  jsonb_each(s.state->'responses') as r(key, value)
on conflict do nothing;
end if;
end $$;

alter table public.exam_states
  add column if not exists started_at bigint,
  add column if not exists submitted_at bigint,
  add column if not exists current_index integer not null default 0,
  add column if not exists remaining_seconds double precision not null default 0,
  add column if not exists elapsed_active_seconds double precision not null default 0,
  add column if not exists last_active_at bigint,
  add column if not exists attempt_hash text not null default '',
  add column if not exists paper_fingerprint text not null default '',
  add column if not exists question_ids bigint[] not null default '{}';

do $$ begin
if exists (select 1 from information_schema.columns where table_schema='public' and table_name='exam_states' and column_name='state') then
update public.exam_states set
  started_at = (state->>'startedAt')::bigint,
  submitted_at = (state->>'submittedAt')::bigint,
  current_index = coalesce((state->>'currentIndex')::int, 0),
  remaining_seconds = coalesce((state->>'remainingSeconds')::double precision, 0),
  elapsed_active_seconds = coalesce((state->>'elapsedActiveSeconds')::double precision, 0),
  last_active_at = (state->>'lastActiveAt')::bigint,
  attempt_hash = coalesce(state->>'attemptHash', ''),
  paper_fingerprint = coalesce(state->>'paperFingerprint', ''),
  question_ids = coalesce(
    array(select (x::bigint) from jsonb_array_elements_text(state->'questionIds') as x), '{}');
end if;
end $$;

alter table public.exam_states drop column if exists state;

-- ============================================================ 5. markers
alter table public.exam_background_markers
  add column if not exists hidden_at bigint,
  add column if not exists started_at bigint;
do $$ begin
if exists (select 1 from information_schema.columns where table_schema='public' and table_name='exam_background_markers' and column_name='marker') then
update public.exam_background_markers set
  hidden_at = (marker->>'hiddenAt')::bigint,
  started_at = (marker->>'startedAt')::bigint
  where marker is not null;
end if;
end $$;
alter table public.exam_background_markers drop column if exists marker;
