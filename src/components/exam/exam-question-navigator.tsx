"use client";

import { useMemo, useState } from "react";
import { Check, Flag, Minus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { responseStatus } from "@/components/exam/question-card";
import { cn } from "@/lib/utils";
import type { ExamPaperQuestionDTO } from "@/types/exam";

type Q = ExamPaperQuestionDTO;
type NavigatorFilter = "all" | "unanswered" | "flagged";

interface ExamQuestionNavigatorProps {
  paper: Q[];
  currentIndex: number;
  responses: Record<string, unknown>;
  flagged: string[];
  visited: string[];
  onJump: (index: number) => void;
}

export function ExamQuestionNavigator({
  paper,
  currentIndex,
  responses,
  flagged,
  visited,
  onJump,
}: ExamQuestionNavigatorProps) {
  const [filter, setFilter] = useState<NavigatorFilter>("all");
  const flaggedSet = useMemo(() => new Set(flagged), [flagged]);
  const visitedSet = useMemo(() => new Set(visited), [visited]);

  const visible = useMemo(() => paper.map((question, index) => ({ question, index })).filter(({ question }) => {
    const id = String(question.id);
    const status = responseStatus(question, responses[id]);
    if (filter === "unanswered") return status !== "answered";
    if (filter === "flagged") return flaggedSet.has(id);
    return true;
  }), [filter, flaggedSet, paper, responses]);

  const grouped = useMemo(() => {
    const groups = new Map<string, { question: Q; index: number }[]>();
    for (const item of visible) {
      const label = item.question.subject || "Questions";
      groups.set(label, [...(groups.get(label) ?? []), item]);
    }
    return [...groups.entries()];
  }, [visible]);

  const answeredCount = paper.filter((question) => responseStatus(question, responses[String(question.id)]) === "answered").length;
  const incompleteCount = paper.filter((question) => responseStatus(question, responses[String(question.id)]) === "incomplete").length;

  return (
    <div className="flex min-h-0 flex-col gap-3">
      <div className="grid grid-cols-3 gap-2 border-b pb-3 text-center">
        <div><p className="text-base font-semibold tabular-nums">{answeredCount}</p><p className="text-[11px] text-muted-foreground">Answered</p></div>
        <div><p className="text-base font-semibold tabular-nums">{paper.length - answeredCount}</p><p className="text-[11px] text-muted-foreground">Need answer</p></div>
        <div><p className="text-base font-semibold tabular-nums">{flagged.length}</p><p className="text-[11px] text-muted-foreground">Flagged</p></div>
      </div>

      <Tabs value={filter} onValueChange={(value) => setFilter(value as NavigatorFilter)}>
        <TabsList className="grid h-auto w-full grid-cols-3" aria-label="Question filters">
          <TabsTrigger value="all" className="min-h-11">All</TabsTrigger>
          <TabsTrigger value="unanswered" className="min-h-11">Open</TabsTrigger>
          <TabsTrigger value="flagged" className="min-h-11">Flagged</TabsTrigger>
        </TabsList>
      </Tabs>

      <div className="min-h-0 flex-1 overflow-y-auto pr-1">
        {grouped.length ? grouped.map(([subject, items]) => (
          <section key={subject} className="mb-4" aria-label={`${subject} questions`}>
            {grouped.length > 1 ? <h3 className="mb-2 truncate text-xs font-semibold text-muted-foreground">{subject}</h3> : null}
            <div className="grid grid-cols-5 gap-1.5">
              {items.map(({ question, index }) => {
                const id = String(question.id);
                const status = responseStatus(question, responses[id]);
                const current = index === currentIndex;
                const isFlagged = flaggedSet.has(id);
                const hasVisited = visitedSet.has(id);
                const label = [
                  `Question ${index + 1}`,
                  current ? "current" : null,
                  status === "answered" ? "answered" : status === "incomplete" ? "incomplete" : hasVisited ? "visited, unanswered" : "not visited",
                  isFlagged ? "flagged for review" : null,
                ].filter(Boolean).join(", ");
                return (
                  <Button
                    key={question.id}
                    type="button"
                    variant="outline"
                    size="icon-lg"
                    onClick={(event) => {
                      onJump(index);
                      const sheet = event.currentTarget.closest('[data-slot="sheet-content"]');
                      const closeButton = sheet?.querySelector<HTMLButtonElement>('[data-slot="sheet-close"]');
                      closeButton?.click();
                    }}
                    aria-current={current ? "step" : undefined}
                    aria-label={label}
                    className={cn(
                      "relative rounded-lg p-0 text-xs tabular-nums",
                      current && "border-foreground bg-foreground text-background hover:bg-foreground/90 hover:text-background",
                      !current && status === "answered" && "bg-muted font-semibold",
                      !current && status === "incomplete" && "border-dashed bg-warning/20",
                      !current && status === "unanswered" && hasVisited && "border-dashed",
                    )}
                  >
                    {index + 1}
                    {status === "answered" ? <Check className="absolute -right-1 -bottom-1 size-3 rounded-full bg-background text-foreground" aria-hidden="true" /> : null}
                    {status === "incomplete" ? <Minus className="absolute -right-1 -bottom-1 size-3 rounded-full bg-background text-foreground" aria-hidden="true" /> : null}
                    {isFlagged ? <Flag className="absolute -right-1 -top-1 size-3 fill-current" aria-hidden="true" /> : null}
                  </Button>
                );
              })}
            </div>
          </section>
        )) : (
          <p className="rounded-lg border border-dashed p-4 text-center text-xs leading-5 text-muted-foreground">
            No questions match this filter.
          </p>
        )}
      </div>

      <div className="grid grid-cols-2 gap-x-3 gap-y-1.5 border-t pt-3 text-[10px] text-muted-foreground">
        <span className="flex items-center gap-1.5"><span className="size-2 rounded-full bg-foreground" />Current</span>
        <span className="flex items-center gap-1.5"><Check className="size-3" />Answered</span>
        <span className="flex items-center gap-1.5"><span className="size-3 rounded-sm border border-dashed" />Visited</span>
        <span className="flex items-center gap-1.5"><Flag className="size-3" />Flagged</span>
      </div>
      {incompleteCount ? <p className="text-[11px] leading-4 text-muted-foreground">{incompleteCount} multi-part question{incompleteCount === 1 ? " is" : "s are"} partially answered.</p> : null}
    </div>
  );
}
