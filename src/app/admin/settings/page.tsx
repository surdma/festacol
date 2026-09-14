import { BookOpenCheck, Database, LogOut, ShieldCheck } from "lucide-react";
import { signOutAdminAction } from "@/app/actions/admin-auth";
import { AdminMetricCard, AdminPageHeader, adminSecondaryButtonClass, adminSurfaceClass } from "@/components/admin/admin-ui";
import { MajorPicker } from "@/components/admin/major-picker";
import { Button } from "@/components/ui/button";
import { currentStaff } from "@/lib/auth/staff";
import { SubjectsManager } from "./subjects-manager";

export default async function AdminSettingsPage() {
  const { supabase, scope } = await currentStaff();
  const { data: authData } = await supabase.auth.getUser();
  const sessionPanel = (
    <section className={`${adminSurfaceClass} mt-5 p-5`}>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <p className="text-[10px] font-bold uppercase tracking-[.14em] text-neutral-500">Session</p>
          <h2 className="mt-1 font-display text-lg font-extrabold text-neutral-950">Signed-in staff account</h2>
          <p className="mt-1 truncate text-xs text-neutral-500">{authData.user?.email ?? "Authenticated staff"} · {scope.role}</p>
        </div>
        <form action={signOutAdminAction} className="shrink-0">
          <Button type="submit" variant="outline" className={adminSecondaryButtonClass}><LogOut className="size-4" />Sign out</Button>
        </form>
      </div>
    </section>
  );

  if (!scope.isAdmin) {
    return (
      <div>
        <AdminPageHeader eyebrow="Workspace" title="Settings" description="Manage your teaching scope. School-wide catalogs, classes, communication and staff provisioning remain administrator-only." />
        <section className="grid gap-3 sm:grid-cols-2">
          <article className={`${adminSurfaceClass} p-5`}><span className="grid size-9 place-items-center rounded-xl bg-neutral-950 text-white"><BookOpenCheck className="size-4" /></span><p className="mt-4 text-[10px] font-bold uppercase tracking-[.14em] text-neutral-500">Current scope</p><strong className="mt-2 block text-sm text-neutral-950">{scope.subjects.length ? scope.subjects.join(", ") : "No subjects selected"}</strong><p className="mt-2 text-xs leading-5 text-neutral-500">Subjects control which examinations, questions, attempts and reports are visible to you.</p></article>
          <article className={`${adminSurfaceClass} p-5`}><span className="grid size-9 place-items-center rounded-xl bg-neutral-950 text-white"><ShieldCheck className="size-4" /></span><p className="mt-4 text-[10px] font-bold uppercase tracking-[.14em] text-neutral-500">Qualifier access</p><strong className="mt-2 block text-sm text-neutral-950">{scope.qualifierAccess ? "Enabled" : "Not enabled"}</strong><p className="mt-2 text-xs leading-5 text-neutral-500">This permission is controlled by an administrator.</p></article>
        </section>
        <div className="mt-5"><MajorPicker /></div>
        {sessionPanel}
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
      {sessionPanel}
    </div>
  );
}
