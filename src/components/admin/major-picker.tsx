"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { getSubjectCatalogAction } from "@/app/actions/admin-parity";
import { getMyScopeAction, updateMySubjectsAction } from "@/app/actions/admin";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export function MajorPicker() {
  const router = useRouter();
  const [catalog, setCatalog] = useState<{ id: string; name: string }[]>([]);
  const [selected, setSelected] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    void Promise.all([getSubjectCatalogAction(), getMyScopeAction()])
      .then(([subjects, scope]) => {
        setCatalog(subjects);
        setSelected(scope.subjectIds);
      })
      .catch(() => setError("Teaching-subject data could not be loaded."));
  }, []);

  return (
    <Card className="border-neutral-800 bg-neutral-950 text-white">
      <CardHeader>
        <CardTitle>Teaching subject qualifications</CardTitle>
        <CardDescription className="text-neutral-400">These subjects define what question banks you may access. Actual class and exam access still requires a teaching or exam assignment.</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <div className="flex max-h-56 flex-wrap gap-2 overflow-auto">
          {catalog.map((subject) => {
            const active = selected.includes(subject.id);
            return (
              <Button
                key={subject.id}
                type="button"
                size="sm"
                variant={active ? "secondary" : "outline"}
                className={active ? "" : "border-neutral-700 bg-transparent text-neutral-300 hover:bg-neutral-900 hover:text-white"}
                onClick={() => setSelected(active ? selected.filter((id) => id !== subject.id) : [...selected, subject.id])}
              >
                {subject.name}
              </Button>
            );
          })}
        </div>
        {error ? <p className="text-sm text-red-300" role="alert">{error}</p> : null}
        <div>
          <Button
            variant="secondary"
            disabled={pending || selected.length === 0}
            onClick={() => startTransition(async () => {
              setError(null);
              const result = await updateMySubjectsAction(selected);
              if (!result.ok) { setError(result.error ?? "Save failed."); return; }
              router.refresh();
            })}
          >
            {pending ? "Saving…" : "Save qualifications"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
