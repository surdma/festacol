"use client";

import { useEffect, useMemo, useRef } from "react";
import { usePathname, useRouter } from "next/navigation";
import { getExamExperienceContextAction } from "@/app/actions/exam-experience";
import type { ApplicationSurface } from "@/components/shell/application-nav";
import { toast } from "@/components/ui/toast";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

interface RealtimeRetakeGrantRow {
  id: string;
  session_id: string;
  student_id: string;
  additional_attempts: number;
  revoked_at: string | null;
}

interface RealtimeAttemptRow {
  id: string;
  session_id: string;
  attempt_number: number;
  submitted_at: number | string | null;
}

export interface CreatorSessionRealtimeRef {
  id: string;
  title: string;
}

const EMPTY_CREATOR_SESSIONS: CreatorSessionRealtimeRef[] = [];

export function RealtimeNotificationSync({
  surface,
  recipientId,
  creatorSessions = EMPTY_CREATOR_SESSIONS,
  examSessionId,
}: {
  surface: ApplicationSurface;
  recipientId: string;
  creatorSessions?: CreatorSessionRealtimeRef[];
  examSessionId?: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const seenRef = useRef(new Set<string>());
  const creatorSessionTitles = useMemo(
    () => new Map(creatorSessions.map((session) => [session.id, session.title])),
    [creatorSessions],
  );

  useEffect(() => {
    const supabase = createSupabaseBrowserClient();
    const channel = supabase.channel(`festacol-notifications:${surface}:${recipientId}`);

    if (surface === "student") {
      channel.on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "exam_retake_grants",
          filter: `student_id=eq.${recipientId}`,
        },
        (payload) => {
          const row = payload.new as RealtimeRetakeGrantRow;
          if (!row?.id || row.revoked_at || seenRef.current.has(row.id)) return;
          seenRef.current.add(row.id);

          const attempts = Math.max(1, Number(row.additional_attempts ?? 1));
          toast.add({
            type: "success",
            title: "Exam retake approved",
            description: `You now have ${attempts} additional attempt${attempts === 1 ? "" : "s"}. Your exam access is updating now.`,
          });

          const reconcile = async () => {
            if (pathname === "/exam" && examSessionId === row.session_id) {
              try {
                const access = await getExamExperienceContextAction(examSessionId);
                if (
                  access.ok &&
                  !access.data.access.activeAttemptId &&
                  access.data.access.usedAttempts < access.data.access.allowedAttempts
                ) {
                  window.location.reload();
                  return;
                }
              } catch {
                // The RSC refresh below retries the authoritative access read.
              }
            }
            router.refresh();
          };

          void reconcile();
        },
      );
    } else if (creatorSessionTitles.size) {
      channel.on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "exam_attempts",
        },
        (payload) => {
          const row = payload.new as RealtimeAttemptRow;
          if (!row?.id || !row.submitted_at) return;
          const sessionTitle = creatorSessionTitles.get(row.session_id);
          if (!sessionTitle) return;

          const eventId = `${row.id}:${row.submitted_at}`;
          if (seenRef.current.has(eventId)) return;
          seenRef.current.add(eventId);

          toast.add({
            type: "success",
            title: "Exam submission received",
            description: `${sessionTitle} received attempt #${Math.max(1, Number(row.attempt_number ?? 1))}. The examination workspace is updating now.`,
          });
          router.refresh();
        },
      );
    }

    channel.subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [creatorSessionTitles, examSessionId, pathname, recipientId, router, surface]);

  return null;
}
