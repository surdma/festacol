const TOKEN_PATTERN = /^[A-Za-z0-9_-]{32,96}$/u;

export function getExamLink(token: string, base = "/dashboard/exam"): string {
  return `${base}?token=${encodeURIComponent(token)}`;
}

export function normalizeExamId(raw: string): string {
  return String(raw ?? "").trim().toUpperCase().replace(/[^A-Z0-9-]/g, "");
}

export function normalizeExamToken(raw: string): string {
  const token = String(raw ?? "").trim();
  return TOKEN_PATTERN.test(token) ? token : "";
}
