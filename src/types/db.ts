// PostgREST transport row contracts for the Prisma-owned public schema.
// Prisma is the database source of truth; these interfaces describe the
// snake_case rows returned by Supabase/PostgREST only.

export type MemberRole = "student" | "teacher" | "administrator";
export type RecordStatus = "active" | "inactive";
export type StudentProgressStatus = "on-track" | "promoted" | "repeating" | "graduated" | "withdrawn";
export type AcademicPeriodStatus = "planned" | "active" | "closed" | "archived";
export type AcademicTrack = "science" | "humanities" | "business";
export type SubjectKind = "curriculum" | "qualifier";
export type EnrollmentStatus = "active" | "completed" | "withdrawn" | "transferred" | "ended";
export type OfferingParticipation = "required" | "elective";
export type OfferingStatus = "draft" | "active" | "ended";
export type TeachingAssignmentRole = "teacher" | "head_teacher" | "assistant";
export type ExamMode = "qualifier" | "bece" | "waec" | "neco" | "jamb" | "mixed" | "single";
export type ExamStatus = "draft" | "open" | "closed";
export type QuestionType = "single" | "multi" | "boolean" | "fill" | "fill-multi";
export type ExamSupportCategory =
  | "Examination access"
  | "Candidate identity"
  | "Device or browser"
  | "Other examination support";

export interface SchoolMemberRow {
  id: string;
  auth_user_id: string | null;
  role: MemberRole;
  status: RecordStatus;
  first_name: string;
  last_name: string;
  student_number: string | null;
  guardian: string | null;
  phone: string | null;
  promotion_status: StudentProgressStatus | null;
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
  status: AcademicPeriodStatus;
  created_at: string;
  updated_at: string;
}

export interface AcademicTermRow {
  id: string;
  academic_year_id: string;
  name: string;
  sequence: number;
  starts_on: string | null;
  ends_on: string | null;
  status: AcademicPeriodStatus;
  created_at: string;
  updated_at: string;
}

export interface AcademicLevelRow {
  id: string;
  name: string;
  ordinal: number;
  active: boolean;
  created_at: string;
}

export interface ClassRow {
  id: string;
  level_id: string;
  track: AcademicTrack;
  academic_year_id: string;
  arm: string;
  capacity: number;
  room: string;
  status: RecordStatus;
  created_at: string;
  updated_at: string;
}

export interface ClassEnrollmentRow {
  id: string;
  student_id: string;
  class_id: string;
  status: EnrollmentStatus;
  enrolled_at: string;
  ended_at: string | null;
}

export interface SubjectRow {
  id: string;
  code: string;
  name: string;
  kind: SubjectKind;
  active: boolean;
  created_at: string;
  updated_at: string;
}

export interface SubjectCurriculumRuleRow {
  subject_id: string;
  level_id: string;
  track: AcademicTrack;
  participation: OfferingParticipation;
  created_at: string;
  updated_at: string;
}

export interface ClassSubjectOfferingRow {
  id: string;
  class_id: string;
  subject_id: string;
  status: OfferingStatus;
  created_at: string;
  updated_at: string;
}

export interface StudentSubjectEnrollmentRow {
  student_id: string;
  offering_id: string;
  status: EnrollmentStatus;
  enrolled_at: string;
  ended_at: string | null;
}

export interface StaffSubjectQualificationRow {
  staff_id: string;
  subject_id: string;
  active: boolean;
  assigned_at: string;
}

export interface TeachingAssignmentRow {
  id: string;
  staff_id: string;
  offering_id: string;
  assignment_role: TeachingAssignmentRole;
  assigned_at: string;
  ended_at: string | null;
}

export interface ExamSessionRow {
  id: string;
  title: string;
  academic_term_id: string | null;
  mode: ExamMode;
  status: ExamStatus;
  duration_seconds: number;
  question_count: number;
  instructions: string;
  starts_at: number | null;
  ends_at: number | null;
  attempt_limit: number;
  focus_monitoring: boolean;
  fullscreen_prompt: boolean;
  clipboard_guard: boolean;
  camera_required: boolean;
  warn_after: number;
  question_order: boolean;
  option_order: boolean;
  minimize_collisions: boolean;
  created_by_id: string | null;
  created_at: number;
  updated_at: number;
}

