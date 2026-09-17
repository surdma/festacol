"use client";

import { BadgeCheck } from "lucide-react";
import { useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export interface StudentIdRevealProps {
  open: boolean;
  studentNumber: string | null;
  onAcknowledge: () => void;
}

export function StudentIdReveal({
  open,
  studentNumber,
  onAcknowledge,
}: StudentIdRevealProps) {
  const buttonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (open) {
      setTimeout(() => buttonRef.current?.focus(), 50);
    }
  }, [open]);

  if (!studentNumber) return null;

  return (
    <Dialog
      open={open}
      onOpenChange={(value) => {
        if (!value) onAcknowledge();
      }}
    >
      <DialogContent
        className="mx-auto max-w-md sm:max-w-lg"
        role="alertdialog"
        aria-modal="true"
        aria-describedby="candidate-number-reveal-desc"
      >
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-xl font-semibold">
            <BadgeCheck className="size-5 text-success-foreground" aria-hidden="true" />
            Candidate number assigned
          </DialogTitle>
          <DialogDescription id="candidate-number-reveal-desc">
            Record this candidate number before continuing to the examination.
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-4" aria-live="polite" aria-atomic="true">
          <div className="rounded-xl border border-success-border bg-success p-6 text-center">
            <p className="text-xs font-semibold uppercase tracking-wider text-success-foreground">
              Candidate number
            </p>
            <p
              className="mt-2 font-mono text-3xl font-bold tracking-wide text-foreground"
              aria-label={`Candidate number ${studentNumber}`}
            >
              {studentNumber}
            </p>
            <p className="mt-3 text-sm text-success-foreground">
              Keep this number safe. It identifies your academic examination record.
            </p>
          </div>
          <div className="rounded-lg bg-muted/60 p-4 text-sm leading-relaxed text-muted-foreground">
            <p>
              Your student account has been created. Record the candidate number above before continuing to the examination access process.
            </p>
          </div>
          <Button
            ref={buttonRef}
            onClick={onAcknowledge}
            className="w-full"
            size="lg"
            aria-label="I have recorded my candidate number"
          >
            I have recorded my candidate number — continue
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
