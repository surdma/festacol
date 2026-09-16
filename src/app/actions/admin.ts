"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import type { ActionResult } from "@/app/actions/student";
import {
  upsertClassAction as upsertCanonicalClassAction,
  upsertClassOfferingAction as upsertCanonicalOfferingAction,
} from "@/app/actions/academic-structure";
import {
  seedSubjectCatalogFromFixtureAction,
  syncQuestionBankFromFixtureAction,
} from "@/app/actions/question-bank";
import { currentStaff, questionSubjectVisibleTo, type StaffScope } from "@/lib/auth/staff";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import type { AcademicTrack } from "@/types/db";

interface StaffContext {
  supabase: Awaited<ReturnType<typeof currentStaff>>["supabase"];
  admin: ReturnType<typeof createSupabaseAdminClient>;
  scope: StaffScope;
}

async function requireStaff(): Promise<StaffContext> {
  const current = await currentStaff();
  if (!current.scope.profileId || (!current.scope.isAdmin && !current.scope.isTeacher)) {
    throw new Error("Staff sign-in required.");
  }
  return { supabase: current.supabase, admin: createSupabaseAdminClient(), scope: current.scope };
}

async function requireAdmin(): Promise<StaffContext> {
  const current = await requireStaff();
  if (!current.scope.isAdmin) throw new Error("Administrator sign-in required.");
  return current;
}

async function scopedSession(ctx: StaffContext, id: string) {
  const { data } = await ctx.supabase.from("exam_sessions").select("*").eq("id", id.toUpperCase()).maybeSingle();
  return data as Record<string, unknown> | null;
}

function examId(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let suffix = "";
  const bytes = crypto.getRandomValues(new Uint8Array(6));
  for (const byte of bytes) suffix += chars[byte % chars.length];
  return `FST-${suffix}`;
}

async function teacherMayManageClass(ctx: StaffContext, classId: string): Promise<boolean> {
  if (ctx.scope.isAdmin) return true;
  const { data: offerings } = await ctx.supabase
    .from("class_subject_offerings")
    .select("id")
    .eq("class_id", classId)
    .eq("status", "active");
  const offeringIds = ((offerings ?? []) as { id: string }[]).map((row) => row.id);
  if (!offeringIds.length) return false;
  const { count } = await ctx.supabase
    .from("teaching_assignments")
    .select("id", { count: "exact", head: true })
    .eq("staff_id", ctx.scope.profileId!)
    .in("offering_id", offeringIds)
    .is("ended_at", null);
  return (count ?? 0) > 0;
}

// ---------------------------------------------------------------- exams
export interface ExamWizardInput {
  title: string;
  classLevel: "SS1" | "SS2" | "SS3";
  mode: "qualifier" | "bece" | "waec" | "neco" | "jamb" | "mixed" | "single";
  subjectIds: string[];
  offeringIds: string[];
  classIds: string[];
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
    const subjectIds = [...new Set(input.subjectIds.filter(Boolean))];
    const offeringIds = [...new Set(input.offeringIds.filter(Boolean))];
    const classIds = [...new Set(input.classIds.filter(Boolean))];
    if (!offeringIds.length && !classIds.length) return { ok: false, error: "Choose at least one class or subject offering." };
    if (subjectIds.some((subjectId) => !questionSubjectVisibleTo(subjectId, ctx.scope))) {
      return { ok: false, error: "One or more subjects are outside your qualification scope." };
    }

    const { data: offerings, error: offeringError } = offeringIds.length
      ? await ctx.admin.from("class_subject_offerings").select("id,class_id,subject_id,status").in("id", offeringIds)
      : { data: [], error: null };
    if (offeringError) return { ok: false, error: offeringError.message };
    const offeringRows = (offerings ?? []) as { id: string; class_id: string; subject_id: string; status: string }[];
    if (offeringRows.length !== offeringIds.length || offeringRows.some((row) => row.status !== "active")) {
      return { ok: false, error: "Every selected subject offering must be active." };
    }
    if (subjectIds.length && offeringRows.some((row) => !subjectIds.includes(row.subject_id))) {
      return { ok: false, error: "Exam subjects and subject offerings do not match." };
    }

