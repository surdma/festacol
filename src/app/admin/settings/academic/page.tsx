import { BookOpenCheck, CalendarDays, Layers3, School } from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { AdminPageHeader, adminSecondaryButtonClass } from "@/components/admin/admin-ui";
import { SubjectsManager } from "@/app/admin/settings/subjects-manager";
import { Button } from "@/components/ui/button";
import { currentStaff } from "@/lib/auth/staff";

export default async function AcademicSettingsPage() {
  const { supabase, scope } = await currentStaff();
  if (!scope.isAdmin) redirect("/admin/settings");

  const [{ data: years }, { data: terms }, { data: levels }, { data: subjects }] = await Promise.all([
    supabase.from("academic_years").select("id,name,starts_on,ends_on,status").order("starts_on", { ascending: false }),
    supabase.from("academic_terms").select("id,academic_year_id,name,sequence,starts_on,ends_on,status").order("sequence"),
    supabase.from("academic_levels").select("id,name,ordinal,active").order("ordinal"),
    supabase.from("subjects").select("id,name,active").order("name"),
  ]);

  const yearRows = (years ?? []) as { id: string; name: string; starts_on: string | null; ends_on: string | null; status: string }[];
  const termRows = (terms ?? []) as { id: string; academic_year_id: string; name: string; sequence: number; starts_on: string | null; ends_on: string | null; status: string }[];
  const levelRows = (levels ?? []) as { id: string; name: string; ordinal: number; active: boolean }[];
  const subjectRows = (subjects ?? []) as { id: string; name: string; active: boolean }[];
  const activeYear = yearRows.find((year) => year.status === "active") ?? null;
  const activeTerms = activeYear ? termRows.filter((term) => term.academic_year_id === activeYear.id) : [];

  return (
    <div>
      <AdminPageHeader
        eyebrow="Academic setup"
        title="Academic structure"
        description="Review the school year, terms, senior levels and subject catalogue that classes and examinations use."
        actions={<Button variant="outline" render={<Link href="/admin/classes" />} className={adminSecondaryButtonClass}>Open classes</Button>}
      />

      <section className="grid gap-3 sm:grid-cols-3">
        <article className="rounded-2xl border border-neutral-200 bg-white p-4 shadow-sm"><span className="grid size-9 place-items-center rounded-xl bg-neutral-950 text-white"><CalendarDays className="size-4" /></span><p className="mt-3 text-[10px] font-bold uppercase tracking-[.14em] text-neutral-500">Academic year</p><strong className="mt-1 block text-base text-neutral-950">{activeYear?.name ?? "Not set"}</strong><p className="mt-1 text-xs text-neutral-500">{activeYear ? `${activeTerms.length} term${activeTerms.length === 1 ? "" : "s"} listed` : "Load or set an academic year before creating classes."}</p></article>
        <article className="rounded-2xl border border-neutral-200 bg-white p-4 shadow-sm"><span className="grid size-9 place-items-center rounded-xl bg-neutral-950 text-white"><Layers3 className="size-4" /></span><p className="mt-3 text-[10px] font-bold uppercase tracking-[.14em] text-neutral-500">Senior levels</p><strong className="mt-1 block text-base text-neutral-950">{levelRows.filter((level) => level.active).map((level) => level.name).join(" · ") || "Not set"}</strong><p className="mt-1 text-xs text-neutral-500">Levels are shared by curriculum rules, classes and questions.</p></article>
        <article className="rounded-2xl border border-neutral-200 bg-white p-4 shadow-sm"><span className="grid size-9 place-items-center rounded-xl bg-neutral-950 text-white"><BookOpenCheck className="size-4" /></span><p className="mt-3 text-[10px] font-bold uppercase tracking-[.14em] text-neutral-500">Subjects</p><strong className="mt-1 block text-base text-neutral-950">{subjectRows.filter((subject) => subject.active).length} active</strong><p className="mt-1 text-xs text-neutral-500">Study-track participation is defined by the prepared curriculum data.</p></article>
      </section>

      <section className="mt-5 overflow-hidden rounded-2xl border border-neutral-200 bg-white shadow-sm">
        <div className="border-b border-neutral-200 p-5"><p className="text-[10px] font-bold uppercase tracking-[.14em] text-neutral-500">School calendar</p><h2 className="mt-1 font-display text-lg font-extrabold">Years and terms</h2></div>
        {yearRows.length ? <div className="divide-y divide-neutral-100">{yearRows.map((year) => {
          const yearTerms = termRows.filter((term) => term.academic_year_id === year.id);
          return <div key={year.id} className="grid gap-3 p-4 sm:grid-cols-[minmax(0,1fr)_2fr] sm:items-start"><div><div className="flex items-center gap-2"><strong className="text-sm text-neutral-950">{year.name}</strong><span className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${year.status === "active" ? "bg-emerald-100 text-emerald-800" : "bg-neutral-100 text-neutral-600"}`}>{year.status}</span></div><p className="mt-1 text-xs text-neutral-500">{year.starts_on ?? "Start date not set"} → {year.ends_on ?? "End date not set"}</p></div><div className="flex flex-wrap gap-2">{yearTerms.length ? yearTerms.map((term) => <span key={term.id} className="rounded-xl border border-neutral-200 bg-neutral-50 px-3 py-2 text-xs"><strong>{term.sequence}. {term.name}</strong><span className="ml-2 text-neutral-500">{term.status}</span></span>) : <span className="text-xs text-neutral-500">No terms listed</span>}</div></div>;
        })}</div> : <div className="p-6 text-sm text-neutral-500">No academic years have been prepared yet.</div>}
      </section>

      <div className="mt-5"><SubjectsManager initial={subjectRows} /></div>

      <section className="mt-5 flex items-start gap-3 rounded-2xl border border-neutral-200 bg-neutral-100/70 p-4"><School className="mt-0.5 size-4 shrink-0" /><p className="text-xs leading-5 text-neutral-600">Class arms and their subject offerings are managed from <Link href="/admin/classes" className="font-bold text-neutral-950 underline underline-offset-4">Classes</Link>, where the selected level and study track determine the available curriculum.</p></section>
    </div>
  );
}
