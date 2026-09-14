import Link from "next/link";
import { MoreHorizontal, Plus } from "lucide-react";
import { AdminFilterLinks, AdminPageHeader, AdminSearchForm } from "@/components/admin/admin-ui";
import { StatusBadge } from "@/components/status-badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
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

export function StudentDirectory({ rows }: { rows: DirectoryRow[] }) {
  if (!rows.length) {
    return <Card><CardContent className="p-8 text-center text-sm text-muted-foreground">No students match the current search and status filter.</CardContent></Card>;
  }

  return (
    <Card className="overflow-hidden">
      <div className="hidden md:block">
        <Table>
          <TableHeader><TableRow><TableHead>Student</TableHead><TableHead>Class</TableHead><TableHead>Exam attempts</TableHead><TableHead>Status</TableHead><TableHead><span className="sr-only">Open</span></TableHead></TableRow></TableHeader>
          <TableBody>
            {rows.map(({ user, className, attempts }) => (
              <TableRow key={user.id}>
                <TableCell>
                  <Link href={`/admin/students?modal=student&student=${encodeURIComponent(user.id)}`} className="flex items-center gap-3 font-medium hover:underline">
                    <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-muted text-xs font-semibold">{initials(user.full_name)}</span>
                    <span className="min-w-0"><span className="block truncate">{user.full_name}</span><span className="block font-mono text-[11px] font-normal text-muted-foreground">{user.id}</span></span>
                  </Link>
                </TableCell>
                <TableCell>{className}</TableCell>
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
          <Link key={user.id} href={`/admin/students?modal=student&student=${encodeURIComponent(user.id)}`} className="flex items-center gap-3 p-4 hover:bg-muted/50">
            <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-muted text-xs font-semibold">{initials(user.full_name)}</span>
            <span className="min-w-0 flex-1"><strong className="block truncate text-sm">{user.full_name}</strong><span className="mt-1 block text-xs text-muted-foreground">{className} · {attempts} attempts</span></span>
            <StatusBadge tone={user.status === "active" ? "emerald" : "neutral"}>{user.status}</StatusBadge>
          </Link>
        ))}
      </div>
    </Card>
  );
}

function initials(name: string) {
  return name.split(/\s+/).filter(Boolean).map((part) => part[0]).join("").slice(0, 2).toUpperCase() || "ST";
}

export default async function AdminStudentsPage({ searchParams }: { searchParams: Promise<{ q?: string; status?: string }> }) {
  const params = await searchParams;
  const q = String(params.q ?? "").trim();
  const status = params.status === "inactive" ? "inactive" : params.status === "active" ? "active" : "all";
  const { supabase } = await currentStaff();
  const [users, classes, attemptsResult] = await Promise.all([
    listUsers(supabase, "student", q),
    listClasses(supabase),
    supabase.from("exam_attempts").select("student_hash").limit(2000),
  ]);
  const classNames = new Map(classes.map((item) => [item.id, item.name]));
  const attemptCounts = new Map<string, number>();
  for (const row of ((attemptsResult.data ?? []) as { student_hash: string }[])) {
    if (row.student_hash) attemptCounts.set(row.student_hash, (attemptCounts.get(row.student_hash) ?? 0) + 1);
  }
  const visible = users.filter((user) => status === "all" || user.status === status);
  const rows: DirectoryRow[] = await Promise.all(visible.map(async (user) => {
    let hash = "";
    try { hash = await studentHashFor(user.first_name, user.last_name); } catch { hash = ""; }
    return { user, className: user.class_id ? classNames.get(user.class_id) ?? "Unassigned" : "Unassigned", attempts: hash ? attemptCounts.get(hash) ?? 0 : 0 };
  }));

  return (
    <div className="flex flex-col gap-5">
      <AdminPageHeader
        eyebrow="Directory"
        title="Students"
        description="Student records connect class membership, examination history and integrity activity in one production directory."
        actions={<Button render={<Link href="/admin/students?modal=user-new&role=student" />}><Plus data-icon="inline-start" />Add student</Button>}
      />
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
        <AdminSearchForm query={q} placeholder="Search student name" hidden={{ status: status === "all" ? undefined : status }} />
        <AdminFilterLinks pathname="/admin/students" param="status" current={status} preserve={{ q }} options={[{ value: "all", label: "All students" }, { value: "active", label: "Active" }, { value: "inactive", label: "Inactive" }]} />
      </div>
      <div className="flex items-center justify-between text-sm text-muted-foreground"><span>{rows.length} student{rows.length === 1 ? "" : "s"}</span><span>{classes.length} classes</span></div>
      <StudentDirectory rows={rows} />
    </div>
  );
}
