import Link from "next/link";
import { MoreHorizontal } from "lucide-react";
import { AdminFilterLinks, AdminPageHeader, AdminSearchForm } from "@/components/admin/admin-ui";
import { StaffProvisionDialog } from "@/components/admin/staff-provision-dialog";
import { StatusBadge } from "@/components/status-badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { currentStaff } from "@/lib/auth/staff";
import { listClasses, listUsers } from "@/lib/supabase/queries";

export default async function AdminStaffPage({ searchParams }: { searchParams: Promise<{ q?: string; role?: string }> }) {
  const params = await searchParams;
  const q = String(params.q ?? "").trim();
  const role = params.role === "teacher" || params.role === "administrator" ? params.role : "all";
  const { supabase, scope } = await currentStaff();
  const [users, classes] = await Promise.all([listUsers(supabase, "staff", q), listClasses(supabase)]);
  const classNames = new Map(classes.map((item) => [item.id, item.name]));
  const visible = users.filter((user) => role === "all" || user.role === role);

  return (
    <div className="flex flex-col gap-5">
      <AdminPageHeader eyebrow="Directory" title="Staff" description="Teacher and administrator identities, subject scopes and workspace access. Staff credentials remain linked to production Supabase Auth." actions={scope.isAdmin ? <StaffProvisionDialog /> : null} />
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center"><AdminSearchForm query={q} placeholder="Search staff name" hidden={{ role: role === "all" ? undefined : role }} /><AdminFilterLinks pathname="/admin/staff" param="role" current={role} preserve={{ q }} options={[{ value: "all", label: "All staff" }, { value: "teacher", label: "Teachers" }, { value: "administrator", label: "Administrators" }]} /></div>
      <div className="text-sm text-muted-foreground">{visible.length} staff record{visible.length === 1 ? "" : "s"}</div>
      {visible.length ? <Card className="overflow-hidden"><div className="hidden md:block"><Table><TableHeader><TableRow><TableHead>Staff member</TableHead><TableHead>Role</TableHead><TableHead>Subject scope</TableHead><TableHead>Class</TableHead><TableHead>Status</TableHead>{scope.isAdmin ? <TableHead><span className="sr-only">Manage</span></TableHead> : null}</TableRow></TableHeader><TableBody>{visible.map((user) => <TableRow key={user.id}><TableCell><div className="font-medium">{user.full_name}</div><div className="font-mono text-[11px] text-muted-foreground">{user.email || user.id}</div></TableCell><TableCell className="capitalize">{user.role}</TableCell><TableCell className="max-w-sm"><span className="text-sm text-muted-foreground">{user.subjects?.length ? user.subjects.join(", ") : user.role === "administrator" ? "All subjects" : "Not configured"}</span>{user.qualifier_access ? <div className="mt-1"><StatusBadge tone="blue">Qualifier access</StatusBadge></div> : null}</TableCell><TableCell>{user.class_id ? classNames.get(user.class_id) ?? user.class_id : "—"}</TableCell><TableCell><StatusBadge tone={user.status === "active" ? "emerald" : "neutral"}>{user.status}</StatusBadge></TableCell>{scope.isAdmin ? <TableCell className="text-right"><Button size="icon-sm" variant="ghost" render={<Link href={`/admin/staff?modal=staff-edit&staff=${encodeURIComponent(user.id)}`} />} aria-label={`Manage ${user.full_name}`}><MoreHorizontal /></Button></TableCell> : null}</TableRow>)}</TableBody></Table></div><div className="divide-y md:hidden">{visible.map((user) => scope.isAdmin ? <Link key={user.id} href={`/admin/staff?modal=staff-edit&staff=${encodeURIComponent(user.id)}`} className="block p-4 hover:bg-muted/50"><div className="flex items-start justify-between gap-3"><div className="min-w-0"><strong className="block truncate text-sm">{user.full_name}</strong><span className="mt-1 block truncate text-xs text-muted-foreground">{user.email || user.id}</span></div><StatusBadge tone={user.status === "active" ? "emerald" : "neutral"}>{user.status}</StatusBadge></div><p className="mt-3 text-xs text-muted-foreground">{user.role === "administrator" ? "Administrator · all subjects" : `Teacher · ${user.subjects?.join(", ") || "subjects not configured"}`}</p></Link> : <div key={user.id} className="p-4"><div className="flex items-start justify-between gap-3"><div className="min-w-0"><strong className="block truncate text-sm">{user.full_name}</strong><span className="mt-1 block truncate text-xs text-muted-foreground">{user.email || user.id}</span></div><StatusBadge tone={user.status === "active" ? "emerald" : "neutral"}>{user.status}</StatusBadge></div></div>)}</div></Card> : <Card><CardContent className="p-8 text-center text-sm text-muted-foreground">No staff match the current search and role filter.</CardContent></Card>}
    </div>
  );
}
