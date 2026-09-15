"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { StatusBadge } from "@/components/status-badge";
import { cn } from "@/lib/utils";
import type { QuestionDTO } from "@/types/exam";

type Q = Omit<QuestionDTO, "answer">;

export function responseStatus(q: Q, response: unknown): "answered" | "incomplete" | "unanswered" {
  if (Array.isArray(response)) return response.length > 0 ? "answered" : "unanswered";
  if (response && typeof response === "object") {
    const vals = Object.values(response as Record<string, unknown>);
    if (vals.every((v) => String(v ?? "").trim())) return "answered";
    if (vals.some((v) => String(v ?? "").trim())) return "incomplete";
    return "unanswered";
  }
  if (response === true || response === false) return "answered";
  return String(response ?? "").trim() ? "answered" : "unanswered";
}

const LETTERS = ["A", "B", "C", "D", "E", "F"];

export function QuestionCard({ q, index, total, response, flagged, onChange, onToggleFlag }: {
  q: Q; index: number; total: number; response: unknown;
  flagged: boolean; onChange: (v: unknown) => void; onToggleFlag: () => void;
}) {
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between gap-2">
          <CardTitle className="text-base">Question {index + 1} of {total}</CardTitle>
          <div className="flex items-center gap-2">
            <StatusBadge tone={responseStatus(q, response) === "answered" ? "emerald" : responseStatus(q, response) === "incomplete" ? "amber" : "neutral"}>
              {responseStatus(q, response)}
            </StatusBadge>
            <button type="button" onClick={onToggleFlag} className={cn("rounded-full border px-3 py-1 text-xs", flagged ? "border-amber-500 text-amber-600" : "text-muted-foreground")}>
              {flagged ? "Flagged" : "Flag"}
            </button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <p className="text-[15px] leading-7">{q.prompt}</p>
        {q.type === "single" && (
          <div className="flex flex-col gap-2" role="radiogroup" aria-label={`Question ${index + 1}`}>
            {(q.options ?? []).map((opt, i) => {
              const selected = response === opt;
              return (
                <button key={opt} type="button" role="radio" aria-checked={selected} onClick={() => onChange(opt)}
                  className={cn("flex items-center gap-3 rounded-lg border p-3 text-left transition-colors", selected ? "bg-neutral-950 text-white" : "hover:bg-neutral-100")}>
                  <span className="flex size-6 shrink-0 items-center justify-center rounded-full border text-xs font-semibold">{LETTERS[i] ?? i + 1}</span>
                  <span>{opt}</span>
                </button>
              );
            })}
          </div>
        )}
        {q.type === "multi" && (
          <div className="flex flex-col gap-2">
            {(q.options ?? []).map((opt) => {
              const list = Array.isArray(response) ? (response as string[]) : [];
              const selected = list.includes(opt);
              return (
                <button key={opt} type="button" aria-pressed={selected} onClick={() => onChange(selected ? list.filter((x) => x !== opt) : [...list, opt])}
                  className={cn("flex items-center gap-3 rounded-lg border p-3 text-left transition-colors", selected ? "bg-neutral-950 text-white" : "hover:bg-neutral-100")}>
                  <span className={cn("flex size-5 items-center justify-center rounded border", selected && "bg-white text-black")}>{selected ? "✓" : ""}</span>
                  <span>{opt}</span>
                </button>
              );
            })}
          </div>
        )}
        {q.type === "boolean" && (
          <div className="grid grid-cols-2 gap-2">
            {[true, false].map((v) => (
              <button key={String(v)} type="button" aria-pressed={response === v} onClick={() => onChange(v)}
                className={cn("rounded-lg border p-3 text-center transition-colors", response === v ? "bg-neutral-950 text-white" : "hover:bg-neutral-100")}>
                {v ? "True" : "False"}
              </button>
            ))}
          </div>
        )}
        {(q.type === "fill" || q.type === "fill-multi") && (
          <div className="leading-8">
            {(q.fillTemplate ?? []).map((part, i) => {
              const key = part.key ?? `b${i}`;
              return part.blank ? (
                <Input key={key} className="mx-1 inline-flex w-40" placeholder={part.placeholder ?? "Answer"}
                  value={String((response as Record<string, string> ?? {})[key] ?? "")}
                  onChange={(e) => onChange({ ...((response as Record<string, string>) ?? {}), [key]: e.target.value })} />
              ) : (
                <span key={key}>{part.text} </span>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
