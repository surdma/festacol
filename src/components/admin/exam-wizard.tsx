"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { BookOpenCheck, Camera, CheckCircle2, ShieldCheck } from "lucide-react";
import { createExamParityAction, getExamCoverageAction, getSubjectCatalogAction } from "@/app/actions/admin-parity";
import { getMyScopeAction, type ExamWizardInput } from "@/app/actions/admin";
import { adminPrimaryButtonClass, adminSecondaryButtonClass } from "@/components/admin/admin-ui";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { Progress } from "@/components/ui/progress";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";

const STEPS = ["Scope", "Coverage", "Paper", "Integrity", "Review"] as const;
const MODES = ["qualifier", "bece", "waec", "neco", "jamb", "mixed", "single"] as const;
const SINGLE_SUBJECT_MODES = new Set<ExamWizardInput["mode"]>(["single", "waec", "bece", "neco", "jamb"]);
const inputClass = "h-11 rounded-lg border-neutral-300 bg-white text-neutral-950 focus-visible:border-black focus-visible:ring-black/20";
const selectClass = "w-full [&>select]:h-11 [&>select]:rounded-lg [&>select]:border-neutral-300 [&>select]:bg-white [&>select]:text-neutral-950 [&>select]:focus-visible:border-black [&>select]:focus-visible:ring-black/20";
const modeLabels: Record<ExamWizardInput["mode"], string> = { qualifier: "SS1 stream qualifier", bece: "BECE practice", waec: "WAEC practice", neco: "NECO practice", jamb: "JAMB practice", mixed: "Mixed-subject exam", single: "Single-subject exam" };

