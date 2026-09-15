-- 11-runtime-consumer-cutover.sql
-- Cut live exam/question authorization to relational identities and attempt UUIDs.
-- Students never receive direct access to answer-bearing question/result-detail rows.

begin;

-- ---------------------------------------------------------------- result FKs
alter table public.exam_attempt_answers add column if not exists attempt_uuid uuid;
alter table public.exam_attempt_answers add column if not exists subject_id uuid;
alter table public.exam_attempt_subject_stats add column if not exists attempt_uuid uuid;
alter table public.exam_attempt_subject_stats add column if not exists subject_id uuid;

update public.exam_attempt_answers d
set attempt_uuid = a.attempt_uuid
from public.exam_attempts a
where d.attempt_uuid is null and d.attempt_hash = a.attempt_hash;
update public.exam_attempt_answers d
set subject_id = s.id
from public.subjects s
where d.subject_id is null and d.subject_code = s.code;
update public.exam_attempt_subject_stats d
set attempt_uuid = a.attempt_uuid
from public.exam_attempts a
where d.attempt_uuid is null and d.attempt_hash = a.attempt_hash;
update public.exam_attempt_subject_stats d
set subject_id = s.id
from public.subjects s
where d.subject_id is null and d.subject_code = s.code;

do $$ begin
  alter table public.exam_attempt_answers
    add constraint exam_attempt_answers_attempt_uuid_fk
    foreign key (attempt_uuid) references public.exam_attempts(attempt_uuid) on delete cascade;
exception when duplicate_object then null; end $$;
do $$ begin
  alter table public.exam_attempt_answers
    add constraint exam_attempt_answers_subject_id_fk
    foreign key (subject_id) references public.subjects(id) on delete restrict;
exception when duplicate_object then null; end $$;
do $$ begin
  alter table public.exam_attempt_subject_stats
    add constraint exam_attempt_subject_stats_attempt_uuid_fk
    foreign key (attempt_uuid) references public.exam_attempts(attempt_uuid) on delete cascade;
exception when duplicate_object then null; end $$;
do $$ begin
  alter table public.exam_attempt_subject_stats
    add constraint exam_attempt_subject_stats_subject_id_fk
    foreign key (subject_id) references public.subjects(id) on delete restrict;
exception when duplicate_object then null; end $$;

create index if not exists exam_attempt_answers_attempt_uuid_idx
  on public.exam_attempt_answers(attempt_uuid);
create unique index if not exists exam_attempt_subject_stats_uuid_subject_idx
  on public.exam_attempt_subject_stats(attempt_uuid,subject_id)
  where attempt_uuid is not null and subject_id is not null;

-- ------------------------------------------------------- relational admin RLS
-- Replace JWT-metadata admin authority on tables touched by the v2 runtime.
drop policy if exists es_admin_all on public.exam_sessions;
create policy es_admin_all_v2 on public.exam_sessions
  for all to authenticated using (private.is_admin_v2()) with check (private.is_admin_v2());

drop policy if exists ea_admin_all on public.exam_attempts;
create policy ea_admin_all_v2 on public.exam_attempts
  for all to authenticated using (private.is_admin_v2()) with check (private.is_admin_v2());

drop policy if exists epp_admin_all on public.exam_proctor_policies;
create policy epp_admin_all_v2 on public.exam_proctor_policies
  for all to authenticated using (private.is_admin_v2()) with check (private.is_admin_v2());

drop policy if exists q_admin_all on public.questions;
create policy q_admin_all_v2 on public.questions
  for all to authenticated using (private.is_admin_v2()) with check (private.is_admin_v2());

drop policy if exists qbl_admin_all on public.question_blanks;
create policy qbl_admin_all_v2 on public.question_blanks
  for all to authenticated using (private.is_admin_v2()) with check (private.is_admin_v2());

drop policy if exists eab_admin_all on public.exam_attempt_answers;
create policy eab_admin_all_v2 on public.exam_attempt_answers
  for all to authenticated using (private.is_admin_v2()) with check (private.is_admin_v2());

drop policy if exists eas_admin_all on public.exam_attempt_subject_stats;
create policy eas_admin_all_v2 on public.exam_attempt_subject_stats
  for all to authenticated using (private.is_admin_v2()) with check (private.is_admin_v2());

-- -------------------------------------------------------------- exam reads
-- Exam IDs and QR payloads are locators, never permission.
drop policy if exists es_open_select on public.exam_sessions;
drop policy if exists es_teacher_select on public.exam_sessions;
drop policy if exists es_teacher_insert on public.exam_sessions;
drop policy if exists es_teacher_update on public.exam_sessions;
drop policy if exists es_teacher_delete on public.exam_sessions;
drop policy if exists exam_sessions_student_v2 on public.exam_sessions;
create policy exam_sessions_student_v2 on public.exam_sessions
  for select to authenticated using (
    private.student_is_targeted_for_exam(id,private.current_academic_profile_id())
  );
