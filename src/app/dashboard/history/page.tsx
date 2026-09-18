import { BookOpenCheck, CircleDot, History, TrendingUp } from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { StudentExamAttemptList } from "@/components/exam/student-exam-attempt-list";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { currentStudent } from "@/lib/auth/current-student";
import { attemptsForStudent } from "@/lib/supabase/queries";
import { cn } from "@/lib/utils";

const FILTERS = [
  { value: "all", label: "All" },
  { value: "submitted", label: "Submitted" },
  { value: "in-progress", label: "In progress" },
] as const;

export default async function HistoryPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const ctx = await currentStudent();
  if (!ctx) redirect("/?next=/dashboard/history");

  const requested = String((await searchParams).status ?? "all");
  const status = FILTERS.some((item) => item.value === requested) ? requested : "all";
  const attempts = await attemptsForStudent(ctx.supabase, ctx.profile.profile_id);
  const submitted = attempts.filter((attempt) => Boolean(attempt.submitted_at));
  const inProgress = attempts.filter((attempt) => !attempt.submitted_at);
  const visible =
    status === "submitted"
      ? submitted
      : status === "in-progress"
        ? inProgress
        : attempts;
  const scored = submitted.filter((attempt) => attempt.score !== null);
  const average = scored.length
    ? Math.round(
        scored.reduce((sum, attempt) => sum + Number(attempt.score ?? 0), 0) /
          scored.length,
      )
    : 0;

  return (
    <div className="grid gap-4 pb-6">
      <header className="flex flex-col gap-3 border-b pb-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="outline">
              <History className="size-3.5" aria-hidden="true" />
              Student exams
            </Badge>
            <span className="text-xs text-muted-foreground">
              {attempts.length} attempt{attempts.length === 1 ? "" : "s"}
            </span>
          </div>
          <h1 className="mt-2 text-2xl font-black tracking-tight">Exam history</h1>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
            Open any submitted sitting to view the same full result booklet used by the examination experience.
          </p>
        </div>

        <nav className="flex flex-wrap gap-1.5" aria-label="Filter exam history">
          {FILTERS.map((item) => (
            <Link
              key={item.value}
              href={
                item.value === "all"
                  ? "/dashboard/history"
                  : `/dashboard/history?status=${item.value}`
              }
              className={buttonVariants({
                size: "sm",
                variant: status === item.value ? "default" : "outline",
              })}
              aria-current={status === item.value ? "page" : undefined}
            >
              {item.label}
            </Link>
          ))}
        </nav>
      </header>

      <section className="grid overflow-hidden rounded-2xl border bg-card sm:grid-cols-3">
        <div className="flex items-center gap-3 px-4 py-3">
          <span className="grid size-9 place-items-center rounded-xl bg-muted">
            <BookOpenCheck className="size-4" aria-hidden="true" />
          </span>
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.13em] text-muted-foreground">
              Submitted
            </p>
            <p className="text-xl font-black tabular-nums">{submitted.length}</p>
          </div>
        </div>
        <div className="flex items-center gap-3 border-t px-4 py-3 sm:border-l sm:border-t-0">
          <span className="grid size-9 place-items-center rounded-xl bg-muted">
            <CircleDot className="size-4" aria-hidden="true" />
          </span>
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.13em] text-muted-foreground">
              In progress
            </p>
            <p className="text-xl font-black tabular-nums">{inProgress.length}</p>
          </div>
        </div>
        <div className="flex items-center gap-3 border-t px-4 py-3 sm:border-l sm:border-t-0">
          <span className="grid size-9 place-items-center rounded-xl bg-muted">
            <TrendingUp className="size-4" aria-hidden="true" />
          </span>
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.13em] text-muted-foreground">
              Average score
            </p>
            <p className="text-xl font-black tabular-nums">{scored.length ? `${average}%` : "—"}</p>
          </div>
        </div>
      </section>

      {visible.length ? (
        <StudentExamAttemptList attempts={visible} variant="history" />
      ) : (
        <section className="grid min-h-44 place-items-center rounded-2xl border border-dashed bg-muted/15 p-6 text-center">
          <div>
            <History className="mx-auto size-5 text-muted-foreground" aria-hidden="true" />
            <h2 className="mt-3 text-sm font-bold">No exams in this view</h2>
            <p className="mt-1 text-xs text-muted-foreground">
              {status === "all"
                ? "Your exam attempts will appear here after you start an examination."
                : `There are no ${status.replace("-", " ")} attempts yet.`}
            </p>
            {status !== "all" ? (
              <Link
                href="/dashboard/history"
                className={cn(buttonVariants({ size: "sm", variant: "outline" }), "mt-4")}
              >
                Show all attempts
              </Link>
            ) : null}
          </div>
        </section>
      )}
    </div>
  );
}
