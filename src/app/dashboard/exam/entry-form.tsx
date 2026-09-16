"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { enterExamByNameAction } from "@/app/actions/exam-entry";
import { Button } from "@/components/ui/button";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";

export function ExamLinkEntryForm({ token }: { token: string }) {
  const router = useRouter();
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      const result = await enterExamByNameAction({ token, firstName, lastName });
      if (!result.ok) {
        setError(result.error ?? "Entry failed.");
        return;
      }
      router.push(`/dashboard/exam?token=${encodeURIComponent(token)}`);
      router.refresh();
    });
  }

  return (
    <form onSubmit={submit}>
      <FieldGroup>
        <Field>
          <FieldLabel htmlFor="entry-first-name">First name</FieldLabel>
          <Input id="entry-first-name" autoComplete="given-name" value={firstName} onChange={(e) => setFirstName(e.target.value)} />
        </Field>
        <Field>
          <FieldLabel htmlFor="entry-last-name">Last name</FieldLabel>
          <Input id="entry-last-name" autoComplete="family-name" value={lastName} onChange={(e) => setLastName(e.target.value)} />
        </Field>
        {error ? <p className="text-sm text-destructive" role="alert">{error}</p> : null}
        <Button type="submit" disabled={pending}>{pending ? "Opening…" : "Enter exam"}</Button>
      </FieldGroup>
    </form>
  );
}
