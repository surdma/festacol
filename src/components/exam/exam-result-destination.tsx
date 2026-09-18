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
import type { ExamResultSummary } from "@/types/exam";

function JoinClassGroupAction({
  classLabel,
  groupName,
  whatsappUrl,
}: {
  classLabel: string;
  groupName: string | null;
  whatsappUrl: string | null;
}) {
  if (whatsappUrl) {
    return (
      <Button
        size="lg"
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
      <AlertDialogTrigger render={<Button size="lg" />}>
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

export function ExamResultDestination({
  summary,
  onDashboard,
}: {
  summary: ExamResultSummary;
  onDashboard: () => void;
}) {
  const destination = summary.destination;
  const isPlacement = destination.kind === "placement";
  const Icon = isPlacement ? GraduationCap : School;

  return (
    <section
      aria-labelledby="result-destination-title"
      className="animate-result-stamp overflow-hidden rounded-[2rem] border border-result-placement/30 bg-card"
    >
      <div className="border-b border-border bg-result-placement/10 px-5 py-5 sm:px-7">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Badge
            variant="outline"
            className="border-result-placement/35 bg-result-placement/10 text-foreground"
          >
            <CheckCircle2 data-icon="inline-start" />
            {isPlacement ? "Placement complete" : "Exam complete"}
          </Badge>
          <span className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
            Next step
          </span>
        </div>

        <div className="mt-5 flex items-start gap-4">
          <span className="grid size-12 shrink-0 place-items-center rounded-2xl bg-result-placement text-result-placement-foreground shadow-sm">
            <Icon className="size-6" aria-hidden="true" />
          </span>
          <div className="min-w-0">
            <p className="text-xs font-bold uppercase tracking-[0.14em] text-muted-foreground">
              {isPlacement ? "Your SS1 placement" : "Your class"}
            </p>
            <h1
              id="result-destination-title"
              className="mt-1 break-words text-2xl font-black tracking-tight sm:text-3xl"
            >
              {destination.classLabel}
            </h1>
            <p className="mt-2 max-w-xl text-sm leading-6 text-muted-foreground">
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
            className="mt-6 [&_[data-slot=progress-indicator]]:bg-result-placement"
          >
            <ProgressLabel>Placement confidence</ProgressLabel>
            <span className="ml-auto text-sm font-semibold tabular-nums">
              {Math.round(summary.placement.confidence)}%
            </span>
          </Progress>
        ) : null}
      </div>

      <div className="grid gap-2 px-5 py-5 sm:grid-cols-2 sm:px-7 sm:py-6">
        <JoinClassGroupAction
          classLabel={destination.classLabel}
          groupName={destination.whatsappName}
          whatsappUrl={destination.whatsappUrl}
        />
        <Button type="button" size="lg" variant="outline" onClick={onDashboard}>
          Return to dashboard
        </Button>
      </div>
    </section>
  );
}
