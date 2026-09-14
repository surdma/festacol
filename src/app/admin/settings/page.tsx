import { BookOpenCheck, Database, ShieldCheck } from "lucide-react";
import { AdminPageHeader } from "@/components/admin/admin-ui";
import { MajorPicker } from "@/components/admin/major-picker";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { currentStaff } from "@/lib/auth/staff";
import { SubjectsManager } from "./subjects-manager";

export default async function AdminSettingsPage() {
  const { supabase, scope } = await currentStaff();

  if (!scope.isAdmin) {
    return (
      <div className="flex flex-col gap-5">
        <AdminPageHeader eyebrow="Workspace" title="Settings" description="Manage your teaching scope. School-wide catalogs, classes, communication and staff provisioning remain administrator-only." />
        <div className="grid gap-3 sm:grid-cols-2">
          <Card><CardHeader><CardTitle className="flex items-center gap-2 text-base"><BookOpenCheck className="size-4" />Current scope</CardTitle><CardDescription>Subjects control which examinations, questions, attempts and reports are visible to you.</CardDescription></CardHeader><CardContent><p className="text-sm font-medium">{scope.subjects.length ? scope.subjects.join(", ") : "No subjects selected"}</p></CardContent></Card>
          <Card><CardHeader><CardTitle className="flex items-center gap-2 text-base"><ShieldCheck className="size-4" />Qualifier access</CardTitle><CardDescription>This permission is controlled by an administrator.</CardDescription></CardHeader><CardContent><p className="text-sm font-medium">{scope.qualifierAccess ? "Enabled" : "Not enabled"}</p></CardContent></Card>
        </div>
        <MajorPicker />
      </div>
    );
  }

  const { data } = await supabase.from("subjects").select("*").order("name");
  const subjects = (data ?? []) as { code: string; name: string; category: string; streams: string[]; active: boolean }[];
  const activeCount = subjects.filter((subject) => subject.active).length;

  return (
    <div className="flex flex-col gap-5">
      <AdminPageHeader eyebrow="Workspace" title="Settings" description="Manage the shared academic catalog that feeds examinations, question authoring and teacher subject scopes." />
      <div className="grid gap-3 sm:grid-cols-3">
        <Card><CardHeader className="pb-2"><CardTitle className="flex items-center gap-2 text-sm text-muted-foreground"><BookOpenCheck className="size-4" />Subject catalog</CardTitle></CardHeader><CardContent><p className="text-2xl font-semibold tabular-nums">{subjects.length}</p><p className="mt-1 text-xs text-muted-foreground">{activeCount} active</p></CardContent></Card>
        <Card><CardHeader className="pb-2"><CardTitle className="flex items-center gap-2 text-sm text-muted-foreground"><ShieldCheck className="size-4" />Authentication</CardTitle></CardHeader><CardContent><p className="text-sm font-semibold">Supabase Auth</p><p className="mt-1 text-xs text-muted-foreground">Staff roles and staff IDs are enforced server-side.</p></CardContent></Card>
        <Card><CardHeader className="pb-2"><CardTitle className="flex items-center gap-2 text-sm text-muted-foreground"><Database className="size-4" />Persistence</CardTitle></CardHeader><CardContent><p className="text-sm font-semibold">Typed Postgres records</p><p className="mt-1 text-xs text-muted-foreground">The prototype's browser-local records are not used by production admin flows.</p></CardContent></Card>
      </div>
      <SubjectsManager initial={subjects} />
    </div>
  );
}
