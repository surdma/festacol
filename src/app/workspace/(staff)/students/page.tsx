import Link from "next/link";
import { MoreHorizontal, Plus } from "lucide-react";
import {
  AdminEmptyState,
  AdminFilterLinks,
  AdminPageHeader,
  AdminSearchForm,
  adminIconButtonClass,
  adminPrimaryButtonClass,
  adminSecondaryButtonClass,
  adminSurfaceClass,
} from "@/components/admin/admin-ui";
import { StudentStatusButton } from "@/components/admin/student-status-button";
import { StatusBadge } from "@/components/status-badge";
import { Button } from "@/components/ui/button";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { currentStaff } from "@/lib/auth/staff";
import { listClasses, listUsers, type DirectoryUserRow } from "@/lib/supabase/queries";

interface AttemptIndexRow {
  student_id: string;
  score: number | null;
  submitted_at: number | null;
  assigned_track: string | null;
}

interface DirectoryRow {
  user: DirectoryUserRow;
  className: string;
  classLevel: string;
  field: string;
  attempts: number;
  submitted: number;
  averageScore: number | null;
  placement: string | null;
  href: string;
}

function initials(name: string) {
  return name.split(/\s+/).filter(Boolean).map((part) => part[0]).join("").slice(0, 2).toUpperCase() || "ST";
}

function average(values: number[]) {
  return values.length ? Math.round(values.reduce((sum, value) => sum + value, 0) / values.length) : null;
}

