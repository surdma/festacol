"use client";

import { useState } from "react";
import {
  Activity,
  Award,
  BookOpenCheck,
  CheckCircle2,
  CircleAlert,
  Clock3,
  Copy,
  FileCheck2,
  Gauge,
  GraduationCap,
  MoreHorizontal,
  Printer,
  RefreshCw,
  TimerReset,
} from "lucide-react";
import type { SubmitSummary } from "@/app/actions/exam-state";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Progress, ProgressLabel } from "@/components/ui/progress";
import { Spinner } from "@/components/ui/spinner";
import { cn } from "@/lib/utils";
import type { ExamExperienceContext, ExamMode, ExamResultSummary } from "@/types/exam";

type AsyncActionStatus = "idle" | "working" | "success" | "error";

function formatDuration(totalSeconds: number): string {
  const seconds = Math.max(0, Math.round(totalSeconds));
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const remainder = seconds % 60;
  if (hours) return `${hours}h ${minutes}m`;
  if (minutes) return `${minutes}m ${remainder}s`;
  return `${remainder}s`;
}

function formatDateTime(timestamp: number | null): string {
  if (timestamp === null) return "Not recorded";
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(timestamp));
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  return parts.slice(0, 2).map((part) => part[0]?.toUpperCase() ?? "").join("") || "ST";
}

function modeLabel(mode: ExamMode): string {
  if (mode === "qualifier") return "Placement examination";
  if (mode === "single") return "Single-subject examination";
  if (mode === "mixed") return "Multi-subject examination";
  if (mode === "bece") return "BECE practice";
  if (mode === "waec") return "WAEC practice";
  if (mode === "neco") return "NECO practice";
  return "JAMB practice";
}

function submissionLabel(reason: ExamResultSummary["submissionReason"]): string {
  if (reason === "potential-malpractice") return "Potential malpractice — a blocked browser shortcut was used";
  if (reason === "time-expired") return "Submitted automatically when time ended";
  if (reason === "exam-closed") return "Submitted when the examination closed";
  if (reason === "manual") return "Submitted by you";
  return "Result saved";
}

function subjectTone(index: number): string {
  if (index % 4 === 1) return "[&_[data-slot=progress-indicator]]:bg-result-activity";
  if (index % 4 === 2) return "[&_[data-slot=progress-indicator]]:bg-result-score";
  if (index % 4 === 3) return "[&_[data-slot=progress-indicator]]:bg-warning-foreground";
  return "[&_[data-slot=progress-indicator]]:bg-result-subject";
}

function strongestSubject(summary: ExamResultSummary) {
  if (!summary.subjectStats.length) return null;
  return summary.subjectStats.reduce((best, current) => current.percent > best.percent ? current : best);
}

function ResultAchievements({ summary }: { summary: ExamResultSummary }) {
  const strongest = strongestSubject(summary);
  const remainingSeconds = Math.max(0, summary.durationSeconds - summary.elapsedSeconds);

  return (
    <section aria-labelledby="result-highlights-title">
      <h2 id="result-highlights-title" className="sr-only">Result highlights</h2>
      <div className="flex flex-wrap gap-2">
      {strongest ? (
        <Badge variant="outline" className="border-info-border bg-info text-info-foreground">
          <Award data-icon="inline-start" />
          Strongest subject · {strongest.subject}
        </Badge>
      ) : null}
      <Badge variant="outline" className="border-success-border bg-success text-success-foreground">
        <BookOpenCheck data-icon="inline-start" />
        {summary.unansweredCount === 0 ? "Every question answered" : `${Math.round(summary.completion)}% completed`}
      </Badge>
      {remainingSeconds > 0 ? (
        <Badge variant="outline" className="border-warning-border bg-warning text-warning-foreground">
          <TimerReset data-icon="inline-start" />
          Submitted before time ended
        </Badge>
      ) : null}
      </div>
    </section>
  );
}

