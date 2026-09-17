"use server";

import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { currentStudent } from "@/lib/auth/current-student";
import { loadExamRuntimeSession } from "@/lib/exam-session";
import { loadQuestionPayload, sanitizePaper } from "@/lib/questions";
import { effectiveStatus, hashText, paperForStudent, paperFromQuestionIds, scoreAttempt } from "@/lib/assessment";
import type { AcademicTrack } from "@/types/db";
import type { ExamSessionDTO, QuestionDTO } from "@/types/exam";

export type PaperStatus =
  | { status: "ready"; paper: Omit<QuestionDTO, "answer">[]; remainingSeconds: number; currentIndex: number; responses: Record<string, unknown>; flagged: string[]; cameraRequired: boolean }
  | { status: "locked"; score: number | null }
  | { status: "unavailable"; error: string };

export type SaveProgressResult =
  | { ok: true }
  | { ok: false; error: string };

interface RuntimeState {
  id: string;
  current_index: number;
  remaining_seconds: number | null;
  elapsed_active_seconds: number;
  last_active_at: number | null;
  paper_fingerprint: string;
  question_ids: number[];
  updated_at: number;
}

interface RuntimeResponse {
  question_id: number;
  response_text: string | null;
  response_values: string[];
  seconds: number;
  flagged: boolean;
}

interface AttemptRow {
  id: string;
  attempt_number: number;
  started_at: number | null;
  submitted_at: number | null;
  score: number | null;
}

type AllocationResult =
  | { ok: true; row: { attempt_id: string; attempt_number: number; resumed: boolean } }
  | { ok: false; error: string };

async function sessionDTO(id: string): Promise<{ session: ExamSessionDTO; cameraRequired: boolean } | null> {
  const supabase = await createSupabaseServerClient();
  return loadExamRuntimeSession(supabase, id);
}

async function latestAttempt(sessionId: string): Promise<AttemptRow | null> {
  const ctx = await currentStudent();
  if (!ctx) return null;
  const { data } = await ctx.supabase
    .from("exam_attempts")
    .select("id,attempt_number,started_at,submitted_at,score")
    .eq("session_id", sessionId.toUpperCase())
    .eq("student_id", ctx.profile.profile_id)
    .order("attempt_number", { ascending: false })
    .limit(1)
    .maybeSingle();
  return (data ?? null) as AttemptRow | null;
}

async function allocateAttempt(sessionId: string): Promise<AllocationResult> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.rpc("allocate_my_exam_attempt", { p_session_id: sessionId.toUpperCase() });
  if (error) return { ok: false, error: error.message };
  const row = (Array.isArray(data) ? data[0] : data) as { attempt_id: string; attempt_number: number; resumed: boolean } | null;
  return row ? { ok: true, row } : { ok: false, error: "Attempt could not be allocated." };
}

function splitResponse(value: unknown): { text: string | null; values: string[] } {
  if (typeof value === "string") return { text: value, values: [] };
  if (typeof value === "boolean") return { text: String(value), values: [] };
  if (Array.isArray(value)) return { text: null, values: value.map(String) };
  if (value && typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>).sort(([a], [b]) => a.localeCompare(b));
    if (entries.length === 1) {
      const item = entries[0][1];
      return Array.isArray(item) ? { text: null, values: item.map(String) } : { text: String(item ?? ""), values: [] };
    }
    return { text: null, values: entries.map(([, item]) => String(item ?? "")) };
  }
  return { text: null, values: [] };
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
      // A text answer may legitimately contain braces. Keep it as text when it is not JSON.
    }
  }
  return text;
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

async function stateForAttempt(attemptId: string) {
  const supabase = await createSupabaseServerClient();
  const [{ data: state }, { data: responses }] = await Promise.all([
    supabase
      .from("exam_attempts")
      .select("id,current_index,remaining_seconds,elapsed_active_seconds,last_active_at,paper_fingerprint,question_ids,updated_at")
      .eq("id", attemptId)
      .maybeSingle(),
    supabase.from("exam_attempt_responses").select("question_id,response_text,response_values,seconds,flagged").eq("attempt_id", attemptId),
  ]);
  return {
    state: (state ?? null) as RuntimeState | null,
    responses: (responses ?? []) as RuntimeResponse[],
  };
}

function accessErrorMessage(message: string): string {
  if (message.includes("attempt_limit_reached")) return "You have used all allowed attempts for this examination.";
  if (message.includes("student_not_qualified")) return "Your current level does not qualify for this examination.";
  if (message.includes("student_not_eligible")) return "This examination is not assigned to you.";
  if (message.includes("exam_not_started")) return "This examination has not started yet.";
  if (message.includes("exam_ended")) return "This examination has closed.";
  if (message.includes("exam_not_open")) return "This examination is not open.";
  return "This examination is unavailable.";
}

