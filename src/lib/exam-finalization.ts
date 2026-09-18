import { paperFromQuestionIds, scoreAttempt } from "@/lib/assessment";
import { loadQuestionPayload } from "@/lib/questions";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import type { AcademicTrack, ExamAttemptContextSnapshot } from "@/types/db";
import type { ExamSessionDTO, QuestionDTO } from "@/types/exam";

export type ExamSubmissionReason = "manual" | "time-expired" | "exam-closed" | "potential-malpractice";

export interface AttemptClockState {
  started_at: number | null;
  last_active_at: number | null;
  remaining_seconds: number | null;
  elapsed_active_seconds: number;
  context_snapshot?: ExamAttemptContextSnapshot | null;
}

export interface FinalizationSummary {
  accuracy: number;
  completion: number;
  paceIndex: number;
  reasoningIndex: number;
  integrityScore: number;
  correctCount: number;
  total: number;
  placement?: { assignedTrack: string; confidence: number };
}

type FinalizationResult =
  | { ok: true; summary: FinalizationSummary }
  | { ok: false; code: "already-submitted" | "unavailable"; error: string };

interface AttemptRow extends AttemptClockState {
  id: string;
  student_id: string;
  submitted_at: number | null;
  question_ids: number[];
}

interface ResponseRow {
  question_id: number;
  response_text: string | null;
  response_values: string[];
  seconds: number;
  flagged: boolean;
}

function joinResponse(text: unknown, values: unknown): unknown {
  const list = Array.isArray(values) ? values.map(String) : [];
  if (list.length) return list;
  if (typeof text !== "string") return null;
  if (text === "true" || text === "false") return text === "true";
  const trimmed = text.trim();
  if (trimmed.startsWith("{") && trimmed.endsWith("}")) {
    try {
      const parsed = JSON.parse(trimmed) as unknown;
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) return parsed;
    } catch {
      // Text responses may legitimately contain braces.
    }
  }
  return text;
}

function responseForQuestion(response: ResponseRow, question: QuestionDTO | undefined): unknown {
  const decoded = joinResponse(response.response_text, response.response_values);
  if (!question || (question.type !== "fill" && question.type !== "fill-multi")) return decoded;
  if (decoded && typeof decoded === "object" && !Array.isArray(decoded)) return decoded;

  const blankKeys = (question.fillTemplate ?? [])
    .filter((part) => part.blank)
    .map((part, index) => part.key ?? `b${index}`);
  if (!blankKeys.length) return decoded;
  if (Array.isArray(decoded)) {
    return Object.fromEntries(blankKeys.map((key, index) => [key, String(decoded[index] ?? "")]));
  }
  if (decoded === null || decoded === undefined) return {};
  return { [blankKeys[0]]: String(decoded) };
}

function splitResponse(value: unknown): { text: string | null; values: string[] } {
  if (typeof value === "string") return { text: value, values: [] };
  if (typeof value === "boolean") return { text: String(value), values: [] };
  if (Array.isArray(value)) return { text: null, values: value.map(String) };
  if (value && typeof value === "object") return { text: JSON.stringify(value), values: [] };
  return { text: null, values: [] };
}

function serializeAnswer(question: QuestionDTO | undefined): string {
  const answer = (question as { answer?: unknown } | undefined)?.answer;
  if (Array.isArray(answer)) return answer.map(String).join(", ");
  if (answer && typeof answer === "object") return JSON.stringify(answer);
  return String(answer ?? "");
}

function placementTrack(value: string | undefined): AcademicTrack | null {
  if (value === "Science") return "science";
  if (value === "Humanities") return "humanities";
  if (value === "Business") return "business";
  return null;
}

export function attemptDurationSeconds(state: AttemptClockState, session: ExamSessionDTO): number {
  const snapshotDuration = Number(state.context_snapshot?.durationSeconds ?? 0);
  if (Number.isFinite(snapshotDuration) && snapshotDuration > 0) return Math.round(snapshotDuration);

  // Backwards compatibility for attempts allocated before duration snapshots existed.
  // The persisted trusted clock fields preserve the original attempt budget.
  const persistedBudget =
    Math.max(0, Number(state.remaining_seconds ?? 0)) +
    Math.max(0, Number(state.elapsed_active_seconds ?? 0));
  if (Number.isFinite(persistedBudget) && persistedBudget > 0) return Math.round(persistedBudget);

  return Math.max(0, Number(session.durationSeconds) || 0);
}

