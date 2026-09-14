-- Festacol production schema — normalized Supabase/Postgres baseline.
-- Fresh environments should start here, then apply 02-rls-policies.sql and
-- 03-realtime-webhooks.sql. Legacy prototype databases should run
-- 04-normalize.sql before switching to Prisma migrations.
--
-- This baseline intentionally contains no json/jsonb domain columns. Repeated
-- values use PostgreSQL scalar arrays only where the application consumes an
-- ordered scalar list; structured records are represented as related rows.

begin;

create table if not exists public.classes (
  id text primary key,
  class_level text not null check (class_level in ('SS1','SS2','SS3')),
  name text not null,
  stream text not null default 'General',
  grp text not null default 'General',
  arm text not null default '',
  capacity integer not null default 40 check (capacity between 1 and 500),
  room text not null default '',
  academic_session text not null default '2026/2027',
  status text not null default 'active' check (status in ('active','archived'))
);

create table if not exists public.subjects (
  code text primary key,
  name text not null,
  category text not null default 'elective',
  streams text[] not null default '{}',
  active boolean not null default true,
  updated_at bigint not null
);

create table if not exists public.users (
  id text primary key,
  full_name text not null,
  first_name text not null default '',
  last_name text not null default '',
  class_id text references public.classes(id) on delete set null,
  role text not null default 'student' check (role in ('student','teacher','administrator')),
  status text not null default 'active' check (status in ('active','inactive')),
  guardian text not null default '',
  academic_session text not null default '2026/2027',
  promotion_status text not null default 'on-track',
  joined_at bigint not null,
  auth_user_id text unique,
  email text not null default '',
  subjects text[] not null default '{}',
  qualifier_access boolean not null default false
);

create table if not exists public.student_profiles (
  student_hash text primary key,
  candidate_hash text not null default '',
  first_name text not null default '',
  last_name text not null default '',
  full_name text not null default '',
  phone text not null default '',
  guardian text not null default '',
  current_class_id text not null default '',
  academic_session text not null default '2026/2027',
  updated_at bigint not null
);

create table if not exists public.exam_sessions (
  id text primary key,
  title text not null,
  class_level text not null check (class_level in ('SS1','SS2','SS3')),
  class_group text not null default 'General',
  academic_session text not null default '2026/2027',
  term text not null default 'First term',
  mode text not null check (mode in ('qualifier','bece','waec','neco','jamb','mixed','single')),
  subjects text[] not null default '{}',
  placement_tracks text[] not null default '{}',
  duration_seconds integer not null check (duration_seconds between 30 and 10800),
  question_count integer not null check (question_count between 5 and 150),
  status text not null default 'open' check (status in ('open','draft','closed')),
  instructions text not null default '',
  starts_at bigint,
  ends_at bigint,
  attempt_limit integer not null default 1 check (attempt_limit >= 1),
  focus_monitoring boolean not null default true,
  fullscreen_prompt boolean not null default true,
  clipboard_guard boolean not null default true,
  warn_after integer not null default 2 check (warn_after between 1 and 10),
  question_order boolean not null default true,
  option_order boolean not null default true,
  minimize_collisions boolean not null default true,
  cohosts text[] not null default '{}',
  created_at bigint not null,
  updated_at bigint not null
);

create table if not exists public.questions (
  id bigint primary key,
  subject_code text not null references public.subjects(code),
  subject_name text not null default '',
  label text not null default '',
  qtype text not null check (qtype in ('single','multi','boolean','fill','fill-multi')),
  prompt text not null,
  options text[] not null default '{}',
  correct_answers text[] not null default '{}',
  fill_template text,
  instruction text not null default '',
  levels text[] not null default '{}',
  exam_modes text[] not null default '{}',
  difficulty text not null default 'medium' check (difficulty in ('easy','medium','hard')),
  domain text not null default '',
  explanation text not null default '',
  created_by text references public.users(id) on delete set null,
  updated_at bigint not null
);
create index if not exists questions_subject_idx on public.questions(subject_code);

create table if not exists public.question_blanks (
  question_id bigint not null references public.questions(id) on delete cascade,
  position integer not null check (position >= 0),
  blank_key text not null default '',
  placeholder text not null default '',
  accepted text[] not null default '{}',
  primary key (question_id, position)
);

