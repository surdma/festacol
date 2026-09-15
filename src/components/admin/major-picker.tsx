"use client";

import { CheckCircle2, LoaderCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useTeachingSubjectSettings } from "@/hooks/use-teaching-subject-settings";

export function MajorPicker() {
  const { catalog, selected, loading, pending, error, saved, toggle, save } = useTeachingSubjectSettings();

  return (
    <Card className="overflow-hidden rounded-3xl border-neutral-200 bg-white shadow-sm">
      <CardHeader className="border-b border-neutral-100 bg-neutral-50/70">
        <CardTitle className="font-display text-xl font-extrabold text-neutral-950">Teaching subjects</CardTitle>
        <CardDescription className="max-w-2xl text-sm leading-6 text-neutral-500">Select the subjects that match your teaching qualification. Class responsibilities and examination assignments are still set separately by school administration.</CardDescription>
      </CardHeader>
      <CardContent className="p-5 sm:p-6">
        {loading ? (
          <div className="flex min-h-32 items-center justify-center gap-2 text-sm text-neutral-500"><LoaderCircle className="size-4 animate-spin" />Loading teaching subjects…</div>
        ) : catalog.length ? (
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {catalog.map((subject) => {
              const active = selected.includes(subject.id);
              return (
                <button
                  key={subject.id}
                  type="button"
                  aria-pressed={active}
                  className={`flex min-h-14 items-center justify-between gap-3 rounded-2xl border px-4 py-3 text-left text-sm font-semibold transition focus:outline-none focus:ring-4 focus:ring-neutral-200 ${active ? "border-neutral-950 bg-neutral-950 text-white shadow-sm" : "border-neutral-200 bg-white text-neutral-700 hover:border-neutral-400 hover:bg-neutral-50"}`}
                  onClick={() => toggle(subject.id)}
                >
                  <span>{subject.name}</span>
                  <span className={`grid size-6 shrink-0 place-items-center rounded-full ${active ? "bg-white text-neutral-950" : "border border-neutral-300 bg-neutral-50 text-transparent"}`}><CheckCircle2 className="size-3.5" /></span>
                </button>
              );
            })}
          </div>
        ) : (
          <div className="rounded-2xl border border-dashed border-neutral-300 bg-neutral-50 p-6 text-center text-sm text-neutral-500">No active subjects are available yet. Ask an administrator to prepare the subject curriculum.</div>
        )}

        {error ? <p className="mt-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800" role="alert">{error}</p> : null}
        {saved ? <p className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800" role="status">Your teaching subjects have been updated.</p> : null}

        <div className="mt-5 flex flex-col gap-3 border-t border-neutral-100 pt-5 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-xs text-neutral-500">{selected.length} subject{selected.length === 1 ? "" : "s"} selected</p>
          <Button type="button" disabled={pending || loading || selected.length === 0} className="rounded-xl" onClick={save}>{pending ? <><LoaderCircle className="size-4 animate-spin" />Saving…</> : "Save teaching subjects"}</Button>
        </div>
      </CardContent>
    </Card>
  );
}
