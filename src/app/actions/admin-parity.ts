"use server";

import { revalidatePath } from "next/cache";
import {
  createExamAction,
  getExamDetailAction,
  upsertQuestionCore,
  updateExamAction,
  type ExamWizardInput,
} from "@/app/actions/admin";
import { currentStaff, questionSubjectVisibleTo } from "@/lib/auth/staff";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { listClasses } from "@/lib/supabase/queries";
import type { ActionResult } from "@/app/actions/student";
import type { QuestionType } from "@/types/exam";

export interface SubjectOption {
  id: string;
  name: string;
}

export interface OfferingOption {
  id: string;
  classId: string;
  className: string;
  classLevel: string;
  programmeId: string | null;
  programmeName: string;
  subjectId: string;
  subjectName: string;
  academicYearId: string;
  academicYear: string;
  academicTermId: string | null;
  academicTerm: string | null;
  participation: "required" | "elective";
  status: string;
}

async function staffContext() {
  const context = await currentStaff();
  if (!context.scope.profileId) throw new Error("Staff sign-in required.");
  return { ...context, admin: createSupabaseAdminClient() };
}

export async function getSubjectCatalogAction(): Promise<SubjectOption[]> {
  const { admin } = await staffContext();
  const { data } = await admin.from("subjects").select("id,name").eq("active", true).order("name");
  return (data ?? []) as SubjectOption[];
}

export async function getAdminFormOptionsAction() {
  const { admin, scope } = await staffContext();
  const [subjects, classes, programmesResult, yearsResult, termsResult, offeringsResult] = await Promise.all([
    getSubjectCatalogAction(),
    listClasses(admin),
    admin.from("academic_programmes").select("id,name").eq("active", true).order("name"),
    admin.from("academic_years").select("id,name,status").order("name", { ascending: false }),
    admin.from("academic_terms").select("id,academic_year_id,name,sequence,status").order("sequence"),
    admin.from("class_subject_offerings").select("id,class_id,subject_id,academic_term_id,participation,status").in("status", ["active", "draft"]).limit(1000),
  ]);
  const programmes = (programmesResult.data ?? []) as { id: string; name: string }[];
  const years = (yearsResult.data ?? []) as { id: string; name: string; status: string }[];
  const terms = (termsResult.data ?? []) as { id: string; academic_year_id: string; name: string; sequence: number; status: string }[];
  const classMap = new Map(classes.map((row) => [row.id, row]));
  const subjectMap = new Map(subjects.map((row) => [row.id, row]));
  const termMap = new Map(terms.map((row) => [row.id, row]));
  const offerings: OfferingOption[] = ((offeringsResult.data ?? []) as {
    id: string; class_id: string; subject_id: string; academic_term_id: string | null; participation: "required" | "elective"; status: string;
  }[]).flatMap((row) => {
    const cls = classMap.get(row.class_id);
    const subject = subjectMap.get(row.subject_id);
    if (!cls || !subject) return [];
    const term = row.academic_term_id ? termMap.get(row.academic_term_id) : undefined;
    return [{
      id: row.id,
      classId: row.class_id,
      className: cls.display_name,
      classLevel: cls.level_name,
      programmeId: cls.programme_id,
      programmeName: cls.programme_name ?? "General",
      subjectId: row.subject_id,
      subjectName: subject.name,
      academicYearId: cls.academic_year_id,
      academicYear: cls.academic_year_name,
      academicTermId: row.academic_term_id,
      academicTerm: term?.name ?? null,
      participation: row.participation,
      status: row.status,
    }];
  });
  return {
    subjects,
    classes: classes.map((row) => ({
      id: row.id,
      name: row.display_name,
      class_level: row.level_name,
      programme_id: row.programme_id,
      status: row.status,
    })),
    programmes, years, terms, offerings, scope,
  };
}

