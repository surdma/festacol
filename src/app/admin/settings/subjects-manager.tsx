"use client";

import { BookOpenCheck, LoaderCircle, Plus } from "lucide-react";
import { adminPrimaryButtonClass, adminSecondaryButtonClass, adminSurfaceClass } from "@/components/admin/admin-ui";
import { StatusBadge } from "@/components/status-badge";
import { Button } from "@/components/ui/button";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { useSubjectCatalogSettings, type SubjectSettingsRow } from "@/hooks/use-subject-catalog-settings";

const inputClass = "h-11 rounded-lg border-neutral-300 bg-white text-neutral-950 focus-visible:border-black focus-visible:ring-black/20";

export function SubjectsManager({ initial }: { initial: SubjectSettingsRow[] }) {
  const { name, setName, pending, feedback, addSubject, toggleSubject, loadPreparedCurriculum } = useSubjectCatalogSettings();
  const activeCount = initial.filter((subject) => subject.active).length;

  return (
    <section className={`${adminSurfaceClass} overflow-hidden`}>
      <div className="flex flex-col gap-4 border-b border-neutral-200 bg-neutral-50/60 p-5 sm:flex-row sm:items-center sm:justify-between">
        <div className="max-w-2xl">
          <p className="text-[10px] font-bold uppercase tracking-[.14em] text-neutral-500">Subject catalogue</p>
          <h2 className="mt-1 font-display text-lg font-extrabold text-neutral-950">Subjects taught in the school</h2>
          <p className="mt-1 text-xs leading-5 text-neutral-500">Keep the school subject list current. The prepared curriculum also carries the study-track rules used when class subjects are created.</p>
        </div>
        <Button type="button" variant="outline" disabled={pending} className={adminSecondaryButtonClass} onClick={loadPreparedCurriculum}>
          {pending ? <LoaderCircle className="size-4 animate-spin" /> : <BookOpenCheck className="size-4" />}Refresh prepared curriculum
        </Button>
      </div>

      <div className="border-b border-neutral-100 px-5 py-3 text-xs text-neutral-500"><strong className="text-neutral-950">{activeCount}</strong> active of {initial.length} listed subjects</div>

      {feedback ? <div className={`m-5 rounded-xl border p-3 text-sm ${feedback.tone === "error" ? "border-red-200 bg-red-50 text-red-800" : "border-emerald-200 bg-emerald-50 text-emerald-800"}`} role="status">{feedback.message}</div> : null}

      <div className="grid lg:grid-cols-[minmax(0,1.5fr)_minmax(320px,.75fr)]">
        <div className="max-h-[560px] overflow-auto border-b border-neutral-200 lg:border-b-0 lg:border-r">
          {initial.length ? (
            <div className="divide-y divide-neutral-100">
              {initial.map((subject) => (
                <div key={subject.id} className="flex items-center justify-between gap-3 p-4 transition hover:bg-neutral-50/80">
                  <div className="min-w-0"><strong className="block truncate text-sm text-neutral-950">{subject.name}</strong><span className="mt-1 block text-[11px] text-neutral-500">School subject</span></div>
                  <div className="flex shrink-0 items-center gap-2">
                    <StatusBadge tone={subject.active ? "emerald" : "neutral"}>{subject.active ? "active" : "inactive"}</StatusBadge>
                    <Button size="sm" variant="outline" disabled={pending} className="rounded-lg" onClick={() => toggleSubject(subject)}>{subject.active ? "Make inactive" : "Make active"}</Button>
                  </div>
                </div>
              ))}
            </div>
          ) : <div className="p-7 text-center"><BookOpenCheck className="mx-auto size-5 text-neutral-400" /><p className="mt-3 text-sm font-semibold text-neutral-800">No subjects listed yet</p><p className="mt-1 text-xs text-neutral-500">Refresh the prepared curriculum or add the first subject.</p></div>}
        </div>

        <div className="p-5">
          <p className="text-[10px] font-bold uppercase tracking-[.14em] text-neutral-500">Add subject</p>
          <h3 className="mt-1 font-display text-base font-extrabold text-neutral-950">Add to the school catalogue</h3>
          <p className="mt-1 text-xs leading-5 text-neutral-500">Use this for an additional subject that is not already in the prepared curriculum.</p>
          <FieldGroup className="mt-4">
            <Field><FieldLabel htmlFor="s-name">Subject name</FieldLabel><Input id="s-name" className={inputClass} value={name} onChange={(event) => setName(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") { event.preventDefault(); addSubject(); } }} placeholder="e.g. Further Mathematics" /></Field>
            <Button type="button" disabled={pending || !name.trim()} className={adminPrimaryButtonClass} onClick={addSubject}>{pending ? <LoaderCircle className="size-4 animate-spin" /> : <Plus className="size-4" />}{pending ? "Saving…" : "Add subject"}</Button>
          </FieldGroup>
        </div>
      </div>
    </section>
  );
}
