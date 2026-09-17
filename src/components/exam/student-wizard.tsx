"use client";

import { Check, CheckCircle2, GraduationCap, School } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState, useTransition } from "react";
import {
  completeExamOnboardingAction,
  getExamOnboardingDataAction,
  type ExamOnboardingData,
} from "@/app/actions/exam-onboarding";
import { ExamCheckpointRail } from "@/components/exam/exam-checkpoint-rail";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Separator } from "@/components/ui/separator";
import { Spinner } from "@/components/ui/spinner";

type Step = "level" | "path" | "class" | "confirm";
type PathChoice = "class" | "placement";

const WIZARD_STEPS = [
  { id: "level", label: "Level" },
  { id: "path", label: "Path" },
  { id: "class", label: "Class" },
  { id: "confirm", label: "Confirm" },
] as const;

const STEP_INDEX: Record<Step, number> = { level: 0, path: 1, class: 2, confirm: 3 };

function trackLabel(value: string) {
  if (value === "science") return "Science";
  if (value === "humanities") return "Humanities";
  if (value === "business") return "Business";
  return value.replaceAll("_", " ");
}

function classLabel(item: { levelName: string; track: string; arm: string }) {
  return `${item.levelName} ${trackLabel(item.track)} · Arm ${item.arm}`;
}

