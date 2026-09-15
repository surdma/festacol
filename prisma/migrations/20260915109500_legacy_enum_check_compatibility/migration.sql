-- Legacy Supabase tables represented finite values as text columns guarded by
-- CHECK constraints. Relational v3 converts the same columns to native
-- PostgreSQL enums. Drop only those enum-emulation checks before ALTER TYPE;
-- range and other business-rule checks remain intact.
ALTER TABLE public.classes
  DROP CONSTRAINT IF EXISTS classes_status_check;

ALTER TABLE public.academic_profiles
  DROP CONSTRAINT IF EXISTS academic_profiles_role_check,
  DROP CONSTRAINT IF EXISTS academic_profiles_status_check;

ALTER TABLE public.academic_years
  DROP CONSTRAINT IF EXISTS academic_years_status_check;

ALTER TABLE public.academic_terms
  DROP CONSTRAINT IF EXISTS academic_terms_status_check;

ALTER TABLE public.exam_sessions
  DROP CONSTRAINT IF EXISTS exam_sessions_mode_check,
  DROP CONSTRAINT IF EXISTS exam_sessions_status_check;

ALTER TABLE public.exam_staff_assignments
  DROP CONSTRAINT IF EXISTS exam_staff_assignments_role_check;

ALTER TABLE public.exam_student_access
  DROP CONSTRAINT IF EXISTS exam_student_access_decision_check;

ALTER TABLE public.questions
  DROP CONSTRAINT IF EXISTS questions_qtype_check;
