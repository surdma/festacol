"use server";

import { revalidatePath } from "next/cache";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { studentHashFor, candidateHashFor } from "@/lib/assessment";
import type { ActionResult } from "@/app/actions/student";

async function requireAdmin() {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase.auth.getUser();
  const role =
    (data.user?.app_metadata?.role as string | undefined) ??
    (data.user?.user_metadata?.role as string | undefined);
  if (!data.user || role !== "administrator") throw new Error("Administrator sign-in required.");
  return supabase;
}

interface StaffContext {
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>;
  isAdmin: boolean;
  staffId: string | null;
  subjects: string[];
  qualifierAccess: boolean;
}

// Teachers act within their subjects; admins everywhere. Mutations below use
// this instead of requireAdmin except for admin-only operations
// (staff provisioning, classes, bank sync, cohosts).
async function requireStaff(): Promise<StaffContext> {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase.auth.getUser();
  const role =
    (data.user?.app_metadata?.role as string | undefined) ??
    (data.user?.user_metadata?.role as string | undefined);
  if (!data.user || (role !== "administrator" && role !== "teacher")) {
    throw new Error("Staff sign-in required.");
  }
  const staffId =
    (data.user?.app_metadata?.staff_id as string | undefined) ??
    (data.user?.user_metadata?.staff_id as string | undefined) ??
    null;
  let subjects: string[] = [];
  let qualifierAccess = role === "administrator";
  if (role === "teacher" && staffId) {
    const { data: row } = await supabase.from("users").select("subjects,qualifier_access").eq("id", staffId).maybeSingle();
    const r = row as { subjects: string[]; qualifier_access: boolean } | null;
    subjects = r?.subjects ?? [];
    qualifierAccess = r?.qualifier_access ?? false;
  }
  return { supabase, isAdmin: role === "administrator", staffId, subjects, qualifierAccess };
}

// May this staff member touch an exam with these subjects/mode?
function inExamScope(ctx: StaffContext, subjects: string[], mode: string): boolean {
  if (ctx.isAdmin) return true;
  if (mode === "qualifier") return ctx.qualifierAccess;
  if (!subjects.length) return true;
  const mine = new Set(ctx.subjects);
  return subjects.some((s) => mine.has(s));
}

async function scopedSession(ctx: StaffContext, id: string) {
  const { data } = await ctx.supabase.from("exam_sessions").select("*").eq("id", id).maybeSingle();
  const s = data as { subjects: string[]; mode: string } | null;
  if (!s) return null;
  if (!inExamScope(ctx, s.subjects ?? [], s.mode)) return null;
  return data;
}

function examId(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let suffix = "";
  const bytes = crypto.getRandomValues(new Uint8Array(6));
  for (const b of bytes) suffix += chars[b % chars.length];
  return `FST-${suffix}`;
}

// ---------------------------------------------------------------- exams
export interface ExamWizardInput {
  title: string;
  classLevel: "SS1" | "SS2" | "SS3";
  classGroup: string;
  mode: "qualifier" | "bece" | "waec" | "neco" | "jamb" | "mixed" | "single";
  subjects: string[];
  durationSeconds: number;
  questionCount: number;
  status: "open" | "draft" | "closed";
  instructions: string;
  cameraRequired: boolean;
  warnAfter: number;
}

export async function createExamAction(input: ExamWizardInput): Promise<ActionResult & { id?: string }> {
  try {
    const ctx = await requireStaff();
    const supabase = ctx.supabase;
    if (!inExamScope(ctx, input.subjects, input.mode)) {
      return { ok: false, error: "Outside your subject scope." };
    }
    const now = Date.now();
    const id = examId();
    const { error } = await supabase.from("exam_sessions").insert({
      id,
      title: input.title.trim().slice(0, 72),
      class_level: input.classLevel,
      class_group: input.classGroup || "General",
      academic_session: "2026/2027",
      term: "First term",
      mode: input.mode,
      subjects: input.subjects,
      placement_tracks: [],
      duration_seconds: Math.min(10800, Math.max(30, input.durationSeconds)),
      question_count: Math.min(150, Math.max(5, input.questionCount)),
      status: input.status,
      instructions: input.instructions.slice(0, 140),
      starts_at: null,
      ends_at: null,
      attempt_limit: 1,
      integrity_policy: { focusMonitoring: true, fullscreenPrompt: true, clipboardGuard: true, warnAfter: input.warnAfter },
      randomization: { questionOrder: true, optionOrder: true, minimizePaperCollisions: true },
      created_at: now,
      updated_at: now,
    });
    if (error) return { ok: false, error: error.message };
    await supabase.from("exam_proctor_policies").upsert({ session_id: id, camera_required: input.cameraRequired, updated_at: now });
    revalidatePath("/admin/exams");
    return { ok: true, id };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Create failed." };
  }
}