    if (!ctx.scope.isAdmin && offeringIds.length) {
      const { data: assignments } = await ctx.supabase
        .from("teaching_assignments")
        .select("offering_id")
        .eq("staff_id", ctx.scope.profileId!)
        .is("ended_at", null)
        .in("offering_id", offeringIds);
      const assigned = new Set(((assignments ?? []) as { offering_id: string }[]).map((row) => row.offering_id));
      if (offeringIds.some((offeringId) => !assigned.has(offeringId))) {
        return { ok: false, error: "You may create exams only for subject offerings you teach." };
      }
    }

    const allClassIds = [...new Set([...classIds, ...offeringRows.map((row) => row.class_id)])];
    const [{ data: classes }, { data: level }] = await Promise.all([
      ctx.admin.from("classes").select("id,level_id,academic_year_id").in("id", allClassIds),
      ctx.admin.from("academic_levels").select("id").eq("name", input.classLevel).eq("active", true).maybeSingle(),
    ]);
    const classRows = (classes ?? []) as { id: string; level_id: string; academic_year_id: string }[];
    const levelId = (level as { id?: string } | null)?.id;
    if (!levelId) return { ok: false, error: "Academic level is not configured." };
    if (classRows.length !== allClassIds.length) return { ok: false, error: "One or more target classes no longer exist." };
    if (classRows.some((row) => row.level_id !== levelId)) return { ok: false, error: "All target classes must match the selected academic level." };
    const academicYearIds = [...new Set(classRows.map((row) => row.academic_year_id))];
    if (academicYearIds.length !== 1) return { ok: false, error: "All target classes must belong to the same academic year." };

    const { data: activeTerm } = await ctx.admin
      .from("academic_terms")
      .select("id")
      .eq("academic_year_id", academicYearIds[0])
      .eq("status", "active")
      .order("sequence")
      .limit(1)
      .maybeSingle();

    const now = Date.now();
    const id = examId();
    const { error: sessionError } = await ctx.admin.from("exam_sessions").insert({
      id,
      title: input.title.trim().slice(0, 72),
      academic_term_id: (activeTerm as { id?: string } | null)?.id ?? null,
      mode: input.mode,
      duration_seconds: Math.min(14400, Math.max(30, input.durationSeconds)),
      question_count: Math.min(200, Math.max(5, input.questionCount)),
      status: input.status,
      instructions: input.instructions.slice(0, 140),
      starts_at: null,
      ends_at: null,
      attempt_limit: 1,
      focus_monitoring: true,
      fullscreen_prompt: true,
      clipboard_guard: true,
      camera_required: input.cameraRequired,
      warn_after: input.warnAfter,
      question_order: true,
      option_order: true,
      minimize_collisions: true,
      created_by_id: ctx.scope.profileId,
      created_at: now,
      updated_at: now,
    });
    if (sessionError) return { ok: false, error: sessionError.message };

    try {
      if (allClassIds.length) {
        const { error } = await ctx.admin.from("exam_class_targets").insert(allClassIds.map((classId) => ({ session_id: id, class_id: classId })));
        if (error) throw error;
      }
      if (offeringIds.length) {
        const { error } = await ctx.admin.from("exam_offering_targets").insert(offeringIds.map((offeringId) => ({ session_id: id, offering_id: offeringId })));
        if (error) throw error;
      }
      if (input.mode === "qualifier") {
        const { error } = await ctx.admin.from("exam_placement_tracks").insert([
          { session_id: id, track: "science" },
          { session_id: id, track: "humanities" },
          { session_id: id, track: "business" },
        ]);
        if (error) throw error;
      }
    } catch (error) {
      await ctx.admin.from("exam_sessions").delete().eq("id", id);
      return { ok: false, error: error instanceof Error ? error.message : "Exam relationships could not be saved." };
    }

    revalidatePath("/admin/exams");
    return { ok: true, id };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "Create failed." };
  }
}

export async function updateExamAction(
  id: string,
  patch: { title: string; durationSeconds: number; questionCount: number; instructions: string; status: string; cameraRequired: boolean; warnAfter: number },
): Promise<ActionResult> {
  try {
    const ctx = await requireStaff();
    if (!(await scopedSession(ctx, id))) return { ok: false, error: "Exam not found or outside your scope." };
    if (patch.status === "open") {
      const { count: offerings } = await ctx.admin.from("exam_offering_targets").select("offering_id", { count: "exact", head: true }).eq("session_id", id);
      const { data: row } = await ctx.admin.from("exam_sessions").select("mode").eq("id", id).maybeSingle();
      if ((row as { mode?: string } | null)?.mode !== "qualifier" && (offerings ?? 0) === 0) {
        return { ok: false, error: "Subject exams require at least one explicit class subject offering before opening." };
      }
    }
    const { error } = await ctx.admin.from("exam_sessions").update({
      title: patch.title.trim().slice(0, 72),
      duration_seconds: patch.durationSeconds,
      question_count: patch.questionCount,
      instructions: patch.instructions.slice(0, 140),
      status: patch.status,
      camera_required: patch.cameraRequired,
      warn_after: patch.warnAfter,
      updated_at: Date.now(),
    }).eq("id", id);
    if (error) return { ok: false, error: error.message };
    revalidatePath("/admin/exams");
    return { ok: true };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "Update failed." };
  }
}

