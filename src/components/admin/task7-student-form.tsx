"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ArrowRightLeft, UserRoundPlus } from "lucide-react";
import { getUserDetailAction, upsertUserAction } from "@/app/actions/admin";
import { getAdminFormOptionsAction } from "@/app/actions/admin-parity";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Field, FieldDescription, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";

interface ClassOption { id: string; name: string }

export function Task7StudentFormDialog({ open, onClose, userId }: { open: boolean; onClose: () => void; userId?: string }) {
  const router = useRouter();
  const [classes, setClasses] = useState<ClassOption[]>([]);
  const [fullName, setFullName] = useState("");
  const [classId, setClassId] = useState("");
  const [originalClassId, setOriginalClassId] = useState("");
  const [guardian, setGuardian] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    if (!open) return;
    setError(null);
    void getAdminFormOptionsAction().then((options) => setClasses(options.classes)).catch(() => setError("Class options could not be loaded."));
    if (!userId) {
      setFullName("");
      setClassId("");
      setOriginalClassId("");
      setGuardian("");
      return;
    }
    void getUserDetailAction(userId).then((detail) => {
      const user = detail.user as { full_name?: string; class_id?: string | null; guardian?: string; role?: string } | null;
      if (!user || user.role !== "student") { setError("Student record is unavailable."); return; }
      setFullName(user.full_name ?? "");
      setClassId(user.class_id ?? "");
      setOriginalClassId(user.class_id ?? "");
      setGuardian(user.guardian ?? "");
    }).catch(() => setError("Student record could not be loaded."));
  }, [open, userId]);

  const className = useMemo(() => new Map(classes.map((item) => [item.id, item.name])), [classes]);
  const movingClass = Boolean(userId && originalClassId !== classId);

  function save() {
    setError(null);
    startTransition(async () => {
      const result = await upsertUserAction({ id: userId, fullName, role: "student", classId, guardian });
      if (!result.ok) { setError(result.error ?? "Student save failed."); return; }
      onClose();
      router.refresh();
    });
  }

  return (
    <Dialog open={open} onOpenChange={(value) => { if (!value) onClose(); }}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <div className="mb-2 grid size-10 place-items-center rounded-xl bg-foreground text-background">{userId ? <ArrowRightLeft /> : <UserRoundPlus />}</div>
          <DialogTitle>{userId ? "Edit student" : "Add student"}</DialogTitle>
          <DialogDescription>{userId ? "A student has one current class. Changing the class below moves the student; examination, integrity and rewrite history remain attached to the student identity." : "Create the student identity and assign one current class. Examination history will accumulate against this identity."}</DialogDescription>
        </DialogHeader>

        <FieldGroup>
          <Field>
            <FieldLabel htmlFor="task7-student-name">Full name</FieldLabel>
            <Input id="task7-student-name" autoComplete="name" value={fullName} onChange={(event) => setFullName(event.target.value)} />
          </Field>
          <Field>
            <FieldLabel htmlFor="task7-student-class">Current class</FieldLabel>
            <NativeSelect id="task7-student-class" value={classId} onChange={(event) => setClassId(event.target.value)}>
              <NativeSelectOption value="">Unassigned</NativeSelectOption>
              {classes.map((item) => <NativeSelectOption key={item.id} value={item.id}>{item.name}</NativeSelectOption>)}
            </NativeSelect>
            <FieldDescription>Only one current class is stored. Use the student record to inspect historical examination context after a move.</FieldDescription>
          </Field>
          {movingClass ? <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950"><div className="flex items-start gap-3"><ArrowRightLeft className="mt-0.5 size-4 shrink-0" /><div><strong className="block">Move student to a new class</strong><p className="mt-1 text-xs leading-5 text-amber-800">{originalClassId ? className.get(originalClassId) ?? originalClassId : "Unassigned"} → {classId ? className.get(classId) ?? classId : "Unassigned"}. Existing attempt hashes, scores and integrity logs are not reassigned or deleted.</p></div></div></div> : null}
          <Field>
            <FieldLabel htmlFor="task7-student-guardian">Guardian / parent</FieldLabel>
            <Input id="task7-student-guardian" value={guardian} onChange={(event) => setGuardian(event.target.value)} maxLength={80} />
          </Field>
        </FieldGroup>

        {error ? <p className="text-sm text-destructive" role="alert">{error}</p> : null}
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button disabled={pending || fullName.trim().length < 2} onClick={save}>{pending ? "Saving…" : movingClass ? "Move student" : userId ? "Update student" : "Add student"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
