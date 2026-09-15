export type ClassLevel = "SS1" | "SS2" | "SS3";
export type ExamMode = "qualifier" | "bece" | "waec" | "neco" | "jamb" | "mixed" | "single";
export type ExamStatus = "open" | "draft" | "closed" | "scheduled";
export type UserRole = "student" | "teacher" | "administrator";
export type QuestionType = "single" | "multi" | "boolean" | "fill" | "fill-multi";

export interface ExamSessionDTO {
  id: string;
  title: string;
  classLevel: ClassLevel;
  classGroup: string;
  academicSession: string;
  term: string;
  mode: ExamMode;
  subjects: string[];
  placementTracks: string[];
  durationSeconds: number;
  questionCount: number;
  status: ExamStatus;
  instructions: string;
  startsAt: number | null;
  endsAt: number | null;
  integrityPolicy: {
    focusMonitoring: boolean;
    fullscreenPrompt: boolean;
    clipboardGuard: boolean;
    warnAfter: number;
  };
  randomization: {
    questionOrder: boolean;
    optionOrder: boolean;
    minimizePaperCollisions: boolean;
  };
}

export interface QuestionDTO {
  id: number;
  subjectCode: string;
  subject: string;
  type: QuestionType;
  prompt: string;
  options?: string[];
  levels: ClassLevel[];
  examModes: ExamMode[];
  fillTemplate?: { text?: string; blank?: boolean; placeholder?: string; key?: string }[];
  answer?: unknown;
}

export interface IntegrityEvent {
  type: string;
  detail?: string;
  at: number;
}

export interface ExamStateDTO {
  candidateHash: string;
  studentHash: string;
  startedAt: number;
  submittedAt: number | null;
  currentIndex: number;
  responses: Record<string, unknown>;
  flagged: string[];
  questionTimings: Record<string, number>;
  remainingSeconds: number;
  elapsedActiveSeconds: number;
  integrityEvents: IntegrityEvent[];
  questionIds: number[];
  attemptHash?: string;
  paperFingerprint?: string;
}

export interface AttemptSummary {
  attemptHash: string;
  sessionId: string | null;
  sessionTitle: string;
  score: number | null;
  integrityScore: number | null;
  submittedAt: number | null;
  startedAt: number | null;
}
