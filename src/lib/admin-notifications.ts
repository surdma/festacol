import type { StaffScope } from "@/lib/auth/staff";
import { createSupabaseServerClient } from "@/lib/supabase/server";
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

async function visibleSessionIds(
  supabase: ServerSupabaseClient,
  scope: StaffScope,
  sessions: SessionRow[],
): Promise<Set<string>> {
  if (scope.isAdmin) return new Set(sessions.map((session) => session.id));
  if (!scope.profileId) return new Set();

  const [{ data: examAssignments }, { data: teachingAssignments }] = await Promise.all([
    supabase.from("exam_staff_assignments").select("session_id").eq("staff_id", scope.profileId),
    supabase.from("teaching_assignments").select("offering_id").eq("staff_id", scope.profileId).is("ended_at", null),
  ]);
  const offeringIds = ((teachingAssignments ?? []) as { offering_id: string }[]).map((row) => row.offering_id);
  const [{ data: offeringTargets }, { data: assignedOfferings }] = offeringIds.length
    ? await Promise.all([
        supabase.from("exam_offering_targets").select("session_id").in("offering_id", offeringIds),
        supabase.from("class_subject_offerings").select("id,class_id").in("id", offeringIds),
      ])
    : [{ data: [] }, { data: [] }];
  const classIds = [...new Set(((assignedOfferings ?? []) as { id: string; class_id: string }[]).map((row) => row.class_id))];
  const { data: classTargets } = classIds.length
    ? await supabase.from("exam_class_targets").select("session_id").in("class_id", classIds)
    : { data: [] };

  return new Set([
    ...sessions.filter((session) => session.created_by_id === scope.profileId).map((session) => session.id),
    ...((examAssignments ?? []) as { session_id: string }[]).map((row) => row.session_id),
    ...((offeringTargets ?? []) as { session_id: string }[]).map((row) => row.session_id),
    ...((classTargets ?? []) as { session_id: string }[]).map((row) => row.session_id),
  ]);
}

export async function getAdminTopbarNotifications(
  supabase: ServerSupabaseClient,
  scope: StaffScope,
): Promise<ApplicationNotification[]> {
  const [sessionsResult, attemptsResult, eventsResult, classesResult, groupsResult] = await Promise.all([
    supabase.from("exam_sessions").select("id,title,status,created_by_id").limit(200),
    supabase
      .from("exam_attempts")
      .select("id,session_id,student_id,attempt_number,started_at,submitted_at,score")
      .order("updated_at", { ascending: false })
      .limit(500),
    supabase.from("exam_integrity_events").select("attempt_id").limit(500),
    supabase.from("classes").select("id,status").limit(200),
    supabase.from("whatsapp_groups").select("class_id").limit(300),
  ]);

  const sessions = (sessionsResult.data ?? []) as SessionRow[];
  const allowedSessionIds = await visibleSessionIds(supabase, scope, sessions);
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

  const drafts = visibleSessions.filter((session) => session.status === "draft");
  const activeAttempts = attempts.filter((attempt) => attempt.started_at && !attempt.submitted_at);
  const submittedIds = new Set(attempts.filter((attempt) => attempt.submitted_at).map((attempt) => attempt.id));
  const integrityAttempts = new Set(events.map((event) => event.attempt_id).filter((attemptId) => submittedIds.has(attemptId)));
  const activeClasses = classes.filter((item) => item.status === "active");
  const groupedClasses = new Set(groups.map((group) => group.class_id));
  const missingGroups = scope.isAdmin ? activeClasses.filter((item) => !groupedClasses.has(item.id)) : [];
  const recentLifecycle = attempts
    .filter((attempt) => Boolean(attempt.started_at))
    .toSorted((left, right) => Math.max(Number(right.submitted_at ?? 0), Number(right.started_at ?? 0)) - Math.max(Number(left.submitted_at ?? 0), Number(left.started_at ?? 0)))
    .slice(0, 4);

  const items: ApplicationNotification[] = [];
  for (const attempt of recentLifecycle) {
    const sessionTitle = sessionTitles.get(attempt.session_id) ?? "Examination";
    const studentName = studentNames.get(attempt.student_id) ?? "Student";
    const attemptNumber = Math.max(1, Number(attempt.attempt_number ?? 1));
    if (attempt.submitted_at) {
      const scoreDetail = attempt.score === null ? "The recorded result is available in the examination workspace." : `Recorded score: ${Math.round(attempt.score)}%.`;
      items.push({
        id: `exam-submission-${attempt.id}`,
        title: `${studentName} submitted ${sessionTitle}`,
        detail: `Attempt #${attemptNumber} is complete. ${scoreDetail}`,
        icon: "chart",
        tone: "blue",
      });
    } else {
      items.push({
        id: `exam-start-${attempt.id}`,
        title: `${studentName} started ${sessionTitle}`,
        detail: `Attempt #${attemptNumber} is currently in progress. Open Examinations to see Supabase Realtime Presence for active candidates.`,
        icon: "clock",
        tone: "blue",
      });
    }
  }
  if (drafts.length) {
    items.push({
      id: "draft-exams",
      title: `${drafts.length} draft exam${drafts.length === 1 ? "" : "s"} need review`,
      detail:
        "There are unpublished examinations in your current staff scope. Review their questions, targeting, duration and controls before deciding whether they are ready to publish.",
      icon: "book",
      tone: "amber",
    });
  }
  if (activeAttempts.length) {
    items.push({
      id: "active-attempts",
      title: `${activeAttempts.length} attempt${activeAttempts.length === 1 ? " is" : "s are"} in progress`,
      detail:
        "Candidates currently have active examination attempts that have not been submitted. Open Examinations to see which sessions currently have connected candidates.",
      icon: "clock",
      tone: "blue",
    });
  }
  if (integrityAttempts.size) {
    items.push({
      id: "integrity-events",
      title: `${integrityAttempts.size} submitted attempt${integrityAttempts.size === 1 ? " has" : "s have"} integrity events`,
      detail:
        "One or more submitted attempts include recorded integrity events. Review the attempt-level integrity history before making any academic or administrative decision.",
      icon: "shield",
      tone: "red",
    });
  }
  if (missingGroups.length) {
    items.push({
      id: "missing-whatsapp-groups",
      title: `${missingGroups.length} active class${missingGroups.length === 1 ? "" : "es"} lack WhatsApp QR access`,
      detail:
        "These active classes do not yet have a linked WhatsApp group record. Complete the class communication setup before distributing parent or student QR access.",
      icon: "qr",
      tone: "neutral",
    });
  }
  return items;
}
