"use server";

import { z } from "zod";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { currentStudent } from "@/lib/auth/current-student";
import { loadExamRuntimeSession } from "@/lib/exam-session";
import { loadQuestionPayload, sanitizePaper } from "@/lib/questions";
import { effectiveStatus, hashText, paperForStudent, paperFromQuestionIds, scoreAttempt } from "@/lib/assessment";
import type { AcademicTrack } from "@/types/db";
import type { ExamPaperQuestionDTO, ExamSessionDTO, QuestionDTO } from "@/types/exam";

const sessionIdSchema = z.string().trim().min(1).max(64).transform((value) => value.toUpperCase());
const questionIdKeySchema = z.string().regex(/^\d+$/u);
const progressPatchSchema = z.object({
  responses: z.record(questionIdKeySchema, z.unknown()),
  currentIndex: z.number().int().nonnegative().max(10_000),
  questionTimings: z.record(questionIdKeySchema, z.number().finite().nonnegative().max(86_400)),
  flagged: z.array(questionIdKeySchema).max(10_000),
}).strip();
const submitReasonSchema = z.enum(["manual", "time-expired"]);
const MAX_PROGRESS_PAYLOAD_CHARS = 262_144;
const EXPIRY_SAVE_GRACE_SECONDS = 15;

export type PaperStatus =
  | { status: "ready"; paper: ExamPaperQuestionDTO[]; remainingSeconds: number; currentIndex: number; responses: Record<string, unknown>; flagged: string[]; cameraRequired: boolean }
  | { status: "locked"; score: number | null }
  | { status: "unavailable"; error: string };

export type SaveProgressResult =
  | { ok: true; remainingSeconds: number; elapsedActiveSeconds: number }
  | { ok: false; error: string; code?: "expired" | "invalid" | "unavailable" };

interface RuntimeState {
  id: string;
  started_at: number | null;
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
    return { text: JSON.stringify(value), values: [] };
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

function responseForQuestion(response: RuntimeResponse, question: QuestionDTO | undefined): unknown {
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
      .select("id,started_at,current_index,remaining_seconds,elapsed_active_seconds,last_active_at,paper_fingerprint,question_ids,updated_at")
      .eq("id", attemptId)
      .maybeSingle(),
    supabase.from("exam_attempt_responses").select("question_id,response_text,response_values,seconds,flagged").eq("attempt_id", attemptId),
  ]);
  return {
    state: (state ?? null) as RuntimeState | null,
    responses: (responses ?? []) as RuntimeResponse[],
  };
}

