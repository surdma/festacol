"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { resolveExamLinkAction } from "@/app/actions/exams";

export function ExamIdDialog() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [examId, setExamId] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      const result = await resolveExamLinkAction(examId.trim());
      if (result.error || !result.href) {
        setError(result.error ?? "Exam not found.");
        return;
      }
      setOpen(false);
      router.push(result.href);
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button className="fixed right-4 bottom-4 shadow-lg" />}>
        Enter exam ID
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Enter exam ID</DialogTitle>
          <DialogDescription>Paste the ID from your teacher or QR card to open the secure exam workspace.</DialogDescription>
        </DialogHeader>
        <form onSubmit={submit}>
          <FieldGroup>
            <Field>
              <FieldLabel htmlFor="exam-id">Exam ID</FieldLabel>
              <Input id="exam-id" value={examId} onChange={(e) => setExamId(e.target.value)} placeholder="e.g. FST-2026-001" aria-invalid={!!error} />
              {error ? <p className="text-sm text-destructive">{error}</p> : null}
            </Field>
          </FieldGroup>
          <DialogFooter className="mt-4">
            <Button type="submit" disabled={pending}>{pending ? "Checking…" : "Open exam"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