export async function setExamStatusAction(id: string, status: "open" | "draft" | "closed"): Promise<ActionResult> {
  const detail = await getExamDetailAction(id);
  const session = detail.session as { title?: string; duration_seconds?: number; question_count?: number; instructions?: string; warn_after?: number } | null;
  if (!session) return { ok: false, error: "Exam not found or outside your scope." };
  return updateExamAction(id, {
    title: String(session.title ?? "Exam"),
    durationSeconds: Number(session.duration_seconds ?? 3600),
    questionCount: Number(session.question_count ?? 50),
    instructions: String(session.instructions ?? ""),
    status,
    cameraRequired: detail.cameraRequired ?? false,
    warnAfter: Number(session.warn_after ?? 2),
  });
}

export async function duplicateExamAction(id: string): Promise<ActionResult & { id?: string }> {
  try {
    const ctx = await requireStaff();
    const source = await scopedSession(ctx, id);
    if (!source) return { ok: false, error: "Exam not found or outside your scope." };
    const [{ data: offerings }, { data: classes }] = await Promise.all([
      ctx.admin.from("exam_offering_targets").select("offering_id").eq("session_id", id),
      ctx.admin.from("exam_class_targets").select("class_id").eq("session_id", id),
    ]);
    const offeringIds = ((offerings ?? []) as { offering_id: string }[]).map((item) => item.offering_id);
    const { data: offeringRows } = offeringIds.length
      ? await ctx.admin.from("class_subject_offerings").select("subject_id,class_id").in("id", offeringIds)
      : { data: [] };
    const subjectIds = [...new Set(((offeringRows ?? []) as { subject_id: string }[]).map((row) => row.subject_id))];
    const classIds = [...new Set([
      ...((classes ?? []) as { class_id: string }[]).map((item) => item.class_id),
      ...((offeringRows ?? []) as { class_id: string }[]).map((row) => row.class_id),
    ])];
    const { data: firstClass } = classIds.length
      ? await ctx.admin.from("classes").select("level_id").eq("id", classIds[0]).maybeSingle()
      : { data: null };
    const { data: level } = firstClass
      ? await ctx.admin.from("academic_levels").select("name").eq("id", (firstClass as { level_id: string }).level_id).maybeSingle()
      : { data: null };
    const row = source as Record<string, unknown>;
    return createExamAction({
      title: `${String(row.title)} (copy)`.slice(0, 72),
      classLevel: String((level as { name?: string } | null)?.name ?? "SS1") as ExamWizardInput["classLevel"],
      mode: row.mode as ExamWizardInput["mode"],
      subjectIds,
      offeringIds,
      classIds,
      durationSeconds: Number(row.duration_seconds),
      questionCount: Number(row.question_count),
      status: "draft",
      instructions: String(row.instructions ?? ""),
      cameraRequired: Boolean(row.camera_required),
      warnAfter: Number(row.warn_after ?? 2),
    });
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "Duplicate failed." };
  }
}

export async function deleteExamAction(id: string): Promise<ActionResult> {
  try {
    const ctx = await requireStaff();
    if (!(await scopedSession(ctx, id))) return { ok: false, error: "Exam not found or outside your scope." };
    const { error } = await ctx.admin.from("exam_sessions").delete().eq("id", id);
    if (error) return { ok: false, error: error.message };
    revalidatePath("/admin/exams");
    return { ok: true };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "Delete failed." };
  }
}

