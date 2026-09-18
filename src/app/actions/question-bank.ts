"use server";

import { readFile } from "node:fs/promises";
import path from "node:path";
import { revalidatePath } from "next/cache";
import type { ActionResult } from "@/app/actions/student";
import { currentStaff } from "@/lib/auth/staff";
import { loadQuestionBankFixture } from "@/lib/question-fixture-loader";
import { activeAllocatedQuestionIds, activeQuestionMutationMessage } from "@/lib/question-integrity";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import type { AcademicTrack } from "@/types/db";

interface FixtureCurriculumRule {
  level: "SS1" | "SS2" | "SS3";
  track: "SCIENCE" | "HUMANITIES" | "BUSINESS";
  participation: "REQUIRED" | "ELECTIVE";
}

interface FixtureSubject {
  code: string;
  name: string;
  kind: "CURRICULUM" | "QUALIFIER";
  active: boolean;
  curriculum: FixtureCurriculumRule[];
}

interface SubjectFixture {
  schemaVersion: number;
  subjects: FixtureSubject[];
}

const TRACK_DB: Record<FixtureCurriculumRule["track"], AcademicTrack> = {
  SCIENCE: "science",
  HUMANITIES: "humanities",
  BUSINESS: "business",
};
const PARTICIPATION_DB = { REQUIRED: "required", ELECTIVE: "elective" } as const;
const KIND_DB = { CURRICULUM: "curriculum", QUALIFIER: "qualifier" } as const;

async function requireAdmin() {
  const current = await currentStaff();
  if (!current.scope.profileId || !current.scope.isAdmin) throw new Error("Administrator sign-in required.");
  return createSupabaseAdminClient();
}

async function loadJson<T>(name: string): Promise<T> {
  return JSON.parse(await readFile(path.join(process.cwd(), "public", "seed", name), "utf8")) as T;
}

export async function seedSubjectCatalogFromFixtureAction(): Promise<ActionResult & { count?: number }> {
  try {
    const admin = await requireAdmin();
    const fixture = await loadJson<SubjectFixture>("subjects.json");
    if (fixture.schemaVersion !== 5 || !fixture.subjects.length) return { ok: false, error: "Unsupported subject fixture." };
    const codes = fixture.subjects.map((subject) => subject.code.trim());
    if (new Set(codes).size !== codes.length) return { ok: false, error: "Subject fixture contains duplicate codes." };

    const now = new Date().toISOString();
    const { error: subjectError } = await admin.from("subjects").upsert(
      fixture.subjects.map((subject) => ({
        code: subject.code,
        name: subject.name,
        kind: KIND_DB[subject.kind],
        active: subject.active,
        updated_at: now,
      })),
      { onConflict: "code" },
    );
    if (subjectError) return { ok: false, error: subjectError.message };

    const [{ data: subjectRows, error: lookupError }, { data: levels, error: levelError }] = await Promise.all([
      admin.from("subjects").select("id,code").in("code", codes),
      admin.from("academic_levels").select("id,name").eq("active", true),
    ]);
    if (lookupError || levelError) return { ok: false, error: lookupError?.message ?? levelError?.message ?? "Fixture references could not be resolved." };
    const idByCode = new Map(((subjectRows ?? []) as { id: string; code: string }[]).map((row) => [row.code, row.id]));
    const levelIdByName = new Map(((levels ?? []) as { id: string; name: string }[]).map((row) => [row.name, row.id]));
    if (idByCode.size !== fixture.subjects.length) return { ok: false, error: "Not every fixture subject resolved to a canonical subject row." };

    // Bulk path: one delete + one insert for every curriculum rule instead of
    // one delete + one insert per subject.
    const subjectIds: string[] = [];
    const allRules: { subject_id: string; level_id: string; track: AcademicTrack; participation: "required" | "elective"; updated_at: string }[] = [];
    for (const subject of fixture.subjects) {
      const subjectId = idByCode.get(subject.code);
      if (!subjectId) return { ok: false, error: `Subject ${subject.code} could not be resolved after publishing.` };
      subjectIds.push(subjectId);
      for (const rule of subject.curriculum) {
        const levelId = levelIdByName.get(rule.level);
        if (!levelId) return { ok: false, error: `Academic level ${rule.level} is unavailable.` };
        allRules.push({
          subject_id: subjectId,
          level_id: levelId,
          track: TRACK_DB[rule.track],
          participation: PARTICIPATION_DB[rule.participation],
          updated_at: now,
        });
      }
    }
    const { error: clearError } = await admin.from("subject_curriculum_rules").delete().in("subject_id", subjectIds);
    if (clearError) return { ok: false, error: clearError.message };
    if (allRules.length) {
      const { error } = await admin.from("subject_curriculum_rules").insert(allRules);
      if (error) return { ok: false, error: error.message };
    }

    revalidatePath("/workspace/settings");
    revalidatePath("/workspace/classes");
    return { ok: true, count: fixture.subjects.length };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "Subject fixture sync failed." };
  }
}

