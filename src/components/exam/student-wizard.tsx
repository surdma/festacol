"use client";

import { CheckCircle2, GraduationCap, School } from "lucide-react";
import { useEffect, useMemo, useState, useTransition } from "react";
import {
  completeExamOnboardingAction,
  getExamOnboardingDataAction,
  type ExamOnboardingData,
  type ExamOnboardingNext,
} from "@/app/actions/exam-onboarding";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Spinner } from "@/components/ui/spinner";

export interface StudentWizardProps {
  token: string;
  onComplete: (next: Exclude<ExamOnboardingNext, "configure">) => void;
}

type Step = "level" | "path" | "class" | "confirm";
type PathChoice = "class" | "placement";

function trackLabel(value: string) {
  if (value === "science") return "Science";
  if (value === "humanities") return "Humanities";
  if (value === "business") return "Business";
  return value.replaceAll("_", " ");
}

function classLabel(item: { levelName: string; track: string; arm: string }) {
  return `${item.levelName} ${trackLabel(item.track)} · Arm ${item.arm}`;
}

export function StudentWizard({ token, onComplete }: StudentWizardProps) {
  const [data, setData] = useState<ExamOnboardingData | null>(null);
  const [step, setStep] = useState<Step>("level");
  const [levelId, setLevelId] = useState("");
  const [classId, setClassId] = useState("");
  const [pathChoice, setPathChoice] = useState<PathChoice | "">("");
  const [error, setError] = useState<string | null>(null);
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
      <Card className="mx-auto w-full max-w-2xl">
        <CardContent className="flex min-h-56 items-center justify-center gap-2 text-sm text-muted-foreground">
          <Spinner /> Loading your school setup…
        </CardContent>
      </Card>
    );
  }

  if (!data) {
    return (
      <Alert variant="destructive" className="mx-auto max-w-2xl">
        <AlertTitle>Academic setup unavailable</AlertTitle>
        <AlertDescription>{error}</AlertDescription>
      </Alert>
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
      if (result.next) onComplete(result.next);
    });
  }

  return (
    <Card className="mx-auto w-full max-w-2xl">
      <CardHeader>
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="outline">Student setup</Badge>
          <Badge variant="secondary">{data.exam.title}</Badge>
        </div>
        <CardTitle>Confirm where you belong in school</CardTitle>
        <CardDescription>
          This is saved to your student record. You can confirm an existing class here, but only staff can change a class after it has been confirmed.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-5">
        {data.enrollment ? (
          <Alert>
            <CheckCircle2 />
            <AlertTitle>Class already confirmed</AlertTitle>
            <AlertDescription>
              {classLabel({ levelName: data.enrollment.levelName, track: data.enrollment.track, arm: data.enrollment.arm })}. Confirm this record to continue.
            </AlertDescription>
          </Alert>
        ) : null}

        {step === "level" ? (
          <FieldGroup>
            <Field>
              <FieldLabel>Current level</FieldLabel>
              <RadioGroup value={levelId} onValueChange={(value) => setLevelId(String(value))}>
                {data.levels.map((level) => (
                  <label key={level.id} className="flex min-h-14 cursor-pointer items-center gap-3 rounded-xl border border-input p-4 has-data-checked:border-primary has-data-checked:bg-muted/50">
                    <RadioGroupItem value={level.id} />
                    <span className="flex-1">
                      <strong className="block text-sm">{level.name}</strong>
                      <span className="text-xs text-muted-foreground">Senior secondary level {level.ordinal}</span>
                    </span>
                  </label>
                ))}
              </RadioGroup>
            </Field>
            <Button type="button" onClick={continueFromLevel}>Continue</Button>
          </FieldGroup>
        ) : null}

        {step === "path" ? (
          <FieldGroup>
            <Field>
              <FieldLabel>SS1 placement</FieldLabel>
              <RadioGroup value={pathChoice} onValueChange={(value) => setPathChoice(String(value) as PathChoice)}>
                <label className="flex min-h-16 cursor-pointer items-center gap-3 rounded-xl border border-input p-4 has-data-checked:border-primary has-data-checked:bg-muted/50">
                  <RadioGroupItem value="placement" />
                  <GraduationCap aria-hidden="true" />
                  <span className="flex-1">
                    <strong className="block text-sm">Let the placement exam decide my SS1 track</strong>
                    <span className="text-xs leading-5 text-muted-foreground">Choose this only if you are entering SS1 and have not yet been placed in Science, Humanities or Business.</span>
                  </span>
                </label>
                <label className="flex min-h-16 cursor-pointer items-center gap-3 rounded-xl border border-input p-4 has-data-checked:border-primary has-data-checked:bg-muted/50">
                  <RadioGroupItem value="class" />
                  <School aria-hidden="true" />
                  <span className="flex-1">
                    <strong className="block text-sm">I already know my SS1 class</strong>
                    <span className="text-xs leading-5 text-muted-foreground">Choose your actual class instead. You will not write this placement exam.</span>
                  </span>
                </label>
              </RadioGroup>
            </Field>
            <div className="flex flex-wrap gap-2">
              <Button type="button" variant="outline" onClick={() => setStep("level")}>Back</Button>
              <Button type="button" onClick={continueFromPath}>Continue</Button>
            </div>
          </FieldGroup>
        ) : null}

        {step === "class" ? (
          <FieldGroup>
            <Field>
              <FieldLabel>{selectedLevel?.name} class</FieldLabel>
              <RadioGroup value={classId} onValueChange={(value) => setClassId(String(value))}>
                {availableClasses.map((item) => (
                  <label key={item.id} className="flex min-h-14 cursor-pointer items-center gap-3 rounded-xl border border-input p-4 has-data-checked:border-primary has-data-checked:bg-muted/50">
                    <RadioGroupItem value={item.id} />
                    <span className="flex-1">
                      <strong className="block text-sm">{classLabel(item)}</strong>
                      <span className="text-xs text-muted-foreground">{trackLabel(item.track)} track</span>
                    </span>
                  </label>
                ))}
              </RadioGroup>
              {!availableClasses.length ? <p className="text-sm text-destructive">No active classes are configured for this level. Ask a staff member for help.</p> : null}
            </Field>
            <div className="flex flex-wrap gap-2">
              <Button type="button" variant="outline" onClick={() => setStep(placementAvailable ? "path" : "level")}>Back</Button>
              <Button type="button" disabled={!availableClasses.length} onClick={continueFromClass}>Continue</Button>
            </div>
          </FieldGroup>
        ) : null}

        {step === "confirm" ? (
          <div className="flex flex-col gap-4">
            <Alert>
              <CheckCircle2 />
              <AlertTitle>{pathChoice === "placement" ? "Confirm placement consent" : "Confirm your class"}</AlertTitle>
              <AlertDescription>
                {pathChoice === "placement"
                  ? "You are confirming that you are entering SS1 and do not yet belong to Science, Humanities or Business. This placement exam decides the suggested SS1 track. You normally get one attempt."
                  : selectedClass
                    ? `Your student record will use ${classLabel(selectedClass)}.`
                    : data.enrollment
                      ? `Your persisted class is ${classLabel({ levelName: data.enrollment.levelName, track: data.enrollment.track, arm: data.enrollment.arm })}.`
                      : "Confirm your academic setup."}
              </AlertDescription>
            </Alert>
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
              {!data.enrollment ? <Button type="button" variant="outline" disabled={pending} onClick={() => setStep(pathChoice === "placement" ? "path" : "class")}>Back</Button> : null}
              <Button type="button" disabled={pending} onClick={submit}>
                {pending ? <><Spinner data-icon="inline-start" />Saving…</> : pathChoice === "placement" ? "I consent — open placement exam" : "Confirm and continue"}
              </Button>
            </div>
          </div>
        ) : null}

        {step !== "confirm" && error ? <p className="text-sm text-destructive" role="alert">{error}</p> : null}
      </CardContent>
    </Card>
  );
}
