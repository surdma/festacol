"use server";

import { randomUUID } from "node:crypto";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getExamState, getStudentProfile, saveExamState } from "@/lib/supabase/queries";
import { loadQuestionPayload, sanitizePaper } from "@/lib/questions";
import {
  candidateHashFor,
  effectiveStatus,
  hashText,
  paperForStudent,
  scoreAttempt,
  studentHashFor,
} from "@/lib/assessment";
import type { ExamSessionDTO, QuestionDTO } from "@/types/exam";

export type PaperStatus =
  | { status: "ready"; paper: Omit<QuestionDTO, "answer">[]; remainingSeconds: number; currentIndex: number; responses: Record<string, unknown>; flagged: string[]; cameraRequired: boolean }
  | { status: "locked"; score: number | null }
  | { status: "reset" }
  | { status: "unavailable"; error: string };

async function sessionDTO(id: string) {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase.from("exam_sessions").select("*").eq("id", id.toUpperCase()).maybeSingle();
  const s = data as Record<string, unknown> | null;
  if (!s) return null;
  return {
    dto: {
      id: s.id, title: s.title, classLevel: s.class_level, classGroup: s.class_group,
      academicSession: s.academic_session, term: s.term, mode: s.mode,
      subjects: s.subjects, placementTracks: s.placement_tracks,
      durationSeconds: s.duration_seconds, questionCount: s.question_count,
      status: s.status, instructions: s.instructions,
      startsAt: s.starts_at ? Number(s.starts_at) : null,
      endsAt: s.ends_at ? Number(s.ends_at) : null,
      integrityPolicy: s.integrity_policy, randomization: s.randomization,
    } as ExamSessionDTO,
    raw: s,
  };
}

async function authIdentity() {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase.auth.getUser();
  const studentHash =
    (data.user?.app_metadata?.student_hash as string | undefined) ??
    (data.user?.user_metadata?.student_hash as string | undefined) ??
    null;
  if (!studentHash) return null;
  const profile = await getStudentProfile(supabase, studentHash);
  if (!profile) return null;
  return { studentHash, profile };
}