// ---------------------------------------------------------------- students
export async function upsertUserAction(input: { id?: string; fullName: string; role: string; classId?: string; guardian?: string }): Promise<ActionResult> {
  try {
    const ctx = await requireStaff();
    if (input.role !== "student") return { ok: false, error: "Staff accounts are provisioned from Staff management." };
    if (input.classId && !(await teacherMayManageClass(ctx, input.classId))) return { ok: false, error: "You are not assigned to this class." };
    const parts = input.fullName.trim().split(/\s+/).filter(Boolean);
    const firstName = parts[0] ?? "";
    const lastName = parts.slice(1).join(" ") || firstName;
    if (firstName.length < 2) return { ok: false, error: "Enter a valid name." };

    const memberId = input.id ?? randomUUID();
    if (input.id) {
      const { data: existing } = await ctx.admin.from("school_members").select("id,role").eq("id", input.id).maybeSingle();
      if (!existing || (existing as { role: string }).role !== "student") return { ok: false, error: "Student was not found." };
    }
    const payload = {
      id: memberId,
      role: "student",
      status: "active",
      first_name: firstName,
      last_name: lastName,
      guardian: input.guardian?.trim() || null,
      promotion_status: "on-track",
      updated_at: new Date().toISOString(),
      ...(input.id ? {} : { student_number: `STD-${Date.now().toString(36).toUpperCase()}` }),
    };
    const { error: memberError } = await ctx.admin.from("school_members").upsert(payload);
    if (memberError) return { ok: false, error: memberError.message };

    if (input.classId) {
      await ctx.admin.from("class_enrollments").update({ status: "ended", ended_at: new Date().toISOString() }).eq("student_id", memberId).eq("status", "active").neq("class_id", input.classId);
      const { error: enrollmentError } = await ctx.admin.from("class_enrollments").upsert({
        student_id: memberId,
        class_id: input.classId,
        status: "active",
        ended_at: null,
      }, { onConflict: "student_id,class_id" });
      if (enrollmentError) return { ok: false, error: enrollmentError.message };
    }
    revalidatePath("/admin/students");
    revalidatePath("/admin/classes");
    return { ok: true };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "Save failed." };
  }
}

export async function toggleUserAction(id: string, active: boolean): Promise<ActionResult> {
  try {
    const ctx = await requireStaff();
    const { data: member } = await ctx.admin.from("school_members").select("id,role").eq("id", id).maybeSingle();
    const row = member as { id: string; role: string } | null;
    if (!row || row.role !== "student") return { ok: false, error: "Student not found." };
    if (!ctx.scope.isAdmin) {
      const { data: enrollment } = await ctx.admin.from("class_enrollments").select("class_id").eq("student_id", row.id).eq("status", "active").limit(1).maybeSingle();
      const classId = (enrollment as { class_id?: string } | null)?.class_id;
      if (!classId || !(await teacherMayManageClass(ctx, classId))) return { ok: false, error: "Student is outside your assigned classes." };
    }
    const { error } = await ctx.admin.from("school_members").update({ status: active ? "active" : "inactive", updated_at: new Date().toISOString() }).eq("id", row.id);
    if (error) return { ok: false, error: error.message };
    revalidatePath("/admin/students");
    return { ok: true };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "Update failed." };
  }
}

// --------------------------------------------------------- classes/offerings
export async function upsertClassAction(input: { id?: string; classLevel: string; track: AcademicTrack; arm: string; capacity: number; room: string }): Promise<ActionResult & { id?: string }> {
  return upsertCanonicalClassAction(input);
}

export async function upsertClassOfferingAction(input: { id?: string; classId: string; subjectId: string; status: "draft" | "active" | "ended" }): Promise<ActionResult & { id?: string }> {
  return upsertCanonicalOfferingAction(input);
}

export async function deleteClassOfferingAction(id: string): Promise<ActionResult> {
  try {
    const ctx = await requireAdmin();
    const { count } = await ctx.admin.from("exam_offering_targets").select("session_id", { count: "exact", head: true }).eq("offering_id", id);
    if ((count ?? 0) > 0) return { ok: false, error: "This offering is used by an examination. End it instead of deleting it." };
    const { error } = await ctx.admin.from("class_subject_offerings").delete().eq("id", id);
    if (error) return { ok: false, error: error.message };
    revalidatePath("/admin/classes");
    return { ok: true };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "Offering delete failed." };
  }
}

export async function deleteClassAction(id: string): Promise<ActionResult> {
  try {
    const ctx = await requireAdmin();
    const { count } = await ctx.admin.from("class_enrollments").select("id", { count: "exact", head: true }).eq("class_id", id).eq("status", "active");
    if ((count ?? 0) > 0) return { ok: false, error: "Move active students before deleting this class." };
    const { error } = await ctx.admin.from("classes").delete().eq("id", id);
    if (error) return { ok: false, error: error.message };
    revalidatePath("/admin/classes");
    return { ok: true };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "Delete failed." };
  }
}

