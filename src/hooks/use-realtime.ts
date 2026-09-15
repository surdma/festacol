"use client";

import { useEffect } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

// Realtime streaming via Supabase Realtime (postgres_changes).
// This is why runtime uses Supabase directly instead of Prisma:
// Prisma Server Actions have no built-in row-level subscriptions.
export function useRealtimeTable(
  table: string,
  onEvent: (payload: { eventType: string; new: Record<string, unknown>; old: Record<string, unknown> }) => void,
  filter?: string,
) {
  useEffect(() => {
    const supabase = createSupabaseBrowserClient();
    const channel = supabase
      .channel(`rt:${table}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table, ...(filter ? { filter } : {}) },
        (payload) =>
          onEvent({
            eventType: payload.eventType,
            new: (payload.new ?? {}) as Record<string, unknown>,
            old: (payload.old ?? {}) as Record<string, unknown>,
          }),
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [table, filter, onEvent]);
}
