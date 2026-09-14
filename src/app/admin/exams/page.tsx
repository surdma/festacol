import Link from "next/link";
import { BookOpenCheck, CheckCircle2, Clock3, MoreHorizontal, Plus, ShieldAlert } from "lucide-react";
import {
  AdminEmptyState,
  AdminFilterLinks,
  AdminMetricCard,
  AdminPageHeader,
  AdminSearchForm,
  adminIconButtonClass,
  adminPrimaryButtonClass,
  adminSurfaceClass,
} from "@/components/admin/admin-ui";
import { StatusBadge } from "@/components/status-badge";
import { Button } from "@/components/ui/button";
import { currentStaff, examVisibleTo } from "@/lib/auth/staff";
import { listSessions } from "@/lib/supabase/queries";
import type { ExamSessionRow } from "@/types/db";

function examState(session: ExamSessionRow): "open" | "draft" | "scheduled" | "closed" {
  const now = Date.now();
  if (session.status === "draft") return "draft";
  if (session.status === "closed") return "closed";
  if (session.starts_at && Number(session.starts_at) > now) return "scheduled";
  if (session.ends_at && Number(session.ends_at) < now) return "closed";
  return "open";
}

function stateTone(state: string) {
  if (state === "open") return "emerald";
  if (state === "draft" || state === "scheduled") return "amber";
  return "neutral";
}

