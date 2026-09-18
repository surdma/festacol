"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { BookOpenCheck, Camera, CheckCircle2, GraduationCap, Search, ShieldCheck, Users } from "lucide-react";
import {
  createExamParityAction,
  getAdminFormOptionsAction,
  getExamCoverageAction,
  type CandidateOption,
  type ExamCreationInput,
  type OfferingOption,
  type SubjectOption,
} from "@/app/actions/admin-parity";
import { adminPrimaryButtonClass, adminSecondaryButtonClass } from "@/components/admin/admin-ui";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { InputGroup, InputGroupAddon, InputGroupInput } from "@/components/ui/input-group";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { Progress } from "@/components/ui/progress";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/components/ui/toast";
import type { AcademicTrack } from "@/types/db";

const STEPS = ["Setup", "Audience", "Paper", "Integrity", "Review"] as const;
const DURATION_MIN_SECONDS = 30;
const DURATION_MAX_SECONDS = 14400;
const QUESTION_MIN_COUNT = 5;
const QUESTION_MAX_COUNT = 200;
const MODES = ["qualifier", "bece", "waec", "neco", "jamb", "mixed", "single"] as const;
const SINGLE_SUBJECT_MODES = new Set<ExamCreationInput["mode"]>(["single", "waec", "bece", "neco", "jamb"]);
const inputClass = "h-11 rounded-lg border-neutral-300 bg-white text-neutral-950 focus-visible:border-black focus-visible:ring-black/20";
const selectClass = "w-full [&>select]:h-11 [&>select]:rounded-lg [&>select]:border-neutral-300 [&>select]:bg-white [&>select]:text-neutral-950 [&>select]:focus-visible:border-black [&>select]:focus-visible:ring-black/20";
const modeLabels: Record<ExamCreationInput["mode"], string> = {
  qualifier: "Incoming SS1 placement",
  bece: "BECE practice",
  waec: "WAEC practice",
  neco: "NECO practice",
  jamb: "JAMB practice",
  mixed: "Mixed-subject exam",
  single: "Single-subject exam",
};
const trackLabels: Record<AcademicTrack, string> = {
  science: "Science",
  humanities: "Humanities",
  business: "Business",
};

type ClassOption = { id: string; name: string; classLevel: string; track: AcademicTrack; trackName: string; status: string };
type ScopeOption = { isAdmin: boolean; subjectIds: string[] };

const initialForm: ExamCreationInput = {
  title: "",
  classLevel: "SS1",
  mode: "single",
  subjectIds: [],
  offeringIds: [],
  classIds: [],
  studentIds: [],
  placementTracks: ["science", "humanities", "business"],
  durationSeconds: 3600,
  questionCount: 50,
  status: "open",
  instructions: "",
  allowFillQuestions: false,
  cameraRequired: false,
  warnAfter: 2,
};

function candidateSearchText(candidate: CandidateOption) {
  return `${candidate.name} ${candidate.studentNumber ?? ""} ${candidate.className ?? "unassigned"}`.toLowerCase();
}

function formatDuration(seconds: number) {
  if (seconds < 60) return `${seconds} sec`;
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest ? `${hours} hr ${rest} min` : `${hours} hr`;
}