export async function updateExamAction(
  id: string,
  patch: { title: string; durationSeconds: number; questionCount: number; instructions: string; status: string; cameraRequired: boolean; warnAfter: number },
): Promise<ActionResult> {
  try {
    const ctx = await requireStaff();
    const supabase = ctx.supabase;
    if (!(await scopedSession(ctx, id))) return { ok: false, error: "Outside your subject scope." };
    const { error } = await supabase
      .from("exam_sessions")
      .update({
        title: patch.title.trim().slice(0, 72),
        duration_seconds: patch.durationSeconds,
        question_count: patch.questionCount,
        instructions: patch.instructions.slice(0, 140),
        status: patch.status,
        integrity_policy: { focusMonitoring: true, fullscreenPrompt: true, clipboardGuard: true, warnAfter: patch.warnAfter },
        updated_at: Date.now(),
      })
      .eq("id", id);
    if (error) return { ok: false, error: error.message };
    await supabase.from("exam_proctor_policies").upsert({ session_id: id, camera_required: patch.cameraRequired, updated_at: Date.now() });
    revalidatePath("/admin/exams");
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Update failed." };
  }
}

export async function setExamStatusAction(id: string, status: "open" | "draft" | "closed"): Promise<ActionResult> {
  try {
    const ctx = await requireStaff();
    const supabase = ctx.supabase;
    if (!(await scopedSession(ctx, id))) return { ok: false, error: "Outside your subject scope." };
    const { error } = await supabase.from("exam_sessions").update({ status, updated_at: Date.now() }).eq("id", id);
    if (error) return { ok: false, error: error.message };
    revalidatePath("/admin/exams");
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Update failed." };
  }
}

export async function duplicateExamAction(id: string): Promise<ActionResult & { id?: string }> {
  try {
    const ctx = await requireStaff();
    const supabase = ctx.supabase;
    const src = await scopedSession(ctx, id);
    if (!src) return { ok: false, error: "Exam not found or outside your scope." };
    const now = Date.now();
    const nextId = examId();
    const row = src as Record<string, unknown>;
    const { error } = await supabase.from("exam_sessions").insert({ ...row, id: nextId, title: `${String(row.title)} (copy)`.slice(0, 72), status: "draft", created_at: now, updated_at: now });
    if (error) return { ok: false, error: error.message };
    revalidatePath("/admin/exams");
    return { ok: true, id: nextId };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Duplicate failed." };
  }
}

export async function deleteExamAction(id: string): Promise<ActionResult> {
  try {
    const ctx = await requireStaff();
    const supabase = ctx.supabase;
    if (!(await scopedSession(ctx, id))) return { ok: false, error: "Outside your subject scope." };
    const { error } = await supabase.from("exam_sessions").delete().eq("id", id);
    if (error) return { ok: false, error: error.message };
    revalidatePath("/admin/exams");
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Delete failed." };
  }
}

