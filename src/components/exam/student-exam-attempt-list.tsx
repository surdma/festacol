import {
  CheckCircle2,
  ChevronRight,
  CircleDot,
  Clock3,
  GraduationCap,
  ShieldCheck,
} from "lucide-react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { ExamAttemptRow } from "@/types/db";

function formatAttemptDate(attempt: ExamAttemptRow) {
  const value = attempt.submitted_at ?? attempt.started_at ?? attempt.created_at;
  if (!value) return "Date unavailable";
  return new Intl.DateTimeFormat("en-NG", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(Number(value)));
}

function modeLabel(mode: ExamAttemptRow["context_snapshot"]["mode"]) {
  if (mode === "qualifier") return "Placement";
  if (mode === "single") return "Single subject";
  if (mode === "mixed") return "Multi subject";
  if (mode === "bece") return "BECE";
  if (mode === "waec") return "WAEC";
  if (mode === "neco") return "NECO";
  if (mode === "jamb") return "JAMB";
  return "Exam";
}

function trackLabel(track: ExamAttemptRow["assigned_track"]) {
  if (track === "science") return "Science";
  if (track === "humanities") return "Humanities";
  if (track === "business") return "Business";
  return null;
}

export function StudentExamAttemptList({
  attempts,
  variant,
}: {
  attempts: ExamAttemptRow[];
  variant: "history" | "dashboard";
}) {
  if (!attempts.length) return null;

  return (
    <div className="overflow-hidden rounded-2xl border bg-card">
      {variant === "history" ? (
        <div className="hidden grid-cols-[minmax(0,1fr)_7rem_7rem_8.5rem] gap-3 border-b bg-muted/35 px-4 py-2 text-[10px] font-bold uppercase tracking-[0.13em] text-muted-foreground md:grid">
          <span>Examination</span>
          <span>Score</span>
          <span>Integrity</span>
          <span className="text-right">Action</span>
        </div>
      ) : null}

      <div className="divide-y">
        {attempts.map((attempt) => {
          const submitted = Boolean(attempt.submitted_at);
          const track = trackLabel(attempt.assigned_track);
          const title = attempt.context_snapshot.sessionTitle?.trim() || attempt.session_id;
          const href = submitted
            ? `/dashboard/history/result/${encodeURIComponent(attempt.id)}`
            : "/dashboard";

          return (
            <article
              key={attempt.id}
              className={cn(
                "grid min-w-0 gap-3 px-4 py-3 transition-colors hover:bg-muted/20",
                variant === "history"
                  ? "md:grid-cols-[minmax(0,1fr)_7rem_7rem_8.5rem] md:items-center"
                  : "sm:grid-cols-[minmax(0,1fr)_auto_auto] sm:items-center",
              )}
            >
              <div className="flex min-w-0 items-start gap-3">
                <span
                  className={cn(
                    "mt-0.5 grid size-9 shrink-0 place-items-center rounded-xl border",
                    submitted
                      ? "border-success-border bg-success text-success-foreground"
                      : "border-warning-border bg-warning text-warning-foreground",
                  )}
                >
                  {submitted ? (
                    <CheckCircle2 className="size-4" aria-hidden="true" />
                  ) : (
                    <CircleDot className="size-4" aria-hidden="true" />
                  )}
                </span>

                <div className="min-w-0">
                  <div className="flex min-w-0 flex-wrap items-center gap-2">
                    <h3 className="min-w-0 truncate text-sm font-bold">{title}</h3>
                    <Badge variant="outline" className="h-5 px-1.5 text-[10px]">
                      {modeLabel(attempt.context_snapshot.mode)}
                    </Badge>
                    {track ? (
                      <Badge
                        variant="outline"
                        className="h-5 border-result-placement/30 bg-result-placement/10 px-1.5 text-[10px]"
                      >
                        <GraduationCap className="size-3" aria-hidden="true" />
                        {track}
                      </Badge>
                    ) : null}
                  </div>
                  <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground">
                    <span>Attempt #{attempt.attempt_number}</span>
                    <span className="inline-flex items-center gap-1">
                      <Clock3 className="size-3" aria-hidden="true" />
                      {formatAttemptDate(attempt)}
                    </span>
                    <span>{submitted ? "Submitted" : "In progress"}</span>
                  </div>
                </div>
              </div>

              {variant === "history" ? (
                <>
                  <div className="flex items-center justify-between gap-3 md:block">
                    <span className="text-[10px] font-bold uppercase tracking-[0.12em] text-muted-foreground md:hidden">
                      Score
                    </span>
                    <strong className="text-base tabular-nums">
                      {submitted && attempt.score !== null ? `${Math.round(attempt.score)}%` : "—"}
                    </strong>
                  </div>
                  <div className="flex items-center justify-between gap-3 md:block">
                    <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-[0.12em] text-muted-foreground md:hidden">
                      <ShieldCheck className="size-3" aria-hidden="true" />
                      Integrity
                    </span>
                    <strong className="text-sm tabular-nums">
                      {submitted && attempt.integrity_score !== null
                        ? `${Math.round(attempt.integrity_score)}%`
                        : "—"}
                    </strong>
                  </div>
                </>
              ) : (
                <div className="flex items-center justify-between gap-3 sm:justify-end">
                  {submitted ? (
                    <span className="text-lg font-black tabular-nums">
                      {attempt.score === null ? "—" : `${Math.round(attempt.score)}%`}
                    </span>
                  ) : (
                    <Badge
                      variant="outline"
                      className="border-warning-border bg-warning text-warning-foreground"
                    >
                      In progress
                    </Badge>
                  )}
                </div>
              )}

              <div className={cn("flex", variant === "history" && "md:justify-end")}>
                <Link
                  href={href}
                  className={buttonVariants({
                    size: "sm",
                    variant: submitted ? "outline" : "default",
                    className: "w-full justify-between md:w-auto",
                  })}
                >
                  {submitted ? "View result" : "Open dashboard"}
                  <ChevronRight data-icon="inline-end" />
                </Link>
              </div>
            </article>
          );
        })}
      </div>
    </div>
  );
}
