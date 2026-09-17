"use server";

import { z } from "zod";
import { answersMayBeRevealed, effectiveStatus, paperFromQuestionIds } from "@/lib/assessment";
import { currentStudent } from "@/lib/auth/current-student";
import { loadExamRuntimeSession } from "@/lib/exam-session";
import { loadQuestionPayload } from "@/lib/questions";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import type {
  ExamExperienceContext,
  ExamResultReviewItem,
  ExamResultSummary,
  ExamSubjectPerformance,
  QuestionDTO,
} from "@/types/exam";

const sessionIdSchema = z.string().trim().min(1).max(64).transform((value) => value.toUpperCase());

interface AccessRow {
  eligible: boolean;
  allowed_attempts: number;
  used_attempts: number;
  active_attempt_id: string | null;
  denial_reason: string | null;
}

interface ResultAttemptRow {
  id: string;
  started_at: number | null;
  submitted_at: number | null;
  score: number | null;
  correct_count: number | null;
  completion: number | null;
  pace_index: number | null;
  reasoning_index: number | null;
  assigned_track: string | null;
  placement_confidence: number | null;
  elapsed_active_seconds: number;
  question_ids: number[];
}

interface ResultResponseRow {
  question_id: number;
  response_text: string | null;
  response_values: string[];
  seconds: number;
  correct: boolean | null;
  correct_answer: string | null;
}

export type ExamExperienceResult =
  | { ok: true; data: ExamExperienceContext }
  | { ok: false; error: string };

export type ExamResultActionResult =
  | { ok: true; summary: ExamResultSummary }
  | { ok: false; error: string };

function displayTrack(value: string): string {
  if (value === "science") return "Science";
  if (value === "humanities") return "Humanities";
  if (value === "business") return "Business";
  return value.replaceAll("_", " ");
}

function accessError(reason: string | null): string {
  if (reason === "not_started") return "This examination has not started yet.";
  if (reason === "ended") return "This examination has closed.";
  if (reason === "not_open") return "This examination is not open.";
  if (reason === "not_qualified") return "Your current level does not qualify for this examination.";
  if (reason === "not_eligible") return "This examination is not assigned to your confirmed class.";
  return "This examination is unavailable for your account.";
}

function decodeResponse(row: ResultResponseRow): unknown {
  if (Array.isArray(row.response_values) && row.response_values.length > 0) {
    return row.response_values.map(String);
  }
  if (typeof row.response_text !== "string") return null;
  const value = row.response_text.trim();
  if (!value) return "";
  if (value === "true" || value === "false") return value === "true";
  if (value.startsWith("{") && value.endsWith("}")) {
    try {
      const parsed = JSON.parse(value) as unknown;
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) return parsed;
    } catch {
      // A normal text response may contain braces. Keep it as text when it is not JSON.
    }
  }
  return row.response_text;
}

function responseIsAnswered(row: ResultResponseRow | undefined): boolean {
  if (!row) return false;
  if (Array.isArray(row.response_values) && row.response_values.some((value) => String(value).trim().length > 0)) {
    return true;
  }
  const text = String(row.response_text ?? "").trim();
  if (!text) return false;
  if (text === "true" || text === "false") return true;
  if (text.startsWith("{") && text.endsWith("}")) {
    try {
      const parsed = JSON.parse(text) as unknown;
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
        return Object.values(parsed as Record<string, unknown>).some((value) => String(value ?? "").trim().length > 0);
      }
    } catch {
      return true;
    }
  }
  return true;
}

function serializeAnswer(question: QuestionDTO | undefined): string {
  const answer = (question as { answer?: unknown } | undefined)?.answer;
  if (Array.isArray(answer)) return answer.map(String).join(", ");
  if (answer && typeof answer === "object") return JSON.stringify(answer);
  return String(answer ?? "");
}

