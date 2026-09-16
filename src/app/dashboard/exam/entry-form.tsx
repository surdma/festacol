"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { enterExamByNameAction } from "@/app/actions/exam-entry";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";

type EntryState =
  | { kind: "idle" }
  | { kind: "ambiguous"; message: string }
  | { kind: "placement-first"; message: string }
  | { kind: "not-eligible"; message: string }
  | { kind: "error"; message: string };

const PLACEMENT_FIRST_COPY =
  "You haven't been placed yet — write the placement exam first, then return to this class exam with the same name.";

function isAmbiguousMessage(message: string): boolean {
  return /more than one student/i.test(message);
}

export function ExamLinkEntryForm({ token }: { token: string }) {
  const router = useRouter();
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [state, setState] = useState<EntryState>({ kind: "idle" });
  const [pending, startTransition] = useTransition();

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setState({ kind: "idle" });
    startTransition(async () => {
      const result = await enterExamByNameAction({
        token,
        firstName,
        lastName,
      });
      if (result.ok) {
        if (result.next === "placement-first") {
          setState({ kind: "placement-first", message: PLACEMENT_FIRST_COPY });
          return;
        }
        if (result.next === "not-eligible") {
          setState({
            kind: "not-eligible",
            message: "This examination is not assigned to you.",
          });
          return;
        }
        // `entered` (or legacy ok without a hint): the student session is
        // ready — preserve the opaque token flow into the exam surface.
        router.push(`/dashboard/exam?token=${encodeURIComponent(token)}`);
        router.refresh();
        return;
      }
      const message = result.error ?? "Entry failed.";
      if (result.next === "placement-first") {
        setState({ kind: "placement-first", message: PLACEMENT_FIRST_COPY });
        return;
      }
      if (result.next === "not-eligible") {
        setState({ kind: "not-eligible", message });
        return;
      }
      if (isAmbiguousMessage(message)) {
        setState({ kind: "ambiguous", message });
        return;
      }
      setState({ kind: "error", message });
    });
  }

  return (
    <form onSubmit={submit} aria-busy={pending}>
      <FieldGroup>
        <Field>
          <FieldLabel htmlFor="entry-first-name">First name</FieldLabel>
          <Input
            id="entry-first-name"
            autoComplete="given-name"
            value={firstName}
            onChange={(e) => setFirstName(e.target.value)}
          />
        </Field>
        <Field>
          <FieldLabel htmlFor="entry-last-name">Last name</FieldLabel>
          <Input
            id="entry-last-name"
            autoComplete="family-name"
            value={lastName}
            onChange={(e) => setLastName(e.target.value)}
          />
        </Field>
        {state.kind === "ambiguous" ? (
          <Alert role="alert">
            <AlertTitle>Which student is this?</AlertTitle>
            <AlertDescription>
              {state.message} Use the exact name your school registered, or ask
              your teacher for help.
            </AlertDescription>
          </Alert>
        ) : null}
        {state.kind === "placement-first" ? (
          <Alert role="alert">
            <AlertTitle>Placement exam first</AlertTitle>
            <AlertDescription>{state.message}</AlertDescription>
          </Alert>
        ) : null}
        {state.kind === "not-eligible" ? (
          <Alert variant="destructive" role="alert">
            <AlertTitle>Not eligible for this exam</AlertTitle>
            <AlertDescription>{state.message}</AlertDescription>
          </Alert>
        ) : null}
        {state.kind === "error" ? (
          <p className="text-sm text-destructive" role="alert">
            {state.message}
          </p>
        ) : null}
        <Button
          type="submit"
          disabled={
            pending || firstName.trim().length < 1 || lastName.trim().length < 1
          }
        >
          {pending ? "Opening…" : "Enter exam"}
        </Button>
        {pending ? (
          <p className="text-xs text-muted-foreground" aria-live="polite">
            Checking your name and exam access…
          </p>
        ) : null}
      </FieldGroup>
    </form>
  );
}
