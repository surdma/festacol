"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { AdminEmptyState, adminSurfaceClass } from "@/components/admin/admin-ui";
import { StatusBadge } from "@/components/status-badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import type { AcademicTrack } from "@/types/db";

interface Attempt {
  id: string;
  session_id: string;
  student_id: string;
  attempt_number: number;
  session_title: string;
  student_name: string;
  score: number | null;
  integrity_score: number | null;
  submitted_at: number | null;
  assigned_track: AcademicTrack | null;
  placement_confidence: number | null;
}
interface FeedItem { student: string; type: string; attemptId: string; at?: number }
type ReportView = "overview" | "exams" | "students" | "placements" | "integrity";

const views: { value: ReportView; label: string }[] = [
  { value: "overview", label: "Overview" },
  { value: "exams", label: "Exams" },
  { value: "students", label: "Students" },
  { value: "placements", label: "Placements" },
  { value: "integrity", label: "Integrity" },
];

function dateTime(value: number | null | undefined) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("en-NG", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
}

function trackLabel(track: AcademicTrack | null) {
  if (track === "science") return "Science";
  if (track === "humanities") return "Humanities";
  if (track === "business") return "Business";
  return "—";
}

export function ReportsTabs({ attempts, titles, feed, initialView }: { attempts: Attempt[]; titles: Record<string, string>; feed: FeedItem[]; initialView: ReportView }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();

  const byExam = new Map<string, { total: number; sum: number; submitted: number; title: string }>();
  for (const attempt of attempts) {
    const value = byExam.get(attempt.session_id) ?? { total: 0, sum: 0, submitted: 0, title: titles[attempt.session_id] ?? attempt.session_title };
    value.total += 1;
    if (attempt.submitted_at) {
      value.submitted += 1;
      value.sum += attempt.score ?? 0;
    }
    byExam.set(attempt.session_id, value);
  }

  const byStudent = new Map<string, { name: string; total: number; sum: number; integrity: number; latest: string }>();
  for (const attempt of attempts.filter((item) => item.submitted_at)) {
    const value = byStudent.get(attempt.student_id) ?? { name: attempt.student_name, total: 0, sum: 0, integrity: 0, latest: attempt.id };
    value.name = attempt.student_name;
    value.total += 1;
    value.sum += attempt.score ?? 0;
    value.integrity += attempt.integrity_score ?? 100;
    value.latest = attempt.id;
    byStudent.set(attempt.student_id, value);
  }

  const placements = attempts.filter((attempt) => attempt.assigned_track);
  const recent = [...attempts]
    .filter((attempt) => attempt.submitted_at)
    .sort((a, b) => Number(b.submitted_at ?? 0) - Number(a.submitted_at ?? 0))
    .slice(0, 8);

  function changeView(value: string) {
    const next = new URLSearchParams(params.toString());
    next.set("view", value);
    for (const key of ["modal", "attempt", "exam", "student", "question", "class", "staff", "group"]) next.delete(key);
    router.replace(`${pathname}?${next.toString()}`);
  }

  return (
    <Tabs value={initialView} onValueChange={changeView} className="mt-5 gap-4">
      <TabsList variant="line" className="h-auto max-w-full justify-start gap-1 overflow-x-auto rounded-lg border border-neutral-300 bg-white p-1 shadow-none">
        {views.map((view) => <TabsTrigger key={view.value} value={view.value} className="min-h-9 rounded-md border-0 px-3 text-xs font-semibold text-neutral-600 data-active:bg-black data-active:text-white">{view.label}</TabsTrigger>)}
      </TabsList>

      <TabsContent value="overview">
        <section className={cn(adminSurfaceClass, "overflow-hidden")}>
          <div className="border-b border-neutral-200 p-5"><p className="text-[10px] font-bold uppercase tracking-[.14em] text-neutral-500">Latest activity</p><h2 className="mt-1 font-display text-lg font-extrabold text-neutral-950">Recent submissions</h2></div>
          {recent.length ? <div className="divide-y divide-neutral-100">{recent.map((attempt) => <Link key={attempt.id} href={`/workspace/reports?view=overview&modal=attempt&attempt=${encodeURIComponent(attempt.id)}`} className="grid gap-2 p-4 transition hover:bg-neutral-50 sm:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)_auto] sm:items-center"><span><strong className="block text-sm text-neutral-950">{attempt.student_name}</strong><span className="mt-1 block text-xs text-neutral-500">{attempt.session_title}</span></span><span className="text-xs text-neutral-500">{dateTime(attempt.submitted_at)}</span><span className="font-display text-lg font-extrabold tabular-nums text-neutral-950">{attempt.score ?? 0}%</span></Link>)}</div> : <AdminEmptyState title="No submissions yet" description="Completed attempts will appear here as candidates submit examinations." />}
        </section>
      </TabsContent>

      <TabsContent value="exams">
        <section className={cn(adminSurfaceClass, "overflow-hidden")}>
          {byExam.size ? <div className="overflow-x-auto"><table className="w-full text-left text-sm"><thead className="border-b border-neutral-200 bg-neutral-50 text-[11px] font-bold uppercase tracking-[.1em] text-neutral-500"><tr><th className="px-4 py-3">Exam</th><th className="px-4 py-3">Attempts</th><th className="px-4 py-3">Average</th></tr></thead><tbody className="divide-y divide-neutral-100">{[...byExam.entries()].map(([sessionId, value]) => <tr key={sessionId} className="hover:bg-neutral-50"><td className="px-4 py-3"><Link href={`/workspace/exams?modal=exam&exam=${encodeURIComponent(sessionId)}`} className="font-semibold hover:underline">{value.title}</Link></td><td className="px-4 py-3">{value.submitted}/{value.total} submitted</td><td className="px-4 py-3 font-semibold tabular-nums">{value.submitted ? `${Math.round(value.sum / value.submitted)}%` : "—"}</td></tr>)}</tbody></table></div> : <AdminEmptyState title="No exam data yet" description="Exam attempt data will appear here once candidates start papers." />}
        </section>
      </TabsContent>

      <TabsContent value="students">
        <section className={cn(adminSurfaceClass, "overflow-hidden")}>
          {byStudent.size ? <div className="overflow-x-auto"><table className="w-full text-left text-sm"><thead className="border-b border-neutral-200 bg-neutral-50 text-[11px] font-bold uppercase tracking-[.1em] text-neutral-500"><tr><th className="px-4 py-3">Student</th><th className="px-4 py-3">Submitted</th><th className="px-4 py-3">Average</th><th className="px-4 py-3">Integrity</th><th className="px-4 py-3">Latest attempt</th></tr></thead><tbody className="divide-y divide-neutral-100">{[...byStudent.entries()].map(([studentId, value]) => <tr key={studentId} className="hover:bg-neutral-50"><td className="px-4 py-3 font-semibold">{value.name}</td><td className="px-4 py-3">{value.total}</td><td className="px-4 py-3 tabular-nums">{Math.round(value.sum / value.total)}%</td><td className="px-4 py-3 tabular-nums">{Math.round(value.integrity / value.total)}%</td><td className="px-4 py-3"><Link href={`/workspace/reports?view=students&modal=attempt&attempt=${encodeURIComponent(value.latest)}`} className="text-xs font-semibold hover:underline">Open</Link></td></tr>)}</tbody></table></div> : <AdminEmptyState title="No student report data" description="Submitted student attempts will appear here." />}
        </section>
      </TabsContent>

      <TabsContent value="placements">
        <section className={cn(adminSurfaceClass, "overflow-hidden")}>
          {placements.length ? <div className="overflow-x-auto"><table className="w-full text-left text-sm"><thead className="border-b border-neutral-200 bg-neutral-50 text-[11px] font-bold uppercase tracking-[.1em] text-neutral-500"><tr><th className="px-4 py-3">Student</th><th className="px-4 py-3">Placement</th><th className="px-4 py-3">Confidence</th><th className="px-4 py-3">Attempt</th></tr></thead><tbody className="divide-y divide-neutral-100">{placements.map((attempt) => <tr key={attempt.id} className="hover:bg-neutral-50"><td className="px-4 py-3 font-semibold">{attempt.student_name}</td><td className="px-4 py-3"><StatusBadge tone="blue">{trackLabel(attempt.assigned_track)}</StatusBadge></td><td className="px-4 py-3 tabular-nums">{attempt.placement_confidence == null ? "—" : `${Math.round(Number(attempt.placement_confidence) * (Number(attempt.placement_confidence) <= 1 ? 100 : 1))}%`}</td><td className="px-4 py-3"><Link href={`/workspace/reports?view=placements&modal=attempt&attempt=${encodeURIComponent(attempt.id)}`} className="text-xs font-semibold hover:underline">Open</Link></td></tr>)}</tbody></table></div> : <AdminEmptyState title="No placement results yet" description="Qualifier placement outcomes will appear here after eligible attempts are submitted." />}
        </section>
      </TabsContent>

      <TabsContent value="integrity">
        <section className={cn(adminSurfaceClass, "overflow-hidden")}>
          {feed.length ? <div className="overflow-x-auto"><table className="w-full text-left text-sm"><thead className="border-b border-neutral-200 bg-neutral-50 text-[11px] font-bold uppercase tracking-[.1em] text-neutral-500"><tr><th className="px-4 py-3">Student</th><th className="px-4 py-3">Event</th><th className="px-4 py-3">Time</th><th className="px-4 py-3">Attempt</th></tr></thead><tbody className="divide-y divide-neutral-100">{feed.map((item, index) => <tr key={`${item.attemptId}-${item.type}-${index}`} className="hover:bg-neutral-50"><td className="px-4 py-3">{item.student}</td><td className="px-4 py-3"><StatusBadge tone="amber">{item.type}</StatusBadge></td><td className="px-4 py-3 text-xs text-neutral-500">{dateTime(item.at)}</td><td className="px-4 py-3"><Link href={`/workspace/reports?view=integrity&modal=attempt&attempt=${encodeURIComponent(item.attemptId)}`} className="font-mono text-xs hover:underline">{item.attemptId.slice(0, 12)}…</Link></td></tr>)}</tbody></table></div> : <AdminEmptyState title="No integrity events" description="No review-worthy integrity events are visible in your current scope." />}
        </section>
      </TabsContent>
    </Tabs>
  );
}