// --------------------------------------------------------------- WhatsApp
export async function upsertWhatsappAction(input: { id?: string; classId: string; name: string; inviteUrl: string }): Promise<ActionResult> {
  try {
    const ctx = await requireAdmin();
    if (!/^https:\/\/(chat\.whatsapp\.com|www\.whatsapp\.com)\//.test(input.inviteUrl)) return { ok: false, error: "Enter a valid WhatsApp invite link." };
    const now = Date.now();
    const write = input.id
      ? await ctx.admin.from("whatsapp_groups").update({ class_id: input.classId, name: input.name, invite_url: input.inviteUrl, updated_at: now }).eq("id", input.id)
      : await ctx.admin.from("whatsapp_groups").insert({ id: `WA-${Date.now().toString(36).toUpperCase()}`, class_id: input.classId, name: input.name, invite_url: input.inviteUrl, created_at: now, updated_at: now });
    if (write.error) return { ok: false, error: write.error.message };
    revalidatePath("/admin/classes");
    return { ok: true };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "Save failed." };
  }
}

export async function deleteWhatsappAction(id: string): Promise<ActionResult> {
  try {
    const ctx = await requireAdmin();
    const { error } = await ctx.admin.from("whatsapp_groups").delete().eq("id", id);
    if (error) return { ok: false, error: error.message };
    revalidatePath("/admin/classes");
    return { ok: true };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "Delete failed." };
  }
}

// --------------------------------------------------------------- questions
export async function upsertQuestionAction(input: { subject: string; subjectId: string; kind: string; prompt: string; options: string[]; correct: string; levels: string[] }): Promise<ActionResult> {
  return upsertQuestionCore({ subjectId: input.subjectId, kind: input.kind, prompt: input.prompt, options: input.options, correctAnswers: [input.correct], levels: input.levels });
}

async function upsertQuestionCore(input: {
  id?: number;
  subjectId: string;
  kind: string;
  prompt: string;
  options: string[];
  correctAnswers: string[];
  levels: string[];
  fillTemplate?: string | null;
  difficulty?: string;
  domain?: string;
  explanation?: string;
  blanks?: { position: number; accepted: string[] }[];
}): Promise<ActionResult & { id?: number }> {
  const ctx = await requireStaff();
  if (!questionSubjectVisibleTo(input.subjectId, ctx.scope)) return { ok: false, error: "Outside your subject scope." };
  const { data: subject } = await ctx.admin.from("subjects").select("id").eq("id", input.subjectId).eq("active", true).maybeSingle();
  if (!subject) return { ok: false, error: "Subject not found." };

  let existing: { creator_id: string | null; created_at: string | null } | null = null;
  if (input.id !== undefined) {
    const { data } = await ctx.admin.from("questions").select("creator_id,created_at").eq("id", input.id).maybeSingle();
    existing = data as { creator_id: string | null; created_at: string | null } | null;
    if (!existing) return { ok: false, error: "Question not found." };
    if (!ctx.scope.isAdmin && existing.creator_id !== ctx.scope.profileId) return { ok: false, error: "Teachers can edit only questions they authored." };
  }

  const id = input.id ?? Number((await ctx.admin.from("questions").select("id").order("id", { ascending: false }).limit(1).maybeSingle()).data?.id ?? 0) + 1;
  const row = {
    id,
    subject_id: input.subjectId,
    qtype: input.kind,
    prompt: input.prompt.trim(),
    options: input.options.filter(Boolean),
    correct_answers: input.correctAnswers,
    fill_template: input.fillTemplate ?? null,
    instruction: "",
    exam_modes: ["single", "mixed", "waec", "qualifier", "bece", "neco", "jamb"],
    difficulty: input.difficulty ?? "medium",
    domain: input.domain ?? "",
    explanation: input.explanation ?? "",
    status: "active",
    creator_id: existing?.creator_id ?? ctx.scope.profileId,
    created_at: existing?.created_at ?? new Date().toISOString(),
    updated_at: Date.now(),
  };
  const write = input.id === undefined
    ? await ctx.admin.from("questions").insert(row)
    : await ctx.admin.from("questions").update(row).eq("id", id);
  if (write.error) return { ok: false, error: write.error.message };

  const requestedLevels = input.levels.length ? input.levels : ["SS1", "SS2", "SS3"];
  const { data: levels } = await ctx.admin.from("academic_levels").select("id,name").in("name", requestedLevels);
  if ((levels ?? []).length !== new Set(requestedLevels).size) return { ok: false, error: "One or more academic levels are unavailable." };
  await ctx.admin.from("question_academic_levels").delete().eq("question_id", id);
  if ((levels ?? []).length) {
    const { error } = await ctx.admin.from("question_academic_levels").insert(((levels ?? []) as { id: string }[]).map((level) => ({ question_id: id, level_id: level.id })));
    if (error) return { ok: false, error: error.message };
  }

  if (input.blanks) {
    await ctx.admin.from("question_blanks").delete().eq("question_id", id);
    if (input.blanks.length) {
      const { error } = await ctx.admin.from("question_blanks").insert(input.blanks.map((blank) => ({
        question_id: id,
        position: blank.position,
        blank_key: `b${blank.position}`,
        placeholder: `Answer ${blank.position + 1}`,
        accepted: blank.accepted,
      })));
      if (error) return { ok: false, error: error.message };
    }
  }
  revalidatePath("/admin/questions");
  return { ok: true, id };
}

