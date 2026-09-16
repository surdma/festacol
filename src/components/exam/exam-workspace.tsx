"use client";

import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { getExamPaperAction, saveProgressAction, submitExamAction, type SubmitSummary } from "@/app/actions/exam-state";
import { ExamStatusWatch } from "@/components/exam-status-watch";
import { QuestionCard, responseStatus } from "@/components/exam/question-card";
import { FadeUp } from "@/components/motion";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { useExamTimer, useIntegrityRecorder } from "@/hooks/use-exam";
import { cn } from "@/lib/utils";
import type { QuestionDTO } from "@/types/exam";

type Q = Omit<QuestionDTO, "answer">;
type Phase = "briefing" | "loading" | "exam" | "review" | "submitted" | "locked";

export function ExamWorkspace({ sessionId, title, durationSeconds }: { sessionId: string; title: string; durationSeconds: number }) {
  const router = useRouter();
  const [phase, setPhase] = useState<Phase>("briefing");
  const [paper, setPaper] = useState<Q[]>([]);
  const [index, setIndex] = useState(0);
  const [responses, setResponses] = useState<Record<string, unknown>>({});
  const [flagged, setFlagged] = useState<string[]>([]);
  const [remaining, setRemaining] = useState(durationSeconds);
  const [cameraRequired, setCameraRequired] = useState(false);
  const [cameraOk, setCameraOk] = useState(false);
  const [summary, setSummary] = useState<SubmitSummary | null>(null);
  const [lockedScore, setLockedScore] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const timingsRef = useRef<Record<string, number>>({});
  const activeRef = useRef<{ qid: string; since: number }>({ qid: "", since: Date.now() });
  const elapsedRef = useRef(0);
  const stateRef = useRef({ responses, index, flagged });
  stateRef.current = { responses, index, flagged };

  const persist = useCallback(async (rem: number) => {
    const state = stateRef.current;
    await saveProgressAction(sessionId, {
      responses: state.responses,
      currentIndex: state.index,
      questionTimings: timingsRef.current,
      remainingSeconds: Math.max(0, Math.round(rem)),
      elapsedActiveSeconds: elapsedRef.current,
      flagged: state.flagged,
    });
  }, [sessionId]);

  const flushTiming = useCallback((qid: string) => {
    const now = Date.now();
    if (activeRef.current.qid) {
      const key = activeRef.current.qid;
      timingsRef.current[key] = (timingsRef.current[key] ?? 0) + (now - activeRef.current.since) / 1000;
    }
    activeRef.current = { qid, since: now };
  }, []);

  function start() {
    setError(null);
    setPhase("loading");
    startTransition(async () => {
      const result = await getExamPaperAction(sessionId);
      if (result.status === "ready") {
        setPaper(result.paper);
        setIndex(result.currentIndex);
        setResponses(result.responses);
        setFlagged(result.flagged);
        setRemaining(result.remainingSeconds);
        setCameraRequired(result.cameraRequired);
        activeRef.current = { qid: String(result.paper[result.currentIndex]?.id ?? ""), since: Date.now() };
        setPhase("exam");
        return;
      }
      if (result.status === "locked") {
        setLockedScore(result.score);
        setPhase("locked");
        return;
      }
      setError(result.error);
      setPhase("briefing");
    });
  }

  const doSubmit = useCallback((reason: string) => {
    startTransition(async () => {
      flushTiming("");
      await persist(0);
      const result = await submitExamAction(sessionId, reason);
      if (result.ok && result.summary) {
        setSummary(result.summary);
        setPhase("submitted");
      } else {
        setError(result.error ?? "Submit failed.");
        setPhase("review");
      }
    });
  }, [sessionId, persist, flushTiming]);

  const timerActive = phase === "exam" || phase === "review";
  const timer = useExamTimer(remaining, () => doSubmit("time-expired"), timerActive);
  useIntegrityRecorder(timerActive ? sessionId : "");
  useEffect(() => { elapsedRef.current += 1; }, [timer.remaining]);

  useEffect(() => {
    if (phase !== "exam" && phase !== "review") return;
    const timerId = setInterval(() => void persist(timer.remaining), 10000);
    return () => clearInterval(timerId);
  }, [phase, persist, timer.remaining]);

  function go(nextIndex: number) {
    flushTiming(String(paper[nextIndex]?.id ?? ""));
    setIndex(nextIndex);
  }

  async function enableCamera() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true });
      stream.getTracks().forEach((track) => track.stop());
      setCameraOk(true);
    } catch {
      setError("Camera access was denied. Enable it to continue.");
    }
  }

  if (phase === "briefing") {
    return (
      <FadeUp className="mx-auto w-full max-w-2xl">
        <Card>
          <CardHeader><CardTitle>Before you begin — {title}</CardTitle>
            <CardDescription>Read the rules, then start. Your timer begins immediately.</CardDescription></CardHeader>
          <CardContent className="flex flex-col gap-3 text-sm text-muted-foreground">
            <p>Stay on this tab. Tab switches, window blurs and clipboard use are recorded as integrity events.</p>
            {cameraRequired ? <p>Camera monitoring is required for this exam.</p> : null}
            {error ? <p className="text-destructive" role="alert">{error}</p> : null}
            <Button onClick={start} disabled={pending}>{pending ? "Preparing paper…" : "Start examination"}</Button>
          </CardContent>
        </Card>
      </FadeUp>
    );
  }

  if (phase === "loading") return <p className="text-center text-sm text-muted-foreground">Preparing your paper…</p>;

  if (phase === "locked") {
    return (
      <Card className="mx-auto max-w-xl"><CardHeader><CardTitle>Attempt complete</CardTitle></CardHeader>
        <CardContent className="flex flex-col gap-3 text-sm">
          {lockedScore !== null ? <p className="text-2xl font-semibold">{lockedScore}%</p> : null}
          <p className="text-muted-foreground">A further attempt requires an explicit retake authorization from staff.</p>
          <Button onClick={() => router.push("/dashboard/analytics")}>Open result & analytics</Button>
        </CardContent></Card>
    );
  }

  if (phase === "submitted" && summary) {
    return (
      <Card className="mx-auto max-w-xl"><CardHeader><CardTitle>Submitted</CardTitle>
        <CardDescription>{summary.correctCount} of {summary.total} correct</CardDescription></CardHeader>
        <CardContent className="flex flex-col gap-2 text-sm">
          <p className="text-3xl font-semibold tabular-nums">{summary.accuracy}%</p>
          <p className="text-muted-foreground">Integrity {summary.integrityScore}% · Pace {summary.paceIndex}</p>
          {summary.placement ? <p>Placement: {summary.placement.assignedTrack} ({summary.placement.confidence}% confidence)</p> : null}
          <Button onClick={() => router.push("/dashboard")}>Open dashboard</Button>
        </CardContent></Card>
    );
  }

  const question = paper[index];
  return (
    <FadeUp className="mx-auto flex w-full max-w-7xl flex-col gap-4">
      <ExamStatusWatch sessionId={sessionId} />
      {cameraRequired && !cameraOk ? (
        <Card><CardContent className="flex flex-col gap-2 p-6 text-sm">
          <p className="font-medium">Camera required</p>
          <p className="text-muted-foreground">Preview only — video is never recorded or sent.</p>
          <Button onClick={enableCamera}>Enable camera</Button>
        </CardContent></Card>
      ) : null}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>{title}</CardTitle>
          <p className={cn("font-mono text-lg font-semibold tabular-nums", timer.isCritical ? "text-destructive" : timer.isWarning ? "text-amber-600" : "")} aria-live="polite">{timer.format()}</p>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <Progress value={Math.max(0, (timer.remaining / Math.max(1, remaining)) * 100)} />
          <div className="grid grid-cols-5 gap-1.5 sm:grid-cols-10">
            {paper.map((item, itemIndex) => {
              const status = responseStatus(item, responses[String(item.id)]);
              return (
                <button key={item.id} type="button" onClick={() => go(itemIndex)} aria-label={`Question ${itemIndex + 1}: ${status}`}
                  className={cn("flex size-9 items-center justify-center rounded-md border text-xs tabular-nums",
                    itemIndex === index && "ring-2 ring-primary",
                    status === "answered" ? "bg-emerald-600 text-white" : status === "incomplete" ? "bg-amber-400" : "bg-muted",
                    flagged.includes(String(item.id)) && "outline-2 outline-amber-500")}>
                  {itemIndex + 1}
                </button>
              );
            })}
          </div>
        </CardContent>
      </Card>
      {phase === "exam" && question ? (
        <>
          <QuestionCard q={question} index={index} total={paper.length} response={responses[String(question.id)]}
            flagged={flagged.includes(String(question.id))}
            onChange={(value) => setResponses((current) => ({ ...current, [String(question.id)]: value }))}
            onToggleFlag={() => setFlagged((current) => current.includes(String(question.id)) ? current.filter((item) => item !== String(question.id)) : [...current, String(question.id)])} />
          <div className="flex gap-2">
            <Button variant="outline" disabled={index === 0} onClick={() => go(index - 1)}>Previous</Button>
            {index < paper.length - 1
              ? <Button onClick={() => go(index + 1)}>Next</Button>
              : <Button variant="secondary" onClick={() => setPhase("review")}>Review</Button>}
          </div>
        </>
      ) : null}
      {phase === "review" ? (
        <Card><CardHeader><CardTitle>Review & submit</CardTitle>
          <CardDescription>{paper.filter((item) => responseStatus(item, responses[String(item.id)]) === "answered").length} of {paper.length} answered</CardDescription></CardHeader>
          <CardContent className="flex flex-col gap-2">
            <Button variant="outline" onClick={() => setPhase("exam")}>Back to questions</Button>
            <AlertDialog>
              <AlertDialogTrigger render={<Button disabled={pending} />}>{pending ? "Submitting…" : "Submit examination"}</AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader><AlertDialogTitle>Submit?</AlertDialogTitle>
                  <AlertDialogDescription>This cannot be undone. Unanswered questions score zero.</AlertDialogDescription></AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction onClick={() => doSubmit("manual")}>Submit</AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </CardContent></Card>
      ) : null}
    </FadeUp>
  );
}
