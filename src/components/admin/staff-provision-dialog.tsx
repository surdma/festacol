"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";

// Staff provisioning: creates the auth login + linked roster row via the
// protected REST endpoint (admin session required server-side, so teachers
// calling it get 403). Rendered only for admins.
export function StaffProvisionDialog() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [subjects, setSubjects] = useState("");
  const [qualifierAccess, setQualifierAccess] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      const res = await fetch("/api/admin/staff", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ fullName, email, password, subjects, qualifierAccess }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) { setError(data.error ?? "Provisioning failed."); return; }
      setOpen(false);
      router.refresh();
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button />}>Add staff</DialogTrigger>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Provision staff login</DialogTitle>
          <DialogDescription>Creates the sign-in account and links it to the staff roster. Subjects scope their workspace.</DialogDescription>
        </DialogHeader>
        <form onSubmit={submit}>
          <FieldGroup>
            <Field><FieldLabel htmlFor="sp-name">Full name</FieldLabel><Input id="sp-name" value={fullName} onChange={(e) => setFullName(e.target.value)} /></Field>
            <div className="grid grid-cols-2 gap-3">
              <Field><FieldLabel htmlFor="sp-email">Email</FieldLabel><Input id="sp-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} /></Field>
              <Field><FieldLabel htmlFor="sp-pass">Password (8+)</FieldLabel><Input id="sp-pass" type="password" value={password} onChange={(e) => setPassword(e.target.value)} /></Field>
            </div>
            <Field><FieldLabel htmlFor="sp-sub">Subjects (comma-separated codes)</FieldLabel><Input id="sp-sub" value={subjects} onChange={(e) => setSubjects(e.target.value)} placeholder="q-eng" /></Field>
            <Field>
              <div className="flex items-center justify-between gap-3">
                <FieldLabel htmlFor="sp-qual">Qualifier access</FieldLabel>
                <Switch id="sp-qual" checked={qualifierAccess} onCheckedChange={setQualifierAccess} />
              </div>
            </Field>
            {error ? <p className="text-sm text-destructive" role="alert">{error}</p> : null}
          </FieldGroup>
          <DialogFooter className="mt-4">
            <Button type="submit" disabled={pending}>{pending ? "Provisioning…" : "Create staff login"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