export async function deleteQuestionAction(id: number): Promise<ActionResult> {
  try {
    const ctx = await requireStaff();
    const { data } = await ctx.admin.from("questions").select("subject_id,creator_id").eq("id", id).maybeSingle();
    const question = data as { subject_id: string | null; creator_id: string | null } | null;
    if (!question?.subject_id) return { ok: false, error: "Question not found." };
    if (!questionSubjectVisibleTo(question.subject_id, ctx.scope)) return { ok: false, error: "Outside your subject scope." };
    if (!ctx.scope.isAdmin && question.creator_id !== ctx.scope.profileId) return { ok: false, error: "Only your own questions can be deleted." };
    const { error } = await ctx.admin.from("questions").delete().eq("id", id);
    if (error) return { ok: false, error: error.message };
    revalidatePath("/admin/questions");
    return { ok: true };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "Delete failed." };
  }
}

export async function syncQuestionBankAction(): Promise<ActionResult & { count?: number }> {
  return syncQuestionBankFromFixtureAction();
}

// --------------------------------------------------------------- attempts
export async function resetUnfinishedAttemptAction(): Promise<ActionResult> {
  return { ok: false, error: "Attempt reset has been removed. Preserve the attempt and use an explicit retake grant when another attempt is required." };
}

export async function authorizeRewriteAction(attemptId: string): Promise<ActionResult> {
  try {
    const ctx = await requireStaff();
    const { data } = await ctx.supabase.from("exam_attempts").select("id,session_id,student_id").eq("id", attemptId).maybeSingle();
    const attempt = data as { id: string; session_id: string; student_id: string } | null;
    if (!attempt) return { ok: false, error: "Attempt not found or outside your scope." };
    const { error } = await ctx.supabase.rpc("grant_exam_retake", {
      p_session_id: attempt.session_id,
      p_student_id: attempt.student_id,
      p_additional_attempts: 1,
      p_reason: "Authorized from attempt review",
    });
    if (error) return { ok: false, error: error.message };
    revalidatePath("/admin/exams");
    return { ok: true };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "Retake authorization failed." };
  }
}

// ------------------------------------------------------------- detail reads
export async function getExamDetailAction(examIdValue: string) {
  const ctx = await requireStaff();
  const normalized = examIdValue.toUpperCase();
  const session = await scopedSession(ctx, normalized);
  if (!session) return { session: null, attempts: [], cameraRequired: false };
  const [{ data: attempts }, { data: offerings }, { data: classes }] = await Promise.all([
    ctx.supabase.from("exam_attempts").select("id,student_id,context_snapshot,score,submitted_at,started_at,attempt_number,integrity_score").eq("session_id", normalized).order("created_at", { ascending: false }).limit(100),
    ctx.supabase.from("exam_offering_targets").select("offering_id").eq("session_id", normalized),
    ctx.supabase.from("exam_class_targets").select("class_id").eq("session_id", normalized),
  ]);
  return { session, attempts: attempts ?? [], offerings: offerings ?? [], classes: classes ?? [], cameraRequired: Boolean(session.camera_required) };
}

