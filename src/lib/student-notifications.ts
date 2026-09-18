import type { createSupabaseServerClient } from "@/lib/supabase/server";
import type { ExamAttemptContextSnapshot } from "@/types/db";
import type { ApplicationNotification } from "@/types/admin";

type ServerSupabaseClient = Awaited<ReturnType<typeof createSupabaseServerClient>>;
const CLOSED_EXAM_NOTICE_WINDOW_MS = 7 * 24 * 60 * 60 * 1000;

interface StudentAttemptNotificationRow {
  id: string;
  session_id: string;
  context_snapshot: ExamAttemptContextSnapshot;
  started_at: number | null;
  submitted_at: number | null;
  score: number | null;
  created_at: number;
}

interface StudentRetakeNotificationRow {
  id: string;
  session_id: string;
  additional_attempts: number;
  reason: string;
  granted_at: string;
  expires_at: string | null;
  revoked_at: string | null;
}

export async function getStudentTopbarNotifications(
  supabase: ServerSupabaseClient,
  studentId: string,
  hasActiveEnrollment: boolean,
): Promise<ApplicationNotification[]> {
  const [attemptResult, retakeResult] = await Promise.all([
    supabase
      .from("exam_attempts")
      .select("id,session_id,context_snapshot,started_at,submitted_at,score,created_at")
      .eq("student_id", studentId)
      .order("created_at", { ascending: false })
      .limit(8),
    supabase
      .from("exam_retake_grants")
      .select("id,session_id,additional_attempts,reason,granted_at,expires_at,revoked_at")
      .eq("student_id", studentId)
      .order("granted_at", { ascending: false })
      .limit(8),
  ]);

  const attempts = (attemptResult.data ?? []) as StudentAttemptNotificationRow[];
  const now = Date.now();
  const retakes = ((retakeResult.data ?? []) as StudentRetakeNotificationRow[]).filter((grant) => {
    if (grant.revoked_at) return false;
    return !grant.expires_at || new Date(grant.expires_at).getTime() > now;
  });
  const retakeSessionIds = [...new Set(retakes.map((grant) => grant.session_id))];
  const { data: retakeSessions } = retakeSessionIds.length
    ? await supabase.from("exam_sessions").select("id,title").in("id", retakeSessionIds)
    : { data: [] };
  const retakeTitleBySession = new Map(
    ((retakeSessions ?? []) as { id: string; title: string }[]).map((session) => [session.id, session.title]),
  );

  const attemptSessionIds = [...new Set(attempts.map((attempt) => attempt.session_id))];
  const { data: attemptSessions } = attemptSessionIds.length
    ? await supabase.from("exam_sessions").select("id,title,status,closed_at").in("id", attemptSessionIds)
    : { data: [] };
  const closedSessions = ((attemptSessions ?? []) as { id: string; title: string; status: string; closed_at: number | null }[])
    .filter((session) => session.status === "closed" && Number(session.closed_at ?? 0) >= now - CLOSED_EXAM_NOTICE_WINDOW_MS)
    .sort((left, right) => Number(right.closed_at ?? 0) - Number(left.closed_at ?? 0));

  const activeAttempt = attempts.find(
    (attempt) => attempt.started_at && !attempt.submitted_at,
  );
  const latestSubmitted = attempts.find((attempt) => attempt.submitted_at);
  const notifications: ApplicationNotification[] = [];

  for (const session of closedSessions.slice(0, 2)) {
    notifications.push({
      id: `exam-closed-${session.id}-${session.closed_at}`,
      title: `${session.title} is closed`,
      detail:
        "Staff closed this examination. If you were still writing, Festacol finalized the responses already saved to the server. Completed attempts remain available in Exam history.",
      icon: "clock",
      tone: "amber",
    });
  }

  for (const grant of retakes.slice(0, 3)) {
    const title = retakeTitleBySession.get(grant.session_id) ?? "Examination";
    const count = Math.max(1, Number(grant.additional_attempts ?? 1));
    const reason = grant.reason.trim();
    const baseDetail = `You received ${count} additional attempt${count === 1 ? "" : "s"}. Festacol recalculates your available attempts from your saved exam history.`;
    notifications.push({
      id: `retake-${grant.id}`,
      title: `${title} retake approved`,
      detail: reason ? `${baseDetail} Staff note: ${reason}` : baseDetail,
      icon: "book",
      tone: "blue",
    });
  }

  if (activeAttempt) {
    const title = activeAttempt.context_snapshot.sessionTitle ?? "Current exam";
    notifications.push({
      id: `active-attempt-${activeAttempt.id}`,
      title: `${title} is still in progress`,
      detail:
        "Your attempt has not been submitted yet. Return through your dashboard or the original exam link to resume it before completing the submission.",
      icon: "clock",
      tone: "blue",
    });
  }

  if (latestSubmitted) {
    const title = latestSubmitted.context_snapshot.sessionTitle ?? "Latest exam";
    const scoreMessage =
      latestSubmitted.score === null
        ? "Your score is still awaiting a recorded result."
        : `Your recorded score is ${Math.round(latestSubmitted.score)}%.`;
    notifications.push({
      id: `latest-result-${latestSubmitted.id}`,
      title: `${title} has been submitted`,
      detail: `${scoreMessage} Open Exam history whenever you need the complete attempt record and result context.`,
      icon: "chart",
      tone: "neutral",
    });
  }

  if (!hasActiveEnrollment) {
    notifications.push({
      id: "class-placement-pending",
      title: "Class placement is still pending",
      detail:
        "Your student account is active, but it is not linked to a current class enrollment yet. Class-scoped subjects and examinations become available after the school completes your placement.",
      icon: "school",
      tone: "amber",
    });
  }

  return notifications;
}
