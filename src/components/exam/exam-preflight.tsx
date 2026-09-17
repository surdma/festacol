"use client";

import { Camera, Check, ChevronLeft, ChevronRight, Clock3, Cloud, FileText, ShieldCheck, UserRound } from "lucide-react";
import { ExamCameraPanel } from "@/components/exam/exam-camera-panel";
import { ExamCheckpointRail } from "@/components/exam/exam-checkpoint-rail";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import type { ExamExperienceContext } from "@/types/exam";
import type { useExamCamera } from "@/hooks/use-exam-camera";

export type ExamPreflightStage = "overview" | "instructions" | "readiness" | "final";
type CameraController = ReturnType<typeof useExamCamera>;

const STAGES: { id: ExamPreflightStage; label: string }[] = [
  { id: "overview", label: "Overview" },
  { id: "instructions", label: "Instructions" },
  { id: "readiness", label: "Device check" },
  { id: "final", label: "Ready" },
];

function formatDuration(seconds: number) {
  const totalMinutes = Math.max(1, Math.round(seconds / 60));
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (!hours) return `${minutes} minutes`;
  return minutes ? `${hours} hr ${minutes} min` : `${hours} hour${hours === 1 ? "" : "s"}`;
}

function modeLabel(mode: ExamExperienceContext["session"]["mode"]) {
  if (mode === "qualifier") return "Entrance / placement assessment";
  if (mode === "single") return "Single-subject assessment";
  if (mode === "mixed") return "Multi-subject assessment";
  return mode.toUpperCase();
}

function Availability({ startsAt, endsAt }: { startsAt: number | null; endsAt: number | null }) {
  if (!startsAt && !endsAt) return <span>Open examination window</span>;
  if (startsAt && endsAt) return <span>{new Date(startsAt).toLocaleString()} – {new Date(endsAt).toLocaleString()}</span>;
  if (startsAt) return <span>Starts {new Date(startsAt).toLocaleString()}</span>;
  return <span>Closes {new Date(endsAt ?? 0).toLocaleString()}</span>;
}

function DetailRow({ icon, label, value }: { icon: React.ReactNode; label: string; value: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[2.25rem_minmax(0,1fr)] gap-3 border-b py-4 last:border-b-0">
      <span className="grid size-9 place-items-center rounded-lg bg-muted text-muted-foreground">{icon}</span>
      <div className="min-w-0">
        <dt className="text-xs font-medium text-muted-foreground">{label}</dt>
        <dd className="mt-0.5 text-sm font-semibold leading-6 text-foreground">{value}</dd>
      </div>
    </div>
  );
}

function ReadinessRow({ ready, title, description }: { ready: boolean; title: string; description: string }) {
  return (
    <div className="flex items-start gap-3 border-b py-4 last:border-b-0">
      <span className={cn("mt-0.5 grid size-6 shrink-0 place-items-center rounded-full border", ready ? "bg-foreground text-background" : "bg-muted text-muted-foreground")}>
        {ready ? <Check className="size-3.5" aria-hidden="true" /> : <span className="size-2 rounded-full bg-current" aria-hidden="true" />}
      </span>
      <div className="min-w-0">
        <p className="text-sm font-semibold">{title}</p>
        <p className="mt-0.5 text-xs leading-5 text-muted-foreground">{description}</p>
      </div>
    </div>
  );
}

