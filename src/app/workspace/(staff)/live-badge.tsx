"use client";

import { useCallback, useState } from "react";
import { useRealtimeTable } from "@/hooks/use-realtime";

export function AdminLiveBadge() {
  const [events, setEvents] = useState(0);
  const onEvent = useCallback(() => setEvents((count) => count + 1), []);
  useRealtimeTable("exam_attempts", onEvent);
  useRealtimeTable("exam_sessions", onEvent);

  return (
    <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-emerald-400" aria-label={events ? `Online, ${events} live updates received` : "Online"}>
      <span className="size-1.5 rounded-full bg-emerald-400" />
      Online
    </span>
  );
}
