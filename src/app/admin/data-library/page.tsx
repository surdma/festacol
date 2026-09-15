import { Database, FileCheck2, GraduationCap, ShieldCheck } from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { AdminPageHeader, adminSecondaryButtonClass } from "@/components/admin/admin-ui";
import { DataMaintenance } from "@/components/admin/data-library/data-maintenance";
import { FixtureLibrary } from "@/components/admin/data-library/fixture-library";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { currentStaff } from "@/lib/auth/staff";

export default async function SchoolDataLibraryPage() {
  const { supabase, scope } = await currentStaff();
  if (!scope.isAdmin) redirect("/admin/settings");

  const [{ count: subjects }, { count: classes }, { count: questions }] = await Promise.all([
    supabase.from("subjects").select("id", { count: "exact", head: true }).eq("active", true),
    supabase.from("classes").select("id", { count: "exact", head: true }).eq("status", "active"),
    supabase.from("questions").select("id", { count: "exact", head: true }).eq("status", "active"),
  ]);

  const counts = { subjects: subjects ?? 0, classes: classes ?? 0, questions: questions ?? 0 };

  return (
    <div>
      <AdminPageHeader
        eyebrow="Administrator tools"
        title="School data"
        description="Prepare the approved academic records that establish subjects, classes and the school question bank. Load them in order so each stage has the records it depends on."
        actions={<Button variant="outline" render={<Link href="/admin/settings" />} className={adminSecondaryButtonClass}>Back to settings</Button>}
      />

      <section className="mb-5 overflow-hidden rounded-3xl border border-neutral-800 bg-neutral-950 p-6 text-white shadow-sm sm:p-7">
        <div className="grid gap-7 lg:grid-cols-[1.15fr_.85fr] lg:items-end">
          <div>
            <Badge className="border-white/15 bg-white/10 text-white">Administrator only</Badge>
            <h2 className="mt-4 font-display text-2xl font-extrabold tracking-tight sm:text-3xl">Prepare the school workspace</h2>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-neutral-300">Use the approved school data to establish the academic structure. Existing records are matched where possible, and staff-authored questions are protected when the prepared question bank is refreshed.</p>
          </div>
          <div className="grid grid-cols-3 gap-2 sm:gap-3">
            <div className="rounded-2xl border border-white/10 bg-white/5 p-3 sm:p-4"><FileCheck2 className="size-4 text-neutral-400" /><strong className="mt-3 block font-display text-2xl tabular-nums sm:text-3xl">{counts.subjects}</strong><span className="mt-1 block text-[10px] font-bold uppercase tracking-[.12em] text-neutral-400">Subjects</span></div>
            <div className="rounded-2xl border border-white/10 bg-white/5 p-3 sm:p-4"><GraduationCap className="size-4 text-neutral-400" /><strong className="mt-3 block font-display text-2xl tabular-nums sm:text-3xl">{counts.classes}</strong><span className="mt-1 block text-[10px] font-bold uppercase tracking-[.12em] text-neutral-400">Classes</span></div>
            <div className="rounded-2xl border border-white/10 bg-white/5 p-3 sm:p-4"><Database className="size-4 text-neutral-400" /><strong className="mt-3 block font-display text-2xl tabular-nums sm:text-3xl">{counts.questions}</strong><span className="mt-1 block text-[10px] font-bold uppercase tracking-[.12em] text-neutral-400">Questions</span></div>
          </div>
        </div>
      </section>

      <section>
        <div className="mb-4 flex items-start gap-3 rounded-2xl border border-neutral-200 bg-white p-4 shadow-sm">
          <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-neutral-100"><ShieldCheck className="size-4" /></span>
          <div><h2 className="text-sm font-bold text-neutral-950">Controlled preparation</h2><p className="mt-1 text-xs leading-5 text-neutral-500">Only the approved school data bundled with Festacol can be loaded here. Staff cannot choose an outside file or replace staff-authored questions through this page.</p></div>
        </div>
        <FixtureLibrary counts={counts} />
      </section>

      <div className="my-8 border-t border-neutral-200" />
      <DataMaintenance />
    </div>
  );
}