// ---------------------------------------------------------------- users
export async function upsertUserAction(input: { id?: string; fullName: string; role: string; classId?: string; guardian?: string }): Promise<ActionResult> {
  try {
    const ctx = await requireStaff();
    const supabase = ctx.supabase;
    // Teachers manage students only — never staff.
    const role = ctx.isAdmin ? input.role : "student";
    if (!ctx.isAdmin && input.id) {
      const { data: existing } = await supabase.from("users").select("role").eq("id", input.id).maybeSingle();
      if ((existing as { role: string } | null)?.role !== "student") return { ok: false, error: "Teachers manage students only." };
    }
    const parts = input.fullName.trim().split(/\s+/);
    const first = parts[0] ?? "";
    const last = parts.slice(1).join(" ") || first;
    if (first.length < 2) return { ok: false, error: "Enter a valid name." };
    const row = {
      full_name: input.fullName.trim(),
      first_name: first,
      last_name: last,
      role,
      class_id: input.classId || null,
      guardian: input.guardian ?? "",
      academic_session: "2026/2027",
      joined_at: Date.now(),
    };
    const { error } = input.id
      ? await supabase.from("users").update(row).eq("id", input.id)
      : await supabase.from("users").insert({ ...row, id: `ST-${Date.now().toString(36).toUpperCase()}`, status: "active", promotion_status: "on-track" });
    if (error) return { ok: false, error: error.message };
    revalidatePath("/admin/students");
    revalidatePath("/admin/staff");
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Save failed." };
  }
}

export async function toggleUserAction(id: string, active: boolean): Promise<ActionResult> {
  try {
    const ctx = await requireStaff();
    const supabase = ctx.supabase;
    if (!ctx.isAdmin) {
      const { data: existing } = await supabase.from("users").select("role").eq("id", id).maybeSingle();
      if ((existing as { role: string } | null)?.role !== "student") return { ok: false, error: "Teachers manage students only." };
    }
    const { error } = await supabase.from("users").update({ status: active ? "active" : "inactive" }).eq("id", id);
    if (error) return { ok: false, error: error.message };
    revalidatePath("/admin/students");
    revalidatePath("/admin/staff");
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Update failed." };
  }
}

// ---------------------------------------------------------------- classes + whatsapp
export async function upsertClassAction(input: { id?: string; classLevel: string; stream: string; arm: string; capacity: number; room: string }): Promise<ActionResult> {
  try {
    const supabase = await requireAdmin();
    const arm = input.arm.trim().toUpperCase().slice(0, 4) || "A";
    const id = input.id ?? `${input.classLevel.toLowerCase()}-${input.stream.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-${arm.toLowerCase()}-${Date.now().toString(36)}`;
    const { error } = await supabase.from("classes").upsert({
      id,
      class_level: input.classLevel,
      name: `${input.classLevel} ${input.stream} ${arm}`,
      stream: input.stream,
      grp: input.stream,
      arm,
      capacity: input.capacity,
      room: input.room,
      academic_session: "2026/2027",
      status: "active",
    });
    if (error) return { ok: false, error: error.message };
    revalidatePath("/admin/classes");
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Save failed." };
  }
}

export async function deleteClassAction(id: string): Promise<ActionResult> {
  try {
    const supabase = await requireAdmin();
    const { error } = await supabase.from("classes").delete().eq("id", id);
    if (error) return { ok: false, error: error.message };
    revalidatePath("/admin/classes");
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Delete failed." };
  }
}

export async function upsertWhatsappAction(input: { id?: string; classId: string; name: string; inviteUrl: string }): Promise<ActionResult> {
  try {
    const supabase = await requireAdmin();
    if (!/^https:\/\/(chat\.whatsapp\.com|www\.whatsapp\.com)\//.test(input.inviteUrl)) {
      return { ok: false, error: "Enter a valid WhatsApp invite link." };
    }
    const now = Date.now();
    const { error } = input.id
      ? await supabase.from("whatsapp_groups").update({ class_id: input.classId, name: input.name, invite_url: input.inviteUrl, updated_at: now }).eq("id", input.id)
      : await supabase.from("whatsapp_groups").insert({ id: `WA-${Date.now().toString(36).toUpperCase()}`, class_id: input.classId, name: input.name, invite_url: input.inviteUrl, created_at: now, updated_at: now });
    if (error) return { ok: false, error: error.message };
    revalidatePath("/admin/classes");
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Save failed." };
  }
}

export async function deleteWhatsappAction(id: string): Promise<ActionResult> {
  try {
    const supabase = await requireAdmin();
    const { error } = await supabase.from("whatsapp_groups").delete().eq("id", id);
    if (error) return { ok: false, error: error.message };
    revalidatePath("/admin/classes");
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Delete failed." };
  }
}

