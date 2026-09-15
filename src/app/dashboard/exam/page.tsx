// Hidden exam workspace — NOT in studentNav sidebar.
// Reachable only via a signed/encoded session payload after relational
// eligibility has been rechecked server-side.
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { currentStudent } from "@/lib/auth/current-student";
import { decodeSession } from "@/lib/exam-links";
import { ExamWorkspace } from "./workspace";

function unavailable(title: string, message: string) {
  return <Card><CardHeader><CardTitle>{title}</CardTitle></CardHeader><CardContent className="text-sm text-muted-foreground">{message}</CardContent></Card>;
}

export default async function HiddenExamPage({ searchParams }: { searchParams: Promise<{ session?: string }> }) {
  const raw = (await searchParams).session;
  if (!raw) return unavailable("Invalid exam link", "Missing session payload.");
  let decoded: { id?: string };
  try {
    decoded = decodeSession(raw);
  } catch {
    return unavailable("Invalid exam link", "Malformed session.");
  }
  const examId = String(decoded.id ?? "").toUpperCase();
  if (!examId) return unavailable("Invalid exam link", "Missing examination ID.");

  const ctx = await currentStudent();
  if (!ctx) return unavailable("Sign in required", "Sign in before opening an examination.");
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
