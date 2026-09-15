import { redirect } from "next/navigation";
import { attemptsForStudent } from "@/lib/supabase/queries";
import { currentStudent } from "@/lib/auth/current-student";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { EmptyState } from "@/components/empty-state";

export default async function HistoryPage() {
  const ctx = await currentStudent();
  if (!ctx) redirect("/");
  const attempts = (await attemptsForStudent(ctx.supabase, ctx.profile.profile_id)).filter((attempt) => attempt.submitted_at);
  return <div className="flex flex-col gap-4"><div><h1 className="text-2xl font-semibold">History</h1><p className="text-muted-foreground">Submitted exam attempts.</p></div>{attempts.length ? <Card><CardContent className="overflow-x-auto p-0"><Table><TableHeader><TableRow><TableHead>Exam</TableHead><TableHead>Attempt</TableHead><TableHead>Score</TableHead><TableHead>Integrity</TableHead></TableRow></TableHeader><TableBody>{attempts.map((attempt) => <TableRow key={attempt.id}><TableCell>{attempt.context_snapshot.sessionTitle}</TableCell><TableCell>#{attempt.attempt_number}</TableCell><TableCell>{attempt.score ?? "—"}%</TableCell><TableCell>{attempt.integrity_score ?? "—"}%</TableCell></TableRow>)}</TableBody></Table></CardContent></Card> : <EmptyState title="No submitted exams" description="Your completed exams will appear here." />}</div>;
}