drop policy if exists exam_sessions_staff_v2 on public.exam_sessions;
create policy exam_sessions_staff_v2 on public.exam_sessions
  for select to authenticated using (
    private.staff_can_access_exam(private.current_academic_profile_id(),id)
  );

drop policy if exists exam_subjects_runtime_read on public.exam_subjects;
create policy exam_subjects_runtime_read on public.exam_subjects
  for select to authenticated using (
    private.student_is_targeted_for_exam(session_id,private.current_academic_profile_id())
    or private.staff_can_access_exam(private.current_academic_profile_id(),session_id)
  );
drop policy if exists exam_class_targets_runtime_read on public.exam_class_targets;
create policy exam_class_targets_runtime_read on public.exam_class_targets
  for select to authenticated using (
    private.student_is_targeted_for_exam(session_id,private.current_academic_profile_id())
    or private.staff_can_access_exam(private.current_academic_profile_id(),session_id)
  );
drop policy if exists exam_offering_targets_runtime_read on public.exam_offering_targets;
create policy exam_offering_targets_runtime_read on public.exam_offering_targets
  for select to authenticated using (
    private.student_is_targeted_for_exam(session_id,private.current_academic_profile_id())
    or private.staff_can_access_exam(private.current_academic_profile_id(),session_id)
  );

-- Proctor metadata follows the same audience/assignment graph.
drop policy if exists epp_open_select on public.exam_proctor_policies;
drop policy if exists epp_teacher_select on public.exam_proctor_policies;
drop policy if exists epp_teacher_write on public.exam_proctor_policies;
drop policy if exists exam_proctor_student_v2 on public.exam_proctor_policies;
create policy exam_proctor_student_v2 on public.exam_proctor_policies
  for select to authenticated using (
    private.student_is_targeted_for_exam(session_id,private.current_academic_profile_id())
  );
drop policy if exists exam_proctor_staff_v2 on public.exam_proctor_policies;
create policy exam_proctor_staff_v2 on public.exam_proctor_policies
  for select to authenticated using (
    private.staff_can_access_exam(private.current_academic_profile_id(),session_id)
  );

-- -------------------------------------------------------------- attempts
-- allocate_my_exam_attempt is the only student creation path. Final scoring is
-- server/service-role only; students cannot write score/result columns.
drop policy if exists ea_student_select on public.exam_attempts;
drop policy if exists ea_student_insert on public.exam_attempts;
drop policy if exists ea_student_update on public.exam_attempts;
drop policy if exists ea_student_profile_select_v2 on public.exam_attempts;
drop policy if exists ea_teacher_select on public.exam_attempts;
drop policy if exists ea_teacher_update on public.exam_attempts;
drop policy if exists exam_attempt_student_read_v2 on public.exam_attempts;
create policy exam_attempt_student_read_v2 on public.exam_attempts
  for select to authenticated using (
    student_profile_id = private.current_academic_profile_id()
  );
drop policy if exists exam_attempt_staff_read_v2 on public.exam_attempts;
create policy exam_attempt_staff_read_v2 on public.exam_attempts
  for select to authenticated using (
    session_id is not null
    and private.staff_can_access_exam(private.current_academic_profile_id(),session_id)
  );

-- Aggregated per-subject result statistics are safe for the owning student.
drop policy if exists eas_student_read on public.exam_attempt_subject_stats;
drop policy if exists eas_teacher_read on public.exam_attempt_subject_stats;
drop policy if exists exam_attempt_stats_student_v2 on public.exam_attempt_subject_stats;
create policy exam_attempt_stats_student_v2 on public.exam_attempt_subject_stats
  for select to authenticated using (exists(
    select 1 from public.exam_attempts a
    where a.attempt_uuid = exam_attempt_subject_stats.attempt_uuid
      and a.student_profile_id = private.current_academic_profile_id()
  ));
drop policy if exists exam_attempt_stats_staff_v2 on public.exam_attempt_subject_stats;
create policy exam_attempt_stats_staff_v2 on public.exam_attempt_subject_stats
  for select to authenticated using (exists(
    select 1 from public.exam_attempts a
    where a.attempt_uuid = exam_attempt_subject_stats.attempt_uuid
      and a.session_id is not null
      and private.staff_can_access_exam(private.current_academic_profile_id(),a.session_id)
  ));

