import Link from "next/link";
import { BookOpenCheck, Plus } from "lucide-react";
import { AdminFilterLinks, AdminPageHeader, AdminSearchForm } from "@/components/admin/admin-ui";
import { StatusBadge } from "@/components/status-badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { currentStaff, examVisibleTo } from "@/lib/auth/staff";
import { listSessions } from "@/lib/supabase/queries";
import type { ExamSessionRow } from "@/types/db";

function examState(session: ExamSessionRow): "open" | "draft" | "scheduled" | "closed" {
  const now = Date.now();
  if (session.status === "draft") return "draft";
  if (session.status === "closed") return "closed";
  if (session.starts_at && Number(session.starts_at) > now) return "scheduled";
  if (session.ends_at && Number(session.ends_at) < now) return "closed";
  return "open";
}

function stateTone(state: string) {
  if (state === "open") return "emerald";
  if (state === "draft" || state === "scheduled") return "amber";
  return "neutral";
}

export default async function AdminExamsPage({ searchParams }: { searchParams: Promise<{ q?: string; status?: string }> }) {
  const params = await searchParams;
  const q = String(params.q ?? "").trim().toLowerCase();
  const status = ["open", "draft", "scheduled", "closed"].includes(String(params.status)) ? String(params.status) : "all";
  const { supabase, scope } = await currentStaff();
  const [allSessions, attemptsResult] = await Promise.all([
    listSessions(supabase),
    supabase.from("exam_attempts").select("session_id,submitted_at,rewrite_archived_at").limit(2000),
  ]);
  const sessions = allSessions
    .filter((session) => examVisibleTo(session, scope))
    .filter((session) => !q || `${session.title} ${session.id} ${session.class_level} ${session.class_group} ${(session.subjects ?? []).join(" ")}`.toLowerCase().includes(q))
    .filter((session) => status === "all" || examState(session) === status);
  const counts = new Map<string, { total: number; submitted: number }>();
  for (const attempt of ((attemptsResult.data ?? []) as { session_id: string | null; submitted_at: number | null; rewrite_archived_at: number | null }[])) {
    if (!attempt.session_id || attempt.rewrite_archived_at) continue;
    const value = counts.get(attempt.session_id) ?? { total: 0, submitted: 0 };
    value.total += 1;
    if (attempt.submitted_at) value.submitted += 1;
    counts.set(attempt.session_id, value);
  }

  return (
    <div className="flex flex-col gap-5">
      <AdminPageHeader
        eyebrow="Assessment control"
        title="Examinations"
        description={scope.isAdmin ? "Create, publish and monitor production examination sessions." : `Scoped to ${scope.subjects.join(", ") || "your assigned subjects"}${scope.qualifierAccess ? " plus qualifier examinations" : ""}.`}
        actions={<Button render={<Link href="/admin/exams?modal=create-exam" />}><Plus data-icon="inline-start" />New exam</Button>}
      />
      <div className="flex flex-col gap-3 xl:flex-row xl:items-center">
        <AdminSearchForm query={params.q} placeholder="Search title, Exam ID, class or subject" hidden={{ status: status === "all" ? undefined : status }} />
        <AdminFilterLinks pathname="/admin/exams" param="status" current={status} preserve={{ q: params.q }} options={[{ value: "all", label: "All exams" }, { value: "open", label: "Open" }, { value: "draft", label: "Draft" }, { value: "scheduled", label: "Scheduled" }, { value: "closed", label: "Closed" }]} />
      </div>
      <div className="text-sm text-muted-foreground">{sessions.length} visible examination{sessions.length === 1 ? "" : "s"}</div>

      {sessions.length ? (
        <Card className="overflow-hidden">
          <div className="hidden lg:block">
            <Table>
              <TableHeader><TableRow><TableHead>Exam</TableHead><TableHead>Audience</TableHead><TableHead>Paper</TableHead><TableHead>Attempts</TableHead><TableHead>Status</TableHead></TableRow></TableHeader>
              <TableBody>
                {sessions.map((session) => {
                  const state = examState(session);
                  const activity = counts.get(session.id) ?? { total: 0, submitted: 0 };
                  return (
                    <TableRow key={session.id}>
                      <TableCell><Link href={`/admin/exams?modal=exam&exam=${encodeURIComponent(session.id)}`} className="font-medium hover:underline">{session.title}</Link><p className="mt-1 font-mono text-[11px] text-muted-foreground">{session.id}</p></TableCell>
                      <TableCell><strong className="block text-sm font-medium">{session.class_level} · {session.class_group}</strong><span className="mt-1 block max-w-sm text-xs text-muted-foreground">{session.subjects?.length ? session.subjects.join(", ") : session.mode}</span></TableCell>
                      <TableCell><strong className="tabular-nums">{session.question_count}</strong><span className="mt-1 block text-xs text-muted-foreground">{Math.round(session.duration_seconds / 60)} min</span></TableCell>
                      <TableCell><strong className="tabular-nums">{activity.total}</strong><span className="mt-1 block text-xs text-muted-foreground">{activity.submitted} submitted</span></TableCell>
                      <TableCell><StatusBadge tone={stateTone(state)}>{state}</StatusBadge></TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
          <div className="divide-y lg:hidden">
            {sessions.map((session) => {
              const state = examState(session);
              const activity = counts.get(session.id) ?? { total: 0, submitted: 0 };
              return (
                <Link key={session.id} href={`/admin/exams?modal=exam&exam=${encodeURIComponent(session.id)}`} className="flex gap-3 p-4 hover:bg-muted/50">
                  <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-neutral-950 text-white"><BookOpenCheck className="size-4" /></span>
                  <span className="min-w-0 flex-1"><strong className="block truncate text-sm">{session.title}</strong><span className="mt-1 block truncate text-xs text-muted-foreground">{session.class_level} · {session.question_count} questions · {activity.submitted}/{activity.total} submitted</span></span>
                  <StatusBadge tone={stateTone(state)}>{state}</StatusBadge>
                </Link>
              );
            })}
          </div>
        </Card>
      ) : (
        <Card><CardContent className="p-8 text-center"><BookOpenCheck className="mx-auto size-8 text-muted-foreground" /><h2 className="mt-3 font-medium">No matching examinations</h2><p className="mt-1 text-sm text-muted-foreground">Change the search/filter or create a new exam.</p></CardContent></Card>
      )}
    </div>
  );
}
