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
        aria-describedby="student-id-reveal-desc"
      >
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-xl font-semibold">
            <AlertCircle className="size-5 text-amber-600" aria-hidden="true" />
            Write this down
          </DialogTitle>
          <DialogDescription id="student-id-reveal-desc" className="sr-only">
            Your student identification number has been assigned.
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-4" aria-live="polite" aria-atomic="true">
          <div className="rounded-xl border border-amber-200 bg-amber-50 p-6 text-center dark:border-amber-800 dark:bg-amber-950/40">
            <p className="text-xs font-medium uppercase tracking-wider text-amber-700 dark:text-amber-300">
              Student ID
            </p>
            <p
              className="mt-2 font-mono text-3xl font-bold tracking-wide text-amber-900 dark:text-amber-100"
              aria-label={`Student number ${studentNumber}`}
            >
              {studentNumber}
            </p>
            <p className="mt-3 text-sm text-amber-800 dark:text-amber-200">
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
