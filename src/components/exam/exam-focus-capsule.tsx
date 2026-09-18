"use client";

import type { ReactElement } from "react";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  CircleAlert,
  CircleCheckBig,
  Flag,
  Grid3X3,
  Send,
  WifiOff,
} from "lucide-react";
import { ExamCameraPanel } from "@/components/exam/exam-camera-panel";
import { ExamQuestionNavigator } from "@/components/exam/exam-question-navigator";
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
  AlertDialogMedia,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Progress, ProgressLabel } from "@/components/ui/progress";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import type { ExamCameraDevice, ExamCameraStatus } from "@/hooks/use-exam-camera";
import { cn } from "@/lib/utils";
import type { ExamExperienceContext, ExamPaperQuestionDTO } from "@/types/exam";

type SyncStatus = "saved" | "saving" | "pending" | "offline" | "error";

interface CameraView {
  status: ExamCameraStatus;
  stream: MediaStream | null;
  devices: ExamCameraDevice[];
  deviceId: string;
  error: string | null;
  onStart: () => void;
  onSelectDevice: (deviceId: string) => void;
}

interface ExamFocusCapsuleProps {
  context: ExamExperienceContext;
  paper: ExamPaperQuestionDTO[];
  currentIndex: number;
  responses: Record<string, unknown>;
  flagged: string[];
  visited: string[];
  timerText: string;
  timerRemaining: number;
  syncStatus: SyncStatus;
  online: boolean;
  timeNotice: string | null;
  saveError: string | null;
  camera: CameraView;
  onJump: (index: number) => void;
  onPrevious: () => void;
  onNext: () => void;
  onToggleFlag: () => void;
  onChangeResponse: (value: unknown) => void;
  onSubmit: () => void;
}

function syncCopy(status: SyncStatus) {
  if (status === "saving") return "Saving…";
  if (status === "pending") return "Saving soon";
  if (status === "offline") return "Offline";
  if (status === "error") return "Save issue";
  return "Saved";
}

function milestoneState(progress: number, threshold: number) {
  if (progress >= threshold) return "complete";
  if (progress >= Math.max(0, threshold - 25)) return "current";
  return "upcoming";
}

function CompletionTrail({ progress }: { progress: number }) {
  const points = [
    { label: "Start", threshold: 0 },
    { label: "25%", threshold: 25 },
    { label: "50%", threshold: 50 },
    { label: "75%", threshold: 75 },
    { label: "Ready", threshold: 100 },
  ];

  return (
    <div className="relative mx-auto hidden w-full max-w-3xl grid-cols-5 items-start px-4 sm:grid" role="group" aria-label={`Exam completion ${Math.round(progress)} percent`}>
      <span className="absolute top-2.5 right-[10%] left-[10%] h-px bg-border" aria-hidden="true" />
      {points.map((point) => {
        const state = milestoneState(progress, point.threshold);
        return (
          <div key={point.label} className="relative z-10 flex flex-col items-center gap-1.5 text-center">
            <span
              className={cn(
                "grid size-5 place-items-center rounded-full border bg-background transition-colors",
                state === "complete" && "border-primary bg-primary text-primary-foreground",
                state === "current" && "border-primary ring-4 ring-primary/10",
              )}
              aria-hidden="true"
            >
              {state === "complete" && point.threshold > 0 ? <Check className="size-3" /> : null}
            </span>
            <span className={cn("text-[10px] font-medium text-muted-foreground", state === "current" && "text-foreground")}>{point.label}</span>
          </div>
        );
      })}
    </div>
  );
}

function QuestionRail({
  paper,
  currentIndex,
  responses,
  flagged,
  onJump,
}: {
  paper: ExamPaperQuestionDTO[];
  currentIndex: number;
  responses: Record<string, unknown>;
  flagged: string[];
  onJump: (index: number) => void;
}) {
  const flaggedSet = new Set(flagged);
  return (
    <nav className="flex max-h-[min(68dvh,38rem)] w-12 flex-col gap-1 overflow-y-auto overscroll-contain rounded-2xl border bg-card/95 p-1.5 shadow-lg [scrollbar-width:none] [&::-webkit-scrollbar]:hidden" aria-label="Question rail">
      {paper.map((question, index) => {
        const status = responseStatus(question, responses[String(question.id)]);
        const current = index === currentIndex;
        const isFlagged = flaggedSet.has(String(question.id));
        return (
          <Button
            key={question.id}
            type="button"
            size="icon-xs"
            variant={current ? "default" : "ghost"}
            className={cn(
              "relative size-9 shrink-0 rounded-xl text-[11px] tabular-nums",
              !current && status === "answered" && "bg-success/10 text-success-foreground",
              !current && status === "incomplete" && "border border-warning-border bg-warning/20",
            )}
            aria-current={current ? "step" : undefined}
            aria-label={`Question ${index + 1}${isFlagged ? ", flagged" : ""}`}
            onClick={() => onJump(index)}
          >
            {index + 1}
            {isFlagged ? <Flag className="absolute -top-0.5 -right-0.5 size-2.5 fill-current" aria-hidden="true" /> : null}
          </Button>
        );
      })}
    </nav>
  );
}

