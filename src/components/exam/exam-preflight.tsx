"use client";

import {
  Check,
  ChevronDown,
  CircleAlert,
  FileText,
  ShieldCheck,
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

function BookFact({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="min-w-0">
      <dt className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
        {label}
      </dt>
      <dd className="mt-1 text-sm font-semibold leading-5 text-foreground">
        {value}
      </dd>
    </div>
  );
}

function BookRule({ number, children }: { number: string; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[2rem_minmax(0,1fr)] gap-3 border-b border-border/70 py-4 last:border-b-0">
      <span className="font-mono text-xs font-semibold text-muted-foreground">{number}</span>
      <p className="text-sm leading-6 text-foreground">{children}</p>
    </div>
  );
}

export function ExamPreflight({
  context,
  camera,
  online,
  cameraSupported,
  onStart,
  starting,
  error,
}: {
  context: ExamExperienceContext;
  camera: CameraController;
  online: boolean;
  cameraSupported: boolean;
  onStart: () => void;
  starting: boolean;
  error: string | null;
}) {
  const { session, candidate, subjectNames, access, cameraRequired } = context;
  const resuming = Boolean(access.activeAttemptId);
  const remainingAttempts = Math.max(0, access.allowedAttempts - access.usedAttempts);
  const subjects = subjectNames.length ? subjectNames.join(" · ") : modeLabel(session.mode);
  const academicPeriod = [session.academicSession, session.term].filter(Boolean).join(" · ");
  const canStart = online && (!cameraRequired || camera.ready) && !starting;

  const readinessLabel = !online
    ? "Reconnect to continue"
    : cameraRequired && !camera.ready
      ? "Camera required"
      : "Ready to write";

  return (
    <main className="min-h-dvh overflow-x-hidden bg-muted/20 px-3 py-5 text-foreground sm:px-5 sm:py-8 lg:px-8 lg:py-10">
      <section className="mx-auto flex min-h-[calc(100dvh-2.5rem)] w-full max-w-[1240px] items-center sm:min-h-[calc(100dvh-4rem)]">
        <div className="relative w-full pb-0 lg:pb-12">
          <div className="relative border border-border bg-background shadow-2xl">
            <div
              className="pointer-events-none absolute inset-y-0 left-1/2 z-10 hidden w-10 -translate-x-1/2 bg-gradient-to-r from-transparent via-muted/55 to-transparent lg:block"
              aria-hidden="true"
            />
            <div
              className="pointer-events-none absolute inset-y-0 left-1/2 z-20 hidden w-px -translate-x-1/2 bg-border lg:block"
              aria-hidden="true"
            />

            <div className="grid lg:grid-cols-2">
              <article className="relative flex min-h-[39rem] flex-col border-b bg-gradient-to-r from-background via-background to-muted/30 p-6 sm:p-9 lg:min-h-[42rem] lg:border-b-0 lg:border-r lg:p-12">
                <div className="relative max-w-xl">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                    Examination booklet · {modeLabel(session.mode)}
                  </p>
                  <h1 className="mt-8 max-w-lg font-serif text-4xl font-medium leading-[0.94] tracking-[-0.045em] sm:mt-10 sm:text-5xl lg:text-6xl">
                    {session.title}
                  </h1>
                  <p className="mt-4 max-w-lg text-sm font-medium leading-6 text-muted-foreground">
                    {subjects}
                  </p>
                  {academicPeriod ? (
                    <p className="mt-1 text-xs leading-5 text-muted-foreground">{academicPeriod}</p>
                  ) : null}
                </div>

                <div className="relative mt-auto pt-12">
                  <dl className="grid grid-cols-2 gap-x-8 gap-y-5 border-t-2 border-foreground pt-5 sm:grid-cols-4 lg:grid-cols-2">
                    <BookFact label="Candidate" value={candidate.fullName} />
                    <BookFact label="Class" value={candidate.classLabel} />
                    <BookFact label="Questions" value={session.questionCount} />
                    <BookFact label="Duration" value={formatDuration(session.durationSeconds)} />
                  </dl>

                  <div className="mt-6 border-t border-dashed border-border pt-4 text-[11px] leading-5 text-muted-foreground">
                    <p>
                      <span className="font-semibold text-foreground">Window:</span>{" "}
                      {formatAvailability(session.startsAt, session.endsAt)}
                    </p>
                    <p className="mt-1">
                      <span className="font-semibold text-foreground">Attempt:</span>{" "}
                      {resuming
                        ? "Already in progress — Resume Examination returns to the saved paper and server-calculated time."
                        : `${remainingAttempts} of ${access.allowedAttempts} available. Opening this booklet does not use one.`}
                    </p>
                    {session.mode === "qualifier" && session.placementTracks.length ? (
                      <p className="mt-1">
                        <span className="font-semibold text-foreground">Placement:</span>{" "}
                        {session.placementTracks.join(" · ")}
                      </p>
                    ) : null}
                  </div>
                </div>
              </article>

              <article className="flex min-h-[39rem] flex-col bg-gradient-to-r from-muted/30 via-background to-background p-6 sm:p-9 lg:min-h-[42rem] lg:p-12">
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                    Inside cover · read once
                  </p>
                  <div className="mt-5 border-t border-border/80">
                    <BookRule number="1">
                      Answer in any order. Use the navigator to move around the paper, and flag a question when you want to return to it.
                    </BookRule>
                    <BookRule number="2">
                      Your work saves quietly while you write. If the connection drops, keep the examination open while Festacol reconnects.
                    </BookRule>
                    <BookRule number="3">
                      Review unanswered or flagged questions before final submission. When the official time reaches zero, saved responses are finalized.
                    </BookRule>
                  </div>

                  {session.instructions.trim() ? (
                    <Collapsible className="border-b border-border/70">
                      <CollapsibleTrigger className="flex min-h-12 w-full items-center justify-between gap-4 py-3 text-left">
                        <span className="flex min-w-0 items-center gap-2">
                          <FileText className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                          <span className="text-xs font-semibold uppercase tracking-[0.12em]">School note</span>
                        </span>
                        <ChevronDown className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                      </CollapsibleTrigger>
                      <CollapsibleContent className="pb-4">
                        <p className="whitespace-pre-line border-l-2 border-border pl-4 text-sm leading-6 text-muted-foreground">
                          {session.instructions}
                        </p>
                      </CollapsibleContent>
                    </Collapsible>
                  ) : null}
                </div>

                <div className="mt-auto pt-8">
                  {!online ? (
                    <Alert variant="destructive">
                      <WifiOff />
                      <AlertTitle>Reconnect to continue</AlertTitle>
                      <AlertDescription>
                        Keep this page open and reconnect before {resuming ? "resuming" : "starting"} the examination.
                      </AlertDescription>
                    </Alert>
                  ) : cameraRequired && !cameraSupported ? (
                    <Alert variant="destructive">
                      <CircleAlert />
                      <AlertTitle>This examination needs a camera</AlertTitle>
                      <AlertDescription>
                        This browser cannot provide webcam access. Use a supported browser or device before continuing.
                      </AlertDescription>
                    </Alert>
                  ) : cameraRequired ? (
                    <ExamCameraPanel
                      required
                      variant="booklet"
                      status={camera.status}
                      stream={camera.stream}
                      devices={camera.devices}
                      deviceId={camera.deviceId}
                      error={camera.error}
                      onStart={() => void camera.start()}
                      onSelectDevice={(deviceId) => void camera.selectDevice(deviceId)}
                    />
                  ) : null}

                  <div className="mt-5 flex flex-wrap items-end justify-between gap-4 border-t border-dashed border-border pt-5">
                    <div>
                      <span className="inline-block border-4 border-double border-foreground px-3 py-2 font-serif text-base font-semibold uppercase tracking-[0.12em]">
                        {readinessLabel}
                      </span>
                    </div>
                    <ShieldCheck className="size-5 text-muted-foreground" aria-hidden="true" />
                  </div>

                  {error ? (
                    <Alert variant="destructive" className="mt-4">
                      <CircleAlert />
                      <AlertTitle>Cannot {resuming ? "resume" : "start"} yet</AlertTitle>
                      <AlertDescription>{error}</AlertDescription>
                    </Alert>
                  ) : null}
                </div>
              </article>
            </div>
          </div>

          <footer className="border-t-2 border-dashed border-background/40 bg-foreground px-5 py-4 text-background shadow-xl lg:absolute lg:-bottom-1 lg:left-[8%] lg:right-[8%] sm:px-7">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="max-w-2xl">
                <p className="text-sm font-semibold">
                  {resuming ? "Return to your active paper" : "Open the examination paper"}
                </p>
                <p className="mt-1 text-xs leading-5 text-background/70">
                  {resuming
                    ? "Resume restores your saved answers, question position and remaining server-calculated time."
                    : "Starting allocates the attempt and begins the official countdown. Opening this booklet alone does not."}
                </p>
              </div>
              <Button
                type="button"
                size="lg"
                variant="secondary"
                className="min-h-12 shrink-0 px-6"
                onClick={onStart}
                disabled={!canStart}
              >
                {starting ? <Spinner data-icon="inline-start" /> : <Check data-icon="inline-start" />}
                {starting
                  ? resuming
                    ? "Restoring paper…"
                    : "Preparing paper…"
                  : resuming
                    ? "Resume Examination"
                    : "Start Examination"}
              </Button>
            </div>
          </footer>
        </div>
      </section>
    </main>
  );
}
