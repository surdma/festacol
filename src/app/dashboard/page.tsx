import {
  BarChart3,
  CalendarDays,
  ClipboardList,
  ShieldCheck,
} from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { resolveResumeHrefAction } from "@/app/actions/exams";
import { ExamIdDialog } from "@/components/exam-id-dialog";
import { LiveExamNotice } from "@/components/live-exam-notice";
import { MetricCard } from "@/components/metric-card";
import { FadeUp, Stagger } from "@/components/motion";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { currentStudent } from "@/lib/auth/current-student";
import { attemptsForStudent } from "@/lib/supabase/queries";

export default async function DashboardHome() {
  const ctx = await currentStudent();
  if (!ctx) redirect("/?next=/dashboard");
  const attempts = await attemptsForStudent(
    ctx.supabase,
    ctx.profile.profile_id,
  );
  const submitted = attempts.filter((attempt) => attempt.submitted_at);
  const avg = submitted.length
    ? Math.round(
        submitted.reduce((sum, attempt) => sum + (attempt.score ?? 0), 0) /
          submitted.length,
      )
    : null;
  const integrity = submitted.length
    ? Math.round(
        submitted.reduce(
          (sum, attempt) => sum + (attempt.integrity_score ?? 100),
          0,
        ) / submitted.length,
      )
    : null;
  const active = attempts.find(
    (attempt) => attempt.started_at && !attempt.submitted_at,
  );
  // Resolve the opaque candidate link for the stored session id — never
  // render the Exam ID itself as a token. A missing href keeps the card on
  // history instead of a dead link.
  const resumeHref = active
    ? ((await resolveResumeHrefAction(active.session_id)).href ?? null)
    : null;

  return (
    <div className="flex flex-col gap-6">
      <FadeUp>
        <div>
          <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
            Student portal
          </p>
          <h1 className="text-2xl font-semibold">Dashboard</h1>
        </div>
      </FadeUp>
      <LiveExamNotice />
      <Card>
        <CardHeader>
          <CardTitle>{active ? "In progress" : "No active exam"}</CardTitle>
          {active ? (
            <CardDescription>
              {active.context_snapshot.sessionTitle}
            </CardDescription>
          ) : null}
        </CardHeader>
        <CardContent>
          {active ? (
            resumeHref ? (
              <Button render={<Link href={resumeHref} />}>
                Resume {active.context_snapshot.sessionTitle}
              </Button>
            ) : (
              <div className="flex flex-col items-start gap-3">
                <p className="text-sm text-muted-foreground">
                  Your exam link is unavailable — ask your teacher for a new
                  link.
                </p>
                <Button
                  variant="outline"
                  render={<Link href="/dashboard/history" />}
                >
                  Open history
                </Button>
              </div>
            )
          ) : (
            <p className="text-sm text-muted-foreground">
              Open an exam from a link, QR card, or the Exam ID button.
            </p>
          )}
        </CardContent>
      </Card>
      <Stagger className="grid grid-cols-2 gap-4 xl:grid-cols-4">
        <MetricCard
          label="Completed"
          value={String(submitted.length)}
          icon={ClipboardList}
        />
        <MetricCard
          label="Average"
          value={avg === null ? "—" : `${avg}%`}
          icon={BarChart3}
        />
        <MetricCard
          label="Integrity"
          value={integrity === null ? "—" : `${integrity}%`}
          icon={ShieldCheck}
        />
        <MetricCard label="Session" value="2026/27" icon={CalendarDays} />
      </Stagger>
      <ExamIdDialog />
    </div>
  );
}
