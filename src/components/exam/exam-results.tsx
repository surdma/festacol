"use client";

import { CheckCircle2, Clock3, FileCheck2, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Progress, ProgressLabel } from "@/components/ui/progress";
import type { ExamResultSummary } from "@/types/exam";

function formatDuration(totalSeconds: number): string {
  const seconds = Math.max(0, Math.round(totalSeconds));
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  if (hours) return hours + "h " + minutes + "m";
  return minutes + "m " + (seconds % 60) + "s";
}

export function ExamResults({
  title,
  subjectNames,
  summary,
  onDashboard,
}: {
  title: string;
  subjectNames: string[];
  summary: ExamResultSummary;
  onDashboard: () => void;
}) {
  const submittedAt = new Date(summary.submittedAt).toLocaleString();
  const score = Math.round(summary.score);

  return (
    <main className="mx-auto w-full max-w-5xl px-4 py-6 sm:px-6 sm:py-10">
      <section className="border-b pb-6">
        <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <div className="mb-3 flex size-10 items-center justify-center rounded-full bg-success text-success-foreground">
              <CheckCircle2 className="size-5" aria-hidden="true" />
            </div>
            <p className="text-sm font-semibold text-muted-foreground">Submission complete</p>
            <h1 className="mt-1 text-2xl font-semibold tracking-tight sm:text-3xl">{title}</h1>
            <p className="mt-2 text-sm text-muted-foreground">
              {subjectNames.length ? subjectNames.join(" · ") : "Examination result"} · Submitted {submittedAt}
            </p>
          </div>
          <div className="shrink-0 rounded-2xl border bg-primary/5 px-5 py-4 sm:min-w-40 sm:text-right">
            <p className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">Overall score</p>
            <p className="mt-1 text-3xl font-semibold tabular-nums">{score}%</p>
            <p className="mt-1 text-xs text-muted-foreground">{summary.correctCount} of {summary.total} correct</p>
          </div>
        </div>
        <div className="mt-5 flex flex-wrap gap-x-5 gap-y-2 text-xs text-muted-foreground">
          <span className="inline-flex items-center gap-1.5"><FileCheck2 className="size-3.5" aria-hidden="true" />Reference {summary.attemptId}</span>
          <span className="inline-flex items-center gap-1.5"><Clock3 className="size-3.5" aria-hidden="true" />Active time {formatDuration(summary.elapsedSeconds)}</span>
        </div>
      </section>

      <section className="pt-6" aria-labelledby="performance-overview-title">
        <h2 id="performance-overview-title" className="text-lg font-semibold">Performance overview</h2>
        <p className="mt-1 text-sm text-muted-foreground">Scores shown here are calculated and stored by the examination service after submission.</p>

        <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-2xl border bg-card p-4">
            <p className="text-xs text-muted-foreground">Answered</p>
            <p className="mt-1 text-xl font-semibold tabular-nums">{summary.answeredCount}/{summary.total}</p>
          </div>
          <div className="rounded-2xl border bg-card p-4">
            <p className="text-xs text-muted-foreground">Incorrect</p>
            <p className="mt-1 text-xl font-semibold tabular-nums">{summary.incorrectCount}</p>
          </div>
          <div className="rounded-2xl border bg-card p-4">
            <p className="text-xs text-muted-foreground">Unanswered</p>
            <p className="mt-1 text-xl font-semibold tabular-nums">{summary.unansweredCount}</p>
          </div>
          <div className="rounded-2xl border bg-card p-4">
            <p className="text-xs text-muted-foreground">Completion</p>
            <p className="mt-1 text-xl font-semibold tabular-nums">{Math.round(summary.completion)}%</p>
          </div>
        </div>

        {summary.placement ? (
          <section className="mt-7 rounded-2xl border bg-muted/20 p-4" aria-label="Placement outcome">
            <p className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">Placement outcome</p>
            <p className="mt-2 text-lg font-semibold">{summary.placement.assignedTrack}</p>
            <p className="mt-1 text-sm tabular-nums text-muted-foreground">Confidence {summary.placement.confidence}%</p>
          </section>
        ) : null}

        <section className="mt-8" aria-labelledby="subject-performance-title">
          <h2 id="subject-performance-title" className="text-lg font-semibold">Performance by subject</h2>
          <p className="mt-1 text-sm text-muted-foreground">Only aggregate performance is shown to the student; answer keys are never sent to the candidate client.</p>
          {summary.subjectStats.length ? (
            <div className="mt-5 grid gap-5 lg:grid-cols-2">
              {summary.subjectStats.map((subject) => (
                <Progress key={subject.subjectId} value={subject.percent} aria-label={subject.subject + ": " + subject.percent + "%"}>
                  <ProgressLabel>{subject.subject}</ProgressLabel>
                  <span className="ml-auto text-xs tabular-nums text-muted-foreground">{subject.correct}/{subject.total} · {subject.percent}%</span>
                  <p className="w-full text-xs text-muted-foreground">{formatDuration(subject.seconds)} active time</p>
                </Progress>
              ))}
            </div>
          ) : (
            <p className="mt-4 rounded-xl border border-dashed p-4 text-sm text-muted-foreground">Subject-level performance is not available for this attempt.</p>
          )}
        </section>

        <section className="mt-8 border-t pt-5">
          <h2 className="text-sm font-semibold">Assessment indicators</h2>
          <div className="mt-3 grid gap-4 sm:grid-cols-2">
            <Progress value={summary.paceIndex} aria-label={"Pace index " + summary.paceIndex}>
              <ProgressLabel>Pace</ProgressLabel>
              <span className="ml-auto text-xs tabular-nums text-muted-foreground">{Math.round(summary.paceIndex)}</span>
            </Progress>
            <Progress value={summary.reasoningIndex} aria-label={"Reasoning index " + summary.reasoningIndex}>
              <ProgressLabel>Reasoning</ProgressLabel>
              <span className="ml-auto text-xs tabular-nums text-muted-foreground">{Math.round(summary.reasoningIndex)}</span>
            </Progress>
          </div>
        </section>
      </section>

      <div className="mt-8 flex flex-wrap gap-2 border-t pt-5">
        <Button type="button" onClick={onDashboard}>Return to dashboard</Button>
        <Button type="button" variant="outline" onClick={() => window.location.reload()}>
          <RotateCcw data-icon="inline-start" />
          Refresh result
        </Button>
      </div>
    </main>
  );
}
