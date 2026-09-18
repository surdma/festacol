"use client";

import { CheckCircle2, LoaderCircle, Save, Search } from "lucide-react";
import { useMemo, useState } from "react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from "@/components/ui/empty";
import { InputGroup, InputGroupAddon, InputGroupInput } from "@/components/ui/input-group";
import { useTeachingSubjectSettings } from "@/hooks/use-teaching-subject-settings";
import { cn } from "@/lib/utils";

export function MajorPicker() {
  const { catalog, selected, loading, pending, error, saved, toggle, save } = useTeachingSubjectSettings();
  const [query, setQuery] = useState("");
  const filtered = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) return catalog;
    return catalog.filter((subject) => subject.name.toLowerCase().includes(normalized));
  }, [catalog, query]);

  return (
    <section aria-labelledby="qualification-heading" className="border-y border-border bg-background">
      <div className="flex flex-col gap-4 border-b border-border px-1 py-5 sm:flex-row sm:items-end sm:justify-between sm:px-3">
        <div className="max-w-2xl">
          <p className="text-[10px] font-bold uppercase tracking-[.14em] text-muted-foreground">Editable qualification scope</p>
          <h2 id="qualification-heading" className="mt-1 font-display text-lg font-extrabold text-foreground">Subjects you are qualified to teach</h2>
          <p className="mt-1 text-sm leading-6 text-muted-foreground">These subjects define your normal workspace scope across examinations, question bank, reports and activity. Entrance and placement examinations are always available separately.</p>
        </div>
        <Badge variant="outline">{selected.length} selected</Badge>
      </div>

      <div className="border-b border-border px-1 py-4 sm:px-3">
        <InputGroup className="h-10 max-w-md">
          <InputGroupAddon>
            <Search />
          </InputGroupAddon>
          <InputGroupInput value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Find a subject…" aria-label="Find a subject" />
        </InputGroup>
      </div>

      {loading ? (
        <div className="flex min-h-48 items-center justify-center gap-2 text-sm text-muted-foreground">
          <LoaderCircle className="size-4 animate-spin" />
          Loading teaching subjects…
        </div>
      ) : filtered.length ? (
        <div className="max-h-[440px] divide-y divide-border overflow-y-auto">
          {filtered.map((subject) => {
            const active = selected.includes(subject.id);
            return (
              <button
                key={subject.id}
                type="button"
                aria-pressed={active}
                className="group flex w-full items-center gap-4 px-1 py-4 text-left transition-colors hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-ring/30 sm:px-3"
                onClick={() => toggle(subject.id)}
              >
                <span
                  className={cn(
                    "grid size-6 shrink-0 place-items-center rounded-full border transition-colors",
                    active ? "border-foreground bg-foreground text-background" : "border-border bg-background text-transparent",
                  )}
                >
                  <CheckCircle2 className="size-3.5" />
                </span>
                <span className="min-w-0 flex-1">
                  <strong className="block truncate text-sm font-semibold text-foreground">{subject.name}</strong>
                  <span className="mt-0.5 block text-xs text-muted-foreground">{active ? "Available across your teaching workspace" : "Hidden from your normal teaching workspace"}</span>
                </span>
                <Badge variant={active ? "secondary" : "outline"}>{active ? "Selected" : "Available"}</Badge>
              </button>
            );
          })}
        </div>
      ) : (
        <Empty className="min-h-48 border-0">
          <EmptyHeader>
            <EmptyTitle>{catalog.length ? "No matching subjects" : "No active subjects"}</EmptyTitle>
            <EmptyDescription>{catalog.length ? "Try another subject name." : "Ask an administrator to prepare the subject curriculum first."}</EmptyDescription>
          </EmptyHeader>
        </Empty>
      )}

      {error ? (
        <div className="border-t border-border p-4">
          <Alert variant="destructive">
            <AlertTitle>Teaching subjects were not updated</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        </div>
      ) : null}
      {saved ? (
        <div className="border-t border-border p-4">
          <Alert>
            <AlertTitle>Teaching subjects updated</AlertTitle>
            <AlertDescription>Your examinations, question bank, reports and activity now follow the selected subjects.</AlertDescription>
          </Alert>
        </div>
      ) : null}

      <div className="flex flex-col gap-3 border-t border-border bg-muted/20 px-1 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-3">
        <p className="text-xs leading-5 text-muted-foreground">Saving immediately refreshes your subject-scoped workspace. Placement and entrance exams remain available.</p>
        <Button type="button" disabled={pending || loading || selected.length === 0} onClick={save}>
          {pending ? <LoaderCircle data-icon="inline-start" className="animate-spin" /> : <Save data-icon="inline-start" />}
          {pending ? "Saving…" : "Save qualifications"}
        </Button>
      </div>
    </section>
  );
}
