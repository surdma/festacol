import Link from "next/link";
import { ArrowUpRight, BookOpenCheck, CheckCircle2, Clock3, MessageCircle, Plus, School, ShieldAlert, Users } from "lucide-react";
import { AdminPageHeader, AdminSectionHeader } from "@/components/admin/admin-ui";
import { MajorPicker } from "@/components/admin/major-picker";
import { MetricCard } from "@/components/metric-card";
import { StatusBadge } from "@/components/status-badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { currentStaff, examVisibleTo } from "@/lib/auth/staff";
import type { ClassRow, ExamAttemptRow, ExamSessionRow, QuestionRow, UserRow } from "@/types/db";

interface WhatsappRow { id: string; class_id: string; name: string; invite_url: string }
interface EventRow { session_id: string; attempt_hash: string | null; type: string }

function examState(session: ExamSessionRow): "open" | "draft" | "scheduled" | "closed" {
  const now = Date.now();
  if (session.status === "draft") return "draft";
  if (session.status === "closed") return "closed";
  if (session.starts_at && Number(session.starts_at) > now) return "scheduled";
  if (session.ends_at && Number(session.ends_at) < now) return "closed";
  return "open";
}

function stateTone(state: string) {
  if (state === "open") return "emerald";
  if (state === "draft" || state === "scheduled") return "amber";
  return "neutral";
}

function initials(name: string | null) {
  return (name || "Candidate").split(/\s+/).filter(Boolean).map((part) => part[0]).join("").slice(0, 2).toUpperCase();
}

