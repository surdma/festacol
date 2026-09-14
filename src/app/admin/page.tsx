import Link from "next/link";
import { MajorPicker } from "@/components/admin/major-picker";
import { PrototypeAdminIcon, type PrototypeAdminIconName } from "@/components/admin/prototype-admin-icon";
import { currentStaff, examVisibleTo, questionSubjectVisibleTo } from "@/lib/auth/staff";
import type { ClassRow, ExamAttemptRow, ExamSessionRow, QuestionRow, UserRow } from "@/types/db";

interface WhatsappRow { id: string; class_id: string; name: string; invite_url: string }
interface EventRow { session_id: string; attempt_hash: string | null; type: string }

type BadgeTone = "emerald" | "amber" | "red" | "blue" | "neutral";

const btnPrimary = "inline-flex min-h-10 items-center justify-center gap-2 rounded-lg bg-black px-4 py-2 text-sm font-semibold text-white transition motion-safe:duration-200 motion-safe:ease-out hover:-translate-y-px hover:bg-neutral-800 hover:shadow-sm active:translate-y-0 active:scale-[.98] focus:outline-none focus:ring-4 focus:ring-neutral-300 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:translate-y-0";
const btnSecondary = "inline-flex min-h-10 items-center justify-center gap-2 rounded-lg border border-neutral-300 bg-white px-4 py-2 text-sm font-semibold text-neutral-900 transition motion-safe:duration-200 motion-safe:ease-out hover:-translate-y-px hover:border-neutral-400 hover:bg-neutral-100 hover:shadow-sm active:translate-y-0 active:scale-[.98] focus:outline-none focus:ring-4 focus:ring-neutral-200 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:translate-y-0";
const card = "rounded-2xl border border-neutral-200/90 bg-white shadow-sm";

function examState(session: ExamSessionRow): "open" | "draft" | "scheduled" | "closed" {
  const now = Date.now();
  if (session.status === "draft") return "draft";
  if (session.status === "closed") return "closed";
  if (session.starts_at && Number(session.starts_at) > now) return "scheduled";
  if (session.ends_at && Number(session.ends_at) < now) return "closed";
  return "open";
}

function badgeTone(status: string): BadgeTone {
  if (["open", "active", "submitted", "on-track"].includes(status)) return "emerald";
  if (status === "scheduled") return "blue";
  if (["draft", "review", "in-progress", "in progress"].includes(status)) return "amber";
  if (["closed", "inactive", "graduating", "previous"].includes(status)) return "neutral";
  return "red";
}

function Badge({ children, tone = "neutral" }: { children: React.ReactNode; tone?: BadgeTone }) {
  const toneClass = tone === "emerald"
    ? "border-emerald-200 bg-emerald-50 text-emerald-800"
    : tone === "amber"
      ? "border-amber-200 bg-amber-50 text-amber-800"
      : tone === "red"
        ? "border-red-200 bg-red-50 text-red-800"
        : tone === "blue"
          ? "border-blue-200 bg-blue-50 text-blue-800"
          : "border-neutral-200 bg-neutral-100 text-neutral-700";
  return <span className={`inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-semibold ${toneClass}`}>{children}</span>;
}

function initials(name: string | null) {
  return String(name || "?").split(/\s+/u).slice(0, 2).map((part) => part[0]).join("").toUpperCase();
}

function PageHead({ eyebrow, title, detail, actions }: { eyebrow: string; title: string; detail: string; actions?: React.ReactNode }) {
  return (
    <div className="mb-5 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div className="max-w-3xl"><p className="text-[11px] font-bold uppercase tracking-[.16em] text-neutral-500">{eyebrow}</p><h2 className="mt-1.5 font-display text-2xl font-extrabold tracking-tight sm:text-3xl">{title}</h2><p className="mt-1.5 max-w-2xl text-sm leading-6 text-neutral-600">{detail}</p></div>
      {actions ? <div className="flex shrink-0 flex-wrap gap-2">{actions}</div> : null}
    </div>
  );
}

