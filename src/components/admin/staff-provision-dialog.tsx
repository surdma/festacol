"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import { getAdminFormOptionsAction, type OfferingOption, type SubjectOption } from "@/app/actions/admin-parity";
import { getStaffScopeDetailAction } from "@/app/actions/staff-scope";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";

type ScopeState = { subjectIds: string[]; offeringIds: string[] };

function ScopeFields({ subjects, offerings, value, onChange }: { subjects: SubjectOption[]; offerings: OfferingOption[]; value: ScopeState; onChange: (next: ScopeState) => void }) {
  const visibleOfferings = useMemo(() => offerings.filter((item) => item.status === "active" && value.subjectIds.includes(item.subjectId)), [offerings, value.subjectIds]);
  function toggleSubject(subjectId: string) {
    const subjectIds = value.subjectIds.includes(subjectId) ? value.subjectIds.filter((id) => id !== subjectId) : [...value.subjectIds, subjectId];
    const allowed = new Set(subjectIds);
    const offeringIds = value.offeringIds.filter((id) => {
      const offering = offerings.find((item) => item.id === id);
      return Boolean(offering && allowed.has(offering.subjectId));
    });
    onChange({ ...value, subjectIds, offeringIds });
  }
  function toggleOffering(offeringId: string) {
    onChange({ ...value, offeringIds: value.offeringIds.includes(offeringId) ? value.offeringIds.filter((id) => id !== offeringId) : [...value.offeringIds, offeringId] });
  }
  return <>
    <Field><FieldLabel>Subject qualifications ({value.subjectIds.length})</FieldLabel><div className="flex max-h-44 flex-wrap gap-2 overflow-auto rounded-xl border p-3">{subjects.map((subject) => <Button key={subject.id} type="button" size="sm" variant={value.subjectIds.includes(subject.id) ? "default" : "outline"} onClick={() => toggleSubject(subject.id)}>{subject.name}</Button>)}</div><p className="mt-1 text-xs text-muted-foreground">Qualifications define the teacher's normal exam, question, report and activity scope. Entrance and placement exams are always available.</p></Field>
    <Field><FieldLabel>Teaching assignments ({value.offeringIds.length})</FieldLabel><div className="grid max-h-60 gap-2 overflow-auto rounded-xl border p-3 sm:grid-cols-2">{visibleOfferings.map((offering) => <Button key={offering.id} type="button" variant={value.offeringIds.includes(offering.id) ? "default" : "outline"} className="h-auto justify-start whitespace-normal px-3 py-2 text-left" onClick={() => toggleOffering(offering.id)}><span><strong className="block">{offering.subjectName} · {offering.className}</strong><span className="block text-xs opacity-70">{offering.trackName} · {offering.academicYear}</span></span></Button>)}{!visibleOfferings.length ? <p className="text-sm text-muted-foreground">Choose a qualification, then select the class-subject offering(s) this teacher actually teaches.</p> : null}</div></Field>
  </>;
}