export async function getExamExperienceContextAction(sessionId: string): Promise<ExamExperienceResult> {
  const parsed = sessionIdSchema.safeParse(sessionId);
  if (!parsed.success) return { ok: false, error: "The examination session identifier is invalid." };

  const ctx = await currentStudent();
  if (!ctx) return { ok: false, error: "Sign in with your student account to continue." };

  const runtime = await loadExamRuntimeSession(ctx.supabase, parsed.data);
  if (!runtime) return { ok: false, error: "Exam session details could not be loaded." };

  const { data: accessData, error: accessReadError } = await ctx.supabase.rpc("my_exam_access", {
    p_session_id: runtime.session.id,
  });
  if (accessReadError) return { ok: false, error: "Exam eligibility could not be verified." };
  const access = (Array.isArray(accessData) ? accessData[0] : accessData) as AccessRow | null;
  if (!access?.eligible) return { ok: false, error: accessError(access?.denial_reason ?? null) };

  const [{ data: subjectRows, error: subjectError }, classResult] = await Promise.all([
    runtime.session.subjectIds.length
      ? ctx.supabase.from("subjects").select("id,name").in("id", runtime.session.subjectIds).eq("active", true)
      : Promise.resolve({ data: [], error: null }),
    ctx.enrollment
      ? ctx.supabase.from("classes").select("id,level_id,track,arm").eq("id", ctx.enrollment.class_id).maybeSingle()
      : Promise.resolve({ data: null, error: null }),
  ]);
  if (subjectError || classResult.error) {
    return { ok: false, error: "Academic details for this examination could not be loaded." };
  }

  const subjectNameById = new Map(
    ((subjectRows ?? []) as { id: string; name: string }[]).map((subject) => [subject.id, subject.name]),
  );
  const subjectNames = runtime.session.subjectIds
    .map((id) => subjectNameById.get(id))
    .filter((name): name is string => Boolean(name));

  let classLabel = `Incoming ${runtime.session.classLevel}`;
  const classRow = classResult.data as { id: string; level_id: string; track: string; arm: string } | null;
  if (classRow) {
    const { data: levelRow } = await ctx.supabase
      .from("academic_levels")
      .select("name")
      .eq("id", classRow.level_id)
      .maybeSingle();
    const levelName = String((levelRow as { name?: string } | null)?.name ?? runtime.session.classLevel);
    classLabel = `${levelName} ${displayTrack(classRow.track)} · Arm ${classRow.arm}`;
  }

  return {
    ok: true,
    data: {
      session: runtime.session,
      cameraRequired: runtime.cameraRequired,
      subjectNames,
      candidate: {
        fullName: ctx.profile.full_name,
        studentNumber: ctx.profile.student_number,
        classLabel,
      },
      access: {
        allowedAttempts: Number(access.allowed_attempts ?? 0),
        usedAttempts: Number(access.used_attempts ?? 0),
        activeAttemptId: access.active_attempt_id ?? null,
      },
    },
  };
}

