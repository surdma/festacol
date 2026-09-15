"use server";

import { readFile } from "node:fs/promises";
import path from "node:path";
import { revalidatePath } from "next/cache";
import type { ActionResult } from "@/app/actions/student";
import { currentStaff } from "@/lib/auth/staff";
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

interface QuestionFixture {
  schemaVersion: number;
  questions: Record<string, unknown>[];
}

const TRACK_DB: Record<FixtureCurriculumRule["track"], AcademicTrack> = {
  SCIENCE: "science",
  HUMANITIES: "humanities",
  BUSINESS: "business",
};
const PARTICIPATION_DB = { REQUIRED: "required", ELECTIVE: "elective" } as const;
const KIND_DB = { CURRICULUM: "curriculum", QUALIFIER: "qualifier" } as const;
const QUESTION_FIXTURE_SCHEMA_VERSION = 4;
const QUESTION_FIXTURE_FILES = [
  "questions.json",
  "questions/qualifier-english.json",
  "questions/qualifier-mathematics.json",
  "questions/qualifier-basic-science.json",
  "questions/qualifier-humanities.json",
  "questions/qualifier-business.json",
  "questions/qualifier-digital.json",
] as const;

async function requireAdmin() {
  const current = await currentStaff();
  if (!current.scope.profileId || !current.scope.isAdmin) throw new Error("Administrator sign-in required.");
  return createSupabaseAdminClient();
}

async function loadJson<T>(name: string): Promise<T> {
  return JSON.parse(await readFile(path.join(process.cwd(), "public", "seed", name), "utf8")) as T;
}

async function loadQuestionBankFixture(): Promise<QuestionFixture> {
  const fixtures = await Promise.all(
    QUESTION_FIXTURE_FILES.map((name) => loadJson<QuestionFixture>(name)),
  );
  for (const [index, fixture] of fixtures.entries()) {
    if (fixture.schemaVersion !== QUESTION_FIXTURE_SCHEMA_VERSION || !Array.isArray(fixture.questions)) {
      throw new Error(`Unsupported question fixture ${QUESTION_FIXTURE_FILES[index]}.`);
    }
  }
  return {
    schemaVersion: QUESTION_FIXTURE_SCHEMA_VERSION,
    questions: fixtures.flatMap((fixture) => fixture.questions),
  };
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

    for (const subject of fixture.subjects) {
      const subjectId = idByCode.get(subject.code)!;
      const desired = subject.curriculum.map((rule) => {
        const levelId = levelIdByName.get(rule.level);
        if (!levelId) throw new Error(`Academic level ${rule.level} is unavailable.`);
        return {
          subject_id: subjectId,
          level_id: levelId,
          track: TRACK_DB[rule.track],
          participation: PARTICIPATION_DB[rule.participation],
          updated_at: now,
        };
      });
      const { error: clearError } = await admin.from("subject_curriculum_rules").delete().eq("subject_id", subjectId);
      if (clearError) return { ok: false, error: clearError.message };
      if (desired.length) {
        const { error } = await admin.from("subject_curriculum_rules").insert(desired);
        if (error) return { ok: false, error: error.message };
      }
    }

    revalidatePath("/admin/settings");
    revalidatePath("/admin/classes");
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
  try {
    const admin = await requireAdmin();
    const fixture = await loadQuestionBankFixture();
    if (!fixture.questions.length) return { ok: false, error: "Question bank fixture is empty." };

    const ids = fixture.questions.map((question) => Number(question.id));
    if (ids.some((id) => !Number.isSafeInteger(id)) || new Set(ids).size !== ids.length) {
      return { ok: false, error: "Question bank fixture contains invalid or duplicate question ids." };
    }

    const subjectCodes = [...new Set(fixture.questions.map((question) => String(question.subjectCode ?? "")).filter(Boolean))];
    const [{ data: subjectRows, error: subjectError }, { data: academicLevels, error: levelError }, { data: existingRows, error: existingError }] = await Promise.all([
      admin.from("subjects").select("id,code").in("code", subjectCodes).eq("active", true),
      admin.from("academic_levels").select("id,name").eq("active", true),
      admin.from("questions").select("id,creator_id"),
    ]);
    if (subjectError || levelError || existingError) return { ok: false, error: subjectError?.message ?? levelError?.message ?? existingError?.message ?? "Question fixture references could not be resolved." };

    const subjectIdByCode = new Map(((subjectRows ?? []) as { id: string; code: string }[]).map((row) => [row.code, row.id]));
    const unresolved = subjectCodes.filter((code) => !subjectIdByCode.has(code));
    if (unresolved.length) return { ok: false, error: `Seed these subject codes before syncing questions: ${unresolved.join(", ")}.` };
    const levelIdByName = new Map(((academicLevels ?? []) as { id: string; name: string }[]).map((row) => [row.name, row.id]));
    const existing = new Map(((existingRows ?? []) as { id: number; creator_id: string | null }[]).map((row) => [Number(row.id), row.creator_id]));
    const protectedQuestion = fixture.questions.find((question) => existing.get(Number(question.id)) !== undefined && existing.get(Number(question.id)) !== null);
    if (protectedQuestion) return { ok: false, error: `Question id ${String(protectedQuestion.id)} belongs to a staff-authored question and cannot be replaced by the bank fixture.` };

    let count = 0;
    for (const question of fixture.questions) {
      const id = Number(question.id);
      const subjectId = subjectIdByCode.get(String(question.subjectCode ?? ""));
      if (!Number.isSafeInteger(id) || !subjectId) return { ok: false, error: `Question ${String(question.id)} has invalid identity metadata.` };
      const normalized = normalizeQuestion(question, subjectId);
      if (!normalized.levels.length) return { ok: false, error: `Question ${id} does not declare an academic level.` };
      const levelLinks = normalized.levels.map((levelName) => {
        const levelId = levelIdByName.get(levelName);
        if (!levelId) throw new Error(`Question ${id} references unavailable level ${levelName}.`);
        return { question_id: id, level_id: levelId };
      });

      const { error: questionError } = existing.has(id)
        ? await admin.from("questions").update(normalized.row).eq("id", id).is("creator_id", null)
        : await admin.from("questions").insert(normalized.row);
      if (questionError) return { ok: false, error: questionError.message };

      const { error: levelDeleteError } = await admin.from("question_academic_levels").delete().eq("question_id", id);
      if (levelDeleteError) return { ok: false, error: levelDeleteError.message };
      const { error: levelInsertError } = await admin.from("question_academic_levels").insert(levelLinks);
      if (levelInsertError) return { ok: false, error: levelInsertError.message };

      const { error: blankDeleteError } = await admin.from("question_blanks").delete().eq("question_id", id);
      if (blankDeleteError) return { ok: false, error: blankDeleteError.message };
      if (normalized.blanks.length) {
        const { error: blankInsertError } = await admin.from("question_blanks").insert(normalized.blanks);
        if (blankInsertError) return { ok: false, error: blankInsertError.message };
      }
      count += 1;
    }

    revalidatePath("/admin/questions");
    return { ok: true, count };
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
