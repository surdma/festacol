import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { QuestionDTO } from "@/types/exam";

interface BankPayload {
  questions: QuestionDTO[];
  catalog: string[];
}

interface QuestionRow {
  id: number;
  subject_code: string;
  subject_name: string;
  label: string;
  qtype: string;
  prompt: string;
  options: string[];
  correct_answers: string[];
  fill_template: string | null;
  instruction: string;
  levels: string[];
  exam_modes: string[];
  difficulty: string;
  domain: string;
  explanation: string;
}

interface BlankRow {
  question_id: number;
  position: number;
  blank_key: string;
  placeholder: string;
  accepted: string[];
}

// Server-side question loader: typed columns + blanks. No jsonb, no origin,
// no override patches — seed rows are edited in place, teacher rows carry
// created_by. Rebuilds the stable QuestionDTO shape the engine consumes.
export async function loadQuestionPayload(): Promise<BankPayload> {
  const supabase = await createSupabaseServerClient();
  const [{ data: questions }, { data: blanks }] = await Promise.all([
    supabase.from("questions").select("*"),
    supabase.from("question_blanks").select("*").order("position"),
  ]);
  const blanksByQ = new Map<number, BlankRow[]>();
  for (const b of ((blanks ?? []) as BlankRow[])) {
    blanksByQ.set(b.question_id, [...(blanksByQ.get(b.question_id) ?? []), b]);
  }
  const merged = ((questions ?? []) as QuestionRow[]).map((row) => toDTO(row, blanksByQ.get(row.id) ?? []));
  return {
    questions: merged,
    catalog: [...new Set(merged.map((q) => q.subjectCode).filter(Boolean))],
  };
}

function toDTO(row: QuestionRow, blanks: BlankRow[]): QuestionDTO {
  const type = row.qtype as QuestionDTO["type"];
  const dto: QuestionDTO = {
    id: row.id,
    subjectCode: row.subject_code,
    subject: row.subject_name,
    type,
    prompt: row.prompt,
    options: row.options ?? [],
    levels: (row.levels ?? []) as QuestionDTO["levels"],
    examModes: (row.exam_modes ?? []) as QuestionDTO["examModes"],
  };
  if (row.fill_template && (type === "fill" || type === "fill-multi")) {
    dto.fillTemplate = parseTemplate(row.fill_template, blanks);
    const answer: Record<string, string> = {};
    const scoringBlanks: { key: string; accepted: string[] }[] = [];
    for (const b of blanks) {
      const key = b.blank_key || `b${b.position}`;
      answer[key] = b.accepted[0] ?? "";
      scoringBlanks.push({ key, accepted: b.accepted });
    }
    dto.answer = answer;
    (dto as QuestionDTO & { blanks?: { key: string; accepted: string[] }[] }).blanks = scoringBlanks;
  } else if (type === "boolean") {
    dto.answer = (row.correct_answers[0] ?? "") === "true";
  } else if (type === "multi") {
    dto.answer = row.correct_answers ?? [];
  } else {
    dto.answer = row.correct_answers[0] ?? "";
  }
  return dto;
}

// Template markers {{n}} → ordered text/blank parts.
export function parseTemplate(template: string, blanks: BlankRow[]): NonNullable<QuestionDTO["fillTemplate"]> {
  const parts: NonNullable<QuestionDTO["fillTemplate"]> = [];
  const re = /\{\{(\d+)\}\}/g;
  let last = 0;
  let m: RegExpExecArray | null;
  const byPos = new Map(blanks.map((b) => [b.position, b]));
  let pos = 0;
  while ((m = re.exec(template)) !== null) {
    if (m.index > last) parts.push({ text: template.slice(last, m.index) });
    const b = byPos.get(Number(m[1]));
    const key = b?.blank_key || `b${Number(m[1])}`;
    parts.push({ blank: true, placeholder: b?.placeholder || key, key });
    pos = Number(m[1]) + 1;
    last = m.index + m[0].length;
  }
  if (last < template.length) parts.push({ text: template.slice(last) });
  void pos;
  return parts;
}

// Serialize UI fill parts back to a {{n}} template + blank rows.
export function buildTemplate(parts: { text?: string; blank?: boolean; key?: string; placeholder?: string }[]): {
  template: string; blanks: { position: number; blank_key: string; placeholder: string }[];
} {
  let template = "";
  const blanks: { position: number; blank_key: string; placeholder: string }[] = [];
  let pos = 0;
  for (const p of parts) {
    if (p.blank) {
      template += `{{${pos}}}`;
      blanks.push({ position: pos, blank_key: p.key || `b${pos}`, placeholder: p.placeholder || "Answer" });
      pos += 1;
    } else {
      template += p.text ?? "";
    }
  }
  return { template, blanks };
}

export function sanitizePaper(questions: QuestionDTO[]): Omit<QuestionDTO, "answer">[] {
  return questions.map((q) => {
    const { answer: _answer, ...rest } = q as QuestionDTO & { answer?: unknown };
    void _answer;
    return rest;
  });
}