export function StudentWizard({ token }: { token: string }) {
  const router = useRouter();
  const [data, setData] = useState<ExamOnboardingData | null>(null);
  const [step, setStep] = useState<Step>("level");
  const [levelId, setLevelId] = useState("");
  const [classId, setClassId] = useState("");
  const [pathChoice, setPathChoice] = useState<PathChoice | "">("");
  const [error, setError] = useState<string | null>(null);
  const [slowLoad, setSlowLoad] = useState(false);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    let active = true;
    void getExamOnboardingDataAction(token).then((result) => {
      if (!active) return;
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setData(result.data);
      if (result.data.enrollment) {
        setLevelId(result.data.enrollment.levelId);
        setClassId(result.data.enrollment.classId);
        setPathChoice("class");
        setStep("confirm");
      }
    });
    return () => {
      active = false;
    };
  }, [token]);

  useEffect(() => {
    const timeout = window.setTimeout(() => setSlowLoad(true), 8000);
    return () => window.clearTimeout(timeout);
  }, []);

  const selectedLevel = useMemo(
    () => data?.levels.find((level) => level.id === levelId) ?? null,
    [data, levelId],
  );
  const availableClasses = useMemo(
    () => data?.classes.filter((item) => item.levelId === levelId) ?? [],
    [data, levelId],
  );
  const selectedClass = useMemo(
    () => data?.classes.find((item) => item.id === classId) ?? null,
    [data, classId],
  );
  const placementAvailable = Boolean(
    data && !data.enrollment && data.exam.mode === "qualifier" && selectedLevel?.name === "SS1",
  );

  if (!data && !error) {
    return (
      <section aria-label="Student setup" className="mx-auto w-full max-w-2xl px-1 py-8 sm:py-12">
        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">Student setup</p>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight sm:text-3xl">Confirm where you belong in school</h1>
        <Separator className="mt-6" />
        <div className="flex min-h-56 flex-col items-center justify-center gap-3 py-10 text-center">
          <Spinner className="size-6" />
          <output className="block text-sm text-muted-foreground">Loading your school setup…</output>
          {slowLoad ? (
            <p className="max-w-md text-xs leading-5 text-muted-foreground">
              Still preparing — this is taking longer than usual. Keep this page open while Festacol reaches the school
              record service.
            </p>
          ) : null}
        </div>
      </section>
    );
  }

  if (!data) {
    return (
      <section aria-label="Student setup" className="mx-auto w-full max-w-2xl px-1 py-8 sm:py-12">
        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">Student setup</p>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight sm:text-3xl">Confirm where you belong in school</h1>
        <Separator className="mt-6" />
        <Alert variant="destructive" className="mt-6">
          <AlertTitle>Academic setup unavailable</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      </section>
    );
  }

  function continueFromLevel() {
    if (!selectedLevel) {
      setError("Choose your current school level.");
      return;
    }
    setError(null);
    setClassId("");
    setPathChoice("");
    setStep(placementAvailable ? "path" : "class");
  }

  function continueFromPath() {
    if (!pathChoice) {
      setError("Choose whether you need placement or already know your SS1 class.");
      return;
    }
    setError(null);
    setStep(pathChoice === "placement" ? "confirm" : "class");
  }

  function continueFromClass() {
    if (!selectedClass) {
      setError("Choose the class you currently belong to.");
      return;
    }
    setError(null);
    setPathChoice("class");
    setStep("confirm");
  }

  function submit() {
    if (!selectedLevel) return;
    setError(null);
    startTransition(async () => {
      const result = await completeExamOnboardingAction({
        token,
        levelId: selectedLevel.id,
        classId: pathChoice === "placement" ? null : selectedClass?.id ?? null,
        placementConsent: pathChoice === "placement",
      });
      if (!result.ok) {
        setError(result.error ?? "Your school setup could not be confirmed.");
        return;
      }
      if (result.next === "dashboard") {
        router.replace("/dashboard");
        router.refresh();
        return;
      }
      if (result.next === "exam") {
        router.replace(`/exam?token=${encodeURIComponent(token)}`);
        router.refresh();
      }
    });
  }

  return (
    <section aria-label="Student setup" className="mx-auto w-full max-w-2xl px-1 py-8 sm:py-12">
      <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
        Student setup · {data.exam.title}
      </p>
      <h1 className="mt-2 text-2xl font-semibold tracking-tight sm:text-3xl">Confirm where you belong in school</h1>
      <p className="mt-3 max-w-xl text-sm leading-6 text-muted-foreground">
        This is saved to your student record. You can confirm an existing class here, but only staff can change a class after it has been confirmed.
      </p>

      <Separator className="mt-6" />
      <div className="py-5">
        <ExamCheckpointRail steps={[...WIZARD_STEPS]} currentIndex={STEP_INDEX[step]} label="Student setup progress" />
      </div>
      <Separator />

      <div className="py-7">
        {data.enrollment ? (
          <div className="mb-7 flex items-start gap-3 border-y py-4">
            <span className="grid size-9 shrink-0 place-items-center rounded-full bg-foreground text-background">
              <Check className="size-4" aria-hidden="true" />
            </span>
            <div className="min-w-0">
              <p className="text-sm font-semibold">Class already confirmed</p>
              <p className="mt-0.5 text-sm leading-6 text-muted-foreground">
                {classLabel({ levelName: data.enrollment.levelName, track: data.enrollment.track, arm: data.enrollment.arm })}. Confirm this record to continue.
              </p>
            </div>
          </div>
        ) : null}

        {step === "level" ? (
          <FieldGroup>
            <Field>
              <FieldLabel>Current level</FieldLabel>
              <RadioGroup value={levelId} onValueChange={(value) => setLevelId(String(value))}>
                <div className="border-y">
                  {data.levels.map((level) => (
                    <label key={level.id} htmlFor={`wizard-level-${level.id}`} className="flex min-h-16 cursor-pointer items-center gap-3 border-b py-4 last:border-b-0 has-data-checked:bg-muted/40">
                      <RadioGroupItem id={`wizard-level-${level.id}`} value={level.id} />
                      <span className="flex-1">
                        <strong className="block text-sm">{level.name}</strong>
                        <span className="text-xs text-muted-foreground">Senior secondary level {level.ordinal}</span>
                      </span>
                    </label>
                  ))}
                </div>
              </RadioGroup>
            </Field>
            <Button type="button" size="lg" onClick={continueFromLevel}>Continue</Button>
          </FieldGroup>
        ) : null}

        {step === "path" ? (
          <FieldGroup>
            <Field>
              <FieldLabel>SS1 placement</FieldLabel>
              <RadioGroup value={pathChoice} onValueChange={(value) => setPathChoice(String(value) as PathChoice)}>
                <div className="border-y">
                  <label htmlFor="wizard-path-placement" className="flex min-h-16 cursor-pointer items-center gap-3 border-b py-4 has-data-checked:bg-muted/40">
                    <RadioGroupItem id="wizard-path-placement" value="placement" />
                    <GraduationCap className="size-5 shrink-0 text-muted-foreground" aria-hidden="true" />
                    <span className="flex-1">
                      <strong className="block text-sm">Let the placement exam decide my SS1 track</strong>
                      <span className="text-xs leading-5 text-muted-foreground">Choose this only if you are entering SS1 and have not yet been placed in Science, Humanities or Business.</span>
                    </span>
                  </label>
                  <label htmlFor="wizard-path-class" className="flex min-h-16 cursor-pointer items-center gap-3 border-b py-4 last:border-b-0 has-data-checked:bg-muted/40">
                    <RadioGroupItem id="wizard-path-class" value="class" />
                    <School className="size-5 shrink-0 text-muted-foreground" aria-hidden="true" />
                    <span className="flex-1">
                      <strong className="block text-sm">I already know my SS1 class</strong>
                      <span className="text-xs leading-5 text-muted-foreground">Choose your actual class instead. You will not write this placement exam.</span>
                    </span>
                  </label>
                </div>
              </RadioGroup>
            </Field>
            <div className="flex flex-wrap gap-2">
              <Button type="button" size="lg" variant="outline" onClick={() => setStep("level")}>Back</Button>
              <Button type="button" size="lg" onClick={continueFromPath}>Continue</Button>
            </div>
          </FieldGroup>
        ) : null}

        {step === "class" ? (
          <FieldGroup>
            <Field>
              <FieldLabel>{selectedLevel?.name} class</FieldLabel>
              <RadioGroup value={classId} onValueChange={(value) => setClassId(String(value))}>
                <div className="border-y">
                  {availableClasses.map((item) => (
                    <label key={item.id} htmlFor={`wizard-class-${item.id}`} className="flex min-h-16 cursor-pointer items-center gap-3 border-b py-4 last:border-b-0 has-data-checked:bg-muted/40">
                      <RadioGroupItem id={`wizard-class-${item.id}`} value={item.id} />
                      <span className="flex-1">
                        <strong className="block text-sm">{classLabel(item)}</strong>
                        <span className="text-xs text-muted-foreground">{trackLabel(item.track)} track</span>
                      </span>
                    </label>
                  ))}
                </div>
              </RadioGroup>
              {!availableClasses.length ? <p className="text-sm text-destructive">No active classes are configured for this level. Ask a staff member for help.</p> : null}
            </Field>
            <div className="flex flex-wrap gap-2">
              <Button type="button" size="lg" variant="outline" onClick={() => setStep(placementAvailable ? "path" : "level")}>Back</Button>
              <Button type="button" size="lg" disabled={!availableClasses.length} onClick={continueFromClass}>Continue</Button>
            </div>
          </FieldGroup>
        ) : null}

        {step === "confirm" ? (
          <div className="flex flex-col gap-5">
            <div className="flex items-start gap-3 border-y py-4">
              <span className="grid size-9 shrink-0 place-items-center rounded-full bg-foreground text-background">
                <CheckCircle2 className="size-4" aria-hidden="true" />
              </span>
              <div className="min-w-0">
                <p className="text-sm font-semibold">{pathChoice === "placement" ? "Confirm placement consent" : "Confirm your class"}</p>
                <p className="mt-0.5 text-sm leading-6 text-muted-foreground">
                  {pathChoice === "placement"
                    ? "You are confirming that you are entering SS1 and do not yet belong to Science, Humanities or Business. This placement exam decides the suggested SS1 track. You normally get one attempt."
                    : selectedClass
                      ? `Your student record will use ${classLabel(selectedClass)}.`
                      : data.enrollment
                        ? `Your persisted class is ${classLabel({ levelName: data.enrollment.levelName, track: data.enrollment.track, arm: data.enrollment.arm })}.`
                        : "Confirm your academic setup."}
                </p>
              </div>
            </div>
            {pathChoice === "placement" ? (
              <p className="text-xs leading-5 text-muted-foreground">
                After you submit a placement attempt, another attempt is blocked unless a teacher or administrator explicitly grants a retake from the staff workspace.
              </p>
            ) : data.exam.mode === "qualifier" ? (
              <p className="text-xs leading-5 text-muted-foreground">
                Because you already know your class, you will go to your dashboard instead of writing this placement exam.
              </p>
            ) : null}
            {error ? <p className="text-sm text-destructive" role="alert">{error}</p> : null}
            <div className="flex flex-wrap gap-2">
              {!data.enrollment ? <Button type="button" size="lg" variant="outline" disabled={pending} onClick={() => setStep(pathChoice === "placement" ? "path" : "class")}>Back</Button> : null}
              <Button type="button" size="lg" disabled={pending} onClick={submit}>
                {pending ? <><Spinner data-icon="inline-start" />Saving…</> : pathChoice === "placement" ? "I consent — open placement exam" : "Confirm and continue"}
              </Button>
            </div>
          </div>
        ) : null}

        {step !== "confirm" && error ? <p className="mt-5 text-sm text-destructive" role="alert">{error}</p> : null}
      </div>
    </section>
  );
}