// ---------------------------------------------------------------- questions
export async function upsertQuestionAction(input: { subject: string; subjectCode: string; kind: string; prompt: string; options: string[]; correct: string; levels: string[] }): Promise<ActionResult> {
  try {
    const ctx = await requireStaff();
    const supabase = ctx.supabase;
    if (!ctx.isAdmin && !ctx.subjects.includes(input.subjectCode)) {
      return { ok: false, error: "Outside your subject scope." };
    }
    if (!input.prompt.trim()) return { ok: false, error: "Enter the question prompt." };
    const { data: maxRow } = await supabase.from("questions").select("id").order("id", { ascending: false }).limit(1).maybeSingle();
    const nextId = Number((maxRow as { id: number } | null)?.id ?? 0) + 1;
    const { error } = await supabase.from("questions").insert({
      id: nextId,
      origin: "teacher",
      data: { subject: input.subject, type: input.kind, prompt: input.prompt, options: input.options, answer: input.correct, levels: input.levels, examModes: ["single", "mixed", "qualifier", "waec"] },
      subject_code: input.subjectCode,
      updated_at: Date.now(),
    });
    if (error) return { ok: false, error: error.message };
    revalidatePath("/admin/questions");
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Save failed." };
  }
}

export async function deleteQuestionAction(id: number): Promise<ActionResult> {
  try {
    const ctx = await requireStaff();
    const supabase = ctx.supabase;
    const { data } = await supabase.from("questions").select("origin,subject_code").eq("id", id).maybeSingle();
    const q = data as { origin: string; subject_code: string } | null;
    if (q?.origin !== "teacher") return { ok: false, error: "Only teacher-created questions can be deleted." };
    if (!ctx.isAdmin && !ctx.subjects.includes(q.subject_code)) return { ok: false, error: "Outside your subject scope." };
    const { error } = await supabase.from("questions").delete().eq("id", id);
    if (error) return { ok: false, error: error.message };
    revalidatePath("/admin/questions");
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Delete failed." };
  }
}

export async function syncQuestionBankAction(): Promise<ActionResult & { count?: number }> {
  try {
    const supabase = await requireAdmin();
    const file = await readFile(path.join(process.cwd(), "public", "seed", "questions.json"), "utf8");
    const parsed = JSON.parse(file) as { questions?: unknown[] } | unknown[];
    const list = (Array.isArray(parsed) ? parsed : parsed.questions ?? []) as Record<string, unknown>[];
    if (!list.length) return { ok: false, error: "Seed file has no questions." };
    const rows = list.map((q, i) => ({
      id: Number(q.id ?? i + 1),
      origin: "seed",
      data: q,
      subject_code: String(q.subjectCode ?? ""),
      updated_at: Date.now(),
    }));
    for (let i = 0; i < rows.length; i += 200) {
      const { error } = await supabase.from("questions").upsert(rows.slice(i, i + 200));
      if (error) return { ok: false, error: error.message };
    }
    await supabase.from("question_bank").upsert({
      id: 1,
      question_set_id: "seed-v1",
      subject_catalog: [...new Set(rows.map((r) => r.subject_code).filter(Boolean))],
      question_count: rows.length,
      updated_at: Date.now(),
    });
    revalidatePath("/admin/questions");
    return { ok: true, count: rows.length };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Sync failed." };
  }
}

// ---------------------------------------------------------------- attempts
async function scopedAttempt(ctx: StaffContext, attemptHash: string) {
  const { data } = await ctx.supabase.from("exam_attempts").select("session_id").eq("attempt_hash", attemptHash).maybeSingle();
  const sid = (data as { session_id: string | null } | null)?.session_id;
  if (!sid) return null;
  return scopedSession(ctx, sid);
}

export async function resetUnfinishedAttemptAction(sessionId: string, candidateHash: string): Promise<ActionResult> {
  try {
    const ctx = await requireStaff();
    const supabase = ctx.supabase;
    if (!(await scopedSession(ctx, sessionId))) return { ok: false, error: "Outside your subject scope." };
    const { error } = await supabase.from("exam_states").delete().eq("session_id", sessionId).eq("candidate_hash", candidateHash);
    if (error) return { ok: false, error: error.message };
    revalidatePath("/admin/exams");
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Reset failed." };
  }
}

