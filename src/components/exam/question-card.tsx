"use client";

import Image from "next/image";
import { Flag, Maximize2 } from "lucide-react";
import { StatusBadge } from "@/components/status-badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { parseExamQuestionContent } from "@/lib/exam-question-content";
import { cn } from "@/lib/utils";
import type { QuestionDTO } from "@/types/exam";

type Q = Omit<QuestionDTO, "answer">;

export type QuestionResponseStatus = "answered" | "incomplete" | "unanswered";

export function responseStatus(q: Q, response: unknown): QuestionResponseStatus {
  if (Array.isArray(response)) {
    if (!response.length) return "unanswered";
    if (q.requiredSelections && response.length !== q.requiredSelections) return "incomplete";
    return "answered";
  }
  if (response && typeof response === "object") {
    const vals = Object.values(response as Record<string, unknown>);
    if (vals.length > 0 && vals.every((value) => String(value ?? "").trim())) return "answered";
    if (vals.some((value) => String(value ?? "").trim())) return "incomplete";
    return "unanswered";
  }
  if (response === true || response === false) return "answered";
  return String(response ?? "").trim() ? "answered" : "unanswered";
}

const LETTERS = ["A", "B", "C", "D", "E", "F", "G", "H"];

function typeLabel(type: Q["type"]) {
  if (type === "single") return "Single answer";
  if (type === "multi") return "Multiple answers";
  if (type === "boolean") return "True or false";
  if (type === "fill-multi") return "Multiple blanks";
  return "Fill in the blank";
}

function QuestionMedia({ src, alt }: { src: string; alt: string }) {
  return (
    <Dialog>
      <div className="overflow-hidden rounded-2xl border bg-muted/20">
        <div className="relative aspect-[16/9] w-full bg-white">
          <Image src={src} alt={alt} fill sizes="(max-width: 1024px) 100vw, 720px" className="object-contain p-4" />
        </div>
        <div className="flex items-center justify-between gap-3 border-t px-4 py-3">
          <p className="min-w-0 text-xs leading-5 text-muted-foreground">{alt}</p>
          <DialogTrigger render={<Button type="button" size="sm" variant="outline" />}>
            <Maximize2 data-icon="inline-start" />
            Enlarge
          </DialogTrigger>
        </div>
      </div>
      <DialogContent className="max-w-5xl p-4 sm:max-w-5xl">
        <DialogHeader className="px-1">
          <DialogTitle>Question illustration</DialogTitle>
          <DialogDescription>{alt}</DialogDescription>
        </DialogHeader>
        <div className="relative min-h-[50dvh] overflow-hidden rounded-xl border bg-white">
          <Image src={src} alt={alt} fill sizes="95vw" className="object-contain p-4" />
        </div>
      </DialogContent>
    </Dialog>
  );
}

