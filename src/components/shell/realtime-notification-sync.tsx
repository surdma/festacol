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

interface ExamHelpRequestBroadcastPayload {
  eventId: string;
  requestId: string;
  sessionId: string;
  sessionTitle: string;
  requesterName: string;
  category: string;
  message: string;
  createdAt: string;
}

const STAFF_BATCH_WINDOW_MS = 700;

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
    let staffBatch: ExamLifecycleBroadcastPayload[] = [];
    let staffBatchTimer: number | null = null;
    let realtimeWarningShown = false;

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
        title: active ? "Examination retake approved" : "Examination retake access changed",
        description: active
          ? `${payload.sessionTitle} now has ${attempts} additional attempt${attempts === 1 ? "" : "s"} available. Your examination access is updating now.`
          : `${payload.sessionTitle} no longer has an active retake grant. Your examination access is updating now.`,
      });
      router.refresh();
    };

    const handleStudentStarted = (message: { payload?: unknown }) => {
      const payload = message.payload as ExamLifecycleBroadcastPayload | undefined;
      if (!payload?.eventId || !payload.attemptId || seenRef.current.has(payload.eventId)) return;
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

    const flushStaffBatch = () => {
      staffBatchTimer = null;
      if (cancelled || !staffBatch.length) return;
      const batch = staffBatch;
      staffBatch = [];

      if (batch.length === 1) {
        const payload = batch[0];
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
      } else {
        const started = batch.filter((item) => item.eventType === "exam_started").length;
        const submitted = batch.length - started;
        const sessions = new Set(batch.map((item) => item.sessionId)).size;
        const segments = [
          started ? `${started} started` : "",
          submitted ? `${submitted} submitted` : "",
        ].filter(Boolean).join(" · ");
        toast.add({
          type: submitted ? "success" : "info",
          title: `${batch.length} examination updates`,
          description: `${segments}${sessions > 1 ? ` across ${sessions} examinations` : ""}. Open Examinations or a student record for individual details.`,
        });
      }
      router.refresh();
    };

    const handleStaffLifecycle = (message: { payload?: unknown }) => {
      const payload = message.payload as ExamLifecycleBroadcastPayload | undefined;
      if (!payload?.eventId || seenRef.current.has(payload.eventId)) return;
      seenRef.current.add(payload.eventId);
      staffBatch.push(payload);
      if (staffBatchTimer === null) {
        staffBatchTimer = window.setTimeout(flushStaffBatch, STAFF_BATCH_WINDOW_MS);
      }
    };

    const handleStaffHelpRequest = (message: { payload?: unknown }) => {
      const payload = message.payload as ExamHelpRequestBroadcastPayload | undefined;
      if (!payload?.eventId || seenRef.current.has(payload.eventId)) return;
      seenRef.current.add(payload.eventId);
      toast.add({
        type: "warning",
        title: `Examination support · ${payload.sessionTitle}`,
        description: `${payload.requesterName} · ${payload.category}: ${payload.message}`,
      });
      router.refresh();
    };

    const warnRealtimeUnavailable = (description: string) => {
      if (realtimeWarningShown || cancelled) return;
      realtimeWarningShown = true;
      toast.add({
        type: "warning",
        title: "Live examination updates are unavailable",
        description,
      });
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
            .on("broadcast", { event: "exam_submitted" }, handleStaffLifecycle)
            .on("broadcast", { event: "exam_help_requested" }, handleStaffHelpRequest);
        }

        channel.subscribe((status) => {
          if (status === "SUBSCRIBED") {
            realtimeWarningShown = false;
            if (surface === "student" && examSessionId) void reconcileStudentPresence();
          } else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
            warnRealtimeUnavailable("Festacol could not maintain the Realtime channel. Refresh the page to retry live notifications.");
          }
        });

        if (surface === "student" && examSessionId && activeAttemptId) {
          await joinPresence(examSessionId, activeAttemptId);
        }
      } catch {
        warnRealtimeUnavailable("Festacol could not authorize the Realtime channel. Refresh the page to retry live notifications.");
      }
    })();

    return () => {
      cancelled = true;
      if (staffBatchTimer !== null) window.clearTimeout(staffBatchTimer);
      staffBatch = [];
      if (notificationChannel) void supabase.removeChannel(notificationChannel);
      void leavePresence();
    };
  }, [activeAttemptId, examSessionId, recipientId, router, surface]);

  return null;
}
