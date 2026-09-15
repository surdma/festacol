-- 09-curriculum-subject-offerings.sql
-- Canonical curriculum graph for Nigerian senior-secondary operations.
--
-- level = SS1/SS2/SS3; programme = Science/Arts/Social Science/pathway;
-- class = a concrete section such as SS1 A; subject = canonical UUID row;
-- offering = one class taking one subject in one academic year/term.
-- Programme labels never grant subject or examination access.

begin;
create extension if not exists pgcrypto;

-- ---------------------------------------------------------------- subjects
alter table public.subjects add column if not exists id uuid;
update public.subjects set id = gen_random_uuid() where id is null;
alter table public.subjects alter column id set default gen_random_uuid();
alter table public.subjects alter column id set not null;
create unique index if not exists subjects_id_uidx on public.subjects(id);

alter table public.subjects add column if not exists normalized_name text;
update public.subjects
set normalized_name = lower(regexp_replace(btrim(name), '\s+', ' ', 'g'))
where normalized_name is null;
alter table public.subjects alter column normalized_name set not null;

-- Duplicate display names are not silently merged: surface them for manual
-- reconciliation and keep UUID identity distinct until an administrator can
-- prove they are aliases of the same curriculum subject.
insert into public.schema_migration_issues(issue_key, entity_type, entity_key, issue_type, detail)
select 'subject-name:' || md5(normalized_name), 'subject', normalized_name,
       'duplicate_subject_name',
       'Multiple legacy subject rows normalize to the same name; do not guess which row is canonical.'
from public.subjects
group by normalized_name having count(*) > 1
on conflict (issue_key) do nothing;
create index if not exists subjects_normalized_name_idx on public.subjects(normalized_name);

alter table public.subjects add column if not exists created_at timestamptz not null default now();
alter table public.subjects add column if not exists updated_at_v2 timestamptz not null default now();

create table if not exists public.subject_legacy_aliases (
  alias text primary key,
  subject_id uuid not null references public.subjects(id) on delete cascade,
  source text not null default 'legacy-code',
  created_at timestamptz not null default now()
);
create index if not exists subject_legacy_aliases_subject_idx on public.subject_legacy_aliases(subject_id);
insert into public.subject_legacy_aliases(alias, subject_id, source)
select code, id, 'legacy-code' from public.subjects
on conflict (alias) do update set subject_id = excluded.subject_id;

-- ----------------------------------------------------------- levels/programmes
create table if not exists public.academic_levels (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  ordinal integer not null check (ordinal > 0),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  unique (ordinal)
);
insert into public.academic_levels(name, ordinal)
values ('SS1',1),('SS2',2),('SS3',3)
on conflict (name) do update set ordinal = excluded.ordinal, active = true;