export function ExamPreflight({
  context,
  stage,
  onStageChange,
  camera,
  online,
  cameraSupported,
  fullscreenSupported,
  onStart,
  starting,
  error,
}: {
  context: ExamExperienceContext;
  stage: ExamPreflightStage;
  onStageChange: (stage: ExamPreflightStage) => void;
  camera: CameraController;
  online: boolean;
  cameraSupported: boolean;
  fullscreenSupported: boolean;
  onStart: () => void;
  starting: boolean;
  error: string | null;
}) {
  const currentStep = STAGES.findIndex((item) => item.id === stage);
  const { session, candidate, subjectNames, access, cameraRequired } = context;
  const resuming = Boolean(access.activeAttemptId);
  const canContinueFromReadiness = online && (!cameraRequired || camera.ready);
  const subjects = subjectNames.length ? subjectNames.join(" · ") : modeLabel(session.mode);

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-5xl flex-col px-4 py-6 sm:px-6 sm:py-10 lg:py-12">
      <header>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">Festacol Assessment</p>
            <h1 className="mt-2 text-xl font-semibold tracking-tight sm:text-2xl">{session.title}</h1>
          </div>
          <div className="shrink-0 text-right text-xs leading-5 text-muted-foreground">
            <p className="font-semibold text-foreground">{candidate.fullName}</p>
            <p>{candidate.studentNumber ?? candidate.classLabel}</p>
          </div>
        </div>
        <Separator className="mt-6" />
        <div className="py-5">
          <ExamCheckpointRail steps={STAGES} currentIndex={currentStep} label="Examination preparation progress" />
        </div>
        <Separator />
      </header>

      <div className="flex-1 py-7 sm:py-9">
        {stage === "overview" ? (
          <section aria-labelledby="exam-overview-title" className="grid gap-8 lg:grid-cols-[minmax(0,1.2fr)_minmax(18rem,.8fr)] lg:gap-10">
            <div>
              <p className="text-sm font-semibold text-muted-foreground">Examination overview</p>
              <h2 id="exam-overview-title" className="mt-2 max-w-3xl text-2xl font-semibold leading-tight tracking-tight sm:text-3xl">Know the examination state before you continue.</h2>
              <p className="mt-3 max-w-2xl text-sm leading-6 text-muted-foreground">
                {resuming
                  ? "Your attempt is already in progress. Its server-side time continues while you restore the required device state, then Resume Exam returns you to the saved paper."
                  : "Your attempt is not started on this screen. Continue through the preparation checks, then use the final Start Exam action when you are ready."}
              </p>

              <dl className="mt-7 border-y">
                <DetailRow icon={<FileText className="size-4" aria-hidden="true" />} label="Subject and mode" value={<>{subjects}<span className="block text-xs font-normal text-muted-foreground">{modeLabel(session.mode)}</span></>} />
                <DetailRow icon={<UserRound className="size-4" aria-hidden="true" />} label="Candidate and class" value={<>{candidate.fullName}<span className="block text-xs font-normal text-muted-foreground">{candidate.classLabel}</span></>} />
                <DetailRow icon={<Clock3 className="size-4" aria-hidden="true" />} label="Duration and availability" value={<>{formatDuration(session.durationSeconds)}<span className="block text-xs font-normal text-muted-foreground"><Availability startsAt={session.startsAt} endsAt={session.endsAt} /></span></>} />
              </dl>
            </div>

            <aside className="self-start" aria-label="Exam summary">
              <p className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">At a glance</p>
              <dl className="mt-3 border-y">
                <div className="border-b py-3 last:border-b-0"><dt className="text-xs text-muted-foreground">Questions</dt><dd className="mt-1 text-lg font-semibold tabular-nums">{session.questionCount}</dd></div>
                <div className="border-b py-3 last:border-b-0"><dt className="text-xs text-muted-foreground">Attempt status</dt><dd className="mt-1 text-sm font-semibold">{resuming ? "In progress" : `${Math.max(0, access.allowedAttempts - access.usedAttempts)} attempt${Math.max(0, access.allowedAttempts - access.usedAttempts) === 1 ? "" : "s"} available`}</dd></div>
                <div className="border-b py-3 last:border-b-0"><dt className="text-xs text-muted-foreground">Saving</dt><dd className="mt-1 text-sm font-semibold">Automatic progress saving</dd></div>
                <div className="border-b py-3 last:border-b-0"><dt className="text-xs text-muted-foreground">Camera</dt><dd className="mt-1 text-sm font-semibold">{cameraRequired ? "Required throughout the exam" : "Not required"}</dd></div>
              </dl>
            </aside>
          </section>
        ) : null}

        {stage === "instructions" ? (
          <section aria-labelledby="exam-instructions-title">
            <div className="max-w-3xl">
              <p className="text-sm font-semibold text-muted-foreground">Instructions</p>
              <h2 id="exam-instructions-title" className="mt-2 text-2xl font-semibold tracking-tight sm:text-3xl">How this examination works</h2>
              <p className="mt-3 text-sm leading-6 text-muted-foreground">Scan each section now. During the exam, the interface keeps the timer, save state, question navigation and camera status visible.</p>
            </div>

            <div className="mt-8 grid gap-x-10 gap-y-7 md:grid-cols-2">
              <div className="border-t pt-5"><h3 className="text-sm font-semibold">Answering questions</h3><p className="mt-1.5 text-sm leading-6 text-muted-foreground">Select the complete response row for objective questions. Multi-select questions say when more than one response is required. Fill-in questions save what you type.</p></div>
              <div className="border-t pt-5"><h3 className="text-sm font-semibold">Navigation</h3><p className="mt-1.5 text-sm leading-6 text-muted-foreground">You can move backward and forward, jump through the question navigator, flag questions for review and return to them before final submission.</p></div>
              <div className="border-t pt-5"><h3 className="text-sm font-semibold">Time management</h3><p className="mt-1.5 text-sm leading-6 text-muted-foreground">The countdown continues while the attempt is active. When it reaches zero, Festacol finalizes and submits the saved responses automatically.</p></div>
              <div className="border-t pt-5"><h3 className="text-sm font-semibold">Saving responses</h3><p className="mt-1.5 text-sm leading-6 text-muted-foreground">Answers save quietly in the background. If the connection drops, keep the exam open. Your on-screen choices stay in place while Festacol reconnects and retries.</p></div>
              <div className="border-t pt-5"><h3 className="text-sm font-semibold">Review and submission</h3><p className="mt-1.5 text-sm leading-6 text-muted-foreground">Before submitting, you will see answered, unanswered and flagged questions. Final submission is deliberate and cannot be undone.</p></div>
              <div className="border-t pt-5"><h3 className="text-sm font-semibold">Examination conduct</h3><p className="mt-1.5 text-sm leading-6 text-muted-foreground">Stay in the examination window. {session.integrityPolicy.focusMonitoring ? "Leaving the window can be recorded as an integrity event. " : ""}{session.integrityPolicy.clipboardGuard ? "Clipboard activity may be recorded. " : ""}{cameraRequired ? "Keep the required camera active throughout the attempt." : ""}</p></div>
            </div>

            {session.instructions.trim() ? (
              <Alert className="mt-8">
                <FileText />
                <AlertTitle>School instructions</AlertTitle>
                <AlertDescription className="whitespace-pre-line">{session.instructions}</AlertDescription>
              </Alert>
            ) : null}
          </section>
        ) : null}

        {stage === "readiness" ? (
          <section aria-labelledby="device-check-title" className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_22rem] lg:gap-10">
            <div>
              <p className="text-sm font-semibold text-muted-foreground">Device and browser check</p>
              <h2 id="device-check-title" className="mt-2 text-2xl font-semibold tracking-tight sm:text-3xl">Make sure your exam environment is ready</h2>
              <p className="mt-3 max-w-2xl text-sm leading-6 text-muted-foreground">These checks only verify the capabilities this examination actually needs. No facial-recognition score or behavior score is generated here.</p>

              <div className="mt-7 border-y">
                <ReadinessRow ready={online} title={online ? "Internet connection available" : "You are currently offline"} description={online ? "Autosave can reach the examination service." : resuming ? "Reconnect before resuming so saved progress can be restored safely." : "Reconnect before starting so your first response can be saved."} />
                <ReadinessRow ready={!cameraRequired || cameraSupported} title={cameraRequired ? "Browser camera support" : "Camera not required"} description={cameraRequired ? (cameraSupported ? "This browser can request a live webcam stream." : "Use a browser or device that supports webcam access.") : "This examination does not require webcam access."} />
                {session.integrityPolicy.fullscreenPrompt ? <ReadinessRow ready={fullscreenSupported} title="Full-screen capability" description={fullscreenSupported ? "This browser can enter full screen when requested." : "Full-screen mode is not available in this browser."} /> : null}
                <ReadinessRow ready title="Microphone" description="Microphone access is not requested for this examination." />
                <ReadinessRow ready title="Autosave" description="Your responses, flags, question position and remaining time are saved to the active exam session." />
              </div>
            </div>

            <div className="self-start">
              <ExamCameraPanel
                required={cameraRequired}
                status={camera.status}
                stream={camera.stream}
                devices={camera.devices}
                deviceId={camera.deviceId}
                error={camera.error}
                onStart={() => void camera.start()}
                onSelectDevice={(deviceId) => void camera.selectDevice(deviceId)}
              />
            </div>
          </section>
        ) : null}

        {stage === "final" ? (
          <section aria-labelledby="final-check-title" className="mx-auto max-w-3xl">
            <div className="flex size-11 items-center justify-center rounded-full bg-muted"><ShieldCheck className="size-5" aria-hidden="true" /></div>
            <p className="mt-5 text-sm font-semibold text-muted-foreground">Final checkpoint</p>
            <h2 id="final-check-title" className="mt-2 text-2xl font-semibold tracking-tight sm:text-3xl">Ready to {resuming ? "resume" : "start"} {session.title}?</h2>
            <p className="mt-3 text-sm leading-6 text-muted-foreground">
              {resuming
                ? "Resuming restores your saved paper, answers and remaining server-calculated time. Keep the required camera active and this browser window open until submission completes."
                : "Starting allocates your examination attempt and starts the active countdown. Keep this browser window open until submission completes."}
            </p>

            <dl className="mt-8 border-y">
              <div className="flex items-center justify-between gap-4 border-b py-3.5 last:border-b-0"><dt className="text-xs text-muted-foreground">Duration</dt><dd className="text-sm font-semibold tabular-nums">{formatDuration(session.durationSeconds)}</dd></div>
              <div className="flex items-center justify-between gap-4 border-b py-3.5 last:border-b-0"><dt className="text-xs text-muted-foreground">Questions</dt><dd className="text-sm font-semibold tabular-nums">{session.questionCount}</dd></div>
              <div className="flex items-center justify-between gap-4 border-b py-3.5 last:border-b-0"><dt className="text-xs text-muted-foreground">Connection</dt><dd className="flex items-center gap-2 text-sm font-semibold"><Cloud className="size-4" aria-hidden="true" />{online ? "Connected" : "Offline"}</dd></div>
              <div className="flex items-center justify-between gap-4 border-b py-3.5 last:border-b-0"><dt className="text-xs text-muted-foreground">Camera</dt><dd className="flex items-center gap-2 text-sm font-semibold"><Camera className="size-4" aria-hidden="true" />{cameraRequired ? (camera.ready ? "Ready and active" : "Not ready") : "Not required"}</dd></div>
            </dl>

            {error ? <Alert variant="destructive" className="mt-6"><AlertTitle>Cannot {resuming ? "resume" : "start"} yet</AlertTitle><AlertDescription>{error}</AlertDescription></Alert> : null}

            <div className="mt-7 flex flex-col-reverse gap-2 sm:flex-row sm:items-center sm:justify-between">
              <Button type="button" variant="outline" size="lg" onClick={() => onStageChange("readiness")} disabled={starting}>
                <ChevronLeft data-icon="inline-start" />Device check
              </Button>
              <Button type="button" size="lg" onClick={onStart} disabled={starting || !online || (cameraRequired && !camera.ready)}>
                {starting ? "Preparing your paper…" : resuming ? "Resume Exam" : "Start Exam"}
              </Button>
            </div>
          </section>
        ) : null}
      </div>

      {stage !== "final" ? (
        <footer className="flex items-center justify-between gap-3 border-t py-4">
          <Button
            type="button"
            variant="outline"
            size="lg"
            disabled={currentStep === 0}
            onClick={() => onStageChange(STAGES[Math.max(0, currentStep - 1)].id)}
          >
            <ChevronLeft data-icon="inline-start" />Back
          </Button>
          <Button
            type="button"
            size="lg"
            disabled={stage === "readiness" && !canContinueFromReadiness}
            onClick={() => onStageChange(STAGES[Math.min(STAGES.length - 1, currentStep + 1)].id)}
          >
            Continue<ChevronRight data-icon="inline-end" />
          </Button>
        </footer>
      ) : null}
    </main>
  );
}
