"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { signInStudentAction } from "@/app/actions/student";
import { StudentIdReveal } from "@/components/exam/student-id-reveal";
import { Button } from "@/components/ui/button";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  isExamDestination,
  safeStudentDestination,
} from "@/lib/auth/navigation";

export function StudentLoginForm({ next }: { next?: string }) {
  const router = useRouter();
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [studentNumber, setStudentNumber] = useState<string | null>(null);
  const [idRevealOpen, setIdRevealOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const destination = safeStudentDestination(next) ?? "/dashboard";
  const continuingToExam = isExamDestination(destination);

  function continueToDestination() {
    router.replace(destination);
    router.refresh();
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      const result = await signInStudentAction({ firstName, lastName });
      if (!result.ok) {
        setError(result.error ?? "Sign in failed.");
        return;
      }

      if (result.provisioned && result.studentNumber) {
        setStudentNumber(result.studentNumber);
        setIdRevealOpen(true);
        return;
      }

      continueToDestination();
    });
  }

  return (
    <>
      <form onSubmit={submit}>
        <FieldGroup>
          <Field data-invalid={Boolean(error)}>
            <FieldLabel htmlFor="firstName">First name</FieldLabel>
            <Input
              id="firstName"
              autoComplete="given-name"
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
              aria-invalid={Boolean(error)}
            />
          </Field>
          <Field data-invalid={Boolean(error)}>
            <FieldLabel htmlFor="lastName">Last name</FieldLabel>
            <Input
              id="lastName"
              type="password"
              autoComplete="family-name"
              value={lastName}
              onChange={(e) => setLastName(e.target.value)}
              aria-invalid={Boolean(error)}
            />
          </Field>
          {error ? (
            <p className="text-sm text-destructive" role="alert">
              {error}
            </p>
          ) : null}
          <Button type="submit" disabled={pending}>
            {pending
              ? "Signing in…"
              : continuingToExam
                ? "Continue to exam"
                : "Open dashboard"}
          </Button>
        </FieldGroup>
      </form>

      <StudentIdReveal
        open={idRevealOpen}
        studentNumber={studentNumber}
        onAcknowledge={() => {
          setIdRevealOpen(false);
          continueToDestination();
        }}
      />
    </>
  );
}
