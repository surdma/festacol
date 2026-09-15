"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { upsertClassAction } from "@/app/actions/admin";
import { getClassDetailAction } from "@/app/actions/admin-parity";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Field, FieldDescription, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";

const PATHWAYS = ["Science", "Arts", "Social Science", "General"] as const;

export function Task7ClassFormDialog({ open, onClose, classId }: { open: boolean; onClose: () => void; classId?: string }) {
  const router = useRouter();
  const [classLevel, setClassLevel] = useState("SS1");
  const [stream, setStream] = useState<(typeof PATHWAYS)[number]>("Science");
  const [arm, setArm] = useState("A");
  const [capacity, setCapacity] = useState(40);
  const [room, setRoom] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    if (!open) return;
    setError(null);
    if (!classId) {
      setClassLevel("SS1");
      setStream("Science");
      setArm("A");
      setCapacity(40);
      setRoom("");
      return;
    }
    void getClassDetailAction(classId).then((detail) => {
      const item = detail.classRow as { class_level?: string; stream?: string; arm?: string; capacity?: number; room?: string } | null;
      if (!item) { setError("Class record is unavailable."); return; }
      setClassLevel(item.class_level ?? "SS1");
      setStream(PATHWAYS.includes(item.stream as (typeof PATHWAYS)[number]) ? item.stream as (typeof PATHWAYS)[number] : "General");
      setArm(item.arm ?? "A");
      setCapacity(Number(item.capacity ?? 40));
      setRoom(item.room ?? "");
    }).catch(() => setError("Class record could not be loaded."));
  }, [classId, open]);

  function save() {
    setError(null);
    if (!Number.isInteger(capacity) || capacity < 1 || capacity > 500) {
      setError("Capacity must be between 1 and 500.");
      return;
    }
    startTransition(async () => {
      const result = await upsertClassAction({ id: classId, classLevel, stream, arm, capacity, room });
      if (!result.ok) { setError(result.error ?? "Class save failed."); return; }
      onClose();
      router.refresh();
    });
  }

  return (
    <Dialog open={open} onOpenChange={(value) => { if (!value) onClose(); }}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{classId ? "Edit class" : "Add class"}</DialogTitle>
          <DialogDescription>Classes are current student cohorts. Placement qualifiers remain examination workflows and are not created as normal class records.</DialogDescription>
        </DialogHeader>
        <FieldGroup>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field>
              <FieldLabel htmlFor="task7-class-level">Level</FieldLabel>
              <NativeSelect id="task7-class-level" value={classLevel} onChange={(event) => setClassLevel(event.target.value)}>
                {["SS1", "SS2", "SS3"].map((level) => <NativeSelectOption key={level} value={level}>{level}</NativeSelectOption>)}
              </NativeSelect>
            </Field>
            <Field>
              <FieldLabel htmlFor="task7-class-pathway">Pathway</FieldLabel>
              <NativeSelect id="task7-class-pathway" value={stream} onChange={(event) => setStream(event.target.value as (typeof PATHWAYS)[number])}>
                {PATHWAYS.map((value) => <NativeSelectOption key={value} value={value}>{value}</NativeSelectOption>)}
              </NativeSelect>
              <FieldDescription>Science, Arts and Social Science mirror the current prototype pathways. General is for non-specialized cohorts.</FieldDescription>
            </Field>
            <Field>
              <FieldLabel htmlFor="task7-class-arm">Arm</FieldLabel>
              <Input id="task7-class-arm" value={arm} onChange={(event) => setArm(event.target.value.toUpperCase())} maxLength={4} />
            </Field>
            <Field>
              <FieldLabel htmlFor="task7-class-capacity">Capacity</FieldLabel>
              <Input id="task7-class-capacity" type="number" min={1} max={500} value={capacity} onChange={(event) => setCapacity(Number(event.target.value))} />
              <FieldDescription>Used for occupancy and remaining-place calculations.</FieldDescription>
            </Field>
          </div>
          <Field>
            <FieldLabel htmlFor="task7-class-room">Room / location</FieldLabel>
            <Input id="task7-class-room" value={room} onChange={(event) => setRoom(event.target.value)} maxLength={50} placeholder="Science Wing · Room 4" />
          </Field>
        </FieldGroup>
        {error ? <p className="text-sm text-destructive" role="alert">{error}</p> : null}
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button disabled={pending} onClick={save}>{pending ? "Saving…" : classId ? "Update class" : "Add class"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
