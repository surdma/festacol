-- Festacol prototype — migration: normalize to typed columns (new shared.js shape).
-- Run ONCE in Supabase Dashboard → SQL Editor.
-- Symptom it fixes: "column questions.created_by does not exist" on
-- ?route=admin&page=questions, plus blank admin overview (missing
-- subjects / question_blanks / exam_attempt_* / exam_responses tables).
-- Safe to re-run (all statements are IF NOT EXISTS / additive).
-- Old origin/data/jsonb columns are KEPT so pre-migration clients keep working.

-- ------------------------------------------------ 0. subjects catalogue
create table if not exists public.subjects (
  code text primary key,
  name text not null,
  category text not null default 'elective',
  streams text[] not null default '{}',
  active boolean not null default true,
  updated_at bigint not null
);

-- ------------------------------------------------ 1. exam_sessions typed columns
alter table public.exam_sessions
  add column if not exists focus_monitoring boolean not null default true,
  add column if not exists fullscreen_prompt boolean not null default true,
  add column if not exists clipboard_guard boolean not null default true,
  add column if not exists warn_after integer not null default 2,
  add column if not exists question_order boolean not null default true,
  add column if not exists option_order boolean not null default true,
  add column if not exists minimize_collisions boolean not null default true,
  add column if not exists cohosts text[] not null default '{}';

-- Backfill from legacy jsonb blobs where present (keeps old columns).
do $$
begin
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
exception when others then null;
end $$;

-- ------------------------------------------------ 2. questions typed columns
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

-- Backfill typed columns from legacy data jsonb; origin='teacher' -> created_by.
do $$
begin
  if exists (select 1 from information_schema.columns where table_schema='public' and table_name='questions' and column_name='data') then
    update public.questions set
      subject_name = coalesce(data->>'subject', subject_name),
      label = coalesce(data->>'label', label),
      qtype = coalesce(data->>'type', qtype),
      prompt = coalesce(data->>'prompt', prompt),
      options = coalesce(array(select jsonb_array_elements_text(data->'options')), options),
      correct_answers = case
        when coalesce(data->>'type', 'single') in ('fill', 'fill-multi') then correct_answers
        when coalesce(data->>'type', 'single') = 'boolean' then array[(data->>'answer')]
        when jsonb_typeof(data->'answers') = 'array'
          then coalesce(array(select jsonb_array_elements_text(data->'answers')), '{}')
        when jsonb_typeof(data->'answer') = 'array'
          then coalesce(array(select jsonb_array_elements_text(data->'answer')), '{}')
        when data ? 'answer' then array[data->>'answer']
        else correct_answers end,
      instruction = coalesce(data->>'instruction', instruction),
      levels = coalesce(array(select jsonb_array_elements_text(data->'levels')), levels),
      exam_modes = coalesce(array(select jsonb_array_elements_text(data->'examModes')), exam_modes),
      difficulty = coalesce(data->>'difficulty', difficulty),
      domain = coalesce(data->>'domain', domain),
      explanation = coalesce(data->>'explanation', explanation)
    where data is not null;
  end if;
  if exists (select 1 from information_schema.columns where table_schema='public' and table_name='questions' and column_name='origin') then
    update public.questions set created_by = 'teacher'
    where origin = 'teacher' and created_by is null;
  end if;
exception when others then null;
end $$;

-- Fill blanks child table (typed fill questions).
create table if not exists public.question_blanks (
  question_id bigint not null references public.questions(id) on delete cascade,
  position integer not null,
  blank_key text not null default '',
  placeholder text not null default '',
  accepted text[] not null default '{}',
  primary key (question_id, position)
);

-- Migrate legacy fillTemplate blanks where data column still exists.
do $$
begin
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
exception when others then null;
end $$;

-- ------------------------------------------------ 3. attempts typed columns + children
alter table public.exam_attempts
  add column if not exists assigned_track text,
  add column if not exists placement_confidence integer;

do $$
begin
  if exists (select 1 from information_schema.columns where table_schema='public' and table_name='exam_attempts' and column_name='placement') then
    update public.exam_attempts set
      assigned_track = coalesce(assigned_track, placement->>'assignedTrack'),
      placement_confidence = coalesce(placement_confidence, (placement->>'confidence')::int)
    where placement is not null;
  end if;
exception when others then null;
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
create index if not exists exam_attempt_answers_attempt_idx on public.exam_attempt_answers (attempt_hash);

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

create table if not exists public.exam_integrity_events (
  id bigint generated always as identity primary key,
  session_id text not null default '',
  candidate_hash text not null default '',
  attempt_hash text,
  type text not null default '',
  detail text not null default '',
  at bigint not null default 0
);
create index if not exists exam_integrity_events_session_idx on public.exam_integrity_events (session_id, candidate_hash);

