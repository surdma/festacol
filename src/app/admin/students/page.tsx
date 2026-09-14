import Link from "next/link";
import { MoreHorizontal, Plus } from "lucide-react";
import {
  AdminEmptyState,
  AdminFilterLinks,
  AdminPageHeader,
  AdminSearchForm,
  adminIconButtonClass,
  adminPrimaryButtonClass,
  adminSurfaceClass,
} from "@/components/admin/admin-ui";
import { StatusBadge } from "@/components/status-badge";
import { Button } from "@/components/ui/button";
import { currentStaff } from "@/lib/auth/staff";
import { studentHashFor } from "@/lib/assessment";
import { listClasses, listUsers } from "@/lib/supabase/queries";
import type { UserRow } from "@/types/db";

interface DirectoryRow { user: UserRow; className: string; attempts: number }
function initials(name: string) { return name.split(/\s+/).filter(Boolean).map((part) => part[0]).join("").slice(0, 2).toUpperCase() || "ST"; }

export function StudentDirectory({ rows, hasFilters }: { rows: DirectoryRow[]; hasFilters: boolean }) {
  if (!rows.length) return <section className={adminSurfaceClass}><AdminEmptyState title={hasFilters ? "No matching students" : "No students yet"} description={hasFilters ? "Change the current search or status filter." : "Add the first student to begin building the academic directory."} action={hasFilters ? <Button size="sm" variant="outline" render={<Link href="/admin/students" />}>Clear filters</Button> : <Button size="sm" render={<Link href="/admin/students?modal=user-new&role=student" />} className={adminPrimaryButtonClass}><Plus className="size-4" />Add student</Button>} /></section>;

  return (
    <section className={`${adminSurfaceClass} overflow-hidden`}>
      <div className="hidden overflow-x-auto md:block">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-neutral-200 bg-neutral-50 text-[11px] font-bold uppercase tracking-[.1em] text-neutral-500"><tr><th className="px-4 py-3">Student</th><th className="px-4 py-3">Class</th><th className="px-4 py-3">Exam attempts</th><th className="px-4 py-3">Status</th><th className="px-4 py-3"><span className="sr-only">Open</span></th></tr></thead>
          <tbody className="divide-y divide-neutral-100">{rows.map(({ user, className, attempts }) => <tr key={user.id} className="hover:bg-neutral-50"><td className="px-4 py-3"><Link href={`/admin/students?modal=student&student=${encodeURIComponent(user.id)}`} className="flex items-center gap-3 text-left"><span className="grid size-9 shrink-0 place-items-center rounded-lg bg-neutral-100 text-xs font-bold text-neutral-950">{initials(user.full_name)}</span><span className="min-w-0"><strong className="block truncate text-neutral-950">{user.full_name}</strong><span className="text-xs text-neutral-500">{user.id}</span></span></Link></td><td className="px-4 py-3">{className}</td><td className="px-4 py-3">{attempts}</td><td className="px-4 py-3"><StatusBadge tone={user.status === "active" ? "emerald" : "neutral"}>{user.status}</StatusBadge></td><td className="px-4 py-3 text-right"><Button size="icon" variant="outline" render={<Link href={`/admin/students?modal=student&student=${encodeURIComponent(user.id)}`} />} className={adminIconButtonClass} aria-label={`Open ${user.full_name}`}><MoreHorizontal className="size-5" /></Button></td></tr>)}</tbody>
        </table>
      </div>
      <div className="divide-y divide-neutral-100 md:hidden">{rows.map(({ user, className, attempts }) => <Link key={user.id} href={`/admin/students?modal=student&student=${encodeURIComponent(user.id)}`} className="flex w-full items-center gap-3 p-4 text-left transition hover:bg-neutral-50"><span className="grid size-10 shrink-0 place-items-center rounded-xl bg-neutral-100 text-xs font-bold text-neutral-950">{initials(user.full_name)}</span><span className="min-w-0 flex-1"><strong className="block truncate text-sm text-neutral-950">{user.full_name}</strong><span className="mt-1 block truncate text-xs text-neutral-500">{className} · {attempts} attempt{attempts === 1 ? "" : "s"}</span></span><StatusBadge tone={user.status === "active" ? "emerald" : "neutral"}>{user.status}</StatusBadge></Link>)}</div>
    </section>
  );
}

export default async function AdminStudentsPage({ searchParams }: { searchParams: Promise<{ q?: string; status?: string }> }) {
  const params = await searchParams;
  const q = String(params.q ?? "").trim();
  const status = params.status === "inactive" ? "inactive" : params.status === "active" ? "active" : "all";
  const { supabase } = await currentStaff();
  const idSearch = q ? `%${q}%` : "__festacol_no_student_id_match__";
  const [nameMatches, idMatchesResult, classes, attemptsResult, totalResult, activeResult] = await Promise.all([
    listUsers(supabase, "student", q),
    supabase.from("users").select("*").eq("role", "student").ilike("id", idSearch).order("full_name").limit(200),
    listClasses(supabase),
    supabase.from("exam_attempts").select("student_hash").limit(2000),
    supabase.from("users").select("*", { count: "exact", head: true }).eq("role", "student"),
    supabase.from("users").select("*", { count: "exact", head: true }).eq("role", "student").eq("status", "active"),
  ]);
  const userMap = new Map<string, UserRow>();
  for (const user of nameMatches) userMap.set(user.id, user);
  for (const user of ((idMatchesResult.data ?? []) as UserRow[])) userMap.set(user.id, user);
  const users = [...userMap.values()].sort((a, b) => a.full_name.localeCompare(b.full_name));
  const classNames = new Map(classes.map((item) => [item.id, item.name]));
  const attemptCounts = new Map<string, number>();
  for (const row of ((attemptsResult.data ?? []) as { student_hash: string }[])) if (row.student_hash) attemptCounts.set(row.student_hash, (attemptCounts.get(row.student_hash) ?? 0) + 1);
  const visible = users.filter((user) => status === "all" || (status === "active" ? user.status === "active" : user.status !== "active"));
  const rows: DirectoryRow[] = await Promise.all(visible.map(async (user) => { let hash = ""; try { hash = await studentHashFor(user.first_name, user.last_name); } catch { hash = ""; } return { user, className: user.class_id ? classNames.get(user.class_id) ?? "Unassigned" : "Unassigned", attempts: hash ? attemptCounts.get(hash) ?? 0 : 0 }; }));
  const hasFilters = Boolean(q) || status !== "all";

  return (
    <div>
      <AdminPageHeader eyebrow="Directory" title="Students" description="Student records connect directly to class membership, exam history and integrity activity." actions={<Button render={<Link href="/admin/students?modal=user-new&role=student" />} className={adminPrimaryButtonClass}><Plus className="size-4" />Add student</Button>} />
      <div className="mb-4 grid gap-3 md:grid-cols-[minmax(0,1fr)_auto] md:items-center"><AdminSearchForm query={q} placeholder="Search name or ID" hidden={{ status: status === "all" ? undefined : status }} /><AdminFilterLinks pathname="/admin/students" param="status" current={status} preserve={{ q }} options={[{ value: "all", label: "All students" }, { value: "active", label: "Active" }, { value: "inactive", label: "Inactive" }]} /></div>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2 text-xs font-semibold text-neutral-500"><span>{rows.length} shown · {totalResult.count ?? 0} total</span><span>{activeResult.count ?? 0} active · {classes.length} classes</span></div>
      <StudentDirectory rows={rows} hasFilters={hasFilters} />
    </div>
  );
}
