import type { ExamSessionDTO } from "@/types/exam";

// v2/v3 base64url session-link codec. Keeps prototype QR + Exam-ID compat.
// Canonical Next.js link: /dashboard/exam?session=<payload>

function b64urlEncode(text: string): string {
  const b64 = typeof Buffer !== "undefined" ? Buffer.from(text, "utf8").toString("base64") : btoa(unescape(encodeURIComponent(text)));
  return b64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function b64urlDecode(payload: string): string {
  const b64 = payload.replace(/-/g, "+").replace(/_/g, "/");
  const padded = b64 + "=".repeat((4 - (b64.length % 4)) % 4);
  if (typeof Buffer !== "undefined") return Buffer.from(padded, "base64").toString("utf8");
  return decodeURIComponent(escape(atob(padded)));
}

export function encodeSession(session: ExamSessionDTO, version: "v2" | "v3" = "v3"): string {
  const body = {
    v: version,
    id: session.id,
    title: session.title,
    classLevel: session.classLevel,
    mode: session.mode,
    subjects: session.subjects,
    durationSeconds: session.durationSeconds,
    questionCount: session.questionCount,
    status: session.status,
    startsAt: session.startsAt,
    endsAt: session.endsAt,
  };
  return b64urlEncode(JSON.stringify(body));
}

export function decodeSession(payload: string): Partial<ExamSessionDTO> & { v?: string } {
  return JSON.parse(b64urlDecode(payload));
}

export function getExamLink(session: ExamSessionDTO, base = "/dashboard/exam"): string {
  return `${base}?session=${encodeURIComponent(encodeSession(session))}`;
}

export function normalizeExamId(raw: string): string {
  return String(raw ?? "").trim().toUpperCase().replace(/[^A-Z0-9-]/g, "");
}
