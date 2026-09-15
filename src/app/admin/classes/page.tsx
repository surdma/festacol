import Link from "next/link";
import { BookOpenCheck, MessageCircle, MoreHorizontal, Plus, QrCode, School, Users } from "lucide-react";
import {
  AdminEmptyState,
  AdminPageHeader,
  adminIconButtonClass,
  adminPrimaryButtonClass,
  adminSecondaryButtonClass,
  adminSurfaceClass,
} from "@/components/admin/admin-ui";
import { StatusBadge } from "@/components/status-badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { currentStaff } from "@/lib/auth/staff";
import { listClasses } from "@/lib/supabase/queries";

interface GroupRow { id: string; class_id: string; name: string; invite_url: string; updated_at?: number | string | null }
interface StudentClassRow { class_id: string | null; status: string }
interface SessionRow { id: string; title: string; class_level: string; class_group: string; status: string }
interface AttemptRow { session_id: string; score: number | null; submitted_at: number | null; rewrite_archived_at: number | null }

function average(values: number[]) {
  return values.length ? Math.round(values.reduce((sum, value) => sum + value, 0) / values.length) : null;
}

function groupUpdated(value: number | string | null | undefined) {
  if (!value) return 0;
  const numeric = Number(value);
  if (Number.isFinite(numeric)) return numeric;
  const parsed = Date.parse(String(value));
  return Number.isNaN(parsed) ? 0 : parsed;
}

