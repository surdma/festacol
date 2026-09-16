import Link from "next/link";
import { PrototypeAdminIcon, type PrototypeAdminIconName } from "@/components/admin/prototype-admin-icon";
import { currentStaff, questionSubjectVisibleTo } from "@/lib/auth/staff";
import { listClasses, listSessions, listUsers } from "@/lib/supabase/queries";
import type { ExamAttemptRow, QuestionRow } from "@/types/db";

type BadgeTone = "emerald" | "amber" | "red" | "blue" | "neutral";

const btnPrimary = "inline-flex min-h-10 items-center justify-center gap-2 rounded-lg bg-black px-4 py-2 text-sm font-semibold text-white transition hover:bg-neutral-800";
const btnSecondary = "inline-flex min-h-10 items-center justify-center gap-2 rounded-lg border border-neutral-300 bg-white px-4 py-2 text-sm font-semibold text-neutral-900 transition hover:bg-neutral-100";
const card = "rounded-2xl border border-neutral-200/90 bg-white shadow-sm";

function examState(session: { status: string; starts_at: number | null; ends_at: number | null }): "open" | "draft" | "scheduled" | "closed" {
  const now = Date.now();
  if (session.status === "draft") return "draft";
  if (session.status === "closed") return "closed";
  if (session.starts_at && Number(session.starts_at) > now) return "scheduled";
  if (session.ends_at && Number(session.ends_at) < now) return "closed";
  return "open";
}

function badgeTone(status: string): BadgeTone {
  if (["open", "active", "submitted"].includes(status)) return "emerald";
  if (status === "scheduled") return "blue";
  if (["draft", "in progress"].includes(status)) return "amber";
  if (["closed", "inactive"].includes(status)) return "neutral";
  return "red";
}

function Badge({ children, tone = "neutral" }: { children: React.ReactNode; tone?: BadgeTone }) {
  const toneClass = tone === "emerald" ? "border-emerald-200 bg-emerald-50 text-emerald-800" : tone === "amber" ? "border-amber-200 bg-amber-50 text-amber-800" : tone === "red" ? "border-red-200 bg-red-50 text-red-800" : tone === "blue" ? "border-blue-200 bg-blue-50 text-blue-800" : "border-neutral-200 bg-neutral-100 text-neutral-700";
  return <span className={`inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-semibold ${toneClass}`}>{children}</span>;
}

function initials(name: string | null) {
  return String(name || "?").split(/\s+/u).slice(0, 2).map((part) => part[0]).join("").toUpperCase();
}

function PageHead({ eyebrow, title, detail, actions }: { eyebrow: string; title: string; detail: string; actions?: React.ReactNode }) {
  return <div className="mb-5 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between"><div className="max-w-3xl"><p className="text-[11px] font-bold uppercase tracking-[.16em] text-neutral-500">{eyebrow}</p><h2 className="mt-1.5 font-display text-2xl font-extrabold tracking-tight sm:text-3xl">{title}</h2><p className="mt-1.5 max-w-2xl text-sm leading-6 text-neutral-600">{detail}</p></div>{actions ? <div className="flex shrink-0 flex-wrap gap-2">{actions}</div> : null}</div>;
}

function Empty({ title, detail, action }: { title: string; detail: string; action?: React.ReactNode }) {
  return <div className="grid min-h-52 place-items-center p-7 text-center"><div className="max-w-md"><span className="mx-auto grid size-11 place-items-center rounded-xl border border-neutral-200 bg-neutral-50 text-neutral-500"><PrototypeAdminIcon name="book" /></span><h3 className="mt-4 font-display text-lg font-extrabold">{title}</h3><p className="mt-2 text-sm leading-6 text-neutral-500">{detail}</p>{action ? <div className="mt-5">{action}</div> : null}</div></div>;
}

function Metric({ label, value, detail, icon }: { label: string; value: string | number; detail: string; icon: PrototypeAdminIconName }) {
  return <article className="rounded-2xl border border-neutral-200/90 bg-white p-4 shadow-sm"><div className="flex items-start justify-between gap-3"><div><p className="text-[10px] font-bold uppercase tracking-[.14em] text-neutral-500">{label}</p><strong className="mt-2 block font-display text-2xl font-extrabold sm:text-3xl">{value}</strong></div><span className="grid size-9 place-items-center rounded-xl bg-neutral-950 text-white"><PrototypeAdminIcon name={icon} className="size-4" /></span></div><p className="mt-2 text-xs leading-5 text-neutral-500">{detail}</p></article>;
}

