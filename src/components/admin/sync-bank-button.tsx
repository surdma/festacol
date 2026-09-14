"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { syncQuestionBankAction } from "@/app/actions/admin";

export function SyncBankButton() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  return (
    <Button size="sm" variant="outline" disabled={pending}
      onClick={() => startTransition(async () => {
        const r = await syncQuestionBankAction();
        if (r.ok) router.refresh();
      })}>
      {pending ? "Syncing…" : "Sync bank"}
    </Button>
  );
}
