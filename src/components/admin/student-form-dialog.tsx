"use client";

import { ArrowRightLeft, RefreshCcw, UserRoundPlus } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState, useTransition } from "react";
import { getUserDetailAction, upsertUserAction } from "@/app/actions/admin";
import { getAdminFormOptionsAction } from "@/app/actions/admin-parity";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  NativeSelect,
  NativeSelectOption,
} from "@/components/ui/native-select";
import { toast } from "@/components/ui/toast";

interface ClassOption {
  id: string;
  name: string;
}

// Preview-only mirror of the canonical server alphabet in
// src/lib/auth/student.ts (STUDENT_ID_ALPHABET). That module is server-only
// (node:crypto + service-role Supabase) and must never be imported from this
// client component. Keep this string byte-identical to the server copy so the
// Regenerate preview matches server-issued FST-XXXXX values.
const STUDENT_ID_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
// Mirror of STUDENT_ID_CONFLICT_ERROR for routing the uniqueness failure to
// the per-field Student ID slot. Kept as a literal for the same reason.
const STUDENT_ID_CONFLICT_ERROR = "Student ID is already in use.";

function randomStudentNumber(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(5));
  let suffix = "";
  for (const byte of bytes)
    suffix += STUDENT_ID_ALPHABET[byte % STUDENT_ID_ALPHABET.length];
  return `FST-${suffix}`;
}

function splitFullName(value: string): { firstName: string; lastName: string } {
  const parts = value.trim().replace(/\s+/g, " ").split(" ").filter(Boolean);
  if (parts.length < 2) return { firstName: parts[0] ?? "", lastName: "" };
  return { firstName: parts[0], lastName: parts.slice(1).join(" ") };
}

