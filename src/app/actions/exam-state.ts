"use server";

import { randomUUID } from "node:crypto";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  getExamProgress,
  getIntegrityEvents,
  getStudentProfile,
  saveExamProgress,
} from "@/lib/supabase/queries";
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
  const dto = {
    id: s.id, title: s.title, classLevel: s.class_level, classGroup: s.class_group,
    academicSession: s.academic_session, term: s.term, mode: s.mode,
    subjects: (s.subjects ?? []) as string[],
    placementTracks: (s.placement_tracks ?? []) as string[],
    durationSeconds: s.duration_seconds, questionCount: s.question_count,
    status: s.status, instructions: s.instructions,
    startsAt: s.starts_at ? Number(s.starts_at) : null,
    endsAt: s.ends_at ? Number(s.ends_at) : null,
    integrityPolicy: {
      focusMonitoring: s.focus_monitoring ?? true,
      fullscreenPrompt: s.fullscreen_prompt ?? true,
      clipboardGuard: s.clipboard_guard ?? true,
      warnAfter: Number(s.warn_after ?? 2),
    },
    randomization: {
      questionOrder: s.question_order ?? true,
      optionOrder: s.option_order ?? true,
      minimizePaperCollisions: s.minimize_collisions ?? true,
    },
  } as ExamSessionDTO;
  return { dto };
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