function validateExamShape(input: ExamWizardInput): string | null {
  if (input.title.trim().length < 3) return "Enter an exam title of at least 3 characters.";
  if (!Number.isInteger(input.durationSeconds) || input.durationSeconds < 30 || input.durationSeconds > 10800) return "Duration must be between 30 seconds and 3 hours.";
  if (!Number.isInteger(input.questionCount) || input.questionCount < 5 || input.questionCount > 150) return "Question count must be between 5 and 150.";
  if (!Number.isInteger(input.warnAfter) || input.warnAfter < 1 || input.warnAfter > 10) return "Integrity warning threshold must be between 1 and 10.";
  if (input.mode === "qualifier" && input.classLevel !== "SS1") return "Qualifier examinations are reserved for SS1.";
  if (input.mode === "waec" && input.classLevel !== "SS3") return "WAEC examinations are configured for SS3.";
  const subjectIds = [...new Set(input.subjectIds)];
  if (input.mode === "mixed" && (subjectIds.length < 2 || subjectIds.length > 12)) return "Mixed examinations require between 2 and 12 subjects.";
  if (["single", "waec", "bece", "neco", "jamb"].includes(input.mode) && subjectIds.length !== 1) return "This examination mode requires exactly one subject.";
  if (subjectIds.length && !input.offeringIds.length) return "Subject examinations require explicit class subject offerings.";
  if (!subjectIds.length && !input.classIds.length) return "General examinations require at least one class target.";
  return null;
}

async function eligibleQuestionCount(input: ExamWizardInput): Promise<number> {
  const { admin } = await staffContext();
  let query = admin.from("questions").select("id,subject_id,exam_modes").eq("status", "active").limit(5000);
  if (input.subjectIds.length) query = query.in("subject_id", [...new Set(input.subjectIds)]);
  const [{ data: questions }, { data: level }] = await Promise.all([
    query,
    admin.from("academic_levels").select("id").eq("name", input.classLevel).eq("active", true).maybeSingle(),
  ]);
  const levelId = (level as { id?: string } | null)?.id;
  if (!levelId) return 0;
  const eligibleByMode = ((questions ?? []) as { id: number; subject_id: string; exam_modes: string[] }[]).filter((question) =>
    (question.exam_modes ?? []).includes(input.mode)
      && (!input.subjectIds.length || input.subjectIds.includes(question.subject_id)),
  );
  if (!eligibleByMode.length) return 0;
  const { data: links } = await admin.from("question_academic_levels").select("question_id").eq("level_id", levelId).in("question_id", eligibleByMode.map((question) => question.id));
  return new Set(((links ?? []) as { question_id: number }[]).map((link) => Number(link.question_id))).size;
}

export async function getExamCoverageAction(input: ExamWizardInput): Promise<{ ok: boolean; count: number; error?: string }> {
  const shapeError = validateExamShape(input);
  if (shapeError) return { ok: false, count: 0, error: shapeError };
  const { admin } = await staffContext();
  if (input.offeringIds.length) {
    const { data: offerings } = await admin.from("class_subject_offerings").select("id,subject_id,class_id,status").in("id", input.offeringIds);
    const rows = (offerings ?? []) as { id: string; subject_id: string; class_id: string; status: string }[];
    if (rows.length !== [...new Set(input.offeringIds)].length || rows.some((row) => row.status !== "active")) return { ok: false, count: 0, error: "One or more subject offerings are unavailable." };
    const offeredSubjects = new Set(rows.map((row) => row.subject_id));
    if (input.subjectIds.some((subjectId) => !offeredSubjects.has(subjectId))) return { ok: false, count: 0, error: "Every exam subject needs a selected class subject offering." };
  }
  const count = await eligibleQuestionCount(input);
  if (count < input.questionCount) return { ok: false, count, error: `Only ${count} eligible questions are available for this paper.` };
  return { ok: true, count };
}