export function StudentFormDialog({
  open,
  onClose,
  userId,
}: {
  open: boolean;
  onClose: () => void;
  userId?: string;
}) {
  const router = useRouter();
  const [classes, setClasses] = useState<ClassOption[]>([]);
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [studentNumber, setStudentNumber] = useState("");
  const [classId, setClassId] = useState("");
  const [originalClassId, setOriginalClassId] = useState("");
  const [guardian, setGuardian] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [idError, setIdError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    if (!open) return;
    setError(null);
    setIdError(null);
    void getAdminFormOptionsAction()
      .then((options) => setClasses(options.classes))
      .catch(() => setError("Class options could not be loaded."));
    if (!userId) {
      setFirstName("");
      setLastName("");
      setStudentNumber("");
      setClassId("");
      setOriginalClassId("");
      setGuardian("");
      return;
    }
    void getUserDetailAction(userId)
      .then((detail) => {
        const user = detail.user as {
          full_name?: string;
          first_name?: string;
          last_name?: string;
          student_number?: string | null;
          class_id?: string | null;
          guardian?: string;
          role?: string;
        } | null;
        if (!user || user.role !== "student") {
          setError("Student record is unavailable.");
          return;
        }
        const split = splitFullName(user.full_name ?? "");
        setFirstName(user.first_name ?? split.firstName);
        setLastName(user.last_name ?? split.lastName);
        setStudentNumber(user.student_number ?? "");
        setClassId(user.class_id ?? "");
        setOriginalClassId(user.class_id ?? "");
        setGuardian(user.guardian ?? "");
      })
      .catch(() => setError("Student record could not be loaded."));
  }, [open, userId]);

  const className = useMemo(
    () => new Map(classes.map((item) => [item.id, item.name])),
    [classes],
  );
  const movingClass = Boolean(userId && originalClassId !== classId);
  const displayName = `${firstName.trim()} ${lastName.trim()}`.trim();
  // Per-field invalid state: a generic save error only marks the name field(s)
  // that actually fail the shared ≥2-character rule, so a valid first name is
  // never flagged because the last name (or another field) failed.
  const firstNameInvalid = Boolean(error) && firstName.trim().length < 2;
  const lastNameInvalid = Boolean(error) && lastName.trim().length < 2;

  function regenerate() {
    setIdError(null);
    setStudentNumber(randomStudentNumber());
  }

  function save() {
    setError(null);
    setIdError(null);
    startTransition(async () => {
      const result = await upsertUserAction({
        id: userId,
        firstName,
        lastName,
        studentNumber: studentNumber.trim() ? studentNumber.trim() : undefined,
        role: "student",
        classId,
        guardian,
      });
      if (!result.ok) {
        const message = result.error ?? "Student save failed.";
        if (message === STUDENT_ID_CONFLICT_ERROR) {
          setIdError(message);
        } else {
          setError(message);
        }
        toast.add({
          type: "error",
          title: "Student was not saved",
          description: message,
          priority: "high",
        });
        return;
      }
      const description = movingClass
        ? `${displayName} was moved to ${classId ? (className.get(classId) ?? "the selected class") : "unassigned"}.`
        : userId
          ? `${displayName} was updated.`
          : `${displayName} was added.`;
      toast.add({
        type: "success",
        title: movingClass
          ? "Student moved"
          : userId
            ? "Student updated"
            : "Student added",
        description,
      });
      onClose();
      router.refresh();
    });
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(value) => {
        if (!value && !pending) onClose();
      }}
    >
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <div className="mb-2 grid size-10 place-items-center rounded-xl bg-foreground text-background">
            {userId ? <ArrowRightLeft /> : <UserRoundPlus />}
          </div>
          <DialogTitle>{userId ? "Edit student" : "Add student"}</DialogTitle>
          <DialogDescription>
            {userId
              ? "A student has one current class. Changing the class below moves the student; examination, integrity and retake history remain attached to the durable student identity."
              : "Create the student identity and assign one current class. Examination history will accumulate against this identity."}
          </DialogDescription>
        </DialogHeader>

        <FieldGroup>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field data-invalid={firstNameInvalid}>
              <FieldLabel htmlFor="student-first-name">First name</FieldLabel>
              <Input
                id="student-first-name"
                autoComplete="given-name"
                value={firstName}
                onChange={(event) => setFirstName(event.target.value)}
                aria-invalid={firstNameInvalid}
              />
            </Field>
            <Field data-invalid={lastNameInvalid}>
              <FieldLabel htmlFor="student-last-name">Last name</FieldLabel>
              <Input
                id="student-last-name"
                autoComplete="family-name"
                value={lastName}
                onChange={(event) => setLastName(event.target.value)}
                aria-invalid={lastNameInvalid}
              />
            </Field>
          </div>
          <Field data-invalid={Boolean(idError)}>
            <FieldLabel htmlFor="student-number">Student ID</FieldLabel>
            <div className="flex gap-2">
              <Input
                id="student-number"
                className="font-mono uppercase"
                placeholder={
                  userId
                    ? "FST-XXXXX (unchanged when blank)"
                    : "Auto-assigned (FST-XXXXX)"
                }
                value={studentNumber}
                onChange={(event) => {
                  setStudentNumber(event.target.value.toUpperCase());
                  setIdError(null);
                }}
                aria-invalid={Boolean(idError)}
                maxLength={32}
              />
              <Button
                type="button"
                variant="outline"
                onClick={regenerate}
                disabled={pending}
                aria-label="Regenerate Student ID"
              >
                <RefreshCcw data-icon="inline-start" />
                Regenerate
              </Button>
            </div>
            <FieldDescription>
              {userId
                ? "Leave blank to keep the existing Student ID. Saving an explicit ID replaces it after a uniqueness check."
                : "Leave blank to auto-assign a fresh FST-XXXXX on save, or type an explicit ID."}
            </FieldDescription>
            {idError ? (
              <p className="text-sm text-destructive" role="alert">
                {idError}
              </p>
            ) : null}
          </Field>
          <Field>
            <FieldLabel htmlFor="student-class">Current class</FieldLabel>
            <NativeSelect
              id="student-class"
              value={classId}
              onChange={(event) => setClassId(event.target.value)}
            >
              <NativeSelectOption value="">Unassigned</NativeSelectOption>
              {classes.map((item) => (
                <NativeSelectOption key={item.id} value={item.id}>
                  {item.name}
                </NativeSelectOption>
              ))}
            </NativeSelect>
            <FieldDescription>
              Only one current class is active at a time. Historical class
              enrolments and examination attempts remain preserved after a move.
            </FieldDescription>
          </Field>
          {movingClass ? (
            <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950">
              <div className="flex items-start gap-3">
                <ArrowRightLeft className="mt-0.5 size-4 shrink-0" />
                <div>
                  <strong className="block">Move student to a new class</strong>
                  <p className="mt-1 text-xs leading-5 text-amber-800">
                    {originalClassId
                      ? (className.get(originalClassId) ?? originalClassId)
                      : "Unassigned"}{" "}
                    →{" "}
                    {classId
                      ? (className.get(classId) ?? classId)
                      : "Unassigned"}
                    . Existing attempt UUIDs, scores and integrity logs are not
                    reassigned or deleted.
                  </p>
                </div>
              </div>
            </div>
          ) : null}
          <Field>
            <FieldLabel htmlFor="student-guardian">
              Guardian / parent
            </FieldLabel>
            <Input
              id="student-guardian"
              value={guardian}
              onChange={(event) => setGuardian(event.target.value)}
              maxLength={80}
            />
          </Field>
        </FieldGroup>

        {error ? (
          <Alert variant="destructive">
            <AlertTitle>Student was not saved</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        ) : null}
        <DialogFooter>
          <Button variant="outline" disabled={pending} onClick={onClose}>
            Cancel
          </Button>
          <Button
            disabled={
              pending ||
              firstName.trim().length < 2 ||
              lastName.trim().length < 2
            }
            onClick={save}
          >
            {pending
              ? "Saving…"
              : movingClass
                ? "Move student"
                : userId
                  ? "Update student"
                  : "Add student"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
