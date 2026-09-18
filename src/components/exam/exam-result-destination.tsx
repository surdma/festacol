"use client";

import {
  ArrowRight,
  CheckCircle2,
  Clock3,
  GraduationCap,
  MessageCircleMore,
  School,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress, ProgressLabel } from "@/components/ui/progress";
import type { ExamResultSummary } from "@/types/exam";

export function ExamResultDestination({
  summary,
  onDashboard,
}: {
  summary: ExamResultSummary;
  onDashboard: () => void;
}) {
  const destination = summary.destination;
  const isPlacement = destination.kind === "placement";
  const hasWhatsapp = Boolean(destination.whatsappUrl);
  const Icon = isPlacement ? GraduationCap : School;

  return (
    <section
      aria-labelledby="result-destination-title"
      className="animate-result-stamp overflow-hidden rounded-[2rem] border border-result-placement/30 bg-card shadow-xl"
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
                ? "Your result has been matched to the school pathway shown above. Your class community link becomes available as soon as the matching class group is configured."
                : "This exam remains connected to the class already confirmed on your student record."}
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

      <div className="grid gap-4 px-5 py-5 sm:px-7 sm:py-6">
        <div className="rounded-2xl border bg-muted/25 p-4">
          <div className="flex items-start gap-3">
            <MessageCircleMore className="mt-0.5 size-5 shrink-0 text-muted-foreground" aria-hidden="true" />
            <div className="min-w-0">
              <p className="text-sm font-bold">
                {destination.whatsappName ?? "Class WhatsApp group"}
              </p>
              <p className="mt-1 text-xs leading-5 text-muted-foreground">
                {hasWhatsapp
                  ? "Open the official group configured for this class."
                  : destination.classId
                    ? "The class is confirmed, but its WhatsApp group has not been published yet."
                    : isPlacement
                      ? "Your pathway is confirmed. The group will appear after Festacol can resolve one specific SS1 class."
                      : "A WhatsApp group will appear when one is configured for your confirmed class."}
              </p>
            </div>
          </div>
        </div>

        <div className="grid gap-2 sm:grid-cols-2">
          {destination.whatsappUrl ? (
            <Button
              size="lg"
              render={
                <a
                  href={destination.whatsappUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={`Open ${destination.whatsappName ?? destination.classLabel} WhatsApp group`}
                />
              }
            >
              <MessageCircleMore data-icon="inline-start" />
              Open WhatsApp group
              <ArrowRight data-icon="inline-end" />
            </Button>
          ) : (
            <Button size="lg" disabled>
              <Clock3 data-icon="inline-start" />
              WhatsApp group coming soon
            </Button>
          )}

          <Button type="button" size="lg" variant="outline" onClick={onDashboard}>
            Return to dashboard
          </Button>
        </div>
      </div>
    </section>
  );
}
