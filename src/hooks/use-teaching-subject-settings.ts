"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { getSubjectCatalogAction } from "@/app/actions/admin-parity";
import { getMyScopeAction, updateMySubjectsAction } from "@/app/actions/admin";

export interface TeachingSubjectOption {
  id: string;
  name: string;
}

export function useTeachingSubjectSettings() {
  const router = useRouter();
  const [catalog, setCatalog] = useState<TeachingSubjectOption[]>([]);
  const [selected, setSelected] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    let active = true;
    void Promise.all([getSubjectCatalogAction(), getMyScopeAction()])
      .then(([subjects, scope]) => {
        if (!active) return;
        setCatalog(subjects);
        setSelected(scope.subjectIds);
      })
      .catch(() => {
        if (active) setError("Your teaching subjects could not be loaded.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => { active = false; };
  }, []);

  function toggle(subjectId: string) {
    setSaved(false);
    setSelected((current) => current.includes(subjectId) ? current.filter((id) => id !== subjectId) : [...current, subjectId]);
  }

  function save() {
    setError(null);
    setSaved(false);
    startTransition(async () => {
      const result = await updateMySubjectsAction(selected);
      if (!result.ok) {
        setError(result.error ?? "Your teaching subjects could not be saved.");
        return;
      }
      setSaved(true);
      router.refresh();
    });
  }

  return { catalog, selected, loading, pending, error, saved, toggle, save };
}
