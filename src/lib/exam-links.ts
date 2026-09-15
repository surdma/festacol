import type { ExamSessionDTO } from "@/types/exam";

// Compact navigation payload only. It is not an authorization token: every
// destination rechecks the current database relationship using the exam ID.
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

export function encodeSession(session: Pick<ExamSessionDTO, "id" | "title">, version: "v4" = "v4"): string {
  return b64urlEncode(JSON.stringify({ v: version, id: session.id, title: session.title }));
}

export function decodeSession(payload: string): Partial<ExamSessionDTO> & { v?: string } {
  return JSON.parse(b64urlDecode(payload));
}

export function getExamLink(session: Pick<ExamSessionDTO, "id" | "title">, base = "/dashboard/exam"): string {
  return `${base}?session=${encodeURIComponent(encodeSession(session))}`;
}

export function normalizeExamId(raw: string): string {
  return String(raw ?? "").trim().toUpperCase().replace(/[^A-Z0-9-]/g, "");
}
