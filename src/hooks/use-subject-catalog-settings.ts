"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toggleSubjectAction, upsertSubjectAction } from "@/app/actions/admin";
import { seedSubjectCatalogFromBankAction } from "@/app/actions/seed-bank";

export interface SubjectSettingsRow {
  id: string;
  name: string;
  active: boolean;
}

export function useSubjectCatalogSettings() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [pending, startTransition] = useTransition();
  const [feedback, setFeedback] = useState<{ tone: "success" | "error"; message: string } | null>(null);

  function run(operation: () => Promise<{ ok: boolean; error?: string; count?: number }>, options?: { resetName?: boolean; success?: string }) {
    setFeedback(null);
    startTransition(async () => {
      const result = await operation();
      if (!result.ok) {
        setFeedback({ tone: "error", message: result.error ?? "The subject catalogue could not be updated." });
        return;
      }
      if (options?.resetName) setName("");
      if (options?.success) setFeedback({ tone: "success", message: options.success });
      router.refresh();
    });
  }

  function addSubject() {
    const value = name.trim();
    if (!value) return;
    run(() => upsertSubjectAction({ name: value }), { resetName: true, success: `${value} was added to the subject catalogue.` });
  }

  function toggleSubject(subject: SubjectSettingsRow) {
    run(() => toggleSubjectAction(subject.id, !subject.active), { success: `${subject.name} is now ${subject.active ? "inactive" : "active"}.` });
  }

  function loadPreparedCurriculum() {
    run(seedSubjectCatalogFromBankAction, { success: "The prepared subject curriculum is up to date." });
  }

  return { name, setName, pending, feedback, addSubject, toggleSubject, loadPreparedCurriculum };
}
