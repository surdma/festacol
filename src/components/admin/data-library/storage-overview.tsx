"use client";

import { useCallback, useEffect, useState } from "react";
import {
  ArrowDownWideNarrow,
  BookOpenCheck,
  CalendarX2,
  FileQuestion,
  Link2,
  ListChecks,
  RefreshCw,
  RotateCcw,
  ShieldCheck,
  TriangleAlert,
} from "lucide-react";
import { getCleanupOverviewAction, type CleanupOverview } from "@/app/actions/admin-data-controls";
import { AdminMetricCard } from "@/components/admin/admin-ui";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";

function fmt(value: number | null) {
  return value === null ? "—" : value.toLocaleString();
}

function detail(parts: (string | null)[]) {
  const shown = parts.filter((part): part is string => part !== null);
  return shown.length ? shown.join(" · ") : "Count unavailable";
}

const SAFE_ORDER = [
  {
    step: "1st",
    title: "Student results, then sessions",
    detail: "Results block session removal, so results are always cleared first — automatically, inside the same run.",
  },
  {
    step: "2nd",
    title: "Used questions are skipped",
    detail: "Marked answers reference their questions. Anything still referenced stays put and is reported as skipped.",
  },
  {
    step: "3rd",
    title: "Open sessions are untouchable",
    detail: "A session that is open may be live in a classroom. It never appears in any clean-up count.",
  },
  {
    step: "Always",
    title: "Prepared content is never listed here",
    detail: "Publishing (first tab) only adds. Clean-up only removes the five areas below — subjects, classes and prepared questions cannot be wiped from here.",
  },
];

export function StorageOverview() {
  const [overview, setOverview] = useState<CleanupOverview | null>(null);
  const [failed, setFailed] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    setRefreshing(true);
    try {
      const result = await getCleanupOverviewAction();
      if (result.ok && result.overview) {
        setOverview(result.overview);
        setFailed(false);
      } else {
        setFailed(true);
      }
    } catch {
      setFailed(true);
    } finally {
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  // Counts go stale after a publish or clean-up run — refresh whenever the tab becomes visible again.
  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState === "visible") void load();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, [load]);

  if (!overview && !failed) {
    return (
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4" aria-label="Loading storage overview">
        {Array.from({ length: 8 }, (_, index) => (
          <Skeleton key={index} className="h-28 rounded-xl" />
        ))}
      </div>
    );
  }

  if (!overview) {
    return (
      <Alert variant="destructive">
        <AlertTitle>Storage overview unavailable</AlertTitle>
        <AlertDescription>Open the Clean-up tab and try again — estimates load per card there.</AlertDescription>
      </Alert>
    );
  }

  const partial =
    overview.sessions.total === null ||
    overview.attempts.total === null ||
    overview.responses === null ||
    overview.integrityEvents === null ||
    overview.staffQuestions === null ||
    overview.preparedQuestions === null ||
    overview.whatsappLinks === null;

  const metric = (value: number | null) => fmt(value);

  return (
    <section aria-labelledby="storage-heading" className="flex flex-col gap-6">
      <h2 id="storage-heading" className="sr-only">What is stored where</h2>

      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs text-muted-foreground">Live from the school records — never hardcoded.</p>
        <Button type="button" size="sm" variant="outline" disabled={refreshing} onClick={() => void load()}>
          <RefreshCw data-icon="inline-start" className={refreshing ? "animate-spin" : undefined} />
          {refreshing ? "Refreshing…" : "Refresh counts"}
        </Button>
      </div>

      {partial ? (
        <Alert variant="destructive">
          <TriangleAlert />
          <AlertTitle>Some counts could not be loaded</AlertTitle>
          <AlertDescription>
            Areas marked “—” failed to report. Other numbers are exact. Try Refresh counts.
          </AlertDescription>
        </Alert>
      ) : null}

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <AdminMetricCard
          label="Exam sessions"
          value={metric(overview.sessions.total)}
          detail={detail([
            overview.sessions.open !== null ? `${fmt(overview.sessions.open)} open` : null,
            overview.sessions.closed !== null ? `${fmt(overview.sessions.closed)} closed` : null,
            overview.sessions.draft !== null ? `${fmt(overview.sessions.draft)} drafts` : null,
          ])}
          icon={CalendarX2}
        />
        <AdminMetricCard
          label="Student results"
          value={metric(overview.attempts.total)}
          detail={detail([
            overview.attempts.submitted !== null ? `${fmt(overview.attempts.submitted)} marked` : null,
            overview.attempts.inProgress !== null ? `${fmt(overview.attempts.inProgress)} unfinished` : null,
          ])}
          icon={RotateCcw}
        />
        <AdminMetricCard
          label="Marked answers"
          value={metric(overview.responses)}
          detail="Cleared automatically with their results"
          icon={FileQuestion}
        />
        <AdminMetricCard
          label="Check-in events"
          value={metric(overview.integrityEvents)}
          detail="Audit trails only — results untouched"
          icon={ListChecks}
        />
        <AdminMetricCard
          label="Staff-written questions"
          value={metric(overview.staffQuestions)}
          detail="Used ones are skipped, never forced"
          icon={BookOpenCheck}
        />
        <AdminMetricCard
          label="Prepared questions"
          value={metric(overview.preparedQuestions)}
          detail="Cannot be wiped from clean-up"
          icon={ShieldCheck}
        />
        <AdminMetricCard
          label="WhatsApp links"
          value={metric(overview.whatsappLinks)}
          detail="Saved group links on classes"
          icon={Link2}
        />
        <AdminMetricCard
          label="Removal safety"
          value="Guarded"
          detail="Open sessions excluded · used kept"
          icon={ArrowDownWideNarrow}
        />
      </div>

      <div className="rounded-2xl border border-border bg-muted/20 p-4 sm:p-5">
        <h3 className="font-display text-base font-extrabold text-foreground">Safe removal order</h3>
        <p className="mt-1 max-w-2xl text-sm leading-6 text-muted-foreground">
          School records link to each other. Clean-up follows this order so a removal never breaks a live record.
        </p>
        <ol className="mt-4 grid gap-3 md:grid-cols-2">
          {SAFE_ORDER.map((item) => (
            <li key={item.title} className="flex items-start gap-3 rounded-xl border border-border bg-card p-3">
              <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-primary/10 font-mono text-[11px] font-bold text-primary">
                {item.step}
              </span>
              <div className="min-w-0">
                <p className="text-sm font-semibold text-foreground">{item.title}</p>
                <p className="mt-0.5 text-xs leading-5 text-muted-foreground">{item.detail}</p>
              </div>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
