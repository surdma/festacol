import { examVisibleTo, type StaffScope } from "@/lib/auth/staff";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { AdminTopbarNotification } from "@/types/admin";
import type { ExamSessionRow } from "@/types/db";

type ServerSupabaseClient = Awaited<ReturnType<typeof createSupabaseServerClient>>;
type SessionScopeRow = Pick<ExamSessionRow, "id" | "mode" | "subjects" | "cohosts" | "status">;

interface AttemptQueueRow {
  attempt_hash: string;
  session_id: string | null;
  started_at: number | null;
  submitted_at: number | null;
  rewrite_archived_at: number | null;
}

interface IntegrityQueueRow {
  session_id: string;
  attempt_hash: string | null;
}

interface ClassQueueRow {
  id: string;
  status: string;
}

interface WhatsappQueueRow {
  class_id: string;
}

export async function getAdminTopbarNotifications(
  supabase: ServerSupabaseClient,
  scope: StaffScope,
): Promise<AdminTopbarNotification[]> {
  const [sessionsResult, attemptsResult, eventsResult, classesResult, groupsResult] = await Promise.all([
    supabase.from("exam_sessions").select("id,mode,subjects,cohosts,status").limit(200),
    supabase.from("exam_attempts").select("attempt_hash,session_id,started_at,submitted_at,rewrite_archived_at").limit(500),
    supabase.from("exam_integrity_events").select("session_id,attempt_hash").limit(500),
    supabase.from("classes").select("id,status").limit(200),
    supabase.from("whatsapp_groups").select("class_id").limit(300),
  ]);

  const visibleSessions = ((sessionsResult.data ?? []) as SessionScopeRow[]).filter((session) => examVisibleTo(session, scope));
  const visibleSessionIds = new Set(visibleSessions.map((session) => session.id));
  const attempts = ((attemptsResult.data ?? []) as AttemptQueueRow[]).filter((attempt) =>
    scope.isAdmin || Boolean(attempt.session_id && visibleSessionIds.has(attempt.session_id)),
  );
  const events = ((eventsResult.data ?? []) as IntegrityQueueRow[]).filter((event) =>
    scope.isAdmin || visibleSessionIds.has(event.session_id),
  );
  const classes = (classesResult.data ?? []) as ClassQueueRow[];
  const groups = (groupsResult.data ?? []) as WhatsappQueueRow[];

  const drafts = visibleSessions.filter((session) => session.status === "draft");
  const activeAttempts = attempts.filter((attempt) => attempt.started_at && !attempt.submitted_at && !attempt.rewrite_archived_at);
  const submittedHashes = new Set(
    attempts
      .filter((attempt) => attempt.submitted_at && !attempt.rewrite_archived_at)
      .map((attempt) => attempt.attempt_hash),
  );
  const integrityAttempts = new Set(
    events
      .map((event) => event.attempt_hash)
      .filter((attemptHash): attemptHash is string => Boolean(attemptHash && submittedHashes.has(attemptHash))),
  );
  const activeClasses = classes.filter((item) => item.status === "active");
  const groupedClasses = new Set(groups.map((group) => group.class_id));
  const missingGroups = scope.isAdmin ? activeClasses.filter((item) => !groupedClasses.has(item.id)) : [];

  const items: AdminTopbarNotification[] = [];
  if (drafts.length) {
    items.push({
      href: "/admin/exams?status=draft",
      title: `${drafts.length} draft exam${drafts.length === 1 ? "" : "s"} need review`,
      detail: "Open examinations to publish or refine them.",
      icon: "book",
      tone: "amber",
    });
  }
  if (activeAttempts.length) {
    items.push({
      href: "/admin/exams",
      title: `${activeAttempts.length} attempt${activeAttempts.length === 1 ? " is" : "s are"} in progress`,
      detail: "Monitor current candidate activity.",
      icon: "clock",
      tone: "blue",
    });
  }
  if (integrityAttempts.size) {
    items.push({
      href: "/admin/reports?view=integrity",
      title: `${integrityAttempts.size} submitted attempt${integrityAttempts.size === 1 ? " has" : "s have"} integrity events`,
      detail: "Review exact attempt logs.",
      icon: "shield",
      tone: "red",
    });
  }
  if (missingGroups.length) {
    items.push({
      href: "/admin/classes",
      title: `${missingGroups.length} active class${missingGroups.length === 1 ? "" : "es"} lack WhatsApp QR access`,
      detail: "Complete class communication setup.",
      icon: "qr",
      tone: "neutral",
    });
  }

  return items;
}
