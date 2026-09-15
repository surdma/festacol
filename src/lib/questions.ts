import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import type { QuestionDTO } from "@/types/exam";

interface BankPayload {
  questions: QuestionDTO[];
  subjectIds: string[];
}

interface QuestionRow {
  id: number;
  subject_id: string;
  qtype: string;
  prompt: string;
  options: string[];
  correct_answers: string[];
  fill_template: string | null;
  instruction: string;
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

// Server-only bank loader. Correct answers never rely on an authenticated
// student's table privileges; the service role reads them only inside trusted
// Server Actions and sanitizePaper removes them before browser delivery.
export async function loadQuestionPayload(): Promise<BankPayload> {
  const admin = createSupabaseAdminClient();
  const [
    { data: questions, error: questionError },
    { data: blanks, error: blankError },
    { data: subjects, error: subjectError },
    { data: levelLinks, error: levelLinkError },
    { data: levels, error: levelError },
  ] = await Promise.all([
    admin.from("questions").select("id,subject_id,qtype,prompt,options,correct_answers,fill_template,instruction,exam_modes,difficulty,domain,explanation").eq("status", "active"),
    admin.from("question_blanks").select("question_id,position,blank_key,placeholder,accepted").order("position"),
    admin.from("subjects").select("id,name").eq("active", true),
    admin.from("question_academic_levels").select("question_id,level_id"),
    admin.from("academic_levels").select("id,name").eq("active", true),
  ]);
  if (questionError) throw new Error(`Question bank read failed: ${questionError.message}`);
  if (blankError) throw new Error(`Question blank read failed: ${blankError.message}`);
  if (subjectError) throw new Error(`Subject catalog read failed: ${subjectError.message}`);
  if (levelLinkError) throw new Error(`Question level read failed: ${levelLinkError.message}`);
  if (levelError) throw new Error(`Academic level read failed: ${levelError.message}`);

  const names = new Map(((subjects ?? []) as { id: string; name: string }[]).map((subject) => [subject.id, subject.name]));
  const levelNames = new Map(((levels ?? []) as { id: string; name: string }[]).map((level) => [level.id, level.name]));
  const levelsByQuestion = new Map<number, string[]>();
  for (const link of ((levelLinks ?? []) as { question_id: number; level_id: string }[])) {
    const name = levelNames.get(link.level_id);
    if (name) levelsByQuestion.set(link.question_id, [...(levelsByQuestion.get(link.question_id) ?? []), name]);
  }
  const blanksByQuestion = new Map<number, BlankRow[]>();
  for (const blank of ((blanks ?? []) as BlankRow[])) {
    blanksByQuestion.set(blank.question_id, [...(blanksByQuestion.get(blank.question_id) ?? []), blank]);
  }
  const merged = ((questions ?? []) as QuestionRow[]).map((row) =>
    toDTO(row, names.get(row.subject_id) ?? "Subject", levelsByQuestion.get(row.id) ?? [], blanksByQuestion.get(row.id) ?? []),
  );
  return {
    questions: merged,
    subjectIds: [...new Set(merged.map((question) => question.subjectId))],
  };
}

function toDTO(row: QuestionRow, subjectName: string, levels: string[], blanks: BlankRow[]): QuestionDTO {
  const type = row.qtype as QuestionDTO["type"];
  const dto: QuestionDTO = {
    id: row.id,
    subjectId: row.subject_id,
    subject: subjectName,
    type,
    prompt: row.prompt,
    options: row.options ?? [],
    levels: levels as QuestionDTO["levels"],
    examModes: (row.exam_modes ?? []) as QuestionDTO["examModes"],
  };
  if (row.fill_template && (type === "fill" || type === "fill-multi")) {
    dto.fillTemplate = parseTemplate(row.fill_template, blanks);
    const answer: Record<string, string> = {};
    const scoringBlanks: { key: string; accepted: string[] }[] = [];
    for (const blank of blanks) {
      const key = blank.blank_key || `b${blank.position}`;
      answer[key] = blank.accepted[0] ?? "";
      scoringBlanks.push({ key, accepted: blank.accepted });
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

export function parseTemplate(template: string, blanks: BlankRow[]): NonNullable<QuestionDTO["fillTemplate"]> {
  const parts: NonNullable<QuestionDTO["fillTemplate"]> = [];
  const re = /\{\{(\d+)\}\}/g;
  let last = 0;
  let match: RegExpExecArray | null;
  const byPosition = new Map(blanks.map((blank) => [blank.position, blank]));
  while ((match = re.exec(template)) !== null) {
    if (match.index > last) parts.push({ text: template.slice(last, match.index) });
    const blank = byPosition.get(Number(match[1]));
    const key = blank?.blank_key || `b${Number(match[1])}`;
    parts.push({ blank: true, placeholder: blank?.placeholder || key, key });
    last = match.index + match[0].length;
  }
  if (last < template.length) parts.push({ text: template.slice(last) });
  return parts;
}

export function buildTemplate(parts: { text?: string; blank?: boolean; key?: string; placeholder?: string }[]): {
  template: string;
  blanks: { position: number; blank_key: string; placeholder: string }[];
} {
  let template = "";
  const blanks: { position: number; blank_key: string; placeholder: string }[] = [];
  let position = 0;
  for (const part of parts) {
    if (part.blank) {
      template += `{{${position}}}`;
      blanks.push({ position, blank_key: part.key || `b${position}`, placeholder: part.placeholder || "Answer" });
      position += 1;
    } else {
      template += part.text ?? "";
    }
  }
  return { template, blanks };
}

export function sanitizePaper(questions: QuestionDTO[]): Omit<QuestionDTO, "answer">[] {
  return questions.map((question) => {
    const { answer: _answer, ...rest } = question as QuestionDTO & { answer?: unknown };
    void _answer;
    return rest;
  });
}
