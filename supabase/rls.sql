-- Festacol Supabase platform integration: Row Level Security and Data API grants.
--
-- Prisma owns table/column/index/enum creation. Apply this file only AFTER
-- `prisma migrate deploy` and `supabase/auth-rpc.sql`.

begin;

-- --------------------------------------------------------------------- RLS on
alter table public.academic_profiles enable row level security;
alter table public.student_academic_profiles enable row level security;
alter table public.staff_academic_profiles enable row level security;
alter table public.academic_years enable row level security;
alter table public.academic_terms enable row level security;
alter table public.academic_levels enable row level security;
alter table public.academic_programmes enable row level security;
alter table public.classes enable row level security;
alter table public.class_enrollments enable row level security;
alter table public.subjects enable row level security;
alter table public.class_subject_offerings enable row level security;
alter table public.student_subject_enrollments enable row level security;
alter table public.staff_subject_qualifications enable row level security;
alter table public.teaching_assignments enable row level security;
alter table public.exam_sessions enable row level security;
alter table public.exam_class_targets enable row level security;
alter table public.exam_offering_targets enable row level security;
alter table public.exam_placement_programmes enable row level security;
alter table public.exam_staff_assignments enable row level security;
alter table public.exam_student_access enable row level security;
alter table public.exam_retake_grants enable row level security;
alter table public.exam_attempts enable row level security;
alter table public.exam_attempt_runtime_states enable row level security;
alter table public.exam_attempt_responses enable row level security;
alter table public.exam_attempt_answers enable row level security;
alter table public.exam_integrity_events enable row level security;
alter table public.questions enable row level security;
alter table public.question_academic_levels enable row level security;
alter table public.question_blanks enable row level security;
alter table public.whatsapp_groups enable row level security;

-- Drop every existing policy on canonical tables so this file is idempotent and
-- cannot leave an obsolete policy active after a contract change.
do $$
declare r record;
begin
  for r in
    select schemaname,tablename,policyname
    from pg_policies
    where schemaname='public'
      and tablename = any(array[
        'academic_profiles','student_academic_profiles','staff_academic_profiles',
        'academic_years','academic_terms','academic_levels','academic_programmes',
        'classes','class_enrollments','subjects','class_subject_offerings',
        'student_subject_enrollments','staff_subject_qualifications','teaching_assignments',
        'exam_sessions','exam_class_targets','exam_offering_targets','exam_placement_programmes',
        'exam_staff_assignments','exam_student_access','exam_retake_grants','exam_attempts',
        'exam_attempt_runtime_states','exam_attempt_responses','exam_attempt_answers',
        'exam_integrity_events','questions','question_academic_levels','question_blanks','whatsapp_groups'
      ])
  loop
    execute format('drop policy if exists %I on %I.%I',r.policyname,r.schemaname,r.tablename);
  end loop;
end $$;

-- ------------------------------------------------------------- Data API grants
-- Reads/writes granted here are still constrained by RLS. Privileged server
-- mutations use the Supabase server secret/service role and bypass RLS.
grant usage on schema public to authenticated;

grant select on public.academic_profiles to authenticated;
grant update(first_name,last_name,updated_at) on public.academic_profiles to authenticated;
grant select on public.student_academic_profiles to authenticated;
grant update(guardian,phone,updated_at) on public.student_academic_profiles to authenticated;
grant select on public.staff_academic_profiles to authenticated;

grant select on public.academic_years,public.academic_terms,public.academic_levels,
  public.academic_programmes,public.classes,public.subjects to authenticated;

grant select on public.class_enrollments,public.class_subject_offerings,
  public.student_subject_enrollments,public.staff_subject_qualifications,
  public.teaching_assignments to authenticated;

grant select on public.exam_sessions,public.exam_class_targets,public.exam_offering_targets,
  public.exam_placement_programmes,public.exam_staff_assignments,public.exam_student_access,
  public.exam_retake_grants,public.exam_attempts to authenticated;

grant select,update on public.exam_attempt_runtime_states to authenticated;
grant select,insert,update,delete on public.exam_attempt_responses to authenticated;
grant select,insert on public.exam_integrity_events to authenticated;
grant usage,select on sequence public.exam_integrity_events_id_seq to authenticated;

grant select on public.questions,public.question_academic_levels,public.question_blanks to authenticated;
grant select on public.exam_attempt_answers to authenticated;
grant select on public.whatsapp_groups to authenticated;

-- service_role/secret-key clients are the trusted server mutation boundary.
grant all privileges on all tables in schema public to service_role;
grant all privileges on all sequences in schema public to service_role;

-- --------------------------------------------------------------- self identity
create policy academic_profiles_self_read on public.academic_profiles
  for select to authenticated
  using (id = private.current_academic_profile_id());
create policy academic_profiles_self_update on public.academic_profiles
  for update to authenticated
  using (id = private.current_academic_profile_id())
  with check (id = private.current_academic_profile_id());

create policy student_profile_self_read on public.student_academic_profiles
  for select to authenticated
  using (profile_id = private.current_academic_profile_id());
