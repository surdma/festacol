import { normalizeExamToken } from "@/lib/exam-links";

const STUDENT_NAV_ORIGIN = "https://festacol.local";

/**
 * Keep student post-auth navigation on known application surfaces. Exam
 * destinations are canonicalized around the opaque token so a login redirect
 * cannot become an open redirect or carry unrelated query state.
 */
export function safeStudentDestination(
  value: string | null | undefined,
): string | undefined {
  if (!value || !value.startsWith("/") || value.startsWith("//")) return undefined;

  let target: URL;
  try {
    target = new URL(value, STUDENT_NAV_ORIGIN);
  } catch {
    return undefined;
  }

  if (target.origin !== STUDENT_NAV_ORIGIN) return undefined;

  if (
    target.pathname === "/dashboard" ||
    target.pathname.startsWith("/dashboard/")
  ) {
    return `${target.pathname}${target.search}${target.hash}`;
  }

  if (target.pathname === "/exam") {
    const token = normalizeExamToken(target.searchParams.get("token") ?? "");
    if (!token) return undefined;
    return `/exam?token=${encodeURIComponent(token)}`;
  }

  return undefined;
}

export function isExamDestination(value: string | null | undefined): boolean {
  return safeStudentDestination(value)?.startsWith("/exam?token=") ?? false;
}
