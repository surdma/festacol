"use server";

import { currentStudent } from "@/lib/auth/current-student";
import { getExamLink, normalizeExamId } from "@/lib/exam-links";

interface AccessRow {
  eligible: boolean;
  allowed_attempts: number;
  used_attempts: number;
  active_attempt_id: string | null;
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

  const { data: link, error: linkError } = await ctx.supabase
    .from("exam_session_links")
    .select("token,active,expires_at")
    .eq("session_id", examId)
    .eq("active", true)
    .maybeSingle();
  if (linkError) return { error: "Exam access link could not be resolved." };
  if (!link?.token) return { error: "This examination has not published a candidate access link yet." };
  if (link.expires_at && new Date(String(link.expires_at)).getTime() <= Date.now()) {
    return { error: "This examination link has expired." };
  }

  return { href: getExamLink(String(link.token)) };
}

async function currentOpenAttempt(sessionId: string): Promise<string | null> {
  const ctx = await currentStudent();
  if (!ctx) return null;
  const { data } = await ctx.supabase
    .from("exam_attempts")
    .select("id")
    .eq("session_id", sessionId.toUpperCase())
    .eq("student_id", ctx.profile.profile_id)
    .is("submitted_at", null)
    .order("attempt_number", { ascending: false })
    .limit(1)
    .maybeSingle();
  return (data as { id?: string } | null)?.id ?? null;
}

// Integrity evidence belongs to the allocated attempt UUID. The client cannot
// provide a student/candidate identifier and cannot update or delete evidence.
export async function recordIntegrityAction(sessionId: string, type: string, detail?: string): Promise<void> {
  if (!sessionId || !type) return;
  const attemptId = await currentOpenAttempt(sessionId);
  if (!attemptId) return;
  const ctx = await currentStudent();
  if (!ctx) return;
  await ctx.supabase.from("exam_integrity_events").insert({
    attempt_id: attemptId,
    type: type.slice(0, 80),
    detail: (detail ?? "").slice(0, 500),
    at: Date.now(),
  });
}
