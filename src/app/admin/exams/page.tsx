import Link from "next/link";
import { listSessions } from "@/lib/supabase/queries";
import { currentStaff, examVisibleTo } from "@/lib/auth/staff";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { StatusBadge } from "@/components/status-badge";
import { EmptyState } from "@/components/empty-state";
import { FadeUp } from "@/components/motion";

export default async function AdminExamsPage() {
  const { supabase, scope } = await currentStaff();
  const sessions = (await listSessions(supabase)).filter((s) => examVisibleTo(s, scope));
  return (
    <FadeUp className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <div><h1 className="text-2xl font-semibold">Examinations</h1><p className="text-muted-foreground">
          {scope.isAdmin ? "Route: /admin/exams — detail opens as a dialog" : `Scoped to your subjects${scope.qualifierAccess ? " + qualifier" : ""}`}
        </p></div>
        <Button render={<Link href="/admin/exams?modal=create-exam" />}>New exam</Button>
      </div>
      {sessions.length === 0 ? <EmptyState title="No exams yet" description={scope.isAdmin ? "Create your first exam with the 5-step wizard." : "No exams match your subjects yet."} /> : (
        <Card><CardContent className="p-0"><Table>
          <TableHeader><TableRow><TableHead>Exam</TableHead><TableHead>Audience</TableHead><TableHead>Status</TableHead></TableRow></TableHeader>
          <TableBody>{sessions.map((s) => (
            <TableRow key={s.id}>
              <TableCell><Link href={`/admin/exams?modal=exam&exam=${s.id}`} className="font-medium hover:underline">{s.title}</Link>
                <p className="font-mono text-xs text-muted-foreground">{s.id}</p></TableCell>
              <TableCell>{s.class_level} · {s.class_group}</TableCell>
              <TableCell><StatusBadge tone={s.status === "open" ? "emerald" : s.status === "draft" ? "amber" : "neutral"}>{s.status}</StatusBadge></TableCell>
            </TableRow>))}
          </TableBody>
        </Table></CardContent></Card>
      )}
    </FadeUp>
  );
}