function normalizeQuestion(question: Record<string, unknown>, subjectId: string) {
  const id = Number(question.id);
  const type = String(question.type ?? "single");
  const rawAnswer = question.answer as unknown;
  const rawAnswers = question.answers as unknown;
  const correct = type === "boolean"
    ? [String(rawAnswer)]
    : Array.isArray(rawAnswers)
      ? rawAnswers.map(String)
      : Array.isArray(rawAnswer)
        ? rawAnswer.map(String)
        : rawAnswer !== undefined
          ? [String(rawAnswer)]
          : [];
  const modes = Array.isArray(question.examModes) ? (question.examModes as unknown[]).map(String) : ["single", "mixed", "waec"];
  const template = question.fillTemplate as { text?: string; blank?: string; placeholder?: string }[] | undefined;
  const acceptedSource = Array.isArray(question.acceptedAnswers) ? question.acceptedAnswers as unknown[] : [];
  const nestedAcceptedAnswers = acceptedSource.length > 0 && Array.isArray(acceptedSource[0]);
  const blanks: { question_id: number; position: number; blank_key: string; placeholder: string; accepted: string[] }[] = [];
  let position = 0;
  const fillTemplate = template
    ? template.map((part) => {
        if (part.blank === undefined) return part.text ?? "";
        const accepted = nestedAcceptedAnswers
          ? ((acceptedSource[position] ?? []) as unknown[]).map(String)
          : position === 0
            ? acceptedSource.map(String)
            : [];
        blanks.push({
          question_id: id,
          position,
          blank_key: String(part.blank || `b${position}`),
          placeholder: String(part.placeholder ?? ""),
          accepted,
        });
        return `{{${position++}}}`;
      }).join("")
    : null;

  return {
    row: {
      id,
      subject_id: subjectId,
      qtype: type,
      prompt: String(question.prompt ?? ""),
      options: Array.isArray(question.options) ? (question.options as unknown[]).map(String) : [],
      correct_answers: type === "fill" || type === "fill-multi" ? [] : correct,
      fill_template: fillTemplate,
      instruction: String(question.instruction ?? ""),
      exam_modes: modes,
      difficulty: String(question.difficulty ?? "medium"),
      domain: String(question.domain ?? ""),
      explanation: String(question.explanation ?? ""),
      status: "active",
      creator_id: null,
      created_at: new Date().toISOString(),
      updated_at: Date.now(),
    },
    levels: Array.isArray(question.levels) ? (question.levels as unknown[]).map(String) : [],
    blanks,
  };
}

export async function syncQuestionBankFromFixtureAction(): Promise<ActionResult & { count?: number }> {
  const plan = await getQuestionBankSyncPlanAction();
  if (!plan.ok || plan.total === undefined) return { ok: false, error: plan.error ?? "Question fixture sync failed." };
  const BATCH = 200;
  let written = 0;
  for (let offset = 0; offset < plan.total; offset += BATCH) {
    const batch = await syncQuestionBankBatchAction(offset, BATCH);
    if (!batch.ok) return { ok: false, error: batch.error ?? "Question fixture sync failed." };
    written = batch.done ?? written;
  }
  return { ok: true, count: written };
}

