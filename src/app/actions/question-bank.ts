"use server";

import { readFile } from "node:fs/promises";
import path from "node:path";
import { revalidatePath } from "next/cache";
import type { ActionResult } from "@/app/actions/student";
import { currentStaff } from "@/lib/auth/staff";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import type { AcademicTrack } from "@/types/db";

interface FixtureTrackRule {
  track: "SCIENCE" | "ART" | "SOCIAL_SCIENCE";
  participation: "REQUIRED" | "ELECTIVE";
}

interface FixtureSubject {
  code: string;
  name: string;
  active: boolean;
  levels: string[];
  modes: string[];
  trackRules: FixtureTrackRule[];
}

interface SubjectFixture {
  schemaVersion: number;
  subjects: FixtureSubject[];
}

interface QuestionFixture {
  schemaVersion: number;
  questions: Record<string, unknown>[];
}

const TRACK_DB: Record<FixtureTrackRule["track"], AcademicTrack> = {
  SCIENCE: "science",
  ART: "art",
  SOCIAL_SCIENCE: "social_science",
};
const PARTICIPATION_DB = { REQUIRED: "required", ELECTIVE: "elective" } as const;

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
    if (fixture.schemaVersion !== 4 || !fixture.subjects.length) return { ok: false, error: "Unsupported subject fixture." };
    const codes = fixture.subjects.map((subject) => subject.code);
    if (new Set(codes).size !== codes.length) return { ok: false, error: "Subject fixture contains duplicate codes." };
    const now = new Date().toISOString();

    const { error: subjectError } = await admin.from("subjects").upsert(
      fixture.subjects.map((subject) => ({ code: subject.code, name: subject.name, active: subject.active, updated_at: now })),
      { onConflict: "code" },
    );
    if (subjectError) return { ok: false, error: subjectError.message };

    const { data: rows, error: lookupError } = await admin.from("subjects").select("id,code").in("code", codes);
    if (lookupError) return { ok: false, error: lookupError.message };
    const idByCode = new Map(((rows ?? []) as { id: string; code: string }[]).map((row) => [row.code, row.id]));
    if (idByCode.size !== fixture.subjects.length) return { ok: false, error: "Not every fixture subject resolved to a canonical subject row." };

    const ids = [...idByCode.values()];
    if (ids.length) {
      const { error } = await admin.from("subject_track_rules").delete().in("subject_id", ids);
      if (error) return { ok: false, error: error.message };
    }
    const rules = fixture.subjects.flatMap((subject) => subject.trackRules.map((rule) => ({
      subject_id: idByCode.get(subject.code)!,
      track: TRACK_DB[rule.track],
      participation: PARTICIPATION_DB[rule.participation],
      updated_at: now,
    })));
    if (rules.length) {
      const { error } = await admin.from("subject_track_rules").upsert(rules, { onConflict: "subject_id,track" });
      if (error) return { ok: false, error: error.message };
    }

    revalidatePath("/admin/settings");
    revalidatePath("/admin/classes");
    return { ok: true, count: fixture.subjects.length };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "Subject fixture sync failed." };
  }
}

