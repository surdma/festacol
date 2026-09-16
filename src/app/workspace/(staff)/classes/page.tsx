import Link from "next/link";
import { BookOpenCheck, MessageCircle, Plus, QrCode, School, Users } from "lucide-react";
import {
  AdminPageHeader,
  adminPrimaryButtonClass,
  adminSecondaryButtonClass,
  adminSurfaceClass,
} from "@/components/admin/admin-ui";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { currentStaff } from "@/lib/auth/staff";
import { listClasses } from "@/lib/supabase/queries";

interface GroupRow { id: string; class_id: string; name: string; invite_url: string; updated_at?: number | string | null }
interface EnrollmentRow { class_id: string; student_id: string }
interface SessionRow { id: string; title: string; status: string }
interface ClassTargetRow { session_id: string; class_id: string }
interface OfferingTargetRow { session_id: string; offering_id: string }
interface OfferingRow { id: string; class_id: string }
interface AttemptRow { session_id: string; score: number | null; submitted_at: number | null }

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
  const [classes, groupsResult, enrollmentsResult, sessionsResult, classTargetsResult, offeringTargetsResult, offeringsResult, attemptsResult] = await Promise.all([
    listClasses(supabase),
    supabase.from("whatsapp_groups").select("id,class_id,name,invite_url,updated_at").limit(500),
    supabase.from("class_enrollments").select("class_id,student_id").eq("status", "active").is("ended_at", null).limit(5000),
    supabase.from("exam_sessions").select("id,title,status").limit(1000),
    supabase.from("exam_class_targets").select("session_id,class_id").limit(5000),
    supabase.from("exam_offering_targets").select("session_id,offering_id").limit(5000),
    supabase.from("class_subject_offerings").select("id,class_id").limit(5000),
    supabase.from("exam_attempts").select("session_id,score,submitted_at").limit(5000),
  ]);

  const groups = (groupsResult.data ?? []) as GroupRow[];
  const enrollments = (enrollmentsResult.data ?? []) as EnrollmentRow[];
  const sessions = (sessionsResult.data ?? []) as SessionRow[];
  const classTargets = (classTargetsResult.data ?? []) as ClassTargetRow[];
  const offeringTargets = (offeringTargetsResult.data ?? []) as OfferingTargetRow[];
  const offerings = (offeringsResult.data ?? []) as OfferingRow[];
  const attempts = (attemptsResult.data ?? []) as AttemptRow[];
  const active = classes.filter((item) => item.status === "active");

  const occupancy = new Map<string, number>();
  for (const enrollment of enrollments) occupancy.set(enrollment.class_id, (occupancy.get(enrollment.class_id) ?? 0) + 1);

  const groupsByClass = new Map<string, GroupRow[]>();
  for (const group of groups) groupsByClass.set(group.class_id, [...(groupsByClass.get(group.class_id) ?? []), group]);
  for (const list of groupsByClass.values()) list.sort((a, b) => groupUpdated(b.updated_at) - groupUpdated(a.updated_at));

  const offeringClass = new Map(offerings.map((row) => [row.id, row.class_id]));
  const sessionIdsByClass = new Map<string, Set<string>>();
  const linkSession = (classId: string, sessionId: string) => {
    const set = sessionIdsByClass.get(classId) ?? new Set<string>();
    set.add(sessionId);
    sessionIdsByClass.set(classId, set);
  };
  for (const target of classTargets) linkSession(target.class_id, target.session_id);
  for (const target of offeringTargets) {
    const classId = offeringClass.get(target.offering_id);
    if (classId) linkSession(classId, target.session_id);
  }
  const sessionById = new Map(sessions.map((session) => [session.id, session]));
  const attemptsBySession = new Map<string, AttemptRow[]>();
  for (const attempt of attempts) attemptsBySession.set(attempt.session_id, [...(attemptsBySession.get(attempt.session_id) ?? []), attempt]);

  const levelOrder = ["SS1", "SS2", "SS3"];
  const activeStudents = active.reduce((total, item) => total + (occupancy.get(item.id) ?? 0), 0);
  const totalCapacity = active.reduce((total, item) => total + Number(item.capacity || 0), 0);
  const missingCommunication = active.filter((item) => !(groupsByClass.get(item.id)?.length)).length;

  return (
    <div>
      <AdminPageHeader
        eyebrow="Academic structure"
        title="Classes & communication"
        description="Each class belongs to an academic level and one of the Science, Humanities or Business fields. Subject participation is configured independently through class subject offerings."
        actions={scope.isAdmin ? <>
          <Button render={<Link href="/workspace/classes?modal=class-new" />} className={adminPrimaryButtonClass}><Plus data-icon="inline-start" />New class</Button>
          <Button render={<Link href="/workspace/classes?modal=whatsapp-new" />} variant="outline" className={adminSecondaryButtonClass}><QrCode data-icon="inline-start" />Connect WhatsApp</Button>
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
            const levelClasses = active.filter((item) => item.level_name === level).sort((a, b) => (a.track_name ?? "").localeCompare(b.track_name ?? "") || a.arm.localeCompare(b.arm));
            if (!levelClasses.length) return null;
            return (
              <section key={level} className={`${adminSurfaceClass} overflow-hidden`}>
                <div className="flex items-end justify-between gap-3 border-b border-neutral-200 bg-neutral-50/70 px-5 py-4"><div><p className="text-[10px] font-bold uppercase tracking-[.14em] text-neutral-500">Secondary school level</p><h2 className="mt-1 font-display text-xl font-extrabold text-neutral-950">{level}</h2></div><span className="text-xs font-semibold text-neutral-500">{levelClasses.length} class{levelClasses.length === 1 ? "" : "es"}</span></div>
                <div className="divide-y divide-neutral-100">
                  {levelClasses.map((item) => {
                    const count = occupancy.get(item.id) ?? 0;
                    const capacity = Number(item.capacity || 0);
                    const remaining = Math.max(0, capacity - count);
                    const utilization = capacity ? Math.min(100, Math.round((count / capacity) * 100)) : 0;
                    const group = (groupsByClass.get(item.id) ?? [])[0];
                    const matchedSessions = [...(sessionIdsByClass.get(item.id) ?? new Set())].map((id) => sessionById.get(id)).filter(Boolean) as SessionRow[];
                    const submittedAttempts = matchedSessions.flatMap((session) => attemptsBySession.get(session.id) ?? []).filter((attempt) => attempt.submitted_at);
                    const scores = submittedAttempts.map((attempt) => Number(attempt.score)).filter(Number.isFinite);
                    const classAverage = average(scores);
                    const recordHref = `/workspace/classes?modal=class&class=${encodeURIComponent(item.id)}`;
                    return (
                      <article key={item.id} className="grid gap-4 p-5 transition hover:bg-neutral-50/60 lg:grid-cols-[minmax(220px,1.25fr)_minmax(190px,.9fr)_minmax(170px,.8fr)_minmax(190px,.9fr)] lg:items-center">
                        <div className="min-w-0"><Link href={recordHref} className="group inline-flex min-w-0 items-start gap-3"><span className="grid size-10 shrink-0 place-items-center rounded-xl bg-neutral-950 text-white"><School /></span><span className="min-w-0"><strong className="block truncate font-display text-base font-extrabold text-neutral-950 group-hover:underline">{item.display_name}</strong><span className="mt-1 block text-xs text-neutral-500">{item.track_name} · {item.room || "Room not assigned"}</span></span></Link></div>
                        <div><div className="mb-2 flex items-center justify-between gap-3 text-xs"><span className="font-semibold text-neutral-700">{count}/{capacity || "—"}</span><span className="text-neutral-500">{remaining} remaining</span></div><Progress value={utilization} /></div>
                        <div><strong className="block text-sm text-neutral-900">{matchedSessions.length} matched exam{matchedSessions.length === 1 ? "" : "s"}</strong><span className="mt-1 block text-xs text-neutral-500">{classAverage === null ? "No submitted scores" : `${classAverage}% average`}</span></div>
                        <div><strong className="block text-sm text-neutral-900">{group ? group.name : "Not connected"}</strong><span className="mt-1 block text-xs text-neutral-500">{group ? "WhatsApp group linked" : "Add a group from this class record"}</span></div>
                      </article>
                    );
                  })}
                </div>
              </section>
            );
          })}
        </div>
      </> : <section className={`${adminSurfaceClass} p-8 text-sm text-neutral-500`}>No active classes are configured.</section>}
    </div>
  );
}
