"use client";

import { Check, GraduationCap, School } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState, useTransition } from "react";
import {
  completeExamOnboardingAction,
  getExamOnboardingDataAction,
  type ExamOnboardingData,
} from "@/app/actions/exam-onboarding";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Spinner } from "@/components/ui/spinner";

function trackLabel(value: string) {
  if (value === "science") return "Science";
  if (value === "humanities") return "Art";
  if (value === "business") return "Commercial";
  return value.replaceAll("_", " ");
}

function classLabel(item: { levelName: string; track: string; arm: string }) {
  return `${item.levelName} ${trackLabel(item.track)} · Arm ${item.arm}`;
}

function deniedMessage(reason: string | null | undefined) {
  if (reason === "not_qualified") {
    return "This examination is for a different school level. Your confirmed class has not been changed.";
  }
  if (reason === "not_eligible") {
    return "This examination is not assigned to your confirmed class. Your school record is already complete.";
  }
  return "This examination is not available for your confirmed class. Your school record does not need another setup step.";
}

function LoadingInsert({ slowLoad }: { slowLoad: boolean }) {
  return (
    <main className="grid min-h-dvh place-items-center bg-muted/20 px-4 py-8">
      <section className="w-full max-w-2xl border-y border-dashed border-border bg-background px-6 py-9 text-center shadow-lg" aria-live="polite">
        <Spinner className="mx-auto size-6" />
        <h1 className="mt-5 font-serif text-3xl font-medium tracking-[-0.03em]">Opening your examination</h1>
        <output className="mt-3 block text-sm leading-6 text-muted-foreground">
          Festacol is checking the school record linked to this paper.
        </output>
        {slowLoad ? (
          <p className="mt-3 text-xs leading-5 text-muted-foreground">
            This is taking longer than usual. Keep this page open while the school record service responds.
          </p>
        ) : null}
      </section>
    </main>
  );
}

