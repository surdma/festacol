"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { BookOpenCheck, Camera, CheckCircle2, ShieldCheck } from "lucide-react";
import { createExamParityAction, getAdminFormOptionsAction, getExamCoverageAction, type OfferingOption, type SubjectOption } from "@/app/actions/admin-parity";
import type { ExamWizardInput } from "@/app/actions/admin";
import { adminPrimaryButtonClass, adminSecondaryButtonClass } from "@/components/admin/admin-ui";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { Progress } from "@/components/ui/progress";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import type { AcademicTrack } from "@/types/db";

const STEPS = ["Scope", "Audience", "Paper", "Integrity", "Review"] as const;
const MODES = ["qualifier", "bece", "waec", "neco", "jamb", "mixed", "single"] as const;
const SINGLE_SUBJECT_MODES = new Set<ExamWizardInput["mode"]>(["single", "waec", "bece", "neco", "jamb"]);
const inputClass = "h-11 rounded-lg border-neutral-300 bg-white text-neutral-950 focus-visible:border-black focus-visible:ring-black/20";
const selectClass = "w-full [&>select]:h-11 [&>select]:rounded-lg [&>select]:border-neutral-300 [&>select]:bg-white [&>select]:text-neutral-950 [&>select]:focus-visible:border-black [&>select]:focus-visible:ring-black/20";
const modeLabels: Record<ExamWizardInput["mode"], string> = {
  qualifier: "SS1 placement / qualifier",
  bece: "BECE practice",
  waec: "WAEC practice",
  neco: "NECO practice",
  jamb: "JAMB practice",
  mixed: "Mixed-subject exam",
  single: "Single-subject exam",
};

type ClassOption = { id: string; name: string; class_level: string; track: AcademicTrack; track_name: string; status: string };
type ScopeOption = { isAdmin: boolean; subjectIds: string[]; qualifierAccess: boolean };

const initialForm: ExamWizardInput = {
  title: "",
  classLevel: "SS1",
  mode: "single",
  subjectIds: [],
  offeringIds: [],
  classIds: [],
  durationSeconds: 3600,
  questionCount: 50,
  status: "draft",
  instructions: "",
  cameraRequired: false,
  warnAfter: 2,
};

