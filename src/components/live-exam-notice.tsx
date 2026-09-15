"use client";

import { useCallback, useState } from "react";
import { useRouter } from "next/navigation";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { useRealtimeTable } from "@/hooks/use-realtime";

// Student-side UI listener: new/updated exam sessions stream in and the
// dashboard refreshes without polling. Read-only subscription; all writes
// stay in Server Actions.
export function LiveExamNotice() {
  const router = useRouter();
  const [notice, setNotice] = useState<string | null>(null);
  const onEvent = useCallback(
    (payload: { eventType: string; new: Record<string, unknown> }) => {
      const title = typeof payload.new.title === "string" ? payload.new.title : "An exam";
      setNotice(`${title}: ${payload.eventType === "INSERT" ? "new exam published" : "exam updated"}. Refreshing…`);
      router.refresh();
    },
    [router],
  );
  useRealtimeTable("exam_sessions", onEvent);
  if (!notice) return null;
  return (
    <Alert>
      <AlertTitle>Live update</AlertTitle>
      <AlertDescription>{notice}</AlertDescription>
    </Alert>
  );
}
