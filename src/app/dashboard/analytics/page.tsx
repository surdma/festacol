import { redirect } from "next/navigation";
import { BarChart3, ClipboardList, Gauge, ShieldCheck } from "lucide-react";
import { attemptsForStudent } from "@/lib/supabase/queries";
import { currentStudent } from "@/lib/auth/current-student";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { answersMayBeRevealed } from "@/lib/assessment";
import { MetricCard } from "@/components/metric-card";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { EmptyState } from "@/components/empty-state";
import { ExamIdDialog } from "@/components/exam-id-dialog";
import { FadeUp, Stagger } from "@/components/motion";

export default async function AnalyticsPage() {
  const ctx = await currentStudent();
  if (!ctx) redirect("/");
  const attempts = await attemptsForStudent(ctx.supabase, ctx.profile.profile_id);
  const latest = attempts.find((attempt) => attempt.submitted_at);
  if (!latest) {
    return <FadeUp className="flex flex-col gap-4"><div><h1 className="text-2xl font-semibold">Analytics</h1></div><EmptyState title="No completed exams" description="Analytics appear after your first submission." /><ExamIdDialog /></FadeUp>;
  }

  const admin = createSupabaseAdminClient();
  const { data: answers } = await admin.from("exam_attempt_responses").select("question_id,correct,correct_answer").eq("attempt_id", latest.id).not("graded_at", "is", null).order("question_id");
  const answerRows = (answers ?? []) as { question_id: number; correct: boolean | null; correct_answer: string | null }[];
  const questionIds = answerRows.map((row) => row.question_id);
  const { data: questions } = questionIds.length ? await admin.from("questions").select("id,subject_id").in("id", questionIds) : { data: [] };
  const questionRows = (questions ?? []) as { id: number; subject_id: string }[];
  const subjectIds = [...new Set(questionRows.map((row) => row.subject_id))];
  const { data: subjects } = subjectIds.length ? await admin.from("subjects").select("id,name").in("id", subjectIds) : { data: [] };
  const subjectName = new Map(((subjects ?? []) as { id: string; name: string }[]).map((row) => [row.id, row.name]));
  const questionSubject = new Map(questionRows.map((row) => [row.id, row.subject_id]));
  const aggregate = new Map<string, { correct: number; total: number }>();
  for (const answer of answerRows) {
    const subjectId = questionSubject.get(answer.question_id);
    if (!subjectId) continue;
    const value = aggregate.get(subjectId) ?? { correct: 0, total: 0 };
    value.total += 1;
    if (answer.correct === true) value.correct += 1;
    aggregate.set(subjectId, value);
  }
  const subjectStats = [...aggregate.entries()].map(([subjectId, value]) => ({ subject: subjectName.get(subjectId) ?? "Subject", percent: value.total ? Math.round((value.correct / value.total) * 100) : 0 }));

  const { data: sessionData } = await ctx.supabase.from("exam_sessions").select("status,ends_at").eq("id", latest.session_id).maybeSingle();
  const session = sessionData as { status: string; ends_at: number | null } | null;
  const revealed = answersMayBeRevealed({ endsAt: session?.ends_at ?? null } as never, (session?.status ?? undefined) as "open" | "draft" | "closed" | undefined);

  return (
    <FadeUp className="flex flex-col gap-4">
      <div><h1 className="text-2xl font-semibold">Analytics</h1><p className="text-muted-foreground">{latest.context_snapshot.sessionTitle}</p></div>
      <Stagger className="grid grid-cols-2 gap-4 xl:grid-cols-4">
        <MetricCard label="Score" value={`${latest.score ?? 0}%`} icon={BarChart3} />
        <MetricCard label="Completion" value={`${latest.completion ?? 0}%`} icon={ClipboardList} />
        <MetricCard label="Pace" value={String(latest.pace_index ?? 0)} icon={Gauge} />
        <MetricCard label="Integrity" value={`${latest.integrity_score ?? 100}%`} icon={ShieldCheck} />
      </Stagger>
      <Card><CardHeader><CardTitle>Subject performance</CardTitle></CardHeader><CardContent className="flex flex-col gap-3">{subjectStats.map((stat) => <div key={stat.subject} className="flex flex-col gap-1"><p className="flex justify-between text-sm"><span>{stat.subject}</span><span className="tabular-nums">{stat.percent}%</span></p><Progress value={stat.percent} /></div>)}</CardContent></Card>
      <Card><CardHeader><CardTitle>Answer review</CardTitle><CardDescription>{revealed ? "Review unlocked." : "Answers remain locked until the session closes."}</CardDescription></CardHeader>{revealed ? <CardContent className="flex flex-col gap-2">{answerRows.map((detail, index) => <p key={detail.question_id} className="border-b py-1 text-sm">Question {index + 1}: {detail.correct ? "Correct" : "Incorrect"} — answer: {detail.correct_answer ?? "Not available"}</p>)}</CardContent> : null}</Card>
      <ExamIdDialog />
    </FadeUp>
  );
}
