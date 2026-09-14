"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { getSubjectsAction, updateMySubjectsAction } from "@/app/actions/admin";

// Onboarding: a teacher with no subjects picks their major after the admin
// creates their account. Each chosen subject scopes their workspace.
export function MajorPicker() {
  const router = useRouter();
  const [catalog, setCatalog] = useState<string[]>([]);
  const [selected, setSelected] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    void getSubjectsAction().then((s) => setCatalog(s.length ? s : ["q-eng", "q-math", "q-bst", "q-social", "q-business", "q-digital"])).catch(() => undefined);
  }, []);

  return (
    <Card className="border-primary">
      <CardHeader>
        <CardTitle>Choose your major</CardTitle>
        <CardDescription>Pick the subject(s) you teach. Your exams, questions and records are scoped to them. You can update this anytime.</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <div className="flex flex-wrap gap-2">
          {catalog.map((s) => {
            const on = selected.includes(s);
            return (
              <Button key={s} type="button" size="sm" variant={on ? "default" : "outline"}
                onClick={() => setSelected(on ? selected.filter((x) => x !== s) : [...selected, s])}>{s}</Button>
            );
          })}
        </div>
        {error ? <p className="text-sm text-destructive" role="alert">{error}</p> : null}
        <div>
          <Button disabled={pending || !selected.length} onClick={() => startTransition(async () => {
            const r = await updateMySubjectsAction(selected);
            if (!r.ok) { setError(r.error ?? "Save failed."); return; }
            router.refresh();
          })}>{pending ? "Saving…" : "Save my subjects"}</Button>
        </div>
      </CardContent>
    </Card>
  );
}
