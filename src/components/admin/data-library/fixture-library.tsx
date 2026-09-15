"use client";

import { BookOpenCheck, CheckCircle2, Database, GraduationCap, LoaderCircle, RefreshCw, School } from "lucide-react";
import { useSchoolDataLibrary } from "@/hooks/use-school-data-library";
import type { SchoolDataSource } from "@/app/actions/fixture-library";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";

interface DataSourceCard {
  source: SchoolDataSource;
  step: string;
  title: string;
  description: string;
  includes: string[];
  current: number;
  icon: typeof School;
  confirmation: string;
}

export function FixtureLibrary({ counts }: { counts: { subjects: number; classes: number; questions: number } }) {
  const { pending, activeSource, feedback, load } = useSchoolDataLibrary();
  const cards: DataSourceCard[] = [
    {
      source: "subjects",
      step: "1",
      title: "Subject curriculum",
      description: "Prepare the approved subject list and the curriculum rules for Science, Humanities and Business classes.",
      includes: ["Curriculum subjects", "Qualifier subjects", "Required and elective rules"],
      current: counts.subjects,
      icon: BookOpenCheck,
      confirmation: "This will update matching subjects and curriculum rules from the approved school data. Existing subject identities are reused where possible.",
    },
    {
      source: "academic-structure",
      step: "2",
      title: "Classes & academic structure",
      description: "Prepare the academic year, terms, SS1–SS3 levels, class arms and their subject offerings.",
      includes: ["Academic year and terms", "SS1, SS2 and SS3", "Class arms and subject offerings"],
      current: counts.classes,
      icon: GraduationCap,
      confirmation: "Load the subject curriculum first. This action updates the prepared academic structure and matching classes without removing unrelated school records.",
    },
    {
      source: "question-bank",
      step: "3",
      title: "Question bank",
      description: "Prepare the approved examination and qualifier questions after the subject curriculum is available.",
      includes: ["Senior-school questions", "Qualifier questions", "Academic-level links"],
      current: counts.questions,
      icon: Database,
      confirmation: "This updates prepared question-bank items. Questions authored by staff are protected and will not be replaced by this action.",
    },
  ];

  return (
    <div>
      {feedback ? (
        <div className={`mb-4 flex items-start gap-3 rounded-2xl border p-4 text-sm ${feedback.tone === "success" ? "border-emerald-200 bg-emerald-50 text-emerald-900" : "border-red-200 bg-red-50 text-red-900"}`} role="status">
          {feedback.tone === "success" ? <CheckCircle2 className="mt-0.5 size-4 shrink-0" /> : <span className="mt-1 size-2 shrink-0 rounded-full bg-red-600" />}
          <p className="leading-6">{feedback.message}</p>
        </div>
      ) : null}

      <div className="grid gap-4 xl:grid-cols-3">
        {cards.map((card) => {
          const Icon = card.icon;
          const running = pending && activeSource === card.source;
          return (
            <article key={card.source} className="flex min-h-full flex-col overflow-hidden rounded-3xl border border-neutral-200 bg-white shadow-sm">
              <div className="p-5">
                <div className="flex items-start justify-between gap-3">
                  <span className="grid size-11 place-items-center rounded-2xl bg-neutral-950 text-white"><Icon className="size-5" /></span>
                  <Badge variant="outline" className="rounded-full border-neutral-200 bg-neutral-50 text-neutral-600">Step {card.step}</Badge>
                </div>
                <h2 className="mt-5 font-display text-xl font-extrabold tracking-tight text-neutral-950">{card.title}</h2>
                <p className="mt-2 min-h-16 text-sm leading-6 text-neutral-500">{card.description}</p>

                <div className="mt-5 rounded-2xl bg-neutral-50 p-4">
                  <div className="flex items-end justify-between gap-3"><span className="text-xs font-semibold text-neutral-500">Currently available</span><strong className="font-display text-2xl text-neutral-950 tabular-nums">{card.current}</strong></div>
                  <Progress value={card.current > 0 ? 100 : 8} className="mt-3 h-1.5" />
                </div>

                <ul className="mt-5 space-y-2.5">
                  {card.includes.map((item) => <li key={item} className="flex items-center gap-2 text-xs text-neutral-600"><CheckCircle2 className="size-3.5 shrink-0 text-neutral-400" />{item}</li>)}
                </ul>
              </div>

              <div className="mt-auto border-t border-neutral-100 bg-neutral-50/70 p-4">
                <AlertDialog>
                  <AlertDialogTrigger render={<Button type="button" className="w-full rounded-xl" disabled={pending} />}>
                    {running ? <LoaderCircle className="size-4 animate-spin" /> : <RefreshCw className="size-4" />}
                    {running ? "Preparing…" : card.current > 0 ? "Refresh school data" : "Prepare school data"}
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Prepare {card.title.toLowerCase()}?</AlertDialogTitle>
                      <AlertDialogDescription>{card.confirmation}</AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                      <AlertDialogAction disabled={pending} onClick={() => load(card.source)}>Continue</AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
            </article>
          );
        })}
      </div>
    </div>
  );
}