export async function getUserDetailAction(userId: string) {
  const ctx = await requireStaff();
  const { data: member } = await ctx.admin
    .from("school_members")
    .select("id,role,status,first_name,last_name,student_number,guardian,phone,promotion_status")
    .eq("id", userId)
    .maybeSingle();
  const person = member as {
    id: string;
    role: string;
    status: string;
    first_name: string;
    last_name: string;
    student_number: string | null;
    guardian: string | null;
    phone: string | null;
    promotion_status: string | null;
  } | null;
  if (!person) return { user: null, attempts: [] };
  if (!ctx.scope.isAdmin && person.role !== "student") return { user: null, attempts: [] };

  const [{ data: enrollment }, { data: attempts }] = await Promise.all([
    person.role === "student"
      ? ctx.admin.from("class_enrollments").select("class_id").eq("student_id", person.id).eq("status", "active").is("ended_at", null).limit(1).maybeSingle()
      : Promise.resolve({ data: null }),
    person.role === "student"
      ? ctx.admin.from("exam_attempts").select("id,session_id,context_snapshot,score,integrity_score,submitted_at").eq("student_id", person.id).order("created_at", { ascending: false }).limit(50)
      : Promise.resolve({ data: [] }),
  ]);
  return {
    user: {
      ...person,
      full_name: `${person.first_name} ${person.last_name}`.trim(),
      class_id: (enrollment as { class_id?: string } | null)?.class_id ?? null,
    },
    attempts: attempts ?? [],
  };
}

export async function getAttemptDetailAction(attemptId: string) {
  const ctx = await requireStaff();
  const { data: attempt } = await ctx.supabase.from("exam_attempts").select("*").eq("id", attemptId).maybeSingle();
  const row = attempt as { id: string } | null;
  if (!row) return { attempt: null, answers: [], stats: [], events: [] };
  const [{ data: answers }, { data: events }] = await Promise.all([
    ctx.admin.from("exam_attempt_responses").select("*").eq("attempt_id", row.id).not("graded_at", "is", null).order("question_id"),
    ctx.supabase.from("exam_integrity_events").select("type,detail,at").eq("attempt_id", row.id).order("at"),
  ]);
  return { attempt, answers: answers ?? [], stats: [], events: events ?? [] };
}

export async function getQuestionDetailAction(id: number) {
  const ctx = await requireStaff();
  const [{ data: question }, { data: blanks }] = await Promise.all([
    ctx.admin.from("questions").select("*").eq("id", id).maybeSingle(),
    ctx.admin.from("question_blanks").select("*").eq("question_id", id).order("position"),
  ]);
  const row = question as { subject_id: string | null } | null;
  if (row?.subject_id && !questionSubjectVisibleTo(row.subject_id, ctx.scope)) return { question: null, blanks: [] };
  return { question, blanks: blanks ?? [] };
}

export async function isAdminAction(): Promise<boolean> {
  return (await currentStaff()).scope.isAdmin;
}

export async function getStaffListAction(): Promise<{ id: string; full_name: string; subjectIds: string[] }[]> {
  const ctx = await requireAdmin();
  const { data: members } = await ctx.admin
    .from("school_members")
    .select("id,first_name,last_name")
    .in("role", ["teacher", "administrator"])
    .eq("status", "active")
    .order("last_name")
    .limit(200);
  const rows = (members ?? []) as { id: string; first_name: string; last_name: string }[];
  const ids = rows.map((row) => row.id);
  const { data: qualifications } = ids.length
    ? await ctx.admin.from("staff_subject_qualifications").select("staff_id,subject_id").in("staff_id", ids).eq("active", true)
    : { data: [] };
  const byStaff = new Map<string, string[]>();
  for (const item of ((qualifications ?? []) as { staff_id: string; subject_id: string }[])) {
    byStaff.set(item.staff_id, [...(byStaff.get(item.staff_id) ?? []), item.subject_id]);
  }
  return rows.map((row) => ({ id: row.id, full_name: `${row.first_name} ${row.last_name}`.trim(), subjectIds: byStaff.get(row.id) ?? [] }));
}

