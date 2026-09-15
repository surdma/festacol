import { currentStaff, examVisibleTo } from "@/lib/auth/staff";
import { FadeUp } from "@/components/motion";
import { MetricCard } from "@/components/metric-card";
import { ReportsTabs } from "./reports-tabs";
import { ClipboardList, BarChart3, ShieldCheck } from "lucide-react";

export default async function AdminReportsPage() {
  const { supabase, scope } = await currentStaff();
  const [{ data: attempts }, { data: sessions }, { data: events }] = await Promise.all([
    supabase.from("exam_attempts").select("*").order("created_at", { ascending: false }).limit(300),
    supabase.from("exam_sessions").select("id,title,subjects,mode,cohosts").limit(100),
    supabase.from("exam_integrity_events").select("type,attempt_hash,session_id").order("at", { ascending: false }).limit(200),
  ]);
  const meta = new Map(
    ((sessions ?? []) as { id: string; title: string; subjects: string[]; mode: string; cohosts: string[] }[]).map((s) => [s.id, s]),
  );
  const all = ((attempts ?? []) as Record<string, unknown>[]) as {
    attempt_hash: string; session_id: string | null; session_title: string; student_name: string;
    score: number | null; integrity_score: number | null; submitted_at: number | null;
  }[];
  const rows = all.filter((a) => {
    if (scope.isAdmin) return true;
    if (!a.session_id) return false;
    const m = meta.get(a.session_id);
    if (!m) return false;
    return examVisibleTo(m, scope);
  });
  const visibleHashes = new Set(rows.map((a) => a.attempt_hash));
  const names = new Map(rows.map((a) => [a.attempt_hash, a.student_name]));
  const BORING = new Set(["focus-return", "fullscreen-enter", "camera-restored", "background-resume-reconciled"]);
  const feed = (((events ?? []) as { type: string; attempt_hash: string | null; session_id: string }[])
    .filter((e) => !BORING.has(e.type) && e.attempt_hash && visibleHashes.has(e.attempt_hash))
    .slice(0, 50)
    .map((e) => ({ student: names.get(e.attempt_hash!) ?? "—", type: e.type, hash: e.attempt_hash! })));
  const submitted = rows.filter((a) => a.submitted_at);
  const avg = submitted.length ? Math.round(submitted.reduce((s, a) => s + (a.score ?? 0), 0) / submitted.length) : 0;
  const integrity = submitted.length ? Math.round(submitted.reduce((s, a) => s + (a.integrity_score ?? 100), 0) / submitted.length) : 100;
  const titles = new Map([...meta.values()].map((s) => [s.id, s.title]));
  return (
    <FadeUp className="flex flex-col gap-4">
      <div><h1 className="text-2xl font-semibold">Reports</h1><p className="text-muted-foreground">
        {scope.isAdmin ? "Route: /admin/reports — attempts open as dialogs" : "Scoped to your subjects"}
      </p></div>
      <div className="grid grid-cols-2 gap-4 xl:grid-cols-3">
        <MetricCard label="Attempts" value={String(rows.length)} icon={ClipboardList} />
        <MetricCard label="Average score" value={`${avg}%`} icon={BarChart3} />
        <MetricCard label="Integrity" value={`${integrity}%`} icon={ShieldCheck} />
      </div>
      <ReportsTabs attempts={rows} titles={Object.fromEntries(titles)} feed={feed} />
    </FadeUp>
  );
}
