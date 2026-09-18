"use client";

import { BookOpenCheck, CheckCircle2, RefreshCw } from "lucide-react";
import { useState } from "react";
import type { SubmitSummary } from "@/app/actions/exam-state";
import { ExamResultDestination } from "@/components/exam/exam-result-destination";
import { ExamResultSummarySection } from "@/components/exam/exam-result-summary";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import type { ExamExperienceContext, ExamResultSummary } from "@/types/exam";

type AsyncActionStatus = "idle" | "working" | "success" | "error";

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
      <Button type="button" onClick={onDashboard}>
        Return to dashboard
      </Button>
      <Button
        type="button"
        variant="outline"
        disabled={status === "working"}
        onClick={() => void refresh()}
      >
        {status === "working" ? (
          <Spinner data-icon="inline-start" />
        ) : (
          <RefreshCw data-icon="inline-start" />
        )}
        Refresh result
      </Button>
      {status === "success" ? (
        <output className="text-xs text-success-foreground sm:col-span-2">
          Result refreshed.
        </output>
      ) : null}
      {status === "error" ? (
        <p className="text-xs text-destructive sm:col-span-2" role="alert">
          Could not refresh the result. Check your connection and try again.
        </p>
      ) : null}
    </div>
  );
}

export function ExamResults({
  view,
  summary,
  onDashboard,
  onRefresh,
}: {
  view: "completion" | "full";
  summary: ExamResultSummary;
  onDashboard: () => void;
  onRefresh: () => Promise<boolean>;
}) {
  if (view === "full") {
    return (
      <ExamResultSummarySection
        summary={summary}
        onDashboard={onDashboard}
        onRefresh={onRefresh}
      />
    );
  }

  return (
    <main className="grid min-h-dvh place-items-center bg-result-canvas px-4 py-8 text-foreground sm:px-6">
      <div className="w-full max-w-2xl">
        <ExamResultDestination summary={summary} onDashboard={onDashboard} />
      </div>
    </main>
  );
}

export function ExamSubmissionFallback({
  context,
  summary: _summary,
  onDashboard,
  onRefresh,
}: {
  context: ExamExperienceContext;
  summary: SubmitSummary;
  onDashboard: () => void;
  onRefresh: () => Promise<boolean>;
}) {
  return (
    <main className="grid min-h-dvh place-items-center bg-result-canvas px-4 py-8">
      <section className="w-full max-w-xl rounded-[2rem] border bg-card p-6 shadow-xl sm:p-8">
        <Badge
          variant="outline"
          className="border-success-border bg-success text-success-foreground"
        >
          <CheckCircle2 data-icon="inline-start" />
          Exam submitted
        </Badge>
        <h1 className="mt-5 text-2xl font-black tracking-tight">
          Your result is being prepared
        </h1>
        <p className="mt-3 text-sm leading-6 text-muted-foreground">
          {context.session.title} has been submitted successfully. Refresh once
          to load your class or placement destination. Refreshing will not
          submit the examination again.
        </p>
        <div className="mt-6 border-t pt-5">
          <RecoveryActions onDashboard={onDashboard} onRefresh={onRefresh} />
        </div>
      </section>
    </main>
  );
}

export function ExamLockedResult({
  context,
  score: _score,
  onDashboard,
  onRefresh,
}: {
  context: ExamExperienceContext;
  score: number | null;
  onDashboard: () => void;
  onRefresh: () => Promise<boolean>;
}) {
  return (
    <main className="grid min-h-dvh place-items-center bg-result-canvas px-4 py-8">
      <section className="w-full max-w-xl rounded-[2rem] border bg-card p-6 shadow-xl sm:p-8">
        <Badge
          variant="outline"
          className="border-success-border bg-success text-success-foreground"
        >
          <BookOpenCheck data-icon="inline-start" />
          Exam complete
        </Badge>
        <h1 className="mt-5 text-2xl font-black tracking-tight">
          This sitting is complete
        </h1>
        <p className="mt-3 text-sm leading-6 text-muted-foreground">
          {context.session.title} has no active sitting left for this account.
          Refresh to load the saved destination, or return to your dashboard
          for your examination history.
        </p>
        <div className="mt-6 border-t pt-5">
          <RecoveryActions onDashboard={onDashboard} onRefresh={onRefresh} />
        </div>
      </section>
    </main>
  );
}
