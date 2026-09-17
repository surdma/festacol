"use client";

import {
  BookOpenText,
  Check,
  GraduationCap,
  School,
  ShieldCheck,
} from "lucide-react";
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
  FieldLegend,
  FieldSet,
} from "@/components/ui/field";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Spinner } from "@/components/ui/spinner";

type PathChoice = "class" | "placement";

function trackLabel(value: string) {
  if (value === "science") return "Science";
  if (value === "humanities") return "Humanities";
  if (value === "business") return "Business";
  return value.replaceAll("_", " ");
}

function classLabel(item: {
  levelName: string;
  track: string;
  arm: string;
}) {
  return `${item.levelName} ${trackLabel(item.track)} · Arm ${item.arm}`;
}

function modeLabel(mode: string) {
  if (mode === "qualifier") return "Entrance / placement examination";
  if (mode === "single") return "Single-subject examination";
  if (mode === "mixed") return "Multi-subject examination";
  return mode.toUpperCase();
}

function formatAvailability(startsAt: number | null, endsAt: number | null) {
  if (!startsAt && !endsAt) return "Open examination window";
  if (startsAt && endsAt) {
    return `${new Date(startsAt).toLocaleString()} – ${new Date(endsAt).toLocaleString()}`;
  }
  if (startsAt) return `Opens ${new Date(startsAt).toLocaleString()}`;
  return `Closes ${new Date(endsAt ?? 0).toLocaleString()}`;
}

