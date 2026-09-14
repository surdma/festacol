"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { syncQuestionBankAction } from "@/app/actions/admin";
import { adminSecondaryButtonClass } from "@/components/admin/admin-ui";
import { Button } from "@/components/ui/button";

export function SyncBankButton() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  return (
    <Button type="button" variant="outline" disabled={pending} className={adminSecondaryButtonClass} onClick={() => startTransition(async () => { const result = await syncQuestionBankAction(); if (result.ok) router.refresh(); })}>
      {pending ? "Loading…" : "Load question bank"}
    </Button>
  );
}
