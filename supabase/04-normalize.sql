-- 04-normalize.sql — TOTAL shape fix: jsonb blobs → typed columns/rows.
-- Run AFTER 01 in Supabase SQL editor. Idempotent where cheap; back up first
-- (Supabase → Database → Backups) because old columns are DROPPED at the end.
-- Live data (1 attempt, 720 questions) is migrated inline before each drop.

-- ============================================================ 0. arrays
alter table public.subjects
  alter column streams type text[]
  using (coalesce(array(select jsonb_array_elements_text(streams)), '{}'));
alter table public.subjects alter column streams set default '{}';

alter table public.users
  alter column subjects type text[]
  using (coalesce(array(select jsonb_array_elements_text(subjects)), '{}'));
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

update public.exam_sessions set
  warn_after = coalesce((integrity_policy->>'warnAfter')::int, 2),
  focus_monitoring = coalesce((integrity_policy->>'focusMonitoring')::boolean, true),
  fullscreen_prompt = coalesce((integrity_policy->>'fullscreenPrompt')::boolean, true),
  clipboard_guard = coalesce((integrity_policy->>'clipboardGuard')::boolean, true),
  question_order = coalesce((randomization->>'questionOrder')::boolean, true),
  option_order = coalesce((randomization->>'optionOrder')::boolean, true),
  minimize_collisions = coalesce((randomization->>'minimizePaperCollisions')::boolean, true),
  subjects_new = coalesce(array(select jsonb_array_elements_text(subjects)), '{}'),
  placement_tracks_new = coalesce(array(select jsonb_array_elements_text(placement_tracks)), '{}'),
  cohosts_new = coalesce(array(select jsonb_array_elements_text(cohosts)), '{}');

alter table public.exam_sessions
  drop column if exists integrity_policy,
  drop column if exists randomization,
  drop column if exists subjects,
  drop column if exists placement_tracks,
  drop column if exists cohosts;
alter table public.exam_sessions rename column subjects_new to subjects;
alter table public.exam_sessions rename column placement_tracks_new to placement_tracks;
alter table public.exam_sessions rename column cohosts_new to cohosts;

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

update public.questions set
  subject_name = coalesce(data->>'subject', ''),
  label = coalesce(data->>'label', ''),
  qtype = coalesce(data->>'type', 'single'),
  prompt = coalesce(data->>'prompt', ''),
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
  instruction = coalesce(data->>'instruction', ''),
  levels = coalesce(array(select jsonb_array_elements_text(data->'levels')), '{}'),
  exam_modes = coalesce(array(select jsonb_array_elements_text(data->'examModes')), '{}'),
  difficulty = coalesce(data->>'difficulty', 'medium'),
  domain = coalesce(data->>'domain', ''),
  explanation = coalesce(data->>'explanation', '');

create table if not exists public.question_blanks (
  question_id bigint not null references public.questions(id) on delete cascade,
  position integer not null,
  blank_key text not null default '',
  placeholder text not null default '',
  accepted text[] not null default '{}',
  primary key (question_id, position)
);

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

update public.exam_attempts set
  assigned_track = placement->>'assignedTrack',
  placement_confidence = (placement->>'confidence')::int
  where placement is not null;

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

insert into public.exam_integrity_events (session_id, candidate_hash, attempt_hash, type, detail, at)
select a.session_id, a.candidate_hash, a.attempt_hash,
  e->>'type', coalesce(e->>'detail', ''), coalesce((e->>'at')::bigint, 0)
from public.exam_attempts a, jsonb_array_elements(a.integrity_events) as e
union all
select s.session_id, s.candidate_hash, nullif(s.state->>'attemptHash', ''),
  e->>'type', coalesce(e->>'detail', ''), coalesce((e->>'at')::bigint, 0)
from public.exam_states s, jsonb_array_elements(s.state->'integrityEvents') as e;

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

alter table public.exam_states drop column if exists state;

-- ============================================================ 5. markers
alter table public.exam_background_markers
  add column if not exists hidden_at bigint,
  add column if not exists started_at bigint;
update public.exam_background_markers set
  hidden_at = (marker->>'hiddenAt')::bigint,
  started_at = (marker->>'startedAt')::bigint
  where marker is not null;
alter table public.exam_background_markers drop column if exists marker;
