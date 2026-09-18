"use client";

import {
  CheckCircle2,
  GraduationCap,
  MessageCircleMore,
  School,
} from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogMedia,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress, ProgressLabel } from "@/components/ui/progress";
import { cn } from "@/lib/utils";
import type { ExamResultSummary } from "@/types/exam";

export function JoinClassGroupAction({
  classLabel,
  groupName,
  whatsappUrl,
  appearance = "paper",
}: {
  classLabel: string;
  groupName: string | null;
  whatsappUrl: string | null;
  appearance?: "paper" | "cover";
}) {
  const buttonClassName =
    appearance === "cover"
      ? "bg-result-cover-foreground text-result-cover hover:bg-result-cover-foreground/90"
      : undefined;

  if (whatsappUrl) {
    return (
      <Button
        size="lg"
        className={buttonClassName}
        render={
          <a
            href={whatsappUrl}
            aria-label={`Join ${groupName ?? classLabel} WhatsApp group`}
          />
        }
      >
        <MessageCircleMore data-icon="inline-start" />
        Join group
      </Button>
    );
  }

  return (
    <AlertDialog>
      <AlertDialogTrigger
        render={<Button size="lg" className={buttonClassName} />}
      >
        <MessageCircleMore data-icon="inline-start" />
        Join group
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogMedia>
            <MessageCircleMore aria-hidden="true" />
          </AlertDialogMedia>
          <AlertDialogTitle>WhatsApp group unavailable</AlertDialogTitle>
          <AlertDialogDescription>
            The official WhatsApp group for {classLabel} has not been published
            yet. You can return later after your school configures the group.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogAction>Okay</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

export function ResultDestinationSummary({
  summary,
  appearance = "paper",
}: {
  summary: ExamResultSummary;
  appearance?: "paper" | "cover";
}) {
  const destination = summary.destination;
  const isPlacement = destination.kind === "placement";
  const Icon = isPlacement ? GraduationCap : School;
  const cover = appearance === "cover";

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Badge
          variant="outline"
          className={cn(
            cover
              ? "border-result-cover-foreground/25 bg-result-cover-foreground/10 text-result-cover-foreground"
              : "border-result-placement/35 bg-result-placement/10 text-foreground",
          )}
        >
          <CheckCircle2 data-icon="inline-start" />
          {isPlacement ? "Placement complete" : "Exam complete"}
        </Badge>
        <span
          className={cn(
            "text-xs font-semibold uppercase tracking-[0.14em]",
            cover
              ? "text-result-cover-foreground/60"
              : "text-muted-foreground",
          )}
        >
          Next step
        </span>
      </div>

      <div className="mt-5 flex items-start gap-4">
        <span
          className={cn(
            "grid size-12 shrink-0 place-items-center rounded-2xl shadow-sm",
            cover
              ? "bg-result-cover-foreground/12 text-result-cover-foreground"
              : "bg-result-placement text-result-placement-foreground",
          )}
        >
          <Icon className="size-6" aria-hidden="true" />
        </span>
        <div className="min-w-0">
          <p
            className={cn(
              "text-xs font-bold uppercase tracking-[0.14em]",
              cover
                ? "text-result-cover-foreground/60"
                : "text-muted-foreground",
            )}
          >
            {isPlacement ? "Your SS1 placement" : "Your class"}
          </p>
          <h2
            className={cn(
              "mt-1 break-words text-2xl font-black tracking-tight sm:text-3xl",
              cover ? "text-result-cover-foreground" : "text-foreground",
            )}
          >
            {destination.classLabel}
          </h2>
          <p
            className={cn(
              "mt-2 max-w-xl text-sm leading-6",
              cover
                ? "text-result-cover-foreground/72"
                : "text-muted-foreground",
            )}
          >
            {isPlacement
              ? "Your placement result determines the pathway shown above. The class group follows the specific SS1 class linked to that pathway."
              : "This examination remains linked to the class already confirmed on your student record."}
          </p>
        </div>
      </div>

      {isPlacement && summary.placement ? (
        <Progress
          value={summary.placement.confidence}
          aria-label={`Placement confidence ${Math.round(summary.placement.confidence)}%`}
          className={cn(
            "mt-6",
            cover
              ? "[&_[data-slot=progress-indicator]]:bg-result-cover-foreground [&_[data-slot=progress-track]]:bg-result-cover-foreground/20"
              : "[&_[data-slot=progress-indicator]]:bg-result-placement",
          )}
        >
          <ProgressLabel
            className={cover ? "text-result-cover-foreground" : undefined}
          >
            Placement confidence
          </ProgressLabel>
          <span
            className={cn(
              "ml-auto text-sm font-semibold tabular-nums",
              cover ? "text-result-cover-foreground" : undefined,
            )}
          >
            {Math.round(summary.placement.confidence)}%
          </span>
        </Progress>
      ) : null}
    </div>
  );
}

export function ExamResultDestination({
  summary,
}: {
  summary: ExamResultSummary;
}) {
  const destination = summary.destination;

  return (
    <section
      aria-label="Result destination"
      className="animate-result-stamp overflow-hidden rounded-[2rem] border border-result-placement/30 bg-card"
    >
      <div className="border-b border-border bg-result-placement/10 px-5 py-5 sm:px-7">
        <ResultDestinationSummary summary={summary} />
      </div>

      <div className="px-5 py-5 sm:px-7 sm:py-6">
        <JoinClassGroupAction
          classLabel={destination.classLabel}
          groupName={destination.whatsappName}
          whatsappUrl={destination.whatsappUrl}
        />
      </div>
    </section>
  );
}
