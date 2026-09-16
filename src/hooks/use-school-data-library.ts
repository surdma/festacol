"use client";

import { useCallback, useRef, useState } from "react";
import {
  getQuestionBankSyncPlanAction,
  syncQuestionBankBatchAction,
} from "@/app/actions/question-bank";
import {
  getSchoolDataCountsAction,
  loadSchoolDataSourceAction,
  type SchoolDataSource,
} from "@/app/actions/fixture-library";
import { toast } from "@/components/ui/toast";

export interface SchoolDataFeedback {
  source: SchoolDataSource;
  tone: "success" | "error";
  message: string;
}

export interface SchoolDataProgress {
  /** Records written/saved so far. Null while the work is preparing. */
  done: number | null;
  total: number | null;
  label: string;
}

export interface PublishedCounts {
  subjects: number;
  levels?: number;
  classes: number;
  questions: number;
}

function sourceTitle(source: SchoolDataSource) {
  if (source === "subjects") return "Subject list";
  if (source === "academic-structure") return "School session & classes";
  return "Exam questions";
}

// Large enough that thousands of questions finish in a handful of requests —
// each batch is a fixed ~5 bulk writes, not one request per question — while
// still giving visible progress ticks.
const QUESTION_BATCH = 200;

export function useSchoolDataLibrary(initialCounts: PublishedCounts) {
  const [activeSource, setActiveSource] = useState<SchoolDataSource | null>(null);
  const [queuedSources, setQueuedSources] = useState<SchoolDataSource[]>([]);
  const [feedback, setFeedback] = useState<SchoolDataFeedback | null>(null);
  const [progress, setProgress] = useState<SchoolDataProgress | null>(null);
  const [liveCounts, setLiveCounts] = useState<PublishedCounts>(initialCounts);
  // Sequential queue: publishes touch dependent tables, so runs execute one
  // at a time in click order instead of overlapping each other.
  const queue = useRef<Promise<void>>(Promise.resolve());
  const busy = useRef<Set<SchoolDataSource>>(new Set());

  const refreshCounts = useCallback(async () => {
    try {
      const counts = await getSchoolDataCountsAction();
      setLiveCounts((previous) => ({ ...previous, ...counts }));
    } catch {
      // Counts refresh is best-effort; the x/y display updates on next visit.
    }
  }, []);

  const runLoad = useCallback(async (source: SchoolDataSource) => {
    setActiveSource(source);
    setQueuedSources((current) => current.filter((item) => item !== source));
    setFeedback(null);

    try {
      if (source === "question-bank") {
        const plan = await getQuestionBankSyncPlanAction();
        if (!plan.ok || plan.total === undefined) {
          throw new Error(plan.error ?? "The exam questions could not be prepared.");
        }
        const total = plan.total;
        let done = 0;
        setProgress({ done: 0, total, label: `Saving exam questions… 0/${total}` });
        for (let offset = 0; offset < total; offset += QUESTION_BATCH) {
          const batch = await syncQuestionBankBatchAction(offset, QUESTION_BATCH);
          if (!batch.ok) throw new Error(batch.error ?? "The exam questions could not be saved.");
          done = batch.done ?? Math.min(total, offset + QUESTION_BATCH);
          // The batch ack arrives only after the rows are committed, so the
          // x/y below reflects what is actually in the school records — no
          // polling, no realtime subscription needed.
          setProgress({ done, total, label: `Saving exam questions… ${done}/${total}` });
          setLiveCounts((previous) => ({ ...previous, questions: done }));
        }
        await refreshCounts();
        const message = `${done}/${total} exam questions published. Questions written by staff were left untouched.`;
        setFeedback({ source, tone: "success", message });
        toast.add({ type: "success", title: `${sourceTitle(source)} published`, description: message });
      } else {
        setProgress({
          done: null,
          total: null,
          label: source === "subjects" ? "Saving subjects…" : "Saving school session & classes…",
        });
        const result = await loadSchoolDataSourceAction(source);
        if (!result.ok) throw new Error(result.error ?? "The school content could not be published.");
        await refreshCounts();
        const written = typeof result.count === "number" ? result.count : null;
        const message =
          source === "subjects"
            ? `${written !== null ? `${written} subjects published. ` : ""}Class tags are up to date.`
            : `${written !== null ? `${written} classes published. ` : ""}${result.detail ?? "School session is up to date."}`;
        setFeedback({ source, tone: "success", message: message.trim() });
        toast.add({ type: "success", title: `${sourceTitle(source)} published`, description: message.trim() });
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "The school content could not be published.";
      setFeedback({ source, tone: "error", message });
      toast.add({ type: "error", title: `${sourceTitle(source)} was not published`, description: message, priority: "high" });
      await refreshCounts();
    } finally {
      setProgress(null);
      setActiveSource(null);
      busy.current.delete(source);
    }
  }, [refreshCounts]);

  const load = useCallback((source: SchoolDataSource) => {
    // Same section already running or waiting: ignore the double tap.
    if (busy.current.has(source)) return;
    busy.current.add(source);
    setQueuedSources((current) => (current.includes(source) ? current : [...current, source]));
    queue.current = queue.current.then(() => runLoad(source), () => runLoad(source));
  }, [runLoad]);

  const pending = activeSource !== null;

  return { pending, activeSource, queuedSources, feedback, progress, liveCounts, load };
}