export function StudentWizard({
  token,
  denialReason = null,
}: {
  token: string;
  denialReason?: string | null;
}) {
  const router = useRouter();
  const [data, setData] = useState<ExamOnboardingData | null>(null);
  const [classId, setClassId] = useState("");
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
      if (result.data.enrollment) setClassId(result.data.enrollment.classId);
    });

    return () => {
      active = false;
    };
  }, [token]);

  useEffect(() => {
    const timeout = window.setTimeout(() => setSlowLoad(true), 8000);
    return () => window.clearTimeout(timeout);
  }, []);

  const selectedClass = useMemo(
    () => data?.classes.find((item) => item.id === classId) ?? null,
    [classId, data],
  );

  const ss1Level = useMemo(
    () => data?.levels.find((level) => level.name === "SS1") ?? null,
    [data],
  );

  const groupedClasses = useMemo(
    () =>
      (data?.levels ?? [])
        .map((level) => ({
          level,
          classes: (data?.classes ?? []).filter((item) => item.levelId === level.id),
        }))
        .filter((group) => group.classes.length > 0),
    [data],
  );

  if (!data && !error) return <LoadingInsert slowLoad={slowLoad} />;

  if (!data) {
    return (
      <main className="grid min-h-dvh place-items-center bg-muted/20 px-4 py-8">
        <section className="w-full max-w-2xl border-y border-dashed border-border bg-background px-6 py-9 shadow-lg sm:px-9">
          <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">Examination booklet insert</p>
          <h1 className="mt-4 font-serif text-3xl font-medium tracking-[-0.03em]">We cannot open the paper yet</h1>
          <Alert variant="destructive" className="mt-6">
            <AlertTitle>School record unavailable</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        </section>
      </main>
    );
  }

  const placementFlow = data.exam.mode === "qualifier" && !data.enrollment;
  const enrollmentClass = data.enrollment
    ? data.classes.find((item) => item.id === data.enrollment?.classId) ?? null
    : null;
  const chosenClass = enrollmentClass ?? selectedClass;
  const hasConfirmedClass = Boolean(data.enrollment);
  const qualifierWithConfirmedClass = data.exam.mode === "qualifier" && hasConfirmedClass;
  const canContinue = placementFlow ? Boolean(ss1Level) : Boolean(chosenClass);

  function returnToDashboard() {
    router.replace("/dashboard");
    router.refresh();
  }

  function submit() {
    if (hasConfirmedClass) {
      returnToDashboard();
      return;
    }

    const levelId = placementFlow ? ss1Level?.id : chosenClass?.levelId;
    if (!levelId) {
      setError(
        placementFlow
          ? "SS1 placement is not configured. Ask a staff member for help."
          : "Choose your class to continue.",
      );
      return;
    }

    setError(null);
    startTransition(async () => {
      const result = await completeExamOnboardingAction({
        token,
        levelId,
        classId: placementFlow ? null : chosenClass?.id ?? null,
        placementConsent: placementFlow,
      });

      if (!result.ok) {
        setError(
          result.error ??
            "Festacol could not confirm the school record. Ask a staff member for help if this continues.",
        );
        return;
      }

      if (result.next === "dashboard") {
        returnToDashboard();
        return;
      }

      if (result.next === "exam") {
        router.replace(`/exam?token=${encodeURIComponent(token)}`);
        router.refresh();
      }
    });
  }

  return (
    <main className="grid min-h-dvh place-items-center bg-muted/20 px-4 py-8 text-foreground">
      <section
        className="relative w-full max-w-4xl border-y-2 border-dashed border-border bg-background px-6 py-8 shadow-xl sm:px-9 lg:px-12"
        aria-labelledby="academic-insert-title"
      >
        <div className="pointer-events-none absolute inset-y-0 left-5 border-l border-dashed border-border/70 sm:left-7" aria-hidden="true" />
        <div className="pointer-events-none absolute inset-y-0 right-5 border-r border-dashed border-border/70 sm:right-7" aria-hidden="true" />

        <div className="mx-auto max-w-3xl">
          <div className="flex flex-wrap items-start justify-between gap-4 border-b border-border pb-5">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">Examination booklet insert</p>
              <h1 id="academic-insert-title" className="mt-2 font-serif text-2xl font-medium tracking-[-0.03em] sm:text-3xl">
                {data.exam.title}
              </h1>
            </div>
            <span className="font-mono text-xs font-semibold text-muted-foreground">02 / READY</span>
          </div>

          <div className="py-7">
            {qualifierWithConfirmedClass && chosenClass ? (
              <div className="grid gap-5 sm:grid-cols-[auto_minmax(0,1fr)] sm:items-start">
                <Check className="mt-1 size-5 text-muted-foreground" aria-hidden="true" />
                <div>
                  <h2 className="font-serif text-2xl font-medium tracking-[-0.02em]">Your class is already confirmed.</h2>
                  <p className="mt-2 text-sm leading-6 text-muted-foreground">
                    {classLabel(chosenClass)} is already on your school record, so you do not need this SS1 placement examination.
                  </p>
                </div>
              </div>
            ) : hasConfirmedClass && chosenClass ? (
              <div className="grid gap-5 sm:grid-cols-[auto_minmax(0,1fr)] sm:items-start">
                <School className="mt-1 size-5 text-muted-foreground" aria-hidden="true" />
                <div>
                  <h2 className="font-serif text-2xl font-medium tracking-[-0.02em]">Your class is already on your record.</h2>
                  <p className="mt-2 text-sm leading-6 text-muted-foreground">
                    {classLabel(chosenClass)} · {deniedMessage(denialReason)}
                  </p>
                </div>
              </div>
            ) : placementFlow ? (
              <div className="grid gap-5 sm:grid-cols-[auto_minmax(0,1fr)] sm:items-start">
                <GraduationCap className="mt-1 size-5 text-muted-foreground" aria-hidden="true" />
                <div>
                  <h2 className="font-serif text-2xl font-medium tracking-[-0.02em]">Continue to your SS1 placement examination.</h2>
                  <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
                    No level or pathway questionnaire is needed. Continue once, then the selected Ready to Write booklet opens before the examination starts.
                  </p>
                </div>
              </div>
            ) : (
              <FieldGroup>
                <Field data-invalid={Boolean(error)}>
                  <FieldLabel htmlFor="exam-class">Your class</FieldLabel>
                  <FieldDescription>
                    Choose the class you already belong to. This is the only school detail needed before Festacol checks the paper.
                  </FieldDescription>
                  <Select
                    value={classId}
                    onValueChange={(value) => {
                      setClassId(String(value));
                      setError(null);
                    }}
                  >
                    <SelectTrigger id="exam-class" className="mt-2 w-full" aria-invalid={Boolean(error)}>
                      <SelectValue placeholder="Choose your class" />
                    </SelectTrigger>
                    <SelectContent align="start">
                      {groupedClasses.map(({ level, classes }) => (
                        <SelectGroup key={level.id}>
                          <SelectLabel>{level.name}</SelectLabel>
                          {classes.map((item) => (
                            <SelectItem key={item.id} value={item.id}>
                              {classLabel(item)}
                            </SelectItem>
                          ))}
                        </SelectGroup>
                      ))}
                    </SelectContent>
                  </Select>
                  {!groupedClasses.length ? (
                    <FieldError>No active classes are configured. Ask a staff member for help.</FieldError>
                  ) : null}
                </Field>
              </FieldGroup>
            )}

            {error ? (
              <Alert variant="destructive" className="mt-6">
                <AlertTitle>Cannot continue yet</AlertTitle>
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            ) : null}
          </div>

          <div className="flex flex-col gap-4 border-t border-border pt-5 sm:flex-row sm:items-center sm:justify-between">
            <p className="max-w-xl text-xs leading-5 text-muted-foreground">
              {hasConfirmedClass
                ? "No academic change is being made here."
                : placementFlow
                  ? "Continuing grants access to this placement paper; the attempt begins later when you choose Start Examination."
                  : "Festacol saves the class once and immediately re-checks access to this examination."}
            </p>
            <Button
              type="button"
              size="lg"
              className="shrink-0"
              disabled={!hasConfirmedClass && (!canContinue || pending)}
              onClick={submit}
            >
              {pending ? <Spinner data-icon="inline-start" /> : hasConfirmedClass ? <Check data-icon="inline-start" /> : placementFlow ? <GraduationCap data-icon="inline-start" /> : <School data-icon="inline-start" />}
              {pending
                ? "Continuing…"
                : hasConfirmedClass
                  ? "Return to dashboard"
                  : placementFlow
                    ? "Continue to placement exam"
                    : "Continue to examination"}
            </Button>
          </div>
        </div>
      </section>
    </main>
  );
}