create table if not exists public.academic_programmes (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  normalized_name text not null unique,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
-- Preserve each legacy pathway literally. Never guess that Commercial,
-- General, or another historic value means Social Science.
insert into public.academic_programmes(name, normalized_name)
select distinct btrim(stream), lower(regexp_replace(btrim(stream), '\s+', ' ', 'g'))
from public.classes
where nullif(btrim(stream), '') is not null and lower(btrim(stream)) <> 'general'
on conflict (normalized_name) do nothing;

alter table public.classes add column if not exists level_id uuid;
alter table public.classes add column if not exists programme_id uuid;
do $$ begin
  alter table public.classes add constraint classes_level_v2_fk
    foreign key (level_id) references public.academic_levels(id) on delete restrict;
exception when duplicate_object then null; end $$;
do $$ begin
  alter table public.classes add constraint classes_programme_v2_fk
    foreign key (programme_id) references public.academic_programmes(id) on delete restrict;
exception when duplicate_object then null; end $$;
update public.classes c set level_id = l.id
from public.academic_levels l where c.level_id is null and l.name = c.class_level;
update public.classes c set programme_id = p.id
from public.academic_programmes p
where c.programme_id is null
  and p.normalized_name = lower(regexp_replace(btrim(c.stream), '\s+', ' ', 'g'))
  and lower(btrim(c.stream)) <> 'general';
insert into public.schema_migration_issues(issue_key, entity_type, entity_key, issue_type, detail)
select 'class:' || c.id || ':level-v2', 'class', c.id, 'unresolved_class_level',
       'Class level did not resolve to an academic_levels row.'
from public.classes c where c.level_id is null
on conflict (issue_key) do nothing;

-- ---------------------------------------------------------- class offerings
create table if not exists public.class_subject_offerings (
  id uuid primary key default gen_random_uuid(),
  class_id text not null references public.classes(id) on delete restrict,
  subject_id uuid not null references public.subjects(id) on delete restrict,
  academic_year_id uuid not null references public.academic_years(id) on delete restrict,
  academic_term_id uuid references public.academic_terms(id) on delete restrict,
  participation text not null default 'required' check (participation in ('required','elective')),
  status text not null default 'active' check (status in ('draft','active','ended')),
  source text not null default 'explicit' check (source in ('explicit','legacy-exam','legacy-teaching')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index if not exists class_subject_offerings_identity_idx
  on public.class_subject_offerings(
    class_id, subject_id, academic_year_id,
    coalesce(academic_term_id, '00000000-0000-0000-0000-000000000000'::uuid)
  );
create index if not exists class_subject_offerings_subject_idx
  on public.class_subject_offerings(subject_id, academic_year_id, status);

create table if not exists public.student_subject_enrollments (
  student_profile_id uuid not null references public.student_academic_profiles(profile_id) on delete cascade,
  offering_id uuid not null references public.class_subject_offerings(id) on delete cascade,
  status text not null default 'active' check (status in ('active','completed','withdrawn')),
  enrolled_at timestamptz not null default now(),
  ended_at timestamptz,
  primary key (student_profile_id, offering_id)
);
create index if not exists student_subject_enrollments_offering_idx
  on public.student_subject_enrollments(offering_id, status);

-- Only resolved legacy exam class+subject pairs are strong enough evidence to
-- create active required offerings. subjects.streams[] is never authorization.
insert into public.class_subject_offerings(
  class_id, subject_id, academic_year_id, academic_term_id, participation, status, source
)
select distinct ect.class_id, s.id, y.id, e.academic_term_id, 'required', 'active', 'legacy-exam'
from public.exam_class_targets ect
join public.exam_sessions e on e.id = ect.session_id
join public.academic_years y on y.name = e.academic_session
join public.exam_subjects es on es.session_id = e.id
join public.subjects s on s.code = es.subject_code
where not exists (
  select 1 from public.class_subject_offerings o
  where o.class_id = ect.class_id and o.subject_id = s.id and o.academic_year_id = y.id
    and o.academic_term_id is not distinct from e.academic_term_id
);

-- Legacy teaching tuples show teacher intent, not whole-class participation.
-- Preserve them as draft/elective until explicitly activated.
insert into public.class_subject_offerings(
  class_id, subject_id, academic_year_id, academic_term_id, participation, status, source
)
select distinct ta.class_id, s.id, ta.academic_year_id, ta.academic_term_id,
       'elective', 'draft', 'legacy-teaching'
from public.teaching_assignments ta
join public.subjects s on s.code = ta.subject_code
where not exists (
  select 1 from public.class_subject_offerings o
  where o.class_id = ta.class_id and o.subject_id = s.id
    and o.academic_year_id = ta.academic_year_id
    and o.academic_term_id is not distinct from ta.academic_term_id
);

-- ------------------------------------------------ staff scope by subject UUID
alter table public.staff_subject_qualifications add column if not exists subject_id uuid;
update public.staff_subject_qualifications q set subject_id = s.id
from public.subjects s where q.subject_id is null and s.code = q.subject_code;
do $$ begin
  alter table public.staff_subject_qualifications add constraint staff_subject_qualifications_subject_v2_fk
    foreign key (subject_id) references public.subjects(id) on delete restrict;
exception when duplicate_object then null; end $$;
create unique index if not exists staff_subject_qualifications_v2_uidx
  on public.staff_subject_qualifications(staff_profile_id, subject_id) where subject_id is not null;

alter table public.teaching_assignments add column if not exists subject_id uuid;
alter table public.teaching_assignments add column if not exists offering_id uuid;
update public.teaching_assignments ta set subject_id = s.id
from public.subjects s where ta.subject_id is null and s.code = ta.subject_code;
update public.teaching_assignments ta set offering_id = o.id
from public.class_subject_offerings o
where ta.offering_id is null
  and o.class_id = ta.class_id and o.subject_id = ta.subject_id
  and o.academic_year_id = ta.academic_year_id
  and o.academic_term_id is not distinct from ta.academic_term_id;
do $$ begin
  alter table public.teaching_assignments add constraint teaching_assignments_subject_v2_fk
    foreign key (subject_id) references public.subjects(id) on delete restrict;
exception when duplicate_object then null; end $$;
do $$ begin
  alter table public.teaching_assignments add constraint teaching_assignments_offering_v2_fk
    foreign key (offering_id) references public.class_subject_offerings(id) on delete restrict;
exception when duplicate_object then null; end $$;
create index if not exists teaching_assignments_offering_idx
  on public.teaching_assignments(offering_id, staff_profile_id, status);

-- ------------------------------------------------ exam/question canonical FKs
alter table public.questions add column if not exists subject_id uuid;
update public.questions q set subject_id = s.id
from public.subjects s where q.subject_id is null and s.code = q.subject_code;
do $$ begin
  alter table public.questions add constraint questions_subject_v2_fk
    foreign key (subject_id) references public.subjects(id) on delete restrict;
exception when duplicate_object then null; end $$;
create index if not exists questions_subject_v2_idx on public.questions(subject_id);
insert into public.schema_migration_issues(issue_key, entity_type, entity_key, issue_type, detail)
select 'question:' || q.id || ':subject-v2', 'question', q.id::text, 'unresolved_question_subject',
       'Question legacy subject code did not resolve to a canonical subject UUID.'
from public.questions q where q.subject_id is null
on conflict (issue_key) do nothing;

alter table public.exam_subjects add column if not exists subject_id uuid;
update public.exam_subjects es set subject_id = s.id
from public.subjects s where es.subject_id is null and s.code = es.subject_code;
do $$ begin
  alter table public.exam_subjects add constraint exam_subjects_subject_v2_fk
    foreign key (subject_id) references public.subjects(id) on delete restrict;
exception when duplicate_object then null; end $$;
create unique index if not exists exam_subjects_v2_uidx
  on public.exam_subjects(session_id, subject_id) where subject_id is not null;

create table if not exists public.exam_offering_targets (
  session_id text not null references public.exam_sessions(id) on delete cascade,
  offering_id uuid not null references public.class_subject_offerings(id) on delete restrict,
  created_at timestamptz not null default now(),
  primary key (session_id, offering_id)
);
create index if not exists exam_offering_targets_offering_idx on public.exam_offering_targets(offering_id, session_id);
insert into public.exam_offering_targets(session_id, offering_id)
select distinct ect.session_id, o.id
from public.exam_class_targets ect
join public.exam_subjects es on es.session_id = ect.session_id and es.subject_id is not null
join public.exam_sessions e on e.id = ect.session_id
join public.academic_years y on y.name = e.academic_session
join public.class_subject_offerings o
  on o.class_id = ect.class_id and o.subject_id = es.subject_id
 and o.academic_year_id = y.id
 and (e.academic_term_id is null or o.academic_term_id is not distinct from e.academic_term_id)
where o.status = 'active'
on conflict do nothing;

-- ------------------------------------------------------- eligibility helpers
create or replace function private.student_is_enrolled_in_offering(p_offering_id uuid, p_student_profile_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1
    from public.class_subject_offerings o
    join public.class_enrollments ce
      on ce.class_id = o.class_id and ce.academic_year_id = o.academic_year_id
     and ce.student_profile_id = p_student_profile_id and ce.status = 'active'
    where o.id = p_offering_id and o.status = 'active'
      and (
        o.participation = 'required'
        or exists (
          select 1 from public.student_subject_enrollments se
          where se.offering_id = o.id and se.student_profile_id = p_student_profile_id and se.status = 'active'
        )
      )
  );
$$;

create or replace function private.teacher_is_qualified_for_subject(p_staff_profile_id uuid, p_subject_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.staff_subject_qualifications q
    where q.staff_profile_id = p_staff_profile_id and q.subject_id = p_subject_id and q.active
  );
$$;

create or replace function private.teacher_is_assigned_to_offering(p_staff_profile_id uuid, p_offering_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.teaching_assignments ta
    where ta.staff_profile_id = p_staff_profile_id and ta.offering_id = p_offering_id and ta.status = 'active'
  );
$$;

revoke all on function private.student_is_enrolled_in_offering(uuid, uuid) from public;
revoke all on function private.teacher_is_qualified_for_subject(uuid, uuid) from public;
revoke all on function private.teacher_is_assigned_to_offering(uuid, uuid) from public;
grant execute on function private.student_is_enrolled_in_offering(uuid, uuid) to authenticated;
grant execute on function private.teacher_is_qualified_for_subject(uuid, uuid) to authenticated;
grant execute on function private.teacher_is_assigned_to_offering(uuid, uuid) to authenticated;

-- --------------------------------------------------------------- RLS baseline
alter table public.subject_legacy_aliases enable row level security;
alter table public.academic_levels enable row level security;
alter table public.academic_programmes enable row level security;
alter table public.class_subject_offerings enable row level security;
alter table public.student_subject_enrollments enable row level security;
alter table public.exam_offering_targets enable row level security;

drop policy if exists academic_levels_read on public.academic_levels;
create policy academic_levels_read on public.academic_levels for select to authenticated using (true);
drop policy if exists academic_programmes_read on public.academic_programmes;
create policy academic_programmes_read on public.academic_programmes for select to authenticated using (true);
drop policy if exists class_subject_offerings_student_read on public.class_subject_offerings;
create policy class_subject_offerings_student_read on public.class_subject_offerings
  for select to authenticated using (
    exists (
      select 1 from public.class_enrollments ce
      where ce.class_id = class_subject_offerings.class_id
        and ce.academic_year_id = class_subject_offerings.academic_year_id
        and ce.student_profile_id = private.current_academic_profile_id()
        and ce.status = 'active'
    )
    or exists (
      select 1 from public.teaching_assignments ta
      where ta.offering_id = class_subject_offerings.id
        and ta.staff_profile_id = private.current_academic_profile_id()
        and ta.status = 'active'
    )
    or private.is_admin_v2()
  );
drop policy if exists student_subject_enrollments_self_read on public.student_subject_enrollments;
create policy student_subject_enrollments_self_read on public.student_subject_enrollments
  for select to authenticated using (
    student_subject_enrollments.student_profile_id = private.current_academic_profile_id()
    or private.is_admin_v2()
  );

commit;