export function ExamWizard({ open, onClose }: { open: boolean; onClose: () => void }) {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [subjects, setSubjects] = useState<SubjectOption[]>([]);
  const [offerings, setOfferings] = useState<OfferingOption[]>([]);
  const [classes, setClasses] = useState<ClassOption[]>([]);
  const [scope, setScope] = useState<ScopeOption | null>(null);
  const [coverage, setCoverage] = useState<{ count: number; ok: boolean; error?: string } | null>(null);
  const [form, setForm] = useState<ExamWizardInput>(initialForm);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    if (!open) return;
    setStep(0);
    setCoverage(null);
    setError(null);
    setForm(initialForm);
    void getAdminFormOptionsAction().then((options) => {
      setSubjects(options.subjects);
      setOfferings(options.offerings);
      setClasses(options.classes);
      setScope({ isAdmin: options.scope.isAdmin, subjectIds: options.scope.subjectIds, qualifierAccess: options.scope.qualifierAccess });
    }).catch(() => setError("Exam setup data could not be loaded."));
  }, [open]);

  const availableModes = useMemo(
    () => !scope || scope.isAdmin || scope.qualifierAccess ? [...MODES] : MODES.filter((mode) => mode !== "qualifier"),
    [scope],
  );
  const availableSubjects = useMemo(() => {
    if (!scope || scope.isAdmin) return subjects;
    return subjects.filter((subject) => scope.subjectIds.includes(subject.id));
  }, [scope, subjects]);
  const availableOfferings = useMemo(() => offerings.filter((offering) =>
    offering.status === "active"
      && offering.classLevel === form.classLevel
      && form.subjectIds.includes(offering.subjectId),
  ), [form.classLevel, form.subjectIds, offerings]);
  const availableClasses = useMemo(() => classes.filter((item) => item.class_level === form.classLevel), [classes, form.classLevel]);
  const selectedSubjectNames = useMemo(() => form.subjectIds.map((id) => subjects.find((subject) => subject.id === id)?.name ?? "Subject"), [form.subjectIds, subjects]);
  const selectedOfferingLabels = useMemo(() => form.offeringIds.map((id) => {
    const offering = offerings.find((item) => item.id === id);
    return offering ? `${offering.subjectName} · ${offering.className} · ${offering.trackName}` : "Offering";
  }), [form.offeringIds, offerings]);

  function set<K extends keyof ExamWizardInput>(key: K, value: ExamWizardInput[K]) {
    setForm((current) => ({ ...current, [key]: value }));
    setCoverage(null);
    setError(null);
  }

  function chooseLevel(level: ExamWizardInput["classLevel"]) {
    setForm((current) => ({ ...current, classLevel: level, offeringIds: [], classIds: [] }));
    setCoverage(null);
    setError(null);
  }

  function chooseMode(value: ExamWizardInput["mode"]) {
    setForm((current) => ({
      ...current,
      mode: value,
      classLevel: value === "qualifier" ? "SS1" : value === "waec" ? "SS3" : current.classLevel,
      subjectIds: [],
      offeringIds: [],
      classIds: [],
    }));
    setCoverage(null);
    setError(null);
  }

  function toggleSubject(subjectId: string) {
    setForm((current) => {
      const nextSubjectIds = SINGLE_SUBJECT_MODES.has(current.mode)
        ? current.subjectIds[0] === subjectId ? [] : [subjectId]
        : current.subjectIds.includes(subjectId)
          ? current.subjectIds.filter((id) => id !== subjectId)
          : [...current.subjectIds, subjectId];
      const nextOfferingIds = current.offeringIds.filter((id) => {
        const offering = offerings.find((item) => item.id === id);
        return Boolean(offering && nextSubjectIds.includes(offering.subjectId));
      });
      const nextClassIds = [...new Set(nextOfferingIds.map((id) => offerings.find((item) => item.id === id)?.classId).filter((id): id is string => Boolean(id)))];
      return { ...current, subjectIds: nextSubjectIds, offeringIds: nextOfferingIds, classIds: nextClassIds };
    });
    setCoverage(null);
    setError(null);
  }

  function toggleOffering(offeringId: string) {
    setForm((current) => {
      const nextOfferingIds = current.offeringIds.includes(offeringId)
        ? current.offeringIds.filter((id) => id !== offeringId)
        : [...current.offeringIds, offeringId];
      const nextClassIds = [...new Set(nextOfferingIds.map((id) => offerings.find((item) => item.id === id)?.classId).filter((id): id is string => Boolean(id)))];
      return { ...current, offeringIds: nextOfferingIds, classIds: nextClassIds };
    });
    setCoverage(null);
    setError(null);
  }

  function toggleGeneralClass(classId: string) {
    set("classIds", form.classIds.includes(classId) ? form.classIds.filter((id) => id !== classId) : [...form.classIds, classId]);
  }

  function validateStep(current: number): string | null {
    if (current === 0) {
      if (form.title.trim().length < 3) return "Enter an exam title of at least 3 characters.";
      if (form.mode === "qualifier" && form.classLevel !== "SS1") return "Qualifier examinations are reserved for SS1.";
      if (form.mode === "waec" && form.classLevel !== "SS3") return "WAEC examinations are configured for SS3.";
    }
    if (current === 1) {
      if (SINGLE_SUBJECT_MODES.has(form.mode) && form.subjectIds.length !== 1) return "Choose exactly one subject for this examination mode.";
      if (form.mode === "mixed" && (form.subjectIds.length < 2 || form.subjectIds.length > 12)) return "Choose between 2 and 12 subjects for a mixed examination.";
      if (form.subjectIds.length) {
        if (!form.offeringIds.length) return "Choose the class subject offering(s) that may take this exam.";
        const represented = new Set(form.offeringIds.map((id) => offerings.find((item) => item.id === id)?.subjectId).filter(Boolean));
        if (form.subjectIds.some((id) => !represented.has(id))) return "Every selected subject needs at least one target offering.";
      } else if (!form.classIds.length) {
        return "Choose at least one target class for this general examination.";
      }
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
      const result = await getExamCoverageAction(form);
      setCoverage(result);
      if (!result.ok) { setError(result.error ?? "Question coverage is not ready."); return; }
    }
    setStep((current) => Math.min(STEPS.length - 1, current + 1));
  }

  function create() {
    setError(null);
    startTransition(async () => {
      const result = await createExamParityAction(form);
      if (!result.ok || !result.id) { setError(result.error ?? "Create failed."); return; }
      onClose();
      router.push(`/admin/exams?modal=exam&exam=${encodeURIComponent(result.id)}`);
      router.refresh();
    });
  }

  return (
    <Dialog open={open} onOpenChange={(value) => { if (!value) onClose(); }}>
      <DialogContent className="max-h-[calc(100dvh-2rem)] sm:max-w-4xl overflow-y-auto rounded-2xl border-neutral-200 bg-white shadow-2xl">
        <DialogHeader>
          <p className="text-[10px] font-bold uppercase tracking-[.14em] text-neutral-500">Create examination</p>
          <DialogTitle className="font-display text-xl font-extrabold text-neutral-950">{STEPS[step]}</DialogTitle>
          <DialogDescription>Step {step + 1} of {STEPS.length}. Audience eligibility comes from explicit class-subject offerings and canonical class tracks.</DialogDescription>
        </DialogHeader>
        <Progress value={((step + 1) / STEPS.length) * 100} className="h-1.5" />

        {step === 0 ? (
          <FieldGroup>
            <Field><FieldLabel htmlFor="w-title">Exam title</FieldLabel><Input id="w-title" className={inputClass} value={form.title} onChange={(event) => set("title", event.target.value)} maxLength={72} placeholder="SS1 Mathematics First Term" /></Field>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field><FieldLabel htmlFor="w-level">Academic level</FieldLabel><NativeSelect id="w-level" className={selectClass} value={form.classLevel} disabled={form.mode === "qualifier" || form.mode === "waec"} onChange={(event) => chooseLevel(event.target.value as ExamWizardInput["classLevel"])}>{(["SS1", "SS2", "SS3"] as const).map((level) => <NativeSelectOption key={level} value={level}>{level}</NativeSelectOption>)}</NativeSelect></Field>
              <Field><FieldLabel htmlFor="w-mode">Exam mode</FieldLabel><NativeSelect id="w-mode" className={selectClass} value={form.mode} onChange={(event) => chooseMode(event.target.value as ExamWizardInput["mode"])}>{availableModes.map((mode) => <NativeSelectOption key={mode} value={mode}>{modeLabels[mode]}</NativeSelectOption>)}</NativeSelect></Field>
            </div>
          </FieldGroup>
        ) : null}

        {step === 1 ? (
          <FieldGroup>
            <Field>
              <FieldLabel>{`Subjects (${form.subjectIds.length} selected)`}</FieldLabel>
              <div className="flex max-h-52 flex-wrap gap-2 overflow-auto rounded-xl border border-neutral-200 bg-neutral-50 p-3">
                {availableSubjects.map((subject) => <Button key={subject.id} type="button" size="sm" variant={form.subjectIds.includes(subject.id) ? "default" : "outline"} className="rounded-lg" onClick={() => toggleSubject(subject.id)}>{subject.name}</Button>)}
                {!availableSubjects.length ? <p className="text-sm text-neutral-500">No qualified subjects are available for this staff account.</p> : null}
              </div>
              {form.mode === "qualifier" ? <p className="mt-2 text-xs text-neutral-500">A qualifier may be subjectless; in that case choose target classes below. Subject examinations always require explicit offerings.</p> : null}
            </Field>

            {form.subjectIds.length ? (
              <Field>
                <FieldLabel>{`Class subject offerings (${form.offeringIds.length} selected)`}</FieldLabel>
                <div className="grid max-h-72 gap-2 overflow-auto rounded-xl border border-neutral-200 bg-neutral-50 p-3 sm:grid-cols-2">
                  {availableOfferings.map((offering) => {
                    const active = form.offeringIds.includes(offering.id);
                    return <Button key={offering.id} type="button" variant={active ? "default" : "outline"} className="h-auto justify-start whitespace-normal rounded-lg px-3 py-2 text-left" onClick={() => toggleOffering(offering.id)}><span><strong className="block">{offering.subjectName} · {offering.className}</strong><span className="block text-xs opacity-70">{offering.trackName} · {offering.academicYear} · {offering.participation}</span></span></Button>;
                  })}
                  {!availableOfferings.length ? <p className="text-sm text-neutral-500">No active offerings match this level and selected subject. Configure the class subject offering first.</p> : null}
                </div>
              </Field>
            ) : (
              <Field>
                <FieldLabel>{`Target classes (${form.classIds.length} selected)`}</FieldLabel>
                <div className="flex max-h-52 flex-wrap gap-2 overflow-auto rounded-xl border border-neutral-200 bg-neutral-50 p-3">
                  {availableClasses.map((item) => <Button key={item.id} type="button" size="sm" variant={form.classIds.includes(item.id) ? "default" : "outline"} onClick={() => toggleGeneralClass(item.id)}>{item.name}</Button>)}
                </div>
              </Field>
            )}
          </FieldGroup>
        ) : null}

        {step === 2 ? <FieldGroup><div className="grid gap-3 sm:grid-cols-2"><Field><FieldLabel htmlFor="w-dur">Duration (seconds)</FieldLabel><Input id="w-dur" className={inputClass} type="number" min={30} max={10800} step={30} value={form.durationSeconds} onChange={(event) => set("durationSeconds", Number(event.target.value))} /></Field><Field><FieldLabel htmlFor="w-count">Question count</FieldLabel><Input id="w-count" className={inputClass} type="number" min={5} max={150} value={form.questionCount} onChange={(event) => set("questionCount", Number(event.target.value))} /></Field></div><Field><FieldLabel htmlFor="w-inst">Candidate instructions</FieldLabel><Textarea id="w-inst" className="min-h-28 rounded-lg border-neutral-300" value={form.instructions} onChange={(event) => set("instructions", event.target.value)} maxLength={140} placeholder="Read every question carefully before submitting." /></Field><Field><FieldLabel htmlFor="w-status">Initial status</FieldLabel><NativeSelect id="w-status" className={selectClass} value={form.status} onChange={(event) => set("status", event.target.value as ExamWizardInput["status"])}>{(["draft", "open", "closed"] as const).map((status) => <NativeSelectOption key={status} value={status}>{status}</NativeSelectOption>)}</NativeSelect></Field></FieldGroup> : null}

        {step === 3 ? <FieldGroup><div className="rounded-xl border border-neutral-200 bg-neutral-50 p-4"><div className="flex items-center justify-between gap-4"><div className="flex gap-3"><span className="grid size-9 place-items-center rounded-lg bg-white"><Camera className="size-4" /></span><div><FieldLabel htmlFor="w-cam">Camera monitoring</FieldLabel><p className="mt-1 text-xs text-neutral-500">Require candidate camera permission for this session.</p></div></div><Switch id="w-cam" checked={form.cameraRequired} onCheckedChange={(value) => set("cameraRequired", value)} /></div></div><Field><FieldLabel htmlFor="w-warn">Warn after serious integrity events</FieldLabel><Input id="w-warn" className={inputClass} type="number" min={1} max={10} value={form.warnAfter} onChange={(event) => set("warnAfter", Number(event.target.value))} /></Field></FieldGroup> : null}

        {step === 4 ? <div className="grid gap-4 sm:grid-cols-3"><div className="rounded-xl border border-neutral-200 bg-neutral-50 p-4"><BookOpenCheck className="size-5" /><p className="mt-3 text-xs font-medium text-neutral-500">Paper</p><strong className="mt-1 block text-sm">{form.questionCount} questions · {Math.round(form.durationSeconds / 60)} min</strong><p className="mt-1 text-xs text-neutral-500">{selectedSubjectNames.length ? selectedSubjectNames.join(", ") : "General qualifier pool"}</p></div><div className="rounded-xl border border-neutral-200 bg-neutral-50 p-4"><ShieldCheck className="size-5" /><p className="mt-3 text-xs font-medium text-neutral-500">Audience</p><strong className="mt-1 block text-sm">{form.subjectIds.length ? `${form.offeringIds.length} offering${form.offeringIds.length === 1 ? "" : "s"}` : `${form.classIds.length} class${form.classIds.length === 1 ? "" : "es"}`}</strong><p className="mt-1 text-xs text-neutral-500">{selectedOfferingLabels.slice(0, 3).join(" · ") || "Explicit class targets"}</p></div><div className="rounded-xl border border-neutral-200 bg-neutral-50 p-4"><CheckCircle2 className="size-5" /><p className="mt-3 text-xs font-medium text-neutral-500">Question coverage</p><strong className="mt-1 block text-sm">{coverage?.count ?? 0} eligible</strong><p className="mt-1 text-xs text-neutral-500">Validated against the canonical subject bank</p></div><div className="rounded-xl border border-neutral-200 p-4 sm:col-span-3"><p className="text-xs font-medium text-neutral-500">Review</p><strong className="mt-1 block text-base">{form.title}</strong><p className="mt-1 text-sm text-neutral-500">{form.classLevel} · {modeLabels[form.mode]} · {form.status}</p></div></div> : null}

        {error ? <p className="text-sm text-destructive" role="alert">{error}</p> : null}
        <DialogFooter><Button variant="outline" className={adminSecondaryButtonClass} disabled={step === 0 || pending} onClick={() => { setError(null); setStep((current) => Math.max(0, current - 1)); }}>Back</Button>{step < STEPS.length - 1 ? <Button className={adminPrimaryButtonClass} disabled={pending} onClick={() => void next()}>Next</Button> : <Button className={adminPrimaryButtonClass} disabled={pending || !coverage?.ok} onClick={create}>{pending ? "Creating…" : "Create exam"}</Button>}</DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
