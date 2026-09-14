"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";
import { deleteClassAction, deleteWhatsappAction, toggleUserAction, upsertClassAction, upsertQuestionAction, upsertUserAction, upsertWhatsappAction } from "@/app/actions/admin";

function Shell({ title, open, onClose, submit, pending, error, children }: {
  title: string; open: boolean; onClose: () => void; submit: () => void; pending: boolean; error: string | null; children: React.ReactNode;
}) {
  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent className="max-w-2xl">
        <DialogHeader><DialogTitle>{title}</DialogTitle></DialogHeader>
        <FieldGroup>{children}</FieldGroup>
        {error ? <p className="text-sm text-destructive" role="alert">{error}</p> : null}
        <DialogFooter><Button onClick={submit} disabled={pending}>{pending ? "Saving…" : "Save"}</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function UserFormDialog({ open, onClose, presetRole }: { open: boolean; onClose: () => void; presetRole: string }) {
  const router = useRouter();
  const [fullName, setFullName] = useState("");
  const [role, setRole] = useState(presetRole);
  const [classId, setClassId] = useState("");
  const [guardian, setGuardian] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  return (
    <Shell title="Add user" open={open} pending={pending} error={error}
      onClose={onClose}
      submit={() => startTransition(async () => {
        const r = await upsertUserAction({ fullName, role, classId, guardian });
        if (!r.ok) { setError(r.error ?? "Save failed."); return; }
        onClose(); router.refresh();
      })}>
      <Field><FieldLabel htmlFor="u-name">Full name</FieldLabel><Input id="u-name" value={fullName} onChange={(e) => setFullName(e.target.value)} /></Field>
      <div className="grid grid-cols-2 gap-3">
        <Field><FieldLabel htmlFor="u-role">Role</FieldLabel>
          <NativeSelect id="u-role" value={role} onChange={(e) => setRole(e.target.value)}>
            {["student", "teacher", "administrator"].map((r) => <NativeSelectOption key={r} value={r}>{r}</NativeSelectOption>)}
          </NativeSelect></Field>
        <Field><FieldLabel htmlFor="u-class">Class ID</FieldLabel><Input id="u-class" value={classId} onChange={(e) => setClassId(e.target.value)} /></Field>
      </div>
      <Field><FieldLabel htmlFor="u-guardian">Guardian</FieldLabel><Input id="u-guardian" value={guardian} onChange={(e) => setGuardian(e.target.value)} /></Field>
    </Shell>
  );
}

export function ClassFormDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const router = useRouter();
  const [classLevel, setClassLevel] = useState("SS1");
  const [stream, setStream] = useState("Science");
  const [capacity, setCapacity] = useState(40);
  const [room, setRoom] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  return (
    <Shell title="Add class" open={open} pending={pending} error={error}
      onClose={onClose}
      submit={() => startTransition(async () => {
        const r = await upsertClassAction({ classLevel, stream, capacity, room });
        if (!r.ok) { setError(r.error ?? "Save failed."); return; }
        onClose(); router.refresh();
      })}>
      <div className="grid grid-cols-2 gap-3">
        <Field><FieldLabel htmlFor="c-level">Level</FieldLabel>
          <NativeSelect id="c-level" value={classLevel} onChange={(e) => setClassLevel(e.target.value)}>
            {["SS1", "SS2", "SS3"].map((l) => <NativeSelectOption key={l} value={l}>{l}</NativeSelectOption>)}
          </NativeSelect></Field>
        <Field><FieldLabel htmlFor="c-stream">Stream</FieldLabel><Input id="c-stream" value={stream} onChange={(e) => setStream(e.target.value)} /></Field>
        <Field><FieldLabel htmlFor="c-cap">Capacity</FieldLabel><Input id="c-cap" type="number" min={1} max={500} value={capacity} onChange={(e) => setCapacity(Number(e.target.value))} /></Field>
        <Field><FieldLabel htmlFor="c-room">Room</FieldLabel><Input id="c-room" value={room} onChange={(e) => setRoom(e.target.value)} /></Field>
      </div>
    </Shell>
  );
}

export function WhatsappFormDialog({ open, onClose, classId }: { open: boolean; onClose: () => void; classId: string }) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [inviteUrl, setInviteUrl] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  return (
    <Shell title="Add WhatsApp group" open={open} pending={pending} error={error}
      onClose={onClose}
      submit={() => startTransition(async () => {
        const r = await upsertWhatsappAction({ classId, name, inviteUrl });
        if (!r.ok) { setError(r.error ?? "Save failed."); return; }
        onClose(); router.refresh();
      })}>
      <Field><FieldLabel htmlFor="w-name">Group name</FieldLabel><Input id="w-name" value={name} onChange={(e) => setName(e.target.value)} /></Field>
      <Field><FieldLabel htmlFor="w-url">Invite link</FieldLabel><Input id="w-url" type="url" value={inviteUrl} onChange={(e) => setInviteUrl(e.target.value)} /></Field>
    </Shell>
  );
}

export function QuestionFormDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const router = useRouter();
  const [subject, setSubject] = useState("");
  const [subjectCode, setSubjectCode] = useState("");
  const [prompt, setPrompt] = useState("");
  const [options, setOptions] = useState(["", "", "", ""]);
  const [correct, setCorrect] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  return (
    <Shell title="Add question" open={open} pending={pending} error={error}
      onClose={onClose}
      submit={() => startTransition(async () => {
        const r = await upsertQuestionAction({ subject, subjectCode, kind: "single", prompt, options: options.filter(Boolean), correct, levels: ["SS1", "SS2", "SS3"] });
        if (!r.ok) { setError(r.error ?? "Save failed."); return; }
        onClose(); router.refresh();
      })}>
      <div className="grid grid-cols-2 gap-3">
        <Field><FieldLabel htmlFor="q-sub">Subject</FieldLabel><Input id="q-sub" value={subject} onChange={(e) => setSubject(e.target.value)} /></Field>
        <Field><FieldLabel htmlFor="q-code">Subject code</FieldLabel><Input id="q-code" value={subjectCode} onChange={(e) => setSubjectCode(e.target.value)} /></Field>
      </div>
      <Field><FieldLabel htmlFor="q-prompt">Prompt</FieldLabel><Textarea id="q-prompt" value={prompt} onChange={(e) => setPrompt(e.target.value)} /></Field>
      {options.map((o, i) => (
        <Field key={i}><FieldLabel htmlFor={`q-o${i}`}>Option {String.fromCharCode(65 + i)}</FieldLabel>
          <Input id={`q-o${i}`} value={o} onChange={(e) => setOptions((arr) => arr.map((x, j) => (j === i ? e.target.value : x)))} /></Field>
      ))}
      <Field><FieldLabel htmlFor="q-correct">Correct answer</FieldLabel><Input id="q-correct" value={correct} onChange={(e) => setCorrect(e.target.value)} /></Field>
    </Shell>
  );
}

export function DeleteButtons({ kind, id, extra }: { kind: "class" | "whatsapp" | "user"; id: string; extra?: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  return (
    <Button size="sm" variant="destructive" disabled={pending}
      onClick={() => startTransition(async () => {
        if (kind === "class") await deleteClassAction(id);
        else if (kind === "whatsapp") await deleteWhatsappAction(id);
        else await toggleUserAction(id, false);
        void extra;
        router.refresh();
      })}>
      {kind === "user" ? "Suspend" : "Delete"}
    </Button>
  );
}
