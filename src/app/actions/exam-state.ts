"use server";

import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { currentStudent } from "@/lib/auth/current-student";
import { loadQuestionPayload, sanitizePaper } from "@/lib/questions";
import { effectiveStatus, hashText, paperForStudent, paperFromQuestionIds, scoreAttempt } from "@/lib/assessment";
import type { ExamSessionDTO, QuestionDTO } from "@/types/exam";

export type PaperStatus =
  | { status: "ready"; paper: Omit<QuestionDTO, "answer">[]; remainingSeconds: number; currentIndex: number; responses: Record<string, unknown>; flagged: string[]; cameraRequired: boolean }
  | { status: "locked"; score: number | null }
  | { status: "unavailable"; error: string };

interface RuntimeState {
  attempt_uuid: string;
  started_at: number;
  current_index: number;
  remaining_seconds: number;
  elapsed_active_seconds: number;
  last_active_at: number;
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
  attempt_uuid: string;
  attempt_hash: string;
  attempt_number: number;
  submitted_at: number | null;
  score: number | null;
}

async function sessionDTO(id: string): Promise<ExamSessionDTO | null> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.from("exam_sessions").select("*").eq("id", id.toUpperCase()).maybeSingle();
  if (error || !data) return null;
  const session = data as Record<string, unknown>;
  const { data: subjectLinks, error: subjectError } = await supabase
    .from("exam_subjects")
    .select("subject_id,position")
    .eq("session_id", String(session.id))
    .not("subject_id", "is", null)
    .order("position");
  if (subjectError) return null;
  return {
    id: String(session.id),
    title: String(session.title),
    classLevel: session.class_level as ExamSessionDTO["classLevel"],
    classGroup: String(session.class_group ?? ""),
    academicSession: String(session.academic_session ?? ""),
    term: String(session.term ?? ""),
    mode: session.mode as ExamSessionDTO["mode"],
    subjectIds: ((subjectLinks ?? []) as { subject_id: string }[]).map((row) => row.subject_id),
    placementTracks: (session.placement_tracks ?? []) as string[],
    durationSeconds: Number(session.duration_seconds),
    questionCount: Number(session.question_count),
    status: session.status as ExamSessionDTO["status"],
    instructions: String(session.instructions ?? ""),
    startsAt: session.starts_at ? Number(session.starts_at) : null,
    endsAt: session.ends_at ? Number(session.ends_at) : null,
    integrityPolicy: {
      focusMonitoring: session.focus_monitoring !== false,
      fullscreenPrompt: session.fullscreen_prompt !== false,
      clipboardGuard: session.clipboard_guard !== false,
      warnAfter: Number(session.warn_after ?? 2),
    },
    randomization: {
      questionOrder: session.question_order !== false,
      optionOrder: session.option_order !== false,
      minimizePaperCollisions: session.minimize_collisions !== false,
    },
  };
}

async function latestAttempt(sessionId: string): Promise<AttemptRow | null> {
  const ctx = await currentStudent();
  if (!ctx) return null;
  const { data } = await ctx.supabase
    .from("exam_attempts")
    .select("attempt_uuid,attempt_hash,attempt_number,submitted_at,score")
    .eq("session_id", sessionId.toUpperCase())
    .eq("student_profile_id", ctx.profile.profile_id)
    .not("attempt_number", "is", null)
    .is("rewrite_archived_at", null)
    .order("attempt_number", { ascending: false })
    .limit(1)
    .maybeSingle();
  return (data ?? null) as AttemptRow | null;
}

async function allocateAttempt(sessionId: string) {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.rpc("allocate_my_exam_attempt", { p_session_id: sessionId.toUpperCase() });
  if (error) return { error: error.message } as const;
  const row = (Array.isArray(data) ? data[0] : data) as { attempt_uuid: string; attempt_number: number; resumed: boolean } | null;
  return row ? { row } as const : { error: "Attempt could not be allocated." } as const;
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
  return text;
}

async function stateForAttempt(attemptUuid: string) {
  const supabase = await createSupabaseServerClient();
  const [{ data: state }, { data: responses }] = await Promise.all([
    supabase.from("exam_attempt_runtime_states").select("*").eq("attempt_uuid", attemptUuid).maybeSingle(),
    supabase.from("exam_attempt_responses_v2").select("question_id,response_text,response_values,seconds,flagged").eq("attempt_uuid", attemptUuid),
  ]);
  return {
    state: (state ?? null) as RuntimeState | null,
    responses: (responses ?? []) as RuntimeResponse[],
  };
}

function accessErrorMessage(message: string): string {
  if (message.includes("attempt_limit_reached")) return "You have used all allowed attempts for this examination.";
  if (message.includes("student_not_eligible")) return "This examination is not assigned to you.";
  if (message.includes("exam_not_started")) return "This examination has not started yet.";
  if (message.includes("exam_ended")) return "This examination has closed.";
  if (message.includes("exam_not_open")) return "This examination is not open.";
  return "This examination is unavailable.";
}

