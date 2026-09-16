"use client";

import { useState } from "react";
import {
  BookOpenText,
  CalendarDays,
  Eye,
  Layers,
  LoaderCircle,
  RefreshCw,
  ShieldCheck,
} from "lucide-react";
import type { SchoolDataManifestItem, SchoolDataSource } from "@/app/actions/fixture-library";
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
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { useSchoolDataLibrary, type PublishedCounts } from "@/hooks/use-school-data-library";

const STEP_META: Record<SchoolDataSource, { step: number; unit: string; icon: typeof BookOpenText; whatItDoes: string }> = {
  subjects: {
    step: 1,
    unit: "subjects",
    icon: BookOpenText,
    whatItDoes: "Adds every approved subject and tags each one for the right classes and study areas.",
  },
  "academic-structure": {
    step: 2,
    unit: "classes",
    icon: CalendarDays,
    whatItDoes: "Sets up the school year, terms and class arms, then links subjects to each class.",
  },
  "question-bank": {
    step: 3,
    unit: "questions",
    icon: Layers,
    whatItDoes: "Adds ready-made exam questions for each subject. Work is saved in small batches so you can watch it finish.",
  },
};

function publishedCount(source: SchoolDataSource, counts: PublishedCounts) {
  if (source === "subjects") return counts.subjects;
  if (source === "academic-structure") return counts.classes;
  return counts.questions;
}

function readinessState(source: SchoolDataSource, counts: PublishedCounts) {
  if (source === "subjects") return { ready: true, label: "Ready to publish" };
  if (source === "academic-structure") {
    return counts.subjects > 0
      ? { ready: true, label: "Subject list is ready" }
      : { ready: false, label: "Publish the subject list first" };
  }
  if (counts.subjects <= 0) return { ready: false, label: "Publish the subject list first" };
  if ((counts.levels ?? 0) <= 0) return { ready: false, label: "Set up classes first" };
  return { ready: true, label: "Subjects and classes are ready" };
}

