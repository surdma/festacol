import type { StaffScope } from "@/lib/auth/staff";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import type { createSupabaseServerClient } from "@/lib/supabase/server";
import type { ApplicationNotification } from "@/types/admin";

type ServerSupabaseClient = Awaited<ReturnType<typeof createSupabaseServerClient>>;

interface SessionRow {
  id: string;
  title: string;
  status: string;
  created_by_id: string | null;
}

interface AttemptQueueRow {
  id: string;
  session_id: string;
  student_id: string;
  attempt_number: number;
  started_at: number | null;
  submitted_at: number | null;
  score: number | null;
  updated_at: number;
}

interface IntegrityQueueRow {
  attempt_id: string;
}

interface ClassQueueRow {
  id: string;
  status: string;
}

interface WhatsappQueueRow {
  class_id: string;
}

interface ExamSupportQueueRow {
  id: string;
  session_id: string;
  requester_name: string;
  category: string;
  message: string;
  created_at: string;
}

function compactSupportMessage(message: string) {
  const value = message.trim();
  return value.length > 180 ? `${value.slice(0, 177)}…` : value;
}

export async function getAdminTopbarNotifications(
  supabase: ServerSupabaseClient,
  scope: StaffScope,
): Promise<ApplicationNotification[]> {
  const [sessionsResult, attemptsResult, eventsResult, classesResult, groupsResult] = await Promise.all([
    supabase.from("exam_sessions").select("id,title,status,created_by_id").limit(200),
    supabase
      .from("exam_attempts")
      .select("id,session_id,student_id,attempt_number,started_at,submitted_at,score,updated_at")
      .order("updated_at", { ascending: false })
      .limit(500),
    supabase.from("exam_integrity_events").select("attempt_id").limit(500),
    scope.isAdmin ? supabase.from("classes").select("id,status").limit(200) : Promise.resolve({ data: [] }),
    scope.isAdmin ? supabase.from("whatsapp_groups").select("class_id").limit(300) : Promise.resolve({ data: [] }),
  ]);

  const sessions = (sessionsResult.data ?? []) as SessionRow[];
  // exam_sessions is already filtered by the same RLS authority used by the workspace.
  const allowedSessionIds = new Set(sessions.map((session) => session.id));
  const visibleSessions = sessions.filter((session) => allowedSessionIds.has(session.id));
  const attempts = ((attemptsResult.data ?? []) as AttemptQueueRow[]).filter((attempt) => allowedSessionIds.has(attempt.session_id));
  const visibleAttemptIds = new Set(attempts.map((attempt) => attempt.id));
  const events = ((eventsResult.data ?? []) as IntegrityQueueRow[]).filter((event) => visibleAttemptIds.has(event.attempt_id));
  const classes = (classesResult.data ?? []) as ClassQueueRow[];
  const groups = (groupsResult.data ?? []) as WhatsappQueueRow[];

  const studentIds = [...new Set(attempts.map((attempt) => attempt.student_id))];
  const { data: studentRows } = studentIds.length
    ? await supabase.from("school_members").select("id,first_name,last_name").in("id", studentIds)
    : { data: [] };
  const studentNames = new Map(
    ((studentRows ?? []) as { id: string; first_name: string; last_name: string }[])
      .map((student) => [student.id, `${student.first_name} ${student.last_name}`.trim()]),
  );
  const sessionTitles = new Map(visibleSessions.map((session) => [session.id, session.title]));

  const admin = createSupabaseAdminClient();
  const supportCutoff = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const supportResult = scope.profileId
    ? await admin
        .from("exam_support_requests")
        .select("id,session_id,requester_name,category,message,created_at")
        .eq("recipient_staff_id", scope.profileId)
        .gte("created_at", supportCutoff)
        .order("created_at", { ascending: false })
        .limit(3)
    : { data: [] };
  const supportRequests = ((supportResult.data ?? []) as ExamSupportQueueRow[])
    .filter((request) => allowedSessionIds.has(request.session_id));

  const drafts = visibleSessions.filter((session) => session.status === "draft");
  const activeAttempts = attempts.filter((attempt) => attempt.started_at && !attempt.submitted_at);
  const submittedIds = new Set(attempts.filter((attempt) => attempt.submitted_at).map((attempt) => attempt.id));
  const integrityAttempts = new Set(events.map((event) => event.attempt_id).filter((attemptId) => submittedIds.has(attemptId)));
  const activeClasses = classes.filter((item) => item.status === "active");
  const groupedClasses = new Set(groups.map((group) => group.class_id));
  const missingGroups = scope.isAdmin ? activeClasses.filter((item) => !groupedClasses.has(item.id)) : [];

  const lifecycleGroups = new Map<string, AttemptQueueRow[]>();
  for (const attempt of attempts) {
    if (!attempt.started_at) continue;
    const state = attempt.submitted_at ? "submitted" : "started";
    const key = `${attempt.session_id}:${state}`;
    lifecycleGroups.set(key, [...(lifecycleGroups.get(key) ?? []), attempt]);
  }
  const recentLifecycleGroups = [...lifecycleGroups.entries()]
    .map(([key, rows]) => ({
      key,
      rows: rows.toSorted((left, right) => Number(right.updated_at ?? 0) - Number(left.updated_at ?? 0)),
      at: Math.max(...rows.map((row) => Number(row.updated_at ?? row.submitted_at ?? row.started_at ?? 0))),
    }))
    .toSorted((left, right) => right.at - left.at)
    .slice(0, 2);

  const items: ApplicationNotification[] = [];

  for (const request of supportRequests) {
    const sessionTitle = sessionTitles.get(request.session_id) ?? "Examination";
    items.push({
      id: `exam-support-${request.id}`,
      title: `Examination support · ${sessionTitle}`,
      detail: `${request.requester_name} · ${request.category}: ${compactSupportMessage(request.message)}`,
      icon: "school",
      tone: "amber",
    });
  }

  if (integrityAttempts.size) {
    items.push({
      id: "integrity-events",
      title: `${integrityAttempts.size} submitted attempt${integrityAttempts.size === 1 ? " has" : "s have"} integrity activity`,
      detail: "Integrity events are preserved in the candidate record. Review the affected attempts before making an academic or administrative decision.",
      icon: "shield",
      tone: "red",
    });
  }

  for (const group of recentLifecycleGroups) {
    const latest = group.rows[0];
    const submitted = Boolean(latest.submitted_at);
    const sessionTitle = sessionTitles.get(latest.session_id) ?? "Examination";
    const latestStudent = studentNames.get(latest.student_id) ?? "Student";
    const count = group.rows.length;
    const plural = count === 1 ? "" : "s";
    const score = latest.score === null ? "" : ` Latest recorded score: ${Math.round(latest.score)}%.`;
    items.push({
      id: `exam-lifecycle-${group.key}`,
      title: submitted
        ? `${count} submission${plural} · ${sessionTitle}`
        : `${count} active attempt${plural} · ${sessionTitle}`,
      detail: submitted
        ? `${latestStudent} is the latest candidate to submit.${score} Open the student record for the complete durable timeline.`
        : `${latestStudent} is the latest candidate to start. Supabase Presence shows who is connected now in Examinations.`,
      icon: submitted ? "chart" : "clock",
      tone: "blue",
    });
  }

  if (!recentLifecycleGroups.some((group) => group.rows.some((attempt) => !attempt.submitted_at)) && activeAttempts.length) {
    items.push({
      id: "active-attempts",
      title: `${activeAttempts.length} attempt${activeAttempts.length === 1 ? " is" : "s are"} in progress`,
      detail: "Open Examinations to see which sessions currently have connected candidates through Supabase Realtime Presence.",
      icon: "clock",
      tone: "blue",
    });
  }

  if (drafts.length) {
    items.push({
      id: "draft-exams",
      title: `${drafts.length} draft examination${drafts.length === 1 ? "" : "s"} need review`,
      detail: "Review questions, targeting, duration and examination controls before publishing.",
      icon: "book",
      tone: "amber",
    });
  }

  if (missingGroups.length) {
    items.push({
      id: "missing-whatsapp-groups",
      title: `${missingGroups.length} active class${missingGroups.length === 1 ? "" : "es"} lack WhatsApp QR access`,
      detail: "Complete the class communication setup before distributing parent or student QR access.",
      icon: "qr",
      tone: "neutral",
    });
  }

  return items.slice(0, 6);
}
