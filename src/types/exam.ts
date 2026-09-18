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
  subjectIds: string[];
  placementTracks: string[];
  durationSeconds: number;
  questionCount: number;
  allowFillQuestions: boolean;
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

export interface ExamPaperQuestionDTO {
  id: number;
  subjectId: string;
  subject: string;
  type: QuestionType;
  prompt: string;
  options?: string[];
  fillTemplate?: { text?: string; blank?: boolean; placeholder?: string; key?: string }[];
  instruction?: string;
  domain?: string;
  requiredSelections?: number;
}

export interface QuestionDTO extends ExamPaperQuestionDTO {
  levels: ClassLevel[];
  examModes: ExamMode[];
  difficulty?: string;
  answer?: unknown;
}

export interface ExamCandidateContext {
  fullName: string;
  studentNumber: string | null;
  classLabel: string;
}

export interface ExamAccessContext {
  allowedAttempts: number;
  usedAttempts: number;
  activeAttemptId: string | null;
}

export interface ExamExperienceContext {
  session: ExamSessionDTO;
  cameraRequired: boolean;
  subjectNames: string[];
  candidate: ExamCandidateContext;
  access: ExamAccessContext;
}

export interface ExamSubjectPerformance {
  subjectId: string;
  subject: string;
  total: number;
  correct: number;
  percent: number;
  seconds: number;
}

export interface ExamResultDestination {
  kind: "placement" | "class";
  classId: string | null;
  classLabel: string;
  whatsappName: string | null;
  whatsappUrl: string | null;
}

export type ExamSubmissionReason = "manual" | "time-expired" | "exam-closed" | "potential-malpractice" | "unknown";

export interface ExamResultSummary {
  attemptId: string;
  attemptNumber: number;
  submittedAt: number;
  startedAt: number | null;
  submissionReason: ExamSubmissionReason;
  sessionTitle: string;
  candidateName: string;
  studentNumber: string | null;
  classLabel: string;
  academicSession: string;
  term: string;
  subjectNames: string[];
  destination: ExamResultDestination;
  mode: ExamMode;
  durationSeconds: number;
  questionCount: number;
  score: number;
  completion: number;
  correctCount: number;
  incorrectCount: number;
  answeredCount: number;
  unansweredCount: number;
  total: number;
  elapsedSeconds: number;
  paceIndex: number;
  reasoningIndex: number;
  subjectStats: ExamSubjectPerformance[];
  placement?: { assignedTrack: string; confidence: number };
}

export interface IntegrityEvent {
  type: string;
  detail?: string;
  at: number;
}

export interface ExamStateDTO {
  attemptUuid: string;
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
  paperFingerprint?: string;
}

export interface AttemptSummary {
  attemptUuid: string;
  sessionId: string | null;
  sessionTitle: string;
  score: number | null;
  integrityScore: number | null;
  submittedAt: number | null;
  startedAt: number | null;
}
