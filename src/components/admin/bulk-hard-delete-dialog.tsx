"use client";

import { useEffect, useState, useTransition } from "react";
import { ShieldAlert, Trash2 } from "lucide-react";
import { hardDeleteMemberAction } from "@/app/actions/admin";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export interface BulkDeleteMember {
  id: string;
  name: string;
  identifier?: string | null;
  role: "student" | "teacher" | "administrator";
}

interface BulkHardDeleteDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  members: BulkDeleteMember[];
  onDeleted?: () => void;
}

export function BulkHardDeleteDialog({ open, onOpenChange, members, onDeleted }: BulkHardDeleteDialogProps) {
  const [confirmation, setConfirmation] = useState("");
  const [reason, setReason] = useState("");
  const [pending, startTransition] = useTransition();
  const [result, setResult] = useState<{ deleted: number; errors: string[] } | null>(null);
  const confirmationText = `DELETE ${members.length}`;

  useEffect(() => {
    if (!open) {
      setConfirmation("");
      setReason("");
      setResult(null);
    }
  }, [open]);

  function closeDialog() {
    if (result?.deleted) onDeleted?.();
    onOpenChange(false);
  }

  function handleOpenChange(nextOpen: boolean) {
    if (!nextOpen) {
      closeDialog();
      return;
    }
    onOpenChange(true);
  }

  function removeSelected() {
    if (!members.length || confirmation !== confirmationText) return;
    setResult(null);
    startTransition(async () => {
      let deleted = 0;
      const errors: string[] = [];

      // Delete sequentially so administrator safety checks are re-evaluated
      // after every member instead of racing multiple destructive mutations.
      for (const member of members) {
        const response = await hardDeleteMemberAction({
          memberId: member.id,
          confirmation: "DELETE",
          reason: reason.trim() || `Bulk directory removal (${members.length} selected)`,
        });
        if (response.ok) {
          deleted += 1;
        } else {
          errors.push(`${member.name}: ${response.error ?? "Delete failed."}`);
        }
      }

      setResult({ deleted, errors });
      if (!errors.length) {
        if (deleted > 0) onDeleted?.();
        onOpenChange(false);
      }
    });
  }

  return (
    <AlertDialog open={open} onOpenChange={handleOpenChange}>
      <AlertDialogContent className="max-w-lg">
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2">
            <Trash2 aria-hidden="true" />
            Delete {members.length} selected account{members.length === 1 ? "" : "s"}?
          </AlertDialogTitle>
          <AlertDialogDescription>
            This permanently removes each selected member and the relational records covered by the existing audited deletion workflow. Each account is checked and deleted independently so protected administrator accounts are not bypassed.
          </AlertDialogDescription>
        </AlertDialogHeader>

        <Alert variant="destructive">
          <ShieldAlert aria-hidden="true" />
          <AlertTitle>Permanent academic-data removal</AlertTitle>
          <AlertDescription>
            Student attempts, results and integrity history are deleted with the account. Successful deletions cannot be restored.
          </AlertDescription>
        </Alert>

        <div className="max-h-40 overflow-y-auto rounded-lg border">
          <ul className="divide-y text-sm">
            {members.map((member) => (
              <li key={member.id} className="flex items-center justify-between gap-3 px-3 py-2">
                <span className="min-w-0">
                  <strong className="block truncate">{member.name}</strong>
                  <span className="block truncate text-xs text-muted-foreground">{member.identifier ?? member.id}</span>
                </span>
                <span className="shrink-0 text-xs capitalize text-muted-foreground">{member.role}</span>
              </li>
            ))}
          </ul>
        </div>

        <div className="grid gap-4">
          <div className="grid gap-2">
            <Label htmlFor="bulk-delete-confirm">Type {confirmationText} to confirm</Label>
            <Input
              id="bulk-delete-confirm"
              value={confirmation}
              onChange={(event) => setConfirmation(event.target.value)}
              autoComplete="off"
              spellCheck={false}
              placeholder={confirmationText}
              aria-invalid={confirmation.length > 0 && confirmation !== confirmationText}
              disabled={pending || Boolean(result)}
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="bulk-delete-reason">Reason (optional)</Label>
            <Input
              id="bulk-delete-reason"
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              maxLength={280}
              disabled={pending || Boolean(result)}
              placeholder="Why these accounts are being removed"
            />
          </div>
        </div>

        {result ? (
          <Alert variant={result.errors.length ? "destructive" : "default"}>
            <AlertTitle>{result.deleted} deleted</AlertTitle>
            <AlertDescription>
              {result.errors.length
                ? `${result.errors.length} account${result.errors.length === 1 ? "" : "s"} could not be deleted: ${result.errors.join(" ")}`
                : "All selected accounts were removed and their audit rows were preserved."}
            </AlertDescription>
          </Alert>
        ) : null}

        <AlertDialogFooter>
          <Button variant="outline" onClick={closeDialog} disabled={pending}>{result ? "Close" : "Cancel"}</Button>
          {!result ? (
            <Button variant="destructive" onClick={removeSelected} disabled={pending || !members.length || confirmation !== confirmationText}>
              <Trash2 data-icon="inline-start" />
              {pending ? "Deleting selected…" : `Delete ${members.length} account${members.length === 1 ? "" : "s"}`}
            </Button>
          ) : null}
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