export function ExamWizard({ open, onClose }: { open: boolean; onClose: () => void }) {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [subjects, setSubjects] = useState<{ code: string; name: string }[]>([]);
  const [scope, setScope] = useState<{ isAdmin: boolean; subjects: string[]; qualifierAccess: boolean } | null>(null);
  const [coverage, setCoverage] = useState<{ count: number; ok: boolean; error?: string } | null>(null);
  const [form, setForm] = useState<ExamWizardInput>({ title: "", classLevel: "SS1", classGroup: "General", mode: "single", subjects: [], durationSeconds: 3600, questionCount: 50, status: "draft", instructions: "", cameraRequired: false, warnAfter: 2 });
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    if (!open) return;
    setStep(0); setCoverage(null); setError(null);
    void Promise.all([getSubjectCatalogAction(), getMyScopeAction()]).then(([catalog, nextScope]) => { setSubjects(catalog); setScope(nextScope); }).catch(() => setError("Exam setup data could not be loaded."));
  }, [open]);

  const availableModes = useMemo(() => !scope || scope.isAdmin || scope.qualifierAccess ? [...MODES] : MODES.filter((mode) => mode !== "qualifier"), [scope]);
  const availableSubjects = useMemo(() => {
    if (form.mode === "qualifier") return subjects.filter((subject) => subject.code.startsWith("q-"));
    if (scope && !scope.isAdmin) return subjects.filter((subject) => scope.subjects.includes(subject.code));
    return subjects;
  }, [form.mode, scope, subjects]);

  function set<K extends keyof ExamWizardInput>(key: K, value: ExamWizardInput[K]) { setForm((current) => ({ ...current, [key]: value })); setCoverage(null); setError(null); }
  function chooseMode(value: ExamWizardInput["mode"]) { setForm((current) => ({ ...current, mode: value, classLevel: value === "qualifier" ? "SS1" : value === "waec" ? "SS3" : current.classLevel, subjects: [] })); setCoverage(null); setError(null); }
  function toggleSubject(code: string) {
    if (SINGLE_SUBJECT_MODES.has(form.mode)) { set("subjects", form.subjects[0] === code ? [] : [code]); return; }
    set("subjects", form.subjects.includes(code) ? form.subjects.filter((subject) => subject !== code) : [...form.subjects, code]);
  }

  function validateStep(current: number): string | null {
    if (current === 0) {
      if (form.title.trim().length < 3) return "Enter an exam title of at least 3 characters.";
      if (form.mode === "qualifier" && form.classLevel !== "SS1") return "Qualifier examinations are reserved for SS1.";
      if (form.mode === "waec" && form.classLevel !== "SS3") return "WAEC examinations are configured for SS3.";
    }
    if (current === 1) {
      if (SINGLE_SUBJECT_MODES.has(form.mode) && form.subjects.length !== 1) return "Choose exactly one subject for this examination mode.";
      if (form.mode === "mixed" && (form.subjects.length < 2 || form.subjects.length > 12)) return "Choose between 2 and 12 subjects for a mixed examination.";
    }
    if (current === 2) {
      if (!Number.isInteger(form.durationSeconds) || form.durationSeconds < 30 || form.durationSeconds > 10800) return "Duration must be between 30 seconds and 3 hours.";
      if (!Number.isInteger(form.questionCount) || form.questionCount < 5 || form.questionCount > 150) return "Question count must be between 5 and 150.";
    }
    if (current === 3 && (!Number.isInteger(form.warnAfter) || form.warnAfter < 1 || form.warnAfter > 10)) return "Integrity warning threshold must be between 1 and 10.";
    return null;
  }

  async function next() {
    const validation = validateStep(step);
    if (validation) { setError(validation); return; }
    setError(null);
    if (step === 3) {
      const result = await getExamCoverageAction(form); setCoverage(result);
      if (!result.ok) { setError(result.error ?? "Question coverage is not ready."); return; }
    }
    setStep((current) => Math.min(STEPS.length - 1, current + 1));
  }

  function create() {
    setError(null);
    startTransition(async () => {
      const result = await createExamParityAction(form);
      if (!result.ok || !result.id) { setError(result.error ?? "Create failed."); return; }
      onClose(); router.push(`/admin/exams?modal=exam&exam=${encodeURIComponent(result.id)}`); router.refresh();
    });
  }

  return (
    <Dialog open={open} onOpenChange={(value) => { if (!value) onClose(); }}>
      <DialogContent className="max-h-[calc(100dvh-2rem)] max-w-4xl overflow-y-auto rounded-2xl border-neutral-200 bg-white shadow-2xl">
        <DialogHeader><p className="text-[10px] font-bold uppercase tracking-[.14em] text-neutral-500">Create examination</p><DialogTitle className="font-display text-xl font-extrabold text-neutral-950">{STEPS[step]}</DialogTitle><DialogDescription>Step {step + 1} of {STEPS.length}. The paper is validated against the live production question bank before it can be created.</DialogDescription></DialogHeader>
        <Progress value={((step + 1) / STEPS.length) * 100} className="h-1.5" />

        {step === 0 ? <FieldGroup><Field><FieldLabel htmlFor="w-title">Exam title</FieldLabel><Input id="w-title" className={inputClass} value={form.title} onChange={(event) => set("title", event.target.value)} maxLength={72} placeholder="SS2 Mathematics First Term" /></Field><div className="grid gap-3 sm:grid-cols-3"><Field><FieldLabel htmlFor="w-level">Class level</FieldLabel><NativeSelect id="w-level" className={selectClass} value={form.classLevel} disabled={form.mode === "qualifier" || form.mode === "waec"} onChange={(event) => set("classLevel", event.target.value as ExamWizardInput["classLevel"])}>{(["SS1", "SS2", "SS3"] as const).map((level) => <NativeSelectOption key={level} value={level}>{level}</NativeSelectOption>)}</NativeSelect></Field><Field><FieldLabel htmlFor="w-group">Class group</FieldLabel><Input id="w-group" className={inputClass} value={form.classGroup} onChange={(event) => set("classGroup", event.target.value)} maxLength={40} /></Field><Field><FieldLabel htmlFor="w-mode">Exam mode</FieldLabel><NativeSelect id="w-mode" className={selectClass} value={form.mode} onChange={(event) => chooseMode(event.target.value as ExamWizardInput["mode"])}>{availableModes.map((mode) => <NativeSelectOption key={mode} value={mode}>{modeLabels[mode]}</NativeSelectOption>)}</NativeSelect></Field></div></FieldGroup> : null}

        {step === 1 ? <FieldGroup><Field><FieldLabel>{form.mode === "qualifier" ? "Qualifier domains (optional)" : `Subjects (${form.subjects.length} selected)`}</FieldLabel><div className="flex max-h-64 flex-wrap gap-2 overflow-auto rounded-xl border border-neutral-200 bg-neutral-50 p-3">{availableSubjects.map((subject) => <Button key={subject.code} type="button" size="sm" variant={form.subjects.includes(subject.code) ? "default" : "outline"} className="rounded-lg" onClick={() => toggleSubject(subject.code)}>{subject.name}</Button>)}{!availableSubjects.length ? <p className="text-sm text-neutral-500">No subjects are available for this mode and staff scope.</p> : null}</div><p className="mt-2 text-xs text-neutral-500">{form.mode === "mixed" ? "Mixed papers require 2–12 subjects." : SINGLE_SUBJECT_MODES.has(form.mode) ? "This mode uses exactly one subject." : "Leaving qualifier domains empty allows the eligible qualifier pool."}</p></Field></FieldGroup> : null}

        {step === 2 ? <FieldGroup><div className="grid gap-3 sm:grid-cols-2"><Field><FieldLabel htmlFor="w-dur">Duration (seconds)</FieldLabel><Input id="w-dur" className={inputClass} type="number" min={30} max={10800} step={30} value={form.durationSeconds} onChange={(event) => set("durationSeconds", Number(event.target.value))} /></Field><Field><FieldLabel htmlFor="w-count">Question count</FieldLabel><Input id="w-count" className={inputClass} type="number" min={5} max={150} value={form.questionCount} onChange={(event) => set("questionCount", Number(event.target.value))} /></Field></div><Field><FieldLabel htmlFor="w-inst">Candidate instructions</FieldLabel><Textarea id="w-inst" className="min-h-28 rounded-lg border-neutral-300" value={form.instructions} onChange={(event) => set("instructions", event.target.value)} maxLength={140} placeholder="Read every question carefully before submitting." /></Field><Field><FieldLabel htmlFor="w-status">Initial status</FieldLabel><NativeSelect id="w-status" className={selectClass} value={form.status} onChange={(event) => set("status", event.target.value as ExamWizardInput["status"])}>{(["draft", "open", "closed"] as const).map((status) => <NativeSelectOption key={status} value={status}>{status}</NativeSelectOption>)}</NativeSelect></Field></FieldGroup> : null}

        {step === 3 ? <FieldGroup><div className="rounded-xl border border-neutral-200 bg-neutral-50 p-4"><div className="flex items-center justify-between gap-4"><div className="flex gap-3"><span className="grid size-9 place-items-center rounded-lg bg-white"><Camera className="size-4" /></span><div><FieldLabel htmlFor="w-cam">Camera monitoring</FieldLabel><p className="mt-1 text-xs text-neutral-500">Require candidate camera permission for this session.</p></div></div><Switch id="w-cam" checked={form.cameraRequired} onCheckedChange={(value) => set("cameraRequired", value)} /></div></div><Field><FieldLabel htmlFor="w-warn">Warn after serious integrity events</FieldLabel><Input id="w-warn" className={inputClass} type="number" min={1} max={10} value={form.warnAfter} onChange={(event) => set("warnAfter", Number(event.target.value))} /></Field></FieldGroup> : null}

        {step === 4 ? <div className="grid gap-4 sm:grid-cols-3"><div className="rounded-xl border border-neutral-200 bg-neutral-50 p-4"><BookOpenCheck className="size-5" /><p className="mt-3 text-xs font-medium text-neutral-500">Paper</p><strong className="mt-1 block text-sm">{form.questionCount} questions · {Math.round(form.durationSeconds / 60)} min</strong><p className="mt-1 text-xs text-neutral-500">{form.subjects.length ? form.subjects.join(", ") : "Qualifier pool"}</p></div><div className="rounded-xl border border-neutral-200 bg-neutral-50 p-4"><ShieldCheck className="size-5" /><p className="mt-3 text-xs font-medium text-neutral-500">Integrity</p><strong className="mt-1 block text-sm">Warn after {form.warnAfter}</strong><p className="mt-1 text-xs text-neutral-500">Camera {form.cameraRequired ? "required" : "optional"}</p></div><div className="rounded-xl border border-neutral-200 bg-neutral-50 p-4"><CheckCircle2 className="size-5" /><p className="mt-3 text-xs font-medium text-neutral-500">Question coverage</p><strong className="mt-1 block text-sm">{coverage?.count ?? 0} eligible</strong><p className="mt-1 text-xs text-neutral-500">Validated against the current bank</p></div><div className="rounded-xl border border-neutral-200 p-4 sm:col-span-3"><p className="text-xs font-medium text-neutral-500">Review</p><strong className="mt-1 block text-base">{form.title}</strong><p className="mt-1 text-sm text-neutral-500">{form.classLevel} · {form.classGroup} · {modeLabels[form.mode]} · {form.status}</p></div></div> : null}

        {error ? <p className="text-sm text-destructive" role="alert">{error}</p> : null}
        <DialogFooter><Button variant="outline" className={adminSecondaryButtonClass} disabled={step === 0 || pending} onClick={() => { setError(null); setStep((current) => Math.max(0, current - 1)); }}>Back</Button>{step < STEPS.length - 1 ? <Button className={adminPrimaryButtonClass} disabled={pending} onClick={() => void next()}>Next</Button> : <Button className={adminPrimaryButtonClass} disabled={pending || !coverage?.ok} onClick={create}>{pending ? "Creating…" : "Create exam"}</Button>}</DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
