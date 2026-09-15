// Supabase/PostgREST row contracts for the production schema.
// Supabase auth.users remains the login authority. AcademicProfileRow and the
// related v2 rows are application-domain records, not duplicate auth users.
// Legacy row contracts stay during the expand/migrate sequence until all
// runtime consumers move to the relational graph.

export interface ClassRow {
  id: string;
  class_level: string;
  name: string;
  stream: string;
  grp: string;
  arm: string;
  capacity: number;
  room: string;
  academic_session: string;
  status: string;
}

export interface SubjectRow {
  code: string;
  name: string;
  category: string;
  streams: string[];
  active: boolean;
  updated_at: number;
}

/** @deprecated Runtime compatibility row. Prefer AcademicProfileRow + role extension. */
export interface UserRow {
  id: string;
  full_name: string;
  first_name: string;
  last_name: string;
  class_id: string | null;
  role: string;
  status: string;
  guardian: string;
  academic_session: string;
  promotion_status: string;
  joined_at: number;
  auth_user_id: string | null;
  email: string;
  subjects: string[];
  qualifier_access: boolean;
}

export interface AcademicProfileRow {
  id: string;
  auth_user_id: string | null;
  legacy_user_id: string | null;
  role: "student" | "teacher" | "administrator";
  status: "active" | "inactive";
  full_name: string;
  first_name: string;
  last_name: string;
  email: string;
  created_at: string;
  updated_at: string;
}

export interface StudentAcademicProfileRow {
  profile_id: string;
  student_number: string | null;
  guardian: string;
  phone: string;
  promotion_status: string;
  created_at: string;
  updated_at: string;
}

export interface StaffAcademicProfileRow {
  profile_id: string;
  staff_number: string | null;
  qualifier_access: boolean;
  created_at: string;
  updated_at: string;
}

export interface AcademicYearRow {
  id: string;
  name: string;
  starts_on: string | null;
  ends_on: string | null;
  status: string;
  created_at: string;
}

export interface AcademicTermRow {
  id: string;
  academic_year_id: string;
  name: string;
  sequence: number;
  starts_on: string | null;
  ends_on: string | null;
  status: string;
  created_at: string;
}

export interface ClassEnrollmentRow {
  id: string;
  student_profile_id: string;
  class_id: string;
  academic_year_id: string;
  status: string;
  enrolled_at: string;
  ended_at: string | null;
}

export interface StaffSubjectQualificationRow {
  staff_profile_id: string;
  subject_code: string;
  active: boolean;
  assigned_at: string;
}

export interface TeachingAssignmentRow {
  id: string;
  staff_profile_id: string;
  class_id: string;
  subject_code: string;
  academic_year_id: string;
  academic_term_id: string | null;
  assignment_role: string;
  status: string;
  assigned_at: string;
  ended_at: string | null;
}

/** @deprecated Name-hash login profile retained only during v2 migration. */
export interface StudentProfileRow {
  student_hash: string;
  candidate_hash: string;
  first_name: string;
  last_name: string;
  full_name: string;
  phone: string;
  guardian: string;
  current_class_id: string;
  academic_session: string;
  updated_at: number;
}

export interface ExamSessionRow {
  id: string;
  title: string;
  class_level: string;
  class_group: string;
  academic_session: string;
  term: string;
  mode: string;
  subjects: string[];
  placement_tracks: string[];
  duration_seconds: number;
  question_count: number;
  status: string;
  instructions: string;
  starts_at: number | null;
  ends_at: number | null;
  attempt_limit: number;
  focus_monitoring: boolean;
  fullscreen_prompt: boolean;
  clipboard_guard: boolean;
  warn_after: number;
  question_order: boolean;
  option_order: boolean;
  minimize_collisions: boolean;
  cohosts: string[];
  created_at: number;
  updated_at: number;
  created_by_profile_id: string | null;
  academic_term_id: string | null;
}

export interface ExamSubjectRow {
  session_id: string;
  subject_code: string;
  position: number;
}

export interface ExamClassTargetRow {
  session_id: string;
  class_id: string;
  created_at: string;
}

