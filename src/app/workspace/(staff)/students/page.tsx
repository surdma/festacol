import Link from "next/link";
import { Plus } from "lucide-react";
import {
  AdminEmptyState,
  AdminFilterLinks,
  AdminPageHeader,
  AdminSearchForm,
  adminPrimaryButtonClass,
  adminSecondaryButtonClass,
  adminSurfaceClass,
} from "@/components/admin/admin-ui";
import { StudentDirectoryTable, type StudentDirectoryTableRow } from "@/components/admin/member-directory-tables";
import { Button, buttonVariants } from "@/components/ui/button";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { currentStaff } from "@/lib/auth/staff";
import { listClasses, listUsers } from "@/lib/supabase/queries";

interface AttemptIndexRow {
  student_id: string;
  score: number | null;
  integrity_score: number | null;
  submitted_at: number | null;
  assigned_track: string | null;
}

function average(values: number[]) {
  return values.length ? Math.round(values.reduce((sum, value) => sum + value, 0) / values.length) : null;
}

export default async function AdminStudentsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; status?: string; level?: string; field?: string; class?: string; performance?: string; placement?: string }>;
}) {
  const params = await searchParams;
  const q = String(params.q ?? "").trim();
  const status = params.status === "inactive" ? "inactive" : params.status === "active" ? "active" : "all";
  const level = ["SS1", "SS2", "SS3"].includes(String(params.level)) ? String(params.level) : "all";
  const field = String(params.field ?? "all");
  const classFilter = String(params.class ?? "all");
  const placementOnly = params.placement === "pending";
  const performance = ["high", "mid", "support", "none"].includes(String(params.performance)) ? String(params.performance) : "all";
  const { supabase, scope } = await currentStaff();

  const [users, classes, attemptsResult, totalResult, activeResult] = await Promise.all([
    listUsers(supabase, "student", q),
    listClasses(supabase),
    supabase.from("exam_attempts").select("student_id,score,integrity_score,submitted_at,assigned_track").limit(5000),
    supabase.from("school_members").select("id", { count: "exact", head: true }).eq("role", "student"),
    supabase.from("school_members").select("id", { count: "exact", head: true }).eq("role", "student").eq("status", "active"),
  ]);

  const classById = new Map<string, { id: string; display_name: string; level_name: string; track_name: string }>(
    classes.map((item) => [item.id, item]),
  );
  const attemptRows = (attemptsResult.data ?? []) as AttemptIndexRow[];
  const attemptsByStudent = new Map<string, AttemptIndexRow[]>();
  for (const row of attemptRows) attemptsByStudent.set(row.student_id, [...(attemptsByStudent.get(row.student_id) ?? []), row]);

  const indexed: StudentDirectoryTableRow[] = users.map((user) => {
    const studentAttempts = attemptsByStudent.get(user.id) ?? [];
    const submittedAttempts = studentAttempts.filter((attempt) => attempt.submitted_at);
    const scores = submittedAttempts.map((attempt) => Number(attempt.score)).filter(Number.isFinite);
    const integrity = submittedAttempts.map((attempt) => Number(attempt.integrity_score)).filter(Number.isFinite);
    const latestPlacement = studentAttempts.find((attempt) => attempt.assigned_track)?.assigned_track ?? null;
    const classRow = user.class_id ? classById.get(user.class_id) : undefined;
    const hrefParams = new URLSearchParams();
    if (q) hrefParams.set("q", q);
    if (status !== "all") hrefParams.set("status", status);
    if (level !== "all") hrefParams.set("level", level);
    if (field !== "all") hrefParams.set("field", field);
    if (classFilter !== "all") hrefParams.set("class", classFilter);
    if (performance !== "all") hrefParams.set("performance", performance);
    if (placementOnly) hrefParams.set("placement", "pending");
    hrefParams.set("modal", "student");
    hrefParams.set("student", user.id);
    hrefParams.set("view", "overview");
    return {
      user,
      className: classRow?.display_name ?? "Unassigned",
      classLevel: classRow?.level_name ?? "",
      field: classRow?.track_name ?? "Unassigned",
      attempts: studentAttempts.length,
      submitted: submittedAttempts.length,
      averageScore: average(scores),
      averageIntegrity: average(integrity),
      placement: latestPlacement,
      href: `/workspace/students?${hrefParams.toString()}`,
    };
  });

  const rows = indexed.filter((row) => {
    if (status !== "all" && (status === "active" ? row.user.status !== "active" : row.user.status === "active")) return false;
    if (level !== "all" && row.classLevel !== level) return false;
    if (field !== "all" && row.field !== field) return false;
    if (classFilter !== "all" && classFilter !== "unassigned" && row.user.class_id !== classFilter) return false;
    if (classFilter === "unassigned" && row.user.class_id) return false;
    if (placementOnly && row.placement) return false;
    if (performance === "none" && row.submitted !== 0) return false;
    if (performance === "high" && (row.averageScore === null || row.averageScore < 70)) return false;
    if (performance === "mid" && (row.averageScore === null || row.averageScore < 50 || row.averageScore >= 70)) return false;
    if (performance === "support" && (row.averageScore === null || row.averageScore >= 50)) return false;
    return true;
  });

  const fieldOptions = [...new Set(classes.map((item) => item.track_name))].sort();
  const unassignedCount = indexed.filter((row) => !row.user.class_id).length;
  const placementPendingCount = indexed.filter((row) => !row.placement).length;
  const unassignedHref =
    classFilter === "unassigned"
      ? placementOnly
        ? "/workspace/students?placement=pending"
        : "/workspace/students"
      : placementOnly
        ? "/workspace/students?class=unassigned&placement=pending"
        : "/workspace/students?class=unassigned";
  const placementHref = placementOnly
    ? classFilter === "unassigned"
      ? "/workspace/students?class=unassigned"
      : "/workspace/students"
    : classFilter === "unassigned"
      ? "/workspace/students?class=unassigned&placement=pending"
      : "/workspace/students?placement=pending";
  const filterState = { q, status: status === "all" ? undefined : status, level: level === "all" ? undefined : level, field: field === "all" ? undefined : field, class: classFilter === "all" ? undefined : classFilter, performance: performance === "all" ? undefined : performance };
  const hasFilters = Boolean(q) || status !== "all" || level !== "all" || field !== "all" || classFilter !== "all" || performance !== "all" || placementOnly;

  return (
    <div>
      <AdminPageHeader
        eyebrow="Directory"
        title="Students"
        description="A relational academic directory with current placement, guardian contact, performance, integrity and progression context."
        actions={
          <Link href="/workspace/students?modal=user-new&role=student" className={adminPrimaryButtonClass}>
            <Plus data-icon="inline-start" />Add student
          </Link>
        }
      />

      <div className="mb-4 grid gap-3 xl:grid-cols-[minmax(0,1fr)_auto] xl:items-start">
        <AdminSearchForm query={q} placeholder="Search name or Student ID (FST-XXXXX)" hidden={{ status: filterState.status, level: filterState.level, field: filterState.field, class: filterState.class, performance: filterState.performance, placement: placementOnly ? "pending" : undefined }} />
        <AdminFilterLinks pathname="/workspace/students" param="status" current={status} preserve={{ q, level: filterState.level, field: filterState.field, class: filterState.class, performance: filterState.performance, placement: placementOnly ? "pending" : undefined }} options={[{ value: "all", label: "All" }, { value: "active", label: "Active" }, { value: "inactive", label: "Inactive" }]} />
      </div>

      <section className={`${adminSurfaceClass} mb-4 p-4`}>
        <form action="/workspace/students" method="get" className="grid gap-3 sm:grid-cols-2 xl:grid-cols-[repeat(4,minmax(0,1fr))_auto] xl:items-end">
          {q ? <input type="hidden" name="q" value={q} /> : null}
          {status !== "all" ? <input type="hidden" name="status" value={status} /> : null}
          {placementOnly ? <input type="hidden" name="placement" value="pending" /> : null}
          <label htmlFor="filter-level" className="grid gap-1.5 text-xs font-semibold text-muted-foreground">Level<NativeSelect id="filter-level" name="level" defaultValue={level}><NativeSelectOption value="all">All levels</NativeSelectOption>{["SS1", "SS2", "SS3"].map((value) => <NativeSelectOption key={value} value={value}>{value}</NativeSelectOption>)}</NativeSelect></label>
          <label htmlFor="filter-field" className="grid gap-1.5 text-xs font-semibold text-muted-foreground">Field<NativeSelect id="filter-field" name="field" defaultValue={field}><NativeSelectOption value="all">All fields</NativeSelectOption>{fieldOptions.map((value) => <NativeSelectOption key={value} value={value}>{value}</NativeSelectOption>)}</NativeSelect></label>
          <label htmlFor="filter-class" className="grid gap-1.5 text-xs font-semibold text-muted-foreground">Class<NativeSelect id="filter-class" name="class" defaultValue={classFilter}><NativeSelectOption value="all">All classes</NativeSelectOption><NativeSelectOption value="unassigned">Unassigned / placement-pending</NativeSelectOption>{classes.filter((item) => item.status === "active").map((item) => <NativeSelectOption key={item.id} value={item.id}>{item.display_name}</NativeSelectOption>)}</NativeSelect></label>
          <label htmlFor="filter-performance" className="grid gap-1.5 text-xs font-semibold text-muted-foreground">Performance<NativeSelect id="filter-performance" name="performance" defaultValue={performance}><NativeSelectOption value="all">Any performance</NativeSelectOption><NativeSelectOption value="high">70% and above</NativeSelectOption><NativeSelectOption value="mid">50–69%</NativeSelectOption><NativeSelectOption value="support">Below 50%</NativeSelectOption><NativeSelectOption value="none">No submitted exam</NativeSelectOption></NativeSelect></label>
          <div className="flex gap-2">
            <Button type="submit" className={adminPrimaryButtonClass}>Apply</Button>
            {hasFilters ? <Link href="/workspace/students" className={adminSecondaryButtonClass}>Reset</Link> : null}
          </div>
        </form>
      </section>

      <div className="mb-3 flex flex-wrap items-center gap-2 text-xs"><Link href={unassignedHref} className={`rounded-full border px-3 py-1.5 font-semibold transition ${classFilter === "unassigned" ? "border-foreground bg-foreground text-background" : "border-border bg-background text-foreground hover:bg-muted"}`} aria-pressed={classFilter === "unassigned"}>Unassigned{unassignedCount ? ` · ${unassignedCount}` : ""}</Link><Link href={placementHref} className={`rounded-full border px-3 py-1.5 font-semibold transition ${placementOnly ? "border-foreground bg-foreground text-background" : "border-border bg-background text-foreground hover:bg-muted"}`} aria-pressed={placementOnly}>Placement pending{placementPendingCount ? ` · ${placementPendingCount}` : ""}</Link></div>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2 text-xs font-semibold text-muted-foreground"><span>{rows.length} matching · {totalResult.count ?? 0} total</span><span>{activeResult.count ?? 0} active · {classes.length} classes · {indexed.filter((row) => row.averageScore !== null).length} with submitted results</span></div>

      {rows.length ? <StudentDirectoryTable rows={rows} canDelete={scope.isAdmin} /> : (
        <section className={adminSurfaceClass}>
          <AdminEmptyState
            title={hasFilters ? "No matching students" : "No students yet"}
            description={hasFilters ? "Change the current academic, status or performance filters." : "Add the first student to begin building the academic directory."}
            action={hasFilters
              ? <Link href="/workspace/students" className={buttonVariants({ size: "sm", variant: "outline" })}>Clear filters</Link>
              : <Link href="/workspace/students?modal=user-new&role=student" className={adminPrimaryButtonClass}><Plus data-icon="inline-start" />Add student</Link>}
          />
        </section>
      )}
    </div>
  );
}
