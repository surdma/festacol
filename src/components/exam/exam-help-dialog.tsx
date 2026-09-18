"use client";

import { CheckCircle2, MessageSquareText } from "lucide-react";
import { useEffect, useState, useTransition } from "react";
import { requestExamHelpAction } from "@/app/actions/exam-support";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Spinner } from "@/components/ui/spinner";
import { Textarea } from "@/components/ui/textarea";
import type { ExamHelpRequestCategory } from "@/lib/validation";

const CATEGORY_OPTIONS: Array<{
  value: ExamHelpRequestCategory;
  label: string;
}> = [
  { value: "examination_access", label: "Examination access" },
  { value: "candidate_identity", label: "Candidate identity" },
  { value: "device_browser", label: "Device or browser" },
  { value: "other_examination_support", label: "Other examination support" },
];

export function ExamHelpDialog({
  open,
  onOpenChange,
  token,
  examTitle,
  defaultRequesterName,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  token: string;
  examTitle: string;
  defaultRequesterName: string;
}) {
  const [requesterName, setRequesterName] = useState("");
  const [category, setCategory] = useState<ExamHelpRequestCategory>("examination_access");
  const [message, setMessage] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);
  const [duplicate, setDuplicate] = useState(false);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    if (!open) return;
    setError(null);
    setSent(false);
    setDuplicate(false);
    setRequesterName((current) => current.trim() || defaultRequesterName.trim());
  }, [defaultRequesterName, open]);

  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    startTransition(async () => {
      const result = await requestExamHelpAction({
        token,
        requesterName,
        category,
        message,
      });
      if (!result.ok) {
        setError(result.error ?? "Your examination support request could not be sent.");
        return;
      }
      setDuplicate(Boolean(result.duplicate));
      setSent(true);
    });
  }

  function close() {
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl">
        {sent ? (
          <div className="flex flex-col gap-5 py-2" aria-live="polite">
            <span className="grid size-11 place-items-center rounded-full bg-success text-success-foreground">
              <CheckCircle2 className="size-5" aria-hidden="true" />
            </span>
            <DialogHeader>
              <DialogTitle>Examination support request sent</DialogTitle>
              <DialogDescription>
                {duplicate
                  ? "This same request was already sent within the last minute, so Festacol did not create a duplicate notification."
                  : `The staff member who created ${examTitle} has been notified. You can remain on this examination access page while you wait for assistance.`}
              </DialogDescription>
            </DialogHeader>
            <Button type="button" onClick={close} className="self-start">
              Return to examination access
            </Button>
          </div>
        ) : (
          <form onSubmit={submit} className="contents">
            <DialogHeader>
              <div className="mb-1 flex size-10 items-center justify-center rounded-xl bg-muted text-foreground">
                <MessageSquareText className="size-5" aria-hidden="true" />
              </div>
              <DialogTitle>Request examination support</DialogTitle>
              <DialogDescription>
                Send a concise message to the staff member who created this examination. Do not include passwords or other private information.
              </DialogDescription>
            </DialogHeader>

            <FieldGroup>
              <Field data-invalid={Boolean(error)}>
                <FieldLabel htmlFor="exam-help-name">Candidate name</FieldLabel>
                <Input
                  id="exam-help-name"
                  autoComplete="name"
                  value={requesterName}
                  onChange={(event) => setRequesterName(event.target.value)}
                  placeholder="First and last name"
                  disabled={pending}
                />
              </Field>

              <Field>
                <FieldLabel htmlFor="exam-help-category">Area requiring support</FieldLabel>
                <Select
                  value={category}
                  onValueChange={(value) => setCategory(String(value) as ExamHelpRequestCategory)}
                >
                  <SelectTrigger id="exam-help-category" className="w-full" disabled={pending}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent align="start">
                    {CATEGORY_OPTIONS.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>

              <Field data-invalid={Boolean(error)}>
                <FieldLabel htmlFor="exam-help-message">Message</FieldLabel>
                <Textarea
                  id="exam-help-message"
                  value={message}
                  onChange={(event) => setMessage(event.target.value)}
                  placeholder="Describe what is preventing you from continuing with the examination."
                  rows={5}
                  maxLength={500}
                  disabled={pending}
                  aria-describedby="exam-help-count"
                />
                <FieldDescription id="exam-help-count">
                  {message.length}/500 characters
                </FieldDescription>
                {error ? <FieldError>{error}</FieldError> : null}
              </Field>
            </FieldGroup>

            <Alert>
              <AlertTitle>{examTitle}</AlertTitle>
              <AlertDescription>
                Your request is linked to this examination only. It does not start an attempt or change your academic record.
              </AlertDescription>
            </Alert>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={close} disabled={pending}>
                Cancel
              </Button>
              <Button type="submit" disabled={pending}>
                {pending ? <Spinner data-icon="inline-start" /> : null}
                {pending ? "Sending request…" : "Send to examination creator"}
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