export default async function AdminOverviewPage() {
  const { supabase, scope } = await currentStaff();
  const [students, classes, sessions, attemptsResult, groupsResult, eventsResult, questionsResult] = await Promise.all([
    listUsers(supabase, "student"),
    listClasses(supabase),
    listSessions(supabase),
    supabase.from("exam_attempts").select("*").order("created_at", { ascending: false }).limit(500),
    supabase.from("whatsapp_groups").select("class_id").limit(300),
    supabase.from("exam_integrity_events").select("attempt_id,type").order("at", { ascending: false }).limit(500),
    supabase.from("questions").select("id,subject_id").limit(1000),
  ]);
  const attempts = (attemptsResult.data ?? []) as ExamAttemptRow[];
  const events = (eventsResult.data ?? []) as { attempt_id: string; type: string }[];
  const questions = ((questionsResult.data ?? []) as Pick<QuestionRow, "id" | "subject_id">[]).filter((question) => questionSubjectVisibleTo(question.subject_id, scope));
  const activeStudents = students.filter((user) => user.status === "active");
  const inactiveStudents = students.filter((user) => user.status !== "active");
  const activeClasses = classes.filter((item) => item.status === "active");
  const occupancy = new Map<string, number>();
  for (const student of activeStudents) if (student.class_id) occupancy.set(student.class_id, (occupancy.get(student.class_id) ?? 0) + 1);
  const fullClasses = activeClasses.filter((item) => (occupancy.get(item.id) ?? 0) >= item.capacity);
  const groupClassIds = new Set(((groupsResult.data ?? []) as { class_id: string }[]).map((row) => row.class_id));
  const missingGroups = activeClasses.filter((item) => !groupClassIds.has(item.id));
  const communicationCoverage = activeClasses.length ? Math.round(((activeClasses.length - missingGroups.length) / activeClasses.length) * 100) : 0;
  const active = sessions.filter((session) => examState(session) === "open");
  const drafts = sessions.filter((session) => session.status === "draft");
  const liveAttempts = attempts.filter((attempt) => attempt.started_at && !attempt.submitted_at);
  const submitted = attempts.filter((attempt) => attempt.submitted_at);
  const submittedIds = new Set(submitted.map((attempt) => attempt.id));
  const integrityEvents = events.filter((event) => submittedIds.has(event.attempt_id));
  const integrityAttempts = new Set(integrityEvents.map((event) => event.attempt_id));
  const averageScore = submitted.length ? Math.round(submitted.reduce((sum, attempt) => sum + Number(attempt.score ?? 0), 0) / submitted.length) : 0;

  const attemptCounts = new Map<string, { total: number; submitted: number }>();
  for (const attempt of attempts) {
    const value = attemptCounts.get(attempt.session_id) ?? { total: 0, submitted: 0 };
    value.total += 1;
    if (attempt.submitted_at) value.submitted += 1;
    attemptCounts.set(attempt.session_id, value);
  }
  const operationalExams = [...sessions].sort((a, b) => Number(b.updated_at) - Number(a.updated_at)).slice(0, 5);
  const recent = [...attempts].sort((a, b) => Number(b.submitted_at ?? b.started_at ?? 0) - Number(a.submitted_at ?? a.started_at ?? 0)).slice(0, 6);
  const setupEmpty = !students.length && !activeClasses.length && !sessions.length;

  return (
    <div data-admin-dashboard>
      <PageHead eyebrow="Academic operations" title="Administration overview" detail="Examination delivery, enrolment, class capacity, communication and integrity from the normalized academic graph." actions={<Link href="/admin/exams?modal=create-exam" className={btnPrimary}><PrototypeAdminIcon name="plus" className="size-4" />Create exam</Link>} />
      {setupEmpty ? <section className="mb-5 rounded-2xl border border-neutral-800 bg-neutral-950 p-5 text-white"><div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between"><div><p className="text-[10px] font-bold uppercase tracking-[.16em] text-neutral-400">Workspace setup</p><h3 className="mt-1 font-display text-xl font-extrabold">Start with your academic structure</h3><p className="mt-1 text-sm text-neutral-400">Create the academic year, levels, classes and subject offerings before publishing examinations.</p></div>{scope.isAdmin ? <Link href="/admin/classes" className={btnSecondary}>Set up classes</Link> : null}</div></section> : null}
      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-6">
        <Metric label="Students" value={students.length} detail={`${activeStudents.length} active records`} icon="users" />
        <Metric label="Active classes" value={activeClasses.length} detail={`${fullClasses.length} currently at capacity`} icon="school" />
        <Metric label="Live exams" value={active.length} detail={`${drafts.length} draft · ${sessions.length} total`} icon="book" />
        <Metric label="Live attempts" value={liveAttempts.length} detail="unfinished candidate sessions" icon="clock" />
        <Metric label="Submitted" value={submitted.length} detail={`${averageScore}% current average`} icon="check" />
        <Metric label="Integrity events" value={integrityEvents.length} detail={`${integrityAttempts.size} submitted attempts affected`} icon="shield" />
      </section>

      <div className="mt-5 grid gap-5 2xl:grid-cols-[1.2fr_.8fr]">
        <section className={`${card} overflow-hidden`}>
          <div className="flex items-center justify-between border-b border-neutral-200 px-5 py-4"><div><p className="text-[10px] font-bold uppercase tracking-[.14em] text-neutral-500">Assessment control</p><h3 className="mt-1 font-display text-lg font-extrabold">Active & recent examinations</h3></div><Link href="/admin/exams" className={btnSecondary}>All exams</Link></div>
          {operationalExams.length ? <div className="divide-y divide-neutral-100">{operationalExams.map((session) => { const counts = attemptCounts.get(session.id) ?? { total: 0, submitted: 0 }; const state = examState(session); return <Link key={session.id} href={`/admin/exams?modal=exam&exam=${encodeURIComponent(session.id)}`} className="flex items-center gap-3 p-4 hover:bg-neutral-50"><span className="grid size-10 place-items-center rounded-xl bg-neutral-950 text-white"><PrototypeAdminIcon name="book" /></span><span className="min-w-0 flex-1"><strong className="block truncate text-sm">{session.title}</strong><span className="mt-1 block truncate text-xs text-neutral-500">{session.targetLabels.join(", ") || "Explicit audience"} · {counts.submitted}/{counts.total} submitted</span></span><Badge tone={badgeTone(state)}>{state}</Badge></Link>; })}</div> : <Empty title="No examinations configured" detail="Create an examination when the academic structure is ready." />}
        </section>

        <aside className={`${card} p-5`}><p className="text-[10px] font-bold uppercase tracking-[.14em] text-neutral-500">Workspace readiness</p><h3 className="mt-1 font-display text-lg font-extrabold">Operational coverage</h3><div className="mt-4 grid gap-2">{[["Question inventory", `${questions.length} visible`, "book" as const], ["Class communication", `${communicationCoverage}% coverage`, "qr" as const], ["Inactive students", `${inactiveStudents.length}`, "users" as const], ["Exam definitions", `${sessions.length} configured`, "book" as const]].map(([name, value, icon]) => <div key={name} className="flex items-center gap-3 rounded-xl border border-neutral-200 p-3"><PrototypeAdminIcon name={icon as PrototypeAdminIconName} className="size-4 text-neutral-600" /><span className="flex-1 text-xs font-semibold text-neutral-600">{name}</span><strong className="text-xs">{value}</strong></div>)}</div></aside>
      </div>

      <section className={`${card} mt-5 overflow-hidden`}>
        <div className="flex items-center justify-between border-b border-neutral-200 px-5 py-4"><div><p className="text-[10px] font-bold uppercase tracking-[.14em] text-neutral-500">Recent activity</p><h3 className="mt-1 font-display text-lg font-extrabold">Candidate attempts</h3></div><Link href="/admin/reports?view=students" className={btnSecondary}>Reports</Link></div>
        {recent.length ? <div className="divide-y divide-neutral-100">{recent.map((attempt) => <Link key={attempt.id} href={`/admin/reports?modal=attempt&attempt=${encodeURIComponent(attempt.id)}`} className="flex items-center gap-3 p-4 hover:bg-neutral-50"><span className="grid size-9 place-items-center rounded-xl bg-neutral-100 text-xs font-extrabold">{initials(attempt.context_snapshot.studentName ?? null)}</span><span className="min-w-0 flex-1"><strong className="block truncate text-sm">{attempt.context_snapshot.studentName || "Candidate"}</strong><span className="mt-1 block truncate text-xs text-neutral-500">{attempt.context_snapshot.sessionTitle || attempt.session_id} · {attempt.submitted_at ? `Submitted ${Math.round(Number(attempt.score ?? 0))}%` : "In progress"}</span></span><Badge tone={attempt.submitted_at ? "emerald" : "amber"}>{attempt.submitted_at ? "submitted" : "in progress"}</Badge></Link>)}</div> : <Empty title="No candidate activity" detail="Attempts will appear here when students start an examination." />}
      </section>
    </div>
  );
}