function CandidateResultProfile({
  context,
  summary,
  onDashboard,
  onRefresh,
}: {
  context: ExamExperienceContext;
  summary: ExamResultSummary;
  onDashboard: () => void;
  onRefresh: () => Promise<boolean>;
}) {
  const [refreshStatus, setRefreshStatus] = useState<AsyncActionStatus>("idle");
  const [copyStatus, setCopyStatus] = useState<AsyncActionStatus>("idle");

  async function refreshResult() {
    setRefreshStatus("working");
    const ok = await onRefresh();
    setRefreshStatus(ok ? "success" : "error");
  }

  async function copyReference() {
    try {
      setCopyStatus("working");
      await navigator.clipboard.writeText(summary.attemptId);
      setCopyStatus("success");
    } catch {
      setCopyStatus("error");
    }
  }

  const actionMessage =
    refreshStatus === "success"
      ? "Result refreshed."
      : refreshStatus === "error"
        ? "Could not refresh the result. Check your connection and try again."
        : copyStatus === "success"
          ? "Result reference copied."
          : copyStatus === "error"
            ? "Could not copy the result reference."
            : "";

  return (
    <Card className="relative animate-result-rise-1 overflow-visible border-0 bg-transparent text-result-cover-foreground shadow-none">
      <DropdownMenu>
        <DropdownMenuTrigger
          render={<Button type="button" size="icon" variant="ghost" className="absolute right-3 top-3 print:hidden" aria-label="More result actions" />}
        >
          <MoreHorizontal aria-hidden="true" />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56">
          <DropdownMenuGroup>
            <DropdownMenuLabel>Result actions</DropdownMenuLabel>
            <DropdownMenuItem disabled={refreshStatus === "working"} onClick={() => void refreshResult()}>
              {refreshStatus === "working" ? <Spinner /> : <RefreshCw />}
              Refresh result
            </DropdownMenuItem>
            <DropdownMenuItem disabled={copyStatus === "working"} onClick={() => void copyReference()}>
              <Copy />
              Copy result reference
            </DropdownMenuItem>
          </DropdownMenuGroup>
        </DropdownMenuContent>
      </DropdownMenu>

      <CardContent className="flex flex-col items-center px-0 py-0 text-center">
        <Avatar className="size-20 shadow-sm">
          <AvatarFallback className="bg-result-cover-foreground/12 text-xl font-black text-result-cover-foreground">
            {initials(summary.candidateName)}
          </AvatarFallback>
        </Avatar>

        <h2 className="mt-5 text-xl font-bold tracking-tight">{summary.candidateName}</h2>
        <p className="mt-1 text-sm text-result-cover-foreground/70">
          {context.candidate.studentNumber ?? "Verified candidate"}
        </p>

        <div className="mt-3">
          <Badge variant="outline" className="border-result-cover-foreground/25 bg-result-cover-foreground/10 text-result-cover-foreground">Sitting {summary.attemptNumber}</Badge>
        </div>

        <dl className="mt-6 grid w-full gap-3 border-y border-result-cover-foreground/20 py-4 text-left text-sm">
          <div className="flex items-start justify-between gap-4">
            <dt className="text-result-cover-foreground/60">Current class</dt>
            <dd className="max-w-[65%] text-right font-semibold">{context.candidate.classLabel}</dd>
          </div>
          <div className="flex items-start justify-between gap-4">
            <dt className="text-result-cover-foreground/60">Result reference</dt>
            <dd className="max-w-[65%] truncate text-right font-mono text-xs font-semibold">{summary.attemptId}</dd>
          </div>
        </dl>

        <div className="mt-6 grid w-full grid-cols-2 gap-2 print:hidden">
          <Button type="button" className="bg-result-cover-foreground text-result-cover hover:bg-result-cover-foreground/90" onClick={onDashboard}>Dashboard</Button>
          <Button type="button" variant="outline" className="border-result-cover-foreground/30 bg-transparent text-result-cover-foreground hover:bg-result-cover-foreground/10 hover:text-result-cover-foreground" onClick={() => window.print()}>
            <Printer data-icon="inline-start" />
            Print / Save
          </Button>
        </div>

        <p
          className={cn(
            "mt-3 min-h-5 text-xs",
            refreshStatus === "error" || copyStatus === "error" ? "text-destructive" : "text-result-cover-foreground/65",
          )}
          role={refreshStatus === "error" || copyStatus === "error" ? "alert" : "status"}
          aria-live="polite"
        >
          {actionMessage}
        </p>
      </CardContent>
    </Card>
  );
}

