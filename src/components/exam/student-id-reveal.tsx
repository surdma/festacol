"use client";

import { AlertCircle } from "lucide-react";
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
      // Focus the one required acknowledgement action when the dialog opens.
      const timeout = window.setTimeout(() => buttonRef.current?.focus(), 50);
      return () => window.clearTimeout(timeout);
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
        aria-describedby="student-id-reveal-desc"
      >
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-xl font-semibold">
            <AlertCircle className="size-5 text-warning-foreground" aria-hidden="true" />
            Write this down
          </DialogTitle>
          <DialogDescription id="student-id-reveal-desc" className="sr-only">
            Your student identification number has been assigned.
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-4" aria-live="polite" aria-atomic="true">
          <div className="rounded-xl border border-warning-border bg-warning p-6 text-center">
            <p className="text-xs font-medium uppercase tracking-wider text-warning-foreground">
              Student ID
            </p>
            <p
              id="student-id-value"
              className="mt-2 font-mono text-3xl font-bold tabular-nums tracking-wide text-warning-foreground"
            >
              <span className="sr-only">Student number </span>
              {studentNumber}
            </p>
            <p className="mt-3 text-sm text-warning-foreground">
              Keep this number safe — you will need it for future exams.
            </p>
          </div>
          <div className="rounded-lg bg-muted/60 p-4 text-sm leading-relaxed text-muted-foreground">
            <p>
              Your account has been created. Before continuing, please write down your Student ID above. It is the only way to identify your exam records.
            </p>
          </div>
          <Button
            ref={buttonRef}
            onClick={onAcknowledge}
            className="w-full"
            size="lg"
            aria-label="I have written down my student ID"
          >
            I have written it down — continue
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
