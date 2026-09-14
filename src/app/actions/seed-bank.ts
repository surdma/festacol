"use server";

import { readFile } from "node:fs/promises";
import path from "node:path";
import { revalidatePath } from "next/cache";
import type { ActionResult } from "@/app/actions/student";
import { currentStaff } from "@/lib/auth/staff";

type SeedSubject = {
  code?: unknown;
  label?: unknown;
  pathways?: unknown;
};

type SeedQuestion = Record<string, unknown>;

type SeedPayload = {
  schemaVersion?: unknown;
  subjectCatalog?: SeedSubject[];
  questions?: SeedQuestion[];
};

type SeedSubjectRow = {
  code: string;
  name: string;
  category: string;
  streams: string[];
  active: boolean;
  updated_at: number;
};

type TemplatePart = { text?: string; blank?: string; placeholder?: string };
type StoredTemplatePart = { text: string } | { blank: string; placeholder: string; pos: number };

async function requireSeedAdmin() {
  const context = await currentStaff();
  if (!context.scope.isAdmin) throw new Error("Administrator sign-in required.");
  return context.supabase;
}

async function readSeedPayload(): Promise<SeedPayload> {
  const file = await readFile(path.join(process.cwd(), "public", "seed", "questions.json"), "utf8");
  const parsed = JSON.parse(file) as SeedPayload;
  if (!parsed || !Array.isArray(parsed.questions) || parsed.questions.length === 0) {
    throw new Error("Seed file has no questions.");
  }
  return parsed;
}

function seedCategory(code: string, pathways: string[]): string {
  if (code.startsWith("q-")) return "qualifier";
  if (pathways.length === 1 && pathways[0] === "Science") return "science";
  if (pathways.length === 1 && pathways[0] === "Arts") return "art";
  if (pathways.length === 1 && pathways[0] === "Social Science") return "social-science";
  return "core";
}

function subjectRows(payload: SeedPayload, now: number): SeedSubjectRow[] {
  const rows = new Map<string, SeedSubjectRow>();
  for (const item of payload.subjectCatalog ?? []) {
    const code = String(item.code ?? "").trim();
    if (!code) continue;
    const streams = Array.isArray(item.pathways)
      ? [...new Set(item.pathways.map(String).map((value) => value.trim()).filter(Boolean))]
      : [];
    rows.set(code, {
      code,
      name: String(item.label ?? code).trim() || code,
      category: seedCategory(code, streams),
      streams,
      active: true,
      updated_at: now,
    });
  }

  // A question must never fail its Subject foreign key merely because a future
  // seed forgot to add the matching catalog entry. Fill that gap from the
  // question record while still preferring the explicit catalog above.
  for (const question of payload.questions ?? []) {
    const code = String(question.subjectCode ?? "").trim();
    if (!code || rows.has(code)) continue;
    const pathways = Array.isArray(question.pathways)
      ? [...new Set(question.pathways.map(String).map((value) => value.trim()).filter(Boolean))]
      : [];
    rows.set(code, {
      code,
      name: String(question.subject ?? code).trim() || code,
      category: seedCategory(code, pathways),
      streams: pathways,
      active: true,
      updated_at: now,
    });
  }
  return [...rows.values()];
}

async function insertMissingSubjects(
  supabase: Awaited<ReturnType<typeof requireSeedAdmin>>,
  payload: SeedPayload,
): Promise<number> {
  const now = Date.now();
  const rows = subjectRows(payload, now);
  if (!rows.length) throw new Error("Seed file has no subject catalog.");
  const { data: existing, error: readError } = await supabase.from("subjects").select("code");
  if (readError) throw new Error(readError.message);
  const have = new Set(((existing ?? []) as { code: string }[]).map((row) => row.code));
  const fresh = rows.filter((row) => !have.has(row.code));
  if (!fresh.length) return 0;
  const { error } = await supabase.from("subjects").insert(fresh);
  if (error) throw new Error(error.message);
  return fresh.length;
}