export async function getExamPaperAction(sessionId: string): Promise<PaperStatus> {
  if (!(await currentStudent())) return { status: "unavailable", error: "Sign in to open this exam." };
  const runtimeSession = await sessionDTO(sessionId);
  if (!runtimeSession) return { status: "unavailable", error: "Exam not found or not assigned to you." };
  const { session, cameraRequired } = runtimeSession;
  const status = effectiveStatus(session);
  if (status !== "open") return { status: "unavailable", error: `Session unavailable: ${status}.` };

  const allocation = await allocateAttempt(session.id);
  if (!allocation.ok) {
    if (allocation.error.includes("attempt_limit_reached")) {
      const previous = await latestAttempt(session.id);
      return { status: "locked", score: previous?.score ?? null };
    }
    return { status: "unavailable", error: accessErrorMessage(allocation.error) };
  }

  const attemptId = allocation.row.attempt_id;
  const { state, responses: savedResponses } = await stateForAttempt(attemptId);
  if (!state) return { status: "unavailable", error: "Attempt state is unavailable." };

  const now = Date.now();
  const lastActiveAt = Number(state.last_active_at ?? now);
  const awaySeconds = Math.max(0, Math.floor((now - lastActiveAt) / 1000));
  const remaining = Math.max(0, Number(state.remaining_seconds ?? session.durationSeconds) - awaySeconds);
  const reconciledElapsed = Math.max(0, Number(state.elapsed_active_seconds ?? 0) + awaySeconds);
  if (remaining <= 0) {
    const supabase = await createSupabaseServerClient();
    await supabase.from("exam_attempts").update({
      remaining_seconds: 0,
      elapsed_active_seconds: reconciledElapsed,
      last_active_at: now,
      updated_at: now,
    }).eq("id", attemptId);
    const submitted = await submitExamAction(session.id, "time-expired");
    return submitted.ok
      ? { status: "locked", score: submitted.summary?.accuracy ?? null }
      : { status: "unavailable", error: submitted.error ?? "Time expired." };
  }

  const payload = await loadQuestionPayload();
  if (!payload.questions.length) return { status: "unavailable", error: "Question bank is empty." };
  const paper = state.question_ids.length
    ? paperFromQuestionIds({ questions: payload.questions }, session, attemptId, state.question_ids)
    : paperForStudent({ questions: payload.questions }, session, attemptId);
  if (!paper.length) return { status: "unavailable", error: "No questions match this exam." };

  const fingerprint = state.paper_fingerprint || await hashText(
    `${session.id}|${attemptId}|${paper.map((question) => `${question.id}:${(question.options ?? []).join("~")}`).join("|")}`,
  );
  const supabase = await createSupabaseServerClient();
  const { error: stateError } = await supabase.from("exam_attempts").update({
    remaining_seconds: remaining,
    elapsed_active_seconds: reconciledElapsed,
    last_active_at: now,
    paper_fingerprint: fingerprint,
    question_ids: state.question_ids.length ? state.question_ids : paper.map((question) => question.id),
    updated_at: now,
  }).eq("id", attemptId);
  if (stateError) return { status: "unavailable", error: "Attempt state could not be saved." };

  const responses: Record<string, unknown> = {};
  const flagged: string[] = [];
  for (const response of savedResponses) {
    responses[String(response.question_id)] = joinResponse(response.response_text, response.response_values);
    if (response.flagged) flagged.push(String(response.question_id));
  }
  return {
    status: "ready",
    paper: sanitizePaper(paper),
    remainingSeconds: remaining,
    currentIndex: Math.min(state.current_index, Math.max(0, paper.length - 1)),
    responses,
    flagged,
    cameraRequired,
  };
}

export async function saveProgressAction(
  sessionId: string,
  patch: { responses: Record<string, unknown>; currentIndex: number; questionTimings: Record<string, number>; remainingSeconds: number; elapsedActiveSeconds: number; flagged: string[] },
): Promise<SaveProgressResult> {
  const attempt = await latestAttempt(sessionId);
  if (!attempt) return { ok: false, error: "No active attempt is available to save." };
  if (attempt.submitted_at) return { ok: false, error: "This attempt has already been submitted." };

  const supabase = await createSupabaseServerClient();
  const now = Date.now();
  const { error: stateError } = await supabase.from("exam_attempts").update({
    current_index: Math.max(0, patch.currentIndex),
    remaining_seconds: Math.max(0, Math.round(patch.remainingSeconds)),
    elapsed_active_seconds: Math.max(0, patch.elapsedActiveSeconds),
    last_active_at: now,
    updated_at: now,
  }).eq("id", attempt.id);
  if (stateError) return { ok: false, error: "Your exam progress could not be saved." };

  const flagged = new Set(patch.flagged);
  const rows = Object.entries(patch.responses).map(([questionId, value]) => {
    const response = splitResponse(value);
    return {
      attempt_id: attempt.id,
      question_id: Number(questionId),
      response_text: response.text,
      response_values: response.values,
      seconds: Math.max(0, Number(patch.questionTimings[questionId] ?? 0)),
      flagged: flagged.has(questionId),
      updated_at: now,
    };
  });
  if (rows.length) {
    const { error: responseError } = await supabase.from("exam_attempt_responses").upsert(rows, { onConflict: "attempt_id,question_id" });
    if (responseError) return { ok: false, error: "Your answers could not be saved." };
  }

  return { ok: true };
}

