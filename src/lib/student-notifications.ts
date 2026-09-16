import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { ExamAttemptContextSnapshot } from "@/types/db";
import type { ApplicationNotification } from "@/types/admin";

type ServerSupabaseClient = Awaited<ReturnType<typeof createSupabaseServerClient>>;

interface StudentAttemptNotificationRow {
  id: string;
  context_snapshot: ExamAttemptContextSnapshot;
  started_at: number | null;
  submitted_at: number | null;
  score: number | null;
  created_at: number;
}

export async function getStudentTopbarNotifications(
  supabase: ServerSupabaseClient,
  studentId: string,
  hasActiveEnrollment: boolean,
): Promise<ApplicationNotification[]> {
  const { data } = await supabase
    .from("exam_attempts")
    .select("id,context_snapshot,started_at,submitted_at,score,created_at")
    .eq("student_id", studentId)
    .order("created_at", { ascending: false })
    .limit(8);

  const attempts = (data ?? []) as StudentAttemptNotificationRow[];
  const activeAttempt = attempts.find(
    (attempt) => attempt.started_at && !attempt.submitted_at,
  );
  const latestSubmitted = attempts.find((attempt) => attempt.submitted_at);
  const notifications: ApplicationNotification[] = [];

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
