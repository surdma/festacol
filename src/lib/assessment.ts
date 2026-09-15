import type { ExamMode, ExamSessionDTO, QuestionDTO } from "@/types/exam";

// Pure port of prototype/js/assessment-engine.js — no DOM, no Supabase.
// Byte-identical RNG + paper algorithm so old papers still verify.

export const TRACKS = ["Science", "Arts", "Social Science"] as const;

const TRACK_WEIGHTS: Record<string, Record<string, number>> = {
  Science: { "q-math": 1.5, "q-bst": 1.55, "q-digital": 1.05, "q-eng": 0.75, "q-social": 0.55, "q-business": 0.45 },
  Arts: { "q-eng": 1.55, "q-social": 1.25, "q-business": 0.7, "q-digital": 0.55, "q-math": 0.55, "q-bst": 0.45 },
  "Social Science": { "q-social": 1.45, "q-business": 1.45, "q-eng": 1.0, "q-math": 0.85, "q-digital": 0.75, "q-bst": 0.55 },
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
    const buf = await subtle.digest("SHA-256", new TextEncoder().encode(text));
    return [...new Uint8Array(buf)].map((x) => x.toString(16).padStart(2, "0")).join("");
  }
  return fallbackHash(text).repeat(4).slice(0, 64);
}

export async function studentHashFor(firstName: string, lastName: string) {
  const id = candidateCredentials(firstName, lastName);
  return hashText(`festacol-student|${normalizeText(id.firstName)}|${normalizeText(id.lastName)}`);
}

export async function candidateHashFor(sessionId: string, firstName: string, lastName: string) {
  const sHash = await studentHashFor(firstName, lastName);
  return hashText(`festacol-attempt|${String(sessionId).toUpperCase()}|${sHash}`);
}

function seedFrom(value: string): number {
  let seed = 2166136261;
  for (const ch of String(value)) seed = Math.imul(seed ^ ch.charCodeAt(0), 16777619) >>> 0;
  return seed || 0x9e3779b9;
}

function rngFor(seedInput: string): () => number {
  let state = seedFrom(seedInput);
  return () => {
    state += 0x6d2b79f5;
    let v = state;
    v = Math.imul(v ^ (v >>> 15), v | 1);
    v ^= v + Math.imul(v ^ (v >>> 7), v | 61);
    return ((v ^ (v >>> 14)) >>> 0) / 4294967296;
  };
}

function shuffled<T>(items: T[], seed: string): T[] {
  const out = [...items];
  const rand = rngFor(seed);
  for (let i = out.length - 1; i > 0; i -= 1) {
    const s = Math.floor(rand() * (i + 1));
    [out[i], out[s]] = [out[s], out[i]];
  }
  return out;
}

export function eligibleQuestions(payload: { questions: QuestionDTO[] }, session: ExamSessionDTO): QuestionDTO[] {
  return payload.questions.filter((q) => {
    if (!q.levels.includes(session.classLevel) || !q.examModes.includes(session.mode)) return false;
    if (session.mode === "qualifier") return !session.subjects?.length || session.subjects.includes(q.subjectCode);
    return session.subjects.includes(q.subjectCode);
  });
}

