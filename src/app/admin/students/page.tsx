import Link from "next/link";
import { listUsers } from "@/lib/supabase/queries";
import { currentStaff } from "@/lib/auth/staff";
import type { UserRow } from "@/types/db";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { StatusBadge } from "@/components/status-badge";
import { EmptyState } from "@/components/empty-state";
import { FadeUp } from "@/components/motion";

export function DirectoryTable({ users, kind }: { users: UserRow[]; kind: "student" | "staff" }) {
  if (!users.length) return <EmptyState title="No users yet" description="Add students or staff to populate the directory." />;
  return (
    <Card>
      <CardContent className="p-0">
        <Table>
          <TableHeader>
            <TableRow><TableHead>User</TableHead><TableHead>Role</TableHead><TableHead>Status</TableHead></TableRow>
          </TableHeader>
          <TableBody>
            {users.map((u: UserRow) => (
              <TableRow key={u.id}>
                <TableCell><Link href={`/admin/${kind === "student" ? "students" : "staff"}?modal=${kind}&${kind}=${u.id}`} className="font-medium hover:underline">{u.full_name}</Link>
                  <p className="font-mono text-xs text-muted-foreground">{u.id}</p></TableCell>
                <TableCell>{u.role}</TableCell>
                <TableCell><StatusBadge tone={u.status === "active" ? "emerald" : "neutral"}>{u.status}</StatusBadge></TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

export default async function AdminStudentsPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const q = (await searchParams).q ?? "";
  const { supabase, scope } = await currentStaff();
  const users = await listUsers(supabase, "student", q);
  return (
    <FadeUp className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <div><h1 className="text-2xl font-semibold">Students</h1><p className="text-muted-foreground">Route: /admin/students — individual page, filter via ?q=</p></div>
        <Button render={<Link href="/admin/students?modal=user-new&role=student" />}>Add student</Button>
      </div>
      <Card><CardHeader><CardTitle>{users.length} students</CardTitle></CardHeader></Card>
      <DirectoryTable users={users} kind="student" />
    </FadeUp>
  );
}