export async function updateCohostsAction(examIdValue: string, cohosts: string[]): Promise<ActionResult> {
  try {
    const ctx = await requireAdmin();
    const staffIds = [...new Set(cohosts.filter(Boolean))];
    if (staffIds.length) {
      const { count } = await ctx.admin.from("school_members").select("id", { count: "exact", head: true }).in("id", staffIds).in("role", ["teacher", "administrator"]).eq("status", "active");
      if ((count ?? 0) !== staffIds.length) return { ok: false, error: "One or more staff members are unavailable." };
    }
    await ctx.admin.from("exam_staff_assignments").delete().eq("session_id", examIdValue).eq("role", "cohost");
    if (staffIds.length) {
      const { error } = await ctx.admin.from("exam_staff_assignments").insert(staffIds.map((staffId) => ({ session_id: examIdValue, staff_id: staffId, role: "cohost" })));
      if (error) return { ok: false, error: error.message };
    }
    revalidatePath("/admin/exams");
    return { ok: true };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "Update failed." };
  }
}

export async function getSubjectsAction(): Promise<string[]> {
  return (await getActiveSubjectsAction()).map((row) => row.id);
}

export async function getSessionOptionsAction() {
  const ctx = await requireStaff();
  const { data: classes } = await ctx.admin.from("classes").select("id,arm,level_id,track,academic_year_id").eq("status", "active").limit(200);
  return { classes: classes ?? [] };
}

export async function updateMySubjectsAction(subjectIds: string[]): Promise<ActionResult> {
  try {
    const ctx = await requireStaff();
    if (ctx.scope.isAdmin || !ctx.scope.profileId) return { ok: false, error: "Teachers only." };
    const clean = [...new Set(subjectIds.filter(Boolean))].slice(0, 24);
    if (!clean.length) return { ok: false, error: "Choose at least one subject." };
    const valid = await ctx.admin.from("subjects").select("id").in("id", clean).eq("active", true);
    const rows = (valid.data ?? []) as { id: string }[];
    if (rows.length !== clean.length) return { ok: false, error: "One or more subjects are unavailable." };
    await ctx.admin.from("staff_subject_qualifications").update({ active: false }).eq("staff_id", ctx.scope.profileId);
    const { error } = await ctx.admin.from("staff_subject_qualifications").upsert(
      rows.map((subject) => ({ staff_id: ctx.scope.profileId, subject_id: subject.id, active: true })),
      { onConflict: "staff_id,subject_id" },
    );
    if (error) return { ok: false, error: error.message };
    revalidatePath("/admin");
    revalidatePath("/admin/staff");
    return { ok: true };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "Save failed." };
  }
}

export async function getMyScopeAction(): Promise<{ isAdmin: boolean; subjectIds: string[]; qualifierAccess: boolean }> {
  const current = await requireStaff();
  return { isAdmin: current.scope.isAdmin, subjectIds: current.scope.subjectIds, qualifierAccess: current.scope.qualifierAccess };
}

// --------------------------------------------------------------- subjects
export async function getActiveSubjectsAction(): Promise<{ id: string; name: string }[]> {
  const ctx = await requireStaff();
  const { data } = await ctx.admin.from("subjects").select("id,name").eq("active", true).order("name");
  return (data ?? []) as { id: string; name: string }[];
}

export async function seedSubjectsAction(): Promise<ActionResult & { count?: number }> {
  return seedSubjectCatalogFromFixtureAction();
}

function subjectCode(name: string): string {
  return name
    .toLocaleLowerCase("en")
    .normalize("NFKD")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 28) || `subject-${Date.now().toString(36)}`;
}

export async function upsertSubjectAction(input: { id?: string; name: string }): Promise<ActionResult & { id?: string }> {
  try {
    const ctx = await requireAdmin();
    const name = input.name.trim().replace(/\s+/g, " ");
    if (!name) return { ok: false, error: "Subject name is required." };
    const id = input.id ?? randomUUID();
    const write = input.id
      ? await ctx.admin.from("subjects").update({ name, updated_at: new Date().toISOString() }).eq("id", id)
      : await ctx.admin.from("subjects").insert({ id, code: subjectCode(name), name, kind: "curriculum", active: true });
    if (write.error) return { ok: false, error: write.error.message };
    revalidatePath("/admin/settings");
    return { ok: true, id };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "Save failed." };
  }
}

export async function toggleSubjectAction(subjectId: string, active: boolean): Promise<ActionResult> {
  try {
    const ctx = await requireAdmin();
    const { error } = await ctx.admin.from("subjects").update({ active, updated_at: new Date().toISOString() }).eq("id", subjectId);
    if (error) return { ok: false, error: error.message };
    revalidatePath("/admin/settings");
    return { ok: true };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "Update failed." };
  }
}

export { upsertQuestionCore };