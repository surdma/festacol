"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { Switch } from "@/components/ui/switch";
import { Progress } from "@/components/ui/progress";
import { createExamAction, getMyScopeAction, getSubjectsAction, type ExamWizardInput } from "@/app/actions/admin";

const STEPS = ["Scope", "Coverage", "Paper", "Integrity", "Review"] as const;
const MODES = ["qualifier", "mixed", "single", "waec"] as const;

export function ExamWizard({ open, onClose }: { open: boolean; onClose: () => void }) {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [subjects, setSubjects] = useState<string[]>([]);
  const [scope, setScope] = useState<{ isAdmin: boolean; subjects: string[]; qualifierAccess: boolean } | null>(null);
  const [form, setForm] = useState<ExamWizardInput>({
    title: "", classLevel: "SS1", classGroup: "General", mode: "single", subjects: [],
    durationSeconds: 3600, questionCount: 50, status: "draft", instructions: "",
    cameraRequired: false, warnAfter: 2,
  });
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    if (open) {
      void getSubjectsAction().then(setSubjects).catch(() => undefined);
      void getMyScopeAction().then(setScope).catch(() => undefined);
    }
  }, [open ]);

  const availableSubjects = scope && !scope.isAdmin ? scope.subjects : subjects.length ? subjects : ["q-eng", "q-math", "q-bst", "q-social", "q-business", "q-digital"];
  const availableModes = scope && !scope.isAdmin && !scope.qualifierAccess ? MODES.filter((m) => m !== "qualifier") : [...MODES];

  function set<K extends keyof ExamWizardInput>(key: K, value: ExamWizardInput[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  function create() {
    setError(null);
    if (form.title.trim().length < 3) { setError("Enter an exam title."); setStep(0); return; }
    startTransition(async () => {
      const result = await createExamAction(form);
      if (!result.ok || !result.id) { setError(result.error ?? "Create failed."); return; }
      onClose();
      router.push(`/admin/exams?modal=exam&exam=${result.id}`);
      router.refresh();
    });
  }

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent className="max-w-4xl">
        <DialogHeader>
          <DialogTitle>Create examination — {STEPS[step]}</DialogTitle>
          <DialogDescription>Step {step + 1} of {STEPS.length}</DialogDescription>
        </DialogHeader>
        <Progress value={((step + 1) / STEPS.length) * 100} />
        {step === 0 && (
          <FieldGroup>
            <Field><FieldLabel htmlFor="w-title">Title</FieldLabel><Input id="w-title" value={form.title} onChange={(e) => set("title", e.target.value)} maxLength={72} /></Field>
            <div className="grid grid-cols-3 gap-3">
              <Field><FieldLabel htmlFor="w-level">Level</FieldLabel>
                <NativeSelect id="w-level" value={form.classLevel} onChange={(e) => set("classLevel", e.target.value as ExamWizardInput["classLevel"])}>
                  {(["SS1", "SS2", "SS3"] as const).map((l) => <NativeSelectOption key={l} value={l}>{l}</NativeSelectOption>)}
                </NativeSelect></Field>
              <Field><FieldLabel htmlFor="w-group">Group</FieldLabel><Input id="w-group" value={form.classGroup} onChange={(e) => set("classGroup", e.target.value)} /></Field>
              <Field><FieldLabel htmlFor="w-mode">Mode</FieldLabel>
                <NativeSelect id="w-mode" value={form.mode} onChange={(e) => set("mode", e.target.value as ExamWizardInput["mode"])}>
                  {availableModes.map((m) => <NativeSelectOption key={m} value={m}>{m}</NativeSelectOption>)}
                </NativeSelect></Field>
            </div>
          </FieldGroup>
        )}
        {step === 1 && (
          <FieldGroup>
            <Field>
              <FieldLabel>Subjects ({form.subjects.length} selected)</FieldLabel>
              <div className="flex max-h-56 flex-wrap gap-2 overflow-auto">
                {availableSubjects.map((s) => {
                  const on = form.subjects.includes(s);
                  return (
                    <Button key={s} type="button" size="sm" variant={on ? "default" : "outline"}
                      onClick={() => set("subjects", on ? form.subjects.filter((x) => x !== s) : [...form.subjects, s])}>{s}</Button>
                  );
                })}
              </div>
            </Field>
          </FieldGroup>
        )}
        {step === 2 && (
          <FieldGroup>
            <div className="grid grid-cols-2 gap-3">
              <Field><FieldLabel htmlFor="w-dur">Duration (seconds, 30–10800)</FieldLabel>
                <Input id="w-dur" type="number" min={30} max={10800} step={30} value={form.durationSeconds} onChange={(e) => set("durationSeconds", Number(e.target.value))} /></Field>
              <Field><FieldLabel htmlFor="w-count">Questions (5–150)</FieldLabel>
                <Input id="w-count" type="number" min={5} max={150} value={form.questionCount} onChange={(e) => set("questionCount", Number(e.target.value))} /></Field>
            </div>
            <Field><FieldLabel htmlFor="w-inst">Instructions (140)</FieldLabel><Input id="w-inst" value={form.instructions} onChange={(e) => set("instructions", e.target.value)} maxLength={140} /></Field>
            <Field><FieldLabel htmlFor="w-status">Status</FieldLabel>
              <NativeSelect id="w-status" value={form.status} onChange={(e) => set("status", e.target.value as ExamWizardInput["status"])}>
                {(["draft", "open", "closed"] as const).map((s) => <NativeSelectOption key={s} value={s}>{s}</NativeSelectOption>)}
              </NativeSelect></Field>
          </FieldGroup>
        )}
        {step === 3 && (
          <FieldGroup>
            <Field>
              <div className="flex items-center justify-between gap-3">
                <FieldLabel htmlFor="w-cam">Camera monitoring required</FieldLabel>
                <Switch id="w-cam" checked={form.cameraRequired} onCheckedChange={(v) => set("cameraRequired", v)} />
              </div>
            </Field>
            <Field><FieldLabel htmlFor="w-warn">Warn after N serious events (1–10)</FieldLabel>
              <Input id="w-warn" type="number" min={1} max={10} value={form.warnAfter} onChange={(e) => set("warnAfter", Number(e.target.value))} /></Field>
          </FieldGroup>
        )}
        {step === 4 && (
          <div className="text-sm">
            <p className="font-medium">{form.title || "(untitled)"} · {form.classLevel} · {form.mode} · {form.status}</p>
            <p className="text-muted-foreground">{form.questionCount} questions · {Math.round(form.durationSeconds / 60)} min · {form.subjects.join(", ") || "all subjects"}</p>
          </div>
        )}
        {error ? <p className="text-sm text-destructive" role="alert">{error}</p> : null}
        <DialogFooter>
          <Button variant="outline" disabled={step === 0} onClick={() => setStep(step - 1)}>Back</Button>
          {step < STEPS.length - 1
            ? <Button onClick={() => setStep(step + 1)}>Next</Button>
            : <Button onClick={create} disabled={pending}>{pending ? "Creating…" : "Create exam"}</Button>}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
