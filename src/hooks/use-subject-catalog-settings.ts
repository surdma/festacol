"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toggleSubjectAction, upsertSubjectAction } from "@/app/actions/admin";
import { seedSubjectCatalogFromBankAction } from "@/app/actions/seed-bank";
import { toast } from "@/components/ui/toast";

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
        const message = result.error ?? "The subject catalogue could not be updated.";
        setFeedback({ tone: "error", message });
        toast.add({ type: "error", title: "Subject catalogue was not updated", description: message, priority: "high" });
        return;
      }
      if (options?.resetName) setName("");
      const message = options?.success ?? "The subject catalogue was updated.";
      setFeedback({ tone: "success", message });
      toast.add({ type: "success", title: "Subject catalogue updated", description: message });
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
