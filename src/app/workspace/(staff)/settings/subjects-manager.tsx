"use client";

import { BookOpenCheck, LoaderCircle, Plus, Search } from "lucide-react";
import { useMemo, useState } from "react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { Field, FieldDescription, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { InputGroup, InputGroupAddon, InputGroupInput } from "@/components/ui/input-group";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { useSubjectCatalogSettings, type SubjectSettingsRow } from "@/hooks/use-subject-catalog-settings";

export function SubjectsManager({ initial }: { initial: SubjectSettingsRow[] }) {
  const { name, setName, pending, feedback, addSubject, toggleSubject, loadPreparedCurriculum } = useSubjectCatalogSettings();
  const [query, setQuery] = useState("");
  const activeCount = initial.filter((subject) => subject.active).length;
  const filtered = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) return initial;
    return initial.filter((subject) => subject.name.toLowerCase().includes(normalized));
  }, [initial, query]);

  return (
    <section id="subjects" aria-labelledby="subjects-heading" className="scroll-mt-24 border-y border-border bg-background">
      <div className="flex flex-col gap-4 border-b border-border px-1 py-5 sm:flex-row sm:items-end sm:justify-between sm:px-3">
        <div className="max-w-2xl">
          <p className="text-[10px] font-bold uppercase tracking-[.14em] text-muted-foreground">Subject catalogue</p>
          <h2 id="subjects-heading" className="mt-1 font-display text-lg font-extrabold text-foreground">School subjects</h2>
          <p className="mt-1 text-sm leading-6 text-muted-foreground">Subjects are canonical records. Curriculum rules determine which level and study track may offer each subject.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="outline" disabled={pending} onClick={loadPreparedCurriculum}>
            {pending ? <LoaderCircle data-icon="inline-start" className="animate-spin" /> : <BookOpenCheck data-icon="inline-start" />}
            Refresh prepared curriculum
          </Button>
          <Sheet>
            <SheetTrigger render={<Button type="button" />}>
              <Plus data-icon="inline-start" />
              Add subject
            </SheetTrigger>
            <SheetContent className="data-[side=right]:w-[min(92vw,430px)] data-[side=right]:sm:max-w-[430px]">
              <SheetHeader>
                <SheetTitle>Add school subject</SheetTitle>
                <SheetDescription>Add a canonical subject record when it is not already supplied by the prepared curriculum fixture.</SheetDescription>
              </SheetHeader>
              <div className="px-4">
                <FieldGroup>
                  <Field>
                    <FieldLabel htmlFor="subject-name">Subject name</FieldLabel>
                    <Input
                      id="subject-name"
                      value={name}
                      onChange={(event) => setName(event.target.value)}
                      onKeyDown={(event) => {
                        if (event.key === "Enter") {
                          event.preventDefault();
                          addSubject();
                        }
                      }}
                      placeholder="e.g. Further Mathematics"
                    />
                    <FieldDescription>Class offerings can reference the subject only after its curriculum relationship is configured.</FieldDescription>
                  </Field>
                </FieldGroup>
              </div>
              <SheetFooter>
                <Button type="button" disabled={pending || !name.trim()} onClick={addSubject}>
                  {pending ? <LoaderCircle data-icon="inline-start" className="animate-spin" /> : <Plus data-icon="inline-start" />}
                  {pending ? "Saving…" : "Add subject"}
                </Button>
              </SheetFooter>
            </SheetContent>
          </Sheet>
        </div>
      </div>

      <div className="flex flex-col gap-3 border-b border-border px-1 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-3">
        <div className="flex flex-wrap gap-2">
          <Badge variant="secondary">{activeCount} active</Badge>
          <Badge variant="outline">{initial.length - activeCount} inactive</Badge>
          <Badge variant="outline">{initial.length} total</Badge>
        </div>
        <InputGroup className="h-10 w-full sm:max-w-sm">
          <InputGroupAddon><Search /></InputGroupAddon>
          <InputGroupInput value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search subjects…" aria-label="Search subjects" />
        </InputGroup>
      </div>

      {feedback ? (
        <div className="border-b border-border p-4">
          <Alert variant={feedback.tone === "error" ? "destructive" : "default"}>
            <AlertTitle>{feedback.tone === "error" ? "Subject catalogue was not updated" : "Subject catalogue updated"}</AlertTitle>
            <AlertDescription>{feedback.message}</AlertDescription>
          </Alert>
        </div>
      ) : null}

      {filtered.length ? (
        <div className="max-h-[560px] divide-y divide-border overflow-y-auto">
          {filtered.map((subject) => (
            <div key={subject.id} className="grid gap-3 px-1 py-4 transition-colors hover:bg-muted/35 sm:grid-cols-[minmax(0,1fr)_auto_auto] sm:items-center sm:px-3">
              <div className="min-w-0">
                <strong className="block truncate text-sm font-semibold text-foreground">{subject.name}</strong>
                <span className="mt-1 block text-xs text-muted-foreground">Canonical school subject</span>
              </div>
              <Badge variant={subject.active ? "secondary" : "outline"}>{subject.active ? "Active" : "Inactive"}</Badge>
              <Button size="sm" variant="outline" disabled={pending} onClick={() => toggleSubject(subject)}>
                {subject.active ? "Make inactive" : "Make active"}
              </Button>
            </div>
          ))}
        </div>
      ) : (
        <Empty className="min-h-52 border-0">
          <EmptyHeader>
            <EmptyMedia variant="icon"><BookOpenCheck /></EmptyMedia>
            <EmptyTitle>{initial.length ? "No matching subjects" : "No subjects configured"}</EmptyTitle>
            <EmptyDescription>{initial.length ? "Try another subject name." : "Refresh the prepared curriculum or add the first subject."}</EmptyDescription>
          </EmptyHeader>
        </Empty>
      )}
    </section>
  );
}