function Empty({ title, detail, action }: { title: string; detail: string; action?: React.ReactNode }) {
  return <div className="grid min-h-52 place-items-center p-7 text-center"><div className="max-w-md"><span className="mx-auto grid size-11 place-items-center rounded-xl border border-neutral-200 bg-neutral-50 text-neutral-500"><PrototypeAdminIcon name="book" /></span><h3 className="mt-4 font-display text-lg font-extrabold">{title}</h3><p className="mt-2 text-sm leading-6 text-neutral-500">{detail}</p>{action ? <div className="mt-5">{action}</div> : null}</div></div>;
}

function Metric({ label, value, detail, icon }: { label: string; value: string | number; detail: string; icon: PrototypeAdminIconName }) {
  return <article data-admin-metric className="group rounded-2xl border border-neutral-200/90 bg-white p-4 shadow-sm transition motion-safe:duration-200 hover:-translate-y-0.5 hover:border-neutral-300 hover:shadow-md"><div className="flex items-start justify-between gap-3"><div className="min-w-0"><p className="text-[10px] font-bold uppercase tracking-[.14em] text-neutral-500">{label}</p><strong className="mt-2 block font-display text-2xl font-extrabold tracking-tight sm:text-3xl">{value}</strong></div><span className="grid size-9 shrink-0 place-items-center rounded-xl bg-neutral-950 text-white transition motion-safe:duration-200 group-hover:scale-105"><PrototypeAdminIcon name={icon} className="size-4 shrink-0" /></span></div><p className="mt-2 text-xs leading-5 text-neutral-500">{detail}</p></article>;
}