export async function createExamParityAction(input: ExamWizardInput): Promise<ActionResult & { id?: string }> {
  try {
    const shapeError = validateExamShape(input);
    if (shapeError) return { ok: false, error: shapeError };
    const coverage = await getExamCoverageAction(input);
    if (!coverage.ok) return { ok: false, error: coverage.error };
    return createExamAction({
      ...input,
      subjectIds: [...new Set(input.subjectIds)],
      offeringIds: [...new Set(input.offeringIds)],
      classIds: [...new Set(input.classIds)],
    });
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "Create failed." };
  }
}

export async function getExamEditorDetailAction(examId: string) {
  const detail = await getExamDetailAction(examId);
  return { ...detail, structureLocked: detail.attempts.length > 0 };
}

export async function updateExamParityAction(
  id: string,
  patch: { title: string; durationSeconds: number; questionCount: number; instructions: string; status: string; cameraRequired: boolean; warnAfter: number },
): Promise<ActionResult> {
  try {
    const detail = await getExamDetailAction(id);
    const session = detail.session as { duration_seconds?: number; question_count?: number } | null;
    if (!session) return { ok: false, error: "Exam not found or outside your scope." };
    if (patch.title.trim().length < 3) return { ok: false, error: "Enter an exam title of at least 3 characters." };
    if (!Number.isInteger(patch.warnAfter) || patch.warnAfter < 1 || patch.warnAfter > 10) return { ok: false, error: "Integrity warning threshold must be between 1 and 10." };
    if (detail.attempts.length > 0 && (patch.durationSeconds !== Number(session.duration_seconds) || patch.questionCount !== Number(session.question_count))) {
      return { ok: false, error: "Paper structure is locked after the first allocated attempt." };
    }
    if (!Number.isInteger(patch.durationSeconds) || patch.durationSeconds < 30 || patch.durationSeconds > 10800) return { ok: false, error: "Duration must be between 30 seconds and 3 hours." };
    if (!Number.isInteger(patch.questionCount) || patch.questionCount < 5 || patch.questionCount > 150) return { ok: false, error: "Question count must be between 5 and 150." };
    return updateExamAction(id, patch);
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "Update failed." };
  }
}

export interface QuestionEditorInput {
  id?: number;
  subjectId: string;
  kind: QuestionType;
  prompt: string;
  options: string[];
  correctAnswers: string[];
  levels: string[];
  fillTemplate?: string;
  blankAnswers?: string[][];
  difficulty?: string;
  domain?: string;
  explanation?: string;
}

function questionValidation(input: QuestionEditorInput): string | null {
  if (!input.subjectId) return "Choose a subject.";
  if (input.prompt.trim().length < 3) return "Enter the question prompt.";
  if (!input.levels.length) return "Choose at least one class level.";
  if (!["single", "multi", "boolean", "fill", "fill-multi"].includes(input.kind)) return "Unsupported question type.";
  if (input.kind === "single" || input.kind === "multi") {
    const options = [...new Set(input.options.map((value) => value.trim()).filter(Boolean))];
    if (options.length < 2) return "Choice questions need at least two distinct options.";
    const answers = [...new Set(input.correctAnswers.map((value) => value.trim()).filter(Boolean))];
    if (!answers.length || answers.some((answer) => !options.includes(answer))) return "Every correct answer must match one of the supplied options.";
    if (input.kind === "single" && answers.length !== 1) return "Single-choice questions require exactly one correct answer.";
  }
  if (input.kind === "boolean" && !["true", "false"].includes(String(input.correctAnswers[0]).toLowerCase())) return "Choose True or False as the correct answer.";
  if (input.kind === "fill" || input.kind === "fill-multi") {
    const markers = (input.fillTemplate ?? "").match(/___/g)?.length ?? 0;
    if (!markers) return "Fill questions need at least one ___ blank marker.";
    if ((input.blankAnswers ?? []).length !== markers) return "Provide accepted answers for every blank.";
    if ((input.blankAnswers ?? []).some((answers) => !answers.some((answer) => answer.trim()))) return "Every blank needs at least one accepted answer.";
    if (input.kind === "fill" && markers !== 1) return "Single-gap fill questions require exactly one blank.";
  }
  return null;
}

