"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { loadSchoolDataSourceAction, type SchoolDataSource } from "@/app/actions/fixture-library";
import { toast } from "@/components/ui/toast";

export interface SchoolDataFeedback {
  source: SchoolDataSource;
  tone: "success" | "error";
  message: string;
}

function sourceTitle(source: SchoolDataSource) {
  if (source === "subjects") return "Subject curriculum";
  if (source === "academic-structure") return "Academic structure";
  return "Question bank";
}

export function useSchoolDataLibrary() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [activeSource, setActiveSource] = useState<SchoolDataSource | null>(null);
  const [feedback, setFeedback] = useState<SchoolDataFeedback | null>(null);

  function load(source: SchoolDataSource) {
    setFeedback(null);
    setActiveSource(source);
    startTransition(async () => {
      const result = await loadSchoolDataSourceAction(source);
      if (!result.ok) {
        const message = result.error ?? "The selected school data could not be loaded.";
        setFeedback({ source, tone: "error", message });
        toast.add({
          type: "error",
          title: `${sourceTitle(source)} was not loaded`,
          description: message,
          priority: "high",
        });
        setActiveSource(null);
        return;
      }
      const count = typeof result.count === "number" ? `${result.count} record${result.count === 1 ? "" : "s"} prepared. ` : "";
      const message = `${count}${result.detail ?? "School data is up to date."}`.trim();
      setFeedback({ source, tone: "success", message });
      toast.add({
        type: "success",
        title: `${sourceTitle(source)} is up to date`,
        description: message,
      });
      setActiveSource(null);
      router.refresh();
    });
  }

  return { pending, activeSource, feedback, load };
}