function QueueIcon({ tone, icon }: { tone: string; icon: PrototypeAdminIconName }) {
  const toneClass = tone === "amber" ? "bg-amber-50 text-amber-700" : tone === "blue" ? "bg-blue-50 text-blue-700" : tone === "red" ? "bg-red-50 text-red-700" : "bg-neutral-100 text-neutral-700";
  return <span className={`grid size-9 shrink-0 place-items-center rounded-xl ${toneClass}`}><PrototypeAdminIcon name={icon} className="size-4 shrink-0" /></span>;
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
  const questions = ((questionsResult.data ?? []) as Pick<QuestionRow, "id" | "subject_code">[]).filter((question) => questionSubjectVisibleTo(question.subject_code, scope));

  const students = users.filter((user) => user.role === "student");
  const activeStudents = students.filter((user) => user.status === "active");
  const inactiveStudents = students.filter((user) => user.status !== "active");
  const activeClasses = classes.filter((item) => item.status === "active");
  const occupancy = new Map<string, number>();
  for (const student of activeStudents) if (student.class_id) occupancy.set(student.class_id, (occupancy.get(student.class_id) ?? 0) + 1);
  const fullClasses = activeClasses.filter((item) => (occupancy.get(item.id) ?? 0) >= item.capacity);
  const missingGroups = activeClasses.filter((item) => !groups.some((group) => group.class_id === item.id));
  const communicationCoverage = activeClasses.length ? Math.round(((activeClasses.length - missingGroups.length) / activeClasses.length) * 100) : 0;
  const active = sessions.filter((session) => examState(session) === "open");
  const drafts = sessions.filter((session) => session.status === "draft");
  const liveAttempts = attempts.filter((attempt) => attempt.started_at && !attempt.submitted_at && !attempt.rewrite_archived_at);
  const submitted = attempts.filter((attempt) => attempt.submitted_at && !attempt.rewrite_archived_at);
  const submittedHashes = new Set(submitted.map((attempt) => attempt.attempt_hash));
  const integrityEvents = events.filter((event) => Boolean(event.attempt_hash && submittedHashes.has(event.attempt_hash)));
  const integrityAttempts = new Set(integrityEvents.map((event) => event.attempt_hash).filter(Boolean));
  const averageScore = submitted.length ? Math.round(submitted.reduce((sum, attempt) => sum + Number(attempt.score ?? 0), 0) / submitted.length) : 0;
  const setupEmpty = !students.length && !activeClasses.length && !sessions.length;

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
  const recent = [...attempts].sort((a, b) => Number(b.submitted_at ?? b.started_at ?? 0) - Number(a.submitted_at ?? a.started_at ?? 0)).slice(0, 6);

  const queue = [
    drafts.length ? { title: `${drafts.length} draft exam${drafts.length === 1 ? "" : "s"}`, detail: "Not visible to candidates yet.", href: "/admin/exams?status=draft", tone: "amber", icon: "book" as const } : null,
    liveAttempts.length ? { title: `${liveAttempts.length} live attempt${liveAttempts.length === 1 ? "" : "s"}`, detail: "Candidates currently have unfinished papers.", href: "/admin/exams", tone: "blue", icon: "clock" as const } : null,
    integrityAttempts.size ? { title: `${integrityAttempts.size} integrity review${integrityAttempts.size === 1 ? "" : "s"}`, detail: `${integrityEvents.length} browser integrity event${integrityEvents.length === 1 ? "" : "s"} on submitted attempts.`, href: "/admin/reports?view=integrity", tone: "red", icon: "shield" as const } : null,
    fullClasses.length ? { title: `${fullClasses.length} class${fullClasses.length === 1 ? " is" : "es are"} at capacity`, detail: "Review assignment before adding more students.", href: "/admin/classes", tone: "red", icon: "school" as const } : null,
    scope.isAdmin && missingGroups.length ? { title: `${missingGroups.length} class communication gap${missingGroups.length === 1 ? "" : "s"}`, detail: "Active classes without WhatsApp QR access.", href: "/admin/classes", tone: "neutral", icon: "qr" as const } : null,
    inactiveStudents.length ? { title: `${inactiveStudents.length} inactive student record${inactiveStudents.length === 1 ? "" : "s"}`, detail: "Review suspended or inactive enrolments.", href: "/admin/students?status=inactive", tone: "neutral", icon: "users" as const } : null,
  ].filter(Boolean) as { title: string; detail: string; href: string; tone: string; icon: PrototypeAdminIconName }[];

  const quickActions = [
    { title: "Student directory", detail: "Enrolment & exam history", href: "/admin/students", icon: "users" as const },
    { title: "Class operations", detail: "Capacity & WhatsApp QR", href: "/admin/classes", icon: "school" as const },
    { title: "Question inventory", detail: `${questions.length} validated items`, href: "/admin/questions", icon: "book" as const },
    { title: "Integrity review", detail: "Exact attempt audit trail", href: "/admin/reports?view=integrity", icon: "shield" as const },
  ];

  return (
    <div data-admin-dashboard>
      <PageHead eyebrow="Academic operations" title="Administration overview" detail="A dense operating view of examination delivery, enrolment, class capacity, communication and integrity." actions={<Link href="/admin/exams?modal=create-exam" className={btnPrimary}><PrototypeAdminIcon name="plus" className="size-4 shrink-0" />Create exam</Link>} />
      {scope.isTeacher && scope.subjects.length === 0 ? <div className="mb-5"><MajorPicker /></div> : null}

      {setupEmpty ? <section className="mb-5 rounded-2xl border border-neutral-800 bg-neutral-950 p-5 text-white shadow-lg"><div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between"><div><p className="text-[10px] font-bold uppercase tracking-[.16em] text-neutral-400">Workspace setup</p><h3 className="mt-1 font-display text-xl font-extrabold">Start with your academic structure</h3><p className="mt-1 max-w-2xl text-sm leading-6 text-neutral-400">Create classes and student records before publishing the first examination. Festacol will connect those records to attempts, reports and QR distribution.</p></div>{scope.isAdmin ? <Link href="/admin/classes" className={btnSecondary}><PrototypeAdminIcon name="school" className="size-4 shrink-0" />Set up classes</Link> : null}</div></section> : null}

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-6">
        <Metric label="Students" value={students.length} detail={`${activeStudents.length} active records`} icon="users" />
        <Metric label="Active classes" value={activeClasses.length} detail={`${fullClasses.length} currently at capacity`} icon="school" />
        <Metric label="Live exams" value={active.length} detail={`${drafts.length} draft · ${sessions.length} total`} icon="book" />
        <Metric label="Live attempts" value={liveAttempts.length} detail="unfinished candidate sessions" icon="clock" />
        <Metric label="Submitted" value={submitted.length} detail={`${averageScore}% current average`} icon="check" />
        <Metric label="Integrity events" value={integrityEvents.length} detail={`${integrityAttempts.size} submitted attempts affected`} icon="shield" />
      </section>

      <section className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4" aria-label="Quick actions">
        {quickActions.map((item) => <Link key={item.href} href={item.href} className="group flex items-center gap-3 rounded-2xl border border-neutral-200 bg-white p-4 text-left shadow-sm transition hover:-translate-y-0.5 hover:border-neutral-300 hover:shadow-md"><span className="grid size-10 place-items-center rounded-xl bg-neutral-100 text-neutral-700"><PrototypeAdminIcon name={item.icon} /></span><span className="min-w-0 flex-1"><strong className="block text-sm">{item.title}</strong><span className="text-xs text-neutral-500">{item.detail}</span></span><PrototypeAdminIcon name="external" className="size-4 shrink-0 text-neutral-300 group-hover:text-neutral-700" /></Link>)}
      </section>

      <div className="mt-5 grid gap-5 2xl:grid-cols-[1.2fr_.8fr]">
        <section className={`${card} overflow-hidden`}>
          <div className="flex items-center justify-between border-b border-neutral-200 px-5 py-4"><div><p className="text-[10px] font-bold uppercase tracking-[.14em] text-neutral-500">Assessment control</p><h3 className="mt-1 font-display text-lg font-extrabold">Active & recent examinations</h3></div><Link href="/admin/exams" className={btnSecondary}>All exams</Link></div>
          {operationalExams.length ? <div className="divide-y divide-neutral-100">{operationalExams.map((session) => { const counts = attemptCounts.get(session.id) ?? { total: 0, submitted: 0 }; const state = examState(session); return <Link key={session.id} href={`/admin/exams?modal=exam&exam=${encodeURIComponent(session.id)}`} className="group flex w-full items-center gap-3 p-4 text-left transition hover:bg-neutral-50"><span className="grid size-10 shrink-0 place-items-center rounded-xl bg-neutral-950 text-white"><PrototypeAdminIcon name="book" className="size-4 shrink-0" /></span><span className="min-w-0 flex-1"><strong className="block truncate text-sm">{session.title}</strong><span className="mt-1 block truncate text-xs text-neutral-500">{session.class_level} · {session.class_group} · {counts.submitted}/{counts.total} submitted</span></span><Badge tone={badgeTone(state)}>{state}</Badge></Link>; })}</div> : <Empty title="No examinations configured" detail="Create an examination when the academic structure is ready." action={<Link href="/admin/exams?modal=create-exam" className={btnPrimary}><PrototypeAdminIcon name="plus" className="size-4 shrink-0" />Create exam</Link>} />}
        </section>

        <aside data-operations-queue className={`${card} overflow-hidden`}>
          <div className="border-b border-neutral-200 px-5 py-4"><p className="text-[10px] font-bold uppercase tracking-[.14em] text-neutral-500">Operations queue</p><div className="mt-1 flex items-center justify-between"><h3 className="font-display text-lg font-extrabold">Needs attention</h3><span className="text-xs font-semibold text-neutral-400">{queue.length} item{queue.length === 1 ? "" : "s"}</span></div></div>
          {queue.length ? <div className="divide-y divide-neutral-100">{queue.slice(0, 6).map((item) => <Link key={`${item.href}-${item.title}`} href={item.href} className="group flex gap-3 p-4 transition hover:bg-neutral-50"><QueueIcon tone={item.tone} icon={item.icon} /><span className="min-w-0 flex-1"><strong className="block text-sm">{item.title}</strong><span className="mt-1 block text-xs leading-5 text-neutral-500">{item.detail}</span></span><PrototypeAdminIcon name="external" className="size-4 shrink-0 text-neutral-300 group-hover:text-neutral-700" /></Link>)}</div> : <div className="flex gap-3 p-5"><span className="grid size-10 shrink-0 place-items-center rounded-xl bg-emerald-50 text-emerald-700"><PrototypeAdminIcon name="check" /></span><div><strong className="text-sm">No immediate operational exceptions</strong><p className="mt-1 text-xs leading-5 text-neutral-500">Draft, live-attempt, integrity, capacity and communication checks are clear.</p></div></div>}
        </aside>
      </div>

      <div className="mt-5 grid gap-5 xl:grid-cols-[1.2fr_.8fr]">
        <section className={`${card} overflow-hidden`}>
          <div className="flex items-center justify-between border-b border-neutral-200 px-5 py-4"><div><p className="text-[10px] font-bold uppercase tracking-[.14em] text-neutral-500">Recent activity</p><h3 className="mt-1 font-display text-lg font-extrabold">Candidate attempts</h3></div><Link href="/admin/reports?view=students" className={btnSecondary}>Reports</Link></div>
          {recent.length ? <div className="divide-y divide-neutral-100">{recent.map((attempt) => <Link key={attempt.attempt_hash} href={`/admin/reports?modal=attempt&attempt=${encodeURIComponent(attempt.attempt_hash)}`} className="flex w-full items-center gap-3 p-4 text-left transition hover:bg-neutral-50"><span className="grid size-9 shrink-0 place-items-center rounded-xl bg-neutral-100 text-xs font-extrabold">{initials(attempt.student_name)}</span><span className="min-w-0 flex-1"><strong className="block truncate text-sm">{attempt.student_name || "Candidate"}</strong><span className="mt-1 block truncate text-xs text-neutral-500">{attempt.session_title} · {attempt.submitted_at ? `Submitted ${Math.round(Number(attempt.score ?? 0))}%` : "In progress"}</span></span><Badge tone={attempt.rewrite_archived_at ? "neutral" : attempt.submitted_at ? "emerald" : "amber"}>{attempt.rewrite_archived_at ? "previous" : attempt.submitted_at ? "submitted" : "in progress"}</Badge></Link>)}</div> : <Empty title="No candidate activity" detail="Attempts will appear here when students start an examination." />}
        </section>

        <aside className={`${card} p-5`}>
          <div className="flex items-center justify-between gap-3"><div><p className="text-[10px] font-bold uppercase tracking-[.14em] text-neutral-500">Workspace readiness</p><h3 className="mt-1 font-display text-lg font-extrabold">Operational coverage</h3></div><span className="grid size-10 place-items-center rounded-xl bg-neutral-950 text-white"><PrototypeAdminIcon name="check" /></span></div>
          <div className="mt-4 grid gap-2">{[
            ["Question inventory", `${questions.length} validated`, "book" as const],
            ["Class communication", `${communicationCoverage}% coverage`, "qr" as const],
            ["Student records", `${activeStudents.length} active`, "users" as const],
            ["Exam definitions", `${sessions.length} configured`, "book" as const],
          ].map(([name, value, icon]) => <div key={name} className="flex items-center gap-3 rounded-xl border border-neutral-200 p-3"><span className="grid size-8 place-items-center rounded-lg bg-neutral-100 text-neutral-600"><PrototypeAdminIcon name={icon as PrototypeAdminIconName} className="size-4 shrink-0" /></span><span className="min-w-0 flex-1 text-xs font-semibold text-neutral-600">{name}</span><strong className="text-xs text-neutral-950">{value}</strong></div>)}</div>
        </aside>
      </div>
    </div>
  );
}
