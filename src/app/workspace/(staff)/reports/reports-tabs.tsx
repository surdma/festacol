"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { AdminTablePagination, useAdminTablePagination } from "@/components/admin/admin-table-pagination";
import { AdminEmptyState, adminSurfaceClass } from "@/components/admin/admin-ui";
import { StatusBadge } from "@/components/status-badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
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
  mode: string | null;
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

  const placements = attempts.filter(
    (attempt) => attempt.submitted_at && attempt.mode === "qualifier",
  );
  const recent = [...attempts]
    .filter((attempt) => attempt.submitted_at)
    .sort((a, b) => Number(b.submitted_at ?? 0) - Number(a.submitted_at ?? 0))
    .slice(0, 8);
  const examRows = Array.from(byExam.entries(), ([sessionId, value]) => ({ sessionId, ...value }));
  const studentRows = Array.from(byStudent.entries(), ([studentId, value]) => ({ studentId, ...value }));

  const examTable = useAdminTablePagination(examRows, 15);
  const studentTable = useAdminTablePagination(studentRows, 15);
  const placementTable = useAdminTablePagination(placements, 15);
  const integrityTable = useAdminTablePagination(feed, 15);

  function changeView(value: string) {
    const next = new URLSearchParams(params.toString());
    next.set("view", value);
    for (const key of ["modal", "attempt", "exam", "student", "question", "class", "staff", "group"]) next.delete(key);
    router.replace(`${pathname}?${next.toString()}`);
  }

  return (
    <Tabs value={initialView} onValueChange={changeView} className="mt-5 gap-4">
      <TabsList variant="line" className="h-auto max-w-full justify-start gap-1 overflow-x-auto rounded-lg border border-border bg-background p-1 shadow-none">
        {views.map((view) => (
          <TabsTrigger
            key={view.value}
            value={view.value}
            className="min-h-9 rounded-md border-0 px-3 text-xs font-semibold text-muted-foreground data-active:bg-foreground data-active:text-background"
          >
            {view.label}
          </TabsTrigger>
        ))}
      </TabsList>

      <TabsContent value="overview">
        <section className={cn(adminSurfaceClass, "overflow-hidden")}>
          <div className="border-b border-border p-5">
            <p className="text-[10px] font-bold uppercase tracking-[.14em] text-muted-foreground">Latest activity</p>
            <h2 className="mt-1 font-display text-lg font-extrabold text-foreground">Recent submissions</h2>
          </div>
          {recent.length ? (
            <div className="divide-y divide-border">
              {recent.map((attempt) => (
                <Link
                  key={attempt.id}
                  href={`/workspace/reports?view=overview&modal=attempt&attempt=${encodeURIComponent(attempt.id)}`}
                  className="grid gap-2 p-4 transition hover:bg-muted/50 sm:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)_auto] sm:items-center"
                >
                  <span>
                    <strong className="block text-sm text-foreground">{attempt.student_name}</strong>
                    <span className="mt-1 block text-xs text-muted-foreground">{attempt.session_title}</span>
                  </span>
                  <span className="text-xs text-muted-foreground">{dateTime(attempt.submitted_at)}</span>
                  <span className="font-display text-lg font-extrabold tabular-nums text-foreground">{attempt.score ?? 0}%</span>
                </Link>
              ))}
            </div>
          ) : (
            <AdminEmptyState title="No submissions yet" description="Completed attempts will appear here as candidates submit examinations." />
          )}
        </section>
      </TabsContent>

      <TabsContent value="exams">
        <section className={cn(adminSurfaceClass, "overflow-hidden")}>
          {examRows.length ? (
            <>
              <Table>
                <TableHeader className="bg-muted/30">
                  <TableRow>
                    <TableHead className="min-w-64">Exam</TableHead>
                    <TableHead>Attempts</TableHead>
                    <TableHead>Average</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {examTable.pageRows.map((row) => (
                    <TableRow key={row.sessionId}>
                      <TableCell className="whitespace-normal">
                        <Link href={`/workspace/exams?modal=exam&exam=${encodeURIComponent(row.sessionId)}`} className="font-semibold hover:underline">
                          {row.title}
                        </Link>
                      </TableCell>
                      <TableCell>{row.submitted}/{row.total} submitted</TableCell>
                      <TableCell className="font-semibold tabular-nums">{row.submitted ? `${Math.round(row.sum / row.submitted)}%` : "—"}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              <AdminTablePagination
                id="report-exams"
                count={examRows.length}
                page={examTable.page}
                pageSize={examTable.pageSize}
                pageCount={examTable.pageCount}
                onPageChange={examTable.setPage}
                onPageSizeChange={examTable.setPageSize}
              />
            </>
          ) : (
            <AdminEmptyState title="No exam data yet" description="Exam attempt data will appear here once candidates start papers." />
          )}
        </section>
      </TabsContent>

      <TabsContent value="students">
        <section className={cn(adminSurfaceClass, "overflow-hidden")}>
          {studentRows.length ? (
            <>
              <Table>
                <TableHeader className="bg-muted/30">
                  <TableRow>
                    <TableHead className="min-w-56">Student</TableHead>
                    <TableHead>Submitted</TableHead>
                    <TableHead>Average</TableHead>
                    <TableHead>Integrity</TableHead>
                    <TableHead>Latest attempt</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {studentTable.pageRows.map((row) => (
                    <TableRow key={row.studentId}>
                      <TableCell className="font-semibold">{row.name}</TableCell>
                      <TableCell>{row.total}</TableCell>
                      <TableCell className="tabular-nums">{Math.round(row.sum / row.total)}%</TableCell>
                      <TableCell className="tabular-nums">{Math.round(row.integrity / row.total)}%</TableCell>
                      <TableCell>
                        <Link href={`/workspace/reports?view=students&modal=attempt&attempt=${encodeURIComponent(row.latest)}`} className="text-xs font-semibold hover:underline">
                          Open
                        </Link>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              <AdminTablePagination
                id="report-students"
                count={studentRows.length}
                page={studentTable.page}
                pageSize={studentTable.pageSize}
                pageCount={studentTable.pageCount}
                onPageChange={studentTable.setPage}
                onPageSizeChange={studentTable.setPageSize}
              />
            </>
          ) : (
            <AdminEmptyState title="No student report data" description="Submitted student attempts will appear here." />
          )}
        </section>
      </TabsContent>

      <TabsContent value="placements">
        <section className={cn(adminSurfaceClass, "overflow-hidden")}>
          {placements.length ? (
            <>
              <Table>
                <TableHeader className="bg-muted/30">
                  <TableRow>
                    <TableHead className="min-w-56">Student</TableHead>
                    <TableHead>Recommendation</TableHead>
                    <TableHead>Placement score</TableHead>
                    <TableHead>Attempt</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {placementTable.pageRows.map((attempt) => (
                    <TableRow key={attempt.id}>
                      <TableCell className="font-semibold">{attempt.student_name}</TableCell>
                      <TableCell>
                        <StatusBadge tone={attempt.assigned_track === "science" ? "blue" : "amber"}>
                          {attempt.assigned_track === "science" ? "Science" : "Art / Commercial choice"}
                        </StatusBadge>
                      </TableCell>
                      <TableCell className="tabular-nums">
                        {attempt.placement_confidence == null ? "—" : `${Math.round(Number(attempt.placement_confidence))}%`}
                      </TableCell>
                      <TableCell>
                        <Link href={`/workspace/reports?view=placements&modal=attempt&attempt=${encodeURIComponent(attempt.id)}`} className="text-xs font-semibold hover:underline">
                          Open
                        </Link>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              <AdminTablePagination
                id="report-placements"
                count={placements.length}
                page={placementTable.page}
                pageSize={placementTable.pageSize}
                pageCount={placementTable.pageCount}
                onPageChange={placementTable.setPage}
                onPageSizeChange={placementTable.setPageSize}
              />
            </>
          ) : (
            <AdminEmptyState title="No placement results yet" description="Qualifier placement outcomes will appear here after eligible attempts are submitted." />
          )}
        </section>
      </TabsContent>

      <TabsContent value="integrity">
        <section className={cn(adminSurfaceClass, "overflow-hidden")}>
          {feed.length ? (
            <>
              <Table>
                <TableHeader className="bg-muted/30">
                  <TableRow>
                    <TableHead className="min-w-56">Student</TableHead>
                    <TableHead>Event</TableHead>
                    <TableHead>Time</TableHead>
                    <TableHead>Attempt</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {integrityTable.pageRows.map((item, index) => (
                    <TableRow key={`${item.attemptId}-${item.type}-${item.at ?? 0}-${index}`}>
                      <TableCell>{item.student}</TableCell>
                      <TableCell><StatusBadge tone="amber">{item.type}</StatusBadge></TableCell>
                      <TableCell className="text-xs text-muted-foreground">{dateTime(item.at)}</TableCell>
                      <TableCell>
                        <Link href={`/workspace/reports?view=integrity&modal=attempt&attempt=${encodeURIComponent(item.attemptId)}`} className="font-mono text-xs hover:underline">
                          {item.attemptId.slice(0, 12)}…
                        </Link>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              <AdminTablePagination
                id="report-integrity"
                count={feed.length}
                page={integrityTable.page}
                pageSize={integrityTable.pageSize}
                pageCount={integrityTable.pageCount}
                onPageChange={integrityTable.setPage}
                onPageSizeChange={integrityTable.setPageSize}
              />
            </>
          ) : (
            <AdminEmptyState title="No integrity events" description="No review-worthy integrity events are visible in your current scope." />
          )}
        </section>
      </TabsContent>
    </Tabs>
  );
}
