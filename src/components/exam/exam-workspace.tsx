"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Check, CircleAlert, ListChecks, RotateCcw } from "lucide-react";
import { getExamResultAction } from "@/app/actions/exam-experience";
import { getExamResumeMetricsAction } from "@/app/actions/exam-resume";
import { getExamPaperAction, saveProgressAction, submitExamAction, type SaveProgressResult, type SubmitSummary } from "@/app/actions/exam-state";
import { ExamCameraPanel } from "@/components/exam/exam-camera-panel";
import { ExamPreflight } from "@/components/exam/exam-preflight";
import { ExamResults } from "@/components/exam/exam-results";
import { ExamFocusCapsule } from "@/components/exam/exam-focus-capsule";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { useExamTimer, useIntegrityRecorder } from "@/hooks/use-exam";
import { useExamCamera } from "@/hooks/use-exam-camera";
import type { ExamExperienceContext, ExamPaperQuestionDTO, ExamResultSummary } from "@/types/exam";

type Q = ExamPaperQuestionDTO;
type Phase = "preflight" | "loading" | "load-failed" | "exam" | "processing" | "submission-failed" | "submitted" | "locked";
type SyncStatus = "saved" | "saving" | "pending" | "offline" | "error";
type PersistResult = SaveProgressResult;

type BackgroundSnapshot = {
  hiddenAt: number;
  remaining: number;
  elapsed: number;
  questionId: string;
  questionSeconds: number;
};

function ProcessingScreen({ reason }: { reason: "manual" | "time-expired" }) {
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-xl flex-col justify-center px-5 py-12" aria-live="polite">
      <div className="flex items-center gap-3">
        <Spinner className="size-6" />
        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
          {reason === "time-expired" ? "Time ended" : "Submitting"}
        </p>
      </div>
      <h1 className="mt-4 text-2xl font-semibold tracking-tight">{reason === "time-expired" ? "Time has ended" : "Submitting your examination"}</h1>
      <div className="mt-6 border-t pt-5">
        <p className="max-w-md text-sm leading-6 text-muted-foreground">
          {reason === "time-expired" ? "Your saved responses are being finalized and submitted automatically." : "Festacol is saving your final responses and completing the submission."} Do not close this window yet.
        </p>
      </div>
    </main>
  );
}

function SubmissionFallback({ title, summary, onDashboard }: { title: string; summary: SubmitSummary; onDashboard: () => void }) {
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-2xl flex-col justify-center px-4 py-10 sm:px-6">
      <div className="flex size-11 items-center justify-center rounded-full bg-success text-success-foreground"><Check className="size-5" aria-hidden="true" /></div>
      <p className="mt-5 text-sm font-semibold text-muted-foreground">Submission complete</p>
      <h1 className="mt-1 text-2xl font-semibold tracking-tight">{title}</h1>
      <p className="mt-3 text-sm leading-6 text-muted-foreground">Your final responses were received. Detailed result information is temporarily unavailable, but the submission itself is complete.</p>
      <dl className="mt-6 grid grid-cols-2 gap-3 border-y py-5 sm:grid-cols-4">
        <div><dt className="text-xs text-muted-foreground">Score</dt><dd className="mt-1 text-lg font-semibold tabular-nums">{Math.round(summary.accuracy)}%</dd></div>
        <div><dt className="text-xs text-muted-foreground">Correct</dt><dd className="mt-1 text-lg font-semibold tabular-nums">{summary.correctCount}/{summary.total}</dd></div>
        <div><dt className="text-xs text-muted-foreground">Completion</dt><dd className="mt-1 text-lg font-semibold tabular-nums">{Math.round(summary.completion)}%</dd></div>
        <div><dt className="text-xs text-muted-foreground">Pace</dt><dd className="mt-1 text-lg font-semibold tabular-nums">{Math.round(summary.paceIndex)}</dd></div>
      </dl>
      <Button type="button" className="mt-6 self-start" onClick={onDashboard}>Return to dashboard</Button>
    </main>
  );
}

