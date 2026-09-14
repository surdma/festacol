import { BarChart3, CheckCircle2, ClipboardList, ShieldCheck } from "lucide-react";
import { AdminPageHeader } from "@/components/admin/admin-ui";
import { MetricCard } from "@/components/metric-card";
import { currentStaff, examVisibleTo } from "@/lib/auth/staff";
import { ReportsTabs } from "./reports-tabs";

export default async function AdminReportsPage({ searchParams }: { searchParams: Promise<{ view?: string }> }) {
  const params = await searchParams;
  const view = params.view === "students" || params.view === "integrity" ? params.view : "exams";
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
    rewrite_archived_at?: number | null;
  }[]);
  const rows = all.filter((attempt) => {
    if (attempt.rewrite_archived_at) return false;
    if (scope.isAdmin) return true;
    if (!attempt.session_id) return false;
    const session = meta.get(attempt.session_id);
    return Boolean(session && examVisibleTo(session, scope));
  });
  const visibleHashes = new Set(rows.map((attempt) => attempt.attempt_hash));
  const names = new Map(rows.map((attempt) => [attempt.attempt_hash, attempt.student_name]));
  const quietEvents = new Set(["focus-return", "fullscreen-enter", "camera-restored", "background-resume-reconciled"]);
  const feed = (((events ?? []) as { type: string; attempt_hash: string | null; session_id: string; at: number }[])
    .filter((event) => !quietEvents.has(event.type) && event.attempt_hash && visibleHashes.has(event.attempt_hash))
    .slice(0, 100)
    .map((event) => ({ student: names.get(event.attempt_hash!) ?? "Candidate", type: event.type, hash: event.attempt_hash!, at: Number(event.at) })));
  const submitted = rows.filter((attempt) => attempt.submitted_at);
  const averageScore = submitted.length ? Math.round(submitted.reduce((sum, attempt) => sum + Number(attempt.score ?? 0), 0) / submitted.length) : 0;
  const averageIntegrity = submitted.length ? Math.round(submitted.reduce((sum, attempt) => sum + Number(attempt.integrity_score ?? 100), 0) / submitted.length) : 100;
  const reviewedHashes = new Set(feed.map((event) => event.hash));
  const titles = Object.fromEntries(sessionRows.map((session) => [session.id, session.title]));

  return (
    <div className="flex flex-col gap-5">
      <AdminPageHeader
        eyebrow="Performance and audit"
        title="Reports"
        description={scope.isAdmin ? "Monitor assessment performance and integrity events across the school." : "Reports are restricted to examinations visible inside your subject and qualifier scope."}
      />
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard label="Attempts" value={String(rows.length)} detail={`${submitted.length} submitted`} icon={ClipboardList} />
        <MetricCard label="Average score" value={`${averageScore}%`} detail="submitted attempts" icon={BarChart3} />
        <MetricCard label="Average integrity" value={`${averageIntegrity}%`} detail="submitted attempts" icon={ShieldCheck} />
        <MetricCard label="Needs integrity review" value={String(reviewedHashes.size)} detail={`${feed.length} review-worthy events`} icon={CheckCircle2} />
      </div>
      <ReportsTabs attempts={rows} titles={titles} feed={feed} initialView={view} />
    </div>
  );
}
