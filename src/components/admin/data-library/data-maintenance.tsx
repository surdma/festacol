"use client";

import { BookOpenCheck, CircleAlert, MessageCircleOff, RotateCcw, Trash2 } from "lucide-react";
import type { AdminDataScope } from "@/app/actions/admin-data-controls";
import { useSchoolDataMaintenance } from "@/hooks/use-school-data-maintenance";
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
import { Button } from "@/components/ui/button";

const CONTROLS: {
  scope: AdminDataScope;
  title: string;
  detail: string;
  preserved: string;
  confirm: string;
  success: string;
  icon: typeof Trash2;
}[] = [
  {
    scope: "sessions",
    title: "Remove examination sessions",
    detail: "Removes examination sessions together with the attempts recorded under them.",
    preserved: "The question bank, students, classes and staff remain unchanged.",
    confirm: "Remove examination sessions",
    success: "Examination sessions and their attempts were removed.",
    icon: BookOpenCheck,
  },
  {
    scope: "activity",
    title: "Clear examination attempts",
    detail: "Clears submitted and in-progress examination attempts so activity can begin afresh.",
    preserved: "Examination definitions and question-bank records remain available.",
    confirm: "Clear examination attempts",
    success: "Examination attempts were cleared.",
    icon: RotateCcw,
  },
  {
    scope: "whatsapp",
    title: "Clear class WhatsApp links",
    detail: "Removes the saved WhatsApp group links attached to classes.",
    preserved: "Classes, students and their school records remain unchanged.",
    confirm: "Clear WhatsApp links",
    success: "Class WhatsApp links were cleared.",
    icon: MessageCircleOff,
  },
  {
    scope: "custom-questions",
    title: "Remove staff-authored questions",
    detail: "Removes questions created by staff through the application.",
    preserved: "Prepared school question-bank items remain available.",
    confirm: "Remove staff-authored questions",
    success: "Staff-authored questions were removed.",
    icon: Trash2,
  },
];

export function DataMaintenance() {
  const { pending, activeScope, feedback, clear } = useSchoolDataMaintenance();

  return (
    <section className="overflow-hidden rounded-3xl border border-red-200 bg-white shadow-sm">
      <div className="flex flex-col gap-4 border-b border-red-100 bg-red-50/60 p-5 sm:flex-row sm:items-start sm:justify-between">
        <div className="max-w-3xl">
          <p className="text-[10px] font-bold uppercase tracking-[.14em] text-red-700">Maintenance</p>
          <h2 className="mt-1 font-display text-lg font-extrabold text-neutral-950">Clear selected school records</h2>
          <p className="mt-1 text-sm leading-6 text-neutral-600">These actions are for resetting specific operational records. Each action states what will be removed and what will remain.</p>
        </div>
        <span className="inline-flex w-fit items-center gap-2 rounded-full border border-red-200 bg-white px-3 py-1.5 text-xs font-bold text-red-700"><CircleAlert className="size-3.5" />Administrator only</span>
      </div>

      {feedback ? <div className={`m-5 rounded-2xl border p-4 text-sm ${feedback.tone === "error" ? "border-red-200 bg-red-50 text-red-900" : "border-emerald-200 bg-emerald-50 text-emerald-900"}`} role="status">{feedback.message}</div> : null}

      <div className="grid gap-px bg-neutral-200 md:grid-cols-2">
        {CONTROLS.map((control) => {
          const Icon = control.icon;
          const running = pending && activeScope === control.scope;
          return (
            <article key={control.scope} className="bg-white p-5">
              <span className="grid size-10 place-items-center rounded-xl bg-neutral-100 text-neutral-700"><Icon className="size-4" /></span>
              <h3 className="mt-4 text-sm font-bold text-neutral-950">{control.title}</h3>
              <p className="mt-2 text-xs leading-5 text-neutral-600">{control.detail}</p>
              <p className="mt-2 text-xs leading-5 text-neutral-400">{control.preserved}</p>
              <AlertDialog>
                <AlertDialogTrigger render={<Button type="button" variant="outline" disabled={pending} className="mt-4 rounded-xl border-red-200 text-red-700 hover:bg-red-50" />}>
                  <Trash2 className="size-4" />{running ? "Working…" : control.title}
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>{control.title}?</AlertDialogTitle>
                    <AlertDialogDescription>{control.detail} {control.preserved} This action cannot be reversed from this page.</AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction disabled={pending} onClick={() => clear(control.scope, control.success)}>{control.confirm}</AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </article>
          );
        })}
      </div>
    </section>
  );
}
