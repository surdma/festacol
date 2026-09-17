import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

export interface ExamCheckpointStep {
  id: string;
  label: string;
}

/**
 * Quiet checkpoint rail shared by the student setup wizard and the exam
 * preflight flow. Each checkpoint is triple-coded: a distinct marker shape,
 * an icon or step number, and a text label — never color alone. The current
 * checkpoint also carries `aria-current="step"`.
 */
export function ExamCheckpointRail({
  steps,
  currentIndex,
  label,
}: {
  steps: ExamCheckpointStep[];
  currentIndex: number;
  label: string;
}) {
  const safeIndex = Math.min(Math.max(0, currentIndex), steps.length - 1);
  return (
    <div>
      <p className="text-xs font-semibold tabular-nums text-muted-foreground">
        Step {safeIndex + 1} of {steps.length}
        <span className="sr-only">: {label}</span>
      </p>
      <ol
        aria-label={label}
        className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-2"
      >
        {steps.map((step, index) => {
          const done = index < safeIndex;
          const current = index === safeIndex;
          return (
            <li
              key={step.id}
              aria-current={current ? "step" : undefined}
              className="flex min-w-0 items-center gap-2.5 sm:flex-1"
            >
              <span
                aria-hidden="true"
                className={cn(
                  "grid size-7 shrink-0 place-items-center rounded-full",
                  done && "bg-foreground text-background",
                  current &&
                    "border-2 border-foreground bg-background text-xs font-bold tabular-nums text-foreground",
                  !done &&
                    !current &&
                    "border border-border text-muted-foreground",
                )}
              >
                {done ? (
                  <Check className="size-3.5" />
                ) : current ? (
                  index + 1
                ) : (
                  <span className="size-1.5 rounded-full bg-current" />
                )}
              </span>
              <span
                className={cn(
                  "min-w-0 truncate text-xs",
                  current
                    ? "font-semibold text-foreground"
                    : "text-muted-foreground",
                )}
              >
                {step.label}
              </span>
              {index < steps.length - 1 ? (
                <span
                  aria-hidden="true"
                  className="hidden h-px min-w-3 flex-1 bg-border sm:block"
                />
              ) : null}
            </li>
          );
        })}
      </ol>
    </div>
  );
}