-- attempt_hash is the durable identity used by all audit/detail tables. `id`
-- remains the generated application UUID but is not the relational key.
create table if not exists public.exam_attempts (
  id text not null,
  attempt_hash text primary key,
  candidate_hash text not null,
  student_hash text not null default '',
  paper_fingerprint text not null default '',
  session_id text references public.exam_sessions(id) on delete set null,
  session_title text not null default '',
  first_name text not null default '',
  last_name text not null default '',
  student_name text not null default '',
  class_level text not null default '',
  class_group text not null default '',
  academic_session text not null default '2026/2027',
  mode text not null default '',
  session_status text not null default '',
  session_ends_at bigint,
  started_at bigint,
  submitted_at bigint,
  remaining_seconds double precision,
  elapsed_active_seconds double precision not null default 0,
  answered integer not null default 0,
  question_count integer not null default 0,
  score double precision,
  correct_count double precision,
  completion double precision,
  pace_index double precision,
  reasoning_index double precision,
  integrity_score double precision,
  assigned_track text,
  placement_confidence integer,
  submission_reason text not null default '',
  rewrite_archived_at bigint,
  rewrite_source_attempt_hash text not null default '',
  created_at bigint not null default (extract(epoch from now()) * 1000)::bigint
);
create index if not exists exam_attempts_session_idx on public.exam_attempts(session_id);
create index if not exists exam_attempts_candidate_idx on public.exam_attempts(session_id, candidate_hash);
create index if not exists exam_attempts_student_idx on public.exam_attempts(student_hash);

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
create index if not exists exam_attempt_answers_attempt_idx on public.exam_attempt_answers(attempt_hash);

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
create index if not exists exam_integrity_events_session_idx
  on public.exam_integrity_events(session_id, candidate_hash);
create index if not exists exam_integrity_events_attempt_idx
  on public.exam_integrity_events(attempt_hash)
  where attempt_hash is not null;

create table if not exists public.exam_states (
  session_id text not null references public.exam_sessions(id) on delete cascade,
  candidate_hash text not null,
  started_at bigint,
  submitted_at bigint,
  current_index integer not null default 0,
  remaining_seconds double precision not null default 0,
  elapsed_active_seconds double precision not null default 0,
  last_active_at bigint,
  attempt_hash text not null default '',
  paper_fingerprint text not null default '',
  question_ids bigint[] not null default '{}',
  updated_at bigint not null,
  primary key (session_id, candidate_hash)
);

create table if not exists public.exam_responses (
  session_id text not null,
  candidate_hash text not null,
  question_id bigint not null,
  response_text text,
  response_values text[] not null default '{}',
  seconds double precision not null default 0,
  flagged boolean not null default false,
  primary key (session_id, candidate_hash, question_id),
  foreign key (session_id, candidate_hash)
    references public.exam_states(session_id, candidate_hash) on delete cascade
);

create table if not exists public.exam_reset_markers (
  session_id text not null references public.exam_sessions(id) on delete cascade,
  candidate_hash text not null,
  reset_at bigint not null,
  primary key (session_id, candidate_hash)
);

create table if not exists public.exam_background_markers (
  session_id text not null references public.exam_sessions(id) on delete cascade,
  candidate_hash text not null,
  hidden_at bigint,
  started_at bigint,
  updated_at bigint not null,
  primary key (session_id, candidate_hash)
);

create table if not exists public.exam_proctor_policies (
  session_id text primary key references public.exam_sessions(id) on delete cascade,
  camera_required boolean not null default false,
  updated_at bigint not null
);

create table if not exists public.whatsapp_groups (
  id text primary key,
  class_id text not null references public.classes(id) on delete cascade,
  name text not null,
  invite_url text not null,
  created_at bigint not null,
  updated_at bigint not null
);

-- RLS is enabled in the baseline. 02-rls-policies.sql owns the policies.
alter table public.classes enable row level security;
alter table public.subjects enable row level security;
alter table public.users enable row level security;
alter table public.student_profiles enable row level security;
alter table public.exam_sessions enable row level security;
alter table public.questions enable row level security;
alter table public.question_blanks enable row level security;
alter table public.exam_attempts enable row level security;
alter table public.exam_attempt_answers enable row level security;
alter table public.exam_attempt_subject_stats enable row level security;
alter table public.exam_integrity_events enable row level security;
alter table public.exam_states enable row level security;
alter table public.exam_responses enable row level security;
alter table public.exam_reset_markers enable row level security;
alter table public.exam_background_markers enable row level security;
alter table public.exam_proctor_policies enable row level security;
alter table public.whatsapp_groups enable row level security;

commit;
