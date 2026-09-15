"use server";

import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { revalidatePath } from "next/cache";
import type { ActionResult } from "@/app/actions/student";
import { currentStaff, questionSubjectVisibleTo, type StaffScope } from "@/lib/auth/staff";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

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
    .eq("class_id", classId);
  const offeringIds = ((offerings ?? []) as { id: string }[]).map((row) => row.id);
  if (!offeringIds.length) return false;
  const { count } = await ctx.supabase
    .from("teaching_assignments")
    .select("id", { count: "exact", head: true })
    .eq("staff_profile_id", ctx.scope.profileId!)
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
      ? await ctx.admin.from("class_subject_offerings").select("id,class_id,subject_id,academic_term_id,status").in("id", offeringIds)
      : { data: [], error: null };
    if (offeringError) return { ok: false, error: offeringError.message };
    const offeringRows = (offerings ?? []) as { id: string; class_id: string; subject_id: string; academic_term_id: string | null; status: string }[];
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
        .eq("staff_profile_id", ctx.scope.profileId!)
        .is("ended_at", null)
        .in("offering_id", offeringIds);
      const assigned = new Set(((assignments ?? []) as { offering_id: string }[]).map((row) => row.offering_id));
      if (offeringIds.some((offeringId) => !assigned.has(offeringId))) return { ok: false, error: "You may create exams only for subject offerings you teach." };
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
    if (new Set(classRows.map((row) => row.academic_year_id)).size !== 1) return { ok: false, error: "All target classes must belong to the same academic year." };

    const now = Date.now();
    const id = examId();
    const { error: sessionError } = await ctx.admin.from("exam_sessions").insert({
      id,
      title: input.title.trim().slice(0, 72),
      mode: input.mode,
      duration_seconds: Math.min(10800, Math.max(30, input.durationSeconds)),
      question_count: Math.min(150, Math.max(5, input.questionCount)),
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
      created_by_profile_id: ctx.scope.profileId,
      academic_term_id: offeringRows.length && offeringRows.every((row) => row.academic_term_id === offeringRows[0].academic_term_id) ? offeringRows[0].academic_term_id : null,
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
      if ((row as { mode?: string } | null)?.mode !== "qualifier" && (offerings ?? 0) === 0) return { ok: false, error: "Subject exams require at least one explicit class subject offering before opening." };
    }
    const now = Date.now();
    const { error } = await ctx.admin.from("exam_sessions").update({
      title: patch.title.trim().slice(0, 72),
      duration_seconds: patch.durationSeconds,
      question_count: patch.questionCount,
      instructions: patch.instructions.slice(0, 140),
      status: patch.status,
      camera_required: patch.cameraRequired,
      warn_after: patch.warnAfter,
      updated_at: now,
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
    const { data: firstClass } = classIds.length ? await ctx.admin.from("classes").select("level_id").eq("id", classIds[0]).maybeSingle() : { data: null };
    const { data: level } = firstClass ? await ctx.admin.from("academic_levels").select("name").eq("id", (firstClass as { level_id: string }).level_id).maybeSingle() : { data: null };
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
    const parts = input.fullName.trim().split(/\s+/);
    const firstName = parts[0] ?? "";
    const lastName = parts.slice(1).join(" ") || firstName;
    if (firstName.length < 2) return { ok: false, error: "Enter a valid name." };

    const profileId = input.id ?? randomUUID();
    if (input.id) {
      const { data: existing } = await ctx.admin.from("academic_profiles").select("id,role").eq("id", input.id).maybeSingle();
      if (!existing || (existing as { role: string }).role !== "student") return { ok: false, error: "Student academic profile was not found." };
    }
    const { error: profileError } = await ctx.admin.from("academic_profiles").upsert({
      id: profileId,
      role: "student",
      status: "active",
      first_name: firstName,
      last_name: lastName,
      updated_at: new Date().toISOString(),
    });
    if (profileError) return { ok: false, error: profileError.message };
    const { error: studentError } = await ctx.admin.from("student_academic_profiles").upsert({
      profile_id: profileId,
      guardian: input.guardian ?? "",
      updated_at: new Date().toISOString(),
    });
    if (studentError) return { ok: false, error: studentError.message };

    if (input.classId) {
      await ctx.admin.from("class_enrollments").update({ status: "ended", ended_at: new Date().toISOString() }).eq("student_profile_id", profileId).eq("status", "active").neq("class_id", input.classId);
      const { error: enrollmentError } = await ctx.admin.from("class_enrollments").upsert({
        student_profile_id: profileId,
        class_id: input.classId,
        status: "active",
        ended_at: null,
      }, { onConflict: "student_profile_id,class_id" });
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
    const { data: profile } = await ctx.admin.from("academic_profiles").select("id,role").eq("id", id).maybeSingle();
    const row = profile as { id: string; role: string } | null;
    if (!row || row.role !== "student") return { ok: false, error: "Student not found." };
    if (!ctx.scope.isAdmin) {
      const { data: enrollment } = await ctx.admin.from("class_enrollments").select("class_id").eq("student_profile_id", row.id).eq("status", "active").limit(1).maybeSingle();
      const classId = (enrollment as { class_id?: string } | null)?.class_id;
      if (!classId || !(await teacherMayManageClass(ctx, classId))) return { ok: false, error: "Student is outside your assigned classes." };
    }
    const { error } = await ctx.admin.from("academic_profiles").update({ status: active ? "active" : "inactive", updated_at: new Date().toISOString() }).eq("id", row.id);
    if (error) return { ok: false, error: error.message };
    revalidatePath("/admin/students");
    return { ok: true };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "Update failed." };
  }
}

// --------------------------------------------------------- classes/offerings
export async function upsertClassAction(input: { id?: string; classLevel: string; programmeId?: string; stream?: string; arm: string; capacity: number; room: string }): Promise<ActionResult> {
  try {
    const ctx = await requireAdmin();
    const arm = input.arm.trim().toUpperCase().slice(0, 4) || "A";
    const [{ data: level }, { data: currentYear }] = await Promise.all([
      ctx.admin.from("academic_levels").select("id").eq("name", input.classLevel).eq("active", true).maybeSingle(),
      ctx.admin.from("academic_years").select("id").eq("status", "current").limit(1).maybeSingle(),
    ]);
    const levelId = (level as { id?: string } | null)?.id;
    if (!levelId) return { ok: false, error: "Academic level is not configured." };
    if (input.programmeId) {
      const { data: programme } = await ctx.admin.from("academic_programmes").select("id").eq("id", input.programmeId).eq("active", true).maybeSingle();
      if (!programme) return { ok: false, error: "Programme is unavailable." };
    }
    let academicYearId = (currentYear as { id?: string } | null)?.id ?? null;
    if (input.id) {
      const { data: existing } = await ctx.admin.from("classes").select("academic_year_id").eq("id", input.id).maybeSingle();
      academicYearId = (existing as { academic_year_id?: string } | null)?.academic_year_id ?? academicYearId;
    }
    if (!academicYearId) return { ok: false, error: "Set a current academic year before creating classes." };
    const id = input.id ?? `${input.classLevel.toLowerCase()}-${arm.toLowerCase()}-${Date.now().toString(36)}`;
    const { error } = await ctx.admin.from("classes").upsert({
      id,
      level_id: levelId,
      programme_id: input.programmeId || null,
      academic_year_id: academicYearId,
      arm,
      capacity: input.capacity,
      room: input.room,
      status: "active",
      updated_at: new Date().toISOString(),
    });
    if (error) return { ok: false, error: error.message };
    revalidatePath("/admin/classes");
    return { ok: true };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "Save failed." };
  }
}