export default async function AdminOverviewPage() {
  const { supabase, scope } = await currentStaff();
  const [usersResult, classesResult, sessionsResult, attemptsResult, groupsResult, eventsResult, questionsResult] = await Promise.all([
    supabase.from("users").select("*").limit(500),
    supabase.from("classes").select("*").limit(200),
    supabase.from("exam_sessions").select("*").order("updated_at", { ascending: false }).limit(200),
    supabase.from("exam_attempts").select("*").order("created_at", { ascending: false }).limit(500),
    supabase.from("whatsapp_groups").select("id,class_id,name,invite_url").limit(300),
    supabase.from("exam_integrity_events").select("session_id,attempt_hash,type").order("at", { ascending: false }).limit(500),
    supabase.from("questions").select("id,subject_code").limit(1000),
  ]);

  const users = (usersResult.data ?? []) as UserRow[];
  const classes = (classesResult.data ?? []) as ClassRow[];
  const sessions = ((sessionsResult.data ?? []) as ExamSessionRow[]).filter((session) => examVisibleTo(session, scope));
  const sessionIds = new Set(sessions.map((session) => session.id));
  const attempts = ((attemptsResult.data ?? []) as ExamAttemptRow[]).filter((attempt) => scope.isAdmin || Boolean(attempt.session_id && sessionIds.has(attempt.session_id)));
  const groups = (groupsResult.data ?? []) as WhatsappRow[];
  const events = ((eventsResult.data ?? []) as EventRow[]).filter((event) => scope.isAdmin || sessionIds.has(event.session_id));
  const questions = ((questionsResult.data ?? []) as Pick<QuestionRow, "id" | "subject_code">[]).filter((question) => scope.isAdmin || scope.subjects.includes(question.subject_code) || (scope.qualifierAccess && question.subject_code.startsWith("q-")));

  const students = users.filter((user) => user.role === "student");
  const activeStudents = students.filter((user) => user.status === "active");
  const inactiveStudents = students.filter((user) => user.status !== "active");
  const activeClasses = classes.filter((item) => item.status === "active");
  const occupancy = new Map<string, number>();
  for (const student of activeStudents) if (student.class_id) occupancy.set(student.class_id, (occupancy.get(student.class_id) ?? 0) + 1);
  const fullClasses = activeClasses.filter((item) => (occupancy.get(item.id) ?? 0) >= item.capacity);
  const missingGroups = activeClasses.filter((item) => !groups.some((group) => group.class_id === item.id));
  const communicationCoverage = activeClasses.length ? Math.round(((activeClasses.length - missingGroups.length) / activeClasses.length) * 100) : 0;
  const liveExams = sessions.filter((session) => examState(session) === "open");
  const drafts = sessions.filter((session) => session.status === "draft");
  const liveAttempts = attempts.filter((attempt) => attempt.started_at && !attempt.submitted_at && !attempt.rewrite_archived_at);
  const submitted = attempts.filter((attempt) => attempt.submitted_at && !attempt.rewrite_archived_at);
  const averageScore = submitted.length ? Math.round(submitted.reduce((sum, attempt) => sum + Number(attempt.score ?? 0), 0) / submitted.length) : 0;
  const affectedAttempts = new Set(events.map((event) => event.attempt_hash).filter(Boolean));
  const setupEmpty = students.length === 0 && activeClasses.length === 0 && sessions.length === 0;

  const attemptCounts = new Map<string, { total: number; submitted: number }>();
  for (const attempt of attempts.filter((item) => !item.rewrite_archived_at && item.session_id)) {
    const sessionId = String(attempt.session_id);
    const value = attemptCounts.get(sessionId) ?? { total: 0, submitted: 0 };
    value.total += 1;
    if (attempt.submitted_at) value.submitted += 1;
    attemptCounts.set(sessionId, value);
  }

  const operationalExams = [...sessions].sort((a, b) => {
    const rank: Record<string, number> = { open: 0, scheduled: 1, draft: 2, closed: 3 };
    return (rank[examState(a)] ?? 4) - (rank[examState(b)] ?? 4) || Number(b.updated_at) - Number(a.updated_at);
  }).slice(0, 5);
  const recentAttempts = [...attempts].sort((a, b) => Number(b.submitted_at ?? b.started_at ?? b.created_at) - Number(a.submitted_at ?? a.started_at ?? a.created_at)).slice(0, 6);

  const queue = [
    drafts.length ? { title: `${drafts.length} draft exam${drafts.length === 1 ? "" : "s"}`, detail: "Not visible to candidates yet.", href: "/admin/exams?status=draft", tone: "amber", label: "draft", icon: BookOpenCheck } : null,
    liveAttempts.length ? { title: `${liveAttempts.length} live attempt${liveAttempts.length === 1 ? "" : "s"}`, detail: "Candidates currently have unfinished papers.", href: "/admin/reports?view=students", tone: "blue", label: "live", icon: Clock3 } : null,
    affectedAttempts.size ? { title: `${affectedAttempts.size} integrity review${affectedAttempts.size === 1 ? "" : "s"}`, detail: `${events.length} recorded integrity event${events.length === 1 ? "" : "s"}.`, href: "/admin/reports?view=integrity", tone: "red", label: "review", icon: ShieldAlert } : null,
    fullClasses.length ? { title: `${fullClasses.length} class${fullClasses.length === 1 ? " is" : "es are"} at capacity`, detail: "Review assignment before adding more students.", href: "/admin/classes", tone: "red", label: "capacity", icon: School } : null,
    scope.isAdmin && missingGroups.length ? { title: `${missingGroups.length} communication gap${missingGroups.length === 1 ? "" : "s"}`, detail: "Active classes without a WhatsApp group.", href: "/admin/classes", tone: "neutral", label: "setup", icon: MessageCircle } : null,
    inactiveStudents.length ? { title: `${inactiveStudents.length} inactive student record${inactiveStudents.length === 1 ? "" : "s"}`, detail: "Review suspended or inactive enrolments.", href: "/admin/students?status=inactive", tone: "neutral", label: "inactive", icon: Users } : null,
  ].filter(Boolean) as { title: string; detail: string; href: string; tone: string; label: string; icon: typeof Users }[];

  const quickActions = [
    { title: "Student directory", detail: "Enrolment & exam history", href: "/admin/students", icon: Users },
    { title: "Class operations", detail: "Capacity & WhatsApp access", href: "/admin/classes", icon: School },
    { title: "Question inventory", detail: `${questions.length} visible items`, href: "/admin/questions", icon: BookOpenCheck },
    { title: "Integrity review", detail: "Exact attempt audit trail", href: "/admin/reports?view=integrity", icon: ShieldAlert },
  ];

  return (
    <div className="flex flex-col gap-6">
      <AdminPageHeader eyebrow="Academic operations" title="Administration overview" description="A dense operating view of examination delivery, enrolment, class capacity, communication and integrity." actions={<Button render={<Link href="/admin/exams?modal=create-exam" />}><Plus data-icon="inline-start" />Create exam</Button>} />
      {scope.isTeacher && scope.subjects.length === 0 ? <MajorPicker /> : null}

      {setupEmpty ? (
        <Card className="border-primary bg-primary text-primary-foreground shadow-lg">
          <CardContent className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between">
            <div><p className="text-xs font-semibold uppercase tracking-[0.16em] text-primary-foreground/65">Workspace setup</p><h2 className="mt-1 text-xl font-semibold">Start with your academic structure</h2><p className="mt-2 max-w-2xl text-sm leading-6 text-primary-foreground/65">Create classes and student records before publishing the first examination. Those records feed attempts, reports and communication workflows.</p></div>
            {scope.isAdmin ? <Button variant="secondary" render={<Link href="/admin/classes" />}><School data-icon="inline-start" />Set up classes</Button> : null}
          </CardContent>
        </Card>
      ) : null}

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-6" aria-label="Operational metrics">
        <MetricCard label="Students" value={String(students.length)} detail={`${activeStudents.length} active records`} icon={Users} />
        <MetricCard label="Active classes" value={String(activeClasses.length)} detail={`${fullClasses.length} currently at capacity`} icon={School} />
        <MetricCard label="Live exams" value={String(liveExams.length)} detail={`${drafts.length} draft · ${sessions.length} visible`} icon={BookOpenCheck} />
        <MetricCard label="Live attempts" value={String(liveAttempts.length)} detail="unfinished candidate sessions" icon={Clock3} />
        <MetricCard label="Submitted" value={String(submitted.length)} detail={`${averageScore}% current average`} icon={CheckCircle2} />
        <MetricCard label="Integrity events" value={String(events.length)} detail={`${affectedAttempts.size} attempts affected`} icon={ShieldAlert} />
      </section>

      <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-4" aria-label="Quick actions">
        {quickActions.map((item) => {
          const Icon = item.icon;
          return <Link key={item.href} href={item.href} className="group flex min-h-24 items-center gap-3 rounded-2xl border bg-card p-4 shadow-sm outline-none transition-[transform,box-shadow,border-color] hover:-translate-y-0.5 hover:border-foreground/15 hover:shadow-md focus-visible:ring-2 focus-visible:ring-ring"><span className="grid size-10 shrink-0 place-items-center rounded-xl bg-muted text-muted-foreground"><Icon className="size-4" /></span><span className="min-w-0 flex-1"><strong className="block text-sm">{item.title}</strong><span className="mt-1 block text-xs text-muted-foreground">{item.detail}</span></span><ArrowUpRight className="size-4 shrink-0 text-muted-foreground transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" /></Link>;
        })}
      </section>

      <div className="grid gap-5 2xl:grid-cols-[1.2fr_.8fr]">
        <Card className="overflow-hidden">
          <AdminSectionHeader eyebrow="Assessment control" title="Active & recent examinations" action={<Button size="sm" variant="outline" render={<Link href="/admin/exams" />}>All exams</Button>} />
          <CardContent className="p-0">
            {operationalExams.length ? <div className="divide-y">{operationalExams.map((session) => {
              const counts = attemptCounts.get(session.id) ?? { total: 0, submitted: 0 };
              const state = examState(session);
              return <Link key={session.id} href={`/admin/exams?modal=exam&exam=${encodeURIComponent(session.id)}`} className="flex min-h-20 items-center gap-3 p-4 outline-none transition-colors hover:bg-muted/45 focus-visible:bg-muted/45"><span className="grid size-10 shrink-0 place-items-center rounded-xl bg-primary text-primary-foreground"><BookOpenCheck className="size-4" /></span><span className="min-w-0 flex-1"><strong className="block truncate text-sm">{session.title}</strong><span className="mt-1 block truncate text-xs text-muted-foreground">{session.class_level} · {session.class_group} · {counts.submitted}/{counts.total} submitted</span></span><StatusBadge tone={stateTone(state)}>{state}</StatusBadge></Link>;
            })}</div> : <Empty className="border-0 py-10"><EmptyHeader><EmptyMedia variant="icon"><BookOpenCheck /></EmptyMedia><EmptyTitle>No examinations configured</EmptyTitle><EmptyDescription>Create an examination when the academic structure is ready.</EmptyDescription></EmptyHeader><EmptyContent><Button size="sm" render={<Link href="/admin/exams?modal=create-exam" />}><Plus data-icon="inline-start" />Create exam</Button></EmptyContent></Empty>}
          </CardContent>
        </Card>

        <Card className="overflow-hidden">
          <AdminSectionHeader eyebrow="Operations queue" title="Needs attention" action={<span className="text-xs font-medium tabular-nums text-muted-foreground">{queue.length} items</span>} />
          <CardContent className="p-0">
            {queue.length ? <div className="divide-y">{queue.slice(0, 6).map((item) => {
              const Icon = item.icon;
              return <Link key={`${item.href}-${item.title}`} href={item.href} className="flex min-h-20 items-start gap-3 p-4 outline-none transition-colors hover:bg-muted/45 focus-visible:bg-muted/45"><span className="mt-0.5 grid size-9 shrink-0 place-items-center rounded-xl bg-muted text-muted-foreground"><Icon className="size-4" /></span><span className="min-w-0 flex-1"><strong className="block text-sm">{item.title}</strong><span className="mt-1 block text-xs leading-5 text-muted-foreground">{item.detail}</span></span><StatusBadge tone={item.tone}>{item.label}</StatusBadge></Link>;
            })}</div> : <div className="flex min-h-32 gap-3 p-5"><span className="grid size-10 shrink-0 place-items-center rounded-xl bg-primary text-primary-foreground"><CheckCircle2 className="size-4" /></span><div><strong className="text-sm">No immediate operational exceptions</strong><p className="mt-1 text-xs leading-5 text-muted-foreground">Draft, active-attempt, integrity, capacity and communication checks are clear.</p></div></div>}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-5 xl:grid-cols-[1.2fr_.8fr]">
        <Card className="overflow-hidden">
          <AdminSectionHeader eyebrow="Recent activity" title="Candidate attempts" action={<Button size="sm" variant="outline" render={<Link href="/admin/reports?view=students" />}>Reports</Button>} />
          <CardContent className="p-0">
            {recentAttempts.length ? <div className="divide-y">{recentAttempts.map((attempt) => <Link key={attempt.attempt_hash} href={`/admin/reports?modal=attempt&attempt=${encodeURIComponent(attempt.attempt_hash)}`} className="flex min-h-20 items-center gap-3 p-4 outline-none transition-colors hover:bg-muted/45 focus-visible:bg-muted/45"><span className="grid size-10 shrink-0 place-items-center rounded-xl bg-muted text-xs font-semibold">{initials(attempt.student_name)}</span><span className="min-w-0 flex-1"><strong className="block truncate text-sm">{attempt.student_name || "Candidate"}</strong><span className="mt-1 block truncate text-xs text-muted-foreground">{attempt.session_title} · {attempt.submitted_at ? `Submitted ${Math.round(Number(attempt.score ?? 0))}%` : "In progress"}</span></span><StatusBadge tone={attempt.submitted_at ? "emerald" : "amber"}>{attempt.submitted_at ? "submitted" : "live"}</StatusBadge></Link>)}</div> : <Empty className="border-0 py-10"><EmptyHeader><EmptyMedia variant="icon"><Clock3 /></EmptyMedia><EmptyTitle>No candidate activity</EmptyTitle><EmptyDescription>Attempts will appear here when students start an examination.</EmptyDescription></EmptyHeader></Empty>}
          </CardContent>
        </Card>

        <Card><CardContent className="p-5"><div className="flex items-center justify-between gap-3"><div><p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">Workspace readiness</p><h2 className="mt-1 text-lg font-semibold">Operational coverage</h2></div><span className="grid size-10 place-items-center rounded-xl bg-primary text-primary-foreground"><CheckCircle2 className="size-4" /></span></div><div className="mt-4 grid gap-2">{[
          ["Question inventory", `${questions.length} visible`, BookOpenCheck],
          ["Class communication", `${communicationCoverage}% coverage`, MessageCircle],
          ["Student records", `${activeStudents.length} active`, Users],
          ["Exam definitions", `${sessions.length} visible`, BookOpenCheck],
        ].map(([label, value, Icon]) => <div key={String(label)} className="flex min-h-12 items-center gap-3 rounded-xl border p-3"><span className="grid size-8 place-items-center rounded-lg bg-muted text-muted-foreground"><Icon className="size-4" /></span><span className="min-w-0 flex-1 text-xs font-medium text-muted-foreground">{String(label)}</span><strong className="text-xs tabular-nums">{String(value)}</strong></div>)}</div></CardContent></Card>
      </div>
    </div>
  );
}