-- Migrate legacy jsonb attempt details where those columns exist.
do $$
begin
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
      jsonb_array_elements(a.details) as d
    on conflict do nothing;
  end if;
exception when others then null;
end $$;

do $$
begin
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
exception when others then null;
end $$;

do $$
begin
  if exists (select 1 from information_schema.columns where table_schema='public' and table_name='exam_attempts' and column_name='integrity_events') then
    insert into public.exam_integrity_events (session_id, candidate_hash, attempt_hash, type, detail, at)
    select a.session_id, a.candidate_hash, a.attempt_hash,
      e->>'type', coalesce(e->>'detail', ''), coalesce((e->>'at')::bigint, 0)
    from public.exam_attempts a, jsonb_array_elements(a.integrity_events) as e
    on conflict do nothing;
  end if;
exception when others then null;
end $$;

-- ------------------------------------------------ 4. exam_states typed columns + responses
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

do $$
begin
  if exists (select 1 from information_schema.columns where table_schema='public' and table_name='exam_states' and column_name='state') then
    update public.exam_states set
      started_at = coalesce(started_at, (state->>'startedAt')::bigint),
      submitted_at = coalesce(submitted_at, (state->>'submittedAt')::bigint),
      current_index = coalesce(current_index, (state->>'currentIndex')::int, 0),
      remaining_seconds = coalesce(remaining_seconds, (state->>'remainingSeconds')::double precision, 0),
      elapsed_active_seconds = coalesce(elapsed_active_seconds, (state->>'elapsedActiveSeconds')::double precision, 0),
      last_active_at = coalesce(last_active_at, (state->>'lastActiveAt')::bigint),
      attempt_hash = coalesce(nullif(attempt_hash, ''), state->>'attemptHash', ''),
      paper_fingerprint = coalesce(nullif(paper_fingerprint, ''), state->>'paperFingerprint', '')
    where state is not null;
  end if;
exception when others then null;
end $$;

-- ------------------------------------------------ 5. background markers typed columns
alter table public.exam_background_markers
  add column if not exists hidden_at bigint,
  add column if not exists started_at bigint;

do $$
begin
  if exists (select 1 from information_schema.columns where table_schema='public' and table_name='exam_background_markers' and column_name='marker') then
    update public.exam_background_markers set
      hidden_at = coalesce(hidden_at, (marker->>'hiddenAt')::bigint),
      started_at = coalesce(started_at, (marker->>'startedAt')::bigint)
    where marker is not null;
  end if;
exception when others then null;
end $$;

-- ------------------------------------------------ 6. users extra columns used by admin saves
alter table public.users
  add column if not exists email text not null default '',
  add column if not exists subjects text[] not null default '{}',
  add column if not exists qualifier_access boolean not null default false;
alter table public.classes
  add column if not exists arm text not null default '';

-- ------------------------------------------------ 7. RLS + policies for new tables
alter table public.subjects enable row level security;
alter table public.question_blanks enable row level security;
alter table public.exam_attempt_answers enable row level security;
alter table public.exam_attempt_subject_stats enable row level security;
alter table public.exam_integrity_events enable row level security;
alter table public.exam_responses enable row level security;

do $$
begin
  if not exists (select 1 from pg_policies where policyname = 'prototype anon all subjects') then
    create policy "prototype anon all subjects" on public.subjects for all to anon using (true) with check (true);
  end if;
  if not exists (select 1 from pg_policies where policyname = 'prototype anon all question_blanks') then
    create policy "prototype anon all question_blanks" on public.question_blanks for all to anon using (true) with check (true);
  end if;
  if not exists (select 1 from pg_policies where policyname = 'prototype anon all exam_attempt_answers') then
    create policy "prototype anon all exam_attempt_answers" on public.exam_attempt_answers for all to anon using (true) with check (true);
  end if;
  if not exists (select 1 from pg_policies where policyname = 'prototype anon all exam_attempt_subject_stats') then
    create policy "prototype anon all exam_attempt_subject_stats" on public.exam_attempt_subject_stats for all to anon using (true) with check (true);
  end if;
  if not exists (select 1 from pg_policies where policyname = 'prototype anon all exam_integrity_events') then
    create policy "prototype anon all exam_integrity_events" on public.exam_integrity_events for all to anon using (true) with check (true);
  end if;
  if not exists (select 1 from pg_policies where policyname = 'prototype anon all exam_responses') then
    create policy "prototype anon all exam_responses" on public.exam_responses for all to anon using (true) with check (true);
  end if;
end $$;