create policy student_profile_self_update on public.student_academic_profiles
  for update to authenticated
  using (profile_id = private.current_academic_profile_id())
  with check (profile_id = private.current_academic_profile_id());

create policy staff_profile_self_read on public.staff_academic_profiles
  for select to authenticated
  using (profile_id = private.current_academic_profile_id());

-- ------------------------------------------------------------- public catalog
create policy academic_years_authenticated_read on public.academic_years
  for select to authenticated using (true);
create policy academic_terms_authenticated_read on public.academic_terms
  for select to authenticated using (true);
create policy academic_levels_authenticated_read on public.academic_levels
  for select to authenticated using (true);
create policy academic_programmes_authenticated_read on public.academic_programmes
  for select to authenticated using (true);
create policy classes_authenticated_read on public.classes
  for select to authenticated using (true);
create policy subjects_authenticated_read on public.subjects
  for select to authenticated using (true);

-- ---------------------------------------------------------- academic relations
create policy class_enrollments_student_read on public.class_enrollments
  for select to authenticated
  using (student_profile_id = private.current_academic_profile_id());
create policy class_enrollments_staff_read on public.class_enrollments
  for select to authenticated
  using (private.staff_can_access_class(private.current_academic_profile_id(),class_id));

create policy class_offerings_student_read on public.class_subject_offerings
  for select to authenticated
  using (
    exists (
      select 1 from public.class_enrollments ce
      where ce.class_id=class_subject_offerings.class_id
        and ce.student_profile_id=private.current_academic_profile_id()
        and ce.status='active'
    )
  );
create policy class_offerings_staff_read on public.class_subject_offerings
  for select to authenticated
  using (private.staff_can_access_class(private.current_academic_profile_id(),class_id));

create policy subject_enrollments_student_read on public.student_subject_enrollments
  for select to authenticated
  using (student_profile_id = private.current_academic_profile_id());
create policy subject_enrollments_staff_read on public.student_subject_enrollments
  for select to authenticated
  using (
    private.teacher_is_assigned_to_offering(private.current_academic_profile_id(),offering_id)
    or private.is_admin()
  );

create policy staff_qualifications_self_read on public.staff_subject_qualifications
  for select to authenticated
  using (staff_profile_id = private.current_academic_profile_id() or private.is_admin());

create policy teaching_assignments_self_read on public.teaching_assignments
  for select to authenticated
  using (staff_profile_id = private.current_academic_profile_id() or private.is_admin());

-- --------------------------------------------------------------- exam metadata
create policy exam_sessions_student_read on public.exam_sessions
  for select to authenticated
  using (private.student_is_targeted_for_exam(id,private.current_academic_profile_id()));
create policy exam_sessions_staff_read on public.exam_sessions
  for select to authenticated
  using (private.staff_can_access_exam(private.current_academic_profile_id(),id));

create policy exam_class_targets_access_read on public.exam_class_targets
  for select to authenticated
  using (
    private.student_is_targeted_for_exam(session_id,private.current_academic_profile_id())
    or private.staff_can_access_exam(private.current_academic_profile_id(),session_id)
  );
create policy exam_offering_targets_access_read on public.exam_offering_targets
  for select to authenticated
  using (
    private.student_is_targeted_for_exam(session_id,private.current_academic_profile_id())
    or private.staff_can_access_exam(private.current_academic_profile_id(),session_id)
  );
create policy exam_placement_programmes_access_read on public.exam_placement_programmes
  for select to authenticated
  using (
    private.student_is_targeted_for_exam(session_id,private.current_academic_profile_id())
    or private.staff_can_access_exam(private.current_academic_profile_id(),session_id)
  );
create policy exam_staff_assignments_access_read on public.exam_staff_assignments
  for select to authenticated
  using (
    staff_profile_id=private.current_academic_profile_id()
    or private.staff_can_access_exam(private.current_academic_profile_id(),session_id)
  );
create policy exam_student_access_self_read on public.exam_student_access
  for select to authenticated
  using (
    student_profile_id=private.current_academic_profile_id()
    or private.staff_can_access_exam(private.current_academic_profile_id(),session_id)
  );
create policy exam_retake_grants_self_read on public.exam_retake_grants
  for select to authenticated
  using (
    student_profile_id=private.current_academic_profile_id()
    or private.staff_can_access_exam(private.current_academic_profile_id(),session_id)
  );

-- ------------------------------------------------------------ attempt boundary
create policy exam_attempts_student_read on public.exam_attempts
  for select to authenticated
  using (student_profile_id = private.current_academic_profile_id());
create policy exam_attempts_staff_read on public.exam_attempts
  for select to authenticated
  using (private.staff_can_access_exam(private.current_academic_profile_id(),session_id));

create policy attempt_runtime_student_read on public.exam_attempt_runtime_states
  for select to authenticated
  using (
    exists (
      select 1 from public.exam_attempts a
      where a.id=exam_attempt_runtime_states.attempt_id
        and a.student_profile_id=private.current_academic_profile_id()
    )
  );