function questionRow(question: SeedQuestion, now: number) {
  const type = String(question.type ?? "single");
  const answer = question.answer as unknown;
  const answers = question.answers as unknown;
  const correct = type === "boolean"
    ? [String(answer)]
    : Array.isArray(answers)
      ? answers.map(String)
      : Array.isArray(answer)
        ? answer.map(String)
        : answer !== undefined
          ? [String(answer)]
          : [];
  const levels = Array.isArray(question.levels)
    ? question.levels.map(String)
    : ["SS1", "SS2", "SS3"];
  const modes = Array.isArray(question.examModes)
    ? question.examModes.map(String)
    : ["single", "mixed", "waec"];
  const template = Array.isArray(question.fillTemplate)
    ? (question.fillTemplate as TemplatePart[])
    : [];
  let blankIndex = 0;
  const templateParts: StoredTemplatePart[] = template.map((part) => {
    if (part.blank === undefined) return { text: part.text ?? "" };
    const stored = {
      blank: part.blank,
      placeholder: part.placeholder ?? "",
      pos: blankIndex,
    };
    blankIndex += 1;
    return stored;
  });

  return {
    id: Number(question.id),
    subject_code: String(question.subjectCode ?? ""),
    subject_name: String(question.subject ?? ""),
    label: String(question.label ?? ""),
    qtype: type,
    prompt: String(question.prompt ?? ""),
    options: Array.isArray(question.options) ? question.options.map(String) : [],
    correct_answers: type === "fill" || type === "fill-multi" ? [] : correct,
    fill_template: templateParts.length
      ? templateParts.map((part) => ("pos" in part ? `{{${part.pos}}}` : part.text)).join("")
      : null,
    instruction: String(question.instruction ?? ""),
    levels,
    exam_modes: modes,
    difficulty: String(question.difficulty ?? "medium"),
    domain: String(question.domain ?? ""),
    explanation: String(question.explanation ?? ""),
    created_by: null,
    updated_at: now,
    _template: templateParts.filter((part): part is Extract<StoredTemplatePart, { pos: number }> => "pos" in part),
  };
}

export async function seedSubjectCatalogFromBankAction(): Promise<ActionResult & { count?: number }> {
  try {
    const supabase = await requireSeedAdmin();
    const payload = await readSeedPayload();
    const count = await insertMissingSubjects(supabase, payload);
    revalidatePath("/admin/settings");
    revalidatePath("/admin/questions");
    return { ok: true, count };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "Subject seed failed." };
  }
}

export async function syncProductionQuestionBankAction(): Promise<ActionResult & { count?: number; subjects?: number }> {
  try {
    const supabase = await requireSeedAdmin();
    const payload = await readSeedPayload();

    // Questions reference subjects(code). Establish the relational parent rows
    // first so a fresh database can load the bank in one administrator action.
    const subjects = await insertMissingSubjects(supabase, payload);

    const { data: existing, error: existingError } = await supabase.from("questions").select("id");
    if (existingError) return { ok: false, error: existingError.message };
    const have = new Set(((existing ?? []) as { id: number }[]).map((row) => Number(row.id)));
    const fresh = payload.questions!.filter((question) => !have.has(Number(question.id)));
    const now = Date.now();
    const rows = fresh.map((question) => questionRow(question, now));
    const rowById = new Map(rows.map((row) => [row.id, row]));

    for (let index = 0; index < rows.length; index += 200) {
      const chunk = rows.slice(index, index + 200).map(({ _template, ...row }) => row);
      const { error } = await supabase.from("questions").insert(chunk);
      if (error) return { ok: false, error: error.message };
    }

    const blanks: {
      question_id: number;
      position: number;
      blank_key: string;
      placeholder: string;
      accepted: string[];
    }[] = [];
    for (const question of fresh) {
      const row = rowById.get(Number(question.id));
      if (!row?._template.length) continue;
      const source = Array.isArray(question.acceptedAnswers) ? question.acceptedAnswers : [];
      for (let position = 0; position < row._template.length; position += 1) {
        const part = row._template[position];
        const raw = source[position];
        const accepted = Array.isArray(raw)
          ? raw.map(String)
          : raw !== undefined
            ? [String(raw)]
            : [];
        blanks.push({
          question_id: row.id,
          position,
          blank_key: String(part.blank),
          placeholder: String(part.placeholder ?? ""),
          accepted,
        });
      }
    }
    for (let index = 0; index < blanks.length; index += 200) {
      const { error } = await supabase.from("question_blanks").insert(blanks.slice(index, index + 200));
      if (error) return { ok: false, error: error.message };
    }

    revalidatePath("/admin/questions");
    revalidatePath("/admin/settings");
    return { ok: true, count: rows.length, subjects };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "Question bank sync failed." };
  }
}
