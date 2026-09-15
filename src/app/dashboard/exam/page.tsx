// Hidden exam workspace — NOT in studentNav sidebar.
// Reachable only through an opaque persisted exam-session link. The token is
// navigation identity only; relational eligibility is rechecked server-side.
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { currentStudent } from "@/lib/auth/current-student";
import { normalizeExamToken } from "@/lib/exam-links";
import { ExamWorkspace } from "./workspace";

function unavailable(title: string, message: string) {
  return <Card><CardHeader><CardTitle>{title}</CardTitle></CardHeader><CardContent className="text-sm text-muted-foreground">{message}</CardContent></Card>;
}

export default async function HiddenExamPage({ searchParams }: { searchParams: Promise<{ token?: string }> }) {
  const token = normalizeExamToken((await searchParams).token ?? "");
  if (!token) return unavailable("Invalid exam link", "Missing or malformed access token.");

  const ctx = await currentStudent();
  if (!ctx) return unavailable("Sign in required", "Sign in before opening an examination.");

  const { data: link, error: linkError } = await ctx.supabase
    .from("exam_session_links")
    .select("session_id,active,expires_at")
    .eq("token", token)
    .eq("active", true)
    .maybeSingle();
  if (linkError || !link) return unavailable("Exam unavailable", "This exam link is invalid or is not assigned to you.");
  if (link.expires_at && new Date(String(link.expires_at)).getTime() <= Date.now()) {
    return unavailable("Exam unavailable", "This exam link has expired.");
  }

  const examId = String(link.session_id).toUpperCase();
  const { data: access, error: accessError } = await ctx.supabase.rpc("my_exam_access", { p_session_id: examId });
  if (accessError) return unavailable("Exam unavailable", "Exam eligibility could not be verified.");
  const accessRow = (Array.isArray(access) ? access[0] : access) as { eligible?: boolean; denial_reason?: string | null } | null;
  if (!accessRow?.eligible) {
    const reason = accessRow?.denial_reason;
    const message = reason === "not_started"
      ? "This examination has not started yet."
      : reason === "ended"
        ? "This examination has closed."
        : reason === "not_open"
          ? "This examination is not open."
          : "This examination is not assigned to you.";
    return unavailable("Exam unavailable", message);
  }

  const { data: session } = await ctx.supabase
    .from("exam_sessions")
    .select("id,title,duration_seconds")
    .eq("id", examId)
    .maybeSingle();
  const row = session as { id: string; title: string; duration_seconds: number } | null;
  if (!row) return unavailable("Exam unavailable", "Session metadata is unavailable.");
  return <ExamWorkspace sessionId={row.id} title={row.title} durationSeconds={Number(row.duration_seconds)} />;
}
