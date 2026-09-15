"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { upsertWhatsappAction } from "@/app/actions/admin";
import { getAdminFormOptionsAction } from "@/app/actions/admin-parity";
import { adminPrimaryButtonClass, adminSecondaryButtonClass } from "@/components/admin/admin-ui";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";

const inputClass = "h-11 rounded-lg border-neutral-300 bg-white text-neutral-950 focus-visible:border-black focus-visible:ring-black/20";
const selectClass = "w-full [&>select]:h-11 [&>select]:rounded-lg [&>select]:border-neutral-300 [&>select]:bg-white [&>select]:text-neutral-950";

export function WhatsappGlobalDialog({ onClose }: { onClose: () => void }) {
  const router = useRouter();
  const [classes, setClasses] = useState<{ id: string; name: string }[]>([]);
  const [classId, setClassId] = useState("");
  const [name, setName] = useState("");
  const [inviteUrl, setInviteUrl] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    setError(null);
    void getAdminFormOptionsAction().then((options) => {
      if (!options.scope.isAdmin) { setError("Administrator access is required."); return; }
      setClasses(options.classes);
      setClassId((current) => current || options.classes[0]?.id || "");
    }).catch(() => setError("Class options could not be loaded."));
  }, []);

  return (
    <Dialog open onOpenChange={(value) => { if (!value) onClose(); }}>
      <DialogContent className="max-h-[calc(100dvh-2rem)] sm:max-w-2xl overflow-y-auto rounded-2xl border-neutral-200 bg-white shadow-2xl">
        <DialogHeader><p className="text-[10px] font-bold uppercase tracking-[.14em] text-neutral-500">Class communication</p><DialogTitle className="font-display text-xl font-extrabold text-neutral-950">Add WhatsApp group</DialogTitle><DialogDescription>Select the class and save its official invite link. The relationship remains in production storage.</DialogDescription></DialogHeader>
        <FieldGroup>
          <Field><FieldLabel htmlFor="wg-class">Class</FieldLabel><NativeSelect id="wg-class" className={selectClass} value={classId} onChange={(event) => setClassId(event.target.value)}><NativeSelectOption value="">Choose class</NativeSelectOption>{classes.map((item) => <NativeSelectOption key={item.id} value={item.id}>{item.name}</NativeSelectOption>)}</NativeSelect></Field>
          <Field><FieldLabel htmlFor="wg-name">Group name</FieldLabel><Input id="wg-name" className={inputClass} value={name} onChange={(event) => setName(event.target.value)} maxLength={80} placeholder="SS1 Science Parents" /></Field>
          <Field><FieldLabel htmlFor="wg-url">Invite link</FieldLabel><Input id="wg-url" className={inputClass} type="url" inputMode="url" value={inviteUrl} onChange={(event) => setInviteUrl(event.target.value)} placeholder="https://chat.whatsapp.com/..." /></Field>
        </FieldGroup>
        {error ? <p className="text-sm text-destructive" role="alert">{error}</p> : null}
        <DialogFooter><Button variant="outline" className={adminSecondaryButtonClass} disabled={pending} onClick={onClose}>Cancel</Button><Button className={adminPrimaryButtonClass} disabled={pending || !classId || name.trim().length < 2 || !inviteUrl} onClick={() => startTransition(async () => { setError(null); const result = await upsertWhatsappAction({ classId, name: name.trim(), inviteUrl: inviteUrl.trim() }); if (!result.ok) { setError(result.error ?? "Save failed."); return; } onClose(); router.refresh(); })}>{pending ? "Saving…" : "Add group"}</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
