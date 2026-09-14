import { BarChart3, ClipboardCheck, History, ShieldCheck } from "lucide-react";
import { AdminMetricCard, AdminPageHeader } from "@/components/admin/admin-ui";
import { currentStaff, examVisibleTo } from "@/lib/auth/staff";
import { ReportsTabs } from "./reports-tabs";

const REPORT_VIEWS = new Set(["overview", "exams", "students", "placements", "integrity"]);

type ReportView = "overview" | "exams" | "students" | "placements" | "integrity";

export default async function AdminReportsPage({ searchParams }: { searchParams: Promise<{ view?: string }> }) {
  const params = await searchParams;
  const requested = String(params.view ?? "overview");
  const view = (REPORT_VIEWS.has(requested) ? requested : "overview") as ReportView;
  const { supabase, scope } = await currentStaff();
  const [{ data: attempts }, { data: sessions }, { data: events }] = await Promise.all([
    supabase.from("exam_attempts").select("*").order("created_at", { ascending: false }).limit(1000),
    supabase.from("exam_sessions").select("id,title,subjects,mode,cohosts").limit(300),
    supabase.from("exam_integrity_events").select("type,attempt_hash,session_id,at").order("at", { ascending: false }).limit(800),
  ]);
  const sessionRows = ((sessions ?? []) as { id: string; title: string; subjects: string[]; mode: string; cohosts: string[] }[]);
  const meta = new Map(sessionRows.map((session) => [session.id, session]));
  const all = ((attempts ?? []) as {
    attempt_hash: string;
    session_id: string | null;
    session_title: string;
    student_name: string;
    score: number | null;
    integrity_score: number | null;
    submitted_at: number | null;
    rewrite_archived_at: number | null;
    assigned_track: string | null;
    placement_confidence: number | null;
  }[]).filter((attempt) => {
    if (scope.isAdmin) return true;
    if (!attempt.session_id) return false;
    const session = meta.get(attempt.session_id);
    return Boolean(session && examVisibleTo(session, scope));
  });
  const current = all.filter((attempt) => !attempt.rewrite_archived_at);
  const visibleHashes = new Set(current.map((attempt) => attempt.attempt_hash));
  const names = new Map(current.map((attempt) => [attempt.attempt_hash, attempt.student_name]));
  const quietEvents = new Set(["focus-return", "fullscreen-enter", "camera-restored", "background-resume-reconciled"]);
  const feed = (((events ?? []) as { type: string; attempt_hash: string | null; session_id: string; at: number }[])
    .filter((event) => !quietEvents.has(event.type) && event.attempt_hash && visibleHashes.has(event.attempt_hash))
    .slice(0, 100)
    .map((event) => ({ student: names.get(event.attempt_hash!) ?? "Candidate", type: event.type, hash: event.attempt_hash!, at: Number(event.at) })));
  const submitted = current.filter((attempt) => attempt.submitted_at);
  const averageScore = submitted.length ? Math.round(submitted.reduce((sum, attempt) => sum + Number(attempt.score ?? 0), 0) / submitted.length) : 0;
  const averageIntegrity = submitted.length ? Math.round(submitted.reduce((sum, attempt) => sum + Number(attempt.integrity_score ?? 100), 0) / submitted.length) : 100;
  const titles = Object.fromEntries(sessionRows.map((session) => [session.id, session.title]));

  return (
    <div>
      <AdminPageHeader eyebrow="Academic intelligence" title="Reports" description="Exam, student, placement and integrity records share the same production attempt relationships." />
      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <AdminMetricCard label="Submissions" value={String(submitted.length)} detail="current completed attempts" icon={ClipboardCheck} />
        <AdminMetricCard label="Average" value={`${averageScore}%`} detail="current attempt average" icon={BarChart3} />
        <AdminMetricCard label="Integrity" value={`${averageIntegrity}%`} detail="browser signal score" icon={ShieldCheck} />
        <AdminMetricCard label="Previous attempts" value={String(all.filter((attempt) => attempt.rewrite_archived_at).length)} detail="preserved rewrite history" icon={History} />
      </section>
      <ReportsTabs attempts={current} titles={titles} feed={feed} initialView={view} />
    </div>
  );
}