export function StaffProvisionDialog() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [subjects, setSubjects] = useState<SubjectOption[]>([]);
  const [offerings, setOfferings] = useState<OfferingOption[]>([]);
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [temporaryPassword, setTemporaryPassword] = useState("");
  const [scope, setScope] = useState<ScopeState>({ subjectIds: [], offeringIds: [] });
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  useEffect(() => { if (open) void getAdminFormOptionsAction().then((options) => { setSubjects(options.subjects); setOfferings(options.offerings); }).catch(() => setError("Staff scope options could not be loaded.")); }, [open]);
  return <Dialog open={open} onOpenChange={setOpen}><DialogTrigger render={<Button />}><Plus data-icon="inline-start" />Add staff</DialogTrigger><DialogContent className="sm:max-w-3xl"><DialogHeader><DialogTitle>Provision teacher workspace</DialogTitle><DialogDescription>Subject qualifications define the teacher workspace. Classroom assignments remain a separate scheduling record; entrance and placement exams are available to every teacher.</DialogDescription></DialogHeader><FieldGroup><Field><FieldLabel htmlFor="staff-name">Full name</FieldLabel><Input id="staff-name" value={fullName} onChange={(event) => setFullName(event.target.value)} /></Field><div className="grid gap-3 sm:grid-cols-2"><Field><FieldLabel htmlFor="staff-email">Email</FieldLabel><Input id="staff-email" type="email" value={email} onChange={(event) => setEmail(event.target.value)} /></Field><Field><FieldLabel htmlFor="staff-pass">Temporary password</FieldLabel><Input id="staff-pass" type="password" minLength={8} value={temporaryPassword} onChange={(event) => setTemporaryPassword(event.target.value)} /></Field></div><ScopeFields subjects={subjects} offerings={offerings} value={scope} onChange={setScope} />{error ? <p className="text-sm text-destructive">{error}</p> : null}</FieldGroup><DialogFooter><Button disabled={pending || fullName.trim().length < 3 || !email || temporaryPassword.length < 8 || !scope.subjectIds.length} onClick={() => startTransition(async () => { setError(null); const response = await fetch("/api/admin/staff", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ fullName, email, password: temporaryPassword, ...scope }) }); const data = await response.json().catch(() => ({})); if (!response.ok) { setError(data.error ?? "Provisioning failed."); return; } setOpen(false); router.refresh(); })}>{pending ? "Provisioning…" : "Create teacher login"}</Button></DialogFooter></DialogContent></Dialog>;
}

export function StaffScopeDialog({ staffId, onClose }: { staffId: string; onClose: () => void }) {
  const router = useRouter();
  const [subjects, setSubjects] = useState<SubjectOption[]>([]);
  const [offerings, setOfferings] = useState<OfferingOption[]>([]);
  const [name, setName] = useState(staffId);
  const [status, setStatus] = useState("active");
  const [scope, setScope] = useState<ScopeState>({ subjectIds: [], offeringIds: [] });
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  useEffect(() => { void Promise.all([getAdminFormOptionsAction(), getStaffScopeDetailAction(staffId)]).then(([options, detail]) => { setSubjects(options.subjects); setOfferings(options.offerings); if (!detail) { setError("Staff record is unavailable."); return; } setName(detail.fullName); setStatus(detail.status); setScope({ subjectIds: detail.subjectIds, offeringIds: detail.offeringIds }); }).catch(() => setError("Staff record could not be loaded.")); }, [staffId]);
  return <Dialog open onOpenChange={(value) => { if (!value) onClose(); }}><DialogContent className="sm:max-w-3xl"><DialogHeader><DialogTitle>Edit staff scope</DialogTitle><DialogDescription>{name}. Qualifications determine the normal teaching workspace; assignments record the actual classes taught. Entrance and placement exams are always available.</DialogDescription></DialogHeader><FieldGroup><ScopeFields subjects={subjects} offerings={offerings} value={scope} onChange={setScope} /><Field><FieldLabel htmlFor="staff-status">Status</FieldLabel><NativeSelect id="staff-status" value={status} onChange={(event) => setStatus(event.target.value)}><NativeSelectOption value="active">Active</NativeSelectOption><NativeSelectOption value="inactive">Inactive</NativeSelectOption></NativeSelect></Field>{error ? <p className="text-sm text-destructive">{error}</p> : null}</FieldGroup><DialogFooter><Button variant="outline" onClick={onClose}>Cancel</Button><Button disabled={pending || Boolean(error) || !scope.subjectIds.length} onClick={() => startTransition(async () => { setError(null); const response = await fetch("/api/admin/staff", { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ id: staffId, status, ...scope }) }); const data = await response.json().catch(() => ({})); if (!response.ok) { setError(data.error ?? "Update failed."); return; } onClose(); router.refresh(); })}>{pending ? "Saving…" : "Save staff scope"}</Button></DialogFooter></DialogContent></Dialog>;
}
