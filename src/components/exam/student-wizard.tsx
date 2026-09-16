"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useTransition } from "react";
import { getExamEntryWizardDataAction, enterExamByNameAction, type ExamEntryResult } from "@/app/actions/exam-entry";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export type WizardStep = "level" | "class" | "confirm";

interface LevelOption {
  id: string;
  name: string;
  ordinal: number;
}

interface ClassOption {
  id: string;
  levelId: string;
  levelName: string;
  levelOrdinal: number;
  track: string;
  arm: string;
}

interface ExamInfo {
  id: string;
  title: string;
  mode: string;
  status: string;
}

interface WizardData {
  exam: ExamInfo;
  levels: LevelOption[];
  classes: ClassOption[];
  enrolledClassId: string | null;
}

interface StudentWizardProps {
  token: string;
  firstName: string;
  lastName: string;
  onComplete: (result: ExamEntryResult) => void;
  onError: (error: string, next?: string) => void;
}

export function StudentWizard({ token, firstName, lastName, onComplete, onError }: StudentWizardProps) {
  const [step, setStep] = useState<WizardStep>("level");
  const [pending, startTransition] = useTransition();
  const [wizardData, setWizardData] = useState<WizardData | null>(null);
  const [selectedLevel, setSelectedLevel] = useState<string>("");
  const [selectedClass, setSelectedClass] = useState<string>("");
  const [error, setError] = useState<string | null>(null);
  const stepRef = useRef<HTMLDivElement>(null);

  // Load wizard data on mount
  useEffect(() => {
    void (async () => {
      try {
        const result = await getExamEntryWizardDataAction(token);
        if (result.ok) {
          setWizardData(result.data);
        } else {
          onError(result.error);
        }
      } catch {
        onError("Could not load exam wizard data.");
      }
    })();
  }, [token]);

  // Focus management: focus the step container on step changes
  useEffect(() => {
    stepRef.current?.focus();
  }, [step]);

  // Determine available classes based on selected level
  const availableClasses = wizardData?.classes.filter((c) => c.levelId === selectedLevel) ?? [];
  const isPlacement = wizardData?.exam.mode === "qualifier";

  const handleLevelSelect = useCallback((levelId: string) => {
    setSelectedLevel(levelId);
    setSelectedClass("");
    setError(null);
    setStep("class");
  }, []);

  const handleClassSelect = useCallback((classId: string) => {
    setSelectedClass(classId);
    setError(null);
    setStep("confirm");
  }, []);

  const handleConfirm = useCallback(async () => {
    setError(null);
    startTransition(async () => {
      try {
        const result = await enterExamByNameAction({ token, firstName, lastName });
        if (result.ok) {
          onComplete(result);
        } else {
          onError(result.error ?? "Entry failed.", result.next);
        }
      } catch {
        onError("Entry failed.");
      }
    });
  }, [token, firstName, lastName, onComplete, onError]);

  if (!wizardData) {
    return (
      <div className="flex items-center justify-center py-12">
        <p className="text-sm text-muted-foreground" aria-live="polite">Loading exam options…</p>
      </div>
    );
  }

  return (
    <Card className="mx-auto max-w-lg">
      <CardHeader>
        <CardTitle>{wizardData.exam.title}</CardTitle>
        <CardDescription>
          Select your level, then your class, then confirm to enter.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {/* Step indicator */}
        <nav aria-label="Exam entry progress" className="mb-8">
          <ol className="flex items-center justify-center gap-2">
            {[
              { key: "level" as const, label: "Level" },
              { key: "class" as const, label: "Class" },
              { key: "confirm" as const, label: "Confirm" },
            ].map((item, index) => {
              const isActive = step === item.key;
              const isCompleted = (step === "class" && item.key === "level") ||
                (step === "confirm" && ["level", "class"].includes(item.key));
              return (
                <li key={item.key}>
                  <div className="flex items-center">
                    <span
                      className={cn(
                        "flex size-8 items-center justify-center rounded-full text-xs font-bold",
                        isActive && "ring-2 ring-primary ring-offset-2 bg-primary text-primary-foreground",
                        isCompleted && !isActive && "bg-emerald-600 text-white",
                        !isActive && !isCompleted && "bg-muted text-muted-foreground",
                      )}
                      aria-current={isActive ? "step" : undefined}
                    >
                      {isCompleted && !isActive ? "✓" : index + 1}
                    </span>
                    {index < 2 && (
                      <span className="hidden sm:block" aria-hidden="true">
                        <svg className="mx-1 size-3 text-muted-foreground" fill="currentColor" viewBox="0 0 12 12">
                          <path d="M3 1l6 5H0z" />
                        </svg>
                      </span>
                    )}
                  </div>
                  <span className={cn("block text-xs mt-1 text-center", isActive ? "font-semibold text-foreground" : "text-muted-foreground")}>
                    {item.label}
                  </span>
                </li>
              );
            })}
          </ol>
        </nav>

        {/* Step content */}
        <div
          ref={stepRef}
          tabIndex={-1}
          aria-label={`Step: ${step === "level" ? "Level selection" : step === "class" ? "Class selection" : "Confirmation"}`}
          role="group"
          aria-live="polite"
          className="outline-none"
        >
          {/* LEVEL STEP */}
          {step === "level" && (
            <div role="radiogroup" aria-label="Select your academic level">
              <p className="mb-4 text-sm font-medium">Select your level</p>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                {wizardData.levels.map((level) => (
                  <Button
                    key={level.id}
                    type="button"
                    variant={selectedLevel === level.id ? "default" : "outline"}
                    onClick={() => handleLevelSelect(level.id)}
                    className="min-h-[48px] justify-center text-base font-semibold"
                    aria-pressed={selectedLevel === level.id}
                    aria-label={`${level.name} — ordinal ${level.ordinal}`}
                  >
                    {level.name}
                  </Button>
                ))}
              </div>
            </div>
          )}

          {/* CLASS STEP */}
          {step === "class" && (
            <div role="radiogroup" aria-label="Select your class">
              <p className="mb-4 text-sm font-medium">
                {isPlacement
                  ? "Select your assigned placement track"
                  : "Select your class"}
              </p>
              {wizardData.enrolledClassId ? (
                <div className="rounded-lg bg-emerald-50 p-4 text-center dark:bg-emerald-950/30">
                  <p className="text-sm font-medium text-emerald-800 dark:text-emerald-200">
                    You are already enrolled in this exam&rsquo;s class.
                  </p>
                  <Button
                    className="mt-3 w-full"
                    onClick={() => handleClassSelect(wizardData.enrolledClassId!)}
                    aria-label="Confirm your enrolled class"
                  >
                    Confirm & continue
                  </Button>
                </div>
              ) : (
                <>
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    {availableClasses.map((cls) => (
                      <Button
                        key={cls.id}
                        type="button"
                        variant={selectedClass === cls.id ? "default" : "outline"}
                        onClick={() => handleClassSelect(cls.id)}
                        className="min-h-[48px] justify-center text-sm font-semibold"
                        aria-pressed={selectedClass === cls.id}
                        aria-label={`${cls.levelName} ${cls.track} Arm ${cls.arm}`}
                      >
                        <span>{cls.levelName}</span>
                        <span className="ml-2 text-xs opacity-70">
                          {cls.track} · Arm {cls.arm}
                        </span>
                      </Button>
                    ))}
                  </div>
                  {availableClasses.length === 0 && (
                    <Alert variant="destructive" role="alert">
                      <AlertTitle>No classes available</AlertTitle>
                      <AlertDescription>
                        Please ask your teacher for class assignment options.
                      </AlertDescription>
                    </Alert>
                  )}
                </>
              )}
            </div>
          )}

          {/* CONFIRM STEP */}
          {step === "confirm" && (
            <div aria-live="polite">
              {error ? (
                <Alert variant="destructive" role="alert" className="mb-4">
                  <AlertTitle>Entry failed</AlertTitle>
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              ) : null}
              <div className="rounded-lg bg-muted/40 p-4 text-sm">
                <p className="font-medium">
                  You are about to enter <strong>{wizardData.exam.title}</strong>.
                </p>
                {selectedClass && wizardData.classes.find((c) => c.id === selectedClass) && (
                  <p className="mt-1 text-muted-foreground">
                    Class: {wizardData.classes.find((c) => c.id === selectedClass)?.levelName}{" "}
                    {wizardData.classes.find((c) => c.id === selectedClass)?.track} Arm{" "}
                    {wizardData.classes.find((c) => c.id === selectedClass)?.arm}
                  </p>
                )}
              </div>
              <div className="mt-4 flex flex-col gap-2">
                <Button
                  onClick={handleConfirm}
                  disabled={pending}
                  className="w-full min-h-[48px]"
                  size="lg"
                  aria-busy={pending}
                >
                  {pending ? "Entering exam…" : "Enter exam"}
                </Button>
                <Button
                  variant="outline"
                  onClick={() => { setStep("class"); setError(null); }}
                  disabled={pending}
                  className="w-full min-h-[48px]"
                >
                  Go back
                </Button>
              </div>
            </div>
          )}
        </div>

        {/* Pending indicator */}
        {pending && (
          <p className="mt-4 text-center text-xs text-muted-foreground" aria-live="polite">
            Processing… please wait.
          </p>
        )}
      </CardContent>
    </Card>
  );
}
