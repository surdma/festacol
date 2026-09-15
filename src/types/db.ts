// Supabase/PostgREST row contracts for the normalized production schema.
// Keep these snake_case interfaces field-for-field aligned with
// prisma/schema.prisma and supabase/schema.sql. They intentionally do not
// import the generated Prisma client so `pnpm dev` does not depend on a prior
// `prisma generate` merely to resolve application types.

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
}

export interface IntegrityEvent {
  type: string;
  detail?: string;
  at: number;
}

export interface ExamAttemptRow {
  id: string;
  attempt_hash: string;
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
  updated_at: number;
}

export interface QuestionBlankRow {
  question_id: number;
  position: number;
  blank_key: string;
  placeholder: string;
  accepted: string[];
}
