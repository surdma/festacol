import type { ExamMode, ExamSessionDTO, QuestionDTO } from "@/types/exam";

export const TRACKS = ["Science", "Humanities", "Business"] as const;

const TRACK_WEIGHTS: Record<string, Record<string, number>> = {
  Science: { mathematics: 1.5, "basic science": 1.55, digital: 1.05, english: 0.75, "social studies": 0.55, business: 0.45 },
  Humanities: { english: 1.55, "social studies": 1.25, business: 0.7, digital: 0.55, mathematics: 0.55, "basic science": 0.45 },
  Business: { "social studies": 1.45, business: 1.45, english: 1.0, mathematics: 0.85, digital: 0.75, "basic science": 0.55 },
};

export const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v));
export const normalizeText = (v: unknown) => String(v ?? "").trim().replace(/\s+/gu, " ").toLocaleLowerCase("en");
export const normalizeNamePart = (v: unknown) =>
  String(v ?? "").trim().replace(/[^\p{L}\p{M}' -]/gu, "").replace(/\s+/gu, " ").slice(0, 40);

export function candidateCredentials(firstName: string, lastName: string) {
  const first = normalizeNamePart(firstName);
  const last = normalizeNamePart(lastName);
  if (first.length < 2) throw new Error("Enter the student first name.");
  if (last.length < 2) throw new Error("Enter the student last name.");
  return { firstName: first, lastName: last, fullName: `${first} ${last}` };
}

function fallbackHash(value: string): string {
  let a = 0x811c9dc5;
  let b = 0x9e3779b9;
  for (let i = 0; i < value.length; i += 1) {
    const code = value.charCodeAt(i);
    a = Math.imul(a ^ code, 0x01000193) >>> 0;
    b = Math.imul(b ^ code, 0x85ebca6b) >>> 0;
  }
  return `${a.toString(16).padStart(8, "0")}${b.toString(16).padStart(8, "0")}`;
}

export async function hashText(value: string): Promise<string> {
  const text = String(value);
  const subtle = globalThis.crypto?.subtle;
  if (subtle && typeof TextEncoder !== "undefined") {
    const buffer = await subtle.digest("SHA-256", new TextEncoder().encode(text));
    return [...new Uint8Array(buffer)].map((value) => value.toString(16).padStart(2, "0")).join("");
  }
  return fallbackHash(text).repeat(4).slice(0, 64);
}

// Compatibility only for the legacy login/account migration. These hashes are
// not academic, subject, exam-audience or attempt relationship identifiers.
export async function studentHashFor(firstName: string, lastName: string) {
  const identity = candidateCredentials(firstName, lastName);
  return hashText(`festacol-student|${normalizeText(identity.firstName)}|${normalizeText(identity.lastName)}`);
}

export async function candidateHashFor(sessionId: string, firstName: string, lastName: string) {
  const studentHash = await studentHashFor(firstName, lastName);
  return hashText(`festacol-attempt|${String(sessionId).toUpperCase()}|${studentHash}`);
}

function seedFrom(value: string): number {
  let seed = 2166136261;
  for (const character of String(value)) seed = Math.imul(seed ^ character.charCodeAt(0), 16777619) >>> 0;
  return seed || 0x9e3779b9;
}

function rngFor(seedInput: string): () => number {
  let state = seedFrom(seedInput);
  return () => {
    state += 0x6d2b79f5;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

function shuffled<T>(items: T[], seed: string): T[] {
  const out = [...items];
  const random = rngFor(seed);
  for (let index = out.length - 1; index > 0; index -= 1) {
    const swap = Math.floor(random() * (index + 1));
    [out[index], out[swap]] = [out[swap], out[index]];
  }
  return out;
}

function applyOptionOrder(question: QuestionDTO, session: ExamSessionDTO, attemptSeed: string, index: number): QuestionDTO {
  const clone = { ...question };
  if (Array.isArray(question.options) && question.options.length > 1) {
    clone.options = shuffled(question.options, `${attemptSeed}|${session.id}|${question.id}|${index}|options`);
  }
  return clone;
}

export function eligibleQuestions(payload: { questions: QuestionDTO[] }, session: ExamSessionDTO): QuestionDTO[] {
  return payload.questions.filter((question) => {
    if (!question.levels.includes(session.classLevel) || !question.examModes.includes(session.mode)) return false;
    if (session.mode === "qualifier") return !session.subjectIds.length || session.subjectIds.includes(question.subjectId);
    return session.subjectIds.includes(question.subjectId);
  });
}

export function paperForStudent(
  payload: { questions: QuestionDTO[] },
  session: ExamSessionDTO,
  attemptSeed: string,
): QuestionDTO[] {
  const candidates = eligibleQuestions(payload, session);
  const target = Math.min(Number(session.questionCount) || 0, candidates.length);
  if (!target) return [];

  const groupedModes = ["single", "waec", "neco", "jamb", "bece"];
  const subjectOrder = groupedModes.includes(session.mode)
    ? [...new Set(candidates.map((question) => question.subjectId))]
    : session.subjectIds.length
      ? session.subjectIds
      : [...new Set(candidates.map((question) => question.subjectId))];
  // Candidate papers are always randomized from the unique attempt id. Session
  // flags remain in the DTO for backwards compatibility, but they cannot disable
  // question or option randomization for a live candidate paper.
  const salt = `${attemptSeed}|${session.id}|paper`;
  const ordered = shuffled(subjectOrder, `${salt}|subjects`);
  const buckets = new Map(ordered.map((subjectId) => [
    subjectId,
    shuffled(candidates.filter((question) => question.subjectId === subjectId), `${salt}|${subjectId}`),
  ]));
  const selected: QuestionDTO[] = [];
  let cursor = 0;
  while (selected.length < target && [...buckets.values()].some((bucket) => bucket.length)) {
    const subjectId = ordered[cursor % ordered.length];
    const bucket = buckets.get(subjectId);
    if (bucket?.length) selected.push(bucket.shift()!);
    cursor += 1;
  }
  return selected.map((question, index) => applyOptionOrder(question, session, attemptSeed, index));
}

// Resume from the immutable question-id list allocated on first open. This
// prevents later bank additions/reordering from changing an in-progress paper.
export function paperFromQuestionIds(
  payload: { questions: QuestionDTO[] },
  session: ExamSessionDTO,
  attemptSeed: string,
  questionIds: number[],
): QuestionDTO[] {
  const byId = new Map(payload.questions.map((question) => [question.id, question]));
  const ordered = questionIds
    .map((id) => byId.get(Number(id)))
    .filter((question): question is QuestionDTO => Boolean(question));
  return ordered.map((question, index) => applyOptionOrder(question, session, attemptSeed, index));
}

export function effectiveStatus(session: ExamSessionDTO | null): string {
  if (!session) return "missing";
  if (session.status !== "open") return session.status;
  const now = Date.now();
  if (session.startsAt && now < Number(session.startsAt)) return "scheduled";
  if (session.endsAt && now > Number(session.endsAt)) return "closed";
  return "open";
}

export function answersMayBeRevealed(session: ExamSessionDTO | null, status = session?.status): boolean {
  if (!session) return false;
  if (status === "closed") return true;
  return Boolean(session.endsAt && Date.now() > Number(session.endsAt));
}

function placementDomain(subjectName: string): string {
  const value = normalizeText(subjectName);
  if (value.includes("math")) return "mathematics";
  if (value.includes("basic science")) return "basic science";
  if (value.includes("digital") || value.includes("computer") || value.includes("ict") || value.includes("data processing")) return "digital";
  if (value.includes("english")) return "english";
  if (value.includes("social studies") || value.includes("citizenship") || value.includes("heritage")) return "social studies";
  if (value.includes("business") || value.includes("commerce") || value.includes("account")) return "business";
  return value;
}

export function scoreAttempt(
  paper: QuestionDTO[],
  state: { responses?: Record<string, unknown>; questionTimings?: Record<string, number>; elapsedActiveSeconds?: number; startedAt?: number; submittedAt?: number | null; integrityEvents?: { type: string }[] },
  session: ExamSessionDTO,
) {
  const details = paper.map((question) => {
    const response = state.responses?.[String(question.id)] ?? null;
    let correct: boolean | null = null;
    const key = (question as { answer?: unknown }).answer;
    const blanks = (question as { blanks?: { key: string; accepted: string[] }[] }).blanks;
    if ((question.type === "fill" || question.type === "fill-multi") && blanks) {
      const record = (response && typeof response === "object" ? response : {}) as Record<string, unknown>;
      const keys = blanks.map((blank) => blank.key);
      const answeredBlanks = keys.filter((blankKey) => String(record[blankKey] ?? "").trim());
      if (!keys.length) correct = null;
      else if (!answeredBlanks.length) correct = false;
      else {
        correct = keys.every((blankKey) => {
          const value = String(record[blankKey] ?? "").trim();
          if (!value) return false;
          const accepted = blanks.find((blank) => blank.key === blankKey)?.accepted ?? [];
          return accepted.map(normalizeText).includes(normalizeText(value));
        });
      }
    } else if (key !== undefined) {
      if (Array.isArray(key)) {
        const actual = Array.isArray(response) ? response.map(normalizeText).sort() : [];
        const expected = (key as unknown[]).map(normalizeText).sort();
        correct = actual.length === expected.length && actual.every((value, index) => value === expected[index]);
      } else if (typeof key === "boolean") {
        correct = response === key;
      } else {
        correct = normalizeText(response) === normalizeText(key);
      }
    }
    return {
      questionId: question.id,
      subjectId: question.subjectId,
      subject: question.subject,
      correct,
      response,
      seconds: Math.max(0, Number(state.questionTimings?.[String(question.id)]) || 0),
    };
  });

  const scored = details.filter((detail) => detail.correct !== null);
  const correctCount = scored.filter((detail) => detail.correct).length;
  const accuracy = scored.length ? Math.round((correctCount / scored.length) * 100) : 0;
  const answered = paper.filter((question) => {
    const value = state.responses?.[String(question.id)];
    return Array.isArray(value)
      ? value.length > 0
      : value && typeof value === "object"
        ? Object.values(value as object).some((item) => String(item ?? "").trim())
        : value === true || value === false || String(value ?? "").trim().length > 0;
  }).length;
  const completion = paper.length ? Math.round((answered / paper.length) * 100) : 0;
  const elapsed = Math.max(1, Math.round(Number(state.elapsedActiveSeconds) > 0
    ? Number(state.elapsedActiveSeconds)
    : ((state.submittedAt || Date.now()) - (state.startedAt || Date.now())) / 1000));
  const duration = Math.max(30, Number(session.durationSeconds) || 3600);
  const expected = Math.max(10, duration / Math.max(1, paper.length));
  const average = paper.length ? Math.round(elapsed / paper.length) : 0;
  const paceIndex = Math.round(clamp(100 - (Math.max(0, average - expected * 0.55) / expected) * 65, 25, 100));
  const events = Array.isArray(state.integrityEvents) ? state.integrityEvents : [];
  const integrityScore = Math.max(0, 100 - events.filter((event) => !["focus-return", "fullscreen-enter", "camera-restored", "background-resume-reconciled"].includes(event.type)).length * 8);

  const bySubject = new Map<string, { subjectId: string; subject: string; total: number; correct: number; seconds: number }>();
  for (const detail of details) {
    const bucket = bySubject.get(detail.subjectId) ?? { subjectId: detail.subjectId, subject: detail.subject, total: 0, correct: 0, seconds: 0 };
    bucket.total += 1;
    if (detail.correct) bucket.correct += 1;
    bucket.seconds += detail.seconds;
    bySubject.set(detail.subjectId, bucket);
  }
  const subjectStats = [...bySubject.values()].map((bucket) => ({ ...bucket, percent: bucket.total ? Math.round((bucket.correct / bucket.total) * 100) : 0 }));
  const reasoningIndex = Math.round(accuracy * 0.78 + completion * 0.14 + paceIndex * 0.08);
  const result: Record<string, unknown> = {
    correctCount,
    scoredCount: scored.length,
    accuracy,
    completion,
    elapsedSeconds: elapsed,
    avgSeconds: average,
    paceIndex,
    reasoningIndex,
    integrityScore,
    integrityEventCount: events.length,
    subjectStats,
    details,
  };
  if ((session.mode as ExamMode) === "qualifier") {
    result.placement = placementFor({ accuracy, paceIndex, completion, integrityScore, subjectStats }, session);
  }
  return result;
}

function placementFor(
  result: { accuracy: number; paceIndex: number; completion: number; integrityScore: number; subjectStats: { subjectId: string; subject: string; percent: number }[] },
  session: ExamSessionDTO,
) {
  const enabled = (session.placementTracks || [...TRACKS]).filter((track) => (TRACKS as readonly string[]).includes(track));
  const tracks = enabled.length ? enabled : [...TRACKS];
  const stats = new Map(result.subjectStats.map((stat) => [placementDomain(stat.subject), stat.percent]));
  const scored = tracks.map((track) => {
    const weights = TRACK_WEIGHTS[track];
    let totalWeight = 0;
    let weighted = 0;
    for (const [domain, weight] of Object.entries(weights)) {
      if (!stats.has(domain)) continue;
      totalWeight += weight;
      weighted += (stats.get(domain) ?? 0) * weight;
    }
    const academic = totalWeight ? weighted / totalWeight : result.accuracy;
    const score = academic * 0.82 + result.paceIndex * 0.08 + result.completion * 0.08 + result.integrityScore * 0.02;
    return { track, score: Math.round(score), academic: Math.round(academic) };
  }).sort((a, b) => b.score - a.score);
  const best = scored[0];
  const second = scored[1];
  const gap = second ? best.score - second.score : 15;
  const confidence = clamp(55 + gap * 3 + Math.round((best.score - 50) * 0.25), 55, 96);
  return { assignedTrack: best.track, confidence, trackScores: scored };
}
