"use client";

import { useState, useRef, useTransition } from "react";
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
import { hardDeleteMemberAction } from "@/app/actions/admin";
import { Trash2, ShieldAlert } from "lucide-react";

interface HardDeleteDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  memberId?: string;
  memberName?: string;
  memberStudentNumber?: string | null;
  onDeleted?: (auditId?: string) => void;
}

export function HardDeleteDialog({
  open,
  onOpenChange,
  memberId,
  memberName,
  memberStudentNumber,
  onDeleted,
}: HardDeleteDialogProps) {
  const [confirmation, setConfirmation] = useState("");
  const [reason, setReason] = useState("");
  const [pending, startTransition] = useTransition();
  const [result, setResult] = useState<{ ok: boolean; error?: string; auditId?: string } | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleConfirm = () => {
    if (!memberId) return;
    setResult(null);
    startTransition(async () => {
      const res = await hardDeleteMemberAction({
        memberId,
        confirmation,
        reason: reason.trim() || undefined,
      });
      setResult(res);
      if (res.ok) {
        setTimeout(() => {
          onOpenChange(false);
          onDeleted?.(res.auditId);
        }, 1200);
      }
    });
  };

  const canConfirm = confirmation === "DELETE" && memberId && !pending;

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="hard-delete-title"
        aria-describedby="hard-delete-desc"
        className="max-w-md"
      >
        <AlertDialogHeader>
          <AlertDialogTitle id="hard-delete-title" className="flex items-center gap-2 text-red-600 dark:text-red-400">
            <Trash2 className="size-5" aria-hidden="true" />
            Permanent deletion
          </AlertDialogTitle>
          <AlertDialogDescription id="hard-delete-desc" className="space-y-2 text-sm">
            <p>
              <strong>Scope:</strong> This removes the member, their auth login,
              all exam attempts and results, enrolments, and related records.
              Only one audit row survives.
            </p>
            <div className="rounded-lg bg-red-50 p-3 text-xs text-red-800 dark:bg-red-950/30 dark:text-red-200">
              <span className="font-semibold">Target:</span>{" "}
              {memberName ?? memberId ?? "Unknown account"}
              {memberStudentNumber ? ` (${memberStudentNumber})` : null}
            </div>
            <div className="rounded-lg bg-amber-50 p-3 text-xs text-amber-800 dark:bg-amber-950/30 dark:text-amber-200">
              <ShieldAlert className="mb-1 size-4" aria-hidden="true" />
              Deleted attempts and results cannot be recovered.
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>

        <div className="space-y-4">
          <div>
            <Label htmlFor="delete-confirm">Type DELETE to confirm</Label>
            <Input
              id="delete-confirm"
              ref={inputRef}
              value={confirmation}
              onChange={(e) => setConfirmation(e.target.value)}
              autoComplete="off"
              autoCorrect="off"
              spellCheck={false}
              aria-required="true"
              aria-invalid={confirmation.length > 0 && confirmation !== "DELETE"}
              placeholder="DELETE"
              className="font-mono uppercase"
              disabled={pending}
            />
            <p className="mt-1 text-xs text-muted-foreground">
              Must match exactly.
            </p>
          </div>
          <div>
            <Label htmlFor="delete-reason">Reason (optional)</Label>
            <Input
              id="delete-reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              disabled={pending}
              maxLength={280}
            />
          </div>

          {result?.ok && (
            <div role="status" aria-live="polite" className="rounded-lg bg-emerald-50 p-3 text-sm text-emerald-800 dark:bg-emerald-950/30 dark:text-emerald-200">
              <p className="font-medium">Account permanently deleted.</p>
              <p className="text-xs text-emerald-700 dark:text-emerald-300">
                Audit row preserved. Attempts and results removed.
              </p>
            </div>
          )}
          {result && !result.ok && (
            <div role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-800 dark:bg-red-950/30 dark:text-red-200">
              <p className="font-medium">Deletion failed.</p>
              <p className="text-xs">{result.error}</p>
            </div>
          )}
        </div>

        <AlertDialogFooter className="flex-col gap-2 sm:flex-row">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={pending}
            aria-label="Cancel deletion"
          >
            Cancel
          </Button>
          <Button
            variant="destructive"
            onClick={handleConfirm}
            disabled={!canConfirm || pending}
            aria-disabled={!canConfirm || pending}
            aria-busy={pending}
          >
            {pending ? "Deleting…" : "Confirm permanent delete"}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