export async function authorizeRewriteAction(attemptHash: string): Promise<ActionResult> {
  try {
    const ctx = await requireStaff();
    const supabase = ctx.supabase;
    if (!(await scopedAttempt(ctx, attemptHash))) return { ok: false, error: "Outside your subject scope." };
    const { data } = await supabase.from("exam_attempts").select("session_id,candidate_hash").eq("attempt_hash", attemptHash).maybeSingle();
    const row = data as { session_id: string | null; candidate_hash: string } | null;
    if (!row?.session_id) return { ok: false, error: "Attempt not found." };
    const now = Date.now();
    const { error } = await supabase.from("exam_attempts").update({ rewrite_archived_at: now }).eq("attempt_hash", attemptHash);
    if (error) return { ok: false, error: error.message };
    await supabase.from("exam_states").delete().eq("session_id", row.session_id).eq("candidate_hash", row.candidate_hash);
    await supabase.from("exam_reset_markers").upsert({ session_id: row.session_id, candidate_hash: row.candidate_hash, reset_at: now });
    revalidatePath("/admin/exams");
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Authorize failed." };
  }
}

// ---------------------------------------------------------------- detail reads
export async function getExamDetailAction(examId: string) {
  const ctx = await requireStaff();
  const supabase = ctx.supabase;
  if (!(await scopedSession(ctx, examId))) return { session: null, attempts: [] };
  const [{ data: session }, { data: attempts }] = await Promise.all([
    supabase.from("exam_sessions").select("*").eq("id", examId).maybeSingle(),
    supabase.from("exam_attempts").select("attempt_hash,student_name,score,submitted_at,started_at").eq("session_id", examId).order("created_at", { ascending: false }).limit(100),
  ]);
  return { session, attempts: attempts ?? [] };
}

export async function getUserDetailAction(userId: string) {
  const ctx = await requireStaff();
  const supabase = ctx.supabase;
  const { data: user } = await supabase.from("users").select("*").eq("id", userId).maybeSingle();
  if (!ctx.isAdmin && (user as { role: string } | null)?.role !== "student") {
    return { user: null, attempts: [] };
  }
  const u = user as { first_name: string; last_name: string } | null;
  let attempts: unknown[] = [];
  if (u) {
    const sHash = await studentHashFor(u.first_name, u.last_name);
    const { data } = await supabase.from("exam_attempts").select("attempt_hash,session_title,score,integrity_score,submitted_at").eq("student_hash", sHash).order("created_at", { ascending: false }).limit(50);
    attempts = data ?? [];
  }
  return { user, attempts };
}

export async function getAttemptDetailAction(attemptHash: string) {
  const ctx = await requireStaff();
  if (!(await scopedAttempt(ctx, attemptHash))) return { attempt: null };
  const supabase = ctx.supabase;
  const { data } = await supabase.from("exam_attempts").select("*").eq("attempt_hash", attemptHash).maybeSingle();
  return { attempt: data };
}

export async function getQuestionDetailAction(id: number) {
  const supabase = await requireAdmin();
  const { data } = await supabase.from("questions").select("*").eq("id", id).maybeSingle();
  return { question: data };
}

export async function isAdminAction(): Promise<boolean> {
  try {
    await requireAdmin();
    return true;
  } catch {
    return false;
  }
}

export async function getStaffListAction(): Promise<{ id: string; full_name: string; subjects: string[] }[]> {
  const supabase = await requireAdmin();
  const { data } = await supabase.from("users").select("id,full_name,subjects").in("role", ["teacher", "administrator"]).order("full_name").limit(200);
  return ((data ?? []) as { id: string; full_name: string; subjects: string[] }[]).map((u) => ({ ...u, subjects: u.subjects ?? [] }));
}

export async function updateCohostsAction(examId: string, cohosts: string[]): Promise<ActionResult> {
  try {
    const supabase = await requireAdmin();
    const { error } = await supabase.from("exam_sessions").update({ cohosts, updated_at: Date.now() }).eq("id", examId);
    if (error) return { ok: false, error: error.message };
    revalidatePath("/admin/exams");
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Update failed." };
  }
}

