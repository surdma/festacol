"use client";

import {
  BookOpenText,
  CalendarClock,
  Camera,
  Check,
  ChevronDown,
  CircleAlert,
  Clock3,
  FileText,
  GraduationCap,
  ListChecks,
  RotateCcw,
  ShieldCheck,
  Shuffle,
  Wifi,
  WifiOff,
} from "lucide-react";
import { ExamCameraPanel } from "@/components/exam/exam-camera-panel";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Spinner } from "@/components/ui/spinner";
import type { useExamCamera } from "@/hooks/use-exam-camera";
import type { ExamExperienceContext } from "@/types/exam";

export type ExamPreflightStage = "overview" | "instructions" | "readiness" | "final";
type CameraController = ReturnType<typeof useExamCamera>;

function formatDuration(seconds: number) {
  const totalMinutes = Math.max(1, Math.round(seconds / 60));
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;

  if (!hours) return `${minutes} minutes`;
  return minutes
    ? `${hours} hr ${minutes} min`
    : `${hours} hour${hours === 1 ? "" : "s"}`;
}

function modeLabel(mode: ExamExperienceContext["session"]["mode"]) {
  if (mode === "qualifier") return "Entrance / placement examination";
  if (mode === "single") return "Single-subject examination";
  if (mode === "mixed") return "Multi-subject examination";
  return mode.toUpperCase();
}

function formatAvailability(startsAt: number | null, endsAt: number | null) {
  if (!startsAt && !endsAt) return "Open examination window";
  if (startsAt && endsAt) {
    return `${new Date(startsAt).toLocaleString()} – ${new Date(endsAt).toLocaleString()}`;
  }
  if (startsAt) return `Opens ${new Date(startsAt).toLocaleString()}`;
  return `Closes ${new Date(endsAt ?? 0).toLocaleString()}`;
}

function Fact({
  label,
  value,
}: {
  label: string;
  value: React.ReactNode;
}) {
  return (
    <div className="grid grid-cols-[7.5rem_minmax(0,1fr)] gap-4 border-b border-border/70 py-3.5 last:border-b-0 sm:grid-cols-[9rem_minmax(0,1fr)]">
      <dt className="text-xs font-medium uppercase tracking-[0.12em] text-muted-foreground">
        {label}
      </dt>
      <dd className="min-w-0 text-sm font-semibold leading-6 text-foreground">
        {value}
      </dd>
    </div>
  );
}

function Instruction({
  number,
  title,
  children,
}: {
  number: string;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="grid grid-cols-[2rem_minmax(0,1fr)] gap-3 border-b border-border/70 py-4 last:border-b-0">
      <span className="font-mono text-xs font-semibold text-muted-foreground">
        {number}
      </span>
      <div className="min-w-0">
        <h3 className="text-sm font-semibold text-foreground">{title}</h3>
        <p className="mt-1 text-sm leading-6 text-muted-foreground">{children}</p>
      </div>
    </div>
  );
}