export function StudentDirectory({ rows, hasFilters }: { rows: DirectoryRow[]; hasFilters: boolean }) {
  if (!rows.length) {
    return (
      <section className={adminSurfaceClass}>
        <AdminEmptyState
          title={hasFilters ? "No matching students" : "No students yet"}
          description={hasFilters ? "Change the current academic, status or performance filters." : "Add the first student to begin building the academic directory."}
          action={hasFilters
            ? <Button size="sm" variant="outline" render={<Link href="/workspace/students" />}>Clear filters</Button>
            : <Button size="sm" render={<Link href="/workspace/students?modal=user-new&role=student" />} className={adminPrimaryButtonClass}><Plus data-icon="inline-start" />Add student</Button>}
        />
      </section>
    );
  }

  return (
    <section className={`${adminSurfaceClass} overflow-hidden`}>
      <div className="hidden overflow-x-auto md:block">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-neutral-200 bg-neutral-50 text-[11px] font-bold uppercase tracking-[.1em] text-neutral-500">
            <tr>
              <th className="px-4 py-3">Student</th>
              <th className="px-4 py-3">Class / field</th>
              <th className="px-4 py-3">Attempts</th>
              <th className="px-4 py-3">Average</th>
              <th className="px-4 py-3">Placement</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3"><span className="sr-only">Actions</span></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-100">
            {rows.map(({ user, className, classLevel, field, attempts, submitted, averageScore, placement, href }) => (
              <tr key={user.id} className="hover:bg-neutral-50">
                <td className="px-4 py-3"><Link href={href} className="flex items-center gap-3 text-left"><span className="grid size-9 shrink-0 place-items-center rounded-lg bg-neutral-100 text-xs font-bold text-neutral-950">{initials(user.full_name)}</span><span className="min-w-0"><strong className="block truncate text-neutral-950">{user.full_name}</strong><span className="text-xs text-neutral-500">{user.student_number || user.id}</span></span></Link></td>
                <td className="px-4 py-3"><strong className="block text-sm text-neutral-800">{className}</strong><span className="mt-1 block text-xs text-neutral-500">{classLevel ? `${classLevel} · ${field}` : "No current class"}</span></td>
                <td className="px-4 py-3"><strong className="tabular-nums">{attempts}</strong><span className="ml-1 text-xs text-neutral-500">({submitted} submitted)</span></td>
                <td className="px-4 py-3">{averageScore === null ? <span className="text-neutral-400">—</span> : <StatusBadge tone={averageScore >= 70 ? "emerald" : averageScore >= 50 ? "blue" : "amber"}>{averageScore}%</StatusBadge>}</td>
                <td className="px-4 py-3 text-neutral-700">{placement ?? "—"}</td>
                <td className="px-4 py-3"><StatusBadge tone={user.status === "active" ? "emerald" : "neutral"}>{user.status}</StatusBadge></td>
                <td className="px-4 py-3"><div className="flex justify-end gap-2"><StudentStatusButton studentId={user.id} name={user.full_name} active={user.status === "active"} compact /><Button size="icon" variant="outline" render={<Link href={href} />} className={adminIconButtonClass} aria-label={`Open ${user.full_name}`}><MoreHorizontal /></Button></div></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="divide-y divide-neutral-100 md:hidden">
        {rows.map(({ user, className, field, attempts, averageScore, placement, href }) => (
          <div key={user.id} className="flex items-center gap-3 p-4">
            <Link href={href} className="flex min-w-0 flex-1 items-center gap-3 text-left transition hover:opacity-80">
              <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-neutral-100 text-xs font-bold text-neutral-950">{initials(user.full_name)}</span>
              <span className="min-w-0 flex-1"><strong className="block truncate text-sm text-neutral-950">{user.full_name}</strong><span className="mt-1 block truncate text-xs text-neutral-500">{className} · {field || "Unassigned"}</span><span className="mt-1 block truncate text-[11px] text-neutral-400">{attempts} attempt{attempts === 1 ? "" : "s"}{averageScore === null ? "" : ` · avg ${averageScore}%`}{placement ? ` · ${placement}` : ""}</span></span>
              <StatusBadge tone={user.status === "active" ? "emerald" : "neutral"}>{user.status}</StatusBadge>
            </Link>
            <StudentStatusButton studentId={user.id} name={user.full_name} active={user.status === "active"} compact />
          </div>
        ))}
      </div>
    </section>
  );
}

export default async function AdminStudentsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; status?: string; level?: string; field?: string; class?: string; performance?: string }>;
}) {
  const params = await searchParams;
  const q = String(params.q ?? "").trim();
  const status = params.status === "inactive" ? "inactive" : params.status === "active" ? "active" : "all";
  const level = ["SS1", "SS2", "SS3"].includes(String(params.level)) ? String(params.level) : "all";
  const field = String(params.field ?? "all");
  const classFilter = String(params.class ?? "all");
  const performance = ["high", "mid", "support", "none"].includes(String(params.performance)) ? String(params.performance) : "all";
  const { supabase } = await currentStaff();

  const [users, classes, attemptsResult, totalResult, activeResult] = await Promise.all([
    listUsers(supabase, "student", q),
    listClasses(supabase),
    supabase.from("exam_attempts").select("student_id,score,submitted_at,assigned_track").limit(5000),
    supabase.from("school_members").select("id", { count: "exact", head: true }).eq("role", "student"),
    supabase.from("school_members").select("id", { count: "exact", head: true }).eq("role", "student").eq("status", "active"),
  ]);

  const classById = new Map(classes.map((item) => [item.id, item]));
  const attemptRows = (attemptsResult.data ?? []) as AttemptIndexRow[];
  const attemptsByStudent = new Map<string, AttemptIndexRow[]>();
  for (const row of attemptRows) attemptsByStudent.set(row.student_id, [...(attemptsByStudent.get(row.student_id) ?? []), row]);

  const indexed: DirectoryRow[] = users.map((user) => {
    const studentAttempts = attemptsByStudent.get(user.id) ?? [];
    const submittedAttempts = studentAttempts.filter((attempt) => attempt.submitted_at);
    const scores = submittedAttempts.map((attempt) => Number(attempt.score)).filter(Number.isFinite);
    const latestPlacement = studentAttempts.find((attempt) => attempt.assigned_track)?.assigned_track ?? null;
    const classRow = user.class_id ? classById.get(user.class_id) : undefined;
    const hrefParams = new URLSearchParams();
    if (q) hrefParams.set("q", q);
    if (status !== "all") hrefParams.set("status", status);
    if (level !== "all") hrefParams.set("level", level);
    if (field !== "all") hrefParams.set("field", field);
    if (classFilter !== "all") hrefParams.set("class", classFilter);
    if (performance !== "all") hrefParams.set("performance", performance);
    hrefParams.set("modal", "student");
    hrefParams.set("student", user.id);
    return {
      user,
      className: classRow?.display_name ?? "Unassigned",
      classLevel: classRow?.level_name ?? "",
      field: classRow?.track_name ?? "Unassigned",
      attempts: studentAttempts.length,
      submitted: submittedAttempts.length,
      averageScore: average(scores),
      placement: latestPlacement,
      href: `/workspace/students?${hrefParams.toString()}`,
    };
  });

  const rows = indexed.filter((row) => {
    if (status !== "all" && (status === "active" ? row.user.status !== "active" : row.user.status === "active")) return false;
    if (level !== "all" && row.classLevel !== level) return false;
    if (field !== "all" && row.field !== field) return false;
    if (classFilter !== "all" && row.user.class_id !== classFilter) return false;
    if (performance === "none" && row.submitted !== 0) return false;
    if (performance === "high" && (row.averageScore === null || row.averageScore < 70)) return false;
    if (performance === "mid" && (row.averageScore === null || row.averageScore < 50 || row.averageScore >= 70)) return false;
    if (performance === "support" && (row.averageScore === null || row.averageScore >= 50)) return false;
    return true;
  });

  const fieldOptions = [...new Set(classes.map((item) => item.track_name))].sort();
  const filterState = { q, status: status === "all" ? undefined : status, level: level === "all" ? undefined : level, field: field === "all" ? undefined : field, class: classFilter === "all" ? undefined : classFilter, performance: performance === "all" ? undefined : performance };
  const hasFilters = Boolean(q) || status !== "all" || level !== "all" || field !== "all" || classFilter !== "all" || performance !== "all";

  return (
    <div>
      <AdminPageHeader eyebrow="Directory" title="Students" description="Search the canonical school member directory, filter by current class/field and performance, then drill into relational exam history." actions={<Button render={<Link href="/workspace/students?modal=user-new&role=student" />} className={adminPrimaryButtonClass}><Plus data-icon="inline-start" />Add student</Button>} />

      <div className="mb-4 grid gap-3 xl:grid-cols-[minmax(0,1fr)_auto] xl:items-start">
        <AdminSearchForm query={q} placeholder="Search student name" hidden={{ status: filterState.status, level: filterState.level, field: filterState.field, class: filterState.class, performance: filterState.performance }} />
        <AdminFilterLinks pathname="/workspace/students" param="status" current={status} preserve={{ q, level: filterState.level, field: filterState.field, class: filterState.class, performance: filterState.performance }} options={[{ value: "all", label: "All" }, { value: "active", label: "Active" }, { value: "inactive", label: "Inactive" }]} />
      </div>

      <section className={`${adminSurfaceClass} mb-4 p-4`}>
        <form action="/workspace/students" method="get" className="grid gap-3 sm:grid-cols-2 xl:grid-cols-[repeat(4,minmax(0,1fr))_auto] xl:items-end">
          {q ? <input type="hidden" name="q" value={q} /> : null}
          {status !== "all" ? <input type="hidden" name="status" value={status} /> : null}
          <label className="grid gap-1.5 text-xs font-semibold text-neutral-600">Level<NativeSelect name="level" defaultValue={level}><NativeSelectOption value="all">All levels</NativeSelectOption>{["SS1", "SS2", "SS3"].map((value) => <NativeSelectOption key={value} value={value}>{value}</NativeSelectOption>)}</NativeSelect></label>
          <label className="grid gap-1.5 text-xs font-semibold text-neutral-600">Field<NativeSelect name="field" defaultValue={field}><NativeSelectOption value="all">All fields</NativeSelectOption>{fieldOptions.map((value) => <NativeSelectOption key={value} value={value}>{value}</NativeSelectOption>)}</NativeSelect></label>
          <label className="grid gap-1.5 text-xs font-semibold text-neutral-600">Class<NativeSelect name="class" defaultValue={classFilter}><NativeSelectOption value="all">All classes</NativeSelectOption>{classes.filter((item) => item.status === "active").map((item) => <NativeSelectOption key={item.id} value={item.id}>{item.display_name}</NativeSelectOption>)}</NativeSelect></label>
          <label className="grid gap-1.5 text-xs font-semibold text-neutral-600">Performance<NativeSelect name="performance" defaultValue={performance}><NativeSelectOption value="all">Any performance</NativeSelectOption><NativeSelectOption value="high">70% and above</NativeSelectOption><NativeSelectOption value="mid">50–69%</NativeSelectOption><NativeSelectOption value="support">Below 50%</NativeSelectOption><NativeSelectOption value="none">No submitted exam</NativeSelectOption></NativeSelect></label>
          <div className="flex gap-2"><Button type="submit" className={adminPrimaryButtonClass}>Apply</Button>{hasFilters ? <Button variant="outline" render={<Link href="/workspace/students" />} className={adminSecondaryButtonClass}>Reset</Button> : null}</div>
        </form>
      </section>

      <div className="mb-3 flex flex-wrap items-center justify-between gap-2 text-xs font-semibold text-neutral-500"><span>{rows.length} shown · {totalResult.count ?? 0} total</span><span>{activeResult.count ?? 0} active · {classes.length} classes · {indexed.filter((row) => row.averageScore !== null).length} with submitted results</span></div>
      <StudentDirectory rows={rows} hasFilters={hasFilters} />
    </div>
  );
}
