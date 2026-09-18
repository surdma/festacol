import { BarChart3, ClipboardCheck, History, ShieldCheck } from "lucide-react";
import { AdminMetricCard, AdminPageHeader } from "@/components/admin/admin-ui";
import { currentStaff } from "@/lib/auth/staff";
import type { AcademicTrack, ExamAttemptContextSnapshot } from "@/types/db";
import { ReportsTabs } from "./reports-tabs";

const REPORT_VIEWS = new Set(["overview", "exams", "students", "placements", "integrity"]);

type ReportView = "overview" | "exams" | "students" | "placements" | "integrity";

interface ReportAttemptRow {
  id: string;
  session_id: string;
  student_id: string;
  attempt_number: number;
  context_snapshot: ExamAttemptContextSnapshot;
  score: number | null;
  integrity_score: number | null;
  submitted_at: number | null;
  assigned_track: AcademicTrack | null;
  placement_confidence: number | null;
}

export default async function AdminReportsPage({ searchParams }: { searchParams: Promise<{ view?: string }> }) {
  const params = await searchParams;
  const requested = String(params.view ?? "overview");
  const view = (REPORT_VIEWS.has(requested) ? requested : "overview") as ReportView;
  const { supabase } = await currentStaff();
  const [{ data: attempts }, { data: sessions }, { data: events }] = await Promise.all([
    supabase
      .from("exam_attempts")
      .select("id,session_id,student_id,attempt_number,context_snapshot,score,integrity_score,submitted_at,assigned_track,placement_confidence")
      .order("created_at", { ascending: false })
      .limit(1000),
    supabase.from("exam_sessions").select("id,title").limit(300),
    supabase.from("exam_integrity_events").select("attempt_id,type,at").order("at", { ascending: false }).limit(800),
  ]);

  const rows = (attempts ?? []) as ReportAttemptRow[];
  const reportAttempts = rows.map((attempt) => ({
    id: attempt.id,
    session_id: attempt.session_id,
    student_id: attempt.student_id,
    attempt_number: attempt.attempt_number,
    student_name: attempt.context_snapshot?.studentName?.trim() || "Candidate",
    session_title: attempt.context_snapshot?.sessionTitle?.trim() || attempt.session_id,
    score: attempt.score,
    integrity_score: attempt.integrity_score,
    submitted_at: attempt.submitted_at,
    assigned_track: attempt.assigned_track,
    placement_confidence: attempt.placement_confidence,
    mode: attempt.context_snapshot?.mode ?? null,
  }));

  const visibleAttemptIds = new Set(reportAttempts.map((attempt) => attempt.id));
  const names = new Map(reportAttempts.map((attempt) => [attempt.id, attempt.student_name]));
  const quietEvents = new Set(["focus-return", "fullscreen-enter", "camera-restored", "background-resume-reconciled"]);
  const feed = (((events ?? []) as { attempt_id: string; type: string; at: number }[])
    .filter((event) => !quietEvents.has(event.type) && visibleAttemptIds.has(event.attempt_id))
    .slice(0, 100)
    .map((event) => ({ student: names.get(event.attempt_id) ?? "Candidate", type: event.type, attemptId: event.attempt_id, at: Number(event.at) })));

  const submitted = reportAttempts.filter((attempt) => attempt.submitted_at);
  const averageScore = submitted.length ? Math.round(submitted.reduce((sum, attempt) => sum + Number(attempt.score ?? 0), 0) / submitted.length) : 0;
  const averageIntegrity = submitted.length ? Math.round(submitted.reduce((sum, attempt) => sum + Number(attempt.integrity_score ?? 100), 0) / submitted.length) : 100;
  const retakeAttempts = reportAttempts.filter((attempt) => attempt.attempt_number > 1).length;
  const titles = Object.fromEntries(((sessions ?? []) as { id: string; title: string }[]).map((session) => [session.id, session.title]));

  return (
    <div>
      <AdminPageHeader eyebrow="Academic intelligence" title="Reports" description="Exam, student, placement and integrity records share the same production attempt relationships." />
      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <AdminMetricCard label="Submissions" value={String(submitted.length)} detail="completed visible attempts" icon={ClipboardCheck} />
        <AdminMetricCard label="Average" value={`${averageScore}%`} detail="submitted attempt average" icon={BarChart3} />
        <AdminMetricCard label="Integrity" value={`${averageIntegrity}%`} detail="browser signal score" icon={ShieldCheck} />
        <AdminMetricCard label="Retake attempts" value={String(retakeAttempts)} detail="attempt number greater than one" icon={History} />
      </section>
      <ReportsTabs attempts={reportAttempts} titles={titles} feed={feed} initialView={view} />
    </div>
  );
}
