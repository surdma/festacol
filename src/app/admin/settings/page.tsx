import { BookOpenCheck, Database, ShieldCheck } from "lucide-react";
import { AdminMetricCard, AdminPageHeader, adminSurfaceClass } from "@/components/admin/admin-ui";
import { MajorPicker } from "@/components/admin/major-picker";
import { currentStaff } from "@/lib/auth/staff";
import { SubjectsManager } from "./subjects-manager";

export default async function AdminSettingsPage() {
  const { supabase, scope } = await currentStaff();

  if (!scope.isAdmin) {
    return (
      <div>
        <AdminPageHeader eyebrow="Workspace" title="Settings" description="Manage your teaching scope. School-wide catalogs, classes, communication and staff provisioning remain administrator-only." />
        <section className="grid gap-3 sm:grid-cols-2">
          <article className={`${adminSurfaceClass} p-5`}><span className="grid size-9 place-items-center rounded-xl bg-neutral-950 text-white"><BookOpenCheck className="size-4" /></span><p className="mt-4 text-[10px] font-bold uppercase tracking-[.14em] text-neutral-500">Current scope</p><strong className="mt-2 block text-sm text-neutral-950">{scope.subjects.length ? scope.subjects.join(", ") : "No subjects selected"}</strong><p className="mt-2 text-xs leading-5 text-neutral-500">Subjects control which examinations, questions, attempts and reports are visible to you.</p></article>
          <article className={`${adminSurfaceClass} p-5`}><span className="grid size-9 place-items-center rounded-xl bg-neutral-950 text-white"><ShieldCheck className="size-4" /></span><p className="mt-4 text-[10px] font-bold uppercase tracking-[.14em] text-neutral-500">Qualifier access</p><strong className="mt-2 block text-sm text-neutral-950">{scope.qualifierAccess ? "Enabled" : "Not enabled"}</strong><p className="mt-2 text-xs leading-5 text-neutral-500">This permission is controlled by an administrator.</p></article>
        </section>
        <div className="mt-5"><MajorPicker /></div>
      </div>
    );
  }

  const { data } = await supabase.from("subjects").select("*").order("name");
  const subjects = (data ?? []) as { code: string; name: string; category: string; streams: string[]; active: boolean }[];
  const activeCount = subjects.filter((subject) => subject.active).length;

  return (
    <div>
      <AdminPageHeader eyebrow="Workspace" title="Settings" description="Manage the shared academic catalog that feeds examinations, question authoring and teacher subject scopes." />
      <section className="grid gap-3 sm:grid-cols-3">
        <AdminMetricCard label="Subject catalog" value={String(subjects.length)} detail={`${activeCount} active subjects`} icon={BookOpenCheck} />
        <AdminMetricCard label="Authentication" value="Supabase" detail="staff roles and staff IDs enforced server-side" icon={ShieldCheck} />
        <AdminMetricCard label="Persistence" value="Postgres" detail="typed production records, not prototype local storage" icon={Database} />
      </section>
      <div className="mt-5"><SubjectsManager initial={subjects} /></div>
    </div>
  );
}
