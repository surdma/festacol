"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  getCleanupOverviewAction,
  listCleanupOptionsAction,
  previewCleanupAction,
  runCleanupChunkAction,
  type CleanupFilter,
  type CleanupKind,
  type CleanupOptionLists,
  type CleanupOverview,
  type CleanupPreview,
} from "@/app/actions/admin-data-controls";
import { toast } from "@/components/ui/toast";

export interface MaintenanceFeedback {
  tone: "success" | "error";
  message: string;
}

export interface MaintenanceProgress {
  done: number;
  total: number;
  label: string;
}

export function kindTitle(kind: CleanupKind) {
  if (kind === "attempts") return "Student results";
  if (kind === "sessions") return "Exam sessions";
  if (kind === "staff-questions") return "Staff-written questions";
  if (kind === "whatsapp") return "WhatsApp links";
  return "Check-in events";
}

export function useSchoolDataMaintenance() {
  const [activeKind, setActiveKind] = useState<CleanupKind | null>(null);
  const [queuedKinds, setQueuedKinds] = useState<CleanupKind[]>([]);
  const [feedback, setFeedback] = useState<MaintenanceFeedback | null>(null);
  const [progress, setProgress] = useState<MaintenanceProgress | null>(null);
  const [overview, setOverview] = useState<CleanupOverview | null>(null);
  const [overviewLoading, setOverviewLoading] = useState(true);
  const [options, setOptions] = useState<CleanupOptionLists | null>(null);
  const [previews, setPreviews] = useState<Record<string, CleanupPreview & { loading?: boolean }>>({});
  const queue = useRef<Promise<void>>(Promise.resolve());
  const busy = useRef<Set<CleanupKind>>(new Set());

  const refreshOverview = useCallback(async () => {
    const result = await getCleanupOverviewAction();
    if (result.ok && result.overview) setOverview(result.overview);
    setOverviewLoading(false);
    return result;
  }, []);

  const refreshOptions = useCallback(async () => {
    const result = await listCleanupOptionsAction();
    if (result.ok && result.options) setOptions(result.options);
    return result;
  }, []);

  useEffect(() => {
    void refreshOverview();
    void refreshOptions();
  }, [refreshOverview, refreshOptions]);

  const previewKey = useCallback((kind: CleanupKind, filter: CleanupFilter) => `${kind}:${JSON.stringify(filter)}`, []);

  const loadPreview = useCallback(async (kind: CleanupKind, filter: CleanupFilter) => {
    const key = previewKey(kind, filter);
    setPreviews((current) => ({ ...current, [key]: { total: current[key]?.total ?? 0, loading: true } }));
    const result = await previewCleanupAction(kind, filter);
    if (result.ok && result.preview) {
      setPreviews((current) => ({ ...current, [key]: { ...result.preview!, loading: false } }));
    } else {
      setPreviews((current) => {
        const next = { ...current };
        delete next[key];
        return next;
      });
      toast.add({
        type: "error",
        title: "Estimate unavailable",
        description: result.error ?? "The estimate could not be loaded.",
        priority: "high",
      });
    }
    return result;
  }, [previewKey]);

  const runJob = useCallback(async (kind: CleanupKind, filter: CleanupFilter, label: string) => {
    setActiveKind(kind);
    setQueuedKinds((current) => current.filter((item) => item !== kind));
    // Estimates for this area go stale the moment deletes begin.
    setPreviews((current) => {
      const next = { ...current };
      for (const key of Object.keys(next)) if (key.startsWith(`${kind}:`)) delete next[key];
      return next;
    });
    setFeedback(null);
    let removed = 0;
    let skipped = 0;
    try {
      // Prime the progress bar from the cached estimate when available.
      const cached = (await previewCleanupAction(kind, filter)).preview;
      let total = cached?.total ?? null;
      const render = (done: number) => {
        const known = total ?? Math.max(done, 1);
        setProgress({ done, total: known, label: `${label}… ${done.toLocaleString()} of ${known.toLocaleString()}` });
      };
      render(0);
      for (;;) {
        const result = await runCleanupChunkAction(kind, filter);
        if (!result.ok || !result.chunk) throw new Error(result.error ?? "The clean-up step could not be completed.");
        removed += result.chunk.deleted;
        skipped += result.chunk.skipped;
        if (total === null || result.chunk.total > total) total = result.chunk.total;
        if (result.chunk.done) {
          render(total ?? removed);
          break;
        }
        render(removed);
      }
      await refreshOverview();
      const skippedNote = skipped > 0 ? ` ${skipped.toLocaleString()} skipped (still in use).` : "";
      const message = `${removed.toLocaleString()} records cleared.${skippedNote}`;
      setFeedback({ tone: "success", message });
      toast.add({ type: "success", title: `${kindTitle(kind)} cleaned up`, description: message });
    } catch (error) {
      const message = error instanceof Error ? error.message : "The selected records could not be cleared.";
      setFeedback({ tone: "error", message });
      toast.add({ type: "error", title: "Clean-up failed", description: message, priority: "high" });
      await refreshOverview();
    } finally {
      setProgress(null);
      setActiveKind(null);
      busy.current.delete(kind);
    }
  }, [refreshOverview]);

  const clear = useCallback((kind: CleanupKind, filter: CleanupFilter, label: string) => {
    if (busy.current.has(kind)) return;
    busy.current.add(kind);
    setQueuedKinds((current) => (current.includes(kind) ? current : [...current, kind]));
    queue.current = queue.current.then(() => runJob(kind, filter, label), () => runJob(kind, filter, label));
  }, [runJob]);

  return {
    activeKind,
    queuedKinds,
    feedback,
    progress,
    overview,
    overviewLoading,
    options,
    previews,
    previewKey,
    loadPreview,
    refreshOverview,
    clear,
  };
}
