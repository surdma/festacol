import { redirect } from "next/navigation";
import { attemptsForStudent } from "@/lib/supabase/queries";
import { currentStudent } from "@/lib/auth/current-student";
import { answersMayBeRevealed } from "@/lib/assessment";
import { MetricCard } from "@/components/metric-card";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { EmptyState } from "@/components/empty-state";
import { ExamIdDialog } from "@/components/exam-id-dialog";
import { FadeUp, Stagger } from "@/components/motion";
import { BarChart3, ClipboardList, Gauge, ShieldCheck } from "lucide-react";

export default async function AnalyticsPage() {
  const ctx = await currentStudent();
  if (!ctx) redirect("/");
  const attempts = await attemptsForStudent(ctx.supabase, ctx.profile.profile_id);
  const latest = attempts.find((attempt) => attempt.submitted_at);
  if (!latest) {
    return (
      <FadeUp className="flex flex-col gap-4">
        <div><h1 className="text-2xl font-semibold">Analytics</h1></div>
        <EmptyState title="No completed exams" description="Analytics appear after your first submission." />
        <ExamIdDialog />
      </FadeUp>
    );
  }
  const [{ data: stats }, { data: answers }] = await Promise.all([
    ctx.supabase.from("exam_attempt_subject_stats").select("*").eq("attempt_hash", latest.attempt_hash),
    ctx.supabase.from("exam_attempt_answers").select("question_id,correct,correct_answer").eq("attempt_hash", latest.attempt_hash).order("id"),
  ]);
  const subjectStats = ((stats ?? []) as { subject_name: string; percent: number }[]).map((stat) => ({ subject: stat.subject_name, percent: stat.percent }));
  const details = ((answers ?? []) as { question_id: number; correct: boolean | null; correct_answer: string }[]).map((detail) => ({
    questionId: detail.question_id,
    correct: detail.correct,
    correctAnswer: detail.correct_answer,
  }));
  let revealed = false;
  if (latest.session_id) {
    const { data } = await ctx.supabase.from("exam_sessions").select("status,ends_at").eq("id", latest.session_id).maybeSingle();
    const session = data as { status: string; ends_at: number | null } | null;
    revealed = answersMayBeRevealed({ endsAt: session?.ends_at ?? null } as never, (session?.status ?? undefined) as "open" | "draft" | "closed" | undefined);
  } else {
    revealed = true;
  }
  return (
    <FadeUp className="flex flex-col gap-4">
      <div><h1 className="text-2xl font-semibold">Analytics</h1><p className="text-muted-foreground">{latest.session_title}</p></div>
      <Stagger className="grid grid-cols-2 gap-4 xl:grid-cols-4">
        <MetricCard label="Score" value={`${latest.score ?? 0}%`} icon={BarChart3} />
        <MetricCard label="Completion" value={`${latest.completion ?? 0}%`} icon={ClipboardList} />
        <MetricCard label="Pace" value={String(latest.pace_index ?? 0)} icon={Gauge} />
        <MetricCard label="Integrity" value={`${latest.integrity_score ?? 100}%`} icon={ShieldCheck} />
      </Stagger>
      <Card>
        <CardHeader><CardTitle>Subject performance</CardTitle></CardHeader>
        <CardContent className="flex flex-col gap-3">
          {subjectStats.map((stat) => (
            <div key={stat.subject} className="flex flex-col gap-1">
              <p className="flex justify-between text-sm"><span>{stat.subject}</span><span className="tabular-nums">{stat.percent}%</span></p>
              <Progress value={stat.percent} />
            </div>
          ))}
        </CardContent>
      </Card>
      <Card>
        <CardHeader><CardTitle>Answer review</CardTitle>
          <CardDescription>{revealed ? "Review unlocked." : "Answers remain locked until the session closes."}</CardDescription></CardHeader>
        {revealed ? (
          <CardContent className="flex flex-col gap-2">
            {details.map((detail, index) => (
              <p key={detail.questionId} className="border-b py-1 text-sm">Question {index + 1}: {detail.correct ? "Correct" : "Incorrect"} — answer: {detail.correctAnswer}</p>
            ))}
          </CardContent>
        ) : null}
      </Card>
      <ExamIdDialog />
    </FadeUp>
  );
}
