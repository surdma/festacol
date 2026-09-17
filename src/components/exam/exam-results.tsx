"use client";

import { CheckCircle2, Clock3, FileCheck2, LockKeyhole, RotateCcw } from "lucide-react";
import { StatusBadge } from "@/components/status-badge";
import { Button } from "@/components/ui/button";
import { Progress, ProgressLabel } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { ExamResultReviewItem, ExamResultSummary } from "@/types/exam";

function formatDuration(totalSeconds: number): string {
  const seconds = Math.max(0, Math.round(totalSeconds));
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  if (hours) return `${hours}h ${minutes}m`;
  return `${minutes}m ${seconds % 60}s`;
}

function formatResponse(value: unknown): string {
  if (value === null || value === undefined || value === "") return "No response";
  if (typeof value === "boolean") return value ? "True" : "False";
  if (Array.isArray(value)) return value.length ? value.map(String).join(", ") : "No response";
  if (typeof value === "object") {
    const values = Object.values(value as Record<string, unknown>).map((item) => String(item ?? "").trim()).filter(Boolean);
    return values.length ? values.join(" · ") : "No response";
  }
  return String(value);
}

function ReviewItem({ item }: { item: ExamResultReviewItem }) {
  const state = item.correct === true ? "correct" : item.correct === false ? "incorrect" : "unanswered";
  return (
    <article className="border-b py-5 last:border-b-0" aria-labelledby={`result-question-${item.questionId}`}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
          <span className="font-semibold text-foreground">Question {item.questionNumber}</span>
          <span aria-hidden="true">·</span>
          <span>{item.subject}</span>
          {item.domain ? <><span aria-hidden="true">·</span><span>{item.domain}</span></> : null}
        </div>
        <StatusBadge tone={state === "correct" ? "emerald" : state === "incorrect" ? "red" : "neutral"}>
          {state === "correct" ? "Correct" : state === "incorrect" ? "Incorrect" : "Unanswered"}
        </StatusBadge>
      </div>
      <h3 id={`result-question-${item.questionId}`} className="mt-3 text-sm font-semibold leading-6 sm:text-base">{item.prompt}</h3>
      <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
        <div className="rounded-lg border bg-muted/20 p-3">
          <dt className="text-xs font-semibold text-muted-foreground">Your response</dt>
          <dd className="mt-1 leading-6">{formatResponse(item.response)}</dd>
        </div>
        <div className="rounded-lg border bg-muted/20 p-3">
          <dt className="text-xs font-semibold text-muted-foreground">Correct response</dt>
          <dd className="mt-1 leading-6">{item.correctAnswer || "Not available"}</dd>
        </div>
      </dl>
      {item.explanation ? (
        <div className="mt-3 border-l-2 pl-3 text-sm leading-6 text-muted-foreground">
          <span className="font-semibold text-foreground">Explanation:</span> {item.explanation}
        </div>
      ) : null}
      <p className="mt-3 text-xs text-muted-foreground">Time on question: {formatDuration(item.seconds)}</p>
    </article>
  );
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
          <div className="shrink-0 rounded-xl border bg-muted/20 px-5 py-4 sm:min-w-40 sm:text-right">
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

      <Tabs defaultValue="overview" className="mt-6">
        <TabsList variant="line" className="w-full justify-start overflow-x-auto">
          <TabsTrigger value="overview" className="min-h-10">Performance</TabsTrigger>
          <TabsTrigger value="review" className="min-h-10">Question review</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="pt-6">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div className="border-b pb-3 sm:border-b-0 sm:border-r sm:pb-0 sm:pr-4">
              <p className="text-xs text-muted-foreground">Answered</p>
              <p className="mt-1 text-xl font-semibold tabular-nums">{summary.answeredCount}/{summary.total}</p>
            </div>
            <div className="border-b pb-3 sm:border-b-0 sm:border-r sm:pb-0 sm:pr-4">
              <p className="text-xs text-muted-foreground">Incorrect</p>
              <p className="mt-1 text-xl font-semibold tabular-nums">{summary.incorrectCount}</p>
            </div>
            <div className="border-b pb-3 sm:border-b-0 lg:border-r lg:pb-0 lg:pr-4">
              <p className="text-xs text-muted-foreground">Unanswered</p>
              <p className="mt-1 text-xl font-semibold tabular-nums">{summary.unansweredCount}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Completion</p>
              <p className="mt-1 text-xl font-semibold tabular-nums">{Math.round(summary.completion)}%</p>
            </div>
          </div>

          {summary.placement ? (
            <section className="mt-7 rounded-xl border bg-muted/20 p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">Placement outcome</p>
              <p className="mt-2 text-lg font-semibold">{summary.placement.assignedTrack}</p>
              <p className="mt-1 text-sm text-muted-foreground">Confidence {summary.placement.confidence}%</p>
            </section>
          ) : null}

          <section className="mt-8" aria-labelledby="subject-performance-title">
            <div className="flex items-end justify-between gap-4">
              <div>
                <h2 id="subject-performance-title" className="text-lg font-semibold">Performance by subject</h2>
                <p className="mt-1 text-sm text-muted-foreground">Correct answers and time are shown for the subjects in this paper.</p>
              </div>
            </div>
            {summary.subjectStats.length ? (
              <div className="mt-5 grid gap-5 lg:grid-cols-2">
                {summary.subjectStats.map((subject) => (
                  <Progress key={subject.subjectId} value={subject.percent} aria-label={`${subject.subject}: ${subject.percent}%`}>
                    <ProgressLabel>{subject.subject}</ProgressLabel>
                    <span className="ml-auto text-xs tabular-nums text-muted-foreground">{subject.correct}/{subject.total} · {subject.percent}%</span>
                    <p className="w-full text-xs text-muted-foreground">{formatDuration(subject.seconds)} active time</p>
                  </Progress>
                ))}
              </div>
            ) : (
              <p className="mt-4 rounded-lg border border-dashed p-4 text-sm text-muted-foreground">Subject-level performance is not available for this attempt.</p>
            )}
          </section>

          <section className="mt-8 border-t pt-5">
            <h2 className="text-sm font-semibold">Assessment indicators</h2>
            <div className="mt-3 grid gap-4 sm:grid-cols-2">
              <Progress value={summary.paceIndex} aria-label={`Pace index ${summary.paceIndex}`}>
                <ProgressLabel>Pace</ProgressLabel>
                <span className="ml-auto text-xs tabular-nums text-muted-foreground">{Math.round(summary.paceIndex)}</span>
              </Progress>
              <Progress value={summary.reasoningIndex} aria-label={`Reasoning index ${summary.reasoningIndex}`}>
                <ProgressLabel>Reasoning</ProgressLabel>
                <span className="ml-auto text-xs tabular-nums text-muted-foreground">{Math.round(summary.reasoningIndex)}</span>
              </Progress>
            </div>
          </section>
        </TabsContent>

        <TabsContent value="review" className="pt-6">
          {summary.canReviewAnswers ? (
            summary.review.length ? (
              <section aria-labelledby="question-review-title">
                <h2 id="question-review-title" className="text-lg font-semibold">Question analysis</h2>
                <p className="mt-1 text-sm text-muted-foreground">Compare your submitted response with the released answer and explanation where available.</p>
                <div className="mt-3">{summary.review.map((item) => <ReviewItem key={item.questionId} item={item} />)}</div>
              </section>
            ) : <p className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">Detailed question results are not available for this attempt.</p>
          ) : (
            <section className="flex gap-3 rounded-xl border bg-muted/20 p-4">
              <LockKeyhole className="mt-0.5 size-5 shrink-0 text-muted-foreground" aria-hidden="true" />
              <div>
                <h2 className="text-sm font-semibold">Answer review has not been released</h2>
                <p className="mt-1 text-sm leading-6 text-muted-foreground">Your score is available, but correct answers remain hidden while the examination is still open. Return after the session closes if answer review is permitted.</p>
              </div>
            </section>
          )}
        </TabsContent>
      </Tabs>

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
