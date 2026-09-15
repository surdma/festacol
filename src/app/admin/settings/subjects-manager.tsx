"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toggleSubjectAction, upsertSubjectAction } from "@/app/actions/admin";
import { seedSubjectCatalogFromBankAction } from "@/app/actions/seed-bank";
import { adminPrimaryButtonClass, adminSecondaryButtonClass, adminSurfaceClass } from "@/components/admin/admin-ui";
import { StatusBadge } from "@/components/status-badge";
import { Button } from "@/components/ui/button";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";

interface Subject { id: string; name: string; active: boolean }
const inputClass = "h-11 rounded-lg border-neutral-300 bg-white text-neutral-950 focus-visible:border-black focus-visible:ring-black/20";

export function SubjectsManager({ initial }: { initial: Subject[] }) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function run(fn: () => Promise<{ ok: boolean; error?: string }>, reset = false) {
    setError(null);
    startTransition(async () => {
      const result = await fn();
      if (!result.ok) { setError(result.error ?? "Failed."); return; }
      if (reset) setName("");
      router.refresh();
    });
  }

  return (
    <section className={`${adminSurfaceClass} overflow-hidden`}>
      <div className="flex flex-col gap-3 border-b border-neutral-200 p-5 sm:flex-row sm:items-center sm:justify-between">
        <div><p className="text-[10px] font-bold uppercase tracking-[.14em] text-neutral-500">Curriculum</p><h2 className="mt-1 font-display text-lg font-extrabold text-neutral-950">Subject catalog</h2><p className="mt-1 text-xs text-neutral-500">Subjects are canonical records. Programme/class participation is configured through class subject offerings, not subject codes or pathway arrays.</p></div>
        <Button type="button" variant="outline" disabled={pending} className={adminSecondaryButtonClass} onClick={() => run(seedSubjectCatalogFromBankAction)}>Load bank subjects</Button>
      </div>

      <div className="grid lg:grid-cols-[minmax(0,1.5fr)_minmax(320px,.75fr)]">
        <div className="max-h-[520px] overflow-auto border-b border-neutral-200 lg:border-b-0 lg:border-r">
          {initial.length ? <div className="divide-y divide-neutral-100">{initial.map((subject) => <div key={subject.id} className="flex items-center justify-between gap-3 p-4"><div className="min-w-0"><strong className="block truncate text-sm text-neutral-950">{subject.name}</strong><span className="mt-1 block text-[11px] text-neutral-500">Canonical subject</span></div><div className="flex shrink-0 items-center gap-2"><StatusBadge tone={subject.active ? "emerald" : "neutral"}>{subject.active ? "active" : "off"}</StatusBadge><Button size="sm" variant="outline" disabled={pending} className="rounded-lg" onClick={() => run(() => toggleSubjectAction(subject.id, !subject.active))}>{subject.active ? "Disable" : "Enable"}</Button></div></div>)}</div> : <p className="p-6 text-sm text-neutral-500">Empty. Load the bank subjects or add the first subject.</p>}
        </div>

        <div className="p-5">
          <p className="text-[10px] font-bold uppercase tracking-[.14em] text-neutral-500">Add subject</p>
          <h3 className="mt-1 font-display text-base font-extrabold text-neutral-950">New curriculum record</h3>
          <FieldGroup className="mt-4">
            <Field><FieldLabel htmlFor="s-name">Name</FieldLabel><Input id="s-name" className={inputClass} value={name} onChange={(event) => setName(event.target.value)} placeholder="e.g. Further Mathematics" /></Field>
            {error ? <p className="text-sm text-destructive" role="alert">{error}</p> : null}
            <Button type="button" disabled={pending || !name.trim()} className={adminPrimaryButtonClass} onClick={() => run(() => upsertSubjectAction({ name }), true)}>{pending ? "Saving…" : "Add subject"}</Button>
          </FieldGroup>
        </div>
      </div>
    </section>
  );
}