// Start or resume an exam: validates window, handles reset markers,
// reconciles background time, creates the deterministic paper on first start.
export async function getExamPaperAction(sessionId: string): Promise<PaperStatus> {
  const identity = await authIdentity();
  if (!identity) return { status: "unavailable", error: "Sign in to open this exam." };
  const found = await sessionDTO(sessionId);
  if (!found) return { status: "unavailable", error: "Exam not found." };
  if (effectiveStatus(found.dto) !== "open") return { status: "unavailable", error: `Session unavailable: ${effectiveStatus(found.dto)}.` };

  const supabase = await createSupabaseServerClient();
  const candidateHash = await candidateHashFor(sessionId.toUpperCase(), identity.profile.first_name, identity.profile.last_name);

  const { data: submitted } = await supabase
    .from("exam_attempts").select("score").eq("session_id", found.dto.id).eq("candidate_hash", candidateHash)
    .not("submitted_at", "is", null).order("submitted_at", { ascending: false }).limit(1).maybeSingle();
  if (submitted) return { status: "locked", score: Number((submitted as { score: number }).score) };

  const { data: marker } = await supabase.from("exam_reset_markers").select("reset_at").eq("session_id", found.dto.id).eq("candidate_hash", candidateHash).maybeSingle();
  const row = await getExamState(supabase, found.dto.id, candidateHash);
  const now = Date.now();

  if (row) {
    const st = row.state as Record<string, unknown>;
    if (marker && Number((marker as { reset_at: number }).reset_at) >= Number(st.startedAt ?? 0)) {
      await supabase.from("exam_states").delete().eq("session_id", found.dto.id).eq("candidate_hash", candidateHash);
      return { status: "reset" };
    }
    if (st.submittedAt) return { status: "locked", score: null };
    // Background reconcile: deduct away time from remaining.
    const away = Math.max(0, Math.floor((now - Number(st.lastActiveAt ?? now)) / 1000));
    let remaining = Math.max(0, Number(st.remainingSeconds ?? found.dto.durationSeconds) - away);
    if (remaining <= 0) {
      const result = await submitExamAction(found.dto.id, "time-expired");
      return result.ok
        ? { status: "locked", score: result.summary?.accuracy ?? null }
        : { status: "unavailable", error: "Time expired." };
    }
    st.remainingSeconds = remaining;
    st.lastActiveAt = now;
    await saveExamState(supabase, found.dto.id, candidateHash, st);
    const payload = await loadQuestionPayload();
    const sHash = await studentHashFor(identity.profile.first_name, identity.profile.last_name);
    const paper = paperForStudent({ questions: payload.questions }, found.dto, sHash);
    const { data: policy } = await supabase.from("exam_proctor_policies").select("camera_required").eq("session_id", found.dto.id).maybeSingle();
    return {
      status: "ready",
      paper: sanitizePaper(paper),
      remainingSeconds: Number(st.remainingSeconds),
      currentIndex: Number(st.currentIndex ?? 0),
      responses: (st.responses ?? {}) as Record<string, unknown>,
      flagged: (st.flagged ?? []) as string[],
      cameraRequired: Boolean((policy as { camera_required: boolean } | null)?.camera_required),
    };
  }

  const payload = await loadQuestionPayload();
  if (!payload.questions.length) return { status: "unavailable", error: "Question bank is empty." };
  const sHash = await studentHashFor(identity.profile.first_name, identity.profile.last_name);
  const paper = paperForStudent({ questions: payload.questions }, found.dto, sHash);
  if (!paper.length) return { status: "unavailable", error: "No questions match this exam." };
  const fingerprint = await hashText(`${found.dto.id}|${sHash}|${paper.map((q) => `${q.id}:${(q.options || []).join("~")}`).join("|")}`);
  const state = {
    candidateHash, studentHash: identity.studentHash,
    studentName: identity.profile.full_name,
    startedAt: now, submittedAt: null, attemptHash: "", paperFingerprint: fingerprint,
    questionIds: paper.map((q) => q.id), responses: {}, flagged: [], questionTimings: {},
    currentIndex: 0, remainingSeconds: found.dto.durationSeconds, elapsedActiveSeconds: 0,
    integrityEvents: [], lastActiveAt: now,
  };
  await saveExamState(supabase, found.dto.id, candidateHash, state);
  const { data: policy } = await supabase.from("exam_proctor_policies").select("camera_required").eq("session_id", found.dto.id).maybeSingle();
  return {
    status: "ready", paper: sanitizePaper(paper), remainingSeconds: found.dto.durationSeconds,
    currentIndex: 0, responses: {}, flagged: [],
    cameraRequired: Boolean((policy as { camera_required: boolean } | null)?.camera_required),
  };
}

export async function saveProgressAction(
  sessionId: string,
  patch: { responses: Record<string, unknown>; currentIndex: number; questionTimings: Record<string, number>; remainingSeconds: number; elapsedActiveSeconds: number; flagged: string[] },
): Promise<void> {
  const identity = await authIdentity();
  if (!identity) return;
  const supabase = await createSupabaseServerClient();
  const candidateHash = await candidateHashFor(sessionId.toUpperCase(), identity.profile.first_name, identity.profile.last_name);
  const row = await getExamState(supabase, sessionId.toUpperCase(), candidateHash);
  if (!row || (row.state as Record<string, unknown>).submittedAt) return;
  await saveExamState(supabase, sessionId.toUpperCase(), candidateHash, { ...row.state, ...patch, lastActiveAt: Date.now() });
}

export interface SubmitSummary {
  accuracy: number; completion: number; paceIndex: number; reasoningIndex: number;
  integrityScore: number; correctCount: number; total: number; placement?: { assignedTrack: string; confidence: number };
}

