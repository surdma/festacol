"use client";

import { useState } from "react";
import {
  Award,
  BookOpenCheck,
  CheckCircle2,
  CircleAlert,
  Clock3,
  FileCheck2,
  GraduationCap,
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
import { Progress, ProgressLabel } from "@/components/ui/progress";
import { Spinner } from "@/components/ui/spinner";
import { cn } from "@/lib/utils";
import type { ExamExperienceContext, ExamMode, ExamResultSummary } from "@/types/exam";

type RefreshStatus = "idle" | "refreshing" | "success" | "error";

interface ResultActionsProps {
  onDashboard: () => void;
  onRefresh: () => Promise<boolean>;
  allowPrint?: boolean;
  compact?: boolean;
}

function formatDuration(totalSeconds: number): string {
  const seconds = Math.max(0, Math.round(totalSeconds));
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const remainder = seconds % 60;
  if (hours) return hours + "h " + minutes + "m";
  if (minutes) return minutes + "m " + remainder + "s";
  return remainder + "s";
}

function formatSubmittedAt(timestamp: number): string {
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
  if (reason === "time-expired") return "Submitted automatically when time ended";
  if (reason === "exam-closed") return "Finalized when the examination closed";
  if (reason === "manual") return "Submitted by you";
  return "Submission recorded";
}

function subjectTone(index: number): string {
  if (index % 3 === 1) return "[&_[data-slot=progress-indicator]]:bg-result-secondary";
  if (index % 3 === 2) return "[&_[data-slot=progress-indicator]]:bg-result-highlight";
  return "[&_[data-slot=progress-indicator]]:bg-result-accent";
}

function strongestSubject(summary: ExamResultSummary) {
  if (!summary.subjectStats.length) return null;
  return summary.subjectStats.reduce((best, current) => current.percent > best.percent ? current : best);
}

function ResultMetric({
  label,
  value,
  emphasis = "neutral",
}: {
  label: string;
  value: string;
  emphasis?: "neutral" | "success" | "warning" | "info";
}) {
  return (
    <div
      className={cn(
        "rounded-xl border px-3 py-2.5",
        emphasis === "neutral" && "bg-card",
        emphasis === "success" && "border-success-border bg-success text-success-foreground",
        emphasis === "warning" && "border-warning-border bg-warning text-warning-foreground",
        emphasis === "info" && "border-info-border bg-info text-info-foreground",
      )}
    >
      <dt className="text-xs font-medium opacity-75">{label}</dt>
      <dd className="mt-1 text-lg font-bold tabular-nums">{value}</dd>
    </div>
  );
}

function ResultActions({ onDashboard, onRefresh, allowPrint = false, compact = false }: ResultActionsProps) {
  const [refreshStatus, setRefreshStatus] = useState<RefreshStatus>("idle");

  async function refresh() {
    setRefreshStatus("refreshing");
    const ok = await onRefresh();
    setRefreshStatus(ok ? "success" : "error");
  }

  return (
    <div className={cn("flex flex-wrap items-center gap-2 print:hidden", compact && "justify-end")}>
      <Button type="button" onClick={onDashboard}>
        Return to dashboard
      </Button>
      <Button type="button" variant="outline" onClick={() => void refresh()} disabled={refreshStatus === "refreshing"}>
        {refreshStatus === "refreshing" ? <Spinner data-icon="inline-start" /> : <RefreshCw data-icon="inline-start" />}
        Refresh result
      </Button>
      {allowPrint ? (
        <Button type="button" variant="outline" onClick={() => window.print()}>
          <Printer data-icon="inline-start" />
          Print / Save
        </Button>
      ) : null}
      {refreshStatus === "success" ? (
        <span className="text-xs text-success-foreground" aria-live="polite">Result refreshed.</span>
      ) : refreshStatus === "error" ? (
        <span className="text-xs text-destructive" role="alert">Could not refresh result. Check your connection and try again.</span>
      ) : null}
    </div>
  );
}

function AchievementStrip({ summary }: { summary: ExamResultSummary }) {
  const strongest = strongestSubject(summary);
  const remainingSeconds = Math.max(0, summary.durationSeconds - summary.elapsedSeconds);
  return (
    <div className="flex flex-wrap gap-2">
      {strongest ? (
        <Badge variant="secondary">
          <Award data-icon="inline-start" />
          Strongest subject · {strongest.subject}
        </Badge>
      ) : null}
      <Badge variant="secondary">
        <BookOpenCheck data-icon="inline-start" />
        {summary.unansweredCount === 0 ? "Every question answered" : Math.round(summary.completion) + "% paper completed"}
      </Badge>
      {remainingSeconds > 0 ? (
        <Badge variant="secondary">
          <TimerReset data-icon="inline-start" />
          {formatDuration(remainingSeconds)} remained
        </Badge>
      ) : null}
    </div>
  );
}

function CandidateHeader({
  context,
  summary,
}: {
  context: ExamExperienceContext;
  summary: ExamResultSummary;
}) {
  return (
    <div className="flex items-center gap-3">
      <Avatar size="lg">
        <AvatarFallback>{initials(summary.candidateName)}</AvatarFallback>
      </Avatar>
      <div className="min-w-0">
        <p className="truncate text-sm font-bold">{summary.candidateName}</p>
        <p className="truncate text-xs text-result-cover-foreground/70">
          {context.candidate.studentNumber ?? "Verified candidate"} · Current class · {context.candidate.classLabel}
        </p>
      </div>
    </div>
  );
}

function SubjectPerformance({ summary }: { summary: ExamResultSummary }) {
  if (!summary.subjectStats.length) {
    return (
      <Card size="sm">
        <CardHeader>
          <CardTitle>Subject performance unavailable</CardTitle>
          <CardDescription>This attempt has no subject-level aggregate to display.</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <div className="grid gap-4">
      {summary.subjectStats.map((subject, index) => (
        <Progress
          key={subject.subjectId}
          value={subject.percent}
          aria-label={subject.subject + ": " + subject.percent + "%"}
          className={subjectTone(index)}
        >
          <ProgressLabel>{subject.subject}</ProgressLabel>
          <span className="ml-auto text-sm tabular-nums text-muted-foreground">{subject.correct}/{subject.total} · {subject.percent}%</span>
          <p className="w-full text-xs text-muted-foreground">{formatDuration(subject.seconds)} active time</p>
        </Progress>
      ))}
    </div>
  );
}

function AttemptIndicators({ summary }: { summary: ExamResultSummary }) {
  return (
    <Card size="sm">
      <CardHeader>
        <CardTitle>Assessment indicators</CardTitle>
        <CardDescription>Pace and reasoning describe this stored attempt. They are not a rank or class comparison.</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-4">
        <Progress
          value={summary.paceIndex}
          aria-label={"Pace index " + summary.paceIndex}
          className="[&_[data-slot=progress-indicator]]:bg-result-secondary"
        >
          <ProgressLabel>Pace</ProgressLabel>
          <span className="ml-auto text-sm tabular-nums text-muted-foreground">{Math.round(summary.paceIndex)}</span>
        </Progress>
        <Progress
          value={summary.reasoningIndex}
          aria-label={"Reasoning index " + summary.reasoningIndex}
          className="[&_[data-slot=progress-indicator]]:bg-result-accent"
        >
          <ProgressLabel>Reasoning</ProgressLabel>
          <span className="ml-auto text-sm tabular-nums text-muted-foreground">{Math.round(summary.reasoningIndex)}</span>
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
      className="animate-result-stamp rounded-2xl border border-result-highlight bg-result-highlight p-4 text-result-highlight-foreground"
    >
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.12em] opacity-75">Placement outcome</p>
          <h2 className="mt-1 text-2xl font-bold">{summary.placement.assignedTrack}</h2>
          <p className="mt-1 text-sm">Placement confidence {Math.round(summary.placement.confidence)}%</p>
        </div>
        <GraduationCap className="size-8" aria-hidden="true" />
      </div>
      <Progress
        value={summary.placement.confidence}
        aria-label={"Placement confidence " + summary.placement.confidence + "%"}
        className="mt-4 [&_[data-slot=progress-indicator]]:bg-result-highlight-foreground [&_[data-slot=progress-track]]:bg-result-highlight-foreground/20"
      >
        <ProgressLabel>Confidence</ProgressLabel>
        <span className="ml-auto text-sm font-semibold tabular-nums text-result-highlight-foreground">{Math.round(summary.placement.confidence)}%</span>
      </Progress>
    </section>
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
  const submittedAt = formatSubmittedAt(summary.submittedAt);
  const score = Math.round(summary.score);
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
        <header className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between print:hidden">
          <div>
            <Badge variant="outline">
              <CheckCircle2 data-icon="inline-start" />
              Result recorded
            </Badge>
            <p className="mt-2 text-sm text-muted-foreground">Your submitted examination has been scored and stored.</p>
          </div>
          <ResultActions onDashboard={onDashboard} onRefresh={onRefresh} allowPrint compact />
        </header>

        <article className="animate-result-booklet overflow-hidden rounded-3xl border border-result-paper-edge bg-result-paper shadow-2xl print:rounded-none print:shadow-none">
          <div className="grid lg:grid-cols-[minmax(0,1fr)_1px_minmax(0,1fr)]">
            <section className="flex min-h-[34rem] flex-col bg-result-cover p-5 text-result-cover-foreground sm:p-7 lg:min-h-[43rem] lg:p-9 print:min-h-0">
              <div className="flex items-start justify-between gap-4">
                <CandidateHeader context={context} summary={summary} />
                <Badge variant="outline" className="border-result-cover-foreground/25 bg-result-cover-foreground/10 text-result-cover-foreground">
                  Attempt {summary.attemptNumber}
                </Badge>
              </div>

              <div className="mt-8">
                <p className="text-xs font-bold uppercase tracking-[0.16em] text-result-cover-foreground/65">{modeLabel(summary.mode)}</p>
                <h1 className="mt-2 max-w-xl text-3xl font-bold leading-tight tracking-tight sm:text-4xl">{summary.sessionTitle}</h1>
                <p className="mt-3 text-sm text-result-cover-foreground/75">{subjectLine}</p>
                {period ? <p className="mt-1 text-xs text-result-cover-foreground/60">{period}</p> : null}
              </div>

              <div className="mt-8 animate-result-score">
                <p className="text-xs font-bold uppercase tracking-[0.16em] text-result-cover-foreground/65">Recorded score</p>
                <div className="mt-2 flex items-end gap-3">
                  <p className="text-7xl font-black leading-none tracking-[-0.06em] tabular-nums sm:text-8xl">{score}%</p>
                  <p className="pb-2 text-sm text-result-cover-foreground/70">{summary.correctCount} of {summary.total} correct</p>
                </div>
              </div>

              <dl className="mt-7 grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-2">
                <ResultMetric label="Answered" value={summary.answeredCount + "/" + summary.total} emphasis="success" />
                <ResultMetric label="Incorrect" value={String(summary.incorrectCount)} emphasis="warning" />
                <ResultMetric label="Unanswered" value={String(summary.unansweredCount)} emphasis="info" />
                <ResultMetric label="Completion" value={Math.round(summary.completion) + "%"} />
              </dl>

              <div className="mt-6">
                <AchievementStrip summary={summary} />
              </div>

              <dl className="mt-auto grid gap-2 border-t border-result-cover-foreground/20 pt-5 text-xs sm:grid-cols-2">
                <div>
                  <dt className="text-result-cover-foreground/60">Submission</dt>
                  <dd className="mt-1 font-semibold">{submissionLabel(summary.submissionReason)}</dd>
                </div>
                <div>
                  <dt className="text-result-cover-foreground/60">Submitted</dt>
                  <dd className="mt-1 font-semibold">{submittedAt}</dd>
                </div>
                <div>
                  <dt className="text-result-cover-foreground/60">Paper</dt>
                  <dd className="mt-1 font-semibold">{summary.questionCount} questions · {formatDuration(summary.durationSeconds)}</dd>
                </div>
                <div>
                  <dt className="text-result-cover-foreground/60">Reference</dt>
                  <dd className="mt-1 truncate font-mono font-semibold">{summary.attemptId}</dd>
                </div>
              </dl>
            </section>

            <div className="hidden bg-result-paper-edge lg:block print:block" aria-hidden="true" />

            <section className="flex min-h-[34rem] flex-col bg-result-paper p-5 text-result-paper-foreground sm:p-7 lg:min-h-[43rem] lg:p-9 print:min-h-0">
              {summary.placement ? (
                <PlacementOutcome summary={summary} />
              ) : (
                <div className="rounded-2xl border border-result-accent/30 bg-result-accent/10 p-4">
                  <p className="text-xs font-bold uppercase tracking-[0.12em] text-result-accent">Examination complete</p>
                  <p className="mt-1 text-sm text-muted-foreground">This is a standard examination result. No placement outcome is attached to this attempt.</p>
                </div>
              )}

              <section className="mt-6" aria-labelledby="subject-performance-title">
                <div className="mb-4 flex items-end justify-between gap-4">
                  <div>
                    <p className="text-xs font-bold uppercase tracking-[0.12em] text-result-secondary">Performance</p>
                    <h2 id="subject-performance-title" className="mt-1 text-xl font-bold">Subject breakdown</h2>
                  </div>
                  <Badge variant="secondary">{summary.subjectStats.length} subject{summary.subjectStats.length === 1 ? "" : "s"}</Badge>
                </div>
                <SubjectPerformance summary={summary} />
              </section>

              <div className="mt-6 grid gap-3 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
                <Card size="sm">
                  <CardHeader>
                    <CardTitle>Time used</CardTitle>
                    <CardDescription>{formatDuration(summary.elapsedSeconds)} active time from a {formatDuration(summary.durationSeconds)} paper.</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <Progress
                      value={summary.durationSeconds > 0 ? Math.min(100, (summary.elapsedSeconds / summary.durationSeconds) * 100) : 0}
                      aria-label={"Time used " + formatDuration(summary.elapsedSeconds)}
                      className="[&_[data-slot=progress-indicator]]:bg-result-highlight"
                    >
                      <ProgressLabel>Active time</ProgressLabel>
                      <span className="ml-auto text-sm tabular-nums text-muted-foreground">{formatDuration(Math.max(0, summary.durationSeconds - summary.elapsedSeconds))} remained</span>
                    </Progress>
                  </CardContent>
                </Card>
                <AttemptIndicators summary={summary} />
              </div>

              <div className="mt-auto pt-6">
                <Alert>
                  <FileCheck2 />
                  <AlertTitle>Aggregate result only</AlertTitle>
                  <AlertDescription>
                    Festacol shows your stored score and subject aggregates here. Correct answer keys and per-question marking details are not sent to the candidate screen.
                  </AlertDescription>
                </Alert>
                <div className="mt-4 flex items-center gap-2 text-xs text-muted-foreground">
                  <Clock3 className="size-4" aria-hidden="true" />
                  Result refreshed from the submitted attempt when requested.
                </div>
                <div className="mt-5 border-t border-result-paper-edge pt-5 print:hidden">
                  <ResultActions onDashboard={onDashboard} onRefresh={onRefresh} allowPrint />
                </div>
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
      <article className="mx-auto grid w-full max-w-5xl overflow-hidden rounded-3xl border border-result-paper-edge bg-result-paper shadow-xl lg:grid-cols-2">
        <section className="bg-result-cover p-6 text-result-cover-foreground sm:p-8">
          <Badge variant="outline" className="border-result-cover-foreground/25 bg-result-cover-foreground/10 text-result-cover-foreground">
            <CheckCircle2 data-icon="inline-start" />
            Submission complete
          </Badge>
          <h1 className="mt-5 text-3xl font-bold">{context.session.title}</h1>
          <p className="mt-2 text-sm text-result-cover-foreground/70">{context.candidate.fullName} · Current class · {context.candidate.classLabel}</p>
          <p className="mt-8 text-6xl font-black tabular-nums">{Math.round(summary.accuracy)}%</p>
          <p className="mt-2 text-sm text-result-cover-foreground/70">{summary.correctCount} of {summary.total} correct</p>
          <dl className="mt-8 grid grid-cols-2 gap-2">
            <ResultMetric label="Completion" value={Math.round(summary.completion) + "%"} emphasis="success" />
            <ResultMetric label="Pace" value={String(Math.round(summary.paceIndex))} emphasis="info" />
          </dl>
        </section>
        <section className="flex flex-col p-6 sm:p-8">
          <div className="rounded-2xl border border-result-highlight bg-result-highlight p-4 text-result-highlight-foreground">
            <p className="text-xs font-bold uppercase tracking-[0.12em]">Result details are still loading</p>
            <p className="mt-2 text-sm">Your submission is safely recorded. Festacol could not load the richer stored result yet.</p>
          </div>
          <Alert className="mt-5">
            <CircleAlert />
            <AlertTitle>Nothing needs to be resubmitted</AlertTitle>
            <AlertDescription>Refresh the result to retrieve subject performance and the full attempt record. Your submitted responses remain final.</AlertDescription>
          </Alert>
          <div className="mt-auto pt-8">
            <ResultActions onDashboard={onDashboard} onRefresh={onRefresh} />
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
      <article className="mx-auto grid w-full max-w-5xl overflow-hidden rounded-3xl border border-result-paper-edge bg-result-paper shadow-xl lg:grid-cols-2">
        <section className="bg-result-cover p-6 text-result-cover-foreground sm:p-8">
          <Badge variant="outline" className="border-result-cover-foreground/25 bg-result-cover-foreground/10 text-result-cover-foreground">
            <BookOpenCheck data-icon="inline-start" />
            Attempt complete
          </Badge>
          <h1 className="mt-5 text-3xl font-bold">{context.session.title}</h1>
          <p className="mt-2 text-sm text-result-cover-foreground/70">{context.candidate.fullName} · Current class · {context.candidate.classLabel}</p>
          {score !== null ? (
            <div className="mt-8">
              <p className="text-xs font-bold uppercase tracking-[0.12em] text-result-cover-foreground/65">Recorded score</p>
              <p className="mt-2 text-6xl font-black tabular-nums">{Math.round(score)}%</p>
            </div>
          ) : null}
        </section>
        <section className="flex flex-col p-6 text-result-paper-foreground sm:p-8">
          <div className="rounded-2xl border border-result-accent/30 bg-result-accent/10 p-4">
            <p className="text-xs font-bold uppercase tracking-[0.12em] text-result-accent">No further attempt available</p>
            <p className="mt-2 text-sm text-muted-foreground">This attempt has been consumed. A retake can only be made available by authorized staff when the examination policy permits one.</p>
          </div>
          <Alert className="mt-5">
            <FileCheck2 />
            <AlertTitle>Looking for the detailed result?</AlertTitle>
            <AlertDescription>Refresh to retrieve the stored Folded Result Booklet if the result service is available.</AlertDescription>
          </Alert>
          <div className="mt-auto pt-8">
            <ResultActions onDashboard={onDashboard} onRefresh={onRefresh} />
          </div>
        </section>
      </article>
    </main>
  );
}
