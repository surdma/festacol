import { ArrowUpRight, BookOpenCheck, CalendarDays, Database, GraduationCap, School, ShieldCheck, UsersRound } from "lucide-react";
import Link from "next/link";
import { AdminPageHeader } from "@/components/admin/admin-ui";
import { Badge } from "@/components/ui/badge";
import { currentStaff } from "@/lib/auth/staff";

const cardClass = "group rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm transition motion-safe:duration-200 hover:-translate-y-0.5 hover:border-neutral-300 hover:shadow-md";

function SettingsCard({ href, title, description, meta, icon: Icon }: { href: string; title: string; description: string; meta: string; icon: typeof School }) {
  return (
    <Link href={href} className={cardClass}>
      <div className="flex items-start justify-between gap-4">
        <span className="grid size-10 place-items-center rounded-xl bg-neutral-950 text-white"><Icon className="size-4" /></span>
        <ArrowUpRight className="size-4 text-neutral-300 transition group-hover:text-neutral-700" />
      </div>
      <h2 className="mt-5 font-display text-lg font-extrabold tracking-tight text-neutral-950">{title}</h2>
      <p className="mt-1.5 text-sm leading-6 text-neutral-500">{description}</p>
      <p className="mt-4 border-t border-neutral-100 pt-3 text-xs font-semibold text-neutral-700">{meta}</p>
    </Link>
  );
}