export default async function AdminExamsPage({ searchParams }: { searchParams: Promise<{ q?: string; status?: string }> }) {
  const params = await searchParams;
  const q = String(params.q ?? "").trim().toLowerCase();
  const status = ["open", "draft", "scheduled", "closed"].includes(String(params.status)) ? String(params.status) : "all";
  const { supabase, scope } = await currentStaff();
  const [allSessions, attemptsResult, eventsResult] = await Promise.all([
    listSessions(supabase),
    supabase.from("exam_attempts").select("session_id,submitted_at,rewrite_archived_at").limit(2000),
    supabase.from("exam_integrity_events").select("session_id").limit(5000),
  ]);

  const visibleSessions = allSessions.filter((session) => examVisibleTo(session, scope));
  const sessions = visibleSessions
    .filter((session) => !q || `${session.title} ${session.id} ${session.class_level} ${session.class_group} ${(session.subjects ?? []).join(" ")}`.toLowerCase().includes(q))
    .filter((session) => status === "all" || examState(session) === status);

  const visibleIds = new Set(visibleSessions.map((session) => session.id));
  const counts = new Map<string, { total: number; submitted: number }>();
  let submittedCount = 0;
  for (const attempt of ((attemptsResult.data ?? []) as { session_id: string | null; submitted_at: number | null; rewrite_archived_at: number | null }[])) {
    if (!attempt.session_id || attempt.rewrite_archived_at) continue;
    const value = counts.get(attempt.session_id) ?? { total: 0, submitted: 0 };
    value.total += 1;
    if (attempt.submitted_at) { value.submitted += 1; if (visibleIds.has(attempt.session_id)) submittedCount += 1; }
    counts.set(attempt.session_id, value);
  }
  const integrityEvents = ((eventsResult.data ?? []) as { session_id: string }[]).filter((event) => visibleIds.has(event.session_id)).length;

  return (
    <div>
      <AdminPageHeader
        eyebrow="Assessment operations"
        title="Examinations"
        description={scope.isAdmin ? "Create, distribute, update and audit examinations without exposing raw candidate URLs." : `Scoped to ${scope.subjects.join(", ") || "your assigned subjects"}${scope.qualifierAccess ? " plus qualifier examinations" : ""}.`}
        actions={<Button render={<Link href="/admin/exams?modal=create-exam" />} className={adminPrimaryButtonClass}><Plus className="size-4" />Create exam</Button>}
      />

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <AdminMetricCard label="Sessions" value={String(visibleSessions.length)} detail="all visible examinations" icon={BookOpenCheck} />
        <AdminMetricCard label="Live" value={String(visibleSessions.filter((session) => examState(session) === "open").length)} detail="currently open" icon={Clock3} />
        <AdminMetricCard label="Submitted" value={String(submittedCount)} detail="current submitted attempts" icon={CheckCircle2} />
        <AdminMetricCard label="Integrity events" value={String(integrityEvents)} detail="attached to exam attempts" icon={ShieldAlert} />
      </section>

      <div className="mt-5 mb-4">
        <AdminSearchForm query={params.q} placeholder="Search title, Exam ID, class or subject" hidden={{ status: status === "all" ? undefined : status }} />
      </div>

      <section className={`${adminSurfaceClass} overflow-hidden`}>
        <div className="flex flex-col gap-3 border-b border-neutral-200 p-4 sm:flex-row sm:items-center sm:justify-between">
          <AdminFilterLinks
            pathname="/admin/exams"
            param="status"
            current={status}
            preserve={{ q: params.q }}
            options={[{ value: "all", label: "All" }, { value: "open", label: "Open" }, { value: "scheduled", label: "Scheduled" }, { value: "draft", label: "Draft" }, { value: "closed", label: "Closed" }]}
          />
          <span className="text-xs font-semibold text-neutral-500">{sessions.length} shown</span>
        </div>

        {sessions.length ? (
          <>
            <div className="hidden overflow-x-auto md:block">
              <table className="w-full text-left text-sm">
                <thead className="border-b border-neutral-200 bg-neutral-50 text-[11px] font-bold uppercase tracking-[.1em] text-neutral-500">
                  <tr><th className="whitespace-nowrap px-4 py-3">Exam</th><th className="whitespace-nowrap px-4 py-3">Audience</th><th className="whitespace-nowrap px-4 py-3">Paper</th><th className="whitespace-nowrap px-4 py-3">Attempts</th><th className="whitespace-nowrap px-4 py-3">Status</th><th className="whitespace-nowrap px-4 py-3"><span className="sr-only">Manage</span></th></tr>
                </thead>
                <tbody className="divide-y divide-neutral-100">
                  {sessions.map((session) => {
                    const state = examState(session);
                    const activity = counts.get(session.id) ?? { total: 0, submitted: 0 };
                    return (
                      <tr key={session.id} className="hover:bg-neutral-50">
                        <td className="px-4 py-3"><Link href={`/admin/exams?modal=exam&exam=${encodeURIComponent(session.id)}`} className="text-left"><strong className="block max-w-sm text-neutral-950">{session.title}</strong><span className="mt-1 block font-mono text-[11px] tracking-wider text-neutral-500">{session.id}</span></Link></td>
                        <td className="px-4 py-3"><span className="block text-xs font-semibold text-neutral-800">{session.class_level} · {session.class_group}</span><span className="mt-1 block max-w-xs text-xs text-neutral-500">{session.subjects?.length ? session.subjects.join(", ") : session.mode}</span></td>
                        <td className="px-4 py-3"><strong className="text-neutral-950">{session.question_count}</strong><span className="block text-xs text-neutral-500">{Math.round(session.duration_seconds / 60)} min</span></td>
                        <td className="px-4 py-3"><strong className="text-neutral-950">{activity.total}</strong><span className="block text-xs text-neutral-500">{activity.submitted} submitted</span></td>
                        <td className="px-4 py-3"><StatusBadge tone={stateTone(state)}>{state}</StatusBadge></td>
                        <td className="px-4 py-3 text-right"><Button size="icon" variant="outline" render={<Link href={`/admin/exams?modal=exam&exam=${encodeURIComponent(session.id)}`} />} className={adminIconButtonClass} aria-label={`Manage ${session.title}`}><MoreHorizontal className="size-4" /></Button></td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div className="divide-y divide-neutral-100 md:hidden">
              {sessions.map((session) => {
                const state = examState(session);
                const activity = counts.get(session.id) ?? { total: 0, submitted: 0 };
                return (
                  <Link key={session.id} href={`/admin/exams?modal=exam&exam=${encodeURIComponent(session.id)}`} className="block w-full p-4 text-left transition hover:bg-neutral-50">
                    <div className="flex items-start justify-between gap-3"><div className="min-w-0"><strong className="block truncate text-sm text-neutral-950">{session.title}</strong><span className="mt-1 block font-mono text-[11px] tracking-wider text-neutral-500">{session.id}</span></div><StatusBadge tone={stateTone(state)}>{state}</StatusBadge></div>
                    <div className="mt-3 grid grid-cols-3 gap-2 text-xs text-neutral-600"><span>{session.question_count} Q</span><span>{Math.round(session.duration_seconds / 60)} min</span><span>{activity.total} attempts</span></div>
                  </Link>
                );
              })}
            </div>
          </>
        ) : <AdminEmptyState title="No exams in this view" description="Change the filter or create a new examination." action={<Button render={<Link href="/admin/exams?modal=create-exam" />} className={adminPrimaryButtonClass}><Plus className="size-4" />Create exam</Button>} />}
      </section>
    </div>
  );
}