export async function upsertClassOfferingAction(input: { id?: string; classId: string; subjectId: string; academicYearId?: string; academicTermId?: string; participation: "required" | "elective"; status: "draft" | "active" | "ended" }): Promise<ActionResult & { id?: string }> {
  try {
    const ctx = await requireAdmin();
    const id = input.id ?? randomUUID();
    const { error } = await ctx.admin.from("class_subject_offerings").upsert({
      id,
      class_id: input.classId,
      subject_id: input.subjectId,
      academic_term_id: input.academicTermId || null,
      participation: input.participation,
      status: input.status,
      updated_at: new Date().toISOString(),
    });
    if (error) return { ok: false, error: error.message };
    revalidatePath("/admin/classes");
    return { ok: true, id };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "Offering save failed." };
  }
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
  const result = await upsertQuestionCore({ subjectId: input.subjectId, kind: input.kind, prompt: input.prompt, options: input.options, correctAnswers: [input.correct], levels: input.levels });
  return result;
}

async function upsertQuestionCore(input: { id?: number; subjectId: string; kind: string; prompt: string; options: string[]; correctAnswers: string[]; levels: string[]; fillTemplate?: string | null; difficulty?: string; domain?: string; explanation?: string; blanks?: { position: number; accepted: string[] }[] }): Promise<ActionResult & { id?: number }> {
  const ctx = await requireStaff();
  if (!questionSubjectVisibleTo(input.subjectId, ctx.scope)) return { ok: false, error: "Outside your subject scope." };
  const { data: subject } = await ctx.admin.from("subjects").select("id").eq("id", input.subjectId).eq("active", true).maybeSingle();
  if (!subject) return { ok: false, error: "Subject not found." };
  let existing: { created_by_profile_id: string | null; created_at: string | null } | null = null;
  if (input.id !== undefined) {
    const { data } = await ctx.admin.from("questions").select("created_by_profile_id,created_at").eq("id", input.id).maybeSingle();
    existing = data as { created_by_profile_id: string | null; created_at: string | null } | null;
    if (!existing) return { ok: false, error: "Question not found." };
    if (!ctx.scope.isAdmin && existing.created_by_profile_id !== ctx.scope.profileId) return { ok: false, error: "Teachers can edit only questions they authored." };
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
    created_by_profile_id: existing?.created_by_profile_id ?? ctx.scope.profileId,
    created_at: existing?.created_at ?? new Date().toISOString(),
    updated_at: Date.now(),
  };
  const write = input.id === undefined ? await ctx.admin.from("questions").insert(row) : await ctx.admin.from("questions").update(row).eq("id", id);
  if (write.error) return { ok: false, error: write.error.message };

  const requestedLevels = input.levels.length ? input.levels : ["SS1", "SS2", "SS3"];
  const { data: levels } = await ctx.admin.from("academic_levels").select("id,name").in("name", requestedLevels);
  await ctx.admin.from("question_academic_levels").delete().eq("question_id", id);
  if ((levels ?? []).length) {
    const { error } = await ctx.admin.from("question_academic_levels").insert(((levels ?? []) as { id: string }[]).map((level) => ({ question_id: id, level_id: level.id })));
    if (error) return { ok: false, error: error.message };
  }
  if (input.blanks) {
    await ctx.admin.from("question_blanks").delete().eq("question_id", id);
    if (input.blanks.length) {
      const { error } = await ctx.admin.from("question_blanks").insert(input.blanks.map((blank) => ({ question_id: id, position: blank.position, blank_key: `b${blank.position}`, placeholder: `Answer ${blank.position + 1}`, accepted: blank.accepted })));
      if (error) return { ok: false, error: error.message };
    }
  }
  revalidatePath("/admin/questions");
  return { ok: true, id };
}

