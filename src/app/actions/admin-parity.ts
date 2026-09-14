"use server";

import { revalidatePath } from "next/cache";
import {
  createExamAction,
  getExamDetailAction,
  updateExamAction,
  type ExamWizardInput,
} from "@/app/actions/admin";
import { currentStaff } from "@/lib/auth/staff";
import { WAEC_SUBJECTS } from "@/lib/subjects-catalog";
import type { ActionResult } from "@/app/actions/student";
import type { QuestionType } from "@/types/exam";

export interface SubjectOption {
  code: string;
  name: string;
  streams: string[];
}

export async function getSubjectCatalogAction(): Promise<SubjectOption[]> {
  const { supabase } = await currentStaff();
  const { data } = await supabase.from("subjects").select("code,name,streams").eq("active", true).order("name");
  const rows = (data ?? []) as SubjectOption[];
  if (rows.length) return rows;
  return WAEC_SUBJECTS.map((subject) => ({ code: subject.code, name: subject.name, streams: subject.streams ?? [] }));
}

export async function getAdminFormOptionsAction() {
  const { supabase, scope } = await currentStaff();
  const [subjects, classesResult] = await Promise.all([
    getSubjectCatalogAction(),
    supabase.from("classes").select("id,name,class_level,status").order("class_level").order("name").limit(200),
  ]);
  return {
    subjects,
    classes: ((classesResult.data ?? []) as { id: string; name: string; class_level: string; status: string }[]).filter((item) => item.status === "active"),
    scope,
  };
}

function validateExamShape(input: ExamWizardInput): string | null {
  const title = input.title.trim();
  if (title.length < 3) return "Enter an exam title of at least 3 characters.";
  if (!Number.isInteger(input.durationSeconds) || input.durationSeconds < 30 || input.durationSeconds > 10800) return "Duration must be between 30 seconds and 3 hours.";
  if (!Number.isInteger(input.questionCount) || input.questionCount < 5 || input.questionCount > 150) return "Question count must be between 5 and 150.";
  if (!Number.isInteger(input.warnAfter) || input.warnAfter < 1 || input.warnAfter > 10) return "Integrity warning threshold must be between 1 and 10.";
  if (input.mode === "qualifier" && input.classLevel !== "SS1") return "Qualifier examinations are reserved for SS1.";
  if (input.mode === "waec" && input.classLevel !== "SS3") return "WAEC examinations are configured for SS3.";
  if (input.mode === "mixed" && (input.subjects.length < 2 || input.subjects.length > 12)) return "Mixed examinations require between 2 and 12 subjects.";
  if (["single", "waec", "bece", "neco", "jamb"].includes(input.mode) && input.subjects.length !== 1) return "This examination mode requires exactly one subject.";
  if (input.mode === "qualifier" && input.subjects.some((code) => !code.startsWith("q-"))) return "Qualifier examinations can only target qualifier-domain subjects.";
  return null;
}

async function eligibleQuestionCount(input: ExamWizardInput): Promise<number> {
  const { supabase } = await currentStaff();
  const { data } = await supabase.from("questions").select("subject_code,levels,exam_modes").limit(2500);
  return ((data ?? []) as { subject_code: string; levels: string[]; exam_modes: string[] }[]).filter((question) => {
    if (!(question.levels ?? []).includes(input.classLevel)) return false;
    if (!(question.exam_modes ?? []).includes(input.mode)) return false;
    if (input.mode === "qualifier") return input.subjects.length === 0 || input.subjects.includes(question.subject_code);
    return input.subjects.includes(question.subject_code);
  }).length;
}

export async function getExamCoverageAction(input: ExamWizardInput): Promise<{ ok: boolean; count: number; error?: string }> {
  const shapeError = validateExamShape(input);
  if (shapeError) return { ok: false, count: 0, error: shapeError };
  const count = await eligibleQuestionCount(input);
  if (count < input.questionCount) return { ok: false, count, error: `Only ${count} eligible questions are available for this paper.` };
  return { ok: true, count };
}

export async function createExamParityAction(input: ExamWizardInput): Promise<ActionResult & { id?: string }> {
  try {
    const shapeError = validateExamShape(input);
    if (shapeError) return { ok: false, error: shapeError };
    const available = await eligibleQuestionCount(input);
    if (available < input.questionCount) return { ok: false, error: `Only ${available} eligible questions are available for this paper.` };
    return createExamAction({ ...input, subjects: [...new Set(input.subjects)] });
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "Create failed." };
  }
}

export async function getExamEditorDetailAction(examId: string) {
  const { supabase } = await currentStaff();
  const detail = await getExamDetailAction(examId);
  const { data: policy } = await supabase.from("exam_proctor_policies").select("camera_required").eq("session_id", examId).maybeSingle();
  return {
    ...detail,
    cameraRequired: Boolean((policy as { camera_required?: boolean } | null)?.camera_required),
    structureLocked: detail.attempts.length > 0,
  };
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
      return { ok: false, error: "Paper structure is locked after the first candidate attempt. Title, instructions, status and integrity controls may still be updated." };
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
  subjectCode: string;
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

type ExistingQuestionRow = {
  subject_code: string;
  created_by: string | null;
};

function questionValidation(input: QuestionEditorInput): string | null {
  if (!input.subjectCode.trim()) return "Choose a subject.";
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
    if (input.kind === "fill" && markers !== 1) return "Single-gap fill questions require exactly one blank. Use multi-gap for multiple blanks.";
  }
  return null;
}