export function ExamPreflight({
  context,
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
  const { session, candidate, subjectNames, access, cameraRequired } = context;
  const resuming = Boolean(access.activeAttemptId);
  const remainingAttempts = Math.max(0, access.allowedAttempts - access.usedAttempts);
  const subjects = subjectNames.length
    ? subjectNames.join(" · ")
    : modeLabel(session.mode);
  const academicPeriod = [session.academicSession, session.term]
    .filter(Boolean)
    .join(" · ");
  const placementTracks =
    session.mode === "qualifier" && session.placementTracks.length
      ? session.placementTracks.join(" · ")
      : null;
  const canStart = online && (!cameraRequired || camera.ready) && !starting;

  const configuredConduct = [
    session.integrityPolicy.focusMonitoring
      ? "Leaving the examination window can be recorded as an integrity event."
      : null,
    session.integrityPolicy.clipboardGuard
      ? "Clipboard activity can be recorded during the examination."
      : null,
    session.integrityPolicy.fullscreenPrompt
      ? fullscreenSupported
        ? "Festacol will ask this browser to enter full screen when you begin."
        : "Full-screen mode is not available in this browser; stay in this examination window while you write."
      : null,
    cameraRequired
      ? "Keep the required camera active until the examination is submitted."
      : null,
  ].filter((item): item is string => Boolean(item));

  const configuredPaperRules = [
    session.randomization.questionOrder
      ? "Question order may be different from another candidate's paper."
      : null,
    session.randomization.optionOrder
      ? "Answer-option order may vary between papers."
      : null,
    session.randomization.minimizePaperCollisions
      ? "Festacol may vary paper ordering between candidates."
      : null,
  ].filter((item): item is string => Boolean(item));

  return (
    <main className="min-h-dvh bg-muted/20 px-3 py-4 text-foreground sm:px-5 sm:py-7 lg:px-8 lg:py-10">
      <div className="mx-auto w-full max-w-7xl">
        <header className="mb-4 flex flex-wrap items-center justify-between gap-3 px-1 sm:mb-6">
          <div className="flex items-center gap-3">
            <span className="grid size-10 place-items-center rounded-full border bg-background shadow-sm">
              <BookOpenText className="size-4" aria-hidden="true" />
            </span>
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                Festacol examination booklet
              </p>
              <p className="mt-0.5 text-sm font-semibold">
                Ready to {resuming ? "resume" : "write"}
              </p>
            </div>
          </div>

          <div className="text-right text-xs leading-5 text-muted-foreground">
            <p className="font-semibold text-foreground">{candidate.fullName}</p>
            <p>{candidate.studentNumber ?? candidate.classLabel}</p>
          </div>
        </header>

        <section
          aria-labelledby="ready-to-write-title"
          className="relative overflow-hidden rounded-[1.75rem] border bg-background shadow-xl"
        >
          <div
            className="pointer-events-none absolute inset-y-0 left-1/2 z-10 hidden w-px -translate-x-1/2 bg-border lg:block"
            aria-hidden="true"
          />
          <div
            className="pointer-events-none absolute inset-y-0 left-1/2 z-10 hidden w-10 -translate-x-1/2 bg-muted/30 lg:block"
            aria-hidden="true"
          />

          <div className="grid lg:grid-cols-2">
            <article className="relative flex min-h-[38rem] flex-col border-b bg-muted/15 p-5 sm:p-8 lg:min-h-[44rem] lg:border-b-0 lg:border-r lg:p-10 xl:p-12">
              <div
                className="pointer-events-none absolute right-5 top-4 font-serif text-[7rem] leading-none text-foreground/[0.035] sm:right-8 sm:text-[10rem]"
                aria-hidden="true"
              >
                02
              </div>

              <div className="relative">
                <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                  Candidate copy · {modeLabel(session.mode)}
                </p>
                <h1
                  id="ready-to-write-title"
                  className="mt-5 max-w-xl font-serif text-4xl font-medium leading-[0.98] tracking-[-0.04em] sm:text-5xl lg:text-6xl"
                >
                  {session.title}
                </h1>
                <p className="mt-4 max-w-xl text-sm leading-6 text-muted-foreground">
                  {resuming
                    ? "Your examination is already in progress. Review the paper details below, restore any required device permission, then return to your saved paper."
                    : "This is the paper you are about to write. Check the details once, read the instructions on the facing page, then begin when you are ready."}
                </p>
              </div>

              <dl className="relative mt-8 border-y border-border/80">
                <Fact label="Subjects" value={subjects} />
                <Fact
                  label="Candidate"
                  value={
                    <>
                      {candidate.fullName}
                      <span className="block text-xs font-normal text-muted-foreground">
                        {candidate.classLabel}
                        {candidate.studentNumber
                          ? ` · ${candidate.studentNumber}`
                          : ""}
                      </span>
                    </>
                  }
                />
                <Fact
                  label="Paper"
                  value={
                    <>
                      {session.questionCount} questions ·{" "}
                      {formatDuration(session.durationSeconds)}
                      <span className="block text-xs font-normal text-muted-foreground">
                        {session.classLevel}
                        {session.classGroup
                          ? ` · Class arm${session.classGroup.includes(",") ? "s" : ""} ${session.classGroup}`
                          : ""}
                      </span>
                    </>
                  }
                />
                {academicPeriod ? (
                  <Fact label="Academic period" value={academicPeriod} />
                ) : null}
                <Fact
                  label="Availability"
                  value={formatAvailability(session.startsAt, session.endsAt)}
                />
                {placementTracks ? (
                  <Fact label="Placement tracks" value={placementTracks} />
                ) : null}
                <Fact
                  label="Attempt"
                  value={
                    resuming ? (
                      <>
                        In progress
                        <span className="block text-xs font-normal text-muted-foreground">
                          Resume returns to the saved paper and server-calculated
                          time.
                        </span>
                      </>
                    ) : (
                      <>
                        {remainingAttempts} of {access.allowedAttempts} available
                        <span className="block text-xs font-normal text-muted-foreground">
                          Your attempt starts only after you choose Start
                          Examination.
                        </span>
                      </>
                    )
                  }
                />
              </dl>

              <div className="relative mt-auto pt-8">
                <div className="flex items-start gap-3 border-t border-dashed pt-5">
                  <ShieldCheck className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                  <p className="text-xs leading-5 text-muted-foreground">
                    This page does not start a new attempt. Festacol allocates or
                    restores the attempt only when you choose{" "}
                    <strong className="font-semibold text-foreground">
                      {resuming ? "Resume Examination" : "Start Examination"}
                    </strong>
                    .
                  </p>
                </div>
              </div>
            </article>

            <article className="flex min-h-[38rem] flex-col p-5 sm:p-8 lg:min-h-[44rem] lg:p-10 xl:p-12">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                  Inside cover · read once before you begin
                </p>
                <h2 className="mt-4 font-serif text-3xl font-medium tracking-[-0.03em] sm:text-4xl">
                  What you need to know
                </h2>
              </div>

              <div className="mt-6 border-y border-border/80">
                <Instruction number="01" title="Answer exactly what each question asks">
                  Objective, multiple-selection and fill-in questions show the
                  response control they require. When more than one answer is
                  required, the question tells you.
                </Instruction>
                <Instruction number="02" title="Move freely and flag anything to revisit">
                  Use the question navigator to move backward or forward. A
                  flagged question keeps its answer and stays easy to find.
                </Instruction>
                <Instruction number="03" title="Your work saves automatically">
                  Responses, flags and your current position save while you
                  write. If the connection drops, keep this page open while
                  Festacol reconnects.
                </Instruction>
                <Instruction number="04" title="The timer keeps the official time">
                  The countdown begins with the active attempt. When it reaches
                  zero, Festacol finalizes the responses already saved.
                </Instruction>
                <Instruction number="05" title="Review before final submission">
                  You will see answered, unanswered and flagged questions before
                  you submit. Final submission cannot be undone.
                </Instruction>
              </div>

              {session.instructions.trim() ? (
                <Collapsible defaultOpen className="mt-5 border-y border-border/80">
                  <CollapsibleTrigger className="flex w-full items-center justify-between gap-4 py-4 text-left">
                    <span className="flex min-w-0 items-center gap-3">
                      <FileText className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                      <span>
                        <span className="block text-sm font-semibold">
                          School instructions
                        </span>
                        <span className="mt-0.5 block text-xs text-muted-foreground">
                          Instructions configured by the examination creator
                        </span>
                      </span>
                    </span>
                    <ChevronDown className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                  </CollapsibleTrigger>
                  <CollapsibleContent className="pb-5">
                    <div className="whitespace-pre-line border-l-2 pl-4 text-sm leading-6 text-muted-foreground">
                      {session.instructions}
                    </div>
                  </CollapsibleContent>
                </Collapsible>
              ) : null}

              {(configuredConduct.length > 0 ||
                configuredPaperRules.length > 0) ? (
                <div className="mt-5 grid gap-5 sm:grid-cols-2">
                  {configuredConduct.length ? (
                    <section aria-labelledby="conduct-title">
                      <div className="flex items-center gap-2">
                        <ShieldCheck className="size-4 text-muted-foreground" aria-hidden="true" />
                        <h3 id="conduct-title" className="text-xs font-semibold uppercase tracking-[0.12em]">
                          Examination conduct
                        </h3>
                      </div>
                      <ul className="mt-3 flex flex-col gap-2 text-xs leading-5 text-muted-foreground">
                        {configuredConduct.map((item) => (
                          <li key={item} className="flex gap-2">
                            <Check className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
                            <span>{item}</span>
                          </li>
                        ))}
                      </ul>
                    </section>
                  ) : null}

                  {configuredPaperRules.length ? (
                    <section aria-labelledby="paper-rules-title">
                      <div className="flex items-center gap-2">
                        <Shuffle className="size-4 text-muted-foreground" aria-hidden="true" />
                        <h3 id="paper-rules-title" className="text-xs font-semibold uppercase tracking-[0.12em]">
                          Paper configuration
                        </h3>
                      </div>
                      <ul className="mt-3 flex flex-col gap-2 text-xs leading-5 text-muted-foreground">
                        {configuredPaperRules.map((item) => (
                          <li key={item} className="flex gap-2">
                            <Check className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
                            <span>{item}</span>
                          </li>
                        ))}
                      </ul>
                    </section>
                  ) : null}
                </div>
              ) : null}

              <div className="mt-auto pt-7">
                {!online ? (
                  <Alert variant="destructive">
                    <WifiOff />
                    <AlertTitle>Reconnect to continue</AlertTitle>
                    <AlertDescription>
                      Keep this page open and reconnect to the internet before
                      {resuming ? " resuming" : " starting"} this examination.
                    </AlertDescription>
                  </Alert>
                ) : (
                  <div className="flex items-center gap-3 border-y border-border/70 py-3.5">
                    <span className="grid size-8 place-items-center rounded-full bg-foreground text-background">
                      <Wifi className="size-3.5" aria-hidden="true" />
                    </span>
                    <div>
                      <p className="text-sm font-semibold">Connection ready</p>
                      <p className="text-xs text-muted-foreground">
                        Autosave can reach the examination service.
                      </p>
                    </div>
                  </div>
                )}

                {cameraRequired ? (
                  <div className="mt-4">
                    {!cameraSupported ? (
                      <Alert variant="destructive">
                        <Camera />
                        <AlertTitle>A camera is required for this examination</AlertTitle>
                        <AlertDescription>
                          This browser cannot provide webcam access. Use a
                          supported browser or device before continuing.
                        </AlertDescription>
                      </Alert>
                    ) : (
                      <ExamCameraPanel
                        required
                        status={camera.status}
                        stream={camera.stream}
                        devices={camera.devices}
                        deviceId={camera.deviceId}
                        error={camera.error}
                        onStart={() => void camera.start()}
                        onSelectDevice={(deviceId) =>
                          void camera.selectDevice(deviceId)
                        }
                      />
                    )}
                  </div>
                ) : null}

                {error ? (
                  <Alert variant="destructive" className="mt-4">
                    <CircleAlert />
                    <AlertTitle>
                      Cannot {resuming ? "resume" : "start"} yet
                    </AlertTitle>
                    <AlertDescription>{error}</AlertDescription>
                  </Alert>
                ) : null}
              </div>
            </article>
          </div>

          <footer className="border-t border-dashed bg-foreground px-5 py-4 text-background sm:px-8 lg:px-10 xl:px-12">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div className="flex min-w-0 items-start gap-3">
                {resuming ? (
                  <RotateCcw className="mt-0.5 size-5 shrink-0 opacity-80" aria-hidden="true" />
                ) : (
                  <ListChecks className="mt-0.5 size-5 shrink-0 opacity-80" aria-hidden="true" />
                )}
                <div>
                  <p className="text-sm font-semibold">
                    {resuming
                      ? "Your saved paper is ready to restore"
                      : "Your examination is ready when you are"}
                  </p>
                  <p className="mt-0.5 text-xs leading-5 text-background/70">
                    {resuming
                      ? "The attempt is already active. Resume to restore saved answers and the remaining server-calculated time."
                      : `Starting begins the official ${formatDuration(session.durationSeconds)} countdown and allocates an examination attempt.`}
                  </p>
                </div>
              </div>

              <Button
                type="button"
                size="lg"
                variant="secondary"
                className="min-h-12 shrink-0 px-6 font-semibold lg:min-w-56"
                onClick={onStart}
                disabled={!canStart}
              >
                {starting ? (
                  <>
                    <Spinner data-icon="inline-start" />
                    Preparing paper…
                  </>
                ) : resuming ? (
                  <>
                    <RotateCcw data-icon="inline-start" />
                    Resume Examination
                  </>
                ) : (
                  <>
                    <GraduationCap data-icon="inline-start" />
                    Start Examination
                  </>
                )}
              </Button>
            </div>
          </footer>
        </section>

        <footer className="mt-4 flex flex-wrap items-center justify-between gap-3 px-1 text-xs leading-5 text-muted-foreground">
          <span className="inline-flex items-center gap-2">
            <CalendarClock className="size-3.5" aria-hidden="true" />
            {formatAvailability(session.startsAt, session.endsAt)}
          </span>
          <span className="inline-flex items-center gap-2">
            <Clock3 className="size-3.5" aria-hidden="true" />
            {session.questionCount} questions · {formatDuration(session.durationSeconds)}
          </span>
        </footer>
      </div>
    </main>
  );
}