function ScorePanel({ summary }: { summary: ExamResultSummary }) {
  return (
    <section className="animate-result-score border-y border-result-cover-foreground/20 py-6 text-result-cover-foreground" aria-labelledby="result-score-title">
      <p className="text-xs font-bold uppercase tracking-[0.14em] opacity-75">Overall result</p>
      <div className="mt-3 flex items-end justify-between gap-4">
        <div>
          <h2 id="result-score-title" className="text-7xl font-black leading-none tracking-[-0.06em] tabular-nums sm:text-8xl">
            {Math.round(summary.score)}%
          </h2>
          <p className="mt-2 text-sm opacity-80">{summary.correctCount} of {summary.total} correct</p>
        </div>
        <Badge variant="outline" className="border-result-cover-foreground/30 bg-result-cover-foreground/10 text-result-cover-foreground">
          {Math.round(summary.completion)}% complete
        </Badge>
      </div>

      <Progress
        value={summary.completion}
        aria-label={`Completion ${Math.round(summary.completion)}%`}
        className="mt-5 [&_[data-slot=progress-indicator]]:bg-result-cover-foreground [&_[data-slot=progress-track]]:bg-result-cover-foreground/20"
      >
        <ProgressLabel className="text-result-cover-foreground">Paper completion</ProgressLabel>
        <span className="ml-auto text-sm font-semibold tabular-nums">{summary.answeredCount}/{summary.total}</span>
      </Progress>

      <dl className="mt-5 grid grid-cols-3 gap-2">
        <div className="rounded-xl bg-result-cover-foreground/10 p-3">
          <dt className="text-xs opacity-70">Correct</dt>
          <dd className="mt-1 text-xl font-bold tabular-nums">{summary.correctCount}</dd>
        </div>
        <div className="rounded-xl bg-result-cover-foreground/10 p-3">
          <dt className="text-xs opacity-70">Incorrect</dt>
          <dd className="mt-1 text-xl font-bold tabular-nums">{summary.incorrectCount}</dd>
        </div>
        <div className="rounded-xl bg-result-cover-foreground/10 p-3">
          <dt className="text-xs opacity-70">Unanswered</dt>
          <dd className="mt-1 text-xl font-bold tabular-nums">{summary.unansweredCount}</dd>
        </div>
      </dl>
    </section>
  );
}

