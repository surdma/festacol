"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  CircleAlert,
  Cloud,
  CloudOff,
  Flag,
  ListChecks,
  Menu,
  RotateCcw,
  Save,
  Send,
  TriangleAlert,
  Wifi,
} from "lucide-react";
import { getExamResultAction } from "@/app/actions/exam-experience";
import { getExamResumeMetricsAction } from "@/app/actions/exam-resume";
import { getExamPaperAction, saveProgressAction, submitExamAction, type SubmitSummary } from "@/app/actions/exam-state";
import { ExamStatusWatch } from "@/components/exam-status-watch";
import { ExamCameraPanel } from "@/components/exam/exam-camera-panel";
import { ExamPreflight, type ExamPreflightStage } from "@/components/exam/exam-preflight";
import { ExamQuestionNavigator } from "@/components/exam/exam-question-navigator";
import { ExamResults } from "@/components/exam/exam-results";
import { QuestionCard, responseStatus } from "@/components/exam/question-card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Spinner } from "@/components/ui/spinner";
import { useExamTimer, useIntegrityRecorder } from "@/hooks/use-exam";
import { useExamCamera } from "@/hooks/use-exam-camera";
import { cn } from "@/lib/utils";
import type { ExamExperienceContext, ExamResultSummary, QuestionDTO } from "@/types/exam";

type Q = Omit<QuestionDTO, "answer">;
type Phase = "preflight" | "loading" | "load-failed" | "exam" | "review" | "processing" | "submission-failed" | "submitted" | "locked";
type SyncStatus = "saved" | "saving" | "pending" | "offline" | "error";
type PersistResult = { ok: true } | { ok: false; error: string };

function formatDuration(seconds: number) {
  const total = Math.max(0, Math.round(seconds));
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const secs = total % 60;
  return hours ? `${hours}:${String(minutes).padStart(2, "0")}:${String(secs).padStart(2, "0")}` : `${minutes}:${String(secs).padStart(2, "0")}`;
}

function SyncIndicator({ status }: { status: SyncStatus }) {
  const content = status === "saving"
    ? { icon: <Spinner className="size-3.5" />, label: "Saving…" }
    : status === "saved"
      ? { icon: <Check className="size-3.5" />, label: "Saved" }
      : status === "offline"
        ? { icon: <CloudOff className="size-3.5" />, label: "Offline" }
        : status === "error"
          ? { icon: <TriangleAlert className="size-3.5" />, label: "Save issue" }
          : { icon: <Cloud className="size-3.5" />, label: "Sync pending" };
  return <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground" aria-live="polite">{content.icon}{content.label}</span>;
}