export function authoritativeAttemptClock(
  state: AttemptClockState,
  session: ExamSessionDTO,
  now = Date.now(),
) {
  const startedAt = Number(state.started_at ?? state.last_active_at ?? now);
  const durationMs = attemptDurationSeconds(state, session) * 1000;
  const durationDeadline = startedAt + durationMs;
  const configuredEnd = session.endsAt === null ? Number.POSITIVE_INFINITY : Number(session.endsAt);
  const deadline = Math.min(durationDeadline, configuredEnd);
  const boundedNow = Math.min(now, Math.max(startedAt, deadline));

  return {
    remainingSeconds: Math.max(0, Math.ceil((deadline - now) / 1000)),
    elapsedActiveSeconds: Math.max(0, (boundedNow - startedAt) / 1000),
    overdueSeconds: Math.max(0, (now - deadline) / 1000),
  };
}

function sessionForAttempt(state: AttemptRow, session: ExamSessionDTO): ExamSessionDTO {
  return {
    ...session,
    durationSeconds: attemptDurationSeconds(state, session),
    questionCount: state.question_ids.length || Number(state.context_snapshot?.questionCount ?? session.questionCount),
    allowFillQuestions: state.context_snapshot?.allowFillQuestions ?? session.allowFillQuestions,
  };
}

export async function finalizeExamAttempt(input: {
  session: ExamSessionDTO;
  attemptId: string;
  studentId: string;
  reason: ExamSubmissionReason;
}): Promise<FinalizationResult> {
  const admin = createSupabaseAdminClient();
  const [
    { data: attemptData, error: attemptError },
    { data: responseData, error: responseError },
    { data: integrityData, error: integrityError },
  ] = await Promise.all([
    admin
      .from("exam_attempts")
      .select("id,student_id,started_at,submitted_at,remaining_seconds,elapsed_active_seconds,last_active_at,context_snapshot,question_ids")
      .eq("id", input.attemptId)
      .eq("student_id", input.studentId)
      .maybeSingle(),
    admin
      .from("exam_attempt_responses")
      .select("question_id,response_text,response_values,seconds,flagged")
      .eq("attempt_id", input.attemptId),
    admin
      .from("exam_integrity_events")
      .select("type")
      .eq("attempt_id", input.attemptId),
  ]);

  if (attemptError || responseError || integrityError || !attemptData) {
    return { ok: false, code: "unavailable", error: "Attempt state could not be loaded for final submission." };
  }

  const attempt = attemptData as AttemptRow;
  if (attempt.submitted_at) {
    return { ok: false, code: "already-submitted", error: "This attempt has already been submitted." };
  }

  const scoringSession = sessionForAttempt(attempt, input.session);
  const payload = await loadQuestionPayload();
  const paper = attempt.question_ids.length
    ? paperFromQuestionIds({ questions: payload.questions }, scoringSession, attempt.id, attempt.question_ids)
    : [];
  if (!paper.length) {
    return { ok: false, code: "unavailable", error: "Attempt paper is unavailable." };
  }

  const responses = (responseData ?? []) as ResponseRow[];
  const questionById = new Map(paper.map((question) => [question.id, question]));
  const answerMap: Record<string, unknown> = {};
  const timings: Record<string, number> = {};
  const flaggedByQuestion = new Map<number, boolean>();
  for (const response of responses) {
    answerMap[String(response.question_id)] = responseForQuestion(response, questionById.get(response.question_id));
    timings[String(response.question_id)] = Math.max(0, Number(response.seconds ?? 0));
    flaggedByQuestion.set(Number(response.question_id), response.flagged);
  }

  const clock = authoritativeAttemptClock(attempt, scoringSession);
  const result = scoreAttempt(
    paper,
    {
      responses: answerMap,
      questionTimings: timings,
      elapsedActiveSeconds: clock.elapsedActiveSeconds,
      startedAt: attempt.started_at ?? Date.now(),
      submittedAt: null,
      integrityEvents: ((integrityData ?? []) as { type: string }[]).map((event) => ({ type: event.type })),
    },
    scoringSession,
  ) as unknown as {
    accuracy: number;
    completion: number;
    paceIndex: number;
    reasoningIndex: number;
    integrityScore: number;
    correctCount: number;
    details: {
      questionId: number;
      subjectId: string;
      subject: string;
      correct: boolean | null;
      response: unknown;
      seconds: number;
    }[];
    placement?: { assignedTrack: string; confidence: number };
  };

  const now = Date.now();
  const effectiveReason: ExamSubmissionReason =
    input.reason === "potential-malpractice"
      ? "potential-malpractice"
      : input.reason === "exam-closed" || input.session.status !== "open"
        ? "exam-closed"
        : clock.remainingSeconds <= 0
          ? "time-expired"
          : input.reason;

  const { data: updated, error: updateError } = await admin
    .from("exam_attempts")
    .update({
      submitted_at: now,
      score: result.accuracy,
      correct_count: result.correctCount,
      completion: result.completion,
      pace_index: result.paceIndex,
      reasoning_index: result.reasoningIndex,
      integrity_score: result.integrityScore,
      assigned_track: placementTrack(result.placement?.assignedTrack),
      placement_confidence: result.placement?.confidence ?? null,
      submission_reason: effectiveReason,
      remaining_seconds: clock.remainingSeconds,
      elapsed_active_seconds: clock.elapsedActiveSeconds,
      last_active_at: now,
      updated_at: now,
    })
    .eq("id", attempt.id)
    .eq("student_id", input.studentId)
    .is("submitted_at", null)
    .select("id")
    .maybeSingle();

  if (updateError) return { ok: false, code: "unavailable", error: updateError.message };
  if (!updated) return { ok: false, code: "already-submitted", error: "This attempt has already been submitted." };

  if (result.details.length) {
    const gradedRows = result.details.map((detail) => {
      const response = splitResponse(detail.response);
      const question = paper.find((item) => item.id === detail.questionId);
      return {
        attempt_id: attempt.id,
        question_id: detail.questionId,
        response_text: response.text,
        response_values: response.values,
        seconds: detail.seconds,
        flagged: flaggedByQuestion.get(detail.questionId) ?? false,
        correct: detail.correct,
        correct_answer: serializeAnswer(question),
        graded_at: now,
        updated_at: now,
      };
    });
    const writeGrading = () =>
      admin.from("exam_attempt_responses").upsert(gradedRows, { onConflict: "attempt_id,question_id" });
    const firstWrite = await writeGrading();
    if (firstWrite.error) {
      const retryWrite = await writeGrading();
      if (retryWrite.error) {
        console.error("Submitted attempt grading details could not be persisted", {
          attemptId: attempt.id,
          sessionId: input.session.id,
          error: retryWrite.error.message,
        });
      }
    }
  }

  return {
    ok: true,
    summary: {
      accuracy: result.accuracy,
      completion: result.completion,
      paceIndex: result.paceIndex,
      reasoningIndex: result.reasoningIndex,
      integrityScore: result.integrityScore,
      correctCount: result.correctCount,
      total: paper.length,
      placement: result.placement,
    },
  };
}

