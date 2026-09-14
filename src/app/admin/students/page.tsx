import Link from "next/link";
import { MoreHorizontal, Plus, SearchX, Users } from "lucide-react";
import { AdminFilterLinks, AdminPageHeader, AdminSearchForm } from "@/components/admin/admin-ui";
import { StatusBadge } from "@/components/status-badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { currentStaff } from "@/lib/auth/staff";
import { studentHashFor } from "@/lib/assessment";
import { listClasses, listUsers } from "@/lib/supabase/queries";
import type { UserRow } from "@/types/db";

interface DirectoryRow {
  user: UserRow;
  className: string;
  attempts: number;
}

function initials(name: string) {
  return name.split(/\s+/).filter(Boolean).map((part) => part[0]).join("").slice(0, 2).toUpperCase() || "ST";
}

function StudentAvatar({ name, size = "default" }: { name: string; size?: "default" | "lg" }) {
  return <Avatar size={size}><AvatarFallback className="font-semibold">{initials(name)}</AvatarFallback></Avatar>;
}

export function StudentDirectory({ rows, hasFilters }: { rows: DirectoryRow[]; hasFilters: boolean }) {
  if (!rows.length) {
    return (
      <Card>
        <Empty className="border-0 py-12">
          <EmptyHeader>
            <EmptyMedia variant="icon">{hasFilters ? <SearchX /> : <Users />}</EmptyMedia>
            <EmptyTitle>{hasFilters ? "No matching students" : "No students yet"}</EmptyTitle>
            <EmptyDescription>{hasFilters ? "Change the current search or status filter." : "Add the first student to begin building the academic directory."}</EmptyDescription>
          </EmptyHeader>
          <EmptyContent>
            {hasFilters ? <Button size="sm" variant="outline" render={<Link href="/admin/students" />}>Clear filters</Button> : <Button size="sm" render={<Link href="/admin/students?modal=user-new&role=student" />}><Plus data-icon="inline-start" />Add student</Button>}
          </EmptyContent>
        </Empty>
      </Card>
    );
  }

  return (
    <Card className="overflow-hidden">
      <div className="hidden md:block">
        <Table>
          <TableHeader><TableRow><TableHead>Student</TableHead><TableHead>Class</TableHead><TableHead>Exam attempts</TableHead><TableHead>Status</TableHead><TableHead><span className="sr-only">Open student</span></TableHead></TableRow></TableHeader>
          <TableBody>
            {rows.map(({ user, className, attempts }) => (
              <TableRow key={user.id} className="group">
                <TableCell>
                  <Link href={`/admin/students?modal=student&student=${encodeURIComponent(user.id)}`} className="flex min-w-0 items-center gap-3 rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-ring">
                    <StudentAvatar name={user.full_name} size="lg" />
                    <span className="min-w-0"><strong className="block truncate text-sm font-semibold group-hover:underline group-hover:underline-offset-4">{user.full_name}</strong><span className="mt-0.5 block truncate font-mono text-[11px] font-normal text-muted-foreground">{user.id}</span></span>
                  </Link>
                </TableCell>
                <TableCell className="font-medium">{className}</TableCell>
                <TableCell className="tabular-nums">{attempts}</TableCell>
                <TableCell><StatusBadge tone={user.status === "active" ? "emerald" : "neutral"}>{user.status}</StatusBadge></TableCell>
                <TableCell className="text-right"><Button size="icon-sm" variant="ghost" render={<Link href={`/admin/students?modal=student&student=${encodeURIComponent(user.id)}`} />} aria-label={`Open ${user.full_name}`}><MoreHorizontal /></Button></TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <div className="divide-y md:hidden">
        {rows.map(({ user, className, attempts }) => (
          <Link key={user.id} href={`/admin/students?modal=student&student=${encodeURIComponent(user.id)}`} className="flex min-h-20 items-center gap-3 p-4 outline-none transition-colors hover:bg-muted/45 focus-visible:bg-muted/45">
            <StudentAvatar name={user.full_name} size="lg" />
            <span className="min-w-0 flex-1"><strong className="block truncate text-sm font-semibold">{user.full_name}</strong><span className="mt-1 block truncate text-xs text-muted-foreground">{className} · {attempts} attempt{attempts === 1 ? "" : "s"}</span><span className="mt-1 block truncate font-mono text-[10px] text-muted-foreground">{user.id}</span></span>
            <StatusBadge tone={user.status === "active" ? "emerald" : "neutral"}>{user.status}</StatusBadge>
          </Link>
        ))}
      </div>
    </Card>
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
  for (const row of ((attemptsResult.data ?? []) as { student_hash: string }[])) {
    if (row.student_hash) attemptCounts.set(row.student_hash, (attemptCounts.get(row.student_hash) ?? 0) + 1);
  }

  const visible = users.filter((user) => status === "all" || (status === "active" ? user.status === "active" : user.status !== "active"));
  const rows: DirectoryRow[] = await Promise.all(visible.map(async (user) => {
    let hash = "";
    try { hash = await studentHashFor(user.first_name, user.last_name); } catch { hash = ""; }
    return { user, className: user.class_id ? classNames.get(user.class_id) ?? "Unassigned" : "Unassigned", attempts: hash ? attemptCounts.get(hash) ?? 0 : 0 };
  }));

  const totalStudents = totalResult.count ?? 0;
  const activeStudents = activeResult.count ?? 0;
  const hasFilters = Boolean(q) || status !== "all";

  return (
    <div className="flex flex-col gap-5">
      <AdminPageHeader eyebrow="Directory" title="Students" description="Student records connect directly to class membership, exam history and integrity activity." actions={<Button render={<Link href="/admin/students?modal=user-new&role=student" />}><Plus data-icon="inline-start" />Add student</Button>} />
      <div className="grid gap-3 xl:grid-cols-[minmax(0,1fr)_auto] xl:items-center">
        <AdminSearchForm query={q} placeholder="Search name or ID" hidden={{ status: status === "all" ? undefined : status }} />
        <AdminFilterLinks pathname="/admin/students" param="status" current={status} preserve={{ q }} options={[{ value: "all", label: "All students" }, { value: "active", label: "Active" }, { value: "inactive", label: "Inactive" }]} />
      </div>
      <div className="flex flex-wrap items-center justify-between gap-2 text-xs font-medium text-muted-foreground"><span>{rows.length} shown · {totalStudents} total</span><span>{activeStudents} active · {classes.length} classes</span></div>
      <StudentDirectory rows={rows} hasFilters={hasFilters} />
    </div>
  );
}
