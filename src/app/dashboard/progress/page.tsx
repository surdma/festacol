import { redirect } from "next/navigation";
import { attemptsForStudent } from "@/lib/supabase/queries";
import { currentStudent } from "@/lib/auth/current-student";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ExamIdDialog } from "@/components/exam-id-dialog";
import { FadeUp } from "@/components/motion";

export default async function ProgressPage() {
  const ctx = await currentStudent();
  if (!ctx) redirect("/");
  const attempts = await attemptsForStudent(ctx.supabase, ctx.profile.profile_id);
  const qualifier = attempts.find((attempt) => attempt.submitted_at && attempt.context_snapshot.mode === "qualifier");
  const assignedTrack = qualifier?.assigned_track;
  const confidence = qualifier?.placement_confidence;
  return (
    <FadeUp className="flex flex-col gap-4">
      <div><h1 className="text-2xl font-semibold">Progress & promotion</h1></div>
      <div className="grid gap-4 lg:grid-cols-2">
        <Card><CardHeader><CardTitle>Academic session</CardTitle></CardHeader>
          <CardContent className="text-sm text-muted-foreground">Student: {ctx.profile.full_name} · {attempts.filter((attempt) => attempt.submitted_at).length} exams completed</CardContent></Card>
        <Card><CardHeader><CardTitle>Placement</CardTitle></CardHeader>
          <CardContent className="text-sm">
            {assignedTrack ? (
              <><p className="text-xl font-semibold">{assignedTrack}</p>
                <p className="text-muted-foreground">{confidence ?? 0}% confidence — exam-derived recommendation, not a permanent measure.</p></>
            ) : <p className="text-muted-foreground">Pending — complete a qualifier exam.</p>}
          </CardContent></Card>
      </div>
      <ExamIdDialog />
    </FadeUp>
  );
}