create policy attempt_runtime_student_update on public.exam_attempt_runtime_states
  for update to authenticated
  using (
    exists (
      select 1 from public.exam_attempts a
      where a.id=exam_attempt_runtime_states.attempt_id
        and a.student_profile_id=private.current_academic_profile_id()
        and a.submitted_at is null
    )
  )
  with check (
    exists (
      select 1 from public.exam_attempts a
      where a.id=exam_attempt_runtime_states.attempt_id
        and a.student_profile_id=private.current_academic_profile_id()
        and a.submitted_at is null
    )
  );
create policy attempt_runtime_staff_read on public.exam_attempt_runtime_states
  for select to authenticated
  using (
    exists (
      select 1 from public.exam_attempts a
      where a.id=exam_attempt_runtime_states.attempt_id
        and private.staff_can_access_exam(private.current_academic_profile_id(),a.session_id)
    )
  );

create policy attempt_responses_student_read on public.exam_attempt_responses
  for select to authenticated
  using (
    exists (
      select 1 from public.exam_attempts a
      where a.id=exam_attempt_responses.attempt_id
        and a.student_profile_id=private.current_academic_profile_id()
    )
  );
create policy attempt_responses_student_insert on public.exam_attempt_responses
  for insert to authenticated
  with check (
    exists (
      select 1 from public.exam_attempts a
      where a.id=exam_attempt_responses.attempt_id
        and a.student_profile_id=private.current_academic_profile_id()
        and a.submitted_at is null
    )
  );
create policy attempt_responses_student_update on public.exam_attempt_responses
  for update to authenticated
  using (
    exists (
      select 1 from public.exam_attempts a
      where a.id=exam_attempt_responses.attempt_id
        and a.student_profile_id=private.current_academic_profile_id()
        and a.submitted_at is null
    )
  )
  with check (
    exists (
      select 1 from public.exam_attempts a
      where a.id=exam_attempt_responses.attempt_id
        and a.student_profile_id=private.current_academic_profile_id()
        and a.submitted_at is null
    )
  );
create policy attempt_responses_student_delete on public.exam_attempt_responses
  for delete to authenticated
  using (
    exists (
      select 1 from public.exam_attempts a
      where a.id=exam_attempt_responses.attempt_id
        and a.student_profile_id=private.current_academic_profile_id()
        and a.submitted_at is null
    )
  );
create policy attempt_responses_staff_read on public.exam_attempt_responses
  for select to authenticated
  using (
    exists (
      select 1 from public.exam_attempts a
      where a.id=exam_attempt_responses.attempt_id
        and private.staff_can_access_exam(private.current_academic_profile_id(),a.session_id)
    )
  );

-- Graded answer detail deliberately has NO student policy because it carries
-- correct_answer. Students receive result summaries through server actions.
create policy attempt_answers_staff_read on public.exam_attempt_answers
  for select to authenticated
  using (
    exists (
      select 1 from public.exam_attempts a
      where a.id=exam_attempt_answers.attempt_id
        and private.staff_can_access_exam(private.current_academic_profile_id(),a.session_id)
    )
  );

create policy integrity_student_read on public.exam_integrity_events
  for select to authenticated
  using (
    exists (
      select 1 from public.exam_attempts a
      where a.id=exam_integrity_events.attempt_id
        and a.student_profile_id=private.current_academic_profile_id()
    )
  );
create policy integrity_student_insert on public.exam_integrity_events
  for insert to authenticated
  with check (
    exists (
      select 1 from public.exam_attempts a
      where a.id=exam_integrity_events.attempt_id
        and a.student_profile_id=private.current_academic_profile_id()
        and a.submitted_at is null
    )
  );
create policy integrity_staff_read on public.exam_integrity_events
  for select to authenticated
  using (
    exists (
      select 1 from public.exam_attempts a
      where a.id=exam_integrity_events.attempt_id
        and private.staff_can_access_exam(private.current_academic_profile_id(),a.session_id)
    )
  );

-- ------------------------------------------------------------- question bank
-- No student SELECT policy exists on questions because the table contains
-- correct_answers. Paper delivery is server-only through the secret key.
create policy questions_staff_read on public.questions
  for select to authenticated
  using (
    status='active'
    and private.staff_can_access_subject(private.current_academic_profile_id(),subject_id)
  );
create policy question_levels_staff_read on public.question_academic_levels
  for select to authenticated
  using (
    exists (
      select 1 from public.questions q
      where q.id=question_academic_levels.question_id
        and private.staff_can_access_subject(private.current_academic_profile_id(),q.subject_id)
    )
  );
create policy question_blanks_staff_read on public.question_blanks
  for select to authenticated
  using (
    exists (
      select 1 from public.questions q
      where q.id=question_blanks.question_id
        and private.staff_can_access_subject(private.current_academic_profile_id(),q.subject_id)
    )
  );

-- --------------------------------------------------------------- communication
create policy whatsapp_student_read on public.whatsapp_groups
  for select to authenticated
  using (
    exists (
      select 1 from public.class_enrollments ce
      where ce.class_id=whatsapp_groups.class_id
        and ce.student_profile_id=private.current_academic_profile_id()
        and ce.status='active'
    )
  );
create policy whatsapp_staff_read on public.whatsapp_groups
  for select to authenticated
  using (private.staff_can_access_class(private.current_academic_profile_id(),class_id));

commit;
