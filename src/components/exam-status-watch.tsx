"use client";

import { useCallback, useState } from "react";
import { useRouter } from "next/navigation";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { useRealtimeTable } from "@/hooks/use-realtime";

// Watches this exam's session row. If an admin closes/edits the session
// mid-exam, the workspace refreshes so the server can auto-submit/lock.
export function ExamStatusWatch({ sessionId }: { sessionId: string }) {
  const router = useRouter();
  const [changed, setChanged] = useState(false);
  const onEvent = useCallback(
    (payload: { eventType: string; new: Record<string, unknown> }) => {
      if (payload.new.id !== sessionId) return;
      setChanged(true);
      router.refresh();
    },
    [router, sessionId],
  );
  useRealtimeTable("exam_sessions", onEvent, `id=eq.${sessionId}`);
  if (!changed) return null;
  return (
    <Alert>
      <AlertTitle>Exam updated</AlertTitle>
      <AlertDescription>Your teacher changed this exam. The workspace is refreshing…</AlertDescription>
    </Alert>
  );
}