function LoadingBooklet({ slowLoad }: { slowLoad: boolean }) {
  return (
    <main className="min-h-dvh bg-muted/20 px-3 py-4 sm:px-5 sm:py-7 lg:px-8 lg:py-10">
      <div className="mx-auto w-full max-w-5xl">
        <div className="mb-5 flex items-center gap-3 px-1">
          <span className="grid size-10 place-items-center rounded-full border bg-background">
            <BookOpenText className="size-4" aria-hidden="true" />
          </span>
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
              Festacol examination booklet
            </p>
            <p className="mt-0.5 text-sm font-semibold">
              Preparing your academic record
            </p>
          </div>
        </div>

        <section className="overflow-hidden rounded-[1.75rem] border bg-background shadow-xl">
          <div className="grid min-h-[34rem] place-items-center px-6 py-12 text-center">
            <div className="flex max-w-md flex-col items-center gap-4">
              <Spinner className="size-7" />
              <div>
                <h1 className="font-serif text-3xl font-medium tracking-[-0.03em]">
                  One school detail may be needed
                </h1>
                <output className="mt-3 block text-sm leading-6 text-muted-foreground">
                  Festacol is checking your current class before opening the
                  examination booklet.
                </output>
              </div>
              {slowLoad ? (
                <p className="text-xs leading-5 text-muted-foreground">
                  This is taking longer than usual. Keep this page open while
                  the school record service responds.
                </p>
              ) : null}
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}

export function StudentWizard({ token }: { token: string }) {
  const router = useRouter();
  const [data, setData] = useState<ExamOnboardingData | null>(null);
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
    data &&
      !data.enrollment &&
      data.exam.mode === "qualifier" &&
      selectedLevel?.name === "SS1",
  );

  const effectivePath: PathChoice | "" = placementAvailable
    ? pathChoice
    : selectedLevel
      ? "class"
      : "";

  const canContinue = Boolean(
    data &&
      selectedLevel &&
      (data.enrollment ||
        effectivePath === "placement" ||
        (effectivePath === "class" && selectedClass)),
  );

  if (!data && !error) return <LoadingBooklet slowLoad={slowLoad} />;

  if (!data) {
    return (
      <main className="min-h-dvh bg-muted/20 px-3 py-4 sm:px-5 sm:py-7 lg:px-8 lg:py-10">
        <div className="mx-auto w-full max-w-3xl">
          <section className="rounded-[1.75rem] border bg-background p-6 shadow-xl sm:p-9">
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
              Festacol examination booklet
            </p>
            <h1 className="mt-4 font-serif text-3xl font-medium tracking-[-0.03em] sm:text-4xl">
              Your academic record needs attention
            </h1>
            <Alert variant="destructive" className="mt-6">
              <AlertTitle>We cannot continue yet</AlertTitle>
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          </section>
        </div>
      </main>
    );
  }

  const enrollmentLabel = data.enrollment
    ? classLabel({
        levelName: data.enrollment.levelName,
        track: data.enrollment.track,
        arm: data.enrollment.arm,
      })
    : null;

  const qualifierWithKnownClass =
    data.exam.mode === "qualifier" &&
    Boolean(data.enrollment || selectedClass) &&
    effectivePath === "class";

  function chooseLevel(nextLevelId: string) {
    setLevelId(nextLevelId);
    setClassId("");
    setPathChoice("");
    setError(null);
  }

  function choosePath(nextPath: PathChoice) {
    setPathChoice(nextPath);
    if (nextPath === "placement") setClassId("");
    setError(null);
  }

  function submit() {
    if (!selectedLevel) {
      setError("Choose your current school level.");
      return;
    }

    if (placementAvailable && !effectivePath) {
      setError(
        "Choose whether you already know your SS1 class or need the placement examination.",
      );
      return;
    }

    if (effectivePath === "class" && !selectedClass) {
      setError("Choose the class you currently belong to.");
      return;
    }

    setError(null);

    startTransition(async () => {
      const result = await completeExamOnboardingAction({
        token,
        levelId: selectedLevel.id,
        classId:
          effectivePath === "placement" ? null : selectedClass?.id ?? null,
        placementConsent: effectivePath === "placement",
      });

      if (!result.ok) {
        setError(
          result.error ??
            "Your academic record could not be confirmed. Ask a staff member for help if this continues.",
        );
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
    <main className="min-h-dvh bg-muted/20 px-3 py-4 text-foreground sm:px-5 sm:py-7 lg:px-8 lg:py-10">
      <div className="mx-auto w-full max-w-6xl">
        <header className="mb-4 flex flex-wrap items-center justify-between gap-3 px-1 sm:mb-6">
          <div className="flex items-center gap-3">
            <span className="grid size-10 place-items-center rounded-full border bg-background shadow-sm">
              <BookOpenText className="size-4" aria-hidden="true" />
            </span>
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                Festacol examination booklet
              </p>
              <p className="mt-0.5 text-sm font-semibold">
                Academic detail required
              </p>
            </div>
          </div>
          <p className="text-right text-xs leading-5 text-muted-foreground">
            {modeLabel(data.exam.mode)}
          </p>
        </header>

        <section
          aria-labelledby="academic-record-title"
          className="relative overflow-hidden rounded-[1.75rem] border bg-background shadow-xl"
        >
          <div
            className="pointer-events-none absolute inset-y-0 left-1/2 z-10 hidden w-px -translate-x-1/2 bg-border lg:block"
            aria-hidden="true"
          />
          <div
            className="pointer-events-none absolute inset-y-0 left-1/2 z-10 hidden w-10 -translate-x-1/2 bg-muted/30 lg:block"
            aria-hidden="true"
          />

          <div className="grid lg:grid-cols-2">
            <article className="relative flex min-h-[34rem] flex-col border-b bg-muted/15 p-5 sm:p-8 lg:min-h-[40rem] lg:border-b-0 lg:border-r lg:p-10">
              <div
                className="pointer-events-none absolute right-6 top-5 font-serif text-[8rem] leading-none text-foreground/[0.035]"
                aria-hidden="true"
              >
                02
              </div>

              <div className="relative">
                <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                  Before the paper opens
                </p>
                <h1
                  id="academic-record-title"
                  className="mt-5 max-w-lg font-serif text-4xl font-medium leading-[1.02] tracking-[-0.04em] sm:text-5xl"
                >
                  {data.exam.title}
                </h1>
                <p className="mt-4 max-w-lg text-sm leading-6 text-muted-foreground">
                  {data.enrollment
                    ? "Festacol found your confirmed class. It is read-only here; staff must make any class change."
                    : "Festacol needs one academic detail before it can confirm that this is the correct examination for you."}
                </p>
              </div>

              <dl className="relative mt-8 border-y border-border/80">
                <div className="grid grid-cols-[7rem_minmax(0,1fr)] gap-4 border-b py-3.5">
                  <dt className="text-xs font-medium uppercase tracking-[0.12em] text-muted-foreground">
                    Examination
                  </dt>
                  <dd className="text-sm font-semibold">{data.exam.title}</dd>
                </div>
                <div className="grid grid-cols-[7rem_minmax(0,1fr)] gap-4 border-b py-3.5">
                  <dt className="text-xs font-medium uppercase tracking-[0.12em] text-muted-foreground">
                    Type
                  </dt>
                  <dd className="text-sm font-semibold">
                    {modeLabel(data.exam.mode)}
                  </dd>
                </div>
                <div className="grid grid-cols-[7rem_minmax(0,1fr)] gap-4 py-3.5">
                  <dt className="text-xs font-medium uppercase tracking-[0.12em] text-muted-foreground">
                    Window
                  </dt>
                  <dd className="text-sm font-semibold">
                    {formatAvailability(
                      data.exam.startsAt,
                      data.exam.endsAt,
                    )}
                  </dd>
                </div>
              </dl>

              <div className="mt-auto pt-8">
                <div className="flex items-start gap-3 border-t border-dashed pt-5">
                  <ShieldCheck className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                  <p className="text-xs leading-5 text-muted-foreground">
                    Confirming this academic detail does not start an
                    examination attempt. Attempt allocation still happens only
                    when the examination booklet later shows{" "}
                    <strong className="font-semibold text-foreground">
                      Start Examination
                    </strong>
                    .
                  </p>
                </div>
              </div>
            </article>

            <article className="flex min-h-[34rem] flex-col p-5 sm:p-8 lg:min-h-[40rem] lg:p-10">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                  Academic insert
                </p>
                <h2 className="mt-4 font-serif text-3xl font-medium tracking-[-0.03em]">
                  {data.enrollment
                    ? "Your confirmed class"
                    : "Tell us where you belong"}
                </h2>
              </div>

              {data.enrollment ? (
                <div className="mt-7 border-y border-border/80 py-5">
                  <div className="flex items-start gap-3">
                    <span className="grid size-9 shrink-0 place-items-center rounded-full bg-foreground text-background">
                      <Check className="size-4" aria-hidden="true" />
                    </span>
                    <div>
                      <p className="text-sm font-semibold">{enrollmentLabel}</p>
                      <p className="mt-1 text-xs leading-5 text-muted-foreground">
                        This is already saved to your academic record. You
                        cannot transfer yourself to another class from this
                        examination link.
                      </p>
                    </div>
                  </div>
                </div>
              ) : (
                <FieldGroup className="mt-7">
                  <FieldSet>
                    <FieldLegend>Current academic level</FieldLegend>
                    <FieldDescription>
                      Choose the level you currently belong to.
                    </FieldDescription>
                    <RadioGroup
                      value={levelId}
                      onValueChange={(value) => chooseLevel(String(value))}
                    >
                      <div className="border-y border-border/80">
                        {data.levels.map((level) => (
                          <Field
                            key={level.id}
                            orientation="horizontal"
                            className="min-h-14 border-b py-3 last:border-b-0"
                          >
                            <RadioGroupItem
                              id={`ready-level-${level.id}`}
                              value={level.id}
                            />
                            <label
                              htmlFor={`ready-level-${level.id}`}
                              className="flex flex-1 cursor-pointer items-center justify-between gap-4"
                            >
                              <span className="text-sm font-semibold">
                                {level.name}
                              </span>
                              <span className="text-xs text-muted-foreground">
                                Senior secondary {level.ordinal}
                              </span>
                            </label>
                          </Field>
                        ))}
                      </div>
                    </RadioGroup>
                  </FieldSet>

                  {placementAvailable ? (
                    <FieldSet>
                      <FieldLegend>SS1 placement</FieldLegend>
                      <FieldDescription>
                        Choose the statement that matches your real school
                        situation.
                      </FieldDescription>
                      <RadioGroup
                        value={pathChoice}
                        onValueChange={(value) =>
                          choosePath(String(value) as PathChoice)
                        }
                      >
                        <div className="border-y border-border/80">
                          <Field
                            orientation="horizontal"
                            className="min-h-20 border-b py-4"
                          >
                            <RadioGroupItem
                              id="ready-path-class"
                              value="class"
                            />
                            <label
                              htmlFor="ready-path-class"
                              className="flex flex-1 cursor-pointer items-start gap-3"
                            >
                              <School className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                              <span>
                                <strong className="block text-sm">
                                  I already know my SS1 class
                                </strong>
                                <span className="mt-1 block text-xs leading-5 text-muted-foreground">
                                  Choose your real class. You will return to
                                  your dashboard instead of writing this
                                  placement examination.
                                </span>
                              </span>
                            </label>
                          </Field>
                          <Field
                            orientation="horizontal"
                            className="min-h-20 py-4"
                          >
                            <RadioGroupItem
                              id="ready-path-placement"
                              value="placement"
                            />
                            <label
                              htmlFor="ready-path-placement"
                              className="flex flex-1 cursor-pointer items-start gap-3"
                            >
                              <GraduationCap className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                              <span>
                                <strong className="block text-sm">
                                  I need the SS1 placement examination
                                </strong>
                                <span className="mt-1 block text-xs leading-5 text-muted-foreground">
                                  Choose this only if you are entering SS1 and
                                  have not yet been placed into Science,
                                  Humanities or Business.
                                </span>
                              </span>
                            </label>
                          </Field>
                        </div>
                      </RadioGroup>
                    </FieldSet>
                  ) : null}

                  {selectedLevel &&
                  effectivePath === "class" ? (
                    <FieldSet>
                      <FieldLegend>{selectedLevel.name} class</FieldLegend>
                      <FieldDescription>
                        Choose the class you currently belong to.
                      </FieldDescription>
                      <RadioGroup
                        value={classId}
                        onValueChange={(value) => {
                          setClassId(String(value));
                          setError(null);
                        }}
                      >
                        <div className="border-y border-border/80">
                          {availableClasses.map((item) => (
                            <Field
                              key={item.id}
                              orientation="horizontal"
                              className="min-h-16 border-b py-3.5 last:border-b-0"
                            >
                              <RadioGroupItem
                                id={`ready-class-${item.id}`}
                                value={item.id}
                              />
                              <label
                                htmlFor={`ready-class-${item.id}`}
                                className="flex flex-1 cursor-pointer items-center justify-between gap-4"
                              >
                                <span className="text-sm font-semibold">
                                  {classLabel(item)}
                                </span>
                                <span className="text-xs text-muted-foreground">
                                  {trackLabel(item.track)}
                                </span>
                              </label>
                            </Field>
                          ))}
                        </div>
                      </RadioGroup>
                      {!availableClasses.length ? (
                        <FieldError>
                          No active classes are configured for this level. Ask
                          a staff member for help.
                        </FieldError>
                      ) : null}
                    </FieldSet>
                  ) : null}

                  {effectivePath === "placement" ? (
                    <Alert>
                      <GraduationCap />
                      <AlertTitle>One placement attempt</AlertTitle>
                      <AlertDescription>
                        You are confirming that you are entering SS1 without a
                        confirmed Science, Humanities or Business class. After
                        a submitted placement attempt, only a teacher or
                        administrator can grant a retake.
                      </AlertDescription>
                    </Alert>
                  ) : null}
                </FieldGroup>
              )}

              {qualifierWithKnownClass ? (
                <Alert className="mt-5">
                  <School />
                  <AlertTitle>No placement examination is needed</AlertTitle>
                  <AlertDescription>
                    Because you already have a class, confirming this record
                    returns you to your dashboard instead of opening the
                    placement paper.
                  </AlertDescription>
                </Alert>
              ) : null}

              {error ? (
                <Alert variant="destructive" className="mt-5">
                  <AlertTitle>We need one correction</AlertTitle>
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              ) : null}

              <div className="mt-auto pt-7">
                <p className="border-t border-dashed pt-5 text-xs leading-5 text-muted-foreground">
                  Once an initial class is confirmed, a staff member must make
                  any later class change. Festacol will re-check examination
                  access after this confirmation.
                </p>
              </div>
            </article>
          </div>

          <footer className="border-t border-dashed bg-foreground px-5 py-4 text-background sm:px-8 lg:px-10">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-sm font-semibold">
                  {effectivePath === "placement"
                    ? "Confirm placement and open the Ready to Write booklet"
                    : qualifierWithKnownClass
                      ? "Confirm your academic record"
                      : "Confirm your class and continue"}
                </p>
                <p className="mt-0.5 text-xs leading-5 text-background/70">
                  Your selection is checked and saved by the school record
                  service before Festacol continues.
                </p>
              </div>
              <Button
                type="button"
                size="lg"
                variant="secondary"
                className="min-h-12 shrink-0 px-6 font-semibold"
                disabled={!canContinue || pending}
                onClick={submit}
              >
                {pending ? (
                  <>
                    <Spinner data-icon="inline-start" />
                    Saving record…
                  </>
                ) : effectivePath === "placement" ? (
                  <>
                    <GraduationCap data-icon="inline-start" />
                    Confirm placement
                  </>
                ) : qualifierWithKnownClass ? (
                  <>
                    <School data-icon="inline-start" />
                    Confirm and continue
                  </>
                ) : (
                  <>
                    <Check data-icon="inline-start" />
                    Confirm and continue
                  </>
                )}
              </Button>
            </div>
          </footer>
        </section>
      </div>
    </main>
  );
}
