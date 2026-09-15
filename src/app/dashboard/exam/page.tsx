// Hidden exam workspace — NOT in studentNav sidebar.
// Reachable only via /dashboard/exam?session=<v2|v3 payload>.
import { decodeSession } from "@/lib/exam-links";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { findSessionById } from "@/lib/supabase/queries";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ExamWorkspace } from "./workspace";

export default async function HiddenExamPage({ searchParams }: { searchParams: Promise<{ session?: string }> }) {
  const raw = (await searchParams).session;
  if (!raw) return <Card><CardHeader><CardTitle>Invalid exam link</CardTitle></CardHeader><CardContent className="text-sm text-muted-foreground">Missing session payload.</CardContent></Card>;
  let decoded: { id?: string };
  try { decoded = decodeSession(raw); } catch { return <Card><CardHeader><CardTitle>Invalid exam link</CardTitle></CardHeader><CardContent className="text-sm text-muted-foreground">Malformed session.</CardContent></Card>; }
  const supabase = await createSupabaseServerClient();
  const session = decoded.id ? await findSessionById(supabase, String(decoded.id)) : null;
  if (!session) return <Card><CardHeader><CardTitle>Exam unavailable</CardTitle></CardHeader><CardContent className="text-sm text-muted-foreground">Session not found.</CardContent></Card>;
  return <ExamWorkspace sessionId={session.id} title={session.title} durationSeconds={session.duration_seconds} />;
}