export async function getQuestionBankSyncPlanAction(): Promise<ActionResult & { total?: number }> {
  try {
    const admin = await requireAdmin();
    const fixture = await loadQuestionBankFixture();
    if (!fixture.questions.length) return { ok: false, error: "The exam question set is empty." };

    const ids = fixture.questions.map((question) => Number(question.id));
    if (ids.some((id) => !Number.isSafeInteger(id)) || new Set(ids).size !== ids.length) {
      return { ok: false, error: "The exam question set contains invalid or duplicate question numbers." };
    }

    const subjectCodes = [...new Set(fixture.questions.map((question) => String(question.subjectCode ?? "")).filter(Boolean))];
    const [{ data: subjectRows, error: subjectError }, { data: academicLevels, error: levelError }, { data: existingRows, error: existingError }] = await Promise.all([
      admin.from("subjects").select("id,code").in("code", subjectCodes).eq("active", true),
      admin.from("academic_levels").select("id,name").eq("active", true),
      admin.from("questions").select("id,creator_id"),
    ]);
    if (subjectError || levelError || existingError) return { ok: false, error: subjectError?.message ?? levelError?.message ?? existingError?.message ?? "Question references could not be resolved." };

    const subjectIdByCode = new Map(((subjectRows ?? []) as { id: string; code: string }[]).map((row) => [row.code, row.id]));
    const unresolved = subjectCodes.filter((code) => !subjectIdByCode.has(code));
    if (unresolved.length) return { ok: false, error: `Publish these subjects before adding exam questions: ${unresolved.join(", ")}.` };
    const levelNames = new Set(((academicLevels ?? []) as { name: string }[]).map((row) => row.name));
    for (const question of fixture.questions) {
      const levels = Array.isArray(question.levels) ? question.levels.map(String) : [];
      if (!levels.length) return { ok: false, error: `Question ${String(question.id)} is missing a class level.` };
      const missing = levels.filter((name) => !levelNames.has(name));
      if (missing.length) return { ok: false, error: `Question ${String(question.id)} refers to an unavailable class (${missing.join(", ")}).` };
    }
    const existing = new Map(((existingRows ?? []) as { id: number; creator_id: string | null }[]).map((row) => [Number(row.id), row.creator_id]));
    const activeReferences = await activeAllocatedQuestionIds(admin, ids);
    if (activeReferences.size) {
      const [questionId] = [...activeReferences].sort((left, right) => left - right);
      return { ok: false, error: activeQuestionMutationMessage(questionId) };
    }
    const protectedQuestion = fixture.questions.find((question) => existing.get(Number(question.id)) !== undefined && existing.get(Number(question.id)) !== null);
    if (protectedQuestion) return { ok: false, error: `Question ${String(protectedQuestion.id)} was written by staff and cannot be replaced by the prepared set.` };

    return { ok: true, total: fixture.questions.length };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "Question fixture sync failed." };
  }
}