export async function getExamPaperAction(sessionId: string): Promise<PaperStatus> {
  if (!(await currentStudent())) return { status: "unavailable", error: "Sign in to open this exam." };
  const session = await sessionDTO(sessionId);
  if (!session) return { status: "unavailable", error: "Exam not found or not assigned to you." };
  const status = effectiveStatus(session);
  if (status !== "open") return { status: "unavailable", error: `Session unavailable: ${status}.` };

  const allocation = await allocateAttempt(session.id);
  if ("error" in allocation) {
    if (allocation.error.includes("attempt_limit_reached")) {
      const previous = await latestAttempt(session.id);
      return { status: "locked", score: previous?.score ?? null };
    }
    return { status: "unavailable", error: accessErrorMessage(allocation.error) };
  }

  const attemptUuid = allocation.row.attempt_uuid;
  const { state, responses: savedResponses } = await stateForAttempt(attemptUuid);
  if (!state) return { status: "unavailable", error: "Attempt state is unavailable." };

  const now = Date.now();
  const awaySeconds = Math.max(0, Math.floor((now - Number(state.last_active_at ?? now)) / 1000));
  const remaining = Math.max(0, Number(state.remaining_seconds ?? session.durationSeconds) - awaySeconds);
  if (remaining <= 0) {
    const supabase = await createSupabaseServerClient();
    await supabase.from("exam_attempt_runtime_states").update({ remaining_seconds: 0, last_active_at: now, updated_at: now }).eq("attempt_uuid", attemptUuid);
    const submitted = await submitExamAction(session.id, "time-expired");
    return submitted.ok
      ? { status: "locked", score: submitted.summary?.accuracy ?? null }
      : { status: "unavailable", error: submitted.error ?? "Time expired." };
  }

  const payload = await loadQuestionPayload();
  if (!payload.questions.length) return { status: "unavailable", error: "Question bank is empty." };
  const paper = state.question_ids.length
    ? paperFromQuestionIds({ questions: payload.questions }, session, attemptUuid, state.question_ids)
    : paperForStudent({ questions: payload.questions }, session, attemptUuid);
  if (!paper.length) return { status: "unavailable", error: "No questions match this exam." };

  const fingerprint = state.paper_fingerprint || await hashText(
    `${session.id}|${attemptUuid}|${paper.map((question) => `${question.id}:${(question.options ?? []).join("~")}`).join("|")}`,
  );
  const supabase = await createSupabaseServerClient();
  const { error: stateError } = await supabase.from("exam_attempt_runtime_states").update({
    remaining_seconds: remaining,
    last_active_at: now,
    paper_fingerprint: fingerprint,
    question_ids: state.question_ids.length ? state.question_ids : paper.map((question) => question.id),
    updated_at: now,
  }).eq("attempt_uuid", attemptUuid);
  if (stateError) return { status: "unavailable", error: "Attempt state could not be saved." };

  const responses: Record<string, unknown> = {};
  const flagged: string[] = [];
  for (const response of savedResponses) {
    responses[String(response.question_id)] = joinResponse(response.response_text, response.response_values);
    if (response.flagged) flagged.push(String(response.question_id));
  }
  const { data: policy } = await supabase.from("exam_proctor_policies").select("camera_required").eq("session_id", session.id).maybeSingle();
  return {
    status: "ready",
    paper: sanitizePaper(paper),
    remainingSeconds: remaining,
    currentIndex: Math.min(state.current_index, Math.max(0, paper.length - 1)),
    responses,
    flagged,
    cameraRequired: Boolean((policy as { camera_required?: boolean } | null)?.camera_required),
  };
}