export async function syncQuestionBankFromFixtureAction(): Promise<ActionResult & { count?: number }> {
  try {
    const admin = await requireAdmin();
    const fixture = await loadJson<QuestionFixture>("questions.json");
    if (fixture.schemaVersion !== 4 || !fixture.questions.length) return { ok: false, error: "Unsupported question fixture." };

    const subjectCodes = [...new Set(fixture.questions.map((question) => String(question.subjectCode ?? "")).filter(Boolean))];
    const { data: subjectRows, error: subjectError } = await admin.from("subjects").select("id,code").in("code", subjectCodes).eq("active", true);
    if (subjectError) return { ok: false, error: subjectError.message };
    const subjectIdByCode = new Map(((subjectRows ?? []) as { id: string; code: string }[]).map((row) => [row.code, row.id]));
    const unresolved = subjectCodes.filter((code) => !subjectIdByCode.has(code));
    if (unresolved.length) return { ok: false, error: `Seed these subject codes before syncing questions: ${unresolved.join(", ")}.` };

    const { data: existingRows, error: existingError } = await admin.from("questions").select("id,created_by_profile_id");
    if (existingError) return { ok: false, error: existingError.message };
    const existing = new Map(((existingRows ?? []) as { id: number; created_by_profile_id: string | null }[]).map((row) => [Number(row.id), row.created_by_profile_id]));
    const conflicting = fixture.questions.find((question) => {
      const owner = existing.get(Number(question.id));
      return owner !== undefined && owner !== null;
    });
    if (conflicting) return { ok: false, error: `Question id ${String(conflicting.id)} belongs to an authored question and cannot be replaced by the bank fixture.` };

    const fresh = fixture.questions.filter((question) => !existing.has(Number(question.id)));
    if (!fresh.length) return { ok: true, count: 0 };

    const { data: academicLevels, error: levelError } = await admin.from("academic_levels").select("id,name").eq("active", true);
    if (levelError) return { ok: false, error: levelError.message };
    const levelIdByName = new Map(((academicLevels ?? []) as { id: string; name: string }[]).map((row) => [row.name, row.id]));

    const now = Date.now();
    const questionRows: Record<string, unknown>[] = [];
    const levelLinks: { question_id: number; level_id: string }[] = [];
    const blankRows: { question_id: number; position: number; blank_key: string; placeholder: string; accepted: string[] }[] = [];

    for (const question of fresh) {
      const id = Number(question.id);
      const code = String(question.subjectCode ?? "");
      const subjectId = subjectIdByCode.get(code);
      if (!Number.isSafeInteger(id) || !subjectId) return { ok: false, error: `Question ${String(question.id)} has invalid identity metadata.` };
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
      const levels = Array.isArray(question.levels) ? (question.levels as unknown[]).map(String) : [];
      for (const levelName of levels) {
        const levelId = levelIdByName.get(levelName);
        if (!levelId) return { ok: false, error: `Question ${id} references unavailable level ${levelName}.` };
        levelLinks.push({ question_id: id, level_id: levelId });
      }

      const modes = Array.isArray(question.examModes) ? (question.examModes as unknown[]).map(String) : ["single", "mixed", "waec"];
      const template = question.fillTemplate as { text?: string; blank?: string; placeholder?: string }[] | undefined;
      let position = 0;
      let fillTemplate: string | null = null;
      if (template) {
        fillTemplate = template.map((part) => {
          if (part.blank === undefined) return part.text ?? "";
          const source = Array.isArray(question.acceptedAnswers) ? (question.acceptedAnswers as unknown[])[position] : undefined;
          blankRows.push({
            question_id: id,
            position,
            blank_key: String(part.blank || `b${position}`),
            placeholder: String(part.placeholder ?? ""),
            accepted: Array.isArray(source) ? source.map(String) : source !== undefined ? [String(source)] : [],
          });
          return `{{${position++}}}`;
        }).join("");
      }

      questionRows.push({
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
        created_by_profile_id: null,
        created_at: new Date().toISOString(),
        updated_at: now,
      });
    }

    for (let index = 0; index < questionRows.length; index += 200) {
      const { error } = await admin.from("questions").insert(questionRows.slice(index, index + 200));
      if (error) return { ok: false, error: error.message };
    }
    for (let index = 0; index < levelLinks.length; index += 500) {
      const { error } = await admin.from("question_academic_levels").insert(levelLinks.slice(index, index + 500));
      if (error) return { ok: false, error: error.message };
    }
    for (let index = 0; index < blankRows.length; index += 200) {
      const { error } = await admin.from("question_blanks").insert(blankRows.slice(index, index + 200));
      if (error) return { ok: false, error: error.message };
    }

    revalidatePath("/admin/questions");
    return { ok: true, count: questionRows.length };
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