export async function deleteQuestionAction(id: number): Promise<ActionResult> {
  try {
    const ctx = await requireStaff();
    const { data } = await ctx.admin.from("questions").select("subject_id,created_by_profile_id").eq("id", id).maybeSingle();
    const question = data as { subject_id: string | null; created_by_profile_id: string | null } | null;
    if (!question?.subject_id) return { ok: false, error: "Question not found." };
    if (!questionSubjectVisibleTo(question.subject_id, ctx.scope)) return { ok: false, error: "Outside your subject scope." };
    if (!ctx.scope.isAdmin && question.created_by_profile_id !== ctx.scope.profileId) return { ok: false, error: "Only your own questions can be deleted." };
    const { error } = await ctx.admin.from("questions").delete().eq("id", id);
    if (error) return { ok: false, error: error.message };
    revalidatePath("/admin/questions");
    return { ok: true };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "Delete failed." };
  }
}

export async function syncQuestionBankAction(): Promise<ActionResult & { count?: number }> {
  try {
    const ctx = await requireAdmin();
    const file = await readFile(path.join(process.cwd(), "public", "seed", "questions.json"), "utf8");
    const parsed = JSON.parse(file) as { subjectCatalog?: { code?: unknown; label?: unknown }[]; questions?: unknown[] } | unknown[];
    const list = (Array.isArray(parsed) ? parsed : parsed.questions ?? []) as Record<string, unknown>[];
    const catalog = Array.isArray(parsed) ? [] : parsed.subjectCatalog ?? [];
    if (!list.length) return { ok: false, error: "Seed file has no questions." };
    const nameByCode = new Map(catalog.map((item) => [String(item.code ?? ""), String(item.label ?? "").replace(/\s*\(legacy bank\)\s*/i, "").trim()]));
    for (const question of list) {
      const code = String(question.subjectCode ?? "");
      if (!nameByCode.has(code)) nameByCode.set(code, String(question.subject ?? code).replace(/\s*\(legacy bank\)\s*/i, "").trim());
    }
    const { data: subjectRows } = await ctx.admin.from("subjects").select("id,name").eq("active", true);
    const subjectByName = new Map(((subjectRows ?? []) as { id: string; name: string }[]).map((row) => [row.name.trim().toLocaleLowerCase("en"), row.id]));
    const unresolved = [...nameByCode.values()].filter((name) => name && !subjectByName.has(name.toLocaleLowerCase("en")));
    if (unresolved.length) return { ok: false, error: `Create these canonical subjects before syncing: ${[...new Set(unresolved)].join(", ")}.` };
    const { data: existing } = await ctx.admin.from("questions").select("id");
    const have = new Set(((existing ?? []) as { id: number }[]).map((row) => Number(row.id)));
    const fresh = list.filter((question) => !have.has(Number(question.id)));
    const now = Date.now();
    const questionRows: Record<string, unknown>[] = [];
    const blankRows: { question_id: number; position: number; blank_key: string; placeholder: string; accepted: string[] }[] = [];
    const levelNamesByQuestion = new Map<number, string[]>();
    for (const question of fresh) {
      const code = String(question.subjectCode ?? "");
      const canonicalName = nameByCode.get(code) ?? String(question.subject ?? "");
      const subjectId = subjectByName.get(canonicalName.toLocaleLowerCase("en"));
      if (!subjectId) return { ok: false, error: `Subject ${canonicalName || code} is unavailable.` };
      const type = String(question.type ?? "single");
      const rawAnswer = question.answer as unknown;
      const rawAnswers = question.answers as unknown;
      const correct = type === "boolean" ? [String(rawAnswer)] : Array.isArray(rawAnswers) ? rawAnswers.map(String) : Array.isArray(rawAnswer) ? rawAnswer.map(String) : rawAnswer !== undefined ? [String(rawAnswer)] : [];
      const levels = Array.isArray(question.levels) ? (question.levels as unknown[]).map(String) : ["SS1", "SS2", "SS3"];
      levelNamesByQuestion.set(Number(question.id), levels);
      const modes = Array.isArray(question.examModes) ? (question.examModes as unknown[]).map(String) : ["single", "mixed", "waec"];
      const template = question.fillTemplate as { text?: string; blank?: string; placeholder?: string }[] | undefined;
      let position = 0;
      let fillTemplate: string | null = null;
      if (template) {
        fillTemplate = template.map((part) => {
          if (part.blank === undefined) return part.text ?? "";
          const marker = `{{${position}}}`;
          const source = Array.isArray(question.acceptedAnswers) ? (question.acceptedAnswers as unknown[])[position] : undefined;
          blankRows.push({ question_id: Number(question.id), position, blank_key: String(part.blank || `b${position}`), placeholder: String(part.placeholder ?? ""), accepted: Array.isArray(source) ? source.map(String) : source !== undefined ? [String(source)] : [] });
          position += 1;
          return marker;
        }).join("");
      }
      questionRows.push({
        id: Number(question.id), subject_id: subjectId, qtype: type, prompt: String(question.prompt ?? ""),
        options: Array.isArray(question.options) ? (question.options as unknown[]).map(String) : [],
        correct_answers: type === "fill" || type === "fill-multi" ? [] : correct, fill_template: fillTemplate,
        instruction: String(question.instruction ?? ""), exam_modes: modes, difficulty: String(question.difficulty ?? "medium"),
        domain: String(question.domain ?? ""), explanation: String(question.explanation ?? ""), created_by_profile_id: null,
        created_at: new Date().toISOString(), updated_at: now,
      });
    }
    for (let index = 0; index < questionRows.length; index += 200) {
      const { error } = await ctx.admin.from("questions").insert(questionRows.slice(index, index + 200));
      if (error) return { ok: false, error: error.message };
    }
    const { data: academicLevels } = await ctx.admin.from("academic_levels").select("id,name");
    const levelIdByName = new Map(((academicLevels ?? []) as { id: string; name: string }[]).map((row) => [row.name, row.id]));
    const levelLinks = [...levelNamesByQuestion.entries()].flatMap(([questionId, names]) => names.map((name) => levelIdByName.get(name)).filter(Boolean).map((levelId) => ({ question_id: questionId, level_id: levelId })));
    if (levelLinks.length) { const { error } = await ctx.admin.from("question_academic_levels").insert(levelLinks); if (error) return { ok: false, error: error.message }; }
    for (let index = 0; index < blankRows.length; index += 200) { const { error } = await ctx.admin.from("question_blanks").insert(blankRows.slice(index, index + 200)); if (error) return { ok: false, error: error.message }; }
    revalidatePath("/admin/questions");
    return { ok: true, count: questionRows.length };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "Sync failed." };
  }
}