export interface ExamClassTargetRow {
  session_id: string;
  class_id: string;
  created_at: string;
}

export interface ExamOfferingTargetRow {
  session_id: string;
  offering_id: string;
  created_at: string;
}

export interface ExamPlacementTrackRow {
  session_id: string;
  track: AcademicTrack;
}

export interface ExamSessionLinkRow {
  id: string;
  session_id: string;
  token: string;
  active: boolean;
  expires_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface ExamQrCodeRow {
  id: string;
  link_id: string;
  revision: number;
  content_type: string;
  rendered_data: string | null;
  created_at: string;
  updated_at: string;
}

export interface ExamSupportRequestRow {
  id: string;
  session_id: string;
  recipient_staff_id: string;
  requester_name: string;
  category: ExamSupportCategory;
  message: string;
  created_at: string;
}

export interface ExamStaffAssignmentRow {
  session_id: string;
  staff_id: string;
  role: "cohost" | "proctor";
  assigned_at: string;
}

export interface ExamStudentAccessRow {
  session_id: string;
  student_id: string;
  decision: "allow" | "deny";
  max_attempts_override: number | null;
  valid_from: string | null;
  valid_until: string | null;
  granted_by_id: string | null;
  reason: string;
  created_at: string;
  updated_at: string;
}

export interface ExamRetakeGrantRow {
  id: string;
  session_id: string;
  student_id: string;
  additional_attempts: number;
  granted_by_id: string;
  reason: string;
  granted_at: string;
  expires_at: string | null;
  revoked_at: string | null;
}

export interface ExamAttemptContextSnapshot {
  sessionTitle?: string;
  studentName?: string;
  className?: string | null;
  academicYear?: string | null;
  academicTerm?: string | null;
  mode?: ExamMode;
  subjectNames?: string[];
}

export interface ExamAttemptRow {
  id: string;
  session_id: string;
  student_id: string;
  attempt_number: number;
  context_snapshot: ExamAttemptContextSnapshot;
  started_at: number | null;
  submitted_at: number | null;
  score: number | null;
  correct_count: number | null;
  completion: number | null;
  pace_index: number | null;
  reasoning_index: number | null;
  integrity_score: number | null;
  assigned_track: AcademicTrack | null;
  placement_confidence: number | null;
  submission_reason: string;
  rewrite_source_attempt_id: string | null;
  current_index: number;
  remaining_seconds: number | null;
  elapsed_active_seconds: number;
  last_active_at: number | null;
  paper_fingerprint: string;
  question_ids: number[];
  created_at: number;
  updated_at: number;
}

export interface ExamAttemptResponseRow {
  attempt_id: string;
  question_id: number;
  response_text: string | null;
  response_values: string[];
  seconds: number;
  flagged: boolean;
  correct: boolean | null;
  correct_answer: string | null;
  graded_at: number | null;
  updated_at: number;
}

export interface ExamIntegrityEventRow {
  id: number;
  attempt_id: string;
  type: string;
  detail: string;
  at: number;
}

export interface IntegrityEvent {
  type: string;
  detail?: string;
  at: number;
}

export interface QuestionRow {
  id: number;
  subject_id: string;
  qtype: QuestionType;
  prompt: string;
  options: string[];
  correct_answers: string[];
  fill_template: string | null;
  instruction: string;
  exam_modes: ExamMode[];
  difficulty: string;
  domain: string;
  explanation: string;
  status: RecordStatus;
  creator_id: string | null;
  created_at: string | null;
  updated_at: number;
}

export interface QuestionAcademicLevelRow {
  question_id: number;
  level_id: string;
}

export interface QuestionBlankRow {
  question_id: number;
  position: number;
  blank_key: string;
  placeholder: string;
  accepted: string[];
}

export interface WhatsappGroupRow {
  id: string;
  class_id: string;
  name: string;
  invite_url: string;
  created_at: number;
  updated_at: number;
}

export interface MemberDeletionAuditRow {
  id: string;
  target_member_id: string;
  target_role: string;
  target_name: string;
  target_student_number: string | null;
  deleted_by_id: string | null;
  reason: string;
  attempt_count: number;
  created_at: string;
}