export function ExamWorkspace({ context }: { context: ExamExperienceContext }) {
  const router = useRouter();
  const { session } = context;
  const noAttemptRemaining = !context.access.activeAttemptId && context.access.usedAttempts >= context.access.allowedAttempts;
  const [phase, setPhase] = useState<Phase>(noAttemptRemaining ? "locked" : "preflight");
  const [paper, setPaper] = useState<Q[]>([]);
  const [index, setIndex] = useState(0);
  const [responses, setResponses] = useState<Record<string, unknown>>({});
  const [flagged, setFlagged] = useState<string[]>([]);
  const [visited, setVisited] = useState<string[]>([]);
  const [remaining, setRemaining] = useState(session.durationSeconds);
  const [syncStatus, setSyncStatus] = useState<SyncStatus>("saved");
  const [online, setOnline] = useState(true);
  const [cameraSupported, setCameraSupported] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [processingReason, setProcessingReason] = useState<"manual" | "time-expired">("manual");
  const [processingError, setProcessingError] = useState<string | null>(null);
  const [resultSummary, setResultSummary] = useState<ExamResultSummary | null>(null);
  const [fallbackSummary, setFallbackSummary] = useState<SubmitSummary | null>(null);
  const [lockedScore, setLockedScore] = useState<number | null>(null);
  const [timeNotice, setTimeNotice] = useState<string | null>(null);
  const [dirtyTick, setDirtyTick] = useState(0);
  const [slowLoad, setSlowLoad] = useState(false);

  const camera = useExamCamera(context.cameraRequired);
  const timingsRef = useRef<Record<string, number>>({});
  const elapsedRef = useRef(0);
  const activeTimingRef = useRef<{ qid: string; since: number }>({ qid: "", since: Date.now() });
  const remainingRef = useRef(session.durationSeconds);
  const stateRef = useRef({ responses, index, flagged });
  const dirtyVersionRef = useRef(0);
  const lastSavedVersionRef = useRef(0);
  const saveInFlightRef = useRef<Promise<PersistResult> | null>(null);
  const submittingRef = useRef(false);
  const bootstrappedRef = useRef(false);
  const milestonesRef = useRef(new Set<number>());
  const previousCameraStatusRef = useRef(camera.status);
  const backgroundRef = useRef<BackgroundSnapshot | null>(null);
  stateRef.current = { responses, index, flagged };

  const captureTiming = useCallback((nextQuestionId?: string) => {
    const now = Date.now();
    const current = activeTimingRef.current;
    if (current.qid) {
      timingsRef.current[current.qid] = (timingsRef.current[current.qid] ?? 0) + Math.max(0, (now - current.since) / 1000);
    }
    activeTimingRef.current = { qid: nextQuestionId ?? current.qid, since: now };
  }, []);

  const markDirty = useCallback(() => {
    dirtyVersionRef.current += 1;
    setDirtyTick((value) => value + 1);
    setSyncStatus(typeof navigator !== "undefined" && navigator.onLine ? "pending" : "offline");
  }, []);

  const persist = useCallback(async (force = false): Promise<PersistResult> => {
    const pendingSave = saveInFlightRef.current;
    if (pendingSave) {
      const pendingResult = await pendingSave;
      if (!pendingResult.ok) return pendingResult;
      if (!force && lastSavedVersionRef.current === dirtyVersionRef.current) return pendingResult;
    }
    if (!force && lastSavedVersionRef.current === dirtyVersionRef.current) {
      return {
        ok: true,
        remainingSeconds: remainingRef.current,
        elapsedActiveSeconds: elapsedRef.current,
      };
    }
    if (typeof navigator !== "undefined" && !navigator.onLine) {
      setSyncStatus("offline");
      return {
        ok: false,
        code: "unavailable",
        error: "You are offline. Keep this exam open while Festacol waits to reconnect.",
      };
    }

    captureTiming();
    const version = dirtyVersionRef.current;
    const state = stateRef.current;
    setSyncStatus("saving");
    const operation = (async (): Promise<PersistResult> => {
      try {
        const result = await saveProgressAction(session.id, {
          responses: state.responses,
          currentIndex: state.index,
          questionTimings: timingsRef.current,
          flagged: state.flagged,
        });
        if (!result.ok) {
          setSyncStatus(result.code === "expired" ? "pending" : "error");
          setSaveError(result.error);
          return result;
        }

        // The server clock is authoritative. The browser may only move its
        // displayed timer downward to the trusted value returned by the save.
        const authoritativeRemaining = Math.min(remainingRef.current, result.remainingSeconds);
        remainingRef.current = authoritativeRemaining;
        setRemaining(authoritativeRemaining);
        elapsedRef.current = result.elapsedActiveSeconds;

        lastSavedVersionRef.current = version;
        if (dirtyVersionRef.current === version) {
          setSyncStatus("saved");
          setSaveError(null);
        } else {
          setSyncStatus("pending");
        }
        return result;
      } catch {
        const message = "Your progress could not reach the examination service. Keep this exam open and retry when the connection returns.";
        setSyncStatus(typeof navigator !== "undefined" && !navigator.onLine ? "offline" : "error");
        setSaveError(message);
        return { ok: false, code: "unavailable", error: message };
      }
    })();
    saveInFlightRef.current = operation;
    try {
      return await operation;
    } finally {
      if (saveInFlightRef.current === operation) saveInFlightRef.current = null;
    }
  }, [captureTiming, session.id]);

  const fetchRichResult = useCallback(async () => {
    try {
      const result = await getExamResultAction(session.id);
      if (!result.ok) return false;
      setResultSummary(result.summary);
      return true;
    } catch {
      return false;
    }
  }, [session.id]);

  const loadPaper = useCallback(async () => {
    setBusy(true);
    setError(null);
    setPhase("loading");
    try {
      const result = await getExamPaperAction(session.id);
      if (result.status === "ready") {
        const metrics = await getExamResumeMetricsAction(session.id);
        const currentId = String(result.paper[result.currentIndex]?.id ?? "");
        const hydratedResponses = { ...result.responses };
        if (currentId && !Object.hasOwn(hydratedResponses, currentId)) hydratedResponses[currentId] = "";
        setPaper(result.paper);
        setIndex(result.currentIndex);
        setResponses(hydratedResponses);
        setFlagged(result.flagged);
        setRemaining(result.remainingSeconds);
        remainingRef.current = result.remainingSeconds;
        if (metrics.ok) {
          elapsedRef.current = metrics.elapsedActiveSeconds;
          timingsRef.current = metrics.questionTimings;
        } else {
          setSaveError(metrics.error);
        }
        const visitedIds = new Set([...Object.keys(hydratedResponses), ...result.flagged, currentId].filter(Boolean));
        setVisited([...visitedIds]);
        activeTimingRef.current = { qid: currentId, since: Date.now() };
        dirtyVersionRef.current = 0;
        lastSavedVersionRef.current = 0;
        setSyncStatus("saved");
        setPhase("exam");
        return;
      }
      if (result.status === "locked") {
        setLockedScore(result.score);
        const hasResult = await fetchRichResult();
        setPhase(hasResult ? "submitted" : "locked");
        return;
      }
      setError(result.error);
      setPhase("load-failed");
    } catch {
      setError("The examination paper could not be prepared. Check your connection and retry.");
      setPhase("load-failed");
    } finally {
      setBusy(false);
    }
  }, [fetchRichResult, session.id]);

  const submitFinal = useCallback(async (reason: "manual" | "time-expired") => {
    if (submittingRef.current) return;
    submittingRef.current = true;
    setProcessingReason(reason);
    setProcessingError(null);
    setError(null);
    setPhase("processing");
    captureTiming("");

    try {
      const saved = await persist(true);
      let submissionReason = reason;
      if (!saved.ok) {
        if (saved.code === "expired") {
          submissionReason = "time-expired";
          setProcessingReason("time-expired");
        } else {
          setProcessingError(reason === "time-expired"
            ? "Time has ended, but Festacol cannot reach the examination service. Reconnect and retry final submission without closing this page."
            : saved.error);
          setPhase("submission-failed");
          return;
        }
      }

      const result = await submitExamAction(session.id, submissionReason);
      if (!result.ok || !result.summary) {
        if (result.error?.toLocaleLowerCase("en").includes("already submitted")) {
          const recovered = await fetchRichResult();
          if (recovered) {
            camera.stop();
            setPhase("submitted");
            return;
          }
        }
        setProcessingError(result.error ?? "The final submission was not completed. Retry without closing this page.");
        setPhase("submission-failed");
        return;
      }

      setFallbackSummary(result.summary);
      camera.stop();
      await fetchRichResult();
      setPhase("submitted");
    } catch {
      setProcessingError("The final submission could not reach the examination service. Keep this page open and retry when your connection is stable.");
      setPhase("submission-failed");
    } finally {
      submittingRef.current = false;
    }
  }, [camera, captureTiming, fetchRichResult, persist, session.id]);

  const timerActive = phase === "exam";
  const timer = useExamTimer(remaining, () => void submitFinal("time-expired"), timerActive);
  remainingRef.current = timer.remaining;
  const { record: recordIntegrity } = useIntegrityRecorder(timerActive ? session.id : "", {
    focusMonitoring: session.integrityPolicy.focusMonitoring,
    clipboardGuard: session.integrityPolicy.clipboardGuard,
  });

  useEffect(() => {
    if (bootstrappedRef.current) return;
    bootstrappedRef.current = true;
    if (noAttemptRemaining) {
      void (async () => {
        const hasResult = await fetchRichResult();
        setPhase(hasResult ? "submitted" : "locked");
      })();
    }
  }, [fetchRichResult, noAttemptRemaining]);

  useEffect(() => {
    const timeout = window.setTimeout(() => setSlowLoad(true), 10000);
    return () => window.clearTimeout(timeout);
  }, []);

  useEffect(() => {
    const syncCapabilities = () => {
      setOnline(navigator.onLine);
      setCameraSupported(Boolean(navigator.mediaDevices?.getUserMedia));
    };
    const onOnline = () => {
      setOnline(true);
      if (timerActive && !document.hidden) void persist(true);
    };
    const onOffline = () => {
      setOnline(false);
      setSyncStatus("offline");
    };
    syncCapabilities();
    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);
    return () => {
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
    };
  }, [persist, timerActive]);

  useEffect(() => {
    if (!timerActive) return;
    elapsedRef.current += 1;
  }, [timer.remaining, timerActive]);

  useEffect(() => {
    if (!timerActive || dirtyTick === 0) return;
    const timeout = window.setTimeout(() => {
      if (!document.hidden) void persist();
    }, 1200);
    return () => window.clearTimeout(timeout);
  }, [dirtyTick, persist, timerActive]);

  useEffect(() => {
    if (!timerActive) return;
    const interval = window.setInterval(() => {
      if (!document.hidden) void persist(true);
    }, 10_000);
    return () => window.clearInterval(interval);
  }, [persist, timerActive]);

  useEffect(() => {
    if (!timerActive) {
      backgroundRef.current = null;
      return;
    }
    const onVisibilityChange = () => {
      if (document.hidden) {
        captureTiming();
        const questionId = activeTimingRef.current.qid;
        backgroundRef.current = {
          hiddenAt: Date.now(),
          remaining: remainingRef.current,
          elapsed: elapsedRef.current,
          questionId,
          questionSeconds: questionId ? timingsRef.current[questionId] ?? 0 : 0,
        };
        void persist(true);
        return;
      }

      const snapshot = backgroundRef.current;
      backgroundRef.current = null;
      if (!snapshot) return;
      const wallSeconds = Math.max(0, (Date.now() - snapshot.hiddenAt) / 1000);
      if (wallSeconds < 0.5) return;

      const reconciledRemaining = Math.max(0, snapshot.remaining - wallSeconds);
      remainingRef.current = reconciledRemaining;
      timer.syncRemaining(reconciledRemaining);
      elapsedRef.current = snapshot.elapsed + wallSeconds;
      if (snapshot.questionId) {
        timingsRef.current[snapshot.questionId] = snapshot.questionSeconds + wallSeconds;
        activeTimingRef.current = { qid: snapshot.questionId, since: Date.now() };
      }
      recordIntegrity("background-resume-reconciled", `${Math.round(wallSeconds)}s counted while away`);
      if (reconciledRemaining > 0) void persist(true);
    };
    document.addEventListener("visibilitychange", onVisibilityChange);
    return () => document.removeEventListener("visibilitychange", onVisibilityChange);
  }, [captureTiming, persist, recordIntegrity, timer.syncRemaining, timerActive]);

  useEffect(() => {
    if (!timerActive) return;
    const threshold = [300, 600, 1800].find((value) => timer.remaining <= value && session.durationSeconds > value && !milestonesRef.current.has(value));
    if (!threshold) return;
    milestonesRef.current.add(threshold);
    setTimeNotice(`${Math.round(threshold / 60)} minutes remaining`);
    const timeout = window.setTimeout(() => setTimeNotice(null), 7000);
    return () => window.clearTimeout(timeout);
  }, [session.durationSeconds, timer.remaining, timerActive]);

  useEffect(() => {
    if (!timerActive || !context.cameraRequired) {
      previousCameraStatusRef.current = camera.status;
      return;
    }
    const previous = previousCameraStatusRef.current;
    if (previous === "active" && camera.status === "disconnected") recordIntegrity("camera-ended");
    if (previous !== "active" && camera.status === "active") recordIntegrity("camera-restored");
    previousCameraStatusRef.current = camera.status;
  }, [camera.status, context.cameraRequired, recordIntegrity, timerActive]);

  const goToQuestion = useCallback((nextIndex: number) => {
    if (nextIndex < 0 || nextIndex >= paper.length) return;
    const currentId = String(paper[index]?.id ?? "");
    const nextId = String(paper[nextIndex]?.id ?? "");
    captureTiming(nextId);
    setResponses((current) => {
      let next = current;
      if (currentId && !Object.hasOwn(next, currentId)) next = { ...next, [currentId]: "" };
      if (nextId && !Object.hasOwn(next, nextId)) next = { ...next, [nextId]: "" };
      return next;
    });
    setIndex(nextIndex);
    setVisited((current) => current.includes(nextId) ? current : [...current, nextId]);
    markDirty();
  }, [captureTiming, index, markDirty, paper]);

  const currentQuestionId = String(paper[index]?.id ?? "");

  const updateResponse = useCallback((value: unknown) => {
    if (!currentQuestionId) return;
    setResponses((current) => ({ ...current, [currentQuestionId]: value }));
    markDirty();
  }, [currentQuestionId, markDirty]);

  const toggleCurrentFlag = useCallback(() => {
    if (!currentQuestionId) return;
    setResponses((current) => Object.hasOwn(current, currentQuestionId) ? current : { ...current, [currentQuestionId]: "" });
    setFlagged((current) => current.includes(currentQuestionId) ? current.filter((item) => item !== currentQuestionId) : [...current, currentQuestionId]);
    markDirty();
  }, [currentQuestionId, markDirty]);

  async function startFromFinalCheckpoint() {
    if (!online) {
      setError("Reconnect to the internet before starting this examination.");
      return;
    }
    if (context.cameraRequired && !camera.ready) {
      setError("The required camera must be active before the examination can start.");
      return;
    }
    if (session.integrityPolicy.fullscreenPrompt && document.fullscreenEnabled && !document.fullscreenElement) {
      await document.documentElement.requestFullscreen().catch(() => undefined);
    }
    await loadPaper();
  }

  if (phase === "preflight") {
    return (
      <ExamPreflight
        context={context}
        camera={camera}
        online={online}
        cameraSupported={cameraSupported}
        onStart={() => void startFromFinalCheckpoint()}
        starting={busy}
        error={error}
      />
    );
  }

  if (phase === "loading") {
    return (
      <main className="mx-auto flex min-h-dvh w-full max-w-xl flex-col justify-center px-5 py-12" aria-live="polite">
        <div className="flex items-center gap-3">
          <Spinner className="size-6" />
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">Preparing</p>
        </div>
        <h1 className="mt-4 text-2xl font-semibold tracking-tight">Preparing your examination</h1>
        <div className="mt-6 border-t pt-5">
          <p className="text-sm leading-6 text-muted-foreground">Festacol is allocating your paper and restoring any saved progress. Do not close this window.</p>
          {slowLoad ? (
            <p className="mt-2 text-xs leading-5 text-muted-foreground">
              Still preparing — this is taking longer than usual. Keep this page open while Festacol retries the paper service.
            </p>
          ) : null}
        </div>
      </main>
    );
  }

  if (phase === "load-failed") {
    return (
      <main className="mx-auto flex min-h-dvh w-full max-w-xl flex-col justify-center px-4 py-10 sm:px-6">
        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">Examination paper</p>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight">{session.title}</h1>
        <div className="mb-6 mt-6 border-t pt-6">
          <Alert variant="destructive">
            <CircleAlert />
            <AlertTitle>Examination could not be restored</AlertTitle>
            <AlertDescription>{error ?? "The paper could not be loaded. Your existing attempt has not been submitted."}</AlertDescription>
          </Alert>
        </div>
        {context.cameraRequired ? (
          <ExamCameraPanel
            required
            compact
            status={camera.status}
            stream={camera.stream}
            devices={camera.devices}
            deviceId={camera.deviceId}
            error={camera.error}
            onStart={() => void camera.start()}
            onSelectDevice={(deviceId) => void camera.selectDevice(deviceId)}
          />
        ) : null}
        <div className="flex flex-wrap gap-2">
          <Button type="button" onClick={() => void loadPaper()} disabled={!online || (context.cameraRequired && !camera.ready)}>
            <RotateCcw data-icon="inline-start" />Retry paper restore
          </Button>
          <Button type="button" variant="outline" onClick={() => router.push("/dashboard")}>Return to dashboard</Button>
        </div>
      </main>
    );
  }

  if (phase === "processing") return <ProcessingScreen reason={processingReason} />;

  if (phase === "submitted") {
    if (resultSummary) {
      return <ExamResults title={session.title} subjectNames={context.subjectNames} summary={resultSummary} onDashboard={() => router.push("/dashboard")} />;
    }
    if (fallbackSummary) {
      return <SubmissionFallback title={session.title} summary={fallbackSummary} onDashboard={() => router.push("/dashboard")} />;
    }
  }

  if (phase === "locked") {
    return (
      <main className="mx-auto flex min-h-dvh w-full max-w-xl flex-col justify-center px-4 py-10 sm:px-6">
        <div className="flex size-11 items-center justify-center rounded-full bg-muted"><ListChecks className="size-5" aria-hidden="true" /></div>
        <p className="mt-5 text-sm font-semibold text-muted-foreground">Attempt complete</p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight">{session.title}</h1>
        {lockedScore !== null ? (
          <div className="mt-6 border-y py-4">
            <p className="text-xs text-muted-foreground">Recorded score</p>
            <p className="mt-1 text-2xl font-semibold tabular-nums">{Math.round(lockedScore)}%</p>
          </div>
        ) : null}
        <p className="mt-5 text-sm leading-6 text-muted-foreground">No further attempt is currently available. Staff must explicitly authorize a retake when the examination policy permits one.</p>
        <div className="mt-6 flex flex-wrap gap-2">
          <Button type="button" onClick={() => router.push("/dashboard")}>Return to dashboard</Button>
          <Button type="button" variant="outline" onClick={() => void (async () => { if (await fetchRichResult()) setPhase("submitted"); })()}><RotateCcw data-icon="inline-start" />Refresh result</Button>
        </div>
      </main>
    );
  }

  if (phase === "submission-failed") {
    const failure = processingError ?? error ?? "The examination service could not complete the requested operation.";
    return (
      <main className="mx-auto flex min-h-dvh w-full max-w-xl flex-col justify-center px-4 py-10 sm:px-6">
        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">Final submission</p>
        <h1 className="mb-6 mt-2 text-2xl font-semibold tracking-tight">{session.title}</h1>
        <Alert variant="destructive">
          <CircleAlert />
          <AlertTitle>{processingReason === "time-expired" && timer.remaining === 0 ? "Time ended, submission needs connection" : "Submission not completed"}</AlertTitle>
          <AlertDescription>{failure}</AlertDescription>
        </Alert>
        <div className="mt-6 flex flex-wrap gap-2 border-t pt-5">
          <Button type="button" onClick={() => void submitFinal(processingReason)}><RotateCcw data-icon="inline-start" />Retry submission</Button>
          {processingReason === "manual" && timer.remaining > 0 ? <Button type="button" variant="outline" onClick={() => setPhase("exam")}>Return to exam</Button> : null}
        </div>
      </main>
    );
  }

  if (phase === "exam") {
    return (
      <ExamFocusCapsule
        context={context}
        paper={paper}
        currentIndex={index}
        responses={responses}
        flagged={flagged}
        visited={visited}
        timerText={timer.format()}
        timerRemaining={timer.remaining}
        syncStatus={syncStatus}
        online={online}
        timeNotice={timeNotice}
        saveError={saveError}
        camera={{
          status: camera.status,
          stream: camera.stream,
          devices: camera.devices,
          deviceId: camera.deviceId,
          error: camera.error,
          onStart: () => void camera.start(),
          onSelectDevice: (deviceId) => void camera.selectDevice(deviceId),
        }}
        onJump={goToQuestion}
        onPrevious={() => goToQuestion(index - 1)}
        onNext={() => goToQuestion(index + 1)}
        onToggleFlag={toggleCurrentFlag}
        onChangeResponse={updateResponse}
        onSubmit={() => void submitFinal("manual")}
      />
    );
  }

  return null;

}
