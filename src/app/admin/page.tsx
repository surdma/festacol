import { ArrowUpRight, BookOpenCheck, CheckCircle2, Clock3, MessageCircle, Plus, School, ShieldAlert, Users } from "lucide-react";
import Link from "next/link";
import {
  AdminEmptyState,
  AdminMetricCard,
  AdminPageHeader,
  AdminSectionHeader,
  adminPrimaryButtonClass,
  adminSecondaryButtonClass,
  adminSurfaceClass,
} from "@/components/admin/admin-ui";
import { MajorPicker } from "@/components/admin/major-picker";
import { StatusBadge } from "@/components/status-badge";
import { Button } from "@/components/ui/button";
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

function queueToneClass(tone: string) {
  if (tone === "amber") return "bg-amber-50 text-amber-700";
  if (tone === "blue") return "bg-blue-50 text-blue-700";
  if (tone === "red") return "bg-red-50 text-red-700";
  return "bg-neutral-100 text-neutral-700";
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
    drafts.length ? { title: `${drafts.length} draft exam${drafts.length === 1 ? "" : "s"}`, detail: "Not visible to candidates yet.", href: "/admin/exams?status=draft", tone: "amber", icon: BookOpenCheck } : null,
    liveAttempts.length ? { title: `${liveAttempts.length} live attempt${liveAttempts.length === 1 ? "" : "s"}`, detail: "Candidates currently have unfinished papers.", href: "/admin/reports?view=students", tone: "blue", icon: Clock3 } : null,
    affectedAttempts.size ? { title: `${affectedAttempts.size} integrity review${affectedAttempts.size === 1 ? "" : "s"}`, detail: `${events.length} recorded integrity event${events.length === 1 ? "" : "s"}.`, href: "/admin/reports?view=integrity", tone: "red", icon: ShieldAlert } : null,
    fullClasses.length ? { title: `${fullClasses.length} class${fullClasses.length === 1 ? " is" : "es are"} at capacity`, detail: "Review assignment before adding more students.", href: "/admin/classes", tone: "red", icon: School } : null,
    scope.isAdmin && missingGroups.length ? { title: `${missingGroups.length} communication gap${missingGroups.length === 1 ? "" : "s"}`, detail: "Active classes without a WhatsApp group.", href: "/admin/classes", tone: "neutral", icon: MessageCircle } : null,
    inactiveStudents.length ? { title: `${inactiveStudents.length} inactive student record${inactiveStudents.length === 1 ? "" : "s"}`, detail: "Review suspended or inactive enrolments.", href: "/admin/students?status=inactive", tone: "neutral", icon: Users } : null,
  ].filter(Boolean) as { title: string; detail: string; href: string; tone: string; icon: typeof Users }[];

  const quickActions = [
    { title: "Student directory", detail: "Enrolment & exam history", href: "/admin/students", icon: Users },
    { title: "Class operations", detail: "Capacity & WhatsApp QR", href: "/admin/classes", icon: School },
    { title: "Question inventory", detail: `${questions.length} visible items`, href: "/admin/questions", icon: BookOpenCheck },
    { title: "Integrity review", detail: "Exact attempt audit trail", href: "/admin/reports?view=integrity", icon: ShieldAlert },
  ];

  return (
    <div data-admin-dashboard>
      <AdminPageHeader
        eyebrow="Academic operations"
        title="Administration overview"
        description="A dense operating view of examination delivery, enrolment, class capacity, communication and integrity."
        actions={<Button render={<Link href="/admin/exams?modal=create-exam" />} className={adminPrimaryButtonClass}><Plus className="size-4" />Create exam</Button>}
      />
      {scope.isTeacher && scope.subjects.length === 0 ? <div className="mb-5"><MajorPicker /></div> : null}

      {setupEmpty ? (
        <section className="mb-5 rounded-2xl border border-neutral-800 bg-neutral-950 p-5 text-white shadow-lg">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[.16em] text-neutral-400">Workspace setup</p>
              <h2 className="mt-1 font-display text-xl font-extrabold">Start with your academic structure</h2>
              <p className="mt-1 max-w-2xl text-sm leading-6 text-neutral-400">Create classes and student records before publishing the first examination. Festacol will connect those records to attempts, reports and QR distribution.</p>
            </div>
            {scope.isAdmin ? <Button variant="outline" render={<Link href="/admin/classes" />} className={adminSecondaryButtonClass}><School className="size-4" />Set up classes</Button> : null}
          </div>
        </section>
      ) : null}

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-6" aria-label="Operational metrics">
        <AdminMetricCard label="Students" value={String(students.length)} detail={`${activeStudents.length} active records`} icon={Users} />
        <AdminMetricCard label="Active classes" value={String(activeClasses.length)} detail={`${fullClasses.length} currently at capacity`} icon={School} />
        <AdminMetricCard label="Live exams" value={String(liveExams.length)} detail={`${drafts.length} draft · ${sessions.length} visible`} icon={BookOpenCheck} />
        <AdminMetricCard label="Live attempts" value={String(liveAttempts.length)} detail="unfinished candidate sessions" icon={Clock3} />
        <AdminMetricCard label="Submitted" value={String(submitted.length)} detail={`${averageScore}% current average`} icon={CheckCircle2} />
        <AdminMetricCard label="Integrity events" value={String(events.length)} detail={`${affectedAttempts.size} submitted attempts affected`} icon={ShieldAlert} />
      </section>

      <section className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4" aria-label="Quick actions">
        {quickActions.map((item) => {
          const Icon = item.icon;
          return (
            <Link key={item.href} href={item.href} className="group flex items-center gap-3 rounded-2xl border border-neutral-200 bg-white p-4 text-left shadow-sm transition hover:-translate-y-0.5 hover:border-neutral-300 hover:shadow-md focus:outline-none focus:ring-4 focus:ring-neutral-200">
              <span className="grid size-10 place-items-center rounded-xl bg-neutral-100 text-neutral-700"><Icon className="size-4" /></span>
              <span className="min-w-0 flex-1"><strong className="block text-sm">{item.title}</strong><span className="text-xs text-neutral-500">{item.detail}</span></span>
              <ArrowUpRight className="size-4 text-neutral-300 transition group-hover:text-neutral-700" />
            </Link>
          );
        })}
      </section>

      <div className="mt-5 grid gap-5 2xl:grid-cols-[1.2fr_.8fr]">
        <section className={`${adminSurfaceClass} overflow-hidden`}>
          <AdminSectionHeader eyebrow="Assessment control" title="Active & recent examinations" action={<Button variant="outline" render={<Link href="/admin/exams" />} className={adminSecondaryButtonClass}>All exams</Button>} />
          {operationalExams.length ? (
            <div className="divide-y divide-neutral-100">
              {operationalExams.map((session) => {
                const counts = attemptCounts.get(session.id) ?? { total: 0, submitted: 0 };
                const state = examState(session);
                return (
                  <Link key={session.id} href={`/admin/exams?modal=exam&exam=${encodeURIComponent(session.id)}`} className="group flex w-full items-center gap-3 p-4 text-left transition hover:bg-neutral-50 focus:outline-none focus:ring-4 focus:ring-inset focus:ring-neutral-200">
                    <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-neutral-950 text-white"><BookOpenCheck className="size-4" /></span>
                    <span className="min-w-0 flex-1"><strong className="block truncate text-sm">{session.title}</strong><span className="mt-1 block truncate text-xs text-neutral-500">{session.class_level} · {session.class_group} · {counts.submitted}/{counts.total} submitted</span></span>
                    <StatusBadge tone={stateTone(state)}>{state}</StatusBadge>
                  </Link>
                );
              })}
            </div>
          ) : <AdminEmptyState title="No examinations configured" description="Create an examination when the academic structure is ready." action={<Button render={<Link href="/admin/exams?modal=create-exam" />} className={adminPrimaryButtonClass}><Plus className="size-4" />Create exam</Button>} />}
        </section>

        <aside data-operations-queue className={`${adminSurfaceClass} overflow-hidden`}>
          <div className="border-b border-neutral-200 px-5 py-4">
            <p className="text-[10px] font-bold uppercase tracking-[.14em] text-neutral-500">Operations queue</p>
            <div className="mt-1 flex items-center justify-between"><h2 className="font-display text-lg font-extrabold">Needs attention</h2><span className="text-xs font-semibold text-neutral-400">{queue.length} item{queue.length === 1 ? "" : "s"}</span></div>
          </div>
          {queue.length ? (
            <div className="divide-y divide-neutral-100">
              {queue.slice(0, 6).map((item) => {
                const Icon = item.icon;
                return (
                  <Link key={`${item.href}-${item.title}`} href={item.href} className="group flex gap-3 p-4 transition hover:bg-neutral-50 focus:outline-none focus:ring-4 focus:ring-inset focus:ring-neutral-200">
                    <span className={`grid size-9 shrink-0 place-items-center rounded-xl ${queueToneClass(item.tone)}`}><Icon className="size-4" /></span>
                    <span className="min-w-0 flex-1"><strong className="block text-sm">{item.title}</strong><span className="mt-1 block text-xs leading-5 text-neutral-500">{item.detail}</span></span>
                    <ArrowUpRight className="size-4 text-neutral-300 transition group-hover:text-neutral-700" />
                  </Link>
                );
              })}
            </div>
          ) : (
            <div className="flex gap-3 p-5">
              <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-emerald-50 text-emerald-700"><CheckCircle2 className="size-4" /></span>
              <div><strong className="text-sm">No immediate operational exceptions</strong><p className="mt-1 text-xs leading-5 text-neutral-500">Draft, live-attempt, integrity, capacity and communication checks are clear.</p></div>
            </div>
          )}
        </aside>
      </div>

      <div className="mt-5 grid gap-5 xl:grid-cols-[1.2fr_.8fr]">
        <section className={`${adminSurfaceClass} overflow-hidden`}>
          <AdminSectionHeader eyebrow="Recent activity" title="Candidate attempts" action={<Button variant="outline" render={<Link href="/admin/reports?view=students" />} className={adminSecondaryButtonClass}>Reports</Button>} />
          {recentAttempts.length ? (
            <div className="divide-y divide-neutral-100">
              {recentAttempts.map((attempt) => (
                <Link key={attempt.attempt_hash} href={`/admin/reports?modal=attempt&attempt=${encodeURIComponent(attempt.attempt_hash)}`} className="flex w-full items-center gap-3 p-4 text-left transition hover:bg-neutral-50 focus:outline-none focus:ring-4 focus:ring-inset focus:ring-neutral-200">
                  <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-neutral-100 text-xs font-extrabold">{initials(attempt.student_name)}</span>
                  <span className="min-w-0 flex-1"><strong className="block truncate text-sm">{attempt.student_name || "Candidate"}</strong><span className="mt-1 block truncate text-xs text-neutral-500">{attempt.session_title} · {attempt.submitted_at ? `Submitted ${Math.round(Number(attempt.score ?? 0))}%` : "In progress"}</span></span>
                  <StatusBadge tone={attempt.rewrite_archived_at ? "neutral" : attempt.submitted_at ? "emerald" : "amber"}>{attempt.rewrite_archived_at ? "previous" : attempt.submitted_at ? "submitted" : "in progress"}</StatusBadge>
                </Link>
              ))}
            </div>
          ) : <AdminEmptyState title="No candidate activity" description="Attempts will appear here when students start an examination." />}
        </section>

        <aside className={`${adminSurfaceClass} p-5`}>
          <div className="flex items-center justify-between gap-3">
            <div><p className="text-[10px] font-bold uppercase tracking-[.14em] text-neutral-500">Workspace readiness</p><h2 className="mt-1 font-display text-lg font-extrabold">Operational coverage</h2></div>
            <span className="grid size-10 place-items-center rounded-xl bg-neutral-950 text-white"><CheckCircle2 className="size-4" /></span>
          </div>
          <div className="mt-4 grid gap-2">
            {[
              ["Question inventory", `${questions.length} visible`, BookOpenCheck],
              ["Class communication", `${communicationCoverage}% coverage`, MessageCircle],
              ["Student records", `${activeStudents.length} active`, Users],
              ["Exam definitions", `${sessions.length} visible`, BookOpenCheck],
            ].map(([label, value, Icon]) => (
              <div key={String(label)} className="flex items-center gap-3 rounded-xl border border-neutral-200 p-3">
                <span className="grid size-8 place-items-center rounded-lg bg-neutral-100 text-neutral-600"><Icon className="size-4" /></span>
                <span className="min-w-0 flex-1 text-xs font-semibold text-neutral-600">{String(label)}</span>
                <strong className="text-xs text-neutral-950">{String(value)}</strong>
              </div>
            ))}
          </div>
        </aside>
      </div>
    </div>
  );
}