export function ExamWizard({ open, onClose }: { open: boolean; onClose: () => void }) {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [subjects, setSubjects] = useState<SubjectOption[]>([]);
  const [offerings, setOfferings] = useState<OfferingOption[]>([]);
  const [classes, setClasses] = useState<ClassOption[]>([]);
  const [candidates, setCandidates] = useState<CandidateOption[]>([]);
  const [scope, setScope] = useState<ScopeOption | null>(null);
  const [trackFilter, setTrackFilter] = useState<"all" | AcademicTrack>("all");
  const [candidateQuery, setCandidateQuery] = useState("");
  const [showEnrolledCandidates, setShowEnrolledCandidates] = useState(false);
  const [coverage, setCoverage] = useState<{ count: number; ok: boolean; error?: string } | null>(null);
  const [form, setForm] = useState<ExamCreationInput>(initialForm);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    if (!open) return;
    setStep(0);
    setCoverage(null);
    setError(null);
    setTrackFilter("all");
    setCandidateQuery("");
    setShowEnrolledCandidates(false);
    setForm(initialForm);
    void getAdminFormOptionsAction().then((options) => {
      setSubjects(options.subjects);
      setOfferings(options.offerings);
      setClasses(options.classes);
      setCandidates(options.candidates);
      setScope({ isAdmin: options.scope.isAdmin, subjectIds: options.scope.subjectIds });
    }).catch(() => {
      const message = "Exam setup data could not be loaded.";
      setError(message);
      toast.add({ type: "error", title: "Exam setup unavailable", description: message, priority: "high" });
    });
  }, [open]);

  const availableModes = useMemo(() => [...MODES], []);

  const activeClasses = useMemo(() => classes.filter((item) => {
    if (item.status !== "active" || item.classLevel !== form.classLevel) return false;
    if (trackFilter !== "all" && item.track !== trackFilter) return false;
    if (!scope || scope.isAdmin) return true;
    return offerings.some((offering) => offering.classId === item.id && offering.status === "active" && scope.subjectIds.includes(offering.subjectId));
  }), [classes, form.classLevel, offerings, scope, trackFilter]);

  const qualifierSubjects = useMemo(() => subjects.filter((subject) => subject.kind === "qualifier"), [subjects]);

  const normalSubjects = useMemo(() => {
    if (!form.classIds.length) return [];
    const allowedIds = new Set(offerings.filter((offering) =>
      offering.status === "active" && form.classIds.includes(offering.classId),
    ).map((offering) => offering.subjectId));
    return subjects.filter((subject) =>
      subject.kind === "curriculum"
      && allowedIds.has(subject.id)
      && (!scope || scope.isAdmin || scope.subjectIds.includes(subject.id)),
    );
  }, [form.classIds, offerings, scope, subjects]);

  const visibleCandidates = useMemo(() => {
    const query = candidateQuery.trim().toLowerCase();
    return candidates.filter((candidate) => {
      if (!showEnrolledCandidates && candidate.classId) return false;
      return !query || candidateSearchText(candidate).includes(query);
    });
  }, [candidateQuery, candidates, showEnrolledCandidates]);

  const selectedSubjectNames = useMemo(() => form.subjectIds.map((id) => subjects.find((subject) => subject.id === id)?.name ?? "Subject"), [form.subjectIds, subjects]);
  const selectedClassNames = useMemo(() => form.classIds.map((id) => classes.find((item) => item.id === id)?.name ?? "Class"), [classes, form.classIds]);
  const selectedCandidateNames = useMemo(() => form.studentIds.map((id) => candidates.find((item) => item.id === id)?.name ?? "Candidate"), [candidates, form.studentIds]);

  function set<K extends keyof ExamCreationInput>(key: K, value: ExamCreationInput[K]) {
    setForm((current) => ({ ...current, [key]: value }));
    setCoverage(null);
    setError(null);
  }

  function chooseLevel(level: ExamCreationInput["classLevel"]) {
    setForm((current) => ({ ...current, classLevel: level, subjectIds: [], offeringIds: [], classIds: [] }));
    setTrackFilter("all");
    setCoverage(null);
    setError(null);
  }

  function chooseMode(value: ExamCreationInput["mode"]) {
    const qualifierPreset = subjects.filter((subject) => subject.kind === "qualifier" && ["q-math", "q-bst"].includes(subject.code)).map((subject) => subject.id);
    setForm((current) => ({
      ...current,
      title: value === "qualifier" && !current.title.trim() ? "Incoming SS1 Placement Assessment" : current.title,
      mode: value,
      classLevel: value === "qualifier" ? "SS1" : value === "waec" ? "SS3" : current.classLevel,
      subjectIds: value === "qualifier" ? qualifierPreset : [],
      offeringIds: [],
      classIds: [],
      studentIds: [],
      placementTracks: ["science", "humanities", "business"],
      durationSeconds: value === "qualifier" ? 1800 : current.durationSeconds,
      questionCount: value === "qualifier" ? 20 : current.questionCount,
    }));
    setTrackFilter("all");
    setCoverage(null);
    setError(null);
  }

  function toggleClass(classId: string) {
    setForm((current) => {
      const classIds = current.classIds.includes(classId) ? current.classIds.filter((id) => id !== classId) : [...current.classIds, classId];
      const availableSubjectIds = new Set(offerings.filter((offering) => offering.status === "active" && classIds.includes(offering.classId)).map((offering) => offering.subjectId));
      const subjectIds = current.subjectIds.filter((id) => availableSubjectIds.has(id));
      const offeringIds = offerings.filter((offering) => offering.status === "active" && classIds.includes(offering.classId) && subjectIds.includes(offering.subjectId)).map((offering) => offering.id);
      return { ...current, classIds, subjectIds, offeringIds };
    });
    setCoverage(null);
    setError(null);
  }

  function toggleSubject(subjectId: string) {
    setForm((current) => {
      const subjectIds = current.mode === "qualifier"
        ? current.subjectIds.includes(subjectId) ? current.subjectIds.filter((id) => id !== subjectId) : [...current.subjectIds, subjectId]
        : SINGLE_SUBJECT_MODES.has(current.mode)
          ? current.subjectIds[0] === subjectId ? [] : [subjectId]
          : current.subjectIds.includes(subjectId)
            ? current.subjectIds.filter((id) => id !== subjectId)
            : [...current.subjectIds, subjectId];
      const offeringIds = current.mode === "qualifier" ? [] : offerings.filter((offering) =>
        offering.status === "active" && current.classIds.includes(offering.classId) && subjectIds.includes(offering.subjectId),
      ).map((offering) => offering.id);
      return { ...current, subjectIds, offeringIds };
    });
    setCoverage(null);
    setError(null);
  }

  function toggleCandidate(studentId: string) {
    set("studentIds", form.studentIds.includes(studentId) ? form.studentIds.filter((id) => id !== studentId) : [...form.studentIds, studentId]);
  }

  function togglePlacementTrack(track: AcademicTrack) {
    set("placementTracks", form.placementTracks.includes(track) ? form.placementTracks.filter((item) => item !== track) : [...form.placementTracks, track]);
  }

  function validateStep(current: number): string | null {
    if (current === 0) {
      if (form.title.trim().length < 3) return "Enter an exam title of at least 3 characters.";
      if (form.mode === "waec" && form.classLevel !== "SS3") return "WAEC examinations are configured for SS3.";
    }
    if (current === 1) {
      if (form.mode === "qualifier") {
        if (!form.placementTracks.length) return "Choose at least one placement outcome.";
      } else if (!form.classIds.length) {
        return "Choose at least one target class.";
      }
    }
    if (current === 2) {
      if (form.mode === "qualifier" && !form.subjectIds.length) return "Choose at least one qualifier subject.";
      if (SINGLE_SUBJECT_MODES.has(form.mode) && form.subjectIds.length !== 1) return "Choose exactly one subject for this examination mode.";
      if (form.mode === "mixed" && (form.subjectIds.length < 2 || form.subjectIds.length > 12)) return "Choose between 2 and 12 subjects for a mixed examination.";
      if (form.mode !== "qualifier" && form.subjectIds.some((subjectId) => !form.offeringIds.some((id) => offerings.find((offering) => offering.id === id)?.subjectId === subjectId))) {
        return "Every selected subject needs an active offering in the target classes.";
      }
      if (!Number.isInteger(form.durationSeconds) || form.durationSeconds < DURATION_MIN_SECONDS || form.durationSeconds > DURATION_MAX_SECONDS) return "Duration must be between 30 seconds and 4 hours.";
      if (!Number.isInteger(form.questionCount) || form.questionCount < QUESTION_MIN_COUNT || form.questionCount > QUESTION_MAX_COUNT) return "Question count must be between 5 and 200.";
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
      if (!result.ok || !result.id) {
        const message = result.error ?? "The examination could not be created.";
        setError(message);
        toast.add({ type: "error", title: "Examination was not created", description: message, priority: "high" });
        return;
      }
      toast.add({
        type: "success",
        title: form.mode === "qualifier" ? "Placement examination created" : "Examination created",
        description: `${form.title} is ready for review.`,
      });
      router.replace(`/workspace/exams?modal=exam&exam=${encodeURIComponent(result.id)}`, { scroll: false });
    });
  }

  return (
    <Dialog open={open} onOpenChange={(value) => { if (!value && !pending) onClose(); }}>
      <DialogContent className="border-neutral-200 bg-white shadow-2xl sm:max-w-5xl">
        <DialogHeader>
          <div className="flex flex-wrap items-center justify-between gap-2 pr-8">
            <p className="text-[10px] font-bold uppercase tracking-[.14em] text-neutral-500">Create examination</p>
            <Badge variant="outline">Step {step + 1} / {STEPS.length}</Badge>
          </div>
          <DialogTitle className="font-display text-xl font-extrabold text-neutral-950">{STEPS[step]}</DialogTitle>
          <DialogDescription>
            {form.mode === "qualifier"
              ? "Placement candidates are targeted directly; Science, Humanities and Business are possible outcomes, not existing class assignments."
              : "Choose the real class audience first, then the paper subjects available through those class offerings."}
          </DialogDescription>
        </DialogHeader>
        <Progress value={((step + 1) / STEPS.length) * 100} className="h-1.5" />

        {step === 0 ? (
          <FieldGroup>
            <Field><FieldLabel htmlFor="w-title">Exam title</FieldLabel><Input id="w-title" className={inputClass} value={form.title} onChange={(event) => set("title", event.target.value)} maxLength={72} placeholder="SS1 Mathematics First Term" /></Field>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field><FieldLabel htmlFor="w-mode">Exam mode</FieldLabel><NativeSelect id="w-mode" className={selectClass} value={form.mode} onChange={(event) => chooseMode(event.target.value as ExamCreationInput["mode"])}>{availableModes.map((mode) => <NativeSelectOption key={mode} value={mode}>{modeLabels[mode]}</NativeSelectOption>)}</NativeSelect></Field>
              <Field><FieldLabel htmlFor="w-level">Question level</FieldLabel><NativeSelect id="w-level" className={selectClass} value={form.classLevel} disabled={form.mode === "qualifier" || form.mode === "waec"} onChange={(event) => chooseLevel(event.target.value as ExamCreationInput["classLevel"])}>{(["SS1", "SS2", "SS3"] as const).map((level) => <NativeSelectOption key={level} value={level}>{level}</NativeSelectOption>)}</NativeSelect></Field>
            </div>
            {form.mode === "qualifier" ? (
              <Alert>
                <GraduationCap />
                <AlertTitle>Placement assessment, not an SS1 class exam</AlertTitle>
                <AlertDescription>The SS1 value is used only to match the incoming-readiness question bank. Candidates remain unplaced until their completed attempts produce placement evidence.</AlertDescription>
              </Alert>
            ) : null}
          </FieldGroup>
        ) : null}

        {step === 1 && form.mode === "qualifier" ? (
          <FieldGroup>
            <Field>
              <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
                <div><FieldLabel>Incoming candidates ({form.studentIds.length} selected)</FieldLabel><p className="mt-1 text-xs text-muted-foreground">Pre-register known candidates, or leave empty for open entry. New students join with the exam link and their first + last name, and are enrolled automatically.</p></div>
                <label htmlFor="w-show-enrolled-candidates" className="flex items-center gap-2 text-xs font-medium text-muted-foreground"><Switch id="w-show-enrolled-candidates" checked={showEnrolledCandidates} onCheckedChange={setShowEnrolledCandidates} />Show enrolled students</label>
              </div>
              <InputGroup className="mt-3 h-10"><InputGroupAddon><Search /></InputGroupAddon><InputGroupInput value={candidateQuery} onChange={(event) => setCandidateQuery(event.target.value)} placeholder="Search name or student number…" aria-label="Search candidates" /></InputGroup>
              <div className="mt-3 max-h-72 divide-y divide-border overflow-x-hidden overflow-y-auto border-y border-border">
                {visibleCandidates.map((candidate, candidateIndex) => {
                  const checked = form.studentIds.includes(candidate.id);
                  const controlId = `w-candidate-${candidateIndex}`;
                  return (
                    <label key={candidate.id} htmlFor={controlId} className="flex min-h-14 cursor-pointer items-center gap-3 px-2 py-3 hover:bg-muted/40">
                      <Checkbox id={controlId} checked={checked} onCheckedChange={() => toggleCandidate(candidate.id)} />
                      <span className="min-w-0 flex-1"><strong className="block truncate text-sm text-foreground">{candidate.name}</strong><span className="mt-1 block text-xs text-muted-foreground">{candidate.studentNumber ?? "No student number"} · {candidate.className ?? "Not yet assigned to a senior class"}</span></span>
                      {candidate.classId ? <Badge variant="outline">Enrolled</Badge> : <Badge variant="secondary">Incoming</Badge>}
                    </label>
                  );
                })}
                {!visibleCandidates.length ? <p className="px-3 py-8 text-center text-sm text-muted-foreground">No candidates match the current filter.</p> : null}
              </div>
            </Field>
            <Field>
              <FieldLabel>Possible placement outcomes</FieldLabel>
              <div className="mt-2 grid gap-2 sm:grid-cols-3">
                {(["science", "humanities", "business"] as AcademicTrack[]).map((track) => {
                  const controlId = `w-placement-track-${track}`;
                  return (
                  <label key={track} htmlFor={controlId} className="flex min-h-12 cursor-pointer items-center gap-3 rounded-xl border border-border px-3 py-2 hover:bg-muted/40">
                    <Checkbox id={controlId} checked={form.placementTracks.includes(track)} onCheckedChange={() => togglePlacementTrack(track)} />
                    <span className="text-sm font-medium">{trackLabels[track]}</span>
                  </label>
                  );
                })}
              </div>
            </Field>
          </FieldGroup>
        ) : null}

        {step === 1 && form.mode !== "qualifier" ? (
          <FieldGroup>
            <div className="grid gap-3 sm:grid-cols-[1fr_220px] sm:items-end">
              <Field><FieldLabel>Target classes ({form.classIds.length} selected)</FieldLabel><p className="mt-1 text-xs text-muted-foreground">Subjects in the next step are derived from the active offerings of the classes you choose here.</p></Field>
              <Field><FieldLabel htmlFor="w-track-filter">Study track filter</FieldLabel><NativeSelect id="w-track-filter" className={selectClass} value={trackFilter} onChange={(event) => setTrackFilter(event.target.value as "all" | AcademicTrack)}><NativeSelectOption value="all">All tracks</NativeSelectOption><NativeSelectOption value="science">Science</NativeSelectOption><NativeSelectOption value="humanities">Humanities</NativeSelectOption><NativeSelectOption value="business">Business</NativeSelectOption></NativeSelect></Field>
            </div>
            <div className="grid max-h-72 gap-2 overflow-x-hidden overflow-y-auto sm:grid-cols-2 lg:grid-cols-3">
              {activeClasses.map((item, classIndex) => {
                const checked = form.classIds.includes(item.id);
                const controlId = `w-class-${classIndex}`;
                return <label key={item.id} htmlFor={controlId} className="flex min-h-14 cursor-pointer items-center gap-3 rounded-xl border border-border px-3 py-3 hover:bg-muted/40"><Checkbox id={controlId} checked={checked} onCheckedChange={() => toggleClass(item.id)} /><span className="min-w-0"><strong className="block truncate text-sm">{item.name}</strong><span className="mt-1 block text-xs text-muted-foreground">{item.trackName}</span></span></label>;
              })}
              {!activeClasses.length ? <p className="col-span-full py-8 text-center text-sm text-muted-foreground">No active classes match this level, track and staff scope. Subject offerings may not be configured yet — ask an administrator to activate them from the class record.</p> : null}
            </div>
          </FieldGroup>
        ) : null}

        {step === 2 ? (
          <FieldGroup>
            <Field>
              <div className="flex flex-wrap items-end justify-between gap-2"><div><FieldLabel>{form.mode === "qualifier" ? `Qualifier subjects (${form.subjectIds.length} selected)` : `Paper subjects (${form.subjectIds.length} selected)`}</FieldLabel><p className="mt-1 text-xs text-muted-foreground">{form.mode === "qualifier" ? "Mathematics Aptitude and Basic Science & Technology are preselected as the placement core; adjust the bank when needed." : "Only subjects actually offered by the selected classes and available to your staff scope are shown."}</p></div>{form.mode === "qualifier" ? <Badge variant="secondary">Recommended core preset</Badge> : null}</div>
              <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {(form.mode === "qualifier" ? qualifierSubjects : normalSubjects).map((subject, subjectIndex) => {
                  const checked = form.subjectIds.includes(subject.id);
                  const recommended = form.mode === "qualifier" && ["q-math", "q-bst"].includes(subject.code);
                  const controlId = `w-subject-${subjectIndex}`;
                  return <label key={subject.id} htmlFor={controlId} className="flex min-h-14 cursor-pointer items-center gap-3 rounded-xl border border-border px-3 py-3 hover:bg-muted/40"><Checkbox id={controlId} checked={checked} onCheckedChange={() => toggleSubject(subject.id)} /><span className="min-w-0 flex-1"><strong className="block truncate text-sm">{subject.name}</strong><span className="mt-1 block text-xs text-muted-foreground">{subject.code}{recommended ? " · preset" : ""}</span></span></label>;
                })}
                {form.mode !== "qualifier" && !normalSubjects.length ? <p className="col-span-full py-6 text-sm text-muted-foreground">{form.classIds.length ? "None of the selected classes offer subjects yet. An administrator can activate subject offerings from the class record → Subjects tab." : "Choose target classes first. Their active subject offerings will appear here."}</p> : null}
              </div>
            </Field>
            <div className="grid gap-5 sm:grid-cols-2">
              <Field>
                <div className="flex items-center justify-between gap-2"><FieldLabel>Duration</FieldLabel><Badge variant="secondary" className="tabular-nums">{formatDuration(form.durationSeconds)}</Badge></div>
                <Slider aria-label="Exam duration" min={DURATION_MIN_SECONDS} max={DURATION_MAX_SECONDS} step={30} value={[form.durationSeconds]} onValueChange={(value) => set("durationSeconds", Array.isArray(value) ? (value[0] ?? DURATION_MIN_SECONDS) : value)} />
                <div className="flex justify-between text-xs text-muted-foreground"><span>30 sec</span><span>4 hrs</span></div>
              </Field>
              <Field>
                <div className="flex items-center justify-between gap-2"><FieldLabel>Questions</FieldLabel><Badge variant="secondary" className="tabular-nums">{form.questionCount} questions</Badge></div>
                <Slider aria-label="Question count" min={QUESTION_MIN_COUNT} max={QUESTION_MAX_COUNT} step={1} value={[form.questionCount]} onValueChange={(value) => set("questionCount", Array.isArray(value) ? (value[0] ?? QUESTION_MIN_COUNT) : value)} />
                <div className="flex justify-between text-xs text-muted-foreground"><span>5</span><span>200</span></div>
              </Field>
            </div>
            <Field>
              <div className="flex items-center justify-between gap-4 rounded-xl border border-neutral-200 p-4">
                <div>
                  <FieldLabel htmlFor="w-fill-questions">Allow fill-in questions</FieldLabel>
                  <p className="mt-1 text-xs text-neutral-500">Off by default. When off, generated papers use option-based and True/False questions only.</p>
                </div>
                <Switch id="w-fill-questions" checked={form.allowFillQuestions} onCheckedChange={(value) => set("allowFillQuestions", value)} />
              </div>
            </Field>
            <Field><FieldLabel htmlFor="w-inst">Candidate instructions</FieldLabel><Textarea id="w-inst" className="min-h-24 rounded-lg border-neutral-300" value={form.instructions} onChange={(event) => set("instructions", event.target.value)} maxLength={140} placeholder={form.mode === "qualifier" ? "Complete every section. Your result will support senior-school placement." : "Read every question carefully before submitting."} /></Field>
            <Field>
              <FieldLabel>Exam availability</FieldLabel>
              <RadioGroup
                aria-label="Exam availability"
                value={form.status === "closed" ? "closed" : "open"}
                onValueChange={(value) => set("status", value === "closed" ? "closed" : "open")}
                className="grid grid-cols-2 gap-2"
              >
                {([
                  { value: "open", title: "Open", hint: "Candidates can enter now" },
                  { value: "closed", title: "Closed", hint: "Blocks new entries" },
                ] as const).map((option) => (
                  <label
                    key={option.value}
                    htmlFor={`w-status-${option.value}`}
                    className="flex cursor-pointer items-center gap-3 rounded-xl border border-border px-3 py-3 transition hover:bg-muted/40 has-data-checked:border-neutral-950 has-data-checked:bg-neutral-950 has-data-checked:text-white"
                  >
                    <RadioGroupItem id={`w-status-${option.value}`} value={option.value} />
                    <span className="min-w-0">
                      <strong className="block text-sm">{option.title}</strong>
                      <span className="mt-0.5 block text-xs opacity-70">{option.hint}</span>
                    </span>
                  </label>
                ))}
              </RadioGroup>
              <p className="mt-1 text-xs text-muted-foreground">Open exams admit candidates through the QR code, exam link, or Exam ID. Closed exams stop new entries.</p>
            </Field>
          </FieldGroup>
        ) : null}

        {step === 3 ? (
          <FieldGroup>
            <div className="rounded-xl border border-neutral-200 bg-neutral-50 p-4"><div className="flex items-center justify-between gap-4"><div className="flex gap-3"><span className="grid size-9 place-items-center rounded-lg bg-white"><Camera className="size-4" /></span><div><FieldLabel htmlFor="w-cam">Camera monitoring</FieldLabel><p className="mt-1 text-xs text-neutral-500">Ask for camera access automatically. Candidates can continue if permission is denied or unavailable.</p></div></div><Switch id="w-cam" checked={form.cameraRequired} onCheckedChange={(value) => set("cameraRequired", value)} /></div></div>
            <Field><FieldLabel htmlFor="w-warn">Warn after serious integrity events</FieldLabel><Input id="w-warn" className={inputClass} type="number" min={1} max={10} value={form.warnAfter} onChange={(event) => set("warnAfter", Number(event.target.value))} /></Field>
            <Alert><ShieldCheck /><AlertTitle>Core integrity controls remain enabled</AlertTitle><AlertDescription>Focus monitoring, clipboard guard, question randomization and option randomization are preserved by the current exam-session defaults. These will move into the advanced exam editor instead of crowding this creation flow.</AlertDescription></Alert>
          </FieldGroup>
        ) : null}

        {step === 4 ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div className="rounded-xl border border-neutral-200 bg-neutral-50 p-4"><BookOpenCheck className="size-5" /><p className="mt-3 text-xs font-medium text-neutral-500">Paper</p><strong className="mt-1 block text-sm">{form.questionCount} questions · {formatDuration(form.durationSeconds)}</strong><p className="mt-1 text-xs text-neutral-500">{selectedSubjectNames.join(", ") || "No subjects"} · {form.allowFillQuestions ? "Fill-in enabled" : "Options + True/False"}</p></div>
            <div className="rounded-xl border border-neutral-200 bg-neutral-50 p-4"><Users className="size-5" /><p className="mt-3 text-xs font-medium text-neutral-500">Audience</p><strong className="mt-1 block text-sm">{form.mode === "qualifier" ? (form.studentIds.length ? `${form.studentIds.length} candidate${form.studentIds.length === 1 ? "" : "s"}` : "Open entry") : `${form.classIds.length} class${form.classIds.length === 1 ? "" : "es"}`}</strong><p className="mt-1 line-clamp-2 text-xs text-neutral-500">{form.mode === "qualifier" ? (form.studentIds.length ? selectedCandidateNames.slice(0, 4).join(", ") : "New students enroll with first + last name") : selectedClassNames.join(", ")}</p></div>
            <div className="rounded-xl border border-neutral-200 bg-neutral-50 p-4"><GraduationCap className="size-5" /><p className="mt-3 text-xs font-medium text-neutral-500">{form.mode === "qualifier" ? "Placement outcomes" : "Study scope"}</p><strong className="mt-1 block text-sm">{form.mode === "qualifier" ? form.placementTracks.map((track) => trackLabels[track]).join(" · ") : form.classLevel}</strong><p className="mt-1 text-xs text-neutral-500">{modeLabels[form.mode]}</p></div>
            <div className="rounded-xl border border-neutral-200 bg-neutral-50 p-4"><CheckCircle2 className="size-5" /><p className="mt-3 text-xs font-medium text-neutral-500">Question coverage</p><strong className="mt-1 block text-sm">{coverage?.count ?? 0} eligible</strong><p className="mt-1 text-xs text-neutral-500">Validated against mode, subject and question level</p></div>
            <div className="rounded-xl border border-neutral-200 p-4 sm:col-span-2 lg:col-span-4"><p className="text-xs font-medium text-neutral-500">Ready to create</p><strong className="mt-1 block text-base">{form.title}</strong><p className="mt-1 text-sm text-neutral-500">{form.mode === "qualifier" ? "Candidates receive explicit access and open the paper with the QR code, exam link, or Exam ID; no senior class is assigned by this exam." : `${form.classLevel} · ${form.offeringIds.length} concrete offering target${form.offeringIds.length === 1 ? "" : "s"}`} · {form.status}</p><p className="mt-2 text-xs text-neutral-500">Students enter through the QR code, exam link, or Exam ID shown on the exam detail after creation.</p></div>
          </div>
        ) : null}

        {error ? <Alert variant="destructive"><AlertTitle>Check this step</AlertTitle><AlertDescription>{error}</AlertDescription></Alert> : null}
        <DialogFooter>
          <Button variant="outline" className={adminSecondaryButtonClass} disabled={step === 0 || pending} onClick={() => { setError(null); setStep((current) => Math.max(0, current - 1)); }}>Back</Button>
          {step < STEPS.length - 1 ? <Button className={adminPrimaryButtonClass} disabled={pending} onClick={() => void next()}>Next</Button> : <Button className={adminPrimaryButtonClass} disabled={pending || !coverage?.ok} onClick={create}>{pending ? "Creating…" : "Create exam"}</Button>}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