function authoritativeAttemptClock(
  state: Pick<RuntimeState, "started_at" | "last_active_at">,
  session: ExamSessionDTO,
  now = Date.now(),
) {
  const startedAt = Number(state.started_at ?? state.last_active_at ?? now);
  const durationMs = Math.max(0, Number(session.durationSeconds) || 0) * 1000;
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

function invalidQuestionId(
  ids: Iterable<string>,
  allowedQuestionIds: Set<string>,
): string | null {
  for (const id of ids) {
    if (!allowedQuestionIds.has(id)) return id;
  }
  return null;
}

function normalizedQuestionTimings(
  currentRows: RuntimeResponse[],
  incoming: Record<string, number>,
  allowedQuestionIds: Set<string>,
  authoritativeElapsed: number,
): Record<string, number> {
  const merged = new Map<string, number>();
  for (const row of currentRows) {
    const id = String(row.question_id);
    if (allowedQuestionIds.has(id)) merged.set(id, Math.max(0, Number(row.seconds ?? 0)));
  }
  for (const [id, seconds] of Object.entries(incoming)) {
    if (allowedQuestionIds.has(id)) merged.set(id, Math.max(0, Number(seconds) || 0));
  }

  const elapsed = Math.max(0, authoritativeElapsed);
  const total = [...merged.values()].reduce((sum, seconds) => sum + seconds, 0);
  const scale = total > elapsed && total > 0 ? elapsed / total : 1;

  return Object.fromEntries(
    [...merged.entries()].map(([id, seconds]) => [id, Math.min(elapsed, seconds * scale)]),
  );
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
  const parsedSessionId = sessionIdSchema.safeParse(sessionId);
  if (!parsedSessionId.success) return { status: "unavailable", error: "The examination session identifier is invalid." };
  const ctx = await currentStudent();
  if (!ctx) return { status: "unavailable", error: "Sign in to open this exam." };
  const runtimeSession = await sessionDTO(parsedSessionId.data);
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
  const clock = authoritativeAttemptClock(state, session, now);
  const remaining = clock.remainingSeconds;
  const reconciledElapsed = clock.elapsedActiveSeconds;
  if (remaining <= 0) {
    const admin = createSupabaseAdminClient();
    const { data: expiredAttempt, error: expirationStateError } = await admin.from("exam_attempts").update({
      remaining_seconds: 0,
      elapsed_active_seconds: reconciledElapsed,
      last_active_at: now,
      updated_at: now,
    }).eq("id", attemptId)
      .eq("student_id", ctx.profile.profile_id)
      .is("submitted_at", null)
      .select("id")
      .maybeSingle();
    if (expirationStateError) {
      return { status: "unavailable", error: "Time expired, but the attempt state could not be finalized. Retry without closing this page." };
    }
    if (!expiredAttempt) {
      const previous = await latestAttempt(session.id);
      return previous?.submitted_at
        ? { status: "locked", score: previous.score }
        : { status: "unavailable", error: "The active attempt changed while the paper was being restored. Retry without closing this page." };
    }
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
  const admin = createSupabaseAdminClient();
  const { data: activeAttempt, error: stateError } = await admin.from("exam_attempts").update({
    remaining_seconds: remaining,
    elapsed_active_seconds: reconciledElapsed,
    last_active_at: now,
    paper_fingerprint: fingerprint,
    question_ids: state.question_ids.length ? state.question_ids : paper.map((question) => question.id),
    updated_at: now,
  }).eq("id", attemptId)
    .eq("student_id", ctx.profile.profile_id)
    .is("submitted_at", null)
    .select("id")
    .maybeSingle();
  if (stateError) return { status: "unavailable", error: "Attempt state could not be saved." };
  if (!activeAttempt) {
    const previous = await latestAttempt(session.id);
    return previous?.submitted_at
      ? { status: "locked", score: previous.score }
      : { status: "unavailable", error: "The active attempt changed while the paper was being restored. Retry without closing this page." };
  }

  const questionById = new Map(paper.map((question) => [question.id, question]));
  const responses: Record<string, unknown> = {};
  const flagged: string[] = [];
  for (const response of savedResponses) {
    responses[String(response.question_id)] = responseForQuestion(response, questionById.get(response.question_id));
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
  patch: {
    responses: Record<string, unknown>;
    currentIndex: number;
    questionTimings: Record<string, number>;
    flagged: string[];
  },
): Promise<SaveProgressResult> {
  const parsedSessionId = sessionIdSchema.safeParse(sessionId);
  const parsedPatch = progressPatchSchema.safeParse(patch);
  if (!parsedSessionId.success || !parsedPatch.success) {
    return { ok: false, code: "invalid", error: "The exam progress update is invalid." };
  }

  let serializedResponses = "";
  try {
    serializedResponses = JSON.stringify(parsedPatch.data.responses);
  } catch {
    return { ok: false, code: "invalid", error: "The exam response data is invalid." };
  }
  if (serializedResponses.length > MAX_PROGRESS_PAYLOAD_CHARS) {
    return { ok: false, code: "invalid", error: "The exam response update is too large to save safely." };
  }

  const ctx = await currentStudent();
  if (!ctx) return { ok: false, code: "unavailable", error: "Sign in required." };

  const runtimeSession = await sessionDTO(parsedSessionId.data);
  if (!runtimeSession) {
    return { ok: false, code: "unavailable", error: "This examination is unavailable." };
  }
  if (effectiveStatus(runtimeSession.session) !== "open") {
    return {
      ok: false,
      code: "expired",
      error: "This examination is no longer open. Festacol will finalize the responses already accepted by the server.",
    };
  }

  const attempt = await latestAttempt(parsedSessionId.data);
  if (!attempt) return { ok: false, code: "unavailable", error: "No active attempt is available to save." };
  if (attempt.submitted_at) return { ok: false, code: "unavailable", error: "This attempt has already been submitted." };

  const { state, responses: savedResponses } = await stateForAttempt(attempt.id);
  if (!state) return { ok: false, code: "unavailable", error: "Attempt state is unavailable." };
  if (!state.question_ids.length) {
    return { ok: false, code: "unavailable", error: "The allocated examination paper is unavailable." };
  }

  const allowedQuestionIds = new Set(state.question_ids.map((id) => String(id)));
  const responseQuestionError = invalidQuestionId(Object.keys(parsedPatch.data.responses), allowedQuestionIds);
  const timingQuestionError = invalidQuestionId(Object.keys(parsedPatch.data.questionTimings), allowedQuestionIds);
  const flaggedQuestionError = invalidQuestionId(parsedPatch.data.flagged, allowedQuestionIds);
  if (responseQuestionError || timingQuestionError || flaggedQuestionError) {
    return { ok: false, code: "invalid", error: "The progress update contains a question outside this examination paper." };
  }
  if (parsedPatch.data.currentIndex >= state.question_ids.length) {
    return { ok: false, code: "invalid", error: "The requested question position is outside this examination paper." };
  }

  const now = Date.now();
  const clock = authoritativeAttemptClock(state, runtimeSession.session, now);
  if (clock.remainingSeconds <= 0 && clock.overdueSeconds > EXPIRY_SAVE_GRACE_SECONDS) {
    return {
      ok: false,
      code: "expired",
      error: "The examination time has ended. Festacol will submit the responses already accepted by the server.",
    };
  }

  const normalizedTimings = normalizedQuestionTimings(
    savedResponses,
    parsedPatch.data.questionTimings,
    allowedQuestionIds,
    clock.elapsedActiveSeconds,
  );
  const flagged = new Set(parsedPatch.data.flagged);
  const existingByQuestion = new Map(savedResponses.map((response) => [String(response.question_id), response]));
  const rowIds = new Set<string>([
    ...existingByQuestion.keys(),
    ...Object.keys(parsedPatch.data.responses),
    ...flagged,
  ]);

  const admin = createSupabaseAdminClient();
  const { data: updatedAttempt, error: stateError } = await admin.from("exam_attempts").update({
    current_index: parsedPatch.data.currentIndex,
    remaining_seconds: clock.remainingSeconds,
    elapsed_active_seconds: clock.elapsedActiveSeconds,
    last_active_at: now,
    updated_at: now,
  }).eq("id", attempt.id)
    .eq("student_id", ctx.profile.profile_id)
    .is("submitted_at", null)
    .select("id")
    .maybeSingle();
  if (stateError || !updatedAttempt) {
    return { ok: false, code: "unavailable", error: "Your exam progress could not be saved." };
  }

  const rows = [...rowIds].map((questionId) => {
    const existing = existingByQuestion.get(questionId);
    const hasIncomingResponse = Object.hasOwn(parsedPatch.data.responses, questionId);
    const response = hasIncomingResponse
      ? splitResponse(parsedPatch.data.responses[questionId])
      : { text: existing?.response_text ?? null, values: existing?.response_values ?? [] };

    return {
      attempt_id: attempt.id,
      question_id: Number(questionId),
      response_text: response.text,
      response_values: response.values,
      seconds: Math.max(0, Number(normalizedTimings[questionId] ?? existing?.seconds ?? 0)),
      flagged: flagged.has(questionId),
      updated_at: now,
    };
  });

  if (rows.length) {
    const { error: responseError } = await admin
      .from("exam_attempt_responses")
      .upsert(rows, { onConflict: "attempt_id,question_id" });
    if (responseError) return { ok: false, code: "unavailable", error: "Your answers could not be saved." };
  }

  return {
    ok: true,
    remainingSeconds: clock.remainingSeconds,
    elapsedActiveSeconds: clock.elapsedActiveSeconds,
  };
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
  const parsedSessionId = sessionIdSchema.safeParse(sessionId);
  const parsedReason = submitReasonSchema.safeParse(reason);
  if (!parsedSessionId.success || !parsedReason.success) return { ok: false, error: "The submission request is invalid." };
  const ctx = await currentStudent();
  if (!ctx) return { ok: false, error: "Sign in required." };
  const runtimeSession = await sessionDTO(parsedSessionId.data);
  if (!runtimeSession) return { ok: false, error: "Exam not found or not assigned to you." };
  const { session } = runtimeSession;
  const attempt = await latestAttempt(session.id);
  if (!attempt || attempt.submitted_at) return { ok: false, error: attempt?.submitted_at ? "Already submitted." : "No active attempt." };
  const { state, responses: savedResponses } = await stateForAttempt(attempt.id);
  if (!state) return { ok: false, error: "Attempt state is unavailable." };
  const submissionClock = authoritativeAttemptClock(state, session);

  const admin = createSupabaseAdminClient();
  const { data: integrityRows } = await admin.from("exam_integrity_events").select("type,detail,at").eq("attempt_id", attempt.id).order("at");
  const events = ((integrityRows ?? []) as { type: string; detail: string; at: number }[]).map((event) => ({ type: event.type }));
  const payload = await loadQuestionPayload();
  const paper = state.question_ids.length
    ? paperFromQuestionIds({ questions: payload.questions }, session, attempt.id, state.question_ids)
    : paperForStudent({ questions: payload.questions }, session, attempt.id);
  if (!paper.length) return { ok: false, error: "Attempt paper is unavailable." };

  const questionById = new Map(paper.map((question) => [question.id, question]));
  const responses: Record<string, unknown> = {};
  const timings: Record<string, number> = {};
  const flaggedByQuestion = new Map<number, boolean>();
  for (const response of savedResponses) {
    responses[String(response.question_id)] = responseForQuestion(response, questionById.get(response.question_id));
    timings[String(response.question_id)] = Number(response.seconds ?? 0);
    flaggedByQuestion.set(Number(response.question_id), response.flagged);
  }

  const result = scoreAttempt(paper, {
    responses,
    questionTimings: timings,
    elapsedActiveSeconds: submissionClock.elapsedActiveSeconds,
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
  const effectiveSubmissionReason = submissionClock.remainingSeconds <= 0 ? "time-expired" : parsedReason.data;
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
    submission_reason: effectiveSubmissionReason,
    remaining_seconds: submissionClock.remainingSeconds,
    elapsed_active_seconds: submissionClock.elapsedActiveSeconds,
    last_active_at: now,
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
