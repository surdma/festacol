// Supabase row types (snake_case, mirrors prototype/supabase/schema.sql).
// Runtime reads/writes go through Supabase PostgREST + Realtime.
// Prisma (prisma/schema.prisma) is migration-only — never imported in src/.

export interface ClassRow {
  id: string;
  class_level: string;
  name: string;
  stream: string;
  grp: string;
  capacity: number;
  room: string;
  academic_session: string;
  status: string;
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
  integrity_policy: Record<string, unknown>;
  randomization: Record<string, unknown>;
  cohosts: string[];
  created_at: number;
  updated_at: number;
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
  subjects: string[];
  started_at: number | null;
  submitted_at: number | null;
  score: number | null;
  integrity_score: number | null;
  integrity_events: { type: string; detail?: string; at: number }[];
  created_at: number;
}

export interface ExamStateRow {
  session_id: string;
  candidate_hash: string;
  state: { integrityEvents?: { type: string; detail?: string; at: number }[] } & Record<string, unknown>;
  updated_at: number;
}

export interface QuestionRow {
  id: number;
  origin: string;
  data: { prompt?: string } & Record<string, unknown>;
  subject_code: string;
  updated_at: number;
}