export interface ExamStaffAssignmentRow {
  session_id: string;
  staff_profile_id: string;
  role: "creator" | "cohost" | "proctor";
  assigned_at: string;
}

export interface ExamStudentAccessRow {
  session_id: string;
  student_profile_id: string;
  decision: "allow" | "deny";
  max_attempts_override: number | null;
  valid_from: string | null;
  valid_until: string | null;
  granted_by_profile_id: string | null;
  reason: string;
  created_at: string;
  updated_at: string;
}

export interface ExamRetakeGrantRow {
  id: string;
  session_id: string;
  student_profile_id: string;
  additional_attempts: number;
  granted_by_profile_id: string;
  reason: string;
  granted_at: string;
  expires_at: string | null;
  revoked_at: string | null;
}

export interface IntegrityEvent {
  type: string;
  detail?: string;
  at: number;
}

export interface ExamAttemptRow {
  id: string;
  attempt_hash: string;
  attempt_uuid: string;
  student_profile_id: string | null;
  attempt_number: number | null;
  candidate_hash: string;
  student_hash: string;
  paper_fingerprint: string;
  session_id: string | null;
  session_title: string;
  first_name: string;
  last_name: string;
  student_name: string;
  class_level: string;
  class_group: string;
  academic_session: string;
  mode: string;
  session_status: string;
  session_ends_at: number | null;
  started_at: number | null;
  submitted_at: number | null;
  remaining_seconds: number | null;
  elapsed_active_seconds: number;
  answered: number;
  question_count: number;
  score: number | null;
  correct_count: number | null;
  completion: number | null;
  pace_index: number | null;
  reasoning_index: number | null;
  integrity_score: number | null;
  assigned_track: string | null;
  placement_confidence: number | null;
  submission_reason: string;
  rewrite_archived_at: number | null;
  rewrite_source_attempt_hash: string;
  created_at: number;
}

export interface ExamAttemptAnswerRow {
  id: number;
  attempt_hash: string;
  session_id: string | null;
  candidate_hash: string;
  question_id: number | null;
  subject_code: string;
  subject_name: string;
  correct: boolean | null;
  response_text: string | null;
  response_values: string[];
  correct_answer: string;
  seconds: number;
}

export interface ExamAttemptSubjectStatRow {
  attempt_hash: string;
  subject_code: string;
  subject_name: string;
  total: number;
  correct: number;
  seconds: number;
  percent: number;
}

export interface ExamIntegrityEventRow {
  id: number;
  session_id: string;
  candidate_hash: string;
  attempt_hash: string | null;
  type: string;
  detail: string;
  at: number;
}

export interface ExamStateRow {
  session_id: string;
  candidate_hash: string;
  started_at: number | null;
  submitted_at: number | null;
  current_index: number;
  remaining_seconds: number;
  elapsed_active_seconds: number;
  last_active_at: number | null;
  attempt_hash: string;
  paper_fingerprint: string;
  question_ids: number[];
  updated_at: number;
}

export interface ExamResponseRow {
  session_id: string;
  candidate_hash: string;
  question_id: number;
  response_text: string | null;
  response_values: string[];
  seconds: number;
  flagged: boolean;
}

export interface QuestionRow {
  id: number;
  subject_code: string;
  subject_name: string;
  label: string;
  qtype: string;
  prompt: string;
  options: string[];
  correct_answers: string[];
  fill_template: string | null;
  instruction: string;
  levels: string[];
  exam_modes: string[];
  difficulty: string;
  domain: string;
  explanation: string;
  created_by: string | null;
  created_by_profile_id: string | null;
  created_at: string | null;
  updated_at: number;
}

export interface QuestionBlankRow {
  question_id: number;
  position: number;
  blank_key: string;
  placeholder: string;
  accepted: string[];
}

export interface LegacyStudentIdentityLinkRow {
  student_hash: string;
  student_profile_id: string;
  link_method: "unique_normalized_name" | "manual";
  linked_at: string;
}

export interface SchemaMigrationIssueRow {
  id: number;
  issue_key: string;
  entity_type: string;
  entity_key: string;
  issue_type: string;
  detail: string;
  resolved_at: string | null;
  created_at: string;
}