function ExamActivityTimeline({ summary }: { summary: ExamResultSummary }) {
  const remainingSeconds = Math.max(0, summary.durationSeconds - summary.elapsedSeconds);
  const events = [
    {
      key: "started",
      icon: Clock3,
      tone: "border-info-border bg-info text-info-foreground",
      title: "Exam started",
      detail: formatDateTime(summary.startedAt),
    },
    {
      key: "answered",
      icon: BookOpenCheck,
      tone: "border-success-border bg-success text-success-foreground",
      title: "Questions completed",
      detail: `${summary.answeredCount} of ${summary.total} answered`,
    },
    {
      key: "time",
      icon: Activity,
      tone: "border-warning-border bg-warning text-warning-foreground",
      title: "Active writing time",
      detail: `${formatDuration(summary.elapsedSeconds)}${remainingSeconds > 0 ? ` · ${formatDuration(remainingSeconds)} remained` : ""}`,
    },
    {
      key: "submitted",
      icon: FileCheck2,
      tone: "border-result-score/30 bg-result-score/10 text-result-score",
      title: "Exam submitted",
      detail: `${submissionLabel(summary.submissionReason)} · ${formatDateTime(summary.submittedAt)}`,
    },
  ];

  return (
    <section className="animate-result-rise-3 rounded-3xl border bg-card p-5 shadow-sm" aria-labelledby="exam-activity-title">
      <div className="flex items-center gap-2">
        <Activity className="size-5 text-result-activity" aria-hidden="true" />
        <h2 id="exam-activity-title" className="text-base font-bold">Your exam activity</h2>
      </div>
      <p className="mt-1 text-xs leading-5 text-muted-foreground">A simple timeline of your exam from start to submission.</p>

      <ol className="mt-5 grid gap-4">
        {events.map((event, index) => {
          const Icon = event.icon;
          return (
            <li key={event.key} className="relative grid grid-cols-[2.25rem_1fr] gap-3">
              {index < events.length - 1 ? (
                <span className="absolute left-[1.1rem] top-9 h-[calc(100%+0.25rem)] w-px bg-border" aria-hidden="true" />
              ) : null}
              <span className={cn("relative grid size-9 place-items-center rounded-full border", event.tone)}>
                <Icon className="size-4" aria-hidden="true" />
              </span>
              <div className="min-w-0 pt-0.5">
                <p className="text-sm font-semibold">{event.title}</p>
                <p className="mt-0.5 text-xs leading-5 text-muted-foreground">{event.detail}</p>
              </div>
            </li>
          );
        })}
      </ol>
    </section>
  );
}

