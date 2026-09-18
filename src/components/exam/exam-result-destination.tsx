"use client";

import {
  CheckCircle2,
  GraduationCap,
  MessageCircleMore,
  School,
} from "lucide-react";
import { useState, useTransition } from "react";
import { selectPlacementClassAction } from "@/app/actions/exam-experience";
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
import { Spinner } from "@/components/ui/spinner";
import { cn } from "@/lib/utils";
import type {
  ExamPlacementOption,
  ExamPlacementTrack,
  ExamResultSummary,
} from "@/types/exam";

function studentTrackLabel(track: ExamPlacementTrack): string {
  if (track === "science") return "Science";
  if (track === "humanities") return "Art";
  return "Commercial";
}

function placementOptionLabel(option: ExamPlacementOption): string {
  return `SS1 ${studentTrackLabel(option.track)} · Arm ${option.arm}`;
}

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
            yet. Your class is still saved; return later after the school
            configures the group.
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
  const placement = summary.placement;
  const isPlacement = destination.kind === "placement";
  const needsChoice = isPlacement && !destination.classId;
  const cover = appearance === "cover";
  const Icon = isPlacement ? GraduationCap : School;

  const title = isPlacement
    ? destination.classId
      ? destination.classLabel
      : placement?.scienceEligible
        ? "Science qualified"
        : "Choose Art or Commercial"
    : destination.classLabel;

  const description = isPlacement
    ? destination.classId
      ? placement?.scienceEligible && destination.track !== "science"
        ? `You qualified for Science and chose ${destination.classLabel}. Your saved class now controls the group you join.`
        : `${destination.classLabel} is saved as your SS1 class. You can join the class group when it is available.`
      : placement?.scienceEligible
        ? "Your placement score is above 55%, so Science is the default placement. If Science cannot be finalized automatically, choose the Science class below or select Art or Commercial instead."
        : "Your placement score does not auto-place you in Science. Choose the Art or Commercial class you want to join."
    : "This examination remains linked to the class already confirmed on your student record.";

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
          {isPlacement
            ? needsChoice
              ? "Placement result"
              : "Placement complete"
            : "Exam complete"}
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
            {title}
          </h2>
          <p
            className={cn(
              "mt-2 max-w-xl text-sm leading-6",
              cover
                ? "text-result-cover-foreground/72"
                : "text-muted-foreground",
            )}
          >
            {description}
          </p>
        </div>
      </div>

      {isPlacement && placement ? (
        <Progress
          value={placement.score}
          aria-label={`Placement score ${Math.round(placement.score)}%`}
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
            Placement score
          </ProgressLabel>
          <span
            className={cn(
              "ml-auto text-sm font-semibold tabular-nums",
              cover ? "text-result-cover-foreground" : undefined,
            )}
          >
            {Math.round(placement.score)}%
          </span>
        </Progress>
      ) : null}
    </div>
  );
}

export function PlacementClassActions({
  summary,
  onRefresh,
  appearance = "cover",
}: {
  summary: ExamResultSummary;
  onRefresh: () => Promise<boolean>;
  appearance?: "paper" | "cover";
}) {
  const destination = summary.destination;
  const placement = summary.placement;
  const [pending, startTransition] = useTransition();
  const [pendingClassId, setPendingClassId] = useState<string | null>(null);
  const [dialogMessage, setDialogMessage] = useState<string | null>(null);
  const cover = appearance === "cover";

  if (destination.kind !== "placement" || !placement) {
    return (
      <JoinClassGroupAction
        classLabel={destination.classLabel}
        groupName={destination.whatsappName}
        whatsappUrl={destination.whatsappUrl}
        appearance={appearance}
      />
    );
  }

  const alternativeOptions =
    destination.classId && destination.track === "science" && placement.scienceEligible
      ? placement.options.filter((option) => option.track !== "science")
      : destination.classId
        ? []
        : placement.options;

  function chooseClass(option: ExamPlacementOption) {
    setPendingClassId(option.classId);
    setDialogMessage(null);
    startTransition(async () => {
      const result = await selectPlacementClassAction(
        summary.attemptId,
        option.classId,
      );
      if (!result.ok) {
        setDialogMessage(result.error);
        setPendingClassId(null);
        return;
      }

      await onRefresh();
      setPendingClassId(null);

      if (result.whatsappUrl) {
        window.location.assign(result.whatsappUrl);
        return;
      }

      setDialogMessage(
        `${placementOptionLabel(option)} is saved, but its WhatsApp group is not available yet.`,
      );
    });
  }

  return (
    <div className="grid gap-4">
      {destination.classId ? (
        <JoinClassGroupAction
          classLabel={destination.classLabel}
          groupName={destination.whatsappName}
          whatsappUrl={destination.whatsappUrl}
          appearance={appearance}
        />
      ) : null}

      {alternativeOptions.length ? (
        <div
          className={cn(
            "grid gap-2 rounded-2xl border p-3",
            cover
              ? "border-result-cover-foreground/20 bg-result-cover-foreground/8"
              : "bg-muted/25",
          )}
        >
          <div>
            <p
              className={cn(
                "text-xs font-bold uppercase tracking-[0.13em]",
                cover
                  ? "text-result-cover-foreground/65"
                  : "text-muted-foreground",
              )}
            >
              {destination.classId ? "Prefer another class?" : "Choose your class"}
            </p>
            <p
              className={cn(
                "mt-1 text-xs leading-5",
                cover
                  ? "text-result-cover-foreground/70"
                  : "text-muted-foreground",
              )}
            >
              {placement.scienceEligible
                ? "Science is available from your score. You may still choose Art or Commercial."
                : "Choose Art or Commercial to save your SS1 class and continue to its group."}
            </p>
          </div>

          <div className="grid gap-2 sm:grid-cols-2">
            {alternativeOptions.map((option) => (
              <Button
                key={option.classId}
                type="button"
                size="lg"
                variant="outline"
                disabled={pending}
                className={cn(
                  "h-auto min-h-11 justify-between whitespace-normal text-left",
                  cover &&
                    "border-result-cover-foreground/30 bg-transparent text-result-cover-foreground hover:bg-result-cover-foreground/10 hover:text-result-cover-foreground",
                )}
                onClick={() => chooseClass(option)}
              >
                <span>
                  {option.track === "science" && placement.scienceEligible
                    ? "Choose Science"
                    : `Choose ${studentTrackLabel(option.track)}`}
                  <span className="ml-1 opacity-70">· Arm {option.arm}</span>
                </span>
                {pending && pendingClassId === option.classId ? (
                  <Spinner data-icon="inline-end" />
                ) : null}
              </Button>
            ))}
          </div>
        </div>
      ) : null}

      <AlertDialog
        open={Boolean(dialogMessage)}
        onOpenChange={(open) => {
          if (!open) setDialogMessage(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogMedia>
              <MessageCircleMore aria-hidden="true" />
            </AlertDialogMedia>
            <AlertDialogTitle>Class group update</AlertDialogTitle>
            <AlertDialogDescription>{dialogMessage}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogAction>Okay</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
