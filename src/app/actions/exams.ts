"use server";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { findSessionById, getExamState, getStudentProfile, saveExamState } from "@/lib/supabase/queries";
import { getExamLink, normalizeExamId } from "@/lib/exam-links";
import { candidateHashFor } from "@/lib/assessment";
import type { ExamSessionDTO } from "@/types/exam";

async function currentStudentHash(): Promise<string | null> {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase.auth.getUser();
  const meta = data.user?.app_metadata ?? {};
  return (
    (meta.student_hash as string | undefined) ??
    (data.user?.user_metadata?.student_hash as string | undefined) ??
    null
  );
}

// Resolve an Exam ID to its secure workspace link. Authenticated read;
// nothing sensitive leaves the server except the link itself.
export async function resolveExamLinkAction(rawId: string): Promise<{ href?: string; error?: string }> {
  const examId = normalizeExamId(rawId);
  if (!examId) return { error: "Enter a valid Exam ID." };
  const supabase = await createSupabaseServerClient();
  const session = await findSessionById(supabase, examId);
  if (!session) return { error: "Exam not found." };
  if (session.status !== "open") return { error: `Session unavailable: ${session.status}.` };
  const now = Date.now();
  if (session.starts_at && now < Number(session.starts_at)) return { error: "Exam not open yet." };
  if (session.ends_at && now > Number(session.ends_at)) return { error: "Exam closed." };
  const dto = {
    id: session.id, title: session.title, classLevel: session.class_level, mode: session.mode,
    subjects: session.subjects, durationSeconds: session.duration_seconds,
    questionCount: session.question_count, status: session.status,
    startsAt: session.starts_at ? Number(session.starts_at) : null,
    endsAt: session.ends_at ? Number(session.ends_at) : null,
  } as ExamSessionDTO;
  return { href: getExamLink(dto) };
}

// Record a proctor/integrity event. candidateHash is derived server-side
// from the authenticated student — the client never handles identity hashes.
export async function recordIntegrityAction(sessionId: string, type: string, detail?: string): Promise<void> {
  if (!sessionId || !type) return;
  const studentHash = await currentStudentHash();
  if (!studentHash) return;
  const supabase = await createSupabaseServerClient();
  const profile = await getStudentProfile(supabase, studentHash);
  if (!profile) return;
  const candidateHash = await candidateHashFor(sessionId, profile.first_name, profile.last_name);
  const row = await getExamState(supabase, sessionId, candidateHash);
  const state = row?.state ?? { integrityEvents: [] };
  const events = [...(state.integrityEvents ?? []), { type, detail, at: Date.now() }].slice(-100);
  await saveExamState(supabase, sessionId, candidateHash, { ...state, integrityEvents: events });
}

// Phase 2: full submit lives in exam-state.ts (scoreAttempt + recordAttempt).
