import Link from "next/link";
import { CircleAlert, FileWarning } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";

export function ExamEntryUnavailable({
  message,
  retryHref,
}: {
  message: string;
  retryHref?: string;
}) {
  return (
    <main className="grid min-h-dvh place-items-center bg-muted/35 px-4 py-8">
      <section className="w-full max-w-3xl overflow-hidden rounded-[1.75rem] border-2 border-foreground bg-card shadow-2xl motion-safe:animate-admin-enter">
        <div className="border-b-2 border-dashed border-foreground/35 p-6 sm:p-9">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <span className="grid size-11 place-items-center rounded-xl bg-foreground font-display text-sm font-black text-background">F</span>
              <div>
                <p className="font-display text-sm font-extrabold">Festacol Assessment Office</p>
                <p className="text-[11px] text-muted-foreground">Electronic examination access</p>
              </div>
            </div>
            <span className="inline-flex min-h-9 items-center gap-2 rounded-full border border-destructive/30 bg-destructive/10 px-3 text-xs font-semibold text-destructive">
              <CircleAlert className="size-4" aria-hidden="true" />
              Examination access unavailable
            </span>
          </div>
        </div>

        <div className="grid gap-8 p-6 sm:p-9 md:grid-cols-[auto_minmax(0,1fr)] md:items-start">
          <span className="grid size-14 place-items-center rounded-2xl border border-foreground/15 bg-muted text-muted-foreground">
            <FileWarning className="size-7" aria-hidden="true" />
          </span>
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-muted-foreground">Examination admission pass</p>
            <h1 className="mt-3 font-display text-3xl font-black tracking-[-0.035em] sm:text-4xl">This examination pass cannot be used yet.</h1>
            <p className="mt-4 max-w-2xl text-sm leading-7 text-muted-foreground">{message}</p>
            <p className="mt-3 max-w-2xl text-xs leading-6 text-muted-foreground">
              If the examination should be available, confirm the QR code or access link with your examination teacher before trying again.
            </p>
            <div className="mt-7 flex flex-wrap gap-2">
              {retryHref ? (
                <Link href={retryHref} className={buttonVariants({ size: "lg" })}>
                  Check examination access again
                </Link>
              ) : null}
              <Link href="/" className={buttonVariants({ variant: "outline", size: "lg" })}>
                Return to student sign-in
              </Link>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
