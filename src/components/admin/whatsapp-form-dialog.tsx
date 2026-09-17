"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ExternalLink, MessageCircle, QrCode, Trash2 } from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import { deleteWhatsappAction } from "@/app/actions/admin";
import { getAdminFormOptionsAction, getWhatsappDetailAction } from "@/app/actions/admin-parity";
import { upsertSingleClassWhatsappAction } from "@/app/actions/academic-records";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Field, FieldDescription, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";

export function WhatsappFormDialog({
  open,
  onClose,
  classId: initialClassId,
  groupId,
}: {
  open: boolean;
  onClose: () => void;
  classId?: string;
  groupId?: string;
}) {
  const router = useRouter();
  const [classes, setClasses] = useState<{ id: string; name: string }[]>([]);
  const [classId, setClassId] = useState(initialClassId ?? "");
  const [name, setName] = useState("");
  const [inviteUrl, setInviteUrl] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const showQr = inviteUrl.startsWith("https://");

  useEffect(() => {
    if (!open) return;
    setError(null);
    void getAdminFormOptionsAction().then((options) => setClasses(options.classes)).catch(() => setError("Class options could not be loaded."));
    if (!groupId) {
      setClassId(initialClassId ?? "");
      setName("");
      setInviteUrl("");
      return;
    }
    void getWhatsappDetailAction(groupId).then((group) => {
      const item = group as { class_id?: string; name?: string; invite_url?: string } | null;
      if (!item) { setError("WhatsApp group is unavailable."); return; }
      setClassId(item.class_id ?? initialClassId ?? "");
      setName(item.name ?? "");
      setInviteUrl(item.invite_url ?? "");
    }).catch(() => setError("WhatsApp group could not be loaded."));
  }, [groupId, initialClassId, open]);

  function save() {
    setError(null);
    startTransition(async () => {
      const result = await upsertSingleClassWhatsappAction({ id: groupId, classId, name, inviteUrl });
      if (!result.ok) { setError(result.error ?? "WhatsApp group save failed."); return; }
      onClose();
      router.refresh();
    });
  }

  function remove() {
    if (!groupId) return;
    setError(null);
    startTransition(async () => {
      const result = await deleteWhatsappAction(groupId);
      if (!result.ok) { setError(result.error ?? "WhatsApp group could not be deleted."); return; }
      onClose();
      router.refresh();
    });
  }

  return (
    <Dialog open={open} onOpenChange={(value) => { if (!value) onClose(); }}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <div className="mb-2 grid size-10 place-items-center rounded-xl bg-foreground text-background"><MessageCircle /></div>
          <DialogTitle>{groupId ? "Edit class WhatsApp group" : "Connect class WhatsApp"}</DialogTitle>
          <DialogDescription>Each class owns at most one parent/student WhatsApp mapping. Festacol stores the validated invite and uses it for class communication and QR access.</DialogDescription>
        </DialogHeader>
        <FieldGroup>
          <Field>
            <FieldLabel htmlFor="whatsapp-class">Class</FieldLabel>
            <NativeSelect id="whatsapp-class" value={classId} onChange={(event) => setClassId(event.target.value)} disabled={Boolean(groupId)}>
              <NativeSelectOption value="">Choose class</NativeSelectOption>
              {classes.map((item) => <NativeSelectOption key={item.id} value={item.id}>{item.name}</NativeSelectOption>)}
            </NativeSelect>
            <FieldDescription>{groupId ? "The mapping remains owned by its current class. Delete it before moving communication to another class." : "If a class already has a group, edit that mapping instead of creating another."}</FieldDescription>
          </Field>
          <Field>
            <FieldLabel htmlFor="whatsapp-name">Group name</FieldLabel>
            <Input id="whatsapp-name" value={name} onChange={(event) => setName(event.target.value)} maxLength={80} placeholder="SS2 Science Parents" />
          </Field>
          <Field>
            <FieldLabel htmlFor="whatsapp-url">Official invite link</FieldLabel>
            <Input id="whatsapp-url" type="url" inputMode="url" value={inviteUrl} onChange={(event) => setInviteUrl(event.target.value)} placeholder="https://chat.whatsapp.com/..." />
            <FieldDescription>Only secure WhatsApp invite hosts are accepted.</FieldDescription>
          </Field>

          {showQr ? (
            <div className="grid gap-4 rounded-2xl border bg-muted/20 p-4 sm:grid-cols-[176px_minmax(0,1fr)] sm:items-center">
              <div className="grid w-44 place-items-center rounded-xl border bg-white p-3 shadow-xs">
                <QRCodeSVG value={inviteUrl} size={152} level="M" aria-label={`QR code for ${name || "WhatsApp group"}`} />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2 text-sm font-semibold"><QrCode className="size-4" aria-hidden="true" />WhatsApp QR access</div>
                <p className="mt-1 text-xs leading-5 text-muted-foreground">Scan this code to open the exact saved invite. The QR updates immediately when the invite link changes.</p>
                <p className="mt-3 truncate font-mono text-[11px] text-muted-foreground">{inviteUrl}</p>
                <Button className="mt-3" size="sm" variant="outline" render={<a href={inviteUrl} target="_blank" rel="noopener noreferrer" />}>
                  <ExternalLink data-icon="inline-start" />Open invite
                </Button>
              </div>
            </div>
          ) : null}
        </FieldGroup>
        {error ? <p className="text-sm text-destructive" role="alert">{error}</p> : null}
        <DialogFooter className="sm:justify-between">
          <div>{groupId ? <AlertDialog><AlertDialogTrigger render={<Button type="button" variant="outline" disabled={pending} className="border-red-200 text-red-700 hover:bg-red-50" />}><Trash2 data-icon="inline-start" />Delete mapping</AlertDialogTrigger><AlertDialogContent><AlertDialogHeader><AlertDialogTitle>Delete this WhatsApp mapping?</AlertDialogTitle><AlertDialogDescription>The class and its students remain intact. Only the stored invite relationship and its QR/open destination are removed.</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel>Cancel</AlertDialogCancel><AlertDialogAction disabled={pending} onClick={remove}>Delete mapping</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog> : null}</div>
          <div className="flex gap-2"><Button variant="outline" onClick={onClose}>Cancel</Button><Button disabled={pending || !classId || !name.trim() || !inviteUrl.trim()} onClick={save}>{pending ? "Saving…" : groupId ? "Update mapping" : "Connect group"}</Button></div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
