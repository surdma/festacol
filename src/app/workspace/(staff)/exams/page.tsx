import Link from "next/link";
import { BookOpenCheck, CheckCircle2, Clock3, Plus, ShieldAlert } from "lucide-react";
import { ExamDirectoryTable, type ExamDirectoryTableRow } from "@/components/admin/exam-directory-table";
import {
  AdminFilterLinks,
  AdminMetricCard,
  AdminPageHeader,
  AdminSearchForm,
  adminPrimaryButtonClass,
  adminSurfaceClass,
} from "@/components/admin/admin-ui";
import { currentStaff } from "@/lib/auth/staff";
import { listSessions } from "@/lib/supabase/queries";

function examState(session: { status: string; starts_at: number | null; ends_at: number | null }) {
  const now = Date.now();
  if (session.status === "closed" || (session.ends_at && now > session.ends_at)) return "closed";
  if (session.status === "draft") return "draft";
  if (session.starts_at && now < session.starts_at) return "scheduled";
  return session.status === "open" ? "open" : session.status;
}

export default async function AdminExamsPage({ searchParams }: { searchParams: Promise<{ q?: string; status?: string }> }) {
  const params = await searchParams;
  const q = String(params.q ?? "").trim().toLowerCase();
  const status = ["open", "scheduled", "draft", "closed"].includes(String(params.status)) ? String(params.status) : "all";
  const { supabase, scope } = await currentStaff();
  const [allSessions, attemptsResult, eventsResult, subjectResult] = await Promise.all([
    listSessions(supabase),
    supabase.from("exam_attempts").select("session_id,submitted_at").limit(2000),
    supabase.from("exam_integrity_events").select("attempt_id").limit(3000),
    supabase.from("subjects").select("id,name").eq("active", true),
  ]);
  const subjectNames = new Map(((subjectResult.data ?? []) as { id: string; name: string }[]).map((row) => [row.id, row.name]));
  const scopedNames = scope.subjectIds.map((id) => subjectNames.get(id) ?? id);
  const sessions = allSessions
    .filter((session) => !q || `${session.title} ${session.id} ${session.targetLabels.join(" ")} ${session.subjectNames.join(" ")}`.toLowerCase().includes(q))
    .filter((session) => status === "all" || examState(session) === status);

  const counts = new Map<string, { total: number; submitted: number }>();
  let submittedCount = 0;
  for (const attempt of ((attemptsResult.data ?? []) as { session_id: string; submitted_at: number | null }[])) {
    const value = counts.get(attempt.session_id) ?? { total: 0, submitted: 0 };
    value.total += 1;
    if (attempt.submitted_at) {
      value.submitted += 1;
      submittedCount += 1;
    }
    counts.set(attempt.session_id, value);
  }
  const integrityEvents = (eventsResult.data ?? []).length;
  const tableRows: ExamDirectoryTableRow[] = sessions.map((session) => {
    const attemptCount = counts.get(session.id) ?? { total: 0, submitted: 0 };
    return {
      id: session.id,
      title: session.title,
      targetLabels: session.targetLabels,
      subjectNames: session.subjectNames,
      mode: session.mode,
      state: examState(session),
      attempts: attemptCount.total,
      submitted: attemptCount.submitted,
    };
  });

  return (
    <div>
      <AdminPageHeader
        eyebrow="Assessment operations"
        title="Examinations"
        description={scope.isAdmin ? "Create, distribute, update and audit examinations without exposing raw candidate URLs." : `Scoped to ${scopedNames.join(", ") || "your assigned subject offerings"}${scope.qualifierAccess ? " plus qualifier examinations" : ""}.`}
        actions={
          <Link href="/workspace/exams?modal=create-exam" className={adminPrimaryButtonClass}>
            <Plus data-icon="inline-start" />Create exam
          </Link>
        }
      />

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <AdminMetricCard label="Sessions" value={String(allSessions.length)} detail="visible examinations" icon={BookOpenCheck} />
        <AdminMetricCard label="Live" value={String(allSessions.filter((session) => examState(session) === "open").length)} detail="currently open" icon={Clock3} />
        <AdminMetricCard label="Submitted" value={String(submittedCount)} detail="submitted attempts" icon={CheckCircle2} />
        <AdminMetricCard label="Integrity events" value={String(integrityEvents)} detail="attempt-scoped events" icon={ShieldAlert} />
      </section>

      <div className="mt-5 mb-4">
        <AdminSearchForm query={params.q} placeholder="Search title, Exam ID, class or subject" hidden={{ status: status === "all" ? undefined : status }} />
      </div>

      <section className={`${adminSurfaceClass} overflow-hidden`}>
        <div className="flex flex-col gap-3 border-b border-border p-4 sm:flex-row sm:items-center sm:justify-between">
          <AdminFilterLinks pathname="/workspace/exams" param="status" current={status} preserve={{ q: params.q }} options={[{ value: "all", label: "All" }, { value: "open", label: "Open" }, { value: "scheduled", label: "Scheduled" }, { value: "draft", label: "Draft" }, { value: "closed", label: "Closed" }]} />
        </div>
        <ExamDirectoryTable rows={tableRows} />
      </section>
    </div>
  );
}
