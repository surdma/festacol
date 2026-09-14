"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import { getUserDetailAction } from "@/app/actions/admin";
import { getAdminFormOptionsAction, getSubjectCatalogAction } from "@/app/actions/admin-parity";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { Switch } from "@/components/ui/switch";

export function StaffProvisionDialog() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [catalog, setCatalog] = useState<{ code: string; name: string }[]>([]);
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [subjects, setSubjects] = useState<string[]>([]);
  const [qualifierAccess, setQualifierAccess] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    if (!open) return;
    void getSubjectCatalogAction().then(setCatalog).catch(() => setError("Subject catalog could not be loaded."));
  }, [open]);

  function submit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    startTransition(async () => {
      const response = await fetch("/api/admin/staff", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ fullName, email, password, subjects, qualifierAccess }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) { setError(data.error ?? "Provisioning failed."); return; }
      setFullName(""); setEmail(""); setPassword(""); setSubjects([]); setQualifierAccess(false);
      setOpen(false);
      router.refresh();
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button />}><Plus data-icon="inline-start" />Add staff</DialogTrigger>
      <DialogContent className="max-h-[calc(100dvh-2rem)] max-w-2xl overflow-y-auto">
        <DialogHeader><DialogTitle>Provision teacher workspace</DialogTitle><DialogDescription>Creates the Supabase Auth login and linked staff roster record. Subject choices define the teacher's production scope.</DialogDescription></DialogHeader>
        <form onSubmit={submit}>
          <FieldGroup>
            <Field><FieldLabel htmlFor="sp-name">Full name</FieldLabel><Input id="sp-name" autoComplete="name" value={fullName} onChange={(event) => setFullName(event.target.value)} /></Field>
            <div className="grid gap-3 sm:grid-cols-2"><Field><FieldLabel htmlFor="sp-email">Email</FieldLabel><Input id="sp-email" type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} /></Field><Field><FieldLabel htmlFor="sp-pass">Temporary password</FieldLabel><Input id="sp-pass" type="password" minLength={8} autoComplete="new-password" value={password} onChange={(event) => setPassword(event.target.value)} /></Field></div>
            <SubjectPicker catalog={catalog} selected={subjects} onChange={setSubjects} />
            <Field><div className="flex items-center justify-between gap-4 rounded-xl border p-3"><div><FieldLabel htmlFor="sp-qual">Qualifier access</FieldLabel><p className="mt-1 text-xs text-muted-foreground">Allows the teacher to work with SS1 qualifier examinations.</p></div><Switch id="sp-qual" checked={qualifierAccess} onCheckedChange={setQualifierAccess} /></div></Field>
            {error ? <p className="text-sm text-destructive" role="alert">{error}</p> : null}
          </FieldGroup>
          <DialogFooter className="mt-5"><Button type="submit" disabled={pending || fullName.trim().length < 3 || !email || password.length < 8}>{pending ? "Provisioning…" : "Create teacher login"}</Button></DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function SubjectPicker({ catalog, selected, onChange }: { catalog: { code: string; name: string }[]; selected: string[]; onChange: (value: string[]) => void }) {
  return <Field><FieldLabel>Teaching subjects ({selected.length})</FieldLabel><div className="flex max-h-48 flex-wrap gap-2 overflow-auto rounded-xl border p-3">{catalog.map((subject) => { const active = selected.includes(subject.code); return <Button key={subject.code} type="button" size="sm" variant={active ? "default" : "outline"} onClick={() => onChange(active ? selected.filter((code) => code !== subject.code) : [...selected, subject.code])}>{subject.name}</Button>; })}{!catalog.length ? <p className="text-sm text-muted-foreground">No subject catalog is available yet.</p> : null}</div></Field>;
}

export function StaffScopeDialog({ staffId, onClose }: { staffId: string; onClose: () => void }) {
  const router = useRouter();
  const [catalog, setCatalog] = useState<{ code: string; name: string }[]>([]);
  const [classes, setClasses] = useState<{ id: string; name: string }[]>([]);
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [subjects, setSubjects] = useState<string[]>([]);
  const [classId, setClassId] = useState("");
  const [status, setStatus] = useState("active");
  const [qualifierAccess, setQualifierAccess] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    setError(null);
    void Promise.all([getAdminFormOptionsAction(), getUserDetailAction(staffId)]).then(([options, detail]) => {
      setCatalog(options.subjects);
      setClasses(options.classes);
      const user = detail.user as { role?: string; full_name?: string; email?: string; subjects?: string[]; class_id?: string | null; status?: string; qualifier_access?: boolean } | null;
      if (!user || (user.role !== "teacher" && user.role !== "administrator")) { setError("Staff record is unavailable."); return; }
      setFullName(user.full_name ?? ""); setEmail(user.email ?? ""); setSubjects(user.subjects ?? []); setClassId(user.class_id ?? ""); setStatus(user.status ?? "active"); setQualifierAccess(Boolean(user.qualifier_access));
    }).catch(() => setError("Staff record could not be loaded."));
  }, [staffId]);

  return (
    <Dialog open onOpenChange={(value) => { if (!value) onClose(); }}>
      <DialogContent className="max-h-[calc(100dvh-2rem)] max-w-2xl overflow-y-auto">
        <DialogHeader><DialogTitle>Edit staff scope</DialogTitle><DialogDescription>{fullName || staffId}{email ? ` · ${email}` : ""}. Authentication credentials are not changed here.</DialogDescription></DialogHeader>
        <FieldGroup>
          <SubjectPicker catalog={catalog} selected={subjects} onChange={setSubjects} />
          <Field><FieldLabel htmlFor="se-class">Assigned class</FieldLabel><NativeSelect id="se-class" value={classId} onChange={(event) => setClassId(event.target.value)}><NativeSelectOption value="">No class assignment</NativeSelectOption>{classes.map((item) => <NativeSelectOption key={item.id} value={item.id}>{item.name}</NativeSelectOption>)}</NativeSelect></Field>
          <Field><FieldLabel htmlFor="se-status">Status</FieldLabel><NativeSelect id="se-status" value={status} onChange={(event) => setStatus(event.target.value)}><NativeSelectOption value="active">Active</NativeSelectOption><NativeSelectOption value="inactive">Inactive</NativeSelectOption></NativeSelect></Field>
          <Field><div className="flex items-center justify-between gap-4 rounded-xl border p-3"><div><FieldLabel htmlFor="se-qual">Qualifier access</FieldLabel><p className="mt-1 text-xs text-muted-foreground">Grants access to SS1 qualifier exams and legacy qualifier domains.</p></div><Switch id="se-qual" checked={qualifierAccess} onCheckedChange={setQualifierAccess} /></div></Field>
        </FieldGroup>
        {error ? <p className="text-sm text-destructive" role="alert">{error}</p> : null}
        <DialogFooter><Button variant="outline" onClick={onClose}>Cancel</Button><Button disabled={pending || Boolean(error)} onClick={() => startTransition(async () => {
          setError(null);
          const response = await fetch("/api/admin/staff", { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ id: staffId, subjects, classId, status, qualifierAccess }) });
          const data = await response.json().catch(() => ({}));
          if (!response.ok) { setError(data.error ?? "Update failed."); return; }
          onClose(); router.refresh();
        })}>{pending ? "Saving…" : "Save staff scope"}</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