export async function syncQuestionBankBatchAction(offset: number, limit: number): Promise<ActionResult & { done?: number; total?: number }> {
  try {
    const safeOffset = Math.max(0, Math.floor(offset));
    const safeLimit = Math.min(200, Math.max(1, Math.floor(limit)));
    const admin = await requireAdmin();
    const fixture = await loadQuestionBankFixture();
    const total = fixture.questions.length;
    if (safeOffset >= total) return { ok: true, done: total, total };
    const slice = fixture.questions.slice(safeOffset, safeOffset + safeLimit);

    const subjectCodes = [...new Set(slice.map((question) => String(question.subjectCode ?? "")).filter(Boolean))];
    const [{ data: subjectRows, error: subjectError }, { data: academicLevels, error: levelError }, { data: existingRows, error: existingError }] = await Promise.all([
      admin.from("subjects").select("id,code").in("code", subjectCodes).eq("active", true),
      admin.from("academic_levels").select("id,name").eq("active", true),
      admin.from("questions").select("id,creator_id").in("id", slice.map((question) => Number(question.id))),
    ]);
    if (subjectError || levelError || existingError) return { ok: false, error: subjectError?.message ?? levelError?.message ?? existingError?.message ?? "Question references could not be resolved." };

    const subjectIdByCode = new Map(((subjectRows ?? []) as { id: string; code: string }[]).map((row) => [row.code, row.id]));
    const levelIdByName = new Map(((academicLevels ?? []) as { id: string; name: string }[]).map((row) => [row.name, row.id]));
    const existing = new Map(((existingRows ?? []) as { id: number; creator_id: string | null }[]).map((row) => [Number(row.id), row.creator_id]));

    // Staff safeguard first: never touch a batch containing a staff-written question.
    for (const question of slice) {
      const id = Number(question.id);
      if (existing.get(id) !== undefined && existing.get(id) !== null) {
        return { ok: false, error: `Question ${id} was written by staff and cannot be replaced by the prepared set.` };
      }
    }

    // Bulk path: one upsert for all question rows, then one delete + one
    // insert per link table. ~5 round-trips per batch regardless of batch size,
    // instead of ~5 sequential round-trips per question.
    const ids = slice.map((question) => Number(question.id));
    const activeReferences = await activeAllocatedQuestionIds(admin, ids);
    if (activeReferences.size) {
      const [questionId] = [...activeReferences].sort((left, right) => left - right);
      return { ok: false, error: activeQuestionMutationMessage(questionId) };
    }
    const questionRows: Record<string, unknown>[] = [];
    const allLevelLinks: { question_id: number; level_id: string }[] = [];
    const allBlanks: { question_id: number; position: number; blank_key: string; placeholder: string; accepted: string[] }[] = [];
    for (const question of slice) {
      const id = Number(question.id);
      const subjectId = subjectIdByCode.get(String(question.subjectCode ?? ""));
      if (!Number.isSafeInteger(id) || !subjectId) return { ok: false, error: `Question ${String(question.id)} has invalid subject information.` };
      const normalized = normalizeQuestion(question, subjectId);
      if (!normalized.levels.length) return { ok: false, error: `Question ${id} is missing a class level.` };
      questionRows.push(normalized.row as Record<string, unknown>);
      for (const levelName of normalized.levels) {
        const levelId = levelIdByName.get(levelName);
        if (!levelId) return { ok: false, error: `Question ${id} refers to an unavailable class (${levelName}).` };
        allLevelLinks.push({ question_id: id, level_id: levelId });
      }
      allBlanks.push(...normalized.blanks);
    }

    const { error: questionError } = await admin.from("questions").upsert(questionRows, { onConflict: "id" });
    if (questionError) return { ok: false, error: questionError.message.includes("question_in_active_exam") ? activeQuestionMutationMessage() : questionError.message };

    const { error: levelDeleteError } = await admin.from("question_academic_levels").delete().in("question_id", ids);
    if (levelDeleteError) return { ok: false, error: levelDeleteError.message };
    if (allLevelLinks.length) {
      const { error: levelInsertError } = await admin.from("question_academic_levels").insert(allLevelLinks);
      if (levelInsertError) return { ok: false, error: levelInsertError.message };
    }

    const { error: blankDeleteError } = await admin.from("question_blanks").delete().in("question_id", ids);
    if (blankDeleteError) return { ok: false, error: blankDeleteError.message };
    if (allBlanks.length) {
      const { error: blankInsertError } = await admin.from("question_blanks").insert(allBlanks);
      if (blankInsertError) return { ok: false, error: blankInsertError.message };
    }

    const done = Math.min(total, safeOffset + slice.length);
    if (done >= total) {
      revalidatePath("/workspace/questions");
      revalidatePath("/workspace/settings");
    }
    return { ok: true, done, total };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "Question fixture sync failed." };
  }
}

export async function getQuestionEditorDetailAction(id: number) {
  const current = await currentStaff();
  if (!current.scope.profileId) throw new Error("Staff sign-in required.");
  const admin = createSupabaseAdminClient();
  const [{ data: question }, { data: blanks }, { data: links }] = await Promise.all([
    admin.from("questions").select("*").eq("id", id).maybeSingle(),
    admin.from("question_blanks").select("*").eq("question_id", id).order("position"),
    admin.from("question_academic_levels").select("level_id").eq("question_id", id),
  ]);
  const row = question as { subject_id?: string } | null;
  if (!row?.subject_id) return { question: null, blanks: [] };
  if (!current.scope.isAdmin && !current.scope.subjectIds.includes(row.subject_id)) return { question: null, blanks: [] };
  const levelIds = ((links ?? []) as { level_id: string }[]).map((link) => link.level_id);
  const { data: levels } = levelIds.length
    ? await admin.from("academic_levels").select("id,name").in("id", levelIds)
    : { data: [] };
  return {
    question: { ...row, levels: ((levels ?? []) as { name: string }[]).map((level) => level.name) },
    blanks: blanks ?? [],
  };
}