export function paperForStudent(
  payload: { questions: QuestionDTO[] },
  session: ExamSessionDTO,
  sHash: string,
): QuestionDTO[] {
  const candidates = eligibleQuestions(payload, session);
  const target = Math.min(Number(session.questionCount) || 0, candidates.length);
  if (!target) return [];
  // Multi-paper exams group questions by subject (WAEC/NECO/JAMB/BECE style);
  // qualifier/mixed follow the session's subject list order.
  const groupedModes = ["single", "waec", "neco", "jamb", "bece"];
  const subjectOrder = groupedModes.includes(session.mode)
      ? [...new Set(candidates.map((q) => q.subjectCode))]
      : session.subjects?.length
        ? session.subjects
        : [...new Set(candidates.map((q) => q.subjectCode))];
  const randomizeQ = session.randomization?.questionOrder !== false;
  const salt = session.randomization?.minimizePaperCollisions !== false ? `${sHash}|${session.id}` : String(session.id);
  const ordered = randomizeQ ? shuffled(subjectOrder, `${salt}|subjects`) : [...subjectOrder];
  const buckets = new Map(ordered.map((code) => [code, randomizeQ
    ? shuffled(candidates.filter((q) => q.subjectCode === code), `${salt}|${code}`)
    : candidates.filter((q) => q.subjectCode === code)]));
  const selected: QuestionDTO[] = [];
  let cursor = 0;
  while (selected.length < target && [...buckets.values()].some((b) => b.length)) {
    const code = ordered[cursor % ordered.length];
    const bucket = buckets.get(code);
    if (bucket?.length) selected.push(bucket.shift()!);
    cursor += 1;
  }
  return selected.map((q, i) => {
    const clone = { ...q };
    if (Array.isArray(q.options) && session.randomization?.optionOrder !== false) {
      clone.options = shuffled(q.options, `${sHash}|${session.id}|${q.id}|${i}`);
    }
    return clone;
  });
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

export function scoreAttempt(
  paper: QuestionDTO[],
  state: { responses?: Record<string, unknown>; questionTimings?: Record<string, number>; elapsedActiveSeconds?: number; startedAt?: number; submittedAt?: number | null; integrityEvents?: { type: string }[] },
  session: ExamSessionDTO,
) {
  const details = paper.map((q) => {
    const response = state.responses?.[String(q.id)] ?? null;
    // Column-driven scoring: loader sets `answer` from correct_answers /
    // blanks; `blanks` carries the full accepted sets for fill types.
    let correct: boolean | null = null;
    const key = (q as { answer?: unknown }).answer;
    const blanks = (q as { blanks?: { key: string; accepted: string[] }[] }).blanks;
    if ((q.type === "fill" || q.type === "fill-multi") && blanks) {
      const r = (response && typeof response === "object" ? response : {}) as Record<string, unknown>;
      const keys = blanks.map((b) => b.key);
      const answeredBlanks = keys.filter((k) => String(r[k] ?? "").trim());
      if (!keys.length) correct = null;
      else if (!answeredBlanks.length) correct = false;
      else {
        correct = keys.every((k) => {
          const val = String(r[k] ?? "").trim();
          if (!val) return false;
          const acc = blanks.find((b) => b.key === k)?.accepted ?? [];
          return acc.map(normalizeText).includes(normalizeText(val));
        });
      }
    } else if (key !== undefined) {
      if (Array.isArray(key)) {
        const rx = Array.isArray(response) ? response.map(normalizeText).sort() : [];
        const ex = (key as unknown[]).map(normalizeText).sort();
        correct = rx.length === ex.length && rx.every((v, i) => v === ex[i]);
      } else if (typeof key === "boolean") {
        correct = response === key;
      } else {
        correct = normalizeText(response) === normalizeText(key);
      }
    }
    return { questionId: q.id, subjectCode: q.subjectCode, subject: q.subject, correct, response, seconds: Math.max(0, Number(state.questionTimings?.[String(q.id)]) || 0) };
  });
  const scored = details.filter((d) => d.correct !== null);
  const correctCount = scored.filter((d) => d.correct).length;
  const accuracy = scored.length ? Math.round((correctCount / scored.length) * 100) : 0;
  const answered = paper.filter((q) => {
    const v = state.responses?.[String(q.id)];
    return Array.isArray(v) ? v.length > 0 : v && typeof v === "object" ? Object.values(v as object).some((x) => String(x ?? "").trim()) : v === true || v === false || String(v ?? "").trim().length > 0;
  }).length;
  const completion = paper.length ? Math.round((answered / paper.length) * 100) : 0;
  const elapsed = Math.max(1, Math.round(Number(state.elapsedActiveSeconds) > 0 ? Number(state.elapsedActiveSeconds) : ((state.submittedAt || Date.now()) - (state.startedAt || Date.now())) / 1000));
  const duration = Math.max(30, Number(session.durationSeconds) || 3600);
  const expected = Math.max(10, duration / Math.max(1, paper.length));
  const avg = paper.length ? Math.round(elapsed / paper.length) : 0;
  const paceIndex = Math.round(clamp(100 - (Math.max(0, avg - expected * 0.55) / expected) * 65, 25, 100));
  const events = Array.isArray(state.integrityEvents) ? state.integrityEvents : [];
  const integrityScore = Math.max(0, 100 - events.filter((e) => !["focus-return", "fullscreen-enter", "camera-restored", "background-resume-reconciled"].includes(e.type)).length * 8);
  const bySubject = new Map<string, { subjectCode: string; subject: string; total: number; correct: number; seconds: number }>();
  for (const d of details) {
    const b = bySubject.get(d.subjectCode) ?? { subjectCode: d.subjectCode, subject: (paper.find((q) => q.subjectCode === d.subjectCode)?.subject ?? d.subjectCode), total: 0, correct: 0, seconds: 0 };
    b.total += 1;
    if (d.correct) b.correct += 1;
    b.seconds += d.seconds;
    bySubject.set(d.subjectCode, b);
  }
  const subjectStats = [...bySubject.values()].map((b) => ({ ...b, percent: b.total ? Math.round((b.correct / b.total) * 100) : 0 }));
  const reasoningIndex = Math.round(accuracy * 0.78 + completion * 0.14 + paceIndex * 0.08);
  const result: Record<string, unknown> = { correctCount, scoredCount: scored.length, accuracy, completion, elapsedSeconds: elapsed, avgSeconds: avg, paceIndex, reasoningIndex, integrityScore, integrityEventCount: events.length, subjectStats, details };
  if ((session.mode as ExamMode) === "qualifier") result.placement = placementFor({ accuracy, paceIndex, completion, integrityScore, subjectStats } as never, session);
  return result;
}

function placementFor(result: { accuracy: number; paceIndex: number; completion: number; integrityScore: number; subjectStats: { subjectCode: string; percent: number }[] }, session: ExamSessionDTO) {
  const enabled = (session.placementTracks || [...TRACKS]).filter((t) => (TRACKS as readonly string[]).includes(t));
  const tracks = enabled.length ? enabled : [...TRACKS];
  const stats = new Map(result.subjectStats.map((s) => [s.subjectCode, s.percent]));
  const scored = tracks.map((track) => {
    const weights = TRACK_WEIGHTS[track];
    let tw = 0, w = 0;
    for (const [code, weight] of Object.entries(weights)) {
      if (!stats.has(code)) continue;
      tw += weight;
      w += (stats.get(code) ?? 0) * weight;
    }
    const academic = tw ? w / tw : result.accuracy;
    const score = academic * 0.82 + result.paceIndex * 0.08 + result.completion * 0.08 + result.integrityScore * 0.02;
    return { track, score: Math.round(score), academic: Math.round(academic) };
  }).sort((a, b) => b.score - a.score);
  const best = scored[0], second = scored[1];
  const gap = second ? best.score - second.score : 15;
  const confidence = clamp(55 + gap * 3 + Math.round((best.score - 50) * 0.25), 55, 96);
  return { assignedTrack: best.track, confidence, trackScores: scored };
}