export async function submitExamAction(sessionId: string, reason: string): Promise<{ ok: boolean; summary?: SubmitSummary; error?: string }> {
  const identity = await authIdentity();
  if (!identity) return { ok: false, error: "Sign in required." };
  const found = await sessionDTO(sessionId);
  if (!found) return { ok: false, error: "Exam not found." };
  const supabase = await createSupabaseServerClient();
  const sid = found.dto.id;
  const candidateHash = await candidateHashFor(sid, identity.profile.first_name, identity.profile.last_name);
  const row = await getExamState(supabase, sid, candidateHash);
  if (!row) return { ok: false, error: "No active attempt." };
  const st = row.state as Record<string, unknown> & {
    responses: Record<string, unknown>; questionTimings: Record<string, number>;
    elapsedActiveSeconds: number; startedAt: number; integrityEvents: { type: string; detail?: string; at: number }[];
  };
  if (st.submittedAt) return { ok: false, error: "Already submitted." };

  const payload = await loadQuestionPayload();
  const sHash = await studentHashFor(identity.profile.first_name, identity.profile.last_name);
  const paper = paperForStudent({ questions: payload.questions }, found.dto, sHash);
  const result = scoreAttempt(paper, st as never, found.dto) as unknown as {
    accuracy: number; completion: number; paceIndex: number; reasoningIndex: number;
    integrityScore: number; correctCount: number; subjectStats: unknown[]; details: unknown[]; placement?: { assignedTrack: string; confidence: number };
  };
  const fingerprint = await hashText(`${sid}|${sHash}|${paper.map((q) => `${q.id}:${(q.options || []).join("~")}`).join("|")}`);
  const attemptHash = await hashText(`attempt|${sid}|${sHash}|${fingerprint}`);
  const now = Date.now();
  const answered = Math.round((result.completion / 100) * paper.length);
  const attemptRow = {
    id: randomUUID(), attempt_hash: attemptHash, candidate_hash: candidateHash, student_hash: identity.studentHash,
    paper_fingerprint: fingerprint, session_id: sid, session_title: found.dto.title,
    first_name: identity.profile.first_name, last_name: identity.profile.last_name, student_name: identity.profile.full_name,
    class_level: found.dto.classLevel, class_group: found.dto.classGroup, academic_session: found.dto.academicSession,
    mode: found.dto.mode, session_status: found.dto.status, session_ends_at: found.dto.endsAt,
    subjects: found.dto.subjects, started_at: st.startedAt, submitted_at: now,
    remaining_seconds: 0, elapsed_active_seconds: Number(st.elapsedActiveSeconds ?? 0),
    answered, question_count: paper.length, score: result.accuracy, correct_count: result.correctCount,
    completion: result.completion, pace_index: result.paceIndex, reasoning_index: result.reasoningIndex,
    integrity_score: result.integrityScore, integrity_events: st.integrityEvents ?? [],
    subject_stats: result.subjectStats, placement: result.placement ?? null, details: result.details,
    question_ids: paper.map((q) => q.id), submission_reason: reason, created_at: now,
  };
  const { data: existing } = await supabase.from("exam_attempts").select("attempt_hash").eq("session_id", sid).eq("candidate_hash", candidateHash).is("submitted_at", null).limit(1).maybeSingle();
  const saveError = existing
    ? (await supabase.from("exam_attempts").update(attemptRow).eq("attempt_hash", (existing as { attempt_hash: string }).attempt_hash)).error
    : (await supabase.from("exam_attempts").insert(attemptRow)).error;
  if (saveError) return { ok: false, error: saveError.message };
  await saveExamState(supabase, sid, candidateHash, { ...st, submittedAt: now });
  return {
    ok: true,
    summary: {
      accuracy: result.accuracy, completion: result.completion, paceIndex: result.paceIndex,
      reasoningIndex: result.reasoningIndex, integrityScore: result.integrityScore,
      correctCount: result.correctCount, total: paper.length, placement: result.placement,
    },
  };
}
