"use server";

import { currentStudent } from "@/lib/auth/current-student";
import { getExamLink, normalizeExamId } from "@/lib/exam-links";
import type { ExamSessionDTO } from "@/types/exam";

interface AccessRow {
  eligible: boolean;
  allowed_attempts: number;
  used_attempts: number;
  active_attempt_uuid: string | null;
  denial_reason: string | null;
}

function accessMessage(reason: string | null): string {
  const messages: Record<string, string> = {
    not_authenticated: "Sign in before opening an examination.",
    not_found: "Exam not found.",
    not_open: "Exam is not open.",
    not_started: "Exam has not started yet.",
    ended: "Exam has closed.",
    not_eligible: "This examination is not assigned to you.",
  };
  return messages[reason ?? ""] ?? "You are not eligible for this examination.";
}

export async function resolveExamLinkAction(rawId: string): Promise<{ href?: string; error?: string }> {
  const examId = normalizeExamId(rawId);
  if (!examId) return { error: "Enter a valid Exam ID." };
  const ctx = await currentStudent();
  if (!ctx) return { error: "Sign in before opening an examination." };

  const { data: access, error: accessError } = await ctx.supabase.rpc("my_exam_access", { p_session_id: examId });
  if (accessError) return { error: "Exam eligibility could not be verified." };
  const accessRow = (Array.isArray(access) ? access[0] : access) as AccessRow | null;
  if (!accessRow?.eligible) return { error: accessMessage(accessRow?.denial_reason ?? null) };

  const [{ data: session, error: sessionError }, { data: subjectLinks, error: subjectError }] = await Promise.all([
    ctx.supabase.from("exam_sessions").select("*").eq("id", examId).maybeSingle(),
    ctx.supabase.from("exam_subjects").select("subject_id,position").eq("session_id", examId).not("subject_id", "is", null).order("position"),
  ]);
  if (sessionError || subjectError || !session) return { error: "Exam metadata is unavailable." };
  const row = session as Record<string, unknown>;
  const dto: ExamSessionDTO = {
    id: String(row.id),
    title: String(row.title),
    classLevel: row.class_level as ExamSessionDTO["classLevel"],
    classGroup: String(row.class_group ?? ""),
    academicSession: String(row.academic_session ?? ""),
    term: String(row.term ?? ""),
    mode: row.mode as ExamSessionDTO["mode"],
    subjectIds: ((subjectLinks ?? []) as { subject_id: string }[]).map((link) => link.subject_id),
    placementTracks: (row.placement_tracks ?? []) as string[],
    durationSeconds: Number(row.duration_seconds),
    questionCount: Number(row.question_count),
    status: row.status as ExamSessionDTO["status"],
    instructions: String(row.instructions ?? ""),
    startsAt: row.starts_at ? Number(row.starts_at) : null,
    endsAt: row.ends_at ? Number(row.ends_at) : null,
    integrityPolicy: {
      focusMonitoring: row.focus_monitoring !== false,
      fullscreenPrompt: row.fullscreen_prompt !== false,
      clipboardGuard: row.clipboard_guard !== false,
      warnAfter: Number(row.warn_after ?? 2),
    },
    randomization: {
      questionOrder: row.question_order !== false,
      optionOrder: row.option_order !== false,
      minimizePaperCollisions: row.minimize_collisions !== false,
    },
  };
  return { href: getExamLink(dto) };
}

async function currentOpenAttempt(sessionId: string): Promise<string | null> {
  const ctx = await currentStudent();
  if (!ctx) return null;
  const { data } = await ctx.supabase
    .from("exam_attempts")
    .select("attempt_uuid")
    .eq("session_id", sessionId.toUpperCase())
    .eq("student_profile_id", ctx.profile.profile_id)
    .is("submitted_at", null)
    .is("rewrite_archived_at", null)
    .not("attempt_number", "is", null)
    .order("attempt_number", { ascending: false })
    .limit(1)
    .maybeSingle();
  return (data as { attempt_uuid?: string } | null)?.attempt_uuid ?? null;
}

// Integrity evidence belongs to the allocated attempt UUID. The client cannot
// provide a student/candidate identifier and cannot update or delete evidence.
export async function recordIntegrityAction(sessionId: string, type: string, detail?: string): Promise<void> {
  if (!sessionId || !type) return;
  const attemptUuid = await currentOpenAttempt(sessionId);
  if (!attemptUuid) return;
  const ctx = await currentStudent();
  if (!ctx) return;
  await ctx.supabase.from("exam_integrity_events_v2").insert({
    attempt_uuid: attemptUuid,
    type: type.slice(0, 80),
    detail: (detail ?? "").slice(0, 500),
    at: Date.now(),
  });
}
