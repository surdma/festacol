"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { BookOpenCheck } from "lucide-react";
import { AdminTablePagination, useAdminTablePagination } from "@/components/admin/admin-table-pagination";
import { AdminEmptyState, adminIconButtonClass } from "@/components/admin/admin-ui";
import { StatusBadge } from "@/components/status-badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

export interface ExamDirectoryTableRow {
  id: string;
  title: string;
  targetLabels: string[];
  subjectNames: string[];
  mode: string;
  state: string;
  attempts: number;
  submitted: number;
}

interface CandidatePresence {
  attemptId?: string;
}

export function ExamDirectoryTable({ rows }: { rows: ExamDirectoryTableRow[] }) {
  const { page, pageSize, pageCount, pageRows, setPage, setPageSize } = useAdminTablePagination(rows, 15);
  const [liveBySession, setLiveBySession] = useState<Record<string, number>>({});
  const [presenceState, setPresenceState] = useState<"idle" | "connecting" | "connected" | "unavailable">("idle");
  const openSessionKey = useMemo(
    () => rows.filter((row) => row.state === "open").map((row) => row.id).sort().join("|"),
    [rows],
  );

  useEffect(() => {
    if (!openSessionKey) {
      setLiveBySession({});
      setPresenceState("idle");
      return;
    }

    const sessionIds = openSessionKey.split("|");
    const supabase = createSupabaseBrowserClient();
    const channels: ReturnType<typeof supabase.channel>[] = [];
    let cancelled = false;
    let subscribedCount = 0;
    setPresenceState("connecting");

    void (async () => {
      try {
        await supabase.realtime.setAuth();
        if (cancelled) return;

        for (const sessionId of sessionIds) {
          const channel = supabase.channel(`exam:${sessionId}:presence`, {
            config: { private: true },
          });
          channels.push(channel);
          const sync = () => {
            const state = channel.presenceState() as Record<string, CandidatePresence[]>;
            const activeAttempts = new Set<string>();
            for (const presences of Object.values(state)) {
              for (const presence of presences) {
                if (presence.attemptId) activeAttempts.add(presence.attemptId);
              }
            }
            setLiveBySession((current) => ({ ...current, [sessionId]: activeAttempts.size }));
          };

          channel
            .on("presence", { event: "sync" }, sync)
            .on("presence", { event: "join" }, sync)
            .on("presence", { event: "leave" }, sync)
            .subscribe((status) => {
              if (status === "SUBSCRIBED") {
                subscribedCount += 1;
                setPresenceState("connected");
              } else if ((status === "CHANNEL_ERROR" || status === "TIMED_OUT") && subscribedCount === 0) {
                setPresenceState("unavailable");
              }
            });
        }
      } catch {
        if (!cancelled) setPresenceState("unavailable");
      }
    })();

    return () => {
      cancelled = true;
      for (const channel of channels) void supabase.removeChannel(channel);
    };
  }, [openSessionKey]);

  if (!rows.length) {
    return <AdminEmptyState title="No matching examinations" description="Change the current search or status filters to see other examination sessions." />;
  }

  return (
    <>
      {openSessionKey ? (
        <div className="flex items-center justify-between gap-3 border-b border-border px-4 py-2 text-xs text-muted-foreground" role="status" aria-live="polite">
          <span>Supabase Realtime Presence</span>
          <span>{presenceState === "connected" ? "Live candidate status connected" : presenceState === "unavailable" ? "Live candidate status unavailable" : "Connecting live candidate status…"}</span>
        </div>
      ) : null}
      <Table>
        <TableHeader className="bg-muted/30">
          <TableRow>
            <TableHead className="min-w-64">Exam</TableHead>
            <TableHead className="min-w-64">Audience / subjects</TableHead>
            <TableHead>Attempts</TableHead>
            <TableHead>Status</TableHead>
            <TableHead className="w-14"><span className="sr-only">Open</span></TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {pageRows.map((row) => {
            const liveCount = liveBySession[row.id] ?? 0;
            return (
              <TableRow key={row.id}>
                <TableCell className="whitespace-normal">
                  <strong className="block text-foreground">{row.title}</strong>
                  <span className="mt-1 block font-mono text-[11px] text-muted-foreground">{row.id}</span>
                </TableCell>
                <TableCell className="whitespace-normal">
                  <span className="block text-xs font-semibold text-foreground">{row.targetLabels.join(", ") || "Explicit student audience"}</span>
                  <span className="mt-1 block max-w-xs text-xs text-muted-foreground">{row.subjectNames.length ? row.subjectNames.join(", ") : row.mode}</span>
                </TableCell>
                <TableCell className="whitespace-normal text-xs text-muted-foreground">
                  <span className="block">{row.submitted}/{row.attempts} submitted</span>
                  {liveCount > 0 ? <span className="mt-1 inline-flex"><StatusBadge tone="emerald">{liveCount} live now</StatusBadge></span> : null}
                </TableCell>
                <TableCell>
                  <StatusBadge tone={row.state === "open" ? "emerald" : row.state === "scheduled" ? "blue" : row.state === "draft" ? "amber" : "neutral"}>
                    {row.state}
                  </StatusBadge>
                </TableCell>
                <TableCell className="pr-4 text-right">
                  <Link
                    href={`/workspace/exams?modal=exam&exam=${encodeURIComponent(row.id)}`}
                    className={adminIconButtonClass}
                    aria-label={`Open ${row.title}`}
                  >
                    <BookOpenCheck aria-hidden="true" />
                  </Link>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
      <AdminTablePagination
        id="examinations"
        count={rows.length}
        page={page}
        pageSize={pageSize}
        pageCount={pageCount}
        onPageChange={setPage}
        onPageSizeChange={setPageSize}
      />
    </>
  );
}
