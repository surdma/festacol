"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { loadSchoolDataSourceAction, type SchoolDataSource } from "@/app/actions/fixture-library";

export interface SchoolDataFeedback {
  source: SchoolDataSource;
  tone: "success" | "error";
  message: string;
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
        setFeedback({ source, tone: "error", message: result.error ?? "The selected school data could not be loaded." });
        setActiveSource(null);
        return;
      }
      const count = typeof result.count === "number" ? `${result.count} record${result.count === 1 ? "" : "s"} prepared. ` : "";
      setFeedback({ source, tone: "success", message: `${count}${result.detail ?? "School data is up to date."}`.trim() });
      setActiveSource(null);
      router.refresh();
    });
  }

  return { pending, activeSource, feedback, load };
}