export default async function AdminClassesPage() {
  const { supabase, scope } = await currentStaff();
  const [classes, groupsResult, studentsResult, sessionsResult, attemptsResult] = await Promise.all([
    listClasses(supabase),
    supabase.from("whatsapp_groups").select("id,class_id,name,invite_url,updated_at").limit(500),
    supabase.from("users").select("class_id,status").eq("role", "student").limit(3000),
    supabase.from("exam_sessions").select("id,title,class_level,class_group,status").limit(1000),
    supabase.from("exam_attempts").select("session_id,score,submitted_at,rewrite_archived_at").limit(5000),
  ]);

  const groups = (groupsResult.data ?? []) as GroupRow[];
  const students = (studentsResult.data ?? []) as StudentClassRow[];
  const sessions = (sessionsResult.data ?? []) as SessionRow[];
  const attempts = (attemptsResult.data ?? []) as AttemptRow[];
  const active = classes.filter((item) => item.status === "active");

  const occupancy = new Map<string, number>();
  for (const student of students.filter((item) => item.status === "active" && item.class_id)) {
    occupancy.set(student.class_id!, (occupancy.get(student.class_id!) ?? 0) + 1);
  }

  const groupsByClass = new Map<string, GroupRow[]>();
  for (const group of groups) {
    const list = groupsByClass.get(group.class_id) ?? [];
    list.push(group);
    groupsByClass.set(group.class_id, list);
  }
  for (const list of groupsByClass.values()) list.sort((a, b) => groupUpdated(b.updated_at) - groupUpdated(a.updated_at));

  const sessionsByAudience = new Map<string, SessionRow[]>();
  for (const session of sessions) {
    const key = `${session.class_level}::${session.class_group}`;
    const list = sessionsByAudience.get(key) ?? [];
    list.push(session);
    sessionsByAudience.set(key, list);
  }
  const attemptsBySession = new Map<string, AttemptRow[]>();
  for (const attempt of attempts) {
    const list = attemptsBySession.get(attempt.session_id) ?? [];
    list.push(attempt);
    attemptsBySession.set(attempt.session_id, list);
  }

  const levelOrder = ["SS1", "SS2", "SS3"];
  const activeStudents = active.reduce((total, item) => total + (occupancy.get(item.id) ?? 0), 0);
  const totalCapacity = active.reduce((total, item) => total + Number(item.capacity || 0), 0);
  const missingCommunication = active.filter((item) => !(groupsByClass.get(item.id)?.length)).length;
  const duplicateMappings = active.filter((item) => (groupsByClass.get(item.id)?.length ?? 0) > 1).length;

  return (
    <div>
      <AdminPageHeader
        eyebrow="Academic structure"
        title="Classes & communication"
        description="Classes are organized by SS level and pathway. Capacity, roster, examination activity, performance and WhatsApp communication stay attached to the same class record."
        actions={scope.isAdmin ? <>
          <Button render={<Link href="/admin/classes?modal=class-new" />} className={adminPrimaryButtonClass}><Plus data-icon="inline-start" />New class</Button>
          <Button render={<Link href="/admin/classes?modal=whatsapp-new" />} variant="outline" className={adminSecondaryButtonClass}><QrCode data-icon="inline-start" />Connect WhatsApp</Button>
        </> : null}
      />

      {active.length ? <>
        <div className="mb-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <div className={`${adminSurfaceClass} p-4`}><span className="grid size-9 place-items-center rounded-xl bg-neutral-950 text-white"><School /></span><strong className="mt-4 block font-display text-2xl font-extrabold">{active.length}</strong><span className="mt-1 block text-xs font-semibold text-neutral-600">Active classes</span></div>
          <div className={`${adminSurfaceClass} p-4`}><span className="grid size-9 place-items-center rounded-xl bg-neutral-950 text-white"><Users /></span><strong className="mt-4 block font-display text-2xl font-extrabold">{activeStudents}/{totalCapacity || "—"}</strong><span className="mt-1 block text-xs font-semibold text-neutral-600">Students / capacity</span></div>
          <div className={`${adminSurfaceClass} p-4`}><span className="grid size-9 place-items-center rounded-xl bg-neutral-950 text-white"><MessageCircle /></span><strong className="mt-4 block font-display text-2xl font-extrabold">{active.length - missingCommunication}/{active.length}</strong><span className="mt-1 block text-xs font-semibold text-neutral-600">Classes with WhatsApp</span></div>
          <div className={`${adminSurfaceClass} p-4`}><span className="grid size-9 place-items-center rounded-xl bg-neutral-950 text-white"><BookOpenCheck /></span><strong className="mt-4 block font-display text-2xl font-extrabold">{sessions.length}</strong><span className="mt-1 block text-xs font-semibold text-neutral-600">Examination sessions</span></div>
        </div>

        <div className="space-y-6">
          {levelOrder.map((level) => {
            const levelClasses = active.filter((item) => item.class_level === level).sort((a, b) => a.stream.localeCompare(b.stream) || a.name.localeCompare(b.name));
            if (!levelClasses.length) return null;
            return (
              <section key={level} className={`${adminSurfaceClass} overflow-hidden`}>
                <div className="flex items-end justify-between gap-3 border-b border-neutral-200 bg-neutral-50/70 px-5 py-4">
                  <div><p className="text-[10px] font-bold uppercase tracking-[.14em] text-neutral-500">Secondary school level</p><h2 className="mt-1 font-display text-xl font-extrabold text-neutral-950">{level}</h2></div>
                  <span className="text-xs font-semibold text-neutral-500">{levelClasses.length} class{levelClasses.length === 1 ? "" : "es"}</span>
                </div>
                <div className="hidden border-b border-neutral-100 bg-white px-5 py-2.5 text-[10px] font-bold uppercase tracking-[.1em] text-neutral-400 lg:grid lg:grid-cols-[minmax(220px,1.25fr)_minmax(190px,.9fr)_minmax(170px,.8fr)_minmax(190px,.9fr)_auto] lg:gap-4"><span>Class / pathway</span><span>Capacity</span><span>Exams / performance</span><span>Communication</span><span>Open</span></div>
                <div className="divide-y divide-neutral-100">
                  {levelClasses.map((item) => {
                    const count = occupancy.get(item.id) ?? 0;
                    const capacity = Number(item.capacity || 0);
                    const remaining = Math.max(0, capacity - count);
                    const utilization = capacity ? Math.min(100, Math.round((count / capacity) * 100)) : 0;
                    const classGroups = groupsByClass.get(item.id) ?? [];
                    const group = classGroups[0];
                    const matchedSessions = sessionsByAudience.get(`${item.class_level}::${item.stream}`) ?? [];
                    const submittedAttempts = matchedSessions.flatMap((session) => attemptsBySession.get(session.id) ?? []).filter((attempt) => attempt.submitted_at && !attempt.rewrite_archived_at);
                    const scores = submittedAttempts.map((attempt) => Number(attempt.score)).filter(Number.isFinite);
                    const classAverage = average(scores);
                    const recordHref = `/admin/classes?modal=class&class=${encodeURIComponent(item.id)}`;
                    return (
                      <article key={item.id} className="grid gap-4 p-5 transition hover:bg-neutral-50/60 lg:grid-cols-[minmax(220px,1.25fr)_minmax(190px,.9fr)_minmax(170px,.8fr)_minmax(190px,.9fr)_auto] lg:items-center">
                        <div className="min-w-0"><Link href={recordHref} className="group inline-flex min-w-0 items-start gap-3"><span className="grid size-10 shrink-0 place-items-center rounded-xl bg-neutral-950 text-white"><School /></span><span className="min-w-0"><strong className="block truncate font-display text-base font-extrabold text-neutral-950 group-hover:underline">{item.name}</strong><span className="mt-1 block text-xs text-neutral-500">{item.stream} · {item.room || "Room not assigned"}</span></span></Link></div>
                        <div><div className="mb-2 flex items-center justify-between gap-3 text-xs"><span className="font-semibold text-neutral-700">{count}/{capacity || "—"}</span><span className="text-neutral-500">{remaining} remaining</span></div><Progress value={utilization} /></div>
                        <div><strong className="block text-sm text-neutral-900">{matchedSessions.length} matched exam{matchedSessions.length === 1 ? "" : "s"}</strong><span className="mt-1 block text-xs text-neutral-500">{classAverage === null ? "No submitted class-matched score" : `${submittedAttempts.length} submissions · avg ${classAverage}%`}</span></div>
                        <div>{group ? <div className="flex flex-col gap-2"><div className="flex items-center gap-2"><StatusBadge tone="emerald">Connected</StatusBadge>{classGroups.length > 1 ? <StatusBadge tone="amber">{classGroups.length} legacy mappings</StatusBadge> : null}</div><span className="truncate text-xs font-medium text-neutral-700">{group.name}</span>{scope.isAdmin ? <Button size="sm" variant="outline" render={<Link href={`/admin/classes?modal=whatsapp-edit&class=${encodeURIComponent(item.id)}&group=${encodeURIComponent(group.id)}`} />} className="w-fit rounded-lg"><QrCode data-icon="inline-start" />Manage</Button> : <Button size="sm" variant="outline" render={<a href={group.invite_url} target="_blank" rel="noopener noreferrer" />} className="w-fit rounded-lg"><QrCode data-icon="inline-start" />Open</Button>}</div> : <div className="flex flex-col gap-2"><StatusBadge tone="neutral">Not configured</StatusBadge>{scope.isAdmin ? <Button size="sm" variant="outline" render={<Link href={`/admin/classes?modal=whatsapp-new&class=${encodeURIComponent(item.id)}`} />} className="w-fit rounded-lg"><MessageCircle data-icon="inline-start" />Connect</Button> : null}</div>}</div>
                        <div className="flex justify-end"><Button size="icon" variant="outline" render={<Link href={recordHref} />} className={adminIconButtonClass} aria-label={`Open ${item.name}`}><MoreHorizontal /></Button></div>
                      </article>
                    );
                  })}
                </div>
              </section>
            );
          })}
        </div>

        {(missingCommunication > 0 || duplicateMappings > 0) ? <section className={`${adminSurfaceClass} mt-6 p-5`}><div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between"><div><p className="text-[10px] font-bold uppercase tracking-[.14em] text-neutral-500">Relationship health</p><h2 className="mt-1 font-display text-lg font-extrabold">Communication exceptions</h2><p className="mt-1 text-sm text-neutral-500">Task 7 treats WhatsApp as a class-owned relationship. Resolve missing or legacy duplicate mappings from the class rows above.</p></div><div className="flex flex-wrap gap-2"><StatusBadge tone={missingCommunication ? "amber" : "emerald"}>{missingCommunication} missing</StatusBadge><StatusBadge tone={duplicateMappings ? "amber" : "emerald"}>{duplicateMappings} duplicate</StatusBadge></div></div></section> : null}
      </> : (
        <section className={adminSurfaceClass}><AdminEmptyState title="No classes configured" description="Create the academic structure before assigning students." action={scope.isAdmin ? <Button render={<Link href="/admin/classes?modal=class-new" />} className={adminPrimaryButtonClass}><School data-icon="inline-start" />New class</Button> : undefined} /></section>
      )}
    </div>
  );
}