export default async function AdminSettingsPage() {
  const { supabase, scope } = await currentStaff();

  const { data: memberRow } = scope.profileId
    ? await supabase.from("school_members").select("first_name,last_name,staff_number,qualifier_access").eq("id", scope.profileId).maybeSingle()
    : { data: null };
  const member = memberRow as { first_name: string; last_name: string; staff_number: string | null; qualifier_access: boolean } | null;

  if (!scope.isAdmin) {
    const { data: subjectRows } = scope.subjectIds.length
      ? await supabase.from("subjects").select("id,name").in("id", scope.subjectIds).eq("active", true).order("name")
      : { data: [] };
    const subjects = (subjectRows ?? []) as { id: string; name: string }[];

    return (
      <div>
        <AdminPageHeader eyebrow="My settings" title="Teaching settings" description="Review the subjects attached to your teaching role and manage your staff account. School-wide academic setup remains with an administrator." />

        <section className="overflow-hidden rounded-3xl bg-neutral-950 p-6 text-white shadow-sm sm:p-7">
          <div className="grid gap-6 lg:grid-cols-[1.2fr_.8fr] lg:items-end">
            <div>
              <Badge className="border-white/15 bg-white/10 text-white">Teacher workspace</Badge>
              <h2 className="mt-4 font-display text-2xl font-extrabold tracking-tight sm:text-3xl">{member ? `${member.first_name} ${member.last_name}` : "Your teaching workspace"}</h2>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-neutral-300">Your subject qualifications determine the question banks you can work with. Class and examination responsibilities are assigned separately by school administration.</p>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-2xl border border-white/10 bg-white/5 p-4"><p className="text-[10px] font-bold uppercase tracking-[.14em] text-neutral-400">Teaching subjects</p><strong className="mt-2 block font-display text-3xl">{subjects.length}</strong></div>
              <div className="rounded-2xl border border-white/10 bg-white/5 p-4"><p className="text-[10px] font-bold uppercase tracking-[.14em] text-neutral-400">Qualifier exams</p><strong className="mt-2 block text-sm">{scope.qualifierAccess ? "Available" : "Not assigned"}</strong></div>
            </div>
          </div>
        </section>

        <section className="mt-5 grid gap-4 md:grid-cols-2">
          <SettingsCard href="/admin/settings/teaching" title="Teaching subjects" description="Review and update the subjects connected to your teaching qualification." meta={subjects.length ? subjects.map((subject) => subject.name).slice(0, 3).join(" · ") : "No subjects selected yet"} icon={BookOpenCheck} />
          <SettingsCard href="/admin/settings/account" title="Account & access" description="View your staff identity, role and sign-in account in one place." meta={member?.staff_number ? `Staff number ${member.staff_number}` : "Teacher account"} icon={ShieldCheck} />
        </section>
      </div>
    );
  }

  const [{ data: yearRow }, { count: subjectCount }, { count: classCount }, { count: staffCount }] = await Promise.all([
    supabase.from("academic_years").select("id,name,status").eq("status", "active").order("starts_on", { ascending: false }).limit(1).maybeSingle(),
    supabase.from("subjects").select("id", { count: "exact", head: true }).eq("active", true),
    supabase.from("classes").select("id", { count: "exact", head: true }).eq("status", "active"),
    supabase.from("school_members").select("id", { count: "exact", head: true }).eq("status", "active").in("role", ["teacher", "administrator"]),
  ]);
  const year = yearRow as { id: string; name: string; status: string } | null;

  return (
    <div>
      <AdminPageHeader eyebrow="School settings" title="Settings" description="Manage the academic structure of the school, your administrator account, and the controlled school-data tools used to prepare the workspace." />

      <section className="overflow-hidden rounded-3xl border border-neutral-800 bg-neutral-950 p-6 text-white shadow-sm sm:p-7">
        <div className="grid gap-7 lg:grid-cols-[1.1fr_.9fr] lg:items-end">
          <div>
            <Badge className="border-white/15 bg-white/10 text-white">Administrator</Badge>
            <h2 className="mt-4 font-display text-2xl font-extrabold tracking-tight sm:text-3xl">Academic environment</h2>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-neutral-300">The settings here follow the school structure already used by classes, subjects, staff assignments and examinations.</p>
            <div className="mt-5 flex items-center gap-2 text-sm text-neutral-300"><CalendarDays className="size-4" /><span>{year ? `${year.name} is the active academic year` : "No active academic year is set"}</span></div>
          </div>
          <div className="grid grid-cols-3 gap-2 sm:gap-3">
            <div className="rounded-2xl border border-white/10 bg-white/5 p-3 sm:p-4"><p className="text-[10px] font-bold uppercase tracking-[.14em] text-neutral-400">Subjects</p><strong className="mt-2 block font-display text-2xl sm:text-3xl">{subjectCount ?? 0}</strong></div>
            <div className="rounded-2xl border border-white/10 bg-white/5 p-3 sm:p-4"><p className="text-[10px] font-bold uppercase tracking-[.14em] text-neutral-400">Classes</p><strong className="mt-2 block font-display text-2xl sm:text-3xl">{classCount ?? 0}</strong></div>
            <div className="rounded-2xl border border-white/10 bg-white/5 p-3 sm:p-4"><p className="text-[10px] font-bold uppercase tracking-[.14em] text-neutral-400">Staff</p><strong className="mt-2 block font-display text-2xl sm:text-3xl">{staffCount ?? 0}</strong></div>
          </div>
        </div>
      </section>

      <section className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <SettingsCard href="/admin/settings/academic" title="Academic setup" description="Review the active year, terms, senior levels and subject curriculum." meta={year?.name ?? "Academic year needs attention"} icon={GraduationCap} />
        <SettingsCard href="/admin/classes" title="Classes & offerings" description="Manage class arms and the subjects offered by each class." meta={`${classCount ?? 0} active classes`} icon={School} />
        <SettingsCard href="/admin/settings/account" title="Account & access" description="Review your administrator identity and sign-in account." meta={member?.staff_number ? `Staff number ${member.staff_number}` : "Administrator account"} icon={ShieldCheck} />
        <SettingsCard href="/admin/data-library" title="School data" description="Load approved school records from the prepared data library and manage maintenance actions." meta="Administrator only" icon={Database} />
      </section>

      <section className="mt-5 grid gap-3 sm:grid-cols-3">
        <div className="rounded-2xl border border-neutral-200 bg-white p-4"><span className="grid size-9 place-items-center rounded-xl bg-neutral-100"><GraduationCap className="size-4" /></span><p className="mt-3 text-xs font-semibold text-neutral-500">Curriculum</p><p className="mt-1 text-sm font-bold text-neutral-950">Subjects follow level and study-track rules</p></div>
        <div className="rounded-2xl border border-neutral-200 bg-white p-4"><span className="grid size-9 place-items-center rounded-xl bg-neutral-100"><UsersRound className="size-4" /></span><p className="mt-3 text-xs font-semibold text-neutral-500">Teaching</p><p className="mt-1 text-sm font-bold text-neutral-950">Staff access follows subject qualifications</p></div>
        <div className="rounded-2xl border border-neutral-200 bg-white p-4"><span className="grid size-9 place-items-center rounded-xl bg-neutral-100"><BookOpenCheck className="size-4" /></span><p className="mt-3 text-xs font-semibold text-neutral-500">Examinations</p><p className="mt-1 text-sm font-bold text-neutral-950">Exam access follows classes and subject offerings</p></div>
      </section>
    </div>
  );
}
