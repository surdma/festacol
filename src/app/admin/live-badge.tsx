"use client";

import { useCallback, useState } from "react";
import { StatusBadge } from "@/components/status-badge";
import { useRealtimeTable } from "@/hooks/use-realtime";

// Live subscription island: Supabase Realtime streaming.
// Prisma Server Actions cannot do this — runtime stays on Supabase direct.
export function AdminLiveBadge() {
  const [events, setEvents] = useState(0);
  const onEvent = useCallback(() => setEvents((n) => n + 1), []);
  useRealtimeTable("exam_attempts", onEvent);
  useRealtimeTable("exam_sessions", onEvent);
  return (
    <StatusBadge tone="emerald">
      <span className="relative flex size-2">
        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-500 opacity-60" />
        <span className="relative inline-flex size-2 rounded-full bg-emerald-600" />
      </span>
      &nbsp;Live{events > 0 ? ` · ${events} updates` : ""}
    </StatusBadge>
  );
}
