"use server";

import { z } from "zod";
import { currentStudent } from "@/lib/auth/current-student";

const sessionIdSchema = z.string().trim().min(1).max(64).transform((value) => value.toUpperCase());

export type ExamResumeMetricsResult =
  | { ok: true; elapsedActiveSeconds: number; questionTimings: Record<string, number> }
  | { ok: false; error: string };

export async function getExamResumeMetricsAction(sessionId: string): Promise<ExamResumeMetricsResult> {
  const parsed = sessionIdSchema.safeParse(sessionId);
  if (!parsed.success) return { ok: false, error: "The examination session identifier is invalid." };

  const ctx = await currentStudent();
  if (!ctx) return { ok: false, error: "Sign in with your student account to continue." };

  const { data: attemptData, error: attemptError } = await ctx.supabase
    .from("exam_attempts")
    .select("id,elapsed_active_seconds")
    .eq("session_id", parsed.data)
    .eq("student_id", ctx.profile.profile_id)
    .is("submitted_at", null)
    .order("attempt_number", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (attemptError) return { ok: false, error: "Your active attempt timing could not be loaded." };
  if (!attemptData) return { ok: true, elapsedActiveSeconds: 0, questionTimings: {} };

  const attempt = attemptData as { id: string; elapsed_active_seconds: number | null };
  const { data: responseData, error: responseError } = await ctx.supabase
    .from("exam_attempt_responses")
    .select("question_id,seconds")
    .eq("attempt_id", attempt.id);
  if (responseError) return { ok: false, error: "Your question timing data could not be loaded." };

  const questionTimings = Object.fromEntries(
    ((responseData ?? []) as { question_id: number; seconds: number | null }[]).map((row) => [
      String(row.question_id),
      Math.max(0, Number(row.seconds ?? 0)),
    ]),
  );

  return {
    ok: true,
    elapsedActiveSeconds: Math.max(0, Number(attempt.elapsed_active_seconds ?? 0)),
    questionTimings,
  };
}