-- Answer-bearing attempt details contain correct_answer and are staff/admin
-- only. Students receive only sanitized/aggregate result views from Server Actions.
drop policy if exists eab_student_rw on public.exam_attempt_answers;
drop policy if exists eab_teacher_read on public.exam_attempt_answers;
drop policy if exists exam_attempt_answers_student_profile_read on public.exam_attempt_answers;
drop policy if exists exam_attempt_answers_student_v2 on public.exam_attempt_answers;
drop policy if exists exam_attempt_answers_staff_v2 on public.exam_attempt_answers;
create policy exam_attempt_answers_staff_v2 on public.exam_attempt_answers
  for select to authenticated using (exists(
    select 1 from public.exam_attempts a
    where a.attempt_uuid = exam_attempt_answers.attempt_uuid
      and a.session_id is not null
      and private.staff_can_access_exam(private.current_academic_profile_id(),a.session_id)
  ));

-- -------------------------------------------------------------- questions
-- public.questions contains correct_answers. Direct student SELECT is removed.
drop policy if exists q_read on public.questions;
drop policy if exists q_teacher_insert on public.questions;
drop policy if exists q_teacher_write on public.questions;
drop policy if exists q_teacher_delete on public.questions;
drop policy if exists questions_staff_read_v2 on public.questions;
create policy questions_staff_read_v2 on public.questions
  for select to authenticated using (
    subject_id is not null
    and private.staff_can_access_subject(private.current_academic_profile_id(),subject_id)
  );
drop policy if exists questions_staff_insert_v2 on public.questions;
create policy questions_staff_insert_v2 on public.questions
  for insert to authenticated with check (
    subject_id is not null
    and private.staff_can_access_subject(private.current_academic_profile_id(),subject_id)
    and created_by_profile_id = private.current_academic_profile_id()
  );
drop policy if exists questions_staff_update_v2 on public.questions;
create policy questions_staff_update_v2 on public.questions
  for update to authenticated using (
    subject_id is not null
    and private.staff_can_access_subject(private.current_academic_profile_id(),subject_id)
    and (private.is_admin_v2() or created_by_profile_id = private.current_academic_profile_id())
  ) with check (
    subject_id is not null
    and private.staff_can_access_subject(private.current_academic_profile_id(),subject_id)
    and (private.is_admin_v2() or created_by_profile_id = private.current_academic_profile_id())
  );
drop policy if exists questions_staff_delete_v2 on public.questions;
create policy questions_staff_delete_v2 on public.questions
  for delete to authenticated using (
    subject_id is not null
    and private.staff_can_access_subject(private.current_academic_profile_id(),subject_id)
    and (private.is_admin_v2() or created_by_profile_id = private.current_academic_profile_id())
  );

drop policy if exists qbl_read on public.question_blanks;
drop policy if exists qbl_teacher_write on public.question_blanks;
drop policy if exists question_blanks_staff_read_v2 on public.question_blanks;
create policy question_blanks_staff_read_v2 on public.question_blanks
  for select to authenticated using (exists(
    select 1 from public.questions q
    where q.id=question_blanks.question_id
      and q.subject_id is not null
      and private.staff_can_access_subject(private.current_academic_profile_id(),q.subject_id)
  ));
drop policy if exists question_blanks_staff_write_v2 on public.question_blanks;
create policy question_blanks_staff_write_v2 on public.question_blanks
  for all to authenticated using (exists(
    select 1 from public.questions q
    where q.id=question_blanks.question_id
      and q.subject_id is not null
      and private.staff_can_access_subject(private.current_academic_profile_id(),q.subject_id)
      and (private.is_admin_v2() or q.created_by_profile_id=private.current_academic_profile_id())
  )) with check (exists(
    select 1 from public.questions q
    where q.id=question_blanks.question_id
      and q.subject_id is not null
      and private.staff_can_access_subject(private.current_academic_profile_id(),q.subject_id)
      and (private.is_admin_v2() or q.created_by_profile_id=private.current_academic_profile_id())
  ));

-- Runtime privileges remain narrow. RLS is still the row authorization layer.
grant select on public.exam_sessions,public.exam_subjects,public.exam_class_targets,
  public.exam_offering_targets,public.exam_proctor_policies,public.exam_attempts,
  public.exam_attempt_subject_stats to authenticated;
grant select on public.questions,public.question_blanks,public.exam_attempt_answers to authenticated;
grant select,update on public.exam_attempt_runtime_states to authenticated;
grant select,insert,update,delete on public.exam_attempt_responses_v2 to authenticated;
grant select,insert on public.exam_integrity_events_v2 to authenticated;
do $$ begin
  grant usage,select on sequence public.exam_integrity_events_v2_id_seq to authenticated;
exception when undefined_table then null; end $$;

commit;
