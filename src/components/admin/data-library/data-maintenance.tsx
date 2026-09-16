"use client";

import { BookOpenCheck, MessageCircleOff, RotateCcw, Trash2, TriangleAlert } from "lucide-react";
import type { AdminDataScope } from "@/app/actions/admin-data-controls";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
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
import { useSchoolDataMaintenance } from "@/hooks/use-school-data-maintenance";

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
    <section aria-labelledby="maintenance-actions-heading">
      <Alert variant="destructive" className="mb-4">
        <TriangleAlert />
        <AlertTitle>These actions remove production records</AlertTitle>
        <AlertDescription>Each operation is deliberately narrow, but it cannot be reversed from this interface. Read the preserved-data statement before continuing.</AlertDescription>
      </Alert>

      {feedback ? (
        <Alert variant={feedback.tone === "error" ? "destructive" : "default"} className="mb-4">
          <AlertTitle>{feedback.tone === "error" ? "Maintenance action failed" : "Maintenance action completed"}</AlertTitle>
          <AlertDescription>{feedback.message}</AlertDescription>
        </Alert>
      ) : null}

      <h2 id="maintenance-actions-heading" className="sr-only">Maintenance actions</h2>
      <div className="divide-y divide-border border-y border-border">
        {CONTROLS.map((control) => {
          const Icon = control.icon;
          const running = pending && activeScope === control.scope;
          return (
            <div key={control.scope} className="grid gap-4 px-1 py-5 sm:grid-cols-[2.25rem_minmax(0,1fr)_auto] sm:items-center sm:px-3">
              <span className="grid size-9 place-items-center rounded-lg border border-border bg-background text-muted-foreground">
                <Icon className="size-4" />
              </span>
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <strong className="text-sm font-semibold text-foreground">{control.title}</strong>
                  <Badge variant="destructive">Destructive</Badge>
                </div>
                <p className="mt-1 text-sm leading-5 text-muted-foreground">{control.detail}</p>
                <p className="mt-1 text-xs leading-5 text-muted-foreground"><span className="font-semibold text-foreground">Preserves:</span> {control.preserved}</p>
              </div>
              <AlertDialog>
                <AlertDialogTrigger render={<Button type="button" size="sm" variant="destructive" disabled={pending} />}>
                  <Trash2 data-icon="inline-start" />
                  {running ? "Working…" : "Run action"}
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
            </div>
          );
        })}
      </div>
    </section>
  );
}
