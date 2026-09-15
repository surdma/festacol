"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { StatusBadge } from "@/components/status-badge";
import { seedSubjectsAction, toggleSubjectAction, upsertSubjectAction } from "@/app/actions/admin";

interface Subject {
  code: string; name: string; category: string; streams: string[]; active: boolean;
}

const CATEGORIES = ["core", "science", "art", "commercial", "legacy"];
const STREAMS = ["Science", "Art", "Commercial"];

export function SubjectsManager({ initial }: { initial: Subject[] }) {
  const router = useRouter();
  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [category, setCategory] = useState("science");
  const [streams, setStreams] = useState<string[]>(["Science"]);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function run(fn: () => Promise<{ ok: boolean; error?: string }>) {
    setError(null);
    startTransition(async () => {
      const r = await fn();
      if (!r.ok) setError(r.error ?? "Failed.");
      else router.refresh();
    });
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>Subject catalog ({initial.filter((s) => s.active).length} active)</CardTitle>
        <Button size="sm" variant="outline" disabled={pending} onClick={() => run(seedSubjectsAction)}>Seed WAEC catalog</Button>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <div className="flex max-h-72 flex-col gap-1 overflow-auto text-sm">
          {initial.map((s) => (
            <p key={s.code} className="flex items-center justify-between gap-2 border-b py-1.5">
              <span><span className="font-medium">{s.name}</span> <span className="font-mono text-xs text-muted-foreground">{s.code} · {s.category} · {(s.streams ?? []).join("/") || "—"}</span></span>
              <span className="flex items-center gap-2">
                <StatusBadge tone={s.active ? "emerald" : "neutral"}>{s.active ? "active" : "off"}</StatusBadge>
                <Button size="sm" variant="ghost" disabled={pending} onClick={() => run(() => toggleSubjectAction(s.code, !s.active))}>
                  {s.active ? "Disable" : "Enable"}
                </Button>
              </span>
            </p>
          ))}
          {initial.length === 0 ? <p className="text-muted-foreground">Empty — seed the WAEC catalog to begin.</p> : null}
        </div>
        <FieldGroup>
          <div className="grid grid-cols-2 gap-3">
            <Field><FieldLabel htmlFor="s-code">Code</FieldLabel><Input id="s-code" value={code} onChange={(e) => setCode(e.target.value)} placeholder="e.g. phy" /></Field>
            <Field><FieldLabel htmlFor="s-name">Name</FieldLabel><Input id="s-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Physics" /></Field>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field><FieldLabel htmlFor="s-cat">Category</FieldLabel>
              <NativeSelect id="s-cat" value={category} onChange={(e) => setCategory(e.target.value)}>
                {CATEGORIES.map((c) => <NativeSelectOption key={c} value={c}>{c}</NativeSelectOption>)}
              </NativeSelect></Field>
            <Field><FieldLabel>Streams</FieldLabel>
              <div className="flex gap-2">
                {STREAMS.map((s) => (
                  <Button key={s} type="button" size="sm" variant={streams.includes(s) ? "default" : "outline"}
                    onClick={() => setStreams(streams.includes(s) ? streams.filter((x) => x !== s) : [...streams, s])}>{s}</Button>
                ))}
              </div></Field>
          </div>
          {error ? <p className="text-sm text-destructive" role="alert">{error}</p> : null}
          <div><Button disabled={pending} onClick={() => run(() => upsertSubjectAction({ code, name, category, streams }))}>Add subject</Button></div>
        </FieldGroup>
      </CardContent>
    </Card>
  );
}
