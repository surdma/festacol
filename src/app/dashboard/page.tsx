import { redirect } from "next/navigation";
import { attemptsForStudent } from "@/lib/supabase/queries";
import { currentStudent } from "@/lib/auth/current-student";
import { MetricCard } from "@/components/metric-card";
import { ExamIdDialog } from "@/components/exam-id-dialog";
import { LiveExamNotice } from "@/components/live-exam-notice";
import { FadeUp, Stagger } from "@/components/motion";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ClipboardList, BarChart3, ShieldCheck, CalendarDays } from "lucide-react";

export default async function DashboardHome() {
  const ctx = await currentStudent();
  if (!ctx) redirect("/");
  const attempts = await attemptsForStudent(ctx.supabase, ctx.profile.profile_id);
  const submitted = attempts.filter((attempt) => attempt.submitted_at);
  const avg = submitted.length ? Math.round(submitted.reduce((sum, attempt) => sum + (attempt.score ?? 0), 0) / submitted.length) : null;
  const integrity = submitted.length ? Math.round(submitted.reduce((sum, attempt) => sum + (attempt.integrity_score ?? 100), 0) / submitted.length) : null;
  const active = attempts.find((attempt) => attempt.started_at && !attempt.submitted_at);

  return (
    <div className="flex flex-col gap-6">
      <FadeUp><div><p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Student portal</p><h1 className="text-2xl font-semibold">Dashboard</h1></div></FadeUp>
      <LiveExamNotice />
      <Card>
        <CardHeader><CardTitle>{active ? "In progress" : "No active exam"}</CardTitle></CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          {active ? `Resume ${active.session_title}.` : "Open an exam from a link, QR card, or the Exam ID button."}
        </CardContent>
      </Card>
      <Stagger className="grid grid-cols-2 gap-4 xl:grid-cols-4">
        <MetricCard label="Completed" value={String(submitted.length)} icon={ClipboardList} />
        <MetricCard label="Average" value={avg === null ? "—" : `${avg}%`} icon={BarChart3} />
        <MetricCard label="Integrity" value={integrity === null ? "—" : `${integrity}%`} icon={ShieldCheck} />
        <MetricCard label="Session" value="2026/27" icon={CalendarDays} />
      </Stagger>
      <ExamIdDialog />
    </div>
  );
}
