"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { updateProfileAction } from "@/app/actions/student";

export function ProfileForm({ phone, guardian }: { phone: string; guardian: string }) {
  const [phoneV, setPhoneV] = useState(phone);
  const [guardianV, setGuardianV] = useState(guardian);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSaved(false);
    startTransition(async () => {
      const r = await updateProfileAction({ phone: phoneV, guardian: guardianV });
      if (!r.ok) setError(r.error ?? "Save failed.");
      else setSaved(true);
    });
  }

  return (
    <form onSubmit={submit}>
      <FieldGroup>
        <Field><FieldLabel htmlFor="p-phone">Phone</FieldLabel><Input id="p-phone" value={phoneV} onChange={(e) => setPhoneV(e.target.value)} /></Field>
        <Field><FieldLabel htmlFor="p-guardian">Guardian</FieldLabel><Input id="p-guardian" value={guardianV} onChange={(e) => setGuardianV(e.target.value)} /></Field>
        {error ? <p className="text-sm text-destructive" role="alert">{error}</p> : null}
        {saved ? <p className="text-sm text-emerald-600">Saved.</p> : null}
        <Button type="submit" disabled={pending}>{pending ? "Saving…" : "Save"}</Button>
      </FieldGroup>
    </form>
  );
}