export async function upsertQuestionParityAction(input: QuestionEditorInput): Promise<ActionResult & { id?: number }> {
  try {
    const validation = questionValidation(input);
    if (validation) return { ok: false, error: validation };
    const current = await currentStaff();
    if (!current.scope.profileId || !questionSubjectVisibleTo(input.subjectId, current.scope)) return { ok: false, error: "Outside your subject scope." };
    const options = input.kind === "single" || input.kind === "multi" ? [...new Set(input.options.map((value) => value.trim()).filter(Boolean))] : [];
    const correctAnswers = input.kind === "fill" || input.kind === "fill-multi"
      ? []
      : input.kind === "boolean"
        ? [String(input.correctAnswers[0]).toLowerCase()]
        : [...new Set(input.correctAnswers.map((value) => value.trim()).filter(Boolean))];
    let fillTemplate: string | null = null;
    const blanks: { position: number; accepted: string[] }[] = [];
    if (input.kind === "fill" || input.kind === "fill-multi") {
      let position = 0;
      fillTemplate = String(input.fillTemplate).replace(/___/g, () => `{{${position++}}}`);
      for (let index = 0; index < (input.blankAnswers ?? []).length; index += 1) {
        blanks.push({ position: index, accepted: [...new Set((input.blankAnswers?.[index] ?? []).map((answer) => answer.trim()).filter(Boolean))] });
      }
    }
    return upsertQuestionCore({
      id: input.id,
      subjectId: input.subjectId,
      kind: input.kind,
      prompt: input.prompt,
      options,
      correctAnswers,
      levels: [...new Set(input.levels)],
      fillTemplate,
      difficulty: input.difficulty,
      domain: input.domain?.trim(),
      explanation: input.explanation?.trim(),
      blanks,
    });
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "Save failed." };
  }
}

export async function getClassDetailAction(classId: string) {
  const { admin } = await staffContext();
  const [classes, { data: enrollments }, { data: offerings }, { data: groups }] = await Promise.all([
    listClasses(admin),
    admin.from("class_enrollments").select("student_profile_id,status").eq("class_id", classId).eq("status", "active").limit(500),
    admin.from("class_subject_offerings").select("id,subject_id,academic_term_id,participation,status").eq("class_id", classId).order("status"),
    admin.from("whatsapp_groups").select("*").eq("class_id", classId).order("created_at"),
  ]);
  const classRow = classes.find((row) => row.id === classId) ?? null;
  const enrollmentRows = (enrollments ?? []) as { student_profile_id: string; status: string }[];
  const profileIds = enrollmentRows.map((row) => row.student_profile_id);
  const { data: profiles } = profileIds.length
    ? await admin.from("academic_profiles").select("id,first_name,last_name,status").in("id", profileIds).order("last_name")
    : { data: [] };
  const students = ((profiles ?? []) as { id: string; first_name: string; last_name: string; status: string }[]).map((row) => ({
    ...row,
    full_name: `${row.first_name} ${row.last_name}`.trim(),
  }));
  const offeringRows = (offerings ?? []) as { id: string; subject_id: string; academic_term_id: string | null; participation: string; status: string }[];
  const subjectIds = [...new Set(offeringRows.map((row) => row.subject_id))];
  const { data: subjects } = subjectIds.length ? await admin.from("subjects").select("id,name").in("id", subjectIds) : { data: [] };
  const subjectMap = new Map(((subjects ?? []) as { id: string; name: string }[]).map((row) => [row.id, row.name]));
  return {
    classRow,
    students,
    offerings: offeringRows.map((row) => ({ ...row, subject_name: subjectMap.get(row.subject_id) ?? "Subject" })),
    groups: groups ?? [],
  };
}

export async function getWhatsappDetailAction(groupId: string) {
  const { admin, scope } = await staffContext();
  if (!scope.isAdmin) return null;
  const { data } = await admin.from("whatsapp_groups").select("*").eq("id", groupId).maybeSingle();
  return data;
}