export async function finalizeActiveExamAttemptsForSession(
  session: ExamSessionDTO,
): Promise<{ ok: boolean; finalized: number; failedAttemptIds: string[]; error?: string }> {
  const admin = createSupabaseAdminClient();
  const { data, error } = await admin
    .from("exam_attempts")
    .select("id,student_id")
    .eq("session_id", session.id)
    .is("submitted_at", null);

  if (error) {
    return { ok: false, finalized: 0, failedAttemptIds: [], error: error.message };
  }

  const active = (data ?? []) as { id: string; student_id: string }[];
  let finalized = 0;
  const failedAttemptIds: string[] = [];

  // Keep close operations bounded while still finalizing candidates concurrently.
  for (let index = 0; index < active.length; index += 8) {
    const batch = active.slice(index, index + 8);
    const results = await Promise.all(
      batch.map((attempt) =>
        finalizeExamAttempt({
          session,
          attemptId: attempt.id,
          studentId: attempt.student_id,
          reason: "exam-closed",
        }),
      ),
    );
    results.forEach((result, resultIndex) => {
      if (result.ok || result.code === "already-submitted") finalized += 1;
      else failedAttemptIds.push(batch[resultIndex].id);
    });
  }

  return {
    ok: failedAttemptIds.length === 0,
    finalized,
    failedAttemptIds,
    error: failedAttemptIds.length
      ? `${failedAttemptIds.length} active attempt${failedAttemptIds.length === 1 ? "" : "s"} could not be finalized automatically.`
      : undefined,
  };
}
