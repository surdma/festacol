import { redirect } from "next/navigation";
import { attemptsForStudent } from "@/lib/supabase/queries";
import { currentStudent } from "@/lib/auth/current-student";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StatusBadge } from "@/components/status-badge";
import { EmptyState } from "@/components/empty-state";
import { ExamIdDialog } from "@/components/exam-id-dialog";
import { FadeUp } from "@/components/motion";

export default async function ExamsPage() {
  const ctx = await currentStudent();
  if (!ctx) redirect("/");
  const attempts = await attemptsForStudent(ctx.supabase, ctx.profile.profile_id);
  return (
    <FadeUp className="flex flex-col gap-4">
      <div><h1 className="text-2xl font-semibold">My exams</h1><p className="text-muted-foreground">Every attempt on your record.</p></div>
      {attempts.length === 0 ? <EmptyState title="No exam attempts yet" description="Open an exam from a link, QR card, or the Exam ID button." /> : (
        <div className="flex flex-col gap-3">
          {attempts.map((attempt) => (
            <Card key={attempt.attempt_hash}>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle className="text-base">{attempt.session_title} · {attempt.class_level}</CardTitle>
                <StatusBadge tone={attempt.submitted_at ? "emerald" : "amber"}>{attempt.submitted_at ? "Submitted" : "In progress"}</StatusBadge>
              </CardHeader>
              <CardContent className="text-sm text-muted-foreground">
                {attempt.submitted_at ? `Score ${attempt.score ?? "—"}% · Integrity ${attempt.integrity_score ?? "—"}%` : "Resume from the dashboard."}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
      <ExamIdDialog />
    </FadeUp>
  );
}
