"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { StudentWizard, type WizardStep } from "@/components/exam/student-wizard";
import { StudentIdReveal } from "@/components/exam/student-id-reveal";
import { enterExamByNameAction, type ExamEntryResult } from "@/app/actions/exam-entry";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";

interface ExamEntryFlowProps {
  token: string;
  initialName?: string;
}

export function ExamEntryFlow({ token, initialName }: ExamEntryFlowProps) {
  const router = useRouter();
  const [firstName, setFirstName] = useState(initialName ? initialName.split(" ")[0] ?? "" : "");
  const [lastName, setLastName] = useState(initialName ? initialName.split(" ").slice(1).join(" ") ?? "" : "");
  const [pending, startTransition] = useTransition();
  const [entryResult, setEntryResult] = useState<ExamEntryResult | null>(null);
  const [idRevealOpen, setIdRevealOpen] = useState(false);
  const [wizardResult, setWizardResult] = useState<ExamEntryResult | null>(null);
  const [entryError, setEntryError] = useState<string | null>(null);
  const [entryNext, setEntryNext] = useState<string | undefined>(undefined);

  // Handle entry form submission (name-based account creation)
  function submitEntry(e: React.FormEvent) {
    e.preventDefault();
    setEntryError(null);
    setEntryResult(null);
    startTransition(async () => {
      const result = await enterExamByNameAction({ token, firstName: firstName.trim(), lastName: lastName.trim() });
      setEntryResult(result);
      if (!result.ok) {
        setEntryError(result.error ?? "Entry failed.");
        setEntryNext(result.next);
        return;
      }
      if (result.provisioned && result.studentNumber) {
        // Show ID reveal for newly provisioned accounts
        setIdRevealOpen(true);
      } else if (result.ok && result.next === "entered") {
        // Direct entry for existing students
        router.push(`/dashboard/exam?token=${encodeURIComponent(token)}`);
      }
    });
  }

  const handleIdAcknowledge = () => {
    setIdRevealOpen(false);
    if (entryResult?.ok && entryResult?.next === "entered") {
      router.push(`/dashboard/exam?token=${encodeURIComponent(token)}`);
      router.refresh();
    }
  };

  const handleWizardComplete = (result: ExamEntryResult) => {
    setWizardResult(result);
    if (result.ok) {
      router.push(`/exam?token=${encodeURIComponent(token)}`);
      router.refresh();
    } else {
      setEntryError(result.error ?? "Wizard entry failed.");
      setEntryNext(result.next);
    }
  };

  const handleWizardError = (error: string, next?: string) => {
    setEntryError(error);
    setEntryNext(next);
  };

  // Render wizard when entry succeeded
  if (entryResult?.ok && entryResult?.next === "entered" && !entryResult.provisioned && idRevealOpen === false) {
    // Existing student — go straight to wizard
    return (
      <StudentWizard
        token={token}
        firstName={firstName}
        lastName={lastName}
        onComplete={handleWizardComplete}
        onError={handleWizardError}
      />
    );
  }

  // Name entry form (for new/unknown students)
  return (
    <div className="mx-auto max-w-md">
      <Card className="border-0 shadow-none bg-transparent">
        <div className="p-0 space-y-4">
          <div className="text-center space-y-2">
            <h1 className="text-2xl font-bold tracking-tight">Enter exam</h1>
            <p className="text-sm text-muted-foreground">
              Type your first and last name to open the exam.
              New students are enrolled automatically.
            </p>
          </div>

          <form onSubmit={submitEntry} aria-busy={pending} className="space-y-4">
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
            </FieldGroup>

            {entryError && (
              <Alert variant="destructive" role="alert">
                <AlertTitle>Entry failed</AlertTitle>
                <AlertDescription>{entryError}</AlertDescription>
              </Alert>
            )}

            <Button
              type="submit"
              disabled={pending || firstName.trim().length < 1 || lastName.trim().length < 1}
              className="w-full min-h-[48px]"
              size="lg"
              aria-busy={pending}
            >
              {pending ? "Opening…" : "Enter exam"}
            </Button>
          </form>

          {pending && (
            <p className="text-center text-xs text-muted-foreground" aria-live="polite">
              Checking your name and exam access…
            </p>
          )}
        </div>
      </Card>

      {/* ID reveal for newly provisioned accounts */}
      <StudentIdReveal
        open={idRevealOpen}
        studentNumber={entryResult?.studentNumber ?? null}
        onAcknowledge={handleIdAcknowledge}
      />
    </div>
  );
}
