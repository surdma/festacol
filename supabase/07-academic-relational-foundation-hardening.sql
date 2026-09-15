-- 07-academic-relational-foundation-hardening.sql
-- Security/eligibility hardening for the v2 foundation introduced by 06.
-- Kept separate so the initial expand migration remains auditable and the
-- authorization helpers can evolve without destructive schema changes.

begin;

create or replace function private.student_allowed_attempts(
  p_session_id text,
  p_student_profile_id uuid
)
returns integer
language sql
stable
security definer
set search_path = public
as $$
  select case
    when not private.student_is_targeted_for_exam(p_session_id, p_student_profile_id) then 0
    else greatest(
      0,
      coalesce(
        (
          select esa.max_attempts_override
          from public.exam_student_access esa
          where esa.session_id = p_session_id
            and esa.student_profile_id = p_student_profile_id
            and esa.decision = 'allow'
            and (esa.valid_from is null or esa.valid_from <= now())
            and (esa.valid_until is null or esa.valid_until >= now())
        ),
        (select e.attempt_limit from public.exam_sessions e where e.id = p_session_id),
        0
      )
      + coalesce(
        (
          select sum(g.additional_attempts)::integer
          from public.exam_retake_grants g
          where g.session_id = p_session_id
            and g.student_profile_id = p_student_profile_id
            and g.revoked_at is null
            and (g.expires_at is null or g.expires_at >= now())
        ),
        0
      )
    )
  end;
$$;

-- These helpers are policy internals, not application RPCs. Do not leave
-- SECURITY DEFINER functions executable by PUBLIC.
revoke all on function private.current_academic_profile_id() from public;
revoke all on function private.student_is_targeted_for_exam(text, uuid) from public;
revoke all on function private.student_allowed_attempts(text, uuid) from public;
grant execute on function private.current_academic_profile_id() to authenticated;
grant execute on function private.student_is_targeted_for_exam(text, uuid) to authenticated;
grant execute on function private.student_allowed_attempts(text, uuid) to authenticated;

commit;
