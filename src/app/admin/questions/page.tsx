import Link from "next/link";
import { listQuestions } from "@/lib/supabase/queries";
import { currentStaff } from "@/lib/auth/staff";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { FadeUp } from "@/components/motion";
import { EmptyState } from "@/components/empty-state";
import { SyncBankButton } from "@/components/admin/sync-bank-button";

export default async function AdminQuestionsPage() {
  const { supabase, scope } = await currentStaff();
  const all = await listQuestions(supabase);
  const questions = scope.isAdmin
    ? all
    : scope.qualifierAccess ? all : all.filter((q) => scope.subjects.includes(q.subject_code));
  return (
    <FadeUp className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <div><h1 className="text-2xl font-semibold">Question Bank</h1><p className="text-muted-foreground">
          {scope.isAdmin ? "Route: /admin/questions — sync card + table (120 cap like prototype)" : `Scoped to: ${scope.subjects.join(", ") || "—"}`}
        </p></div>
        <div className="flex gap-2">
          {scope.isAdmin ? <SyncBankButton /> : null}
          <Button size="sm" render={<Link href="/admin/questions?modal=question-new" />}>Add question</Button>
        </div>
      </div>
      {questions.length === 0 ? <EmptyState title="Bank empty" description="Sync public/seed/questions.json via the sync action." /> : (
        <Card><CardContent className="p-0"><Table>
          <TableHeader><TableRow><TableHead>Question</TableHead><TableHead>Subject</TableHead><TableHead>Type</TableHead><TableHead>Source</TableHead></TableRow></TableHeader>
          <TableBody>{questions.map((q) => (
            <TableRow key={String(q.id)}>
              <TableCell className="max-w-md truncate"><Link href={`/admin/questions?modal=question&question=${q.id}`} className="hover:underline">{q.prompt || `#${String(q.id)}`}</Link></TableCell>
              <TableCell>{q.subject_code}</TableCell><TableCell>{q.qtype}</TableCell>
              <TableCell>{q.created_by ? "Teacher" : "Bank"}</TableCell></TableRow>))}
          </TableBody>
        </Table></CardContent></Card>)}
    </FadeUp>
  );
}