export function QuestionCard({
  q,
  index,
  total,
  response,
  flagged,
  onChange,
  onToggleFlag,
}: {
  q: Q;
  index: number;
  total: number;
  response: unknown;
  flagged: boolean;
  onChange: (value: unknown) => void;
  onToggleFlag: () => void;
}) {
  const status = responseStatus(q, response);
  const content = parseExamQuestionContent(q.prompt);
  const passageLayout = Boolean(content.passage);

  return (
    <article aria-labelledby={`question-${q.id}-title`} className="min-w-0">
      <header className="mb-5 flex flex-wrap items-start justify-between gap-3 border-b pb-4">
        <div className="flex min-w-0 flex-col gap-2">
          <div className="flex flex-wrap items-center gap-2 text-xs font-semibold text-muted-foreground">
            <span>Question {index + 1} of {total}</span>
            <span aria-hidden="true">·</span>
            <span>{q.subject}</span>
            {q.domain ? <><span aria-hidden="true">·</span><span>{q.domain}</span></> : null}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <StatusBadge tone="neutral">{typeLabel(q.type)}</StatusBadge>
            <StatusBadge tone={status === "answered" ? "emerald" : status === "incomplete" ? "amber" : "neutral"}>
              {status === "answered" ? "Answered" : status === "incomplete" ? "Incomplete" : "Not answered"}
            </StatusBadge>
          </div>
        </div>
        <Button type="button" size="sm" variant={flagged ? "secondary" : "outline"} onClick={onToggleFlag} aria-pressed={flagged}>
          <Flag data-icon="inline-start" />
          {flagged ? "Flagged" : "Flag for review"}
        </Button>
      </header>

      <div className={cn("grid min-w-0 gap-6", passageLayout && "xl:grid-cols-[minmax(18rem,.85fr)_minmax(0,1.15fr)] xl:items-start")}>
        {content.passage ? (
          <aside className="rounded-2xl border bg-muted/20 p-5 xl:sticky xl:top-24" aria-label="Reading passage">
            <p className="mb-3 text-xs font-bold uppercase tracking-[0.14em] text-muted-foreground">Reading passage</p>
            <div className="whitespace-pre-line text-[15px] leading-7 text-foreground">{content.passage}</div>
          </aside>
        ) : null}

        <div className="min-w-0">
          {content.media ? <div className="mb-6"><QuestionMedia src={content.media.src} alt={content.media.alt} /></div> : null}

          {q.instruction ? (
            <p className="mb-3 text-sm font-semibold leading-6 text-muted-foreground">{q.instruction}</p>
          ) : null}
          <h2 id={`question-${q.id}-title`} className="max-w-4xl text-lg font-semibold leading-8 tracking-[-0.01em] text-foreground sm:text-xl sm:leading-9">
            {content.question}
          </h2>

          <div className="mt-6">
            {q.type === "single" ? (
              <RadioGroup value={typeof response === "string" ? response : ""} onValueChange={(value) => onChange(value)} aria-label={`Answer for question ${index + 1}`}>
                {(q.options ?? []).map((option, optionIndex) => {
                  const id = `question-${q.id}-option-${optionIndex}`;
                  const selected = response === option;
                  return (
                    <label
                      key={option}
                      htmlFor={id}
                      className={cn(
                        "flex min-h-14 cursor-pointer items-start gap-3 rounded-xl border p-3.5 text-sm leading-6 transition-colors focus-within:border-foreground focus-within:ring-3 focus-within:ring-ring/20",
                        selected ? "border-foreground bg-muted/60" : "bg-background hover:bg-muted/30",
                      )}
                    >
                      <RadioGroupItem id={id} value={option} className="mt-1" />
                      <span className="grid size-7 shrink-0 place-items-center rounded-lg border bg-background text-xs font-bold">{LETTERS[optionIndex] ?? optionIndex + 1}</span>
                      <span className="pt-0.5">{option}</span>
                    </label>
                  );
                })}
              </RadioGroup>
            ) : null}

            {q.type === "multi" ? (
              <div className="flex flex-col gap-2" role="group" aria-label={`Answers for question ${index + 1}`}>
                {(q.options ?? []).map((option, optionIndex) => {
                  const list = Array.isArray(response) ? (response as string[]) : [];
                  const selected = list.includes(option);
                  const id = `question-${q.id}-choice-${optionIndex}`;
                  return (
                    <label
                      key={option}
                      htmlFor={id}
                      className={cn(
                        "flex min-h-14 cursor-pointer items-start gap-3 rounded-xl border p-3.5 text-sm leading-6 transition-colors focus-within:border-foreground focus-within:ring-3 focus-within:ring-ring/20",
                        selected ? "border-foreground bg-muted/60" : "bg-background hover:bg-muted/30",
                      )}
                    >
                      <Checkbox
                        id={id}
                        checked={selected}
                        onCheckedChange={(checked) => onChange(checked ? [...list, option] : list.filter((item) => item !== option))}
                        className="mt-1"
                      />
                      <span className="grid size-7 shrink-0 place-items-center rounded-lg border bg-background text-xs font-bold">{LETTERS[optionIndex] ?? optionIndex + 1}</span>
                      <span className="pt-0.5">{option}</span>
                    </label>
                  );
                })}
                {q.requiredSelections ? (
                  <p className="pt-1 text-xs text-muted-foreground" aria-live="polite">
                    {Array.isArray(response) ? response.length : 0} of {q.requiredSelections} required selections chosen.
                  </p>
                ) : null}
              </div>
            ) : null}

            {q.type === "boolean" ? (
              <RadioGroup
                className="grid sm:grid-cols-2"
                value={response === true ? "true" : response === false ? "false" : ""}
                onValueChange={(value) => onChange(value === "true")}
                aria-label={`Answer for question ${index + 1}`}
              >
                {[{ label: "True", value: "true" }, { label: "False", value: "false" }].map((choice) => {
                  const selected = String(response) === choice.value;
                  const id = `question-${q.id}-${choice.value}`;
                  return (
                    <label
                      key={choice.value}
                      htmlFor={id}
                      className={cn(
                        "flex min-h-16 cursor-pointer items-center gap-3 rounded-xl border p-4 text-base font-semibold transition-colors focus-within:border-foreground focus-within:ring-3 focus-within:ring-ring/20",
                        selected ? "border-foreground bg-muted/60" : "bg-background hover:bg-muted/30",
                      )}
                    >
                      <RadioGroupItem id={id} value={choice.value} />
                      {choice.label}
                    </label>
                  );
                })}
              </RadioGroup>
            ) : null}

            {q.type === "fill" || q.type === "fill-multi" ? (
              <div className="rounded-xl border bg-muted/10 p-4 text-base leading-10 sm:p-5">
                {(q.fillTemplate ?? []).map((part, partIndex) => {
                  const key = part.key ?? `b${partIndex}`;
                  if (!part.blank) return <span key={`${key}-text`}>{part.text} </span>;
                  const values = response && typeof response === "object" ? response as Record<string, string> : {};
                  return (
                    <Input
                      key={key}
                      aria-label={part.placeholder ?? `Blank ${partIndex + 1}`}
                      className="mx-1 my-1 inline-flex h-10 min-w-32 max-w-full align-middle sm:w-auto sm:min-w-44"
                      placeholder={part.placeholder ?? "Answer"}
                      value={String(values[key] ?? "")}
                      onChange={(event) => onChange({ ...values, [key]: event.target.value })}
                    />
                  );
                })}
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </article>
  );
}