function SubmissionDialog({
  openCount,
  flaggedCount,
  answeredCount,
  total,
  timeLeft,
  timerRemaining,
  online,
  onGoToOpen,
  onSubmit,
  trigger,
}: {
  openCount: number;
  flaggedCount: number;
  answeredCount: number;
  total: number;
  timeLeft: string;
  timerRemaining: number;
  online: boolean;
  onGoToOpen: () => void;
  onSubmit: () => void;
  trigger: ReactElement;
}) {
  const guidance = !online
    ? "Reconnect before final submission. Your answers stay on this page while you are offline."
    : openCount > 0
      ? `You can submit now, but ${openCount} unanswered question${openCount === 1 ? "" : "s"} will be recorded as unanswered.`
      : flaggedCount > 0
        ? `All questions are answered. ${flaggedCount} flagged question${flaggedCount === 1 ? "" : "s"} remain only as reminders and do not block submission.`
        : timerRemaining > 900
          ? `All questions are answered and you still have ${timeLeft} remaining. You may submit now or continue checking your work.`
          : timerRemaining <= 60
            ? "Time is almost up. You may submit now; if the timer reaches zero, Festacol submits automatically."
            : "All questions are answered. You may submit now or continue checking your work.";

  return (
    <AlertDialog>
      <AlertDialogTrigger render={trigger} />
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogMedia className="bg-primary/10 text-primary">
            <Send />
          </AlertDialogMedia>
          <AlertDialogTitle>Submit this examination?</AlertDialogTitle>
          <AlertDialogDescription>
            Submission is final. You have answered {answeredCount} of {total} questions with {timeLeft} remaining. Unanswered or flagged questions never block manual submission.
          </AlertDialogDescription>
        </AlertDialogHeader>

        <Alert>
          <CircleAlert />
          <AlertTitle>{openCount > 0 ? "Submission check" : timerRemaining <= 60 ? "Time nearly finished" : "Ready when you are"}</AlertTitle>
          <AlertDescription>{guidance}</AlertDescription>
        </Alert>

        <div className="grid grid-cols-2 gap-2">
          <div className="rounded-xl border bg-muted/25 p-3">
            <p className="text-xs text-muted-foreground">Need an answer</p>
            <p className="mt-1 text-xl font-semibold tabular-nums">{openCount}</p>
          </div>
          <div className="rounded-xl border bg-muted/25 p-3">
            <p className="text-xs text-muted-foreground">Flagged</p>
            <p className="mt-1 text-xl font-semibold tabular-nums">{flaggedCount}</p>
          </div>
        </div>

        {!online ? (
          <Alert variant="destructive">
            <WifiOff />
            <AlertTitle>Reconnect before submitting</AlertTitle>
            <AlertDescription>Your current answers remain on screen. Submission will be available when the connection returns.</AlertDescription>
          </Alert>
        ) : null}

        <AlertDialogFooter>
          <AlertDialogCancel>Continue writing</AlertDialogCancel>
          {openCount > 0 ? (
            <AlertDialogCancel variant="secondary" onClick={onGoToOpen}>Go to unanswered</AlertDialogCancel>
          ) : null}
          <AlertDialogAction disabled={!online} onClick={onSubmit}>Submit exam</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

export function ExamFocusCapsule({
  context,
  paper,
  currentIndex,
  responses,
  flagged,
  visited,
  timerText,
  timerRemaining,
  syncStatus,
  online,
  timeNotice,
  saveError,
  camera,
  onJump,
  onPrevious,
  onNext,
  onToggleFlag,
  onChangeResponse,
  onSubmit,
}: ExamFocusCapsuleProps) {
  const currentQuestion = paper[currentIndex];
  const currentQuestionId = String(currentQuestion?.id ?? "");
  const answeredCount = paper.filter((question) => responseStatus(question, responses[String(question.id)]) === "answered").length;
  const openQuestions = paper
    .map((question, index) => ({ question, index }))
    .filter(({ question }) => responseStatus(question, responses[String(question.id)]) !== "answered");
  const progress = paper.length ? Math.round((answeredCount / paper.length) * 100) : 0;
  const flaggedSet = new Set(flagged);
  const isFlagged = flaggedSet.has(currentQuestionId);
  const timerCritical = timerRemaining <= 300;
  const timerWarning = !timerCritical && timerRemaining <= 600;

  const navigator = (
    <ExamQuestionNavigator
      paper={paper}
      currentIndex={currentIndex}
      responses={responses}
      flagged={flagged}
      visited={visited}
      onJump={onJump}
    />
  );

  const goToFirstOpen = () => {
    const first = openQuestions[0];
    if (first) onJump(first.index);
  };

  const desktopSubmitTrigger = (
    <Button type="button" size="lg" className="rounded-2xl shadow-sm">
      <Send data-icon="inline-start" />
      Submit exam
    </Button>
  );

  const mobileSubmitTrigger = (
    <Button type="button" className="h-14 flex-col gap-1 rounded-2xl px-1 text-[11px]">
      <Send className="size-4" />
      Submit
    </Button>
  );

  return (
    <div className="relative min-h-dvh overflow-x-hidden bg-gradient-to-br from-primary/5 via-background to-success/5 pb-24 text-foreground xl:pb-8">
      <header className="sticky top-0 z-40 border-b bg-background/88 backdrop-blur-xl supports-[backdrop-filter]:bg-background/78">
        <div className="mx-auto flex min-h-16 w-full max-w-[1600px] items-center gap-3 px-3 py-2 sm:px-5 lg:px-7">
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold tracking-tight sm:text-base">{context.session.title}</p>
            <p className="truncate text-[11px] text-muted-foreground">
              {currentQuestion?.subject ?? context.subjectNames.join(" · ") ?? "Examination"} · Question {Math.min(currentIndex + 1, Math.max(1, paper.length))} of {paper.length}
            </p>
          </div>

          <div className="hidden items-center gap-2 sm:flex">
            <span className={cn(
              "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-medium",
              syncStatus === "error" || syncStatus === "offline"
                ? "border-destructive/30 bg-destructive/10 text-destructive"
                : "bg-card text-muted-foreground",
            )}>
              <span className={cn("size-1.5 rounded-full", syncStatus === "saved" ? "bg-success" : syncStatus === "error" || syncStatus === "offline" ? "bg-destructive" : "bg-warning")} />
              {syncCopy(syncStatus)}
            </span>
          </div>

          {context.cameraRequired ? (
            <div className="max-w-28 sm:max-w-36 xl:hidden">
              <ExamCameraPanel
                required
                variant="capsule"
                status={camera.status}
                stream={camera.stream}
                devices={camera.devices}
                deviceId={camera.deviceId}
                error={camera.error}
                onStart={camera.onStart}
                onSelectDevice={camera.onSelectDevice}
              />
            </div>
          ) : null}

          <div
            className={cn(
              "min-w-[5.5rem] rounded-2xl border px-3 py-1.5 text-right shadow-sm",
              timerCritical && "border-destructive/30 bg-destructive/10 text-destructive",
              timerWarning && "border-warning-border bg-warning/30 text-warning-foreground",
              !timerCritical && !timerWarning && "bg-card",
            )}
          >
            <p className="text-[9px] font-semibold uppercase tracking-[0.12em] opacity-70">Time left</p>
            <p className="font-mono text-base font-semibold tabular-nums sm:text-lg">{timerText}</p>
          </div>
        </div>
      </header>

      {timeNotice ? (
        <div className="mx-auto w-full max-w-5xl px-3 pt-3 sm:px-5" aria-live="polite">
          <Alert>
            <CircleAlert />
            <AlertTitle>{timeNotice}</AlertTitle>
            <AlertDescription>Keep moving at your pace. Your saved answers remain available from the question navigator.</AlertDescription>
          </Alert>
        </div>
      ) : null}

      {!online || saveError || (context.cameraRequired && camera.status !== "active") ? (
        <div className="mx-auto w-full max-w-5xl px-3 pt-3 sm:px-5">
          <Alert variant={!online || saveError ? "destructive" : "default"}>
            <CircleAlert />
            <AlertTitle>{!online ? "Connection interrupted" : saveError ? "Progress needs to sync" : "Camera needs attention"}</AlertTitle>
            <AlertDescription>
              {!online
                ? "Keep this page open. Your current on-screen answers stay in place while Festacol waits to reconnect."
                : saveError ?? "The required camera is not active. Reconnect it without leaving the examination."}
            </AlertDescription>
          </Alert>
        </div>
      ) : null}

      <div className="relative mx-auto grid w-full max-w-[1600px] grid-cols-1 px-3 py-4 sm:px-5 sm:py-6 lg:px-7 xl:min-h-[calc(100dvh-7rem)] xl:grid-cols-[3rem_minmax(0,1fr)_14rem] xl:items-center xl:gap-4">
        <aside className="hidden xl:block">
          <QuestionRail
            paper={paper}
            currentIndex={currentIndex}
            responses={responses}
            flagged={flagged}
            onJump={onJump}
          />
        </aside>

        <main className="min-w-0 w-full">
          <section className="relative overflow-hidden rounded-[2rem] border bg-card shadow-xl">
            <div className="border-b bg-gradient-to-r from-primary/10 via-card to-success/10 px-4 py-4 sm:px-7 sm:py-5">
              <div className="flex flex-wrap items-center gap-3">
                <div className="min-w-0 flex-1">
                  <Progress value={progress} className="gap-2" aria-label={`${answeredCount} of ${paper.length} questions answered`}>
                    <ProgressLabel className="text-xs font-semibold">Your progress</ProgressLabel>
                    <span className="ml-auto text-xs text-muted-foreground tabular-nums">{answeredCount}/{paper.length} answered</span>
                  </Progress>
                </div>
                <span className="rounded-full border bg-background/80 px-2.5 py-1 text-[11px] font-medium text-muted-foreground">{progress}% complete</span>
              </div>
              <div className="mt-4">
                <CompletionTrail progress={progress} />
              </div>
            </div>

            <div className="px-4 py-5 sm:px-7 sm:py-7 lg:px-9 lg:py-8">
              {currentQuestion ? (
                <QuestionCard
                  q={currentQuestion}
                  index={currentIndex}
                  total={paper.length}
                  response={responses[currentQuestionId]}
                  onChange={onChangeResponse}
                  variant="focus"
                />
              ) : (
                <Alert variant="destructive">
                  <AlertTitle>Question unavailable</AlertTitle>
                  <AlertDescription>Open the question navigator and move to another question.</AlertDescription>
                </Alert>
              )}
            </div>

            <div className="hidden items-center justify-between gap-4 border-t bg-muted/20 px-5 py-4 xl:flex">
              <div className="flex items-center gap-2">
                <Button type="button" variant="outline" size="lg" disabled={currentIndex === 0} onClick={onPrevious}>
                  <ArrowLeft data-icon="inline-start" />
                  Prev
                </Button>
                <Button
                  type="button"
                  variant={isFlagged ? "secondary" : "outline"}
                  size="icon-lg"
                  aria-label={isFlagged ? "Remove flag from this question" : "Flag this question"}
                  aria-pressed={isFlagged}
                  onClick={onToggleFlag}
                >
                  <Flag className={cn(isFlagged && "fill-current")} />
                </Button>
                <Button type="button" size="lg" disabled={currentIndex >= paper.length - 1} onClick={onNext}>
                  Next
                  <ArrowRight data-icon="inline-end" />
                </Button>
              </div>

              <div className="flex items-center gap-2">
                {openQuestions.length ? (
                  <Button type="button" variant="secondary" size="lg" onClick={goToFirstOpen}>
                    <CircleAlert data-icon="inline-start" />
                    Go to unanswered ({openQuestions.length})
                  </Button>
                ) : (
                  <span className="inline-flex items-center gap-2 rounded-xl bg-success/10 px-3 py-2 text-sm font-semibold text-success-foreground">
                    <CircleCheckBig className="size-4" />
                    All questions answered
                  </span>
                )}
                <SubmissionDialog
                  openCount={openQuestions.length}
                  flaggedCount={flagged.length}
                  answeredCount={answeredCount}
                  total={paper.length}
                  timeLeft={timerText}
                  timerRemaining={timerRemaining}
                  online={online}
                  onGoToOpen={goToFirstOpen}
                  onSubmit={onSubmit}
                  trigger={desktopSubmitTrigger}
                />
              </div>
            </div>
          </section>
        </main>

        <aside className="hidden max-h-[calc(100dvh-7rem)] min-w-0 flex-col gap-3 overflow-y-auto xl:flex">
          {context.cameraRequired ? (
            <ExamCameraPanel
              required
              variant="capsule"
              status={camera.status}
              stream={camera.stream}
              devices={camera.devices}
              deviceId={camera.deviceId}
              error={camera.error}
              onStart={camera.onStart}
              onSelectDevice={camera.onSelectDevice}
            />
          ) : null}

          <div className="rounded-2xl border bg-card p-3 shadow-lg">
            <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">Keep moving</p>
            {openQuestions.length ? (
              <>
                <p className="mt-2 text-sm font-semibold">{openQuestions.length} question{openQuestions.length === 1 ? "" : "s"} still need an answer.</p>
                <Button type="button" variant="secondary" size="sm" className="mt-3 w-full" onClick={goToFirstOpen}>Go to unanswered</Button>
              </>
            ) : flagged.length ? (
              <>
                <p className="mt-2 text-sm font-semibold">All questions are answered. {flagged.length} remain flagged.</p>
                <Sheet>
                  <SheetTrigger render={<Button type="button" variant="secondary" size="sm" className="mt-3 w-full" />}>
                    Open questions
                  </SheetTrigger>
                  <SheetContent side="right" className="w-[min(92vw,24rem)] overflow-hidden sm:max-w-md">
                    <SheetHeader className="border-b px-5 pb-3 pt-5 pr-14">
                      <SheetTitle>Questions</SheetTitle>
                      <SheetDescription>Jump without losing your current response.</SheetDescription>
                    </SheetHeader>
                    <div className="min-h-0 flex-1 overflow-hidden px-5 pb-5 pt-1">{navigator}</div>
                  </SheetContent>
                </Sheet>
              </>
            ) : (
              <p className="mt-2 text-sm font-semibold">Every question has an answer. Submit when you are ready.</p>
            )}
          </div>
        </aside>
      </div>

      <div className="fixed inset-x-0 bottom-0 z-50 border-t bg-background/94 px-2 pb-[max(.5rem,env(safe-area-inset-bottom))] pt-2 backdrop-blur-xl xl:hidden">
        <div className="mx-auto grid max-w-2xl grid-cols-5 gap-1">
          <Button type="button" variant="ghost" className="h-14 flex-col gap-1 rounded-2xl px-1 text-[11px]" disabled={currentIndex === 0} onClick={onPrevious}>
            <ArrowLeft className="size-4" />
            Prev
          </Button>

          <Button
            type="button"
            variant={isFlagged ? "secondary" : "ghost"}
            className="h-14 flex-col gap-1 rounded-2xl px-1 text-[11px]"
            aria-label={isFlagged ? "Remove flag from this question" : "Flag this question"}
            aria-pressed={isFlagged}
            onClick={onToggleFlag}
          >
            <Flag className={cn("size-4", isFlagged && "fill-current")} />
            <span className="sr-only">Flag</span>
          </Button>

          <Sheet>
            <SheetTrigger render={<Button type="button" variant="secondary" className="h-14 flex-col gap-1 rounded-2xl px-1 text-[11px]" />}>
              <Grid3X3 className="size-4" />
              Questions
            </SheetTrigger>
            <SheetContent
              side="bottom"
              className="mx-2 mb-2 max-h-[min(82dvh,44rem)] overflow-hidden rounded-[2rem] border sm:mx-4 sm:mb-4"
            >
              <SheetHeader className="border-b px-5 pb-3 pt-5 pr-14 sm:px-6">
                <SheetTitle>Question navigator</SheetTitle>
                <SheetDescription>{answeredCount} of {paper.length} answered · {flagged.length} flagged</SheetDescription>
              </SheetHeader>
              <div className="min-h-0 flex-1 overflow-hidden px-5 pb-[calc(1.5rem+env(safe-area-inset-bottom))] pt-1 sm:px-6">
                {navigator}
              </div>
            </SheetContent>
          </Sheet>

          <Button type="button" variant="ghost" className="h-14 flex-col gap-1 rounded-2xl px-1 text-[11px]" disabled={currentIndex >= paper.length - 1} onClick={onNext}>
            <ArrowRight className="size-4" />
            Next
          </Button>

          <SubmissionDialog
            openCount={openQuestions.length}
            flaggedCount={flagged.length}
            answeredCount={answeredCount}
            total={paper.length}
            timeLeft={timerText}
            timerRemaining={timerRemaining}
            online={online}
            onGoToOpen={goToFirstOpen}
            onSubmit={onSubmit}
            trigger={mobileSubmitTrigger}
          />
        </div>
      </div>
    </div>
  );
}
