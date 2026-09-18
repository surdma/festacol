"use server";

import { z } from "zod";
import { paperFromQuestionIds } from "@/lib/assessment";
import { currentStudent } from "@/lib/auth/current-student";
import { attemptDurationSeconds } from "@/lib/exam-finalization";
import { loadExamRuntimeSession } from "@/lib/exam-session";
import { loadQuestionPayload } from "@/lib/questions";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import type { ExamAttemptContextSnapshot } from "@/types/db";
import type {
  ExamExperienceContext,
  ExamResultSummary,
  ExamSessionDTO,
  ExamSubjectPerformance,
} from "@/types/exam";

const sessionIdSchema = z.string().trim().min(1).max(64).transform((value) => value.toUpperCase());
const attemptIdSchema = z.string().uuid();

interface AccessRow {
  eligible: boolean;
  allowed_attempts: number;
  used_attempts: number;
  active_attempt_id: string | null;
  denial_reason: string | null;
}

interface ResultAttemptRow {
  id: string;
  session_id: string;
  attempt_number: number;
  context_snapshot: ExamAttemptContextSnapshot;
  started_at: number | null;
  submitted_at: number | null;
  submission_reason: string;
  remaining_seconds: number | null;
  last_active_at: number | null;
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

function resultSubmissionReason(value: string): ExamResultSummary["submissionReason"] {
  if (value === "manual" || value === "time-expired" || value === "exam-closed" || value === "potential-malpractice") return value;
  return "unknown";
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

  let effectiveSession = runtime.session;
  if (access.active_attempt_id) {
    const { data: activeAttempt, error: activeAttemptError } = await ctx.supabase
      .from("exam_attempts")
      .select("started_at,last_active_at,remaining_seconds,elapsed_active_seconds,context_snapshot,question_ids")
      .eq("id", access.active_attempt_id)
      .eq("student_id", ctx.profile.profile_id)
      .maybeSingle();

    if (activeAttemptError || !activeAttempt) {
      return { ok: false, error: "Your active examination timing could not be restored safely. Retry without starting a new attempt." };
    }

    if (activeAttempt) {
      const row = activeAttempt as {
        started_at: number | null;
        last_active_at: number | null;
        remaining_seconds: number | null;
        elapsed_active_seconds: number;
        context_snapshot: ExamAttemptContextSnapshot;
        question_ids: number[];
      };
      effectiveSession = {
        ...runtime.session,
        durationSeconds: attemptDurationSeconds(row, runtime.session),
        questionCount: row.question_ids.length || Number(row.context_snapshot?.questionCount ?? runtime.session.questionCount),
      };
    }
  }

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
      session: effectiveSession,
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

type StudentContext = NonNullable<Awaited<ReturnType<typeof currentStudent>>>;

interface ResultClassRow {
  id: string;
  level_id: string;
  track: string;
  arm: string;
}

interface ResolvedClass {
  row: ResultClassRow;
  levelName: string;
  label: string;
}

function safeWhatsappInvite(value: string | null | undefined): string | null {
  if (!value) return null;
  try {
    const url = new URL(value);
    const host = url.hostname.toLowerCase();
    const allowedHost =
      host === "chat.whatsapp.com" ||
      host === "wa.me" ||
      host === "whatsapp.com" ||
      host.endsWith(".whatsapp.com");
    return url.protocol === "https:" && allowedHost ? url.toString() : null;
  } catch {
    return null;
  }
}

async function loadResolvedClass(
  admin: ReturnType<typeof createSupabaseAdminClient>,
  classId: string,
): Promise<{ ok: true; value: ResolvedClass | null } | { ok: false }> {
  const { data: classData, error: classError } = await admin
    .from("classes")
    .select("id,level_id,track,arm")
    .eq("id", classId)
    .eq("status", "active")
    .maybeSingle();
  if (classError) return { ok: false };
  if (!classData) return { ok: true, value: null };

  const row = classData as ResultClassRow;
  const { data: levelData, error: levelError } = await admin
    .from("academic_levels")
    .select("name")
    .eq("id", row.level_id)
    .maybeSingle();
  if (levelError) return { ok: false };
  const levelName = String((levelData as { name?: string } | null)?.name ?? "").trim();
  if (!levelName) return { ok: true, value: null };

  return {
    ok: true,
    value: {
      row,
      levelName,
      label: `${levelName} ${displayTrack(row.track)} · Arm ${row.arm}`,
    },
  };
}

async function loadWhatsappDestination(
  admin: ReturnType<typeof createSupabaseAdminClient>,
  resolved: ResolvedClass | null,
  fallbackLabel: string,
  kind: ExamResultSummary["destination"]["kind"],
): Promise<{ ok: true; value: ExamResultSummary["destination"] } | { ok: false }> {
  if (!resolved) {
    return {
      ok: true,
      value: {
        kind,
        classId: null,
        classLabel: fallbackLabel,
        whatsappName: null,
        whatsappUrl: null,
      },
    };
  }

  const { data: groupData, error: groupError } = await admin
    .from("whatsapp_groups")
    .select("name,invite_url")
    .eq("class_id", resolved.row.id)
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (groupError) return { ok: false };
  const group = groupData as { name: string; invite_url: string } | null;

  return {
    ok: true,
    value: {
      kind,
      classId: resolved.row.id,
      classLabel: resolved.label,
      whatsappName: group?.name?.trim() || null,
      whatsappUrl: safeWhatsappInvite(group?.invite_url),
    },
  };
}

async function resolveResultDestination(
  ctx: StudentContext,
  attempt: ResultAttemptRow,
  mode: ExamResultSummary["mode"],
): Promise<{ ok: true; value: ExamResultSummary["destination"] } | { ok: false }> {
  const admin = createSupabaseAdminClient();
  let enrollmentClass: ResolvedClass | null = null;

  if (ctx.enrollment?.class_id) {
    const loaded = await loadResolvedClass(admin, ctx.enrollment.class_id);
    if (!loaded.ok) return { ok: false };
    enrollmentClass = loaded.value;
  }

  if (mode === "qualifier" && attempt.assigned_track) {
    const assignedTrack = attempt.assigned_track;
    const placementLabel = `SS1 ${displayTrack(assignedTrack)}`;

    if (
      enrollmentClass &&
      enrollmentClass.levelName === "SS1" &&
      enrollmentClass.row.track === assignedTrack
    ) {
      return loadWhatsappDestination(admin, enrollmentClass, placementLabel, "placement");
    }

    const { data: levelData, error: levelError } = await admin
      .from("academic_levels")
      .select("id")
      .eq("name", "SS1")
      .eq("active", true)
      .maybeSingle();
    if (levelError) return { ok: false };
    const levelId = String((levelData as { id?: string } | null)?.id ?? "");
    if (!levelId) {
      return loadWhatsappDestination(admin, null, placementLabel, "placement");
    }

    const { data: classData, error: classError } = await admin
      .from("classes")
      .select("id,level_id,track,arm")
      .eq("level_id", levelId)
      .eq("track", assignedTrack)
      .eq("status", "active")
      .order("arm", { ascending: true })
      .limit(2);
    if (classError) return { ok: false };
    const candidates = (classData ?? []) as ResultClassRow[];
    if (candidates.length !== 1) {
      return loadWhatsappDestination(admin, null, placementLabel, "placement");
    }

    const loaded = await loadResolvedClass(admin, candidates[0].id);
    if (!loaded.ok) return { ok: false };
    return loadWhatsappDestination(admin, loaded.value, placementLabel, "placement");
  }

  return loadWhatsappDestination(admin, enrollmentClass, "Your class", "class");
}

async function buildResultSummary(
  ctx: StudentContext,
  runtimeSession: ExamSessionDTO,
  attempt: ResultAttemptRow,
): Promise<ExamResultActionResult> {
  if (attempt.submitted_at === null) return { ok: false, error: "This attempt has not been submitted." };

  const admin = createSupabaseAdminClient();
  const [{ data: responseData, error: responseError }, destinationResult] = await Promise.all([
    admin
      .from("exam_attempt_responses")
      .select("question_id,response_text,response_values,seconds,correct")
      .eq("attempt_id", attempt.id),
    resolveResultDestination(
      ctx,
      attempt,
      attempt.context_snapshot?.mode ?? runtimeSession.mode,
    ),
  ]);
  if (responseError) return { ok: false, error: "Your question results could not be loaded." };
  if (!destinationResult.ok) {
    return { ok: false, error: "Your class community details could not be loaded." };
  }

  const responseRows = (responseData ?? []) as ResultResponseRow[];
  const responseByQuestion = new Map(responseRows.map((row) => [Number(row.question_id), row]));

  const payload = await loadQuestionPayload();
  const paper = attempt.question_ids.length
    ? paperFromQuestionIds({ questions: payload.questions }, runtimeSession, attempt.id, attempt.question_ids)
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

  const placement = attempt.assigned_track
    ? {
        assignedTrack: displayTrack(attempt.assigned_track),
        confidence: Math.max(0, Number(attempt.placement_confidence ?? 0)),
      }
    : undefined;
  const snapshotQuestionCount = Math.max(0, Number(attempt.context_snapshot?.questionCount ?? 0));
  const durationSeconds = attemptDurationSeconds(attempt, runtimeSession);
  const questionCount = attempt.question_ids.length || (snapshotQuestionCount > 0 ? Math.round(snapshotQuestionCount) : total);
  const sessionTitle = String(attempt.context_snapshot?.sessionTitle ?? runtimeSession.title);
  const candidateName = String(attempt.context_snapshot?.studentName ?? ctx.profile.full_name);
  const mode = attempt.context_snapshot?.mode ?? runtimeSession.mode;
  const snapshotSubjects = Array.isArray(attempt.context_snapshot?.subjectNames)
    ? attempt.context_snapshot.subjectNames.filter((name): name is string => typeof name === "string" && name.trim().length > 0)
    : [];

  const summary: ExamResultSummary = {
    attemptId: attempt.id,
    attemptNumber: Math.max(1, Math.round(Number(attempt.attempt_number) || 1)),
    submittedAt: Number(attempt.submitted_at),
    startedAt: attempt.started_at === null ? null : Number(attempt.started_at),
    submissionReason: resultSubmissionReason(attempt.submission_reason),
    sessionTitle,
    candidateName,
    studentNumber: ctx.profile.student_number,
    classLabel: String(attempt.context_snapshot?.className ?? "").trim() || destinationResult.value.classLabel,
    academicSession: String(attempt.context_snapshot?.academicYear ?? runtimeSession.academicSession ?? ""),
    term: String(attempt.context_snapshot?.academicTerm ?? runtimeSession.term ?? ""),
    subjectNames: snapshotSubjects.length ? snapshotSubjects : subjectStats.map((item) => item.subject),
    destination: destinationResult.value,
    mode,
    durationSeconds,
    questionCount,
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
  };
  if (placement) summary.placement = placement;

  return { ok: true, summary };
}

const RESULT_ATTEMPT_COLUMNS =
  "id,session_id,attempt_number,context_snapshot,started_at,submitted_at,submission_reason,remaining_seconds,last_active_at,score,correct_count,completion,pace_index,reasoning_index,assigned_track,placement_confidence,elapsed_active_seconds,question_ids";

export async function getExamResultAction(sessionId: string): Promise<ExamResultActionResult> {
  const parsed = sessionIdSchema.safeParse(sessionId);
  if (!parsed.success) return { ok: false, error: "The examination session identifier is invalid." };

  const ctx = await currentStudent();
  if (!ctx) return { ok: false, error: "Sign in with your student account to view this result." };

  const runtime = await loadExamRuntimeSession(ctx.supabase, parsed.data);
  if (!runtime) return { ok: false, error: "Exam session details could not be loaded." };

  const { data: attemptData, error: attemptError } = await ctx.supabase
    .from("exam_attempts")
    .select(RESULT_ATTEMPT_COLUMNS)
    .eq("session_id", runtime.session.id)
    .eq("student_id", ctx.profile.profile_id)
    .not("submitted_at", "is", null)
    .order("attempt_number", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (attemptError) return { ok: false, error: "Your submitted result could not be loaded." };
  if (!attemptData) return { ok: false, error: "No submitted attempt is available yet." };

  return buildResultSummary(ctx, runtime.session, attemptData as ResultAttemptRow);
}

export async function getExamResultByAttemptAction(attemptId: string): Promise<ExamResultActionResult> {
  const parsed = attemptIdSchema.safeParse(attemptId);
  if (!parsed.success) return { ok: false, error: "The result reference is invalid." };

  const ctx = await currentStudent();
  if (!ctx) return { ok: false, error: "Sign in with your student account to view this result." };

  const { data: attemptData, error: attemptError } = await ctx.supabase
    .from("exam_attempts")
    .select(RESULT_ATTEMPT_COLUMNS)
    .eq("id", parsed.data)
    .eq("student_id", ctx.profile.profile_id)
    .not("submitted_at", "is", null)
    .maybeSingle();
  if (attemptError) return { ok: false, error: "Your submitted result could not be loaded." };
  if (!attemptData) return { ok: false, error: "This submitted result is not available for your account." };

  const attempt = attemptData as ResultAttemptRow;
  const runtime = await loadExamRuntimeSession(createSupabaseAdminClient(), attempt.session_id);
  if (!runtime) return { ok: false, error: "Exam session details could not be loaded." };

  return buildResultSummary(ctx, runtime.session, attempt);
}
