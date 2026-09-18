"use client";

import {
  CalendarClock,
  CheckCircle2,
  GraduationCap,
  LifeBuoy,
  QrCode,
  ShieldCheck,
} from "lucide-react";
import { useEffect, useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import type { ExamEntryContext } from "@/app/actions/exam-onboarding";
import { StudentLoginForm } from "@/app/login-form";
import { ExamHelpDialog } from "@/components/exam/exam-help-dialog";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";

function modeLabel(mode: string) {
  if (mode === "qualifier") return "Entrance and placement examination";
  if (mode === "single") return "Single-subject examination";
  if (mode === "mixed") return "Multi-subject examination";
  if (mode === "bece") return "BECE examination";
  if (mode === "waec") return "WAEC examination";
  if (mode === "neco") return "NECO examination";
  if (mode === "jamb") return "JAMB examination";
  return "Academic examination";
}

const schoolDateTime = new Intl.DateTimeFormat("en-NG", {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: "Africa/Lagos",
});

function examinationWindow(startsAt: number | null, endsAt: number | null) {
  if (!startsAt && !endsAt) return "Open examination window";
  if (startsAt && endsAt) {
    return `${schoolDateTime.format(new Date(startsAt))} – ${schoolDateTime.format(new Date(endsAt))}`;
  }
  if (startsAt) return `Opened ${schoolDateTime.format(new Date(startsAt))}`;
  return `Closes ${schoolDateTime.format(new Date(endsAt ?? 0))}`;
}

function PassDetail({
  label,
  value,
  icon,
}: {
  label: string;
  value: string;
  icon: React.ReactNode;
}) {
  return (
    <div className="grid grid-cols-[2.5rem_minmax(0,1fr)] gap-3 border-b border-foreground/10 py-3.5 last:border-b-0">
      <span className="grid size-10 place-items-center rounded-xl bg-muted text-muted-foreground">
        {icon}
      </span>
      <div className="min-w-0">
        <dt className="text-[10px] font-bold uppercase tracking-[0.16em] text-muted-foreground">
          {label}
        </dt>
        <dd className="mt-1 text-sm font-semibold leading-6 text-foreground">{value}</dd>
      </div>
    </div>
  );
}

export function ExamAdmissionPass({
  exam,
  token,
  destination,
}: {
  exam: ExamEntryContext;
  token: string;
  destination: string;
}) {
  const [qrValue, setQrValue] = useState<string | null>(null);
  const [candidateName, setCandidateName] = useState("");
  const [helpOpen, setHelpOpen] = useState(false);

  useEffect(() => {
    setQrValue(new URL(destination, window.location.origin).toString());
  }, [destination]);

  return (
    <main className="min-h-dvh bg-muted/35 px-3 py-3 text-foreground sm:px-6 sm:py-6 lg:grid lg:place-items-center lg:px-8">
      <div className="mx-auto w-full max-w-7xl motion-safe:animate-admin-enter">
        <div className="relative grid overflow-hidden rounded-[1.75rem] border-2 border-foreground bg-card shadow-2xl lg:grid-cols-[minmax(0,1.35fr)_minmax(22rem,.65fr)]">
          <section className="relative order-2 flex min-h-[36rem] flex-col justify-between gap-10 p-5 sm:p-8 lg:order-1 lg:min-h-[46rem] lg:border-r-2 lg:border-dashed lg:border-foreground/40 lg:p-12 xl:p-14">
            <div aria-hidden="true" className="absolute -right-4 top-20 hidden size-7 rounded-full border-2 border-foreground bg-background lg:block" />
            <div aria-hidden="true" className="absolute -right-4 bottom-20 hidden size-7 rounded-full border-2 border-foreground bg-background lg:block" />

            <div>
              <div className="flex flex-wrap items-start justify-between gap-4 border-b-2 border-foreground pb-5">
                <div className="flex items-center gap-3">
                  <span className="grid size-11 place-items-center rounded-xl bg-foreground font-display text-sm font-black text-background">
                    F
                  </span>
                  <div>
                    <p className="font-display text-sm font-extrabold">Festacol Assessment Office</p>
                    <p className="mt-0.5 text-[11px] font-medium text-muted-foreground">Electronic examination access</p>
                  </div>
                </div>
                <span className="inline-flex min-h-9 items-center gap-2 rounded-full border border-success-border bg-success px-3 text-xs font-semibold text-success-foreground">
                  <CheckCircle2 className="size-4" aria-hidden="true" />
                  Examination link verified
                </span>
              </div>

              <div className="pt-8 sm:pt-10">
                <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-muted-foreground">
                  Official examination admission pass
                </p>
                <h1 className="mt-4 max-w-4xl font-display text-4xl font-black leading-[0.98] tracking-[-0.045em] text-balance sm:text-5xl lg:text-6xl xl:text-7xl">
                  {exam.title}
                </h1>
                <p className="mt-5 max-w-2xl text-sm leading-7 text-muted-foreground sm:text-base">
                  This access pass confirms the examination link. Candidate identity and academic eligibility are verified before the examination paper is opened.
                </p>
              </div>

              <dl className="mt-8 grid border-y-2 border-foreground sm:grid-cols-2 sm:gap-x-8">
                <PassDetail
                  icon={<GraduationCap className="size-4" aria-hidden="true" />}
                  label="Examination mode"
                  value={modeLabel(exam.mode)}
                />
                <PassDetail
                  icon={<CalendarClock className="size-4" aria-hidden="true" />}
                  label="Examination window"
                  value={examinationWindow(exam.startsAt, exam.endsAt)}
                />
                <PassDetail
                  icon={<ShieldCheck className="size-4" aria-hidden="true" />}
                  label="Access status"
                  value="Open for candidate identity confirmation"
                />
                <PassDetail
                  icon={<QrCode className="size-4" aria-hidden="true" />}
                  label="Examination ID"
                  value={exam.id}
                />
              </dl>
            </div>

            <div className="grid gap-5 border-t border-foreground/15 pt-6 sm:grid-cols-[auto_minmax(0,1fr)] sm:items-center sm:gap-6">
              <div className="w-fit rounded-2xl border-2 border-foreground bg-white p-3 shadow-sm" role="img" aria-label="QR code for this examination access link">
                {qrValue ? (
                  <QRCodeSVG
                    value={qrValue}
                    size={148}
                    level="M"
                    className="size-32 sm:size-36"
                  />
                ) : (
                  <Skeleton className="size-32 rounded-md sm:size-36" />
                )}
              </div>
              <div className="max-w-xl">
                <p className="text-xs font-bold uppercase tracking-[0.14em] text-foreground">Examination QR access</p>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">
                  This QR code opens this exact examination access link on another device. It does not bypass candidate identity or academic eligibility checks.
                </p>
                <p className="mt-3 font-mono text-[10px] leading-5 text-muted-foreground break-all">
                  {qrValue ?? "Preparing verified examination address…"}
                </p>
              </div>
            </div>
          </section>

          <aside className="relative order-1 flex flex-col justify-start border-b-2 border-dashed border-foreground/40 bg-muted/20 p-5 motion-safe:animate-admin-pop motion-safe:[animation-delay:80ms] sm:p-8 lg:order-2 lg:justify-center lg:border-b-0 lg:p-10 xl:p-12">
            <div aria-hidden="true" className="absolute -bottom-4 left-10 size-7 rounded-full border-2 border-foreground bg-background lg:hidden" />
            <div aria-hidden="true" className="absolute -bottom-4 right-10 size-7 rounded-full border-2 border-foreground bg-background lg:hidden" />

            <div className="mx-auto w-full max-w-md">
              <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-muted-foreground">Candidate identity</p>
              <h2 className="mt-2 font-display text-2xl font-black tracking-[-0.035em] sm:mt-3 sm:text-4xl">Confirm it is you.</h2>
              <p className="mt-2 text-xs leading-5 text-muted-foreground sm:mt-3 sm:text-sm sm:leading-6">
                Use the same candidate credentials used for the Festacol student workspace. You will return directly to this examination after identity confirmation.
              </p>

              <div className="mt-5 sm:mt-7">
                <StudentLoginForm
                  next={destination}
                  submitLabel="Continue to examination"
                  onIdentityChange={({ firstName, lastName }) => {
                    setCandidateName(`${firstName} ${lastName}`.trim());
                  }}
                />
              </div>

              <div className="mt-7 border-t border-foreground/15 pt-5">
                <p className="text-xs font-semibold text-foreground">Unable to continue?</p>
                <p className="mt-1 text-xs leading-5 text-muted-foreground">
                  Send an examination support request to the staff member who created this examination.
                </p>
                <Button
                  type="button"
                  variant="outline"
                  className="mt-4 w-full justify-center"
                  onClick={() => setHelpOpen(true)}
                >
                  <LifeBuoy data-icon="inline-start" />
                  Need examination help?
                </Button>
              </div>

              <p className="mt-6 text-[11px] leading-5 text-muted-foreground">
                Examination subjects, duration, question count and attempt information are shown only after candidate identity and academic eligibility are confirmed.
              </p>
            </div>
          </aside>
        </div>
      </div>

      <ExamHelpDialog
        open={helpOpen}
        onOpenChange={setHelpOpen}
        token={token}
        examTitle={exam.title}
        defaultRequesterName={candidateName}
      />
    </main>
  );
}