function SubjectPerformance({ summary }: { summary: ExamResultSummary }) {
  if (!summary.subjectStats.length) {
    return (
      <Alert>
        <CircleAlert />
        <AlertTitle>Subject breakdown not available</AlertTitle>
        <AlertDescription>Your overall result is ready, but a subject-by-subject view is not available for this paper.</AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="grid gap-5">
      {summary.subjectStats.map((subject, index) => (
        <Progress
          key={subject.subjectId}
          value={subject.percent}
          aria-label={`${subject.subject}: ${subject.percent}%`}
          className={subjectTone(index)}
        >
          <ProgressLabel className="font-semibold">{subject.subject}</ProgressLabel>
          <span className="ml-auto text-sm font-semibold tabular-nums">{subject.correct}/{subject.total} · {subject.percent}%</span>
          <p className="w-full text-xs text-muted-foreground">{formatDuration(subject.seconds)} active time</p>
        </Progress>
      ))}
    </div>
  );
}

function AttemptIndicators({ summary }: { summary: ExamResultSummary }) {
  return (
    <Card className="animate-result-rise-4">
      <CardHeader>
        <div className="flex items-center gap-2">
          <Gauge className="size-5 text-result-activity" aria-hidden="true" />
          <CardTitle>How you worked</CardTitle>
        </div>
        <CardDescription>These indicators summarize how you worked through this exam. They are not a class ranking.</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-5">
        <Progress
          value={summary.paceIndex}
          aria-label={`Pace index ${summary.paceIndex}`}
          className="[&_[data-slot=progress-indicator]]:bg-result-activity"
        >
          <ProgressLabel>Working pace</ProgressLabel>
          <span className="ml-auto text-sm font-semibold tabular-nums">{Math.round(summary.paceIndex)}</span>
        </Progress>
        <Progress
          value={summary.reasoningIndex}
          aria-label={`Reasoning index ${summary.reasoningIndex}`}
          className="[&_[data-slot=progress-indicator]]:bg-result-subject"
        >
          <ProgressLabel>Reasoning pattern</ProgressLabel>
          <span className="ml-auto text-sm font-semibold tabular-nums">{Math.round(summary.reasoningIndex)}</span>
        </Progress>
      </CardContent>
    </Card>
  );
}

function PlacementOutcome({ summary }: { summary: ExamResultSummary }) {
  if (!summary.placement) return null;

  return (
    <section
      aria-label="Placement outcome"
      className="animate-result-stamp rounded-3xl border border-result-placement/35 bg-result-placement/12 p-5"
    >
      <div className="flex items-start gap-4">
        <span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-result-placement text-result-placement-foreground shadow-sm">
          <GraduationCap className="size-6" aria-hidden="true" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-xs font-bold uppercase tracking-[0.14em] text-muted-foreground">Placement outcome</p>
          <h2 className="mt-1 text-2xl font-black">{summary.placement.assignedTrack}</h2>
          <p className="mt-1 text-sm text-muted-foreground">Placement confidence {Math.round(summary.placement.confidence)}%</p>
        </div>
      </div>
      <Progress
        value={summary.placement.confidence}
        aria-label={`Placement confidence ${summary.placement.confidence}%`}
        className="mt-5 [&_[data-slot=progress-indicator]]:bg-result-placement"
      >
        <ProgressLabel>Confidence</ProgressLabel>
        <span className="ml-auto text-sm font-semibold tabular-nums">{Math.round(summary.placement.confidence)}%</span>
      </Progress>
    </section>
  );
}

function RecoveryActions({
  onDashboard,
  onRefresh,
}: {
  onDashboard: () => void;
  onRefresh: () => Promise<boolean>;
}) {
  const [status, setStatus] = useState<AsyncActionStatus>("idle");

  async function refresh() {
    setStatus("working");
    const ok = await onRefresh();
    setStatus(ok ? "success" : "error");
  }

  return (
    <div className="grid gap-2 sm:grid-cols-2">
      <Button type="button" onClick={onDashboard}>Return to dashboard</Button>
      <Button type="button" variant="outline" disabled={status === "working"} onClick={() => void refresh()}>
        {status === "working" ? <Spinner data-icon="inline-start" /> : <RefreshCw data-icon="inline-start" />}
        Refresh result
      </Button>
      {status === "success" ? <output className="text-xs text-success-foreground sm:col-span-2">Result refreshed.</output> : null}
      {status === "error" ? <p className="text-xs text-destructive sm:col-span-2" role="alert">Could not refresh the result. Check your connection and try again.</p> : null}
    </div>
  );
}

export function ExamResults({
  context,
  summary,
  onDashboard,
  onRefresh,
}: {
  context: ExamExperienceContext;
  summary: ExamResultSummary;
  onDashboard: () => void;
  onRefresh: () => Promise<boolean>;
}) {
  const period = [context.session.academicSession, context.session.term].filter(Boolean).join(" · ");
  const submittedSubjects = summary.subjectStats.map((subject) => subject.subject);
  const subjectLine = submittedSubjects.length
    ? submittedSubjects.join(" · ")
    : context.subjectNames.length
      ? context.subjectNames.join(" · ")
      : "Examination result";

  return (
    <main className="min-h-dvh bg-result-canvas px-3 py-4 text-foreground sm:px-5 sm:py-6 lg:px-8 print:bg-background print:p-0">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-4">
        <header className="animate-result-rise-1 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between print:hidden">
          <div>
            <Badge variant="outline" className="border-success-border bg-success text-success-foreground">
              <CheckCircle2 data-icon="inline-start" />
              Result ready
            </Badge>
            <p className="mt-2 text-sm text-muted-foreground">Your examination has been submitted and your result is saved.</p>
          </div>
          <p className="max-w-md text-xs leading-5 text-muted-foreground">
            Keep this page for your records, or return to your dashboard when you are done.
          </p>
        </header>

        <article className="animate-result-booklet overflow-hidden rounded-3xl border border-result-paper-edge bg-result-paper shadow-2xl print:rounded-none print:shadow-none">
          <div className="grid min-w-0 lg:grid-cols-[minmax(0,1fr)_1px_minmax(0,1fr)]">
            <section className="min-w-0 bg-result-cover p-5 text-result-cover-foreground sm:p-7 lg:p-9">
              <div className="mb-7 min-w-0">
                <p className="text-xs font-bold uppercase tracking-[0.16em] text-result-cover-foreground/65">{modeLabel(summary.mode)}</p>
                <h1 className="mt-2 break-words text-3xl font-bold leading-tight tracking-tight sm:text-4xl">{summary.sessionTitle}</h1>
                <p className="mt-3 break-words text-sm text-result-cover-foreground/75">{subjectLine}</p>
                {period ? <p className="mt-1 text-xs text-result-cover-foreground/60">{period}</p> : null}
              </div>

              <CandidateResultProfile context={context} summary={summary} onDashboard={onDashboard} onRefresh={onRefresh} />

              <div className="mt-7">
                <ScorePanel summary={summary} />
              </div>

              <dl className="mt-6 grid gap-3 border-t border-result-cover-foreground/20 pt-5 text-xs sm:grid-cols-2">
                <div className="min-w-0">
                  <dt className="text-result-cover-foreground/60">How it ended</dt>
                  <dd className="mt-1 font-semibold">{submissionLabel(summary.submissionReason)}</dd>
                </div>
                <div className="min-w-0">
                  <dt className="text-result-cover-foreground/60">Submitted</dt>
                  <dd className="mt-1 font-semibold">{formatDateTime(summary.submittedAt)}</dd>
                </div>
              </dl>
            </section>

            <div className="hidden bg-result-paper-edge lg:block print:block" aria-hidden="true" />

            <section className="min-w-0 bg-result-paper p-5 text-result-paper-foreground sm:p-7 lg:p-9">
              <div className="animate-result-rise-2">
                <ResultAchievements summary={summary} />
              </div>

              {summary.placement ? <div className="mt-5"><PlacementOutcome summary={summary} /></div> : null}

              <section className="mt-7 border-y border-result-paper-edge py-6" aria-labelledby="subject-performance-title">
                <div className="mb-5 flex min-w-0 flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
                  <div className="min-w-0">
                    <p className="text-xs font-bold uppercase tracking-[0.14em] text-result-secondary">Performance</p>
                    <h2 id="subject-performance-title" className="mt-1 text-xl font-bold">Subject breakdown</h2>
                    <p className="mt-1 break-words text-sm text-muted-foreground">{subjectLine}</p>
                  </div>
                  <Badge variant="secondary" className="w-fit shrink-0">{summary.subjectStats.length} subject{summary.subjectStats.length === 1 ? "" : "s"}</Badge>
                </div>
                <SubjectPerformance summary={summary} />
              </section>

              <div className="mt-6">
                <AttemptIndicators summary={summary} />
              </div>

              <div className="mt-6">
                <ExamActivityTimeline summary={summary} />
              </div>

              <div className="mt-6 flex items-start gap-2 border-t border-result-paper-edge pt-5 text-xs leading-5 text-muted-foreground">
                <FileCheck2 className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
                <p>Your result is saved. Refresh this page if you need the latest copy, or use Print / Save from the first page.</p>
              </div>
            </section>
          </div>
        </article>
      </div>
    </main>
  );
}

export function ExamSubmissionFallback({
  context,
  summary,
  onDashboard,
  onRefresh,
}: {
  context: ExamExperienceContext;
  summary: SubmitSummary;
  onDashboard: () => void;
  onRefresh: () => Promise<boolean>;
}) {
  return (
    <main className="min-h-dvh bg-result-canvas px-3 py-5 sm:px-6 sm:py-8">
      <article className="mx-auto grid w-full max-w-5xl overflow-hidden rounded-3xl border border-result-paper-edge bg-result-paper shadow-2xl lg:grid-cols-[minmax(0,0.9fr)_1px_minmax(0,1.1fr)]">
        <section className="min-w-0 bg-result-cover p-6 text-result-cover-foreground sm:p-8">
          <Badge variant="outline" className="w-fit border-result-cover-foreground/25 bg-result-cover-foreground/10 text-result-cover-foreground">
            <CheckCircle2 data-icon="inline-start" />
            Exam submitted
          </Badge>
          <h1 className="mt-5 break-words text-3xl font-bold tracking-tight">{context.session.title}</h1>
          <p className="mt-2 text-sm text-result-cover-foreground/70">{context.candidate.fullName} · {context.candidate.classLabel}</p>
          <div className="mt-8 border-y border-result-cover-foreground/20 py-6">
            <p className="text-xs font-bold uppercase tracking-[0.14em] text-result-cover-foreground/65">Your score</p>
            <p className="mt-2 text-7xl font-black tracking-[-0.06em] tabular-nums">{Math.round(summary.accuracy)}%</p>
            <p className="mt-3 text-sm text-result-cover-foreground/75">{summary.correctCount} of {summary.total} correct · {Math.round(summary.completion)}% complete</p>
          </div>
        </section>

        <div className="hidden bg-result-paper-edge lg:block" aria-hidden="true" />

        <section className="min-w-0 p-6 sm:p-8">
          <p className="text-xs font-bold uppercase tracking-[0.14em] text-result-secondary">Result</p>
          <h2 className="mt-2 text-2xl font-bold tracking-tight">Your full result is loading</h2>
          <p className="mt-3 max-w-xl text-sm leading-6 text-muted-foreground">
            Your exam has been submitted. Refresh to load the complete result page. This will not submit anything again.
          </p>
          <div className="mt-7 border-t border-result-paper-edge pt-6">
            <RecoveryActions onDashboard={onDashboard} onRefresh={onRefresh} />
          </div>
        </section>
      </article>
    </main>
  );
}
export function ExamLockedResult({
  context,
  score,
  onDashboard,
  onRefresh,
}: {
  context: ExamExperienceContext;
  score: number | null;
  onDashboard: () => void;
  onRefresh: () => Promise<boolean>;
}) {
  return (
    <main className="min-h-dvh bg-result-canvas px-3 py-5 sm:px-6 sm:py-8">
      <article className="mx-auto grid w-full max-w-5xl overflow-hidden rounded-3xl border border-result-paper-edge bg-result-paper shadow-2xl lg:grid-cols-[minmax(0,0.9fr)_1px_minmax(0,1.1fr)]">
        <section className="min-w-0 bg-result-cover p-6 text-result-cover-foreground sm:p-8">
          <Badge variant="outline" className="w-fit border-result-cover-foreground/25 bg-result-cover-foreground/10 text-result-cover-foreground">
            <BookOpenCheck data-icon="inline-start" />
            Exam complete
          </Badge>
          <h1 className="mt-5 break-words text-3xl font-bold tracking-tight">{context.session.title}</h1>
          <p className="mt-2 text-sm text-result-cover-foreground/70">{context.candidate.fullName} · {context.candidate.classLabel}</p>
          {score !== null ? (
            <div className="mt-8 border-y border-result-cover-foreground/20 py-6">
              <p className="text-xs font-bold uppercase tracking-[0.14em] text-result-cover-foreground/65">Your score</p>
              <p className="mt-2 text-7xl font-black tracking-[-0.06em] tabular-nums">{Math.round(score)}%</p>
            </div>
          ) : null}
        </section>

        <div className="hidden bg-result-paper-edge lg:block" aria-hidden="true" />

        <section className="min-w-0 p-6 sm:p-8">
          <p className="text-xs font-bold uppercase tracking-[0.14em] text-result-secondary">Next step</p>
          <h2 className="mt-2 text-2xl font-bold tracking-tight">This exam is complete</h2>
          <p className="mt-3 max-w-xl text-sm leading-6 text-muted-foreground">
            You have finished the sitting currently available to you. If your school gives you another chance, it will appear on your dashboard.
          </p>
          <div className="mt-7 border-t border-result-paper-edge pt-6">
            <RecoveryActions onDashboard={onDashboard} onRefresh={onRefresh} />
          </div>
        </section>
      </article>
    </main>
  );
