"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { beginExamOnboardingAction } from "@/app/actions/exam-onboarding";
import { StudentIdReveal } from "@/components/exam/student-id-reveal";
import { StudentWizard } from "@/components/exam/student-wizard";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";

export function ExamEntryFlow({ token, examTitle }: { token: string; examTitle: string }) {
  const router = useRouter();
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [configuredSession, setConfiguredSession] = useState(false);
  const [studentNumber, setStudentNumber] = useState<string | null>(null);
  const [idRevealOpen, setIdRevealOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function submit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    startTransition(async () => {
      const result = await beginExamOnboardingAction({
        token,
        firstName: firstName.trim(),
        lastName: lastName.trim(),
      });
      if (!result.ok) {
        setError(result.error ?? "Student entry failed.");
        return;
      }
      setConfiguredSession(true);
      setStudentNumber(result.studentNumber ?? null);
      if (result.provisioned && result.studentNumber) {
        setIdRevealOpen(true);
      }
      router.refresh();
    });
  }

  if (configuredSession && !idRevealOpen) {
    return <StudentWizard token={token} />;
  }

  return (
    <div className="mx-auto w-full max-w-md">
      <Card>
        <CardHeader className="text-center">
          <CardTitle>Enter {examTitle}</CardTitle>
          <CardDescription>
            Your first and last name are your student credentials. If this is your first visit, Festacol creates your student account before asking you to confirm your school class.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={submit} aria-busy={pending}>
            <FieldGroup>
              <Field data-invalid={Boolean(error)}>
                <FieldLabel htmlFor="exam-first-name">First name</FieldLabel>
                <Input
                  id="exam-first-name"
                  name="firstName"
                  autoComplete="given-name"
                  value={firstName}
                  onChange={(event) => setFirstName(event.target.value)}
                  aria-invalid={Boolean(error)}
                />
              </Field>
              <Field data-invalid={Boolean(error)}>
                <FieldLabel htmlFor="exam-last-name">Last name</FieldLabel>
                <Input
                  id="exam-last-name"
                  name="lastName"
                  autoComplete="family-name"
                  value={lastName}
                  onChange={(event) => setLastName(event.target.value)}
                  aria-invalid={Boolean(error)}
                />
              </Field>
              {error ? (
                <Alert variant="destructive" role="alert">
                  <AlertTitle>Could not continue</AlertTitle>
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              ) : null}
              <Button
                type="submit"
                size="lg"
                disabled={pending || firstName.trim().length < 2 || lastName.trim().length < 2}
              >
                {pending ? <><Spinner data-icon="inline-start" />Checking…</> : "Continue as student"}
              </Button>
            </FieldGroup>
          </form>
        </CardContent>
      </Card>

      <StudentIdReveal
        open={idRevealOpen}
        studentNumber={studentNumber}
        onAcknowledge={() => setIdRevealOpen(false)}
      />
    </div>
  );
}