export async function getSubjectsAction(): Promise<string[]> {
  const ctx = await requireStaff();
  const supabase = ctx.supabase;
  const [{ data: bank }, { data: questions }] = await Promise.all([
    supabase.from("question_bank").select("subject_catalog").eq("id", 1).maybeSingle(),
    supabase.from("questions").select("subject_code").limit(1000),
  ]);
  const catalog = (bank as { subject_catalog: string[] } | null)?.subject_catalog;
  if (Array.isArray(catalog) && catalog.length) return catalog;
  return [...new Set(((questions ?? []) as { subject_code: string }[]).map((q) => q.subject_code).filter(Boolean))];
}

export async function getSessionOptionsAction() {
  const ctx = await requireStaff();
  const supabase = ctx.supabase;
  const [{ data: classes }] = await Promise.all([supabase.from("classes").select("id,name,class_level").limit(100)]);
  return { classes: (classes ?? []) as { id: string; name: string; class_level: string }[] };
}

// Teacher self-service: choose your major subject(s) after the admin creates
// your account. qualifier_access stays admin-only (staff endpoint).
export async function updateMySubjectsAction(subjects: string[]): Promise<ActionResult> {
  try {
    const ctx = await requireStaff();
    if (ctx.isAdmin || !ctx.staffId) return { ok: false, error: "Teachers only." };
    const clean = [...new Set(subjects.map((s) => String(s).trim()).filter(Boolean))].slice(0, 12);
    if (!clean.length) return { ok: false, error: "Choose at least one subject." };
    const { error } = await ctx.supabase.from("users").update({ subjects: clean }).eq("id", ctx.staffId);
    if (error) return { ok: false, error: error.message };
    revalidatePath("/admin");
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Save failed." };
  }
}

export async function getMyScopeAction(): Promise<{ isAdmin: boolean; subjects: string[]; qualifierAccess: boolean }> {
  const ctx = await requireStaff();
  return { isAdmin: ctx.isAdmin, subjects: ctx.subjects, qualifierAccess: ctx.qualifierAccess };
}

// ------------------------------------------------------------ subjects
export async function getActiveSubjectsAction(): Promise<{ code: string; name: string; streams: string[] }[]> {
  const ctx = await requireStaff();
  const { data } = await ctx.supabase.from("subjects").select("code,name,streams").eq("active", true).order("name");
  const rows = (data ?? []) as { code: string; name: string; streams: string[] }[];
  if (rows.length) return rows;
  // Fallback until the catalog is seeded: bank catalog + distinct codes.
  const catalog = await getSubjectsAction();
  return catalog.map((c) => ({ code: c, name: c, streams: [] }));
}

export async function seedSubjectsAction(): Promise<ActionResult & { count?: number }> {
  try {
    const supabase = await requireAdmin();
    const { WAEC_SUBJECTS } = await import("@/lib/subjects-catalog");
    const now = Date.now();
    const rows = WAEC_SUBJECTS.map((s) => ({ code: s.code, name: s.name, category: s.category, streams: s.streams, active: true, updated_at: now }));
    const { error } = await supabase.from("subjects").upsert(rows);
    if (error) return { ok: false, error: error.message };
    return { ok: true, count: rows.length };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Seed failed." };
  }
}

export async function upsertSubjectAction(input: { code: string; name: string; category: string; streams: string[] }): Promise<ActionResult> {
  try {
    const supabase = await requireAdmin();
    const code = input.code.trim().toLowerCase().replace(/[^a-z0-9-]/g, "").slice(0, 20);
    if (!code || !input.name.trim()) return { ok: false, error: "Code and name are required." };
    const { error } = await supabase.from("subjects").upsert({
      code, name: input.name.trim(), category: input.category,
      streams: [...new Set(input.streams)].slice(0, 8), active: true, updated_at: Date.now(),
    });
    if (error) return { ok: false, error: error.message };
    revalidatePath("/admin/settings");
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Save failed." };
  }
}

export async function toggleSubjectAction(code: string, active: boolean): Promise<ActionResult> {
  try {
    const supabase = await requireAdmin();
    const { error } = await supabase.from("subjects").update({ active, updated_at: Date.now() }).eq("code", code);
    if (error) return { ok: false, error: error.message };
    revalidatePath("/admin/settings");
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Update failed." };
  }
}
