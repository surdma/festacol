import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { QuestionDTO } from "@/types/exam";

interface BankPayload {
  questions: QuestionDTO[];
  catalog: string[];
}

// Server-side question bank loader: questions + overrides + singleton bank.
// Seed edits live as patches; teacher rows come through untouched.
export async function loadQuestionPayload(): Promise<BankPayload> {
  const supabase = await createSupabaseServerClient();
  const [{ data: questions }, { data: overrides }, { data: bank }] = await Promise.all([
    supabase.from("questions").select("*"),
    supabase.from("question_overrides").select("*"),
    supabase.from("question_bank").select("*").eq("id", 1).maybeSingle(),
  ]);
  const patchById = new Map<number, Record<string, unknown>>(
    ((overrides ?? []) as { question_id: number; patch: Record<string, unknown> }[]).map((o) => [o.question_id, o.patch]),
  );
  const merged = ((questions ?? []) as { id: number; origin: string; data: Record<string, unknown>; subject_code: string }[]).map((row) => {
    const patch = patchById.get(row.id);
    const data = { ...(row.data ?? {}), ...(patch ?? {}) } as unknown as QuestionDTO;
    if (data.subjectCode === undefined) data.subjectCode = row.subject_code;
    return { ...data, id: row.id };
  });
  const catalog = Array.isArray((bank as { subject_catalog?: unknown } | null)?.subject_catalog)
    ? ((bank as { subject_catalog: string[] }).subject_catalog)
    : [...new Set(merged.map((q) => q.subjectCode).filter(Boolean))];
  return { questions: merged, catalog };
}

export function sanitizePaper(questions: QuestionDTO[]): Omit<QuestionDTO, "answer">[] {
  return questions.map((q) => {
    const { answer: _answer, ...rest } = q as QuestionDTO & { answer?: unknown };
    void _answer;
    return rest;
  });
}