// --------------------------------------------------------------- attempts
export async function resetUnfinishedAttemptAction(): Promise<ActionResult> {
  return { ok: false, error: "Attempt reset has been removed. Preserve the attempt and use an explicit retake grant when another attempt is required." };
}

export async function authorizeRewriteAction(attemptId: string): Promise<ActionResult> {
  try {
    const ctx = await requireStaff();
    const { data } = await ctx.supabase.from("exam_attempts").select("id,session_id,student_profile_id").eq("id", attemptId).maybeSingle();
    const attempt = data as { id: string; session_id: string; student_profile_id: string } | null;
    if (!attempt) return { ok: false, error: "Attempt not found or outside your scope." };
    const { error } = await ctx.supabase.rpc("grant_exam_retake", {
      p_session_id: attempt.session_id,
      p_student_profile_id: attempt.student_profile_id,
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
  const examIdValueNormalized = examIdValue.toUpperCase();
  const session = await scopedSession(ctx, examIdValueNormalized);
  if (!session) return { session: null, attempts: [], cameraRequired: false };
  const [{ data: attempts }, { data: offerings }, { data: classes }] = await Promise.all([
    ctx.supabase.from("exam_attempts").select("id,student_profile_id,context_snapshot,score,submitted_at,started_at,attempt_number,integrity_score").eq("session_id", examIdValueNormalized).order("created_at", { ascending: false }).limit(100),
    ctx.supabase.from("exam_offering_targets").select("offering_id").eq("session_id", examIdValueNormalized),
    ctx.supabase.from("exam_class_targets").select("class_id").eq("session_id", examIdValueNormalized),
  ]);
  return { session, attempts: attempts ?? [], offerings: offerings ?? [], classes: classes ?? [], cameraRequired: Boolean((session as Record<string, unknown>).camera_required) };
}

export async function getUserDetailAction(userId: string) {
  const ctx = await requireStaff();
  const { data: profile } = await ctx.admin.from("academic_profiles").select("id,role,status,first_name,last_name").eq("id", userId).maybeSingle();
  const person = profile as { id: string; role: string; status: string; first_name: string; last_name: string } | null;
  if (!person) return { user: null, attempts: [] };
  if (!ctx.scope.isAdmin && person.role !== "student") return { user: null, attempts: [] };
  const [{ data: student }, { data: enrollment }, { data: attempts }] = await Promise.all([
    person.role === "student" ? ctx.admin.from("student_academic_profiles").select("student_number,guardian,phone,promotion_status").eq("profile_id", person.id).maybeSingle() : Promise.resolve({ data: null }),
    person.role === "student" ? ctx.admin.from("class_enrollments").select("class_id").eq("student_profile_id", person.id).eq("status", "active").limit(1).maybeSingle() : Promise.resolve({ data: null }),
    person.role === "student" ? ctx.admin.from("exam_attempts").select("id,session_id,context_snapshot,score,integrity_score,submitted_at").eq("student_profile_id", person.id).order("created_at", { ascending: false }).limit(50) : Promise.resolve({ data: [] }),
  ]);
  return {
    user: { ...person, full_name: `${person.first_name} ${person.last_name}`.trim(), ...(student ?? {}), class_id: (enrollment as { class_id?: string } | null)?.class_id ?? null },
    attempts: attempts ?? [],
  };
}

export async function getAttemptDetailAction(attemptId: string) {
  const ctx = await requireStaff();
  const { data: attempt } = await ctx.supabase.from("exam_attempts").select("*").eq("id", attemptId).maybeSingle();
  const row = attempt as { id: string } | null;
  if (!row) return { attempt: null, answers: [], stats: [], events: [] };
  const [{ data: answers }, { data: events }] = await Promise.all([
    ctx.admin.from("exam_attempt_answers").select("*").eq("attempt_id", row.id).order("question_id"),
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
  const current = await currentStaff();
  return current.scope.isAdmin;
}

export async function getStaffListAction(): Promise<{ id: string; profile_id: string; full_name: string; subjectIds: string[] }[]> {
  const ctx = await requireAdmin();
  const { data: profiles } = await ctx.admin.from("academic_profiles").select("id,first_name,last_name").in("role", ["teacher", "administrator"]).eq("status", "active").order("last_name").limit(200);
  const rows = (profiles ?? []) as { id: string; first_name: string; last_name: string }[];
  const ids = rows.map((row) => row.id);
  const { data: qualifications } = ids.length ? await ctx.admin.from("staff_subject_qualifications").select("staff_profile_id,subject_id").in("staff_profile_id", ids).eq("active", true) : { data: [] };
  const byStaff = new Map<string, string[]>();
  for (const item of ((qualifications ?? []) as { staff_profile_id: string; subject_id: string }[])) byStaff.set(item.staff_profile_id, [...(byStaff.get(item.staff_profile_id) ?? []), item.subject_id]);
  return rows.map((row) => ({ id: row.id, profile_id: row.id, full_name: `${row.first_name} ${row.last_name}`.trim(), subjectIds: byStaff.get(row.id) ?? [] }));
}

export async function updateCohostsAction(examIdValue: string, cohosts: string[]): Promise<ActionResult> {
  try {
    const ctx = await requireAdmin();
    const profileIds = [...new Set(cohosts.filter(Boolean))];
    if (profileIds.length) {
      const { count } = await ctx.admin.from("academic_profiles").select("id", { count: "exact", head: true }).in("id", profileIds).in("role", ["teacher", "administrator"]);
      if ((count ?? 0) !== profileIds.length) return { ok: false, error: "One or more staff profiles are unavailable." };
    }
    await ctx.admin.from("exam_staff_assignments").delete().eq("session_id", examIdValue).eq("role", "cohost");
    if (profileIds.length) {
      const { error } = await ctx.admin.from("exam_staff_assignments").insert(profileIds.map((profileId) => ({ session_id: examIdValue, staff_profile_id: profileId, role: "cohost" })));
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
  const { data: classes } = await ctx.admin.from("classes").select("id,arm,level_id,programme_id,academic_year_id").eq("status", "active").limit(200);
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
    await ctx.admin.from("staff_subject_qualifications").update({ active: false }).eq("staff_profile_id", ctx.scope.profileId);
    const { error } = await ctx.admin.from("staff_subject_qualifications").upsert(rows.map((subject) => ({ staff_profile_id: ctx.scope.profileId, subject_id: subject.id, active: true })), { onConflict: "staff_profile_id,subject_id" });
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
  try {
    const ctx = await requireAdmin();
    const { WAEC_SUBJECTS } = await import("@/lib/subjects-catalog");
    const canonicalNames = [...new Set(WAEC_SUBJECTS.map((subject) => subject.name.replace(/\s*\(legacy bank\)\s*/i, "").trim()).filter(Boolean))];
    const { data: existing } = await ctx.admin.from("subjects").select("name");
    const have = new Set(((existing ?? []) as { name: string }[]).map((row) => row.name.trim().toLocaleLowerCase("en")));
    const fresh = canonicalNames.filter((name) => !have.has(name.toLocaleLowerCase("en"))).map((name) => ({ id: randomUUID(), name, active: true }));
    if (fresh.length) {
      const { error } = await ctx.admin.from("subjects").insert(fresh);
      if (error) return { ok: false, error: error.message };
    }
    revalidatePath("/admin/settings");
    return { ok: true, count: fresh.length };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "Seed failed." };
  }
}

export async function upsertSubjectAction(input: { id?: string; name: string }): Promise<ActionResult & { id?: string }> {
  try {
    const ctx = await requireAdmin();
    const name = input.name.trim().replace(/\s+/g, " ");
    if (!name) return { ok: false, error: "Subject name is required." };
    const id = input.id ?? randomUUID();
    const write = input.id
      ? await ctx.admin.from("subjects").update({ name, updated_at: new Date().toISOString() }).eq("id", id)
      : await ctx.admin.from("subjects").insert({ id, name, active: true });
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
