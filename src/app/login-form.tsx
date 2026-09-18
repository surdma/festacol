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

export function StudentLoginForm({
  next,
  submitLabel,
  onIdentityChange,
}: {
  next?: string;
  submitLabel?: string;
  onIdentityChange?: (identity: { firstName: string; lastName: string }) => void;
}) {
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

  function updateFirstName(value: string) {
    setFirstName(value);
    onIdentityChange?.({ firstName: value, lastName });
  }

  function updateLastName(value: string) {
    setLastName(value);
    onIdentityChange?.({ firstName, lastName: value });
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      const result = await signInStudentAction({ firstName, lastName });
      if (!result.ok) {
        setError(errorMessage(result.error, continuingToExam));
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
            <FieldLabel htmlFor="firstName">Candidate first name</FieldLabel>
            <Input
              id="firstName"
              autoComplete="given-name"
              value={firstName}
              onChange={(e) => updateFirstName(e.target.value)}
              aria-invalid={Boolean(error)}
              disabled={pending}
            />
          </Field>
          <Field data-invalid={Boolean(error)}>
            <FieldLabel htmlFor="lastName">Candidate last name</FieldLabel>
            <Input
              id="lastName"
              type="password"
              autoComplete="family-name"
              value={lastName}
              onChange={(e) => updateLastName(e.target.value)}
              aria-invalid={Boolean(error)}
              disabled={pending}
            />
          </Field>
          {error ? (
            <p className="text-sm leading-6 text-destructive" role="alert">
              {error}
            </p>
          ) : null}
          <Button type="submit" size="lg" disabled={pending} className="w-full">
            {pending
              ? "Confirming candidate identity…"
              : submitLabel ?? (continuingToExam ? "Continue to examination" : "Open student workspace")}
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

function errorMessage(message: string | undefined, continuingToExam: boolean) {
  if (!message) return continuingToExam ? "Candidate identity could not be confirmed." : "Student sign-in failed.";
  if (!continuingToExam) return message;
  return message
    .replaceAll("Student login", "Candidate identity")
    .replaceAll("student sign-in", "candidate identity confirmation")
    .replaceAll("Student sign-in", "Candidate identity confirmation");
}