export async function saveProgressAction(
  sessionId: string,
  patch: { responses: Record<string, unknown>; currentIndex: number; questionTimings: Record<string, number>; remainingSeconds: number; elapsedActiveSeconds: number; flagged: string[] },
): Promise<void> {
  const attempt = await latestAttempt(sessionId);
  if (!attempt || attempt.submitted_at) return;
  const supabase = await createSupabaseServerClient();
  const now = Date.now();
  const { error: stateError } = await supabase.from("exam_attempt_runtime_states").update({
    current_index: Math.max(0, patch.currentIndex),
    remaining_seconds: Math.max(0, Math.round(patch.remainingSeconds)),
    elapsed_active_seconds: Math.max(0, patch.elapsedActiveSeconds),
    last_active_at: now,
    updated_at: now,
  }).eq("attempt_uuid", attempt.attempt_uuid);
  if (stateError) return;

  const flagged = new Set(patch.flagged);
  const rows = Object.entries(patch.responses).map(([questionId, value]) => {
    const response = splitResponse(value);
    return {
      attempt_uuid: attempt.attempt_uuid,
      question_id: Number(questionId),
      response_text: response.text,
      response_values: response.values,
      seconds: Math.max(0, Number(patch.questionTimings[questionId] ?? 0)),
      flagged: flagged.has(questionId),
      updated_at: now,
    };
  });
  if (rows.length) {
    await supabase.from("exam_attempt_responses_v2").upsert(rows, { onConflict: "attempt_uuid,question_id" });
  }
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
  const session = await sessionDTO(sessionId);
  if (!session) return { ok: false, error: "Exam not found or not assigned to you." };
  const attempt = await latestAttempt(session.id);
  if (!attempt || attempt.submitted_at) return { ok: false, error: attempt?.submitted_at ? "Already submitted." : "No active attempt." };
  const { state, responses: savedResponses } = await stateForAttempt(attempt.attempt_uuid);
  if (!state) return { ok: false, error: "Attempt state is unavailable." };

  const responses: Record<string, unknown> = {};
  const timings: Record<string, number> = {};
  for (const response of savedResponses) {
    responses[String(response.question_id)] = joinResponse(response.response_text, response.response_values);
    timings[String(response.question_id)] = Number(response.seconds ?? 0);
  }
  const admin = createSupabaseAdminClient();
  const { data: integrityRows } = await admin.from("exam_integrity_events_v2").select("type,detail,at").eq("attempt_uuid", attempt.attempt_uuid).order("at");
  const events = ((integrityRows ?? []) as { type: string; detail: string; at: number }[]).map((event) => ({ type: event.type }));
  const payload = await loadQuestionPayload();
  const paper = state.question_ids.length
    ? paperFromQuestionIds({ questions: payload.questions }, session, attempt.attempt_uuid, state.question_ids)
    : paperForStudent({ questions: payload.questions }, session, attempt.attempt_uuid);
  if (!paper.length) return { ok: false, error: "Attempt paper is unavailable." };

  const result = scoreAttempt(paper, {
    responses,
    questionTimings: timings,
    elapsedActiveSeconds: state.elapsed_active_seconds,
    startedAt: state.started_at,
    submittedAt: null,
    integrityEvents: events,
  }, session) as unknown as {
    accuracy: number; completion: number; paceIndex: number; reasoningIndex: number;
    integrityScore: number; correctCount: number;
    subjectStats: { subjectId: string; subject: string; total: number; correct: number; seconds: number; percent: number }[];
    details: { questionId: number; subjectId: string; subject: string; correct: boolean | null; response: unknown; seconds: number }[];
    placement?: { assignedTrack: string; confidence: number };
  };
  const fingerprint = state.paper_fingerprint || await hashText(`${session.id}|${attempt.attempt_uuid}|${paper.map((question) => question.id).join("|")}`);
  const now = Date.now();
  const answered = Math.round((result.completion / 100) * paper.length);
  const { data: updated, error: updateError } = await admin.from("exam_attempts").update({
    paper_fingerprint: fingerprint,
    submitted_at: now,
    remaining_seconds: Math.max(0, state.remaining_seconds),
    elapsed_active_seconds: Number(state.elapsed_active_seconds ?? 0),
    answered,
    question_count: paper.length,
    score: result.accuracy,
    correct_count: result.correctCount,
    completion: result.completion,
    pace_index: result.paceIndex,
    reasoning_index: result.reasoningIndex,
    integrity_score: result.integrityScore,
    assigned_track: result.placement?.assignedTrack ?? null,
    placement_confidence: result.placement?.confidence ?? null,
    submission_reason: reason.slice(0, 80),
  }).eq("attempt_uuid", attempt.attempt_uuid)
    .eq("student_profile_id", ctx.profile.profile_id)
    .is("submitted_at", null)
    .select("attempt_uuid")
    .maybeSingle();
  if (updateError) return { ok: false, error: updateError.message };
  if (!updated) return { ok: false, error: "This attempt has already been submitted." };

  await admin.from("exam_attempt_answers").delete().eq("attempt_uuid", attempt.attempt_uuid);
  if (result.details.length) {
    const { error: answerError } = await admin.from("exam_attempt_answers").insert(result.details.map((detail) => {
      const response = splitResponse(detail.response);
      const question = paper.find((item) => item.id === detail.questionId) as (QuestionDTO & { answer?: unknown }) | undefined;
      return {
        attempt_hash: attempt.attempt_hash,
        attempt_uuid: attempt.attempt_uuid,
        session_id: session.id,
        candidate_hash: "",
        question_id: detail.questionId,
        subject_code: detail.subjectId,
        subject_id: detail.subjectId,
        subject_name: detail.subject,
        correct: detail.correct,
        response_text: response.text,
        response_values: response.values,
        correct_answer: Array.isArray(question?.answer) ? question.answer.join(", ") : String(question?.answer ?? ""),
        seconds: detail.seconds,
      };
    }));
    if (answerError) return { ok: false, error: `Result details could not be saved: ${answerError.message}` };
  }

  await admin.from("exam_attempt_subject_stats").delete().eq("attempt_uuid", attempt.attempt_uuid);
  if (result.subjectStats.length) {
    const { error: statError } = await admin.from("exam_attempt_subject_stats").insert(result.subjectStats.map((stat) => ({
      attempt_hash: attempt.attempt_hash,
      attempt_uuid: attempt.attempt_uuid,
      subject_code: stat.subjectId,
      subject_id: stat.subjectId,
      subject_name: stat.subject,
      total: stat.total,
      correct: stat.correct,
      seconds: stat.seconds,
      percent: stat.percent,
    })));
    if (statError) return { ok: false, error: `Subject results could not be saved: ${statError.message}` };
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