function splitResponse(value: unknown): { text: string | null; values: string[] } {
  if (typeof value === "string") return { text: value, values: [] };
  if (typeof value === "boolean") return { text: String(value), values: [] };
  if (Array.isArray(value)) return { text: null, values: value.map(String) };
  if (value && typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>).sort(([a], [b]) => (a < b ? -1 : 1));
    if (entries.length === 1) {
      const v = entries[0][1];
      return Array.isArray(v) ? { text: null, values: v.map(String) } : { text: String(v ?? ""), values: [] };
    }
    return { text: null, values: entries.map(([, v]) => String(v ?? "")) };
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
  const progress = await getExamProgress(supabase, found.dto.id, candidateHash);
  const now = Date.now();

  if (progress) {
    if (marker && Number((marker as { reset_at: number }).reset_at) >= Number(progress.started_at ?? 0)) {
      await supabase.from("exam_states").delete().eq("session_id", found.dto.id).eq("candidate_hash", candidateHash);
      return { status: "reset" };
    }
    if (progress.submitted_at) return { status: "locked", score: null };
    // Background reconcile: deduct away time from remaining.
    const away = Math.max(0, Math.floor((now - Number(progress.last_active_at ?? now)) / 1000));
    const remaining = Math.max(0, Number(progress.remaining_seconds ?? found.dto.durationSeconds) - away);
    if (remaining <= 0) {
      const result = await submitExamAction(found.dto.id, "time-expired");
      return result.ok
        ? { status: "locked", score: result.summary?.accuracy ?? null }
        : { status: "unavailable", error: "Time expired." };
    }
    await saveExamProgress(supabase, found.dto.id, candidateHash,
      { remaining_seconds: remaining, last_active_at: now }, []);
    const payload = await loadQuestionPayload();
    const sHash = await studentHashFor(identity.profile.first_name, identity.profile.last_name);
    const paper = paperForStudent({ questions: payload.questions }, found.dto, sHash);
    const { data: policy } = await supabase.from("exam_proctor_policies").select("camera_required").eq("session_id", found.dto.id).maybeSingle();
    const responses: Record<string, unknown> = {};
    const timings: Record<string, number> = {};
    const flagged: string[] = [];
    for (const r of progress.responses) {
      responses[String(r.question_id)] = joinResponse(r.response_text, r.response_values ?? []);
      timings[String(r.question_id)] = Number(r.seconds ?? 0);
      if (r.flagged) flagged.push(String(r.question_id));
    }
    void timings;
    return {
      status: "ready",
      paper: sanitizePaper(paper),
      remainingSeconds: remaining,
      currentIndex: progress.current_index,
      responses, flagged,
      cameraRequired: Boolean((policy as { camera_required: boolean } | null)?.camera_required),
    };
  }

  const payload = await loadQuestionPayload();
  if (!payload.questions.length) return { status: "unavailable", error: "Question bank is empty." };
  const sHash = await studentHashFor(identity.profile.first_name, identity.profile.last_name);
  const paper = paperForStudent({ questions: payload.questions }, found.dto, sHash);
  if (!paper.length) return { status: "unavailable", error: "No questions match this exam." };
  const fingerprint = await hashText(`${found.dto.id}|${sHash}|${paper.map((q) => `${q.id}:${(q.options || []).join("~")}`).join("|")}`);
  await saveExamProgress(supabase, found.dto.id, candidateHash, {
    started_at: now, submitted_at: null, current_index: 0,
    remaining_seconds: found.dto.durationSeconds, elapsed_active_seconds: 0,
    last_active_at: now, attempt_hash: "", paper_fingerprint: fingerprint,
    question_ids: paper.map((q) => q.id),
  }, []);
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
  const sid = sessionId.toUpperCase();
  const candidateHash = await candidateHashFor(sid, identity.profile.first_name, identity.profile.last_name);
  const progress = await getExamProgress(supabase, sid, candidateHash);
  if (!progress || progress.submitted_at) return;
  const flaggedSet = new Set(patch.flagged);
  const rows = Object.entries(patch.responses).map(([qid, value]) => {
    const { text, values } = splitResponse(value);
    return {
      question_id: Number(qid),
      response_text: text,
      response_values: values,
      seconds: Number(patch.questionTimings[qid] ?? 0),
      flagged: flaggedSet.has(qid),
    };
  });
  await saveExamProgress(supabase, sid, candidateHash, {
    current_index: patch.currentIndex,
    remaining_seconds: Math.max(0, Math.round(patch.remainingSeconds)),
    elapsed_active_seconds: patch.elapsedActiveSeconds,
    last_active_at: Date.now(),
  }, rows);
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
  const progress = await getExamProgress(supabase, sid, candidateHash);
  if (!progress) return { ok: false, error: "No active attempt." };
  if (progress.submitted_at) return { ok: false, error: "Already submitted." };

  const responses: Record<string, unknown> = {};
  const timings: Record<string, number> = {};
  for (const r of progress.responses) {
    responses[String(r.question_id)] = joinResponse(r.response_text, r.response_values ?? []);
    timings[String(r.question_id)] = Number(r.seconds ?? 0);
  }
  const events = await getIntegrityEvents(supabase, sid, candidateHash);
  const payload = await loadQuestionPayload();
  const sHash = await studentHashFor(identity.profile.first_name, identity.profile.last_name);
  const paper = paperForStudent({ questions: payload.questions }, found.dto, sHash);
  const result = scoreAttempt(paper, {
    responses, questionTimings: timings,
    elapsedActiveSeconds: progress.elapsed_active_seconds,
    startedAt: progress.started_at ?? Date.now(), submittedAt: null, integrityEvents: events,
  }, found.dto) as unknown as {
    accuracy: number; completion: number; paceIndex: number; reasoningIndex: number;
    integrityScore: number; correctCount: number;
    subjectStats: { subjectCode: string; subject: string; total: number; correct: number; seconds: number; percent: number }[];
    details: { questionId: number; subjectCode: string; subject: string; correct: boolean | null; response: unknown; correctAnswer: string; seconds: number }[];
    placement?: { assignedTrack: string; confidence: number };
  };
  const fingerprint = progress.paper_fingerprint ||
    await hashText(`${sid}|${sHash}|${paper.map((q) => `${q.id}:${(q.options || []).join("~")}`).join("|")}`);
  const attemptHash = await hashText(`attempt|${sid}|${sHash}|${fingerprint}`);
  const now = Date.now();
  const answered = Math.round((result.completion / 100) * paper.length);
  const attemptRow = {
    id: randomUUID(), attempt_hash: attemptHash, candidate_hash: candidateHash, student_hash: identity.studentHash,
    paper_fingerprint: fingerprint, session_id: sid, session_title: found.dto.title,
    first_name: identity.profile.first_name, last_name: identity.profile.last_name, student_name: identity.profile.full_name,
    class_level: found.dto.classLevel, class_group: found.dto.classGroup, academic_session: found.dto.academicSession,
    mode: found.dto.mode, session_status: found.dto.status, session_ends_at: found.dto.endsAt,
    started_at: progress.started_at, submitted_at: now,
    remaining_seconds: 0, elapsed_active_seconds: Number(progress.elapsed_active_seconds ?? 0),
    answered, question_count: paper.length, score: result.accuracy, correct_count: result.correctCount,
    completion: result.completion, pace_index: result.paceIndex, reasoning_index: result.reasoningIndex,
    integrity_score: result.integrityScore,
    assigned_track: result.placement?.assignedTrack ?? null,
    placement_confidence: result.placement?.confidence ?? null,
    submission_reason: reason, created_at: now,
  };
  const { data: existing } = await supabase.from("exam_attempts").select("attempt_hash").eq("session_id", sid).eq("candidate_hash", candidateHash).is("submitted_at", null).limit(1).maybeSingle();
  const targetHash = (existing as { attempt_hash: string } | null)?.attempt_hash;
  const saveError = targetHash
    ? (await supabase.from("exam_attempts").update(attemptRow).eq("attempt_hash", targetHash)).error
    : (await supabase.from("exam_attempts").insert(attemptRow)).error;
  if (saveError) return { ok: false, error: saveError.message };
  const finalHash = targetHash ?? attemptHash;
  await supabase.from("exam_attempt_answers").insert(result.details.map((d) => {
    const { text, values } = splitResponse(d.response);
    return {
      attempt_hash: finalHash, session_id: sid, candidate_hash: candidateHash,
      question_id: d.questionId, subject_code: d.subjectCode, subject_name: d.subject,
      correct: d.correct, response_text: text, response_values: values,
      correct_answer: String(d.correctAnswer ?? ""), seconds: d.seconds,
    };
  }));
  await supabase.from("exam_attempt_subject_stats").insert(result.subjectStats.map((s) => ({
    attempt_hash: finalHash, subject_code: s.subjectCode, subject_name: s.subject,
    total: s.total, correct: s.correct, seconds: s.seconds, percent: s.percent,
  })));
  await supabase.from("exam_integrity_events").update({ attempt_hash: finalHash }).eq("session_id", sid).eq("candidate_hash", candidateHash).is("attempt_hash", null);
  await saveExamProgress(supabase, sid, candidateHash, { submitted_at: now }, []);
  return {
    ok: true,
    summary: {
      accuracy: result.accuracy, completion: result.completion, paceIndex: result.paceIndex,
      reasoningIndex: result.reasoningIndex, integrityScore: result.integrityScore,
      correctCount: result.correctCount, total: paper.length, placement: result.placement,
    },
  };
}