export async function upsertQuestionParityAction(input: QuestionEditorInput): Promise<ActionResult & { id?: number }> {
  try {
    const validationError = questionValidation(input);
    if (validationError) return { ok: false, error: validationError };
    const { supabase, scope } = await currentStaff();
    if (!scope.isAdmin && !scope.subjects.includes(input.subjectCode)) return { ok: false, error: "Outside your subject scope." };

    let existing: ExistingQuestionRow | null = null;
    if (input.id !== undefined) {
      const { data } = await supabase.from("questions").select("subject_code,created_by").eq("id", input.id).maybeSingle();
      existing = data as ExistingQuestionRow | null;
      if (!existing) return { ok: false, error: "Question not found." };
      if (!scope.isAdmin && existing.created_by !== scope.staffId) return { ok: false, error: "Teachers can edit only questions they authored." };
    }

    const { data: subjectRow } = await supabase.from("subjects").select("name").eq("code", input.subjectCode).maybeSingle();
    const subjectName = (subjectRow as { name?: string } | null)?.name ?? input.subjectCode;
    let id = input.id;
    if (id === undefined) {
      const { data: maxRow } = await supabase.from("questions").select("id").order("id", { ascending: false }).limit(1).maybeSingle();
      id = Number((maxRow as { id?: number } | null)?.id ?? 0) + 1;
    }

    const options = input.kind === "single" || input.kind === "multi" ? [...new Set(input.options.map((value) => value.trim()).filter(Boolean))] : [];
    const correctAnswers = input.kind === "fill" || input.kind === "fill-multi"
      ? []
      : input.kind === "boolean"
        ? [String(input.correctAnswers[0]).toLowerCase()]
        : [...new Set(input.correctAnswers.map((value) => value.trim()).filter(Boolean))];

    let fillTemplate: string | null = null;
    const blanks: { question_id: number; position: number; blank_key: string; placeholder: string; accepted: string[] }[] = [];
    if (input.kind === "fill" || input.kind === "fill-multi") {
      let position = 0;
      fillTemplate = String(input.fillTemplate).replace(/___/g, () => `{{${position++}}}`);
      for (let index = 0; index < (input.blankAnswers ?? []).length; index += 1) {
        blanks.push({
          question_id: id,
          position: index,
          blank_key: `b${index}`,
          placeholder: `Answer ${index + 1}`,
          accepted: [...new Set((input.blankAnswers?.[index] ?? []).map((answer) => answer.trim()).filter(Boolean))],
        });
      }
    }

    const row = {
      id,
      subject_code: input.subjectCode,
      subject_name: subjectName,
      label: subjectName,
      qtype: input.kind,
      prompt: input.prompt.trim(),
      options,
      correct_answers: correctAnswers,
      fill_template: fillTemplate,
      instruction: "",
      levels: [...new Set(input.levels)],
      exam_modes: ["single", "mixed", "waec", "qualifier", "bece", "neco", "jamb"],
      difficulty: input.difficulty ?? "medium",
      domain: input.domain?.trim() ?? "",
      explanation: input.explanation?.trim() ?? "",
      created_by: existing?.created_by ?? scope.staffId,
      updated_at: Date.now(),
    };

    const write = input.id === undefined
      ? await supabase.from("questions").insert(row)
      : await supabase.from("questions").update(row).eq("id", id);
    if (write.error) return { ok: false, error: write.error.message };

    if (blanks.length) {
      const { error: blankError } = await supabase.from("question_blanks").upsert(blanks);
      if (blankError) {
        if (input.id === undefined) await supabase.from("questions").delete().eq("id", id);
        return { ok: false, error: blankError.message };
      }
      await supabase.from("question_blanks").delete().eq("question_id", id).gte("position", blanks.length);
    } else {
      const { error: deleteError } = await supabase.from("question_blanks").delete().eq("question_id", id);
      if (deleteError) return { ok: false, error: deleteError.message };
    }

    revalidatePath("/admin/questions");
    return { ok: true, id };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "Save failed." };
  }
}

export async function getClassDetailAction(classId: string) {
  const { supabase } = await currentStaff();
  const [{ data: classRow }, { data: students }, { data: groups }] = await Promise.all([
    supabase.from("classes").select("*").eq("id", classId).maybeSingle(),
    supabase.from("users").select("id,full_name,status").eq("role", "student").eq("class_id", classId).order("full_name").limit(300),
    supabase.from("whatsapp_groups").select("*").eq("class_id", classId).order("created_at"),
  ]);
  return { classRow, students: students ?? [], groups: groups ?? [] };
}

export async function getWhatsappDetailAction(groupId: string) {
  const { supabase, scope } = await currentStaff();
  if (!scope.isAdmin) return null;
  const { data } = await supabase.from("whatsapp_groups").select("*").eq("id", groupId).maybeSingle();
  return data;
}
