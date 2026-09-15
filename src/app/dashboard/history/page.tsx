import { redirect } from "next/navigation";
import { attemptsForStudent } from "@/lib/supabase/queries";
import { currentStudent } from "@/lib/auth/current-student";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { EmptyState } from "@/components/empty-state";
import { ExamIdDialog } from "@/components/exam-id-dialog";
import { FadeUp } from "@/components/motion";

export default async function HistoryPage() {
  const ctx = await currentStudent();
  if (!ctx) redirect("/");
  const attempts = await attemptsForStudent(ctx.supabase, ctx.profile.profile_id);
  return (
    <FadeUp className="flex flex-col gap-4">
      <div><h1 className="text-2xl font-semibold">Exam history</h1></div>
      {attempts.length === 0 ? <EmptyState title="No history yet" /> : (
        <Card><CardContent className="p-0"><Table>
          <TableHeader><TableRow><TableHead>Exam</TableHead><TableHead>Status</TableHead><TableHead>Score</TableHead></TableRow></TableHeader>
          <TableBody>{attempts.map((attempt) => (
            <TableRow key={attempt.attempt_hash}>
              <TableCell>{attempt.session_title}</TableCell>
              <TableCell>{attempt.submitted_at ? "Submitted" : "In progress"}</TableCell>
              <TableCell className="tabular-nums">{attempt.submitted_at ? `${attempt.score ?? "—"}%` : "—"}</TableCell>
            </TableRow>))}
          </TableBody>
        </Table></CardContent></Card>
      )}
      <ExamIdDialog />
    </FadeUp>
  );
}
