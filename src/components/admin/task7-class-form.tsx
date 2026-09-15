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
import type { AcademicTrack } from "@/types/db";

const TRACKS: { id: AcademicTrack; label: string }[] = [
  { id: "science", label: "Science" },
  { id: "humanities", label: "Humanities" },
  { id: "business", label: "Business" },
];

export function Task7ClassFormDialog({ open, onClose, classId }: { open: boolean; onClose: () => void; classId?: string }) {
  const router = useRouter();
  const [classLevel, setClassLevel] = useState("SS1");
  const [track, setTrack] = useState<AcademicTrack>("science");
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
      setTrack("science");
      setArm("A");
      setCapacity(40);
      setRoom("");
      return;
    }
    void getClassDetailAction(classId).then((detail) => {
      const item = detail.classRow as { level_name?: string; track?: AcademicTrack; arm?: string; capacity?: number; room?: string } | null;
      if (!item) { setError("Class record is unavailable."); return; }
      setClassLevel(item.level_name ?? "SS1");
      setTrack(TRACKS.some((candidate) => candidate.id === item.track) ? item.track ?? "science" : "science");
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
      const result = await upsertClassAction({ id: classId, classLevel, track, arm, capacity, room });
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
              <FieldLabel htmlFor="task7-class-track">Track</FieldLabel>
              <NativeSelect id="task7-class-track" value={track} onChange={(event) => setTrack(event.target.value as AcademicTrack)}>
                {TRACKS.map((value) => <NativeSelectOption key={value.id} value={value.id}>{value.label}</NativeSelectOption>)}
              </NativeSelect>
              <FieldDescription>Use the canonical Science, Humanities or Business track for this class.</FieldDescription>
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
