"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import type { ApplicationSurface } from "@/components/shell/application-nav";
import { toast } from "@/components/ui/toast";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

interface RetakeBroadcastPayload {
  eventId: string;
  grantId: string;
  sessionId: string;
  sessionTitle: string;
  additionalAttempts: number;
  reason: string;
  status: "active" | "revoked" | "expired";
  expiresAt: string | null;
}

interface ExamLifecycleBroadcastPayload {
  eventId: string;
  eventType: "exam_started" | "exam_submitted";
  attemptId: string;
  attemptNumber: number;
  sessionId: string;
  sessionTitle: string;
  studentId: string;
  studentName: string;
  startedAt: number | null;
  submittedAt?: number | null;
  score?: number | null;
}

export function RealtimeNotificationSync({
  surface,
  recipientId,
  examSessionId,
  activeAttemptId,
}: {
  surface: ApplicationSurface;
  recipientId: string;
  examSessionId?: string;
  activeAttemptId?: string | null;
}) {
  const router = useRouter();
  const seenRef = useRef(new Set<string>());

  useEffect(() => {
    const supabase = createSupabaseBrowserClient();
    let cancelled = false;
    let notificationChannel: ReturnType<typeof supabase.channel> | null = null;
    let presenceChannel: ReturnType<typeof supabase.channel> | null = null;
    let presenceAttemptId: string | null = null;

    const leavePresence = async () => {
      const channel = presenceChannel;
      presenceChannel = null;
      presenceAttemptId = null;
      if (!channel) return;
      await channel.untrack().catch(() => undefined);
      await supabase.removeChannel(channel).catch(() => undefined);
    };

    const joinPresence = async (sessionId: string, attemptId: string) => {
      if (cancelled || surface !== "student" || !examSessionId || sessionId !== examSessionId) return;
      if (presenceAttemptId === attemptId && presenceChannel) return;
      await leavePresence();
      if (cancelled) return;

      const channel = supabase.channel(`exam:${sessionId}:presence`, {
        config: {
          private: true,
          presence: { key: attemptId },
        },
      });
      presenceChannel = channel;
      presenceAttemptId = attemptId;
      channel.subscribe(async (status) => {
        if (status !== "SUBSCRIBED" || cancelled || presenceChannel !== channel) return;
        await channel.track({
          attemptId,
          status: "active",
          onlineAt: new Date().toISOString(),
        });
      });
    };

    const reconcileStudentPresence = async () => {
      if (cancelled || surface !== "student" || !examSessionId) return;
      const { data, error } = await supabase
        .from("exam_attempts")
        .select("id")
        .eq("session_id", examSessionId)
        .eq("student_id", recipientId)
        .is("submitted_at", null)
        .order("attempt_number", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (cancelled || error) return;
      const attempt = data as { id?: string } | null;
      if (attempt?.id) {
        await joinPresence(examSessionId, attempt.id);
      } else {
        await leavePresence();
      }
    };

    const handleStudentRetake = (message: { payload?: unknown }) => {
      const payload = message.payload as RetakeBroadcastPayload | undefined;
      if (!payload?.eventId || seenRef.current.has(payload.eventId)) return;
      seenRef.current.add(payload.eventId);

      const attempts = Math.max(1, Number(payload.additionalAttempts ?? 1));
      const active = payload.status === "active";
      toast.add({
        type: active ? "success" : "warning",
        title: active ? "Exam retake approved" : "Exam retake access changed",
        description: active
          ? `${payload.sessionTitle} now has ${attempts} additional attempt${attempts === 1 ? "" : "s"} available. Your access is updating now.`
          : `${payload.sessionTitle} no longer has an active retake grant. Your exam access is updating now.`,
      });
      router.refresh();
    };

    const handleStudentStarted = (message: { payload?: unknown }) => {
      const payload = message.payload as ExamLifecycleBroadcastPayload | undefined;
      if (!payload?.eventId || !payload.attemptId) return;
      if (seenRef.current.has(payload.eventId)) return;
      seenRef.current.add(payload.eventId);
      void joinPresence(payload.sessionId, payload.attemptId);
    };

    const handleStudentSubmitted = (message: { payload?: unknown }) => {
      const payload = message.payload as ExamLifecycleBroadcastPayload | undefined;
      if (!payload?.eventId || seenRef.current.has(payload.eventId)) return;
      seenRef.current.add(payload.eventId);
      if (presenceAttemptId === payload.attemptId) void leavePresence();
      router.refresh();
    };

    const handleStaffLifecycle = (message: { payload?: unknown }) => {
      const payload = message.payload as ExamLifecycleBroadcastPayload | undefined;
      if (!payload?.eventId || seenRef.current.has(payload.eventId)) return;
      seenRef.current.add(payload.eventId);
      const attemptNumber = Math.max(1, Number(payload.attemptNumber ?? 1));

      if (payload.eventType === "exam_started") {
        toast.add({
          type: "info",
          title: `${payload.studentName} started ${payload.sessionTitle}`,
          description: `Attempt #${attemptNumber} is now active. Live candidate Presence is updating in Examinations.`,
        });
      } else {
        const score = typeof payload.score === "number" ? ` Score ${Math.round(payload.score)}%.` : "";
        toast.add({
          type: "success",
          title: `${payload.studentName} submitted ${payload.sessionTitle}`,
          description: `Attempt #${attemptNumber} has been completed.${score} The examination workspace is updating now.`,
        });
      }
      router.refresh();
    };

    void (async () => {
      try {
        await supabase.realtime.setAuth();
        if (cancelled) return;

        const topic = surface === "student"
          ? `student:${recipientId}:exam`
          : `staff:${recipientId}:exam`;
        const channel = supabase.channel(topic, { config: { private: true } });
        notificationChannel = channel;

        if (surface === "student") {
          channel
            .on("broadcast", { event: "exam_retake_changed" }, handleStudentRetake)
            .on("broadcast", { event: "exam_started" }, handleStudentStarted)
            .on("broadcast", { event: "exam_submitted" }, handleStudentSubmitted);
        } else {
          channel
            .on("broadcast", { event: "exam_started" }, handleStaffLifecycle)
            .on("broadcast", { event: "exam_submitted" }, handleStaffLifecycle);
        }

        channel.subscribe((status) => {
          if (status === "SUBSCRIBED" && surface === "student" && examSessionId) {
            void reconcileStudentPresence();
          } else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
            toast.add({
              type: "warning",
              title: "Live exam updates are unavailable",
              description: "Festacol could not maintain the Realtime channel. Refresh the page to retry live notifications.",
            });
          }
        });

        if (surface === "student" && examSessionId && activeAttemptId) {
          await joinPresence(examSessionId, activeAttemptId);
        }
      } catch {
        if (!cancelled) {
          toast.add({
            type: "warning",
            title: "Live exam updates are unavailable",
            description: "Festacol could not authorize the Realtime channel. Refresh the page to retry live notifications.",
          });
        }
      }
    })();

    return () => {
      cancelled = true;
      if (notificationChannel) void supabase.removeChannel(notificationChannel);
      void leavePresence();
    };
  }, [activeAttemptId, examSessionId, recipientId, router, surface]);

  return null;
}