function ProcessingScreen({ reason }: { reason: "manual" | "time-expired" }) {
  return (
    <main className="mx-auto flex min-h-dvh max-w-xl flex-col items-center justify-center px-5 py-12 text-center" aria-live="polite">
      <Spinner className="size-7" />
      <h1 className="mt-5 text-xl font-semibold">{reason === "time-expired" ? "Time has ended" : "Submitting your examination"}</h1>
      <p className="mt-2 max-w-md text-sm leading-6 text-muted-foreground">
        {reason === "time-expired" ? "Your saved responses are being finalized and submitted automatically." : "Festacol is saving your final responses and completing the submission."} Do not close this window yet.
      </p>
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
  const monitoredResume = Boolean(context.access.activeAttemptId && context.cameraRequired);
  const [phase, setPhase] = useState<Phase>(
    monitoredResume ? "preflight" : context.access.activeAttemptId ? "loading" : noAttemptRemaining ? "locked" : "preflight",
  );
  const [preflightStage, setPreflightStage] = useState<ExamPreflightStage>(monitoredResume ? "readiness" : "overview");
  const [paper, setPaper] = useState<Q[]>([]);
  const [index, setIndex] = useState(0);
  const [responses, setResponses] = useState<Record<string, unknown>>({});
  const [flagged, setFlagged] = useState<string[]>([]);
  const [visited, setVisited] = useState<string[]>([]);
  const [remaining, setRemaining] = useState(session.durationSeconds);
  const [syncStatus, setSyncStatus] = useState<SyncStatus>("saved");
  const [online, setOnline] = useState(true);
  const [cameraSupported, setCameraSupported] = useState(true);
  const [fullscreenSupported, setFullscreenSupported] = useState(true);
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

  const persist = useCallback(async (nextRemaining: number, force = false): Promise<PersistResult> => {
    const pendingSave = saveInFlightRef.current;
    if (pendingSave) {
      const pendingResult = await pendingSave;
      if (!pendingResult.ok) return pendingResult;
      if (!force && lastSavedVersionRef.current === dirtyVersionRef.current) return pendingResult;
    }
    if (!force && lastSavedVersionRef.current === dirtyVersionRef.current) return { ok: true };
    if (typeof navigator !== "undefined" && !navigator.onLine) {
      setSyncStatus("offline");
      return { ok: false, error: "You are offline. Keep this exam open while Festacol waits to reconnect." };
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
          remainingSeconds: Math.max(0, Math.round(nextRemaining)),
          elapsedActiveSeconds: Math.max(0, elapsedRef.current),
          flagged: state.flagged,
        });
        if (!result.ok) {
          setSyncStatus("error");
          setSaveError(result.error);
          return result;
        }
        lastSavedVersionRef.current = version;
        if (dirtyVersionRef.current === version) {
          setSyncStatus("saved");
          setSaveError(null);
        } else {
          setSyncStatus("pending");
        }
        return { ok: true };
      } catch {
        const message = "Your progress could not reach the examination service. Keep this exam open and retry when the connection returns.";
        setSyncStatus(typeof navigator !== "undefined" && !navigator.onLine ? "offline" : "error");
        setSaveError(message);
        return { ok: false, error: message };
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
      const saved = await persist(reason === "time-expired" ? 0 : remainingRef.current, true);
      if (!saved.ok) {
        setProcessingError(reason === "time-expired"
          ? "Time has ended, but Festacol cannot reach the examination service. Reconnect and retry final submission without closing this page."
          : saved.error);
        setPhase("submission-failed");
        return;
      }

      const result = await submitExamAction(session.id, reason);
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

  const timerActive = phase === "exam" || phase === "review";
  const timer = useExamTimer(remaining, () => void submitFinal("time-expired"), timerActive);
  remainingRef.current = timer.remaining;
  const { record: recordIntegrity } = useIntegrityRecorder(timerActive ? session.id : "", {
    focusMonitoring: session.integrityPolicy.focusMonitoring,
    clipboardGuard: session.integrityPolicy.clipboardGuard,
  });

  useEffect(() => {
    if (bootstrappedRef.current) return;
    bootstrappedRef.current = true;
    if (context.access.activeAttemptId && !context.cameraRequired) {
      void loadPaper();
      return;
    }
    if (noAttemptRemaining) {
      void (async () => {
        const hasResult = await fetchRichResult();
        setPhase(hasResult ? "submitted" : "locked");
      })();
    }
  }, [context.access.activeAttemptId, context.cameraRequired, fetchRichResult, loadPaper, noAttemptRemaining]);

  useEffect(() => {
    const syncCapabilities = () => {
      setOnline(navigator.onLine);
      setCameraSupported(Boolean(navigator.mediaDevices?.getUserMedia));
      setFullscreenSupported(Boolean(document.fullscreenEnabled));
    };
    const onOnline = () => {
      setOnline(true);
      if (timerActive) void persist(remainingRef.current, true);
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
    const timeout = window.setTimeout(() => void persist(remainingRef.current), 1200);
    return () => window.clearTimeout(timeout);
  }, [dirtyTick, persist, timerActive]);

  useEffect(() => {
    if (!timerActive) return;
    const save = () => void persist(remainingRef.current, true);
    const interval = window.setInterval(save, 10_000);
    const onVisibilityChange = () => {
      if (document.hidden) save();
    };
    document.addEventListener("visibilitychange", onVisibilityChange);
    return () => {
      window.clearInterval(interval);
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, [persist, timerActive]);

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

  const currentQuestion = paper[index];
  const currentQuestionId = String(currentQuestion?.id ?? "");
  const answeredCount = useMemo(() => paper.filter((question) => responseStatus(question, responses[String(question.id)]) === "answered").length, [paper, responses]);
  const openQuestions = useMemo(() => paper.map((question, itemIndex) => ({ question, itemIndex })).filter(({ question }) => responseStatus(question, responses[String(question.id)]) !== "answered"), [paper, responses]);
  const flaggedSet = useMemo(() => new Set(flagged), [flagged]);

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

  const clearCurrentResponse = useCallback(() => {
    if (!currentQuestionId) return;
    setResponses((current) => ({ ...current, [currentQuestionId]: "" }));
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
        stage={preflightStage}
        onStageChange={(next) => { setError(null); setPreflightStage(next); }}
        camera={camera}
        online={online}
        cameraSupported={cameraSupported}
        fullscreenSupported={fullscreenSupported}
        onStart={() => void startFromFinalCheckpoint()}
        starting={busy}
        error={error}
      />
    );
  }

  if (phase === "loading") {
    return (
      <main className="mx-auto flex min-h-dvh max-w-xl flex-col items-center justify-center px-5 py-12 text-center" role="status" aria-live="polite">
        <Spinner className="size-7" />
        <h1 className="mt-5 text-xl font-semibold">Preparing your examination</h1>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">Festacol is allocating your paper and restoring any saved progress. Do not close this window.</p>
      </main>
    );
  }

  if (phase === "load-failed") {
    return (
      <main className="mx-auto flex min-h-dvh w-full max-w-xl flex-col justify-center gap-5 px-4 py-10 sm:px-6">
        <Alert variant="destructive">
          <CircleAlert />
          <AlertTitle>Examination could not be restored</AlertTitle>
          <AlertDescription>{error ?? "The paper could not be loaded. Your existing attempt has not been submitted."}</AlertDescription>
        </Alert>
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
        {lockedScore !== null ? <p className="mt-5 text-2xl font-semibold tabular-nums">Recorded score: {Math.round(lockedScore)}%</p> : null}
        <p className="mt-3 text-sm leading-6 text-muted-foreground">No further attempt is currently available. Staff must explicitly authorize a retake when the examination policy permits one.</p>
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
        <Alert variant="destructive">
          <CircleAlert />
          <AlertTitle>{processingReason === "time-expired" && timer.remaining === 0 ? "Time ended, submission needs connection" : "Submission not completed"}</AlertTitle>
          <AlertDescription>{failure}</AlertDescription>
        </Alert>
        <div className="mt-5 flex flex-wrap gap-2">
          <Button type="button" onClick={() => void submitFinal(processingReason)}><RotateCcw data-icon="inline-start" />Retry submission</Button>
          {processingReason === "manual" && timer.remaining > 0 ? <Button type="button" variant="outline" onClick={() => setPhase("review")}>Return to review</Button> : null}
        </div>
      </main>
    );
  }

  const timerTone = timer.remaining <= 300 ? "border-destructive/20 bg-destructive/10 text-destructive" : timer.remaining <= 600 ? "border-warning-border bg-warning text-warning-foreground" : "border-border bg-background text-foreground";
  const questionNavigator = (
    <ExamQuestionNavigator
      paper={paper}
      currentIndex={index}
      responses={responses}
      flagged={flagged}
      visited={visited}
      onJump={(nextIndex) => { goToQuestion(nextIndex); setPhase("exam"); }}
    />
  );

  return (
    <div className="min-h-dvh bg-background text-foreground">
      <header className="sticky top-0 z-40 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/85">
        <div className="mx-auto flex min-h-16 w-full max-w-[1600px] items-center gap-3 px-3 py-2 sm:px-5 lg:px-6">
          <div className="min-w-0 flex-1">
            <p className="hidden text-[10px] font-bold uppercase tracking-[0.15em] text-muted-foreground sm:block">Festacol Assessment</p>
            <p className="truncate text-sm font-semibold sm:text-base">{session.title}</p>
            <p className="truncate text-[11px] text-muted-foreground">{context.subjectNames.join(" · ") || context.candidate.classLabel}</p>
          </div>

          <div className="hidden items-center gap-4 md:flex">
            <SyncIndicator status={syncStatus} />
            <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground"><Wifi className="size-3.5" aria-hidden="true" />{online ? "Connected" : "Offline"}</span>
          </div>

          <Sheet>
            <SheetTrigger render={<Button type="button" variant="outline" size="icon-lg" className="xl:hidden" aria-label="Open question navigator" />}>
              <Menu />
            </SheetTrigger>
            <SheetContent side="right" className="w-[min(92vw,24rem)] sm:max-w-md">
              <SheetHeader>
                <SheetTitle>Questions</SheetTitle>
                <SheetDescription>Jump to unanswered or flagged questions without losing your current response.</SheetDescription>
              </SheetHeader>
              <div className="min-h-0 flex-1 px-4 pb-4">{questionNavigator}</div>
            </SheetContent>
          </Sheet>

          <div className={cn("shrink-0 rounded-lg border px-3 py-1.5 text-right", timerTone)}>
            <p className="text-[9px] font-semibold uppercase tracking-[0.12em] opacity-75">Time left</p>
            <p className="font-mono text-base font-semibold leading-5 tabular-nums sm:text-lg" aria-live="off">{timer.format()}</p>
          </div>
        </div>
      </header>

      {timeNotice ? (
        <div className="mx-auto max-w-[1600px] px-3 pt-3 sm:px-5 lg:px-6" aria-live="polite">
          <Alert><CircleAlert /><AlertTitle>{timeNotice}</AlertTitle><AlertDescription>Review your open questions and continue working. The timer remains active.</AlertDescription></Alert>
        </div>
      ) : null}

      <div className="mx-auto max-w-[1600px] px-3 pt-3 sm:px-5 lg:px-6"><ExamStatusWatch sessionId={session.id} /></div>

      {context.cameraRequired ? (
        <div className="mx-auto max-w-[1600px] px-3 pt-3 sm:px-5 lg:px-6 xl:hidden">
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
        </div>
      ) : null}

      {!online || saveError || (context.cameraRequired && camera.status !== "active") ? (
        <div className="mx-auto max-w-[1600px] px-3 pt-3 sm:px-5 lg:px-6">
          <Alert variant={!online || saveError ? "destructive" : "default"}>
            {!online ? <CloudOff /> : context.cameraRequired && camera.status !== "active" ? <TriangleAlert /> : <Save />}
            <AlertTitle>{!online ? "Connection interrupted" : saveError ? "Progress needs to sync" : "Camera attention required"}</AlertTitle>
            <AlertDescription>
              {!online ? "Keep this page open. Your current on-screen answers remain in place and Festacol will retry when the connection returns." : saveError ?? "The required camera is not active. Reconnect it while continuing to keep your exam responses on screen."}
            </AlertDescription>
          </Alert>
        </div>
      ) : null}

      {phase === "exam" ? (
        <div className="mx-auto grid w-full max-w-[1600px] xl:grid-cols-[minmax(0,1fr)_19rem]">
          <main className="min-w-0 px-3 pb-28 pt-5 sm:px-5 sm:pt-7 lg:px-8 xl:px-10">
            {currentQuestion ? (
              <div className="mx-auto w-full max-w-5xl">
                <QuestionCard q={currentQuestion} index={index} total={paper.length} response={responses[currentQuestionId]} onChange={updateResponse} />
              </div>
            ) : (
              <Alert variant="destructive"><AlertTitle>Question unavailable</AlertTitle><AlertDescription>This question could not be rendered. Use the navigator to move to another question.</AlertDescription></Alert>
            )}
          </main>

          <aside className="hidden min-h-0 border-l xl:block" aria-label="Examination utilities">
            <div className="sticky top-16 flex max-h-[calc(100dvh-4rem)] flex-col gap-4 overflow-hidden p-4">
              {context.cameraRequired ? (
                <ExamCameraPanel
                  required
                  status={camera.status}
                  stream={camera.stream}
                  devices={camera.devices}
                  deviceId={camera.deviceId}
                  error={camera.error}
                  onStart={() => void camera.start()}
                  onSelectDevice={(deviceId) => void camera.selectDevice(deviceId)}
                />
              ) : null}
              <div className="min-h-0 flex-1">{questionNavigator}</div>
              <Button type="button" variant="outline" size="lg" onClick={() => setPhase("review")}>
                <ListChecks data-icon="inline-start" />Review & submit
              </Button>
            </div>
          </aside>

          <div className="fixed inset-x-0 bottom-0 z-30 border-t bg-background/95 px-3 py-2.5 backdrop-blur supports-[backdrop-filter]:bg-background/90 sm:px-5 xl:right-[19rem]">
            <div className="mx-auto flex max-w-5xl flex-wrap items-center gap-2">
              <Button type="button" variant="outline" size="lg" disabled={index === 0} onClick={() => goToQuestion(index - 1)}>
                <ArrowLeft data-icon="inline-start" /><span className="hidden sm:inline">Previous</span>
              </Button>
              <Button type="button" variant={flaggedSet.has(currentQuestionId) ? "secondary" : "outline"} size="lg" onClick={toggleCurrentFlag} aria-pressed={flaggedSet.has(currentQuestionId)}>
                <Flag data-icon="inline-start" />{flaggedSet.has(currentQuestionId) ? "Flagged" : "Flag"}
              </Button>
              <Button type="button" variant="ghost" size="lg" disabled={!currentQuestion || responseStatus(currentQuestion, responses[currentQuestionId]) === "unanswered"} onClick={clearCurrentResponse}>Clear</Button>
              <div className="ml-auto flex gap-2">
                {index < paper.length - 1 ? (
                  <Button type="button" size="lg" onClick={() => goToQuestion(index + 1)}>Next<ArrowRight data-icon="inline-end" /></Button>
                ) : (
                  <Button type="button" size="lg" onClick={() => setPhase("review")}><ListChecks data-icon="inline-start" />Review answers</Button>
                )}
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {phase === "review" ? (
        <main className="mx-auto w-full max-w-5xl px-4 py-7 sm:px-6 sm:py-10">
          <div className="flex flex-col gap-6 lg:grid lg:grid-cols-[minmax(0,1fr)_18rem] lg:items-start">
            <section aria-labelledby="submission-review-title">
              <p className="text-sm font-semibold text-muted-foreground">Submission review</p>
              <h1 id="submission-review-title" className="mt-2 text-2xl font-semibold tracking-tight sm:text-3xl">Check unresolved questions before you submit.</h1>
              <p className="mt-3 max-w-2xl text-sm leading-6 text-muted-foreground">Submission is final. Use the lists below to jump directly to questions that still need attention, or return to the exam and continue normally.</p>

              <div className="mt-7 grid grid-cols-3 gap-4 border-y py-5">
                <div><p className="text-xs text-muted-foreground">Answered</p><p className="mt-1 text-xl font-semibold tabular-nums">{answeredCount}/{paper.length}</p></div>
                <div><p className="text-xs text-muted-foreground">Open</p><p className="mt-1 text-xl font-semibold tabular-nums">{openQuestions.length}</p></div>
                <div><p className="text-xs text-muted-foreground">Flagged</p><p className="mt-1 text-xl font-semibold tabular-nums">{flagged.length}</p></div>
              </div>

              <section className="mt-7" aria-labelledby="unanswered-title">
                <h2 id="unanswered-title" className="text-sm font-semibold">Unanswered or incomplete</h2>
                {openQuestions.length ? (
                  <div className="mt-3 flex flex-wrap gap-2">
                    {openQuestions.map(({ question, itemIndex }) => <Button key={question.id} type="button" variant="outline" size="sm" onClick={() => { goToQuestion(itemIndex); setPhase("exam"); }}>Question {itemIndex + 1}</Button>)}
                  </div>
                ) : <p className="mt-2 text-sm text-muted-foreground">Every question has a complete response.</p>}
              </section>

              <section className="mt-6" aria-labelledby="flagged-title">
                <h2 id="flagged-title" className="text-sm font-semibold">Flagged for review</h2>
                {flagged.length ? (
                  <div className="mt-3 flex flex-wrap gap-2">
                    {paper.map((question, itemIndex) => flaggedSet.has(String(question.id)) ? <Button key={question.id} type="button" variant="outline" size="sm" onClick={() => { goToQuestion(itemIndex); setPhase("exam"); }}><Flag data-icon="inline-start" />Question {itemIndex + 1}</Button> : null)}
                  </div>
                ) : <p className="mt-2 text-sm text-muted-foreground">No questions are currently flagged.</p>}
              </section>

              <div className="mt-8 flex flex-col-reverse gap-2 border-t pt-5 sm:flex-row sm:items-center sm:justify-between">
                <Button type="button" variant="outline" size="lg" onClick={() => setPhase("exam")}><ArrowLeft data-icon="inline-start" />Return to Exam</Button>
                <AlertDialog>
                  <AlertDialogTrigger render={<Button type="button" size="lg" />}>
                    <Send data-icon="inline-start" />Submit Final Answers
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Submit your final answers?</AlertDialogTitle>
                      <AlertDialogDescription>
                        This action is final. {openQuestions.length ? `${openQuestions.length} question${openQuestions.length === 1 ? " is" : "s are"} still unanswered or incomplete. ` : ""}You have {formatDuration(timer.remaining)} remaining.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Keep reviewing</AlertDialogCancel>
                      <AlertDialogAction onClick={() => void submitFinal("manual")}>Submit Final Answers</AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
            </section>

            <aside className="rounded-xl border bg-muted/20 p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">Before submitting</p>
              <ul className="mt-3 flex flex-col gap-2 text-sm leading-6 text-muted-foreground">
                <li>Confirm every response you want marked is visible in the navigator.</li>
                <li>Flagging a question does not remove its answer.</li>
                <li>Unanswered questions remain unanswered after final submission.</li>
                <li>The timer continues while you review.</li>
              </ul>
            </aside>
          </div>
        </main>
      ) : null}
    </div>
  );
}