export async function getExamResultAction(sessionId: string): Promise<ExamResultActionResult> {
  const parsed = sessionIdSchema.safeParse(sessionId);
  if (!parsed.success) return { ok: false, error: "The examination session identifier is invalid." };

  const ctx = await currentStudent();
  if (!ctx) return { ok: false, error: "Sign in with your student account to view this result." };

  const runtime = await loadExamRuntimeSession(ctx.supabase, parsed.data);
  if (!runtime) return { ok: false, error: "Exam session details could not be loaded." };

  const { data: attemptData, error: attemptError } = await ctx.supabase
    .from("exam_attempts")
    .select("id,started_at,submitted_at,score,correct_count,completion,pace_index,reasoning_index,assigned_track,placement_confidence,elapsed_active_seconds,question_ids")
    .eq("session_id", runtime.session.id)
    .eq("student_id", ctx.profile.profile_id)
    .not("submitted_at", "is", null)
    .order("attempt_number", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (attemptError) return { ok: false, error: "Your submitted result could not be loaded." };
  if (!attemptData) return { ok: false, error: "No submitted attempt is available yet." };

  const attempt = attemptData as ResultAttemptRow;
  if (attempt.submitted_at === null) return { ok: false, error: "This attempt has not been submitted." };

  const admin = createSupabaseAdminClient();
  const { data: responseData, error: responseError } = await admin
    .from("exam_attempt_responses")
    .select("question_id,response_text,response_values,seconds,correct,correct_answer")
    .eq("attempt_id", attempt.id);
  if (responseError) return { ok: false, error: "Your question results could not be loaded." };
  const responseRows = (responseData ?? []) as ResultResponseRow[];
  const responseByQuestion = new Map(responseRows.map((row) => [Number(row.question_id), row]));

  const payload = await loadQuestionPayload();
  const paper = attempt.question_ids.length
    ? paperFromQuestionIds({ questions: payload.questions }, runtime.session, attempt.id, attempt.question_ids)
    : [];
  const total = paper.length || attempt.question_ids.length || responseRows.length;
  const answeredCount = paper.length
    ? paper.filter((question) => responseIsAnswered(responseByQuestion.get(question.id))).length
    : responseRows.filter((row) => responseIsAnswered(row)).length;
  const correctCount = Number(attempt.correct_count ?? responseRows.filter((row) => row.correct === true).length);
  const incorrectCount = Math.max(0, answeredCount - correctCount);
  const unansweredCount = Math.max(0, total - answeredCount);

  const subjectBuckets = new Map<string, ExamSubjectPerformance>();
  for (const question of paper) {
    const response = responseByQuestion.get(question.id);
    const existing = subjectBuckets.get(question.subjectId) ?? {
      subjectId: question.subjectId,
      subject: question.subject,
      total: 0,
      correct: 0,
      percent: 0,
      seconds: 0,
    };
    existing.total += 1;
    if (response?.correct === true) existing.correct += 1;
    existing.seconds += Math.max(0, Number(response?.seconds ?? 0));
    subjectBuckets.set(question.subjectId, existing);
  }
  const subjectStats = [...subjectBuckets.values()].map((item) => ({
    ...item,
    percent: item.total ? Math.round((item.correct / item.total) * 100) : 0,
  }));

  const canReviewAnswers = answersMayBeRevealed(runtime.session, effectiveStatus(runtime.session));
  let review: ExamResultReviewItem[] = [];
  if (canReviewAnswers && paper.length) {
    const questionIds = paper.map((question) => question.id);
    const { data: explanationRows } = await admin
      .from("questions")
      .select("id,explanation")
      .in("id", questionIds);
    const explanationById = new Map(
      ((explanationRows ?? []) as { id: number; explanation: string | null }[]).map((row) => [Number(row.id), row.explanation ?? ""]),
    );
    review = paper.map((question, index) => {
      const response = responseByQuestion.get(question.id);
      const item: ExamResultReviewItem = {
        questionId: question.id,
        questionNumber: index + 1,
        subject: question.subject,
        type: question.type,
        prompt: question.prompt,
        response: response ? decodeResponse(response) : null,
        correctAnswer: response?.correct_answer || serializeAnswer(question),
        correct: response?.correct ?? null,
        seconds: Math.max(0, Number(response?.seconds ?? 0)),
      };
      if (question.domain) item.domain = question.domain;
      const explanation = explanationById.get(question.id)?.trim();
      if (explanation) item.explanation = explanation;
      return item;
    });
  }

  const placement = attempt.assigned_track
    ? {
        assignedTrack: displayTrack(attempt.assigned_track),
        confidence: Math.max(0, Number(attempt.placement_confidence ?? 0)),
      }
    : undefined;

  const summary: ExamResultSummary = {
    attemptId: attempt.id,
    submittedAt: Number(attempt.submitted_at),
    startedAt: attempt.started_at === null ? null : Number(attempt.started_at),
    score: Math.max(0, Number(attempt.score ?? 0)),
    completion: Math.max(0, Number(attempt.completion ?? 0)),
    correctCount,
    incorrectCount,
    answeredCount,
    unansweredCount,
    total,
    elapsedSeconds: Math.max(0, Number(attempt.elapsed_active_seconds ?? 0)),
    paceIndex: Math.max(0, Number(attempt.pace_index ?? 0)),
    reasoningIndex: Math.max(0, Number(attempt.reasoning_index ?? 0)),
    subjectStats,
    canReviewAnswers,
    review,
  };
  if (placement) summary.placement = placement;

  return { ok: true, summary };
}
