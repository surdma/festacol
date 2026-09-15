-- 06-academic-relational-foundation.sql
-- Expand-only relational foundation for Festacol's academic domain.
--
-- Goals:
--   * Supabase auth.users remains the authentication authority.
--   * public.academic_profiles is application/academic identity only.
--   * Replace subject/class/cohost arrays and copied labels with explicit joins.
--   * Introduce explicit exam audience, retake grants and durable attempt UUIDs.
--   * Backfill only relationships that can be proven from legacy data.
--   * Never guess ambiguous student/class/creator relationships; record them in
--     public.schema_migration_issues for administrator reconciliation.
--
-- This migration is intentionally non-destructive. Legacy columns remain until
-- all runtime consumers have moved to the v2 relationships and the contract
-- migration is separately validated.

begin;

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------------
-- 1. Academic identity. This is NOT an authentication-user table.
--    auth_user_id points to Supabase auth.users and is the only login identity.
-- ---------------------------------------------------------------------------
create table if not exists public.academic_profiles (
  id uuid primary key default gen_random_uuid(),
  auth_user_id uuid unique references auth.users(id) on delete set null,
  legacy_user_id text unique references public.users(id) on delete set null,
  role text not null check (role in ('student','teacher','administrator')),
  status text not null default 'active' check (status in ('active','inactive')),
  full_name text not null,
  first_name text not null default '',
  last_name text not null default '',
  email text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists academic_profiles_role_status_idx
  on public.academic_profiles(role, status);

create table if not exists public.student_academic_profiles (
  profile_id uuid primary key references public.academic_profiles(id) on delete cascade,
  student_number text unique,
  guardian text not null default '',
  phone text not null default '',
  promotion_status text not null default 'on-track',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.staff_academic_profiles (
  profile_id uuid primary key references public.academic_profiles(id) on delete cascade,
  staff_number text unique,
  qualifier_access boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- 2. Academic calendar + roster history.
-- ---------------------------------------------------------------------------
create table if not exists public.academic_years (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  starts_on date,
  ends_on date,
  status text not null default 'active' check (status in ('planned','active','closed','archived')),
  created_at timestamptz not null default now()
);

create table if not exists public.academic_terms (
  id uuid primary key default gen_random_uuid(),
  academic_year_id uuid not null references public.academic_years(id) on delete cascade,
  name text not null,
  sequence integer not null check (sequence > 0),
  starts_on date,
  ends_on date,
  status text not null default 'active' check (status in ('planned','active','closed','archived')),
  created_at timestamptz not null default now(),
  unique (academic_year_id, name),
  unique (academic_year_id, sequence)
);

create table if not exists public.class_enrollments (
  id uuid primary key default gen_random_uuid(),
  student_profile_id uuid not null references public.student_academic_profiles(profile_id) on delete cascade,
  class_id text not null references public.classes(id) on delete restrict,
  academic_year_id uuid not null references public.academic_years(id) on delete restrict,
  status text not null default 'active' check (status in ('active','completed','withdrawn','transferred')),
  enrolled_at timestamptz not null default now(),
  ended_at timestamptz,
  unique (student_profile_id, class_id, academic_year_id)
);
create unique index if not exists class_enrollments_one_active_year_idx
  on public.class_enrollments(student_profile_id, academic_year_id)
  where status = 'active';
create index if not exists class_enrollments_class_idx
  on public.class_enrollments(class_id, academic_year_id, status);

create table if not exists public.staff_subject_qualifications (
  staff_profile_id uuid not null references public.staff_academic_profiles(profile_id) on delete cascade,
  subject_code text not null references public.subjects(code) on delete restrict,
  active boolean not null default true,
  assigned_at timestamptz not null default now(),
  primary key (staff_profile_id, subject_code)
);

create table if not exists public.teaching_assignments (
  id uuid primary key default gen_random_uuid(),
  staff_profile_id uuid not null references public.staff_academic_profiles(profile_id) on delete cascade,
  class_id text not null references public.classes(id) on delete restrict,
  subject_code text not null references public.subjects(code) on delete restrict,
  academic_year_id uuid not null references public.academic_years(id) on delete restrict,
  academic_term_id uuid references public.academic_terms(id) on delete restrict,
  assignment_role text not null default 'teacher' check (assignment_role in ('teacher','head_teacher','assistant')),
  status text not null default 'active' check (status in ('active','ended')),
  assigned_at timestamptz not null default now(),
  ended_at timestamptz
);
create unique index if not exists teaching_assignments_identity_idx
  on public.teaching_assignments(
    staff_profile_id, class_id, subject_code, academic_year_id,
    coalesce(academic_term_id, '00000000-0000-0000-0000-000000000000'::uuid)
  );
create index if not exists teaching_assignments_class_subject_idx
  on public.teaching_assignments(class_id, subject_code, academic_year_id, status);

-- ---------------------------------------------------------------------------
-- 3. Exam graph: creator/staff, subjects, target classes, explicit exceptions.
-- ---------------------------------------------------------------------------
alter table public.exam_sessions
  add column if not exists created_by_profile_id uuid,
  add column if not exists academic_term_id uuid;

do $$ begin
  alter table public.exam_sessions
    add constraint exam_sessions_creator_profile_fk
    foreign key (created_by_profile_id) references public.staff_academic_profiles(profile_id) on delete set null;
exception when duplicate_object then null; end $$;

do $$ begin
  alter table public.exam_sessions
    add constraint exam_sessions_academic_term_fk
    foreign key (academic_term_id) references public.academic_terms(id) on delete set null;
exception when duplicate_object then null; end $$;

create table if not exists public.exam_subjects (
  session_id text not null references public.exam_sessions(id) on delete cascade,
  subject_code text not null references public.subjects(code) on delete restrict,
  position integer not null default 0 check (position >= 0),
  primary key (session_id, subject_code)
);

create table if not exists public.exam_class_targets (
  session_id text not null references public.exam_sessions(id) on delete cascade,
  class_id text not null references public.classes(id) on delete restrict,
  created_at timestamptz not null default now(),
  primary key (session_id, class_id)
);

create table if not exists public.exam_staff_assignments (
  session_id text not null references public.exam_sessions(id) on delete cascade,
  staff_profile_id uuid not null references public.staff_academic_profiles(profile_id) on delete cascade,
  role text not null check (role in ('creator','cohost','proctor')),
  assigned_at timestamptz not null default now(),
  primary key (session_id, staff_profile_id, role)
);
create index if not exists exam_staff_assignments_staff_idx
  on public.exam_staff_assignments(staff_profile_id, role, session_id);

create table if not exists public.exam_student_access (
  session_id text not null references public.exam_sessions(id) on delete cascade,
  student_profile_id uuid not null references public.student_academic_profiles(profile_id) on delete cascade,
  decision text not null check (decision in ('allow','deny')),
  max_attempts_override integer check (max_attempts_override is null or max_attempts_override >= 1),
  valid_from timestamptz,
  valid_until timestamptz,
  granted_by_profile_id uuid references public.staff_academic_profiles(profile_id) on delete set null,
  reason text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (session_id, student_profile_id),
  check (valid_until is null or valid_from is null or valid_until >= valid_from)
);

create table if not exists public.exam_retake_grants (
  id uuid primary key default gen_random_uuid(),
  session_id text not null references public.exam_sessions(id) on delete cascade,
  student_profile_id uuid not null references public.student_academic_profiles(profile_id) on delete cascade,
  additional_attempts integer not null check (additional_attempts > 0),
  granted_by_profile_id uuid not null references public.staff_academic_profiles(profile_id) on delete restrict,
  reason text not null,
  granted_at timestamptz not null default now(),
  expires_at timestamptz,
  revoked_at timestamptz,
  check (expires_at is null or expires_at >= granted_at)
);
create index if not exists exam_retake_grants_lookup_idx
  on public.exam_retake_grants(session_id, student_profile_id, revoked_at, expires_at);

-- ---------------------------------------------------------------------------
-- 4. Question authorship + durable attempt identity.
-- ---------------------------------------------------------------------------
alter table public.questions
  add column if not exists created_by_profile_id uuid,
  add column if not exists created_at timestamptz;

do $$ begin
  alter table public.questions
    add constraint questions_creator_profile_fk
    foreign key (created_by_profile_id) references public.staff_academic_profiles(profile_id) on delete set null;
exception when duplicate_object then null; end $$;

alter table public.exam_attempts
  add column if not exists attempt_uuid uuid,
  add column if not exists student_profile_id uuid,
  add column if not exists attempt_number integer;

update public.exam_attempts
set attempt_uuid = gen_random_uuid()
where attempt_uuid is null;

alter table public.exam_attempts
  alter column attempt_uuid set default gen_random_uuid(),
  alter column attempt_uuid set not null;

create unique index if not exists exam_attempts_attempt_uuid_idx
  on public.exam_attempts(attempt_uuid);

do $$ begin
  alter table public.exam_attempts
    add constraint exam_attempts_student_profile_fk
    foreign key (student_profile_id) references public.student_academic_profiles(profile_id) on delete restrict;
exception when duplicate_object then null; end $$;

do $$ begin
  alter table public.exam_attempts
    add constraint exam_attempts_attempt_number_check
    check (attempt_number is null or attempt_number >= 1);
exception when duplicate_object then null; end $$;

-- ---------------------------------------------------------------------------
-- 5. Legacy identity reconciliation. We only auto-link a hash to a roster
--    student when normalized first + last name identify exactly one active or
--    inactive legacy student row. Ambiguous names are explicitly unresolved.
-- ---------------------------------------------------------------------------
create table if not exists public.legacy_student_identity_links (
  student_hash text primary key references public.student_profiles(student_hash) on delete cascade,
  student_profile_id uuid not null references public.student_academic_profiles(profile_id) on delete cascade,
  link_method text not null check (link_method in ('unique_normalized_name','manual')),
  linked_at timestamptz not null default now(),
  unique (student_profile_id)
);

create table if not exists public.schema_migration_issues (
  id bigint generated always as identity primary key,
  issue_key text not null unique,
  entity_type text not null,
  entity_key text not null,
  issue_type text not null,
  detail text not null,
  resolved_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists schema_migration_issues_open_idx
  on public.schema_migration_issues(issue_type, entity_type)
  where resolved_at is null;

-- ---------------------------------------------------------------------------
-- 6. Backfill identities and calendar from facts already present.
-- ---------------------------------------------------------------------------
insert into public.academic_profiles
  (auth_user_id, legacy_user_id, role, status, full_name, first_name, last_name, email, created_at, updated_at)
select
  case
    when u.auth_user_id ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
      then u.auth_user_id::uuid
    else null
  end,
  u.id, u.role, u.status, u.full_name, u.first_name, u.last_name, u.email,
  to_timestamp(greatest(u.joined_at, 0) / 1000.0), now()
from public.users u
on conflict (legacy_user_id) do update set
  auth_user_id = coalesce(excluded.auth_user_id, public.academic_profiles.auth_user_id),
  role = excluded.role,
  status = excluded.status,
  full_name = excluded.full_name,
  first_name = excluded.first_name,
  last_name = excluded.last_name,
  email = excluded.email,
  updated_at = now();

insert into public.student_academic_profiles
  (profile_id, student_number, guardian, promotion_status)
select p.id, u.id, u.guardian, u.promotion_status
from public.users u
join public.academic_profiles p on p.legacy_user_id = u.id
where u.role = 'student'
on conflict (profile_id) do update set
  student_number = excluded.student_number,
  guardian = excluded.guardian,
  promotion_status = excluded.promotion_status,
  updated_at = now();

insert into public.staff_academic_profiles
  (profile_id, staff_number, qualifier_access)
select p.id, u.id, u.qualifier_access
from public.users u
join public.academic_profiles p on p.legacy_user_id = u.id
where u.role in ('teacher','administrator')
on conflict (profile_id) do update set
  staff_number = excluded.staff_number,
  qualifier_access = excluded.qualifier_access,
  updated_at = now();

insert into public.academic_years(name, status)
select distinct source.academic_session,
  case when source.academic_session = '2026/2027' then 'active' else 'archived' end
from (
  select academic_session from public.classes
  union select academic_session from public.users
  union select academic_session from public.student_profiles
  union select academic_session from public.exam_sessions
  union select academic_session from public.exam_attempts
) source
where nullif(btrim(source.academic_session), '') is not null
on conflict (name) do nothing;

insert into public.academic_terms(academic_year_id, name, sequence, status)
select y.id, s.term,
  case lower(s.term)
    when 'first term' then 1
    when 'second term' then 2
    when 'third term' then 3
    else 90 + row_number() over (partition by s.academic_session order by s.term)
  end,
  case when y.status = 'active' then 'active' else 'archived' end
from (
  select distinct academic_session, term
  from public.exam_sessions
  where nullif(btrim(term), '') is not null
) s
join public.academic_years y on y.name = s.academic_session
on conflict (academic_year_id, name) do nothing;

update public.exam_sessions s
set academic_term_id = t.id
from public.academic_years y
join public.academic_terms t on t.academic_year_id = y.id
where s.academic_term_id is null
  and y.name = s.academic_session
  and t.name = s.term;

insert into public.class_enrollments
  (student_profile_id, class_id, academic_year_id, status, enrolled_at)
select sp.profile_id, u.class_id, y.id,
  case when u.status = 'active' then 'active' else 'withdrawn' end,
  to_timestamp(greatest(u.joined_at, 0) / 1000.0)
from public.users u
join public.academic_profiles p on p.legacy_user_id = u.id
join public.student_academic_profiles sp on sp.profile_id = p.id
join public.academic_years y on y.name = u.academic_session
where u.role = 'student' and u.class_id is not null
on conflict (student_profile_id, class_id, academic_year_id) do update set
  status = excluded.status;

insert into public.staff_subject_qualifications(staff_profile_id, subject_code)
select sap.profile_id, us.subject_code
from public.users u
join public.academic_profiles p on p.legacy_user_id = u.id
join public.staff_academic_profiles sap on sap.profile_id = p.id
cross join lateral unnest(coalesce(u.subjects, '{}')) as us(subject_code)
join public.subjects s on s.code = us.subject_code
where u.role in ('teacher','administrator')
on conflict (staff_profile_id, subject_code) do update set active = true;

-- Legacy class_id on staff is the only safe source for a class assignment.
-- If it is absent, we do not manufacture a class relationship.
insert into public.teaching_assignments
  (staff_profile_id, class_id, subject_code, academic_year_id, status)
select sap.profile_id, u.class_id, us.subject_code, y.id,
  case when u.status = 'active' then 'active' else 'ended' end
from public.users u
join public.academic_profiles p on p.legacy_user_id = u.id
join public.staff_academic_profiles sap on sap.profile_id = p.id
join public.academic_years y on y.name = u.academic_session
cross join lateral unnest(coalesce(u.subjects, '{}')) as us(subject_code)
join public.subjects s on s.code = us.subject_code
where u.role in ('teacher','administrator') and u.class_id is not null
and not exists (
  select 1 from public.teaching_assignments ta
  where ta.staff_profile_id = sap.profile_id
    and ta.class_id = u.class_id
    and ta.subject_code = us.subject_code
    and ta.academic_year_id = y.id
    and ta.academic_term_id is null
);

-- ---------------------------------------------------------------------------
-- 7. Backfill exam graph where legacy data is unambiguous.
-- ---------------------------------------------------------------------------
insert into public.exam_subjects(session_id, subject_code, position)
select e.id, s.code, ordinality - 1
from public.exam_sessions e
cross join lateral unnest(coalesce(e.subjects, '{}')) with ordinality as subject_code(code, ordinality)
join public.subjects s on s.code = subject_code.code
on conflict (session_id, subject_code) do update set position = excluded.position;

insert into public.exam_staff_assignments(session_id, staff_profile_id, role)
select e.id, sap.profile_id, 'cohost'
from public.exam_sessions e
cross join lateral unnest(coalesce(e.cohosts, '{}')) as ch(legacy_staff_id)
join public.academic_profiles p on p.legacy_user_id = ch.legacy_staff_id
join public.staff_academic_profiles sap on sap.profile_id = p.id
on conflict (session_id, staff_profile_id, role) do nothing;

-- Only map an exam to a class when exactly one class matches the legacy target.
with candidate_matches as (
  select e.id as session_id, c.id as class_id,
         count(*) over (partition by e.id) as match_count
  from public.exam_sessions e
  join public.classes c
    on c.academic_session = e.academic_session
   and c.class_level = e.class_level
   and (
     lower(c.name) = lower(e.class_group)
     or lower(c.stream) = lower(e.class_group)
     or lower(c.grp) = lower(e.class_group)
   )
)
insert into public.exam_class_targets(session_id, class_id)
select session_id, class_id
from candidate_matches
where match_count = 1
on conflict do nothing;

-- Creator cannot be reconstructed: the old schema never stored it.
insert into public.schema_migration_issues(issue_key, entity_type, entity_key, issue_type, detail)
select 'exam:' || e.id || ':creator', 'exam_session', e.id, 'missing_exam_creator',
       'Legacy exam_sessions did not store the creator. Assign an owner before v2 authorization cutover.'
from public.exam_sessions e
where e.created_by_profile_id is null
on conflict (issue_key) do nothing;

insert into public.schema_migration_issues(issue_key, entity_type, entity_key, issue_type, detail)
select 'exam:' || e.id || ':class-target', 'exam_session', e.id, 'unresolved_exam_class_target',
       'Legacy class_level/class_group did not resolve to exactly one class. Choose explicit class target(s) before v2 eligibility cutover.'
from public.exam_sessions e
where not exists (select 1 from public.exam_class_targets t where t.session_id = e.id)
on conflict (issue_key) do nothing;

update public.questions q
set created_by_profile_id = sap.profile_id
from public.academic_profiles p
join public.staff_academic_profiles sap on sap.profile_id = p.id
where q.created_by_profile_id is null
  and q.created_by is not null
  and p.legacy_user_id = q.created_by;

insert into public.schema_migration_issues(issue_key, entity_type, entity_key, issue_type, detail)
select 'question:' || q.id || ':created-at', 'question', q.id::text, 'unknown_question_created_at',
       'Legacy questions stored updated_at only; original creation time cannot be reconstructed safely.'
from public.questions q
where q.created_at is null
on conflict (issue_key) do nothing;

-- ---------------------------------------------------------------------------
-- 8. Reconcile legacy student hashes only when the normalized name is unique.
-- ---------------------------------------------------------------------------
with roster_names as (
  select sp.profile_id, u.id,
         lower(regexp_replace(btrim(u.first_name), '\s+', ' ', 'g')) as first_norm,
         lower(regexp_replace(btrim(u.last_name), '\s+', ' ', 'g')) as last_norm,
         count(*) over (
           partition by lower(regexp_replace(btrim(u.first_name), '\s+', ' ', 'g')),
                        lower(regexp_replace(btrim(u.last_name), '\s+', ' ', 'g'))
         ) as roster_count
  from public.users u
  join public.academic_profiles p on p.legacy_user_id = u.id
  join public.student_academic_profiles sp on sp.profile_id = p.id
  where u.role = 'student'
), legacy_names as (
  select lp.student_hash,
         lower(regexp_replace(btrim(lp.first_name), '\s+', ' ', 'g')) as first_norm,
         lower(regexp_replace(btrim(lp.last_name), '\s+', ' ', 'g')) as last_norm,
         count(*) over (
           partition by lower(regexp_replace(btrim(lp.first_name), '\s+', ' ', 'g')),
                        lower(regexp_replace(btrim(lp.last_name), '\s+', ' ', 'g'))
         ) as legacy_count
  from public.student_profiles lp
)
insert into public.legacy_student_identity_links(student_hash, student_profile_id, link_method)
select l.student_hash, r.profile_id, 'unique_normalized_name'
from legacy_names l
join roster_names r on r.first_norm = l.first_norm and r.last_norm = l.last_norm
where l.legacy_count = 1 and r.roster_count = 1
on conflict (student_hash) do nothing;

insert into public.schema_migration_issues(issue_key, entity_type, entity_key, issue_type, detail)
select 'student-hash:' || lp.student_hash || ':identity', 'legacy_student_profile', lp.student_hash,
       'unresolved_student_identity',
       'Legacy name-hash profile could not be linked uniquely to one roster student. Resolve before v2 student-auth cutover.'
from public.student_profiles lp
where not exists (
  select 1 from public.legacy_student_identity_links l where l.student_hash = lp.student_hash
)
on conflict (issue_key) do nothing;

update public.exam_attempts a
set student_profile_id = l.student_profile_id
from public.legacy_student_identity_links l
where a.student_profile_id is null and l.student_hash = a.student_hash;

with ranked as (
  select a.attempt_hash,
         row_number() over (
           partition by a.session_id, a.student_profile_id
           order by coalesce(a.submitted_at, a.started_at, a.created_at), a.created_at, a.attempt_hash
         ) as rn
  from public.exam_attempts a
  where a.session_id is not null and a.student_profile_id is not null
)
update public.exam_attempts a
set attempt_number = ranked.rn
from ranked
where ranked.attempt_hash = a.attempt_hash
  and a.attempt_number is null;

create unique index if not exists exam_attempts_student_attempt_no_idx
  on public.exam_attempts(session_id, student_profile_id, attempt_number)
  where session_id is not null and student_profile_id is not null and attempt_number is not null;

insert into public.schema_migration_issues(issue_key, entity_type, entity_key, issue_type, detail)
select 'attempt:' || a.attempt_hash || ':student', 'exam_attempt', a.attempt_hash,
       'unresolved_attempt_student',
       'Attempt student_hash is not safely linked to a roster student profile.'
from public.exam_attempts a
where a.student_profile_id is null
on conflict (issue_key) do nothing;

-- ---------------------------------------------------------------------------
-- 9. Future authorization helpers. Runtime switches to these in later slices.
-- ---------------------------------------------------------------------------
create schema if not exists private;

create or replace function private.current_academic_profile_id()
returns uuid language sql stable security definer set search_path = public, auth as $$
  select p.id
  from public.academic_profiles p
  where p.auth_user_id = auth.uid() and p.status = 'active'
  limit 1;
$$;

create or replace function private.student_is_targeted_for_exam(p_session_id text, p_student_profile_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select case
    when exists (
      select 1 from public.exam_student_access x
      where x.session_id = p_session_id
        and x.student_profile_id = p_student_profile_id
        and x.decision = 'deny'
        and (x.valid_from is null or x.valid_from <= now())
        and (x.valid_until is null or x.valid_until >= now())
    ) then false
    when exists (
      select 1 from public.exam_student_access x
      where x.session_id = p_session_id
        and x.student_profile_id = p_student_profile_id
        and x.decision = 'allow'
        and (x.valid_from is null or x.valid_from <= now())
        and (x.valid_until is null or x.valid_until >= now())
    ) then true
    else exists (
      select 1
      from public.class_enrollments ce
      join public.exam_class_targets ect on ect.class_id = ce.class_id
      join public.academic_years y on y.id = ce.academic_year_id
      join public.exam_sessions e on e.id = ect.session_id
      where ce.student_profile_id = p_student_profile_id
        and ce.status = 'active'
        and ect.session_id = p_session_id
        and y.name = e.academic_session
    )
  end;
$$;

create or replace function private.student_allowed_attempts(p_session_id text, p_student_profile_id uuid)
returns integer language sql stable security definer set search_path = public as $$
  select greatest(0,
    coalesce((
      select esa.max_attempts_override
      from public.exam_student_access esa
      where esa.session_id = p_session_id
        and esa.student_profile_id = p_student_profile_id
        and esa.decision = 'allow'
        and (esa.valid_from is null or esa.valid_from <= now())
        and (esa.valid_until is null or esa.valid_until >= now())
    ), (select e.attempt_limit from public.exam_sessions e where e.id = p_session_id), 0)
    + coalesce((
      select sum(g.additional_attempts)::integer
      from public.exam_retake_grants g
      where g.session_id = p_session_id
        and g.student_profile_id = p_student_profile_id
        and g.revoked_at is null
        and (g.expires_at is null or g.expires_at >= now())
    ), 0)
  );
$$;

-- ---------------------------------------------------------------------------
-- 10. RLS: new tables start closed and expose only proven relationships.
--     Legacy policies remain untouched until runtime cutover.
-- ---------------------------------------------------------------------------
alter table public.academic_profiles enable row level security;
alter table public.student_academic_profiles enable row level security;
alter table public.staff_academic_profiles enable row level security;
alter table public.academic_years enable row level security;
alter table public.academic_terms enable row level security;
alter table public.class_enrollments enable row level security;
alter table public.staff_subject_qualifications enable row level security;
alter table public.teaching_assignments enable row level security;
alter table public.exam_subjects enable row level security;
alter table public.exam_class_targets enable row level security;
alter table public.exam_staff_assignments enable row level security;
alter table public.exam_student_access enable row level security;
alter table public.exam_retake_grants enable row level security;
alter table public.legacy_student_identity_links enable row level security;
alter table public.schema_migration_issues enable row level security;

-- Authenticated users may inspect calendar metadata.
drop policy if exists academic_years_read on public.academic_years;
create policy academic_years_read on public.academic_years
  for select to authenticated using (true);
drop policy if exists academic_terms_read on public.academic_terms;
create policy academic_terms_read on public.academic_terms
  for select to authenticated using (true);

-- A person may see their own academic profile. Administrator/service role
-- management policies are added during the v2 authorization cutover.
drop policy if exists academic_profiles_self_read on public.academic_profiles;
create policy academic_profiles_self_read on public.academic_profiles
  for select to authenticated using (auth_user_id = auth.uid());

drop policy if exists student_profiles_self_read_v2 on public.student_academic_profiles;
create policy student_profiles_self_read_v2 on public.student_academic_profiles
  for select to authenticated using (
    exists (select 1 from public.academic_profiles p where p.id = profile_id and p.auth_user_id = auth.uid())
  );

drop policy if exists staff_profiles_self_read_v2 on public.staff_academic_profiles;
create policy staff_profiles_self_read_v2 on public.staff_academic_profiles
  for select to authenticated using (
    exists (select 1 from public.academic_profiles p where p.id = profile_id and p.auth_user_id = auth.uid())
  );

-- ---------------------------------------------------------------------------
-- 11. Health view used by migration tooling and admin readiness checks.
-- ---------------------------------------------------------------------------
create or replace view public.academic_schema_health as
select
  (select count(*) from public.academic_profiles) as profiles,
  (select count(*) from public.student_academic_profiles) as students,
  (select count(*) from public.staff_academic_profiles) as staff,
  (select count(*) from public.class_enrollments where status = 'active') as active_enrollments,
  (select count(*) from public.teaching_assignments where status = 'active') as active_teaching_assignments,
  (select count(*) from public.exam_class_targets) as exam_class_targets,
  (select count(*) from public.exam_subjects) as exam_subject_links,
  (select count(*) from public.schema_migration_issues where resolved_at is null) as open_migration_issues;

commit;
