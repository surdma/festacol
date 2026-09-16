"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { clearAdminDataScopeAction, type AdminDataScope } from "@/app/actions/admin-data-controls";

export interface MaintenanceFeedback {
  tone: "success" | "error";
  message: string;
}

export function useSchoolDataMaintenance() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [activeScope, setActiveScope] = useState<AdminDataScope | null>(null);
  const [feedback, setFeedback] = useState<MaintenanceFeedback | null>(null);

  function clear(scope: AdminDataScope, successMessage: string) {
    setFeedback(null);
    setActiveScope(scope);
    startTransition(async () => {
      const result = await clearAdminDataScopeAction(scope);
      if (!result.ok) {
        setFeedback({ tone: "error", message: result.error ?? "The selected records could not be cleared." });
        setActiveScope(null);
        return;
      }
      setFeedback({ tone: "success", message: successMessage });
      setActiveScope(null);
      router.refresh();
    });
  }

  return { pending, activeScope, feedback, clear };
}
