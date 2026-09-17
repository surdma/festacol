import { normalizeExamToken } from "@/lib/exam-links";

const APP_ORIGIN = "https://festacol.local";

function parseInternalDestination(value: string | null | undefined): URL | null {
  if (!value || !value.startsWith("/") || value.startsWith("//")) return null;

  try {
    const target = new URL(value, APP_ORIGIN);
    return target.origin === APP_ORIGIN ? target : null;
  } catch {
    return null;
  }
}

/**
 * Student post-auth navigation stays on dashboard routes or the canonical
 * standalone exam route. Exam destinations are rebuilt from the opaque token
 * so unrelated query state cannot be smuggled through `next`.
 */
export function safeStudentDestination(value: string | null | undefined): string | undefined {
  const target = parseInternalDestination(value);
  if (!target) return undefined;

  if (target.pathname === "/dashboard" || target.pathname.startsWith("/dashboard/")) {
    return `${target.pathname}${target.search}${target.hash}`;
  }

  if (target.pathname === "/exam") {
    const token = normalizeExamToken(target.searchParams.get("token") ?? "");
    if (!token) return undefined;
    return `/exam?token=${encodeURIComponent(token)}`;
  }

  return undefined;
}

/** Staff post-auth navigation is restricted to the real workspace tree. */
export function safeStaffDestination(value: string | null | undefined): string | undefined {
  const target = parseInternalDestination(value);
  if (!target) return undefined;

  const inWorkspace = target.pathname === "/workspace" || target.pathname.startsWith("/workspace/");
  const inLogin = target.pathname === "/workspace/login" || target.pathname.startsWith("/workspace/login/");
  if (!inWorkspace || inLogin) return undefined;

  return `${target.pathname}${target.search}${target.hash}`;
}

export function isExamDestination(value: string | null | undefined): boolean {
  return safeStudentDestination(value)?.startsWith("/exam?token=") ?? false;
}
