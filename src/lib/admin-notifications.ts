import type { StaffScope } from "@/lib/auth/staff";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { ApplicationNotification } from "@/types/admin";

type ServerSupabaseClient = Awaited<ReturnType<typeof createSupabaseServerClient>>;

interface SessionRow {
  id: string;
  status: string;
  created_by_id: string | null;
}

interface AttemptQueueRow {
  id: string;
  session_id: string;
  started_at: number | null;
  submitted_at: number | null;
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
  const { data: offeringTargets } = offeringIds.length
    ? await supabase.from("exam_offering_targets").select("session_id").in("offering_id", offeringIds)
    : { data: [] };

  return new Set([
    ...sessions.filter((session) => session.created_by_id === scope.profileId).map((session) => session.id),
    ...((examAssignments ?? []) as { session_id: string }[]).map((row) => row.session_id),
    ...((offeringTargets ?? []) as { session_id: string }[]).map((row) => row.session_id),
  ]);
}

export async function getAdminTopbarNotifications(
  supabase: ServerSupabaseClient,
  scope: StaffScope,
): Promise<ApplicationNotification[]> {
  const [sessionsResult, attemptsResult, eventsResult, classesResult, groupsResult] = await Promise.all([
    supabase.from("exam_sessions").select("id,status,created_by_id").limit(200),
    supabase.from("exam_attempts").select("id,session_id,started_at,submitted_at").limit(500),
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

  const drafts = visibleSessions.filter((session) => session.status === "draft");
  const activeAttempts = attempts.filter((attempt) => attempt.started_at && !attempt.submitted_at);
  const submittedIds = new Set(attempts.filter((attempt) => attempt.submitted_at).map((attempt) => attempt.id));
  const integrityAttempts = new Set(events.map((event) => event.attempt_id).filter((attemptId) => submittedIds.has(attemptId)));
  const activeClasses = classes.filter((item) => item.status === "active");
  const groupedClasses = new Set(groups.map((group) => group.class_id));
  const missingGroups = scope.isAdmin ? activeClasses.filter((item) => !groupedClasses.has(item.id)) : [];

  const items: ApplicationNotification[] = [];
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
        "Candidates currently have active examination attempts that have not been submitted. Use the examination workspace when you need to inspect live candidate activity.",
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