function PublishConfirmation({
  item,
  ready,
  running,
  queued,
  confirmLabel,
  onConfirm,
}: {
  item: SchoolDataManifestItem;
  ready: boolean;
  running: boolean;
  queued: boolean;
  confirmLabel: string;
  onConfirm: (source: SchoolDataSource) => void;
}) {
  return (
    <AlertDialog>
      <AlertDialogTrigger render={<Button type="button" disabled={!ready} />}>
        {running ? <LoaderCircle data-icon="inline-start" className="animate-spin" /> : <RefreshCw data-icon="inline-start" />}
        {running ? "Publishing…" : queued ? "Queued…" : confirmLabel}
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Publish {item.title.toLowerCase()}?</AlertDialogTitle>
          <AlertDialogDescription>
            This adds the approved school content to the live school records. {item.safeguard}
            {queued ? " It is already waiting and will run by itself." : ""}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Not now</AlertDialogCancel>
          <AlertDialogAction disabled={!ready} onClick={() => onConfirm(item.source)}>
            {queued ? "Keep it queued" : "Publish now"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

function ContentPreviewSheet({
  item,
  counts,
  running,
  queued,
  confirmLabel,
  onConfirm,
}: {
  item: SchoolDataManifestItem;
  counts: PublishedCounts;
  running: boolean;
  queued: boolean;
  confirmLabel: string;
  onConfirm: (source: SchoolDataSource) => void;
}) {
  const meta = STEP_META[item.source];
  const published = publishedCount(item.source, counts);
  const readiness = readinessState(item.source, counts);
  const [open, setOpen] = useState(false);

  function handleConfirm(source: SchoolDataSource) {
    // Dismiss the preview first so the save progress on the main page is visible.
    setOpen(false);
    onConfirm(source);
  }

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger render={<Button type="button" size="sm" variant="outline" />}>
        <Eye data-icon="inline-start" />
        Preview
      </SheetTrigger>
      <SheetContent className="overflow-y-auto data-[side=right]:w-[min(96vw,560px)] data-[side=right]:sm:max-w-[560px]">
        <SheetHeader className="border-b border-border">
          <div className="flex flex-wrap items-center gap-2 pr-8">
            <Badge variant="outline">Step {meta.step}</Badge>
            <Badge variant={readiness.ready ? "secondary" : "destructive"}>
              {readiness.ready ? "Ready" : "Waiting"}
            </Badge>
          </div>
          <SheetTitle className="mt-2 font-display text-xl font-extrabold">{item.title}</SheetTitle>
          <SheetDescription>{item.description}</SheetDescription>
        </SheetHeader>

        <div className="flex flex-col gap-6 px-4 pb-4">
          <section className="rounded-xl border border-border bg-muted/20 p-4">
            <p className="text-[10px] font-bold uppercase tracking-[.14em] text-muted-foreground">Publishing status</p>
            <p className="mt-1 text-2xl font-extrabold tabular-nums text-foreground">
              {published}<span className="text-base font-semibold text-muted-foreground">/{item.bundledRecords}</span>
            </p>
            <p className="mt-1 text-xs leading-5 text-muted-foreground">
              {published} of {item.bundledRecords} {meta.unit} published in the school records.
            </p>
            <Progress value={item.bundledRecords ? Math.min(100, (published / item.bundledRecords) * 100) : 0} className="mt-3" />
            <p className="mt-2 text-xs leading-5 text-muted-foreground">{item.detail}</p>
          </section>

          <section>
            <h3 className="text-sm font-semibold text-foreground">What happens when you publish</h3>
            <p className="mt-1 text-sm leading-6 text-muted-foreground">{meta.whatItDoes}</p>
            <p className="mt-2 text-xs leading-5 text-muted-foreground">{readiness.label}. Publish in order: subject list → school session &amp; classes → exam questions.</p>
          </section>

          <Alert>
            <ShieldCheck />
            <AlertTitle>Safe to publish again</AlertTitle>
            <AlertDescription>{item.safeguard}</AlertDescription>
          </Alert>

          {!readiness.ready ? (
            <Alert variant="destructive">
              <AlertTitle>Please wait</AlertTitle>
              <AlertDescription>{readiness.label} before publishing this section.</AlertDescription>
            </Alert>
          ) : null}
        </div>

        <SheetFooter className="border-t border-border bg-muted/20">
          <PublishConfirmation
            item={item}
            ready={readiness.ready}
            running={running}
            queued={queued}
            confirmLabel={confirmLabel}
            onConfirm={handleConfirm}
          />
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}

export function FixtureLibrary({ manifest, counts }: { manifest: SchoolDataManifestItem[]; counts: PublishedCounts }) {
  const { activeSource, queuedSources, feedback, progress, liveCounts, load } = useSchoolDataLibrary(counts);
  const ordered = [...manifest].sort((a, b) => STEP_META[a.source].step - STEP_META[b.source].step);
  const runningItem = activeSource ? ordered.find((entry) => entry.source === activeSource) : undefined;

  return (
    <section aria-labelledby="study-content-heading">
      <h2 id="study-content-heading" className="sr-only">Publish in order</h2>
      {feedback ? (
        <Alert variant={feedback.tone === "error" ? "destructive" : "default"} className="mb-4">
          <ShieldCheck />
          <AlertTitle>{feedback.tone === "error" ? "Publishing did not finish" : "Publishing finished"}</AlertTitle>
          <AlertDescription>{feedback.message}</AlertDescription>
        </Alert>
      ) : null}

      <ol className="flex flex-col gap-4">
        {ordered.map((item) => {
          const meta = STEP_META[item.source];
          const Icon = meta.icon;
          const published = publishedCount(item.source, liveCounts);
          const readiness = readinessState(item.source, liveCounts);
          const running = activeSource === item.source;
          const queued = queuedSources.includes(item.source);
          const percent = item.bundledRecords ? Math.min(100, Math.round((published / item.bundledRecords) * 100)) : 0;
          const complete = published >= item.bundledRecords && item.bundledRecords > 0;
          const confirmLabel = published > 0 ? "Update" : "Publish";
          const liveProgress = running ? progress : null;
          const livePercent =
            liveProgress?.total && liveProgress.done !== null
              ? Math.min(100, Math.round((liveProgress.done / liveProgress.total) * 100))
              : null;

          return (
            <li key={item.source} className="rounded-2xl border border-border bg-card p-4 sm:p-5">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                <div className="flex min-w-0 items-start gap-3">
                  <span className="grid size-10 shrink-0 place-items-center rounded-xl border border-border bg-muted/30 text-muted-foreground">
                    <Icon className="size-5" />
                  </span>
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-[11px] font-bold uppercase tracking-[.12em] text-muted-foreground">Step {meta.step}</span>
                      <Badge variant={complete ? "secondary" : readiness.ready ? "outline" : "destructive"}>
                        {complete ? "Complete" : running ? "Publishing" : queued ? "Queued" : readiness.ready ? "Ready" : "Waiting"}
                      </Badge>
                    </div>
                    <h3 className="mt-1 font-display text-base font-extrabold text-foreground">{item.title}</h3>
                    <p className="mt-1 max-w-2xl text-sm leading-6 text-muted-foreground">{item.description}</p>
                    {!readiness.ready && !complete ? (
                      <p className="mt-1 text-xs font-medium text-destructive">{readiness.label}.</p>
                    ) : null}
                  </div>
                </div>

                <div className="shrink-0 rounded-xl border border-border bg-muted/20 px-4 py-3 text-left lg:text-right">
                  <p className="text-[10px] font-bold uppercase tracking-[.14em] text-muted-foreground">Published</p>
                  <p className="mt-0.5 text-2xl font-extrabold tabular-nums text-foreground">
                    {published}<span className="text-sm font-semibold text-muted-foreground">/{item.bundledRecords}</span>
                  </p>
                  <p className="text-xs text-muted-foreground">{meta.unit} in school records</p>
                </div>
              </div>

              <div className="mt-4">
                {running && liveProgress ? (
                  <div className="rounded-xl border border-border bg-muted/20 p-3" role="status" aria-live="polite">
                    <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                      <span className="inline-flex items-center gap-2 font-semibold text-foreground">
                        <LoaderCircle className="size-3.5 animate-spin" />
                        {liveProgress.label}
                      </span>
                      <span className="font-semibold tabular-nums text-muted-foreground">
                        {livePercent !== null ? `${livePercent}%` : "Working…"}
                      </span>
                    </div>
                    <Progress
                      value={livePercent}
                      className="mt-2"
                    />
                    <p className="mt-1.5 text-[11px] leading-5 text-muted-foreground">
                      Keep this page open while the school records are being updated. The numbers above refresh by themselves.
                    </p>
                  </div>
                ) : (
                  <>
                    <Progress value={percent} />
                    <p className="mt-1.5 text-xs tabular-nums text-muted-foreground">
                      {published}/{item.bundledRecords} {meta.unit} published{complete ? " — all done" : ""}
                    </p>
                  </>
                )}
              </div>

              <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-border pt-4">
                <div className="min-w-0">
                  <p className="text-xs leading-5 text-muted-foreground">{item.detail}</p>
                  {queued && !running ? (
                    <p className="mt-1 text-xs font-medium text-foreground">
                      Waiting — runs by itself{runningItem ? ` after ${runningItem.title.toLowerCase()}` : ""}.
                    </p>
                  ) : null}
                </div>
                <div className="flex flex-wrap gap-2">
                  <ContentPreviewSheet
                    item={item}
                    counts={liveCounts}
                    running={running}
                    queued={queued}
                    confirmLabel={confirmLabel}
                    onConfirm={load}
                  />
                  <PublishConfirmation
                    item={item}
                    ready={readiness.ready}
                    running={running}
                    queued={queued}
                    confirmLabel={confirmLabel}
                    onConfirm={load}
                  />
                </div>
              </div>
            </li>
          );
        })}
      </ol>

      <p className="mt-4 text-xs leading-5 text-muted-foreground">
        Publish in order: subject list → school session &amp; classes → exam questions. Work already published is kept safe when you update a section.
      </p>
    </section>
  );
}
