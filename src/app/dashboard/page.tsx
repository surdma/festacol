import {
  Activity,
  ArrowRight,
  BookOpenCheck,
  CircleDot,
  History,
  ShieldCheck,
  TrendingUp,
} from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { resolveResumeHrefAction } from "@/app/actions/exams";
import { ExamIdDialog } from "@/components/exam-id-dialog";
import { StudentExamAttemptList } from "@/components/exam/student-exam-attempt-list";
import { LiveExamNotice } from "@/components/live-exam-notice";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { currentStudent } from "@/lib/auth/current-student";
import { attemptsForStudent } from "@/lib/supabase/queries";

export default async function DashboardHome() {
  const ctx = await currentStudent();
  if (!ctx) redirect("/?next=/dashboard");

  const attempts = await attemptsForStudent(ctx.supabase, ctx.profile.profile_id);
  const submitted = attempts.filter((attempt) => Boolean(attempt.submitted_at));
  const active = attempts.find((attempt) => attempt.started_at && !attempt.submitted_at) ?? null;
  const scored = submitted.filter((attempt) => attempt.score !== null);
  const average = scored.length
    ? Math.round(
        scored.reduce((sum, attempt) => sum + Number(attempt.score ?? 0), 0) /
          scored.length,
      )
    : null;
  const integrityRows = submitted.filter((attempt) => attempt.integrity_score !== null);
  const integrity = integrityRows.length
    ? Math.round(
        integrityRows.reduce(
          (sum, attempt) => sum + Number(attempt.integrity_score ?? 0),
          0,
        ) / integrityRows.length,
      )
    : null;
  const resumeHref = active
    ? ((await resolveResumeHrefAction(active.session_id)).href ?? null)
    : null;
  const recent = attempts.slice(0, 5);

  return (
    <div className="grid gap-4 pb-6">
      <header className="flex flex-col gap-3 border-b pb-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="outline">
              <Activity className="size-3.5" aria-hidden="true" />
              Student exam desk
            </Badge>
            <span className="text-xs text-muted-foreground">
              {ctx.profile.student_number ?? "Student account"}
            </span>
          </div>
          <h1 className="mt-2 text-2xl font-black tracking-tight">
            Welcome, {ctx.profile.first_name}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Your active sitting, recent results, and exam record in one place.
          </p>
        </div>
        <Link
          href="/dashboard/history"
          className={buttonVariants({ size: "sm", variant: "outline" })}
        >
          Full exam history
          <ArrowRight data-icon="inline-end" />
        </Link>
      </header>

      <LiveExamNotice />

      <section className="grid overflow-hidden rounded-2xl border bg-card lg:grid-cols-[minmax(0,1.45fr)_minmax(17rem,0.55fr)]">
        <div className="min-w-0 p-5 sm:p-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-muted-foreground">
                Current examination
              </p>
              <h2 className="mt-1 text-xl font-black tracking-tight">
                {active
                  ? active.context_snapshot.sessionTitle || active.session_id
                  : "No active sitting"}
              </h2>
            </div>
            <Badge
              variant="outline"
              className={
                active
                  ? "border-warning-border bg-warning text-warning-foreground"
                  : ""
              }
            >
              {active ? (
                <CircleDot className="size-3.5" aria-hidden="true" />
              ) : (
                <BookOpenCheck className="size-3.5" aria-hidden="true" />
              )}
              {active ? "In progress" : "Ready"}
            </Badge>
          </div>

          <p className="mt-3 max-w-2xl text-sm leading-6 text-muted-foreground">
            {active
              ? "Resume the saved sitting from the secure exam link. Your last saved position remains tied to this attempt."
              : "Open a teacher link, scan the exam QR code, or use the Exam ID button to start your next assigned examination."}
          </p>

          <div className="mt-5 flex flex-wrap gap-2">
            {active && resumeHref ? (
              <Link href={resumeHref} className={buttonVariants()}>
                Resume examination
                <ArrowRight data-icon="inline-end" />
              </Link>
            ) : active ? (
              <Link
                href="/dashboard/history?status=in-progress"
                className={buttonVariants({ variant: "outline" })}
              >
                Review active attempt
              </Link>
            ) : (
              <Link
                href="/dashboard/history"
                className={buttonVariants({ variant: "outline" })}
              >
                Review previous exams
              </Link>
            )}
          </div>
        </div>

        <div className="grid border-t bg-muted/15 sm:grid-cols-3 lg:grid-cols-1 lg:border-l lg:border-t-0">
          <div className="flex items-center gap-3 px-4 py-3">
            <span className="grid size-9 place-items-center rounded-xl bg-background shadow-sm">
              <BookOpenCheck className="size-4" aria-hidden="true" />
            </span>
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.13em] text-muted-foreground">
                Completed
              </p>
              <p className="text-xl font-black tabular-nums">{submitted.length}</p>
            </div>
          </div>
          <div className="flex items-center gap-3 border-t px-4 py-3 sm:border-l sm:border-t-0 lg:border-l-0 lg:border-t">
            <span className="grid size-9 place-items-center rounded-xl bg-background shadow-sm">
              <TrendingUp className="size-4" aria-hidden="true" />
            </span>
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.13em] text-muted-foreground">
                Average
              </p>
              <p className="text-xl font-black tabular-nums">
                {average === null ? "—" : `${average}%`}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3 border-t px-4 py-3 sm:border-l sm:border-t-0 lg:border-l-0 lg:border-t">
            <span className="grid size-9 place-items-center rounded-xl bg-background shadow-sm">
              <ShieldCheck className="size-4" aria-hidden="true" />
            </span>
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.13em] text-muted-foreground">
                Integrity
              </p>
              <p className="text-xl font-black tabular-nums">
                {integrity === null ? "—" : `${integrity}%`}
              </p>
            </div>
          </div>
        </div>
      </section>

      <section className="grid gap-2">
        <div className="flex items-end justify-between gap-3">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-muted-foreground">
              Recent activity
            </p>
            <h2 className="mt-1 text-base font-black">Your latest exam attempts</h2>
          </div>
          {attempts.length > recent.length ? (
            <Link
              href="/dashboard/history"
              className={buttonVariants({ size: "sm", variant: "ghost" })}
            >
              <History data-icon="inline-start" />
              View all
            </Link>
          ) : null}
        </div>

        {recent.length ? (
          <StudentExamAttemptList attempts={recent} variant="dashboard" />
        ) : (
          <div className="rounded-2xl border border-dashed bg-muted/15 px-5 py-7 text-center">
            <BookOpenCheck className="mx-auto size-5 text-muted-foreground" aria-hidden="true" />
            <p className="mt-3 text-sm font-bold">No exam activity yet</p>
            <p className="mt-1 text-xs text-muted-foreground">
              Your first attempt will appear here as soon as you open an assigned examination.
            </p>
          </div>
        )}
      </section>

      <ExamIdDialog />
    </div>
  );
}
