"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CirclePause, CirclePlay } from "lucide-react";
import { toggleUserAction } from "@/app/actions/admin";
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

export function StudentStatusButton({ studentId, name, active, compact = false }: { studentId: string; name: string; active: boolean; compact?: boolean }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const nextActive = !active;

  function updateStatus() {
    setError(null);
    startTransition(async () => {
      const result = await toggleUserAction(studentId, nextActive);
      if (!result.ok) { setError(result.error ?? "Student status could not be updated."); return; }
      router.refresh();
    });
  }

  const Icon = active ? CirclePause : CirclePlay;
  const label = active ? "Suspend" : "Activate";

  return (
    <div className="inline-flex flex-col items-end gap-1">
      <AlertDialog>
        <AlertDialogTrigger render={<Button type="button" size={compact ? "icon" : "sm"} variant="outline" disabled={pending} aria-label={`${label} ${name}`} />}>
          <Icon />{compact ? null : label}
        </AlertDialogTrigger>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{label} {name}?</AlertDialogTitle>
            <AlertDialogDescription>{active ? "The student remains in the academic directory and keeps all class, examination, placement and integrity history, but the account is marked inactive." : "The student is returned to active status without changing class assignment or academic history."}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction disabled={pending} onClick={updateStatus}>{label} student</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      {error ? <span className="max-w-48 text-right text-[10px] text-destructive">{error}</span> : null}
    </div>
  );
}