export interface SubmitSummary {
  accuracy: number;
  completion: number;
  paceIndex: number;
  reasoningIndex: number;
  integrityScore: number;
  correctCount: number;
  total: number;
  placement?: { assignedTrack: string; confidence: number };
}

export async function submitExamAction(sessionId: string, reason: string): Promise<{ ok: boolean; summary?: SubmitSummary; error?: string }> {
  const ctx = await currentStudent();
  if (!ctx) return { ok: false, error: "Sign in required." };
  const runtimeSession = await sessionDTO(sessionId);
  if (!runtimeSession) return { ok: false, error: "Exam not found or not assigned to you." };
  const { session } = runtimeSession;
  const attempt = await latestAttempt(session.id);
  if (!attempt || attempt.submitted_at) return { ok: false, error: attempt?.submitted_at ? "Already submitted." : "No active attempt." };
  const { state, responses: savedResponses } = await stateForAttempt(attempt.id);
  if (!state) return { ok: false, error: "Attempt state is unavailable." };

  const responses: Record<string, unknown> = {};
  const timings: Record<string, number> = {};
  const flaggedByQuestion = new Map<number, boolean>();
  for (const response of savedResponses) {
    responses[String(response.question_id)] = joinResponse(response.response_text, response.response_values);
    timings[String(response.question_id)] = Number(response.seconds ?? 0);
    flaggedByQuestion.set(Number(response.question_id), response.flagged);
  }
  const admin = createSupabaseAdminClient();
  const { data: integrityRows } = await admin.from("exam_integrity_events").select("type,detail,at").eq("attempt_id", attempt.id).order("at");
  const events = ((integrityRows ?? []) as { type: string; detail: string; at: number }[]).map((event) => ({ type: event.type }));
  const payload = await loadQuestionPayload();
  const paper = state.question_ids.length
    ? paperFromQuestionIds({ questions: payload.questions }, session, attempt.id, state.question_ids)
    : paperForStudent({ questions: payload.questions }, session, attempt.id);
  if (!paper.length) return { ok: false, error: "Attempt paper is unavailable." };

  const result = scoreAttempt(paper, {
    responses,
    questionTimings: timings,
    elapsedActiveSeconds: state.elapsed_active_seconds,
    startedAt: attempt.started_at ?? Date.now(),
    submittedAt: null,
    integrityEvents: events,
  }, session) as unknown as {
    accuracy: number; completion: number; paceIndex: number; reasoningIndex: number;
    integrityScore: number; correctCount: number;
    details: { questionId: number; subjectId: string; subject: string; correct: boolean | null; response: unknown; seconds: number }[];
    placement?: { assignedTrack: string; confidence: number };
  };
  const now = Date.now();
  const { data: updated, error: updateError } = await admin.from("exam_attempts").update({
    submitted_at: now,
    score: result.accuracy,
    correct_count: result.correctCount,
    completion: result.completion,
    pace_index: result.paceIndex,
    reasoning_index: result.reasoningIndex,
    integrity_score: result.integrityScore,
    assigned_track: placementTrack(result.placement?.assignedTrack),
    placement_confidence: result.placement?.confidence ?? null,
    submission_reason: reason.slice(0, 80),
    updated_at: now,
  }).eq("id", attempt.id)
    .eq("student_id", ctx.profile.profile_id)
    .is("submitted_at", null)
    .select("id")
    .maybeSingle();
  if (updateError) return { ok: false, error: updateError.message };
  if (!updated) return { ok: false, error: "This attempt has already been submitted." };

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
    const writeGrading = () => admin.from("exam_attempt_responses").upsert(gradedRows, { onConflict: "attempt_id,question_id" });
    const firstWrite = await writeGrading();
    if (firstWrite.error) {
      const retryWrite = await writeGrading();
      if (retryWrite.error) {
        console.error("Submitted attempt grading details could not be persisted", {
          attemptId: attempt.id,
          sessionId: session.id,
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
