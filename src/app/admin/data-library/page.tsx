import { Database, FileJson2, ShieldCheck, TriangleAlert } from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getSchoolDataManifestAction } from "@/app/actions/fixture-library";
import { AdminPageHeader } from "@/components/admin/admin-ui";
import { DataMaintenance } from "@/components/admin/data-library/data-maintenance";
import { FixtureLibrary } from "@/components/admin/data-library/fixture-library";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { currentStaff } from "@/lib/auth/staff";

export default async function SchoolDataLibraryPage() {
  const { supabase, scope } = await currentStaff();
  if (!scope.isAdmin) redirect("/admin/settings");

  const [manifest, { count: subjects }, { count: levels }, { count: classes }, { count: questions }] = await Promise.all([
    getSchoolDataManifestAction(),
    supabase.from("subjects").select("id", { count: "exact", head: true }).eq("active", true),
    supabase.from("academic_levels").select("id", { count: "exact", head: true }).eq("active", true),
    supabase.from("classes").select("id", { count: "exact", head: true }).eq("status", "active"),
    supabase.from("questions").select("id", { count: "exact", head: true }).eq("status", "active"),
  ]);

  const counts = { subjects: subjects ?? 0, levels: levels ?? 0, classes: classes ?? 0, questions: questions ?? 0 };
  const bundledTotal = manifest.reduce((total, item) => total + item.bundledRecords, 0);

  return (
    <div>
      <AdminPageHeader
        eyebrow="Administrator operations"
        title="School data"
        description="Inspect and load the approved JSON fixtures that provision curriculum, academic structure and the system-owned question bank. Destructive maintenance is intentionally separated from fixture loading."
        actions={
          <Button variant="outline" nativeButton={false} render={<Link href="/admin/settings" />}>
            Back to settings
          </Button>
        }
      />

      <div className="mb-6 grid border-y border-border bg-muted/20 sm:grid-cols-4">
        <div className="border-b border-border px-4 py-4 sm:border-r sm:border-b-0">
          <p className="text-[10px] font-bold uppercase tracking-[.14em] text-muted-foreground">Fixture sources</p>
          <p className="mt-1 text-sm font-semibold text-foreground">{manifest.length} logical sources</p>
        </div>
        <div className="border-b border-border px-4 py-4 sm:border-r sm:border-b-0">
          <p className="text-[10px] font-bold uppercase tracking-[.14em] text-muted-foreground">Bundled records</p>
          <p className="mt-1 text-sm font-semibold tabular-nums text-foreground">{bundledTotal}</p>
        </div>
        <div className="border-b border-border px-4 py-4 sm:border-r sm:border-b-0">
          <p className="text-[10px] font-bold uppercase tracking-[.14em] text-muted-foreground">Database structure</p>
          <p className="mt-1 text-sm font-semibold text-foreground">{counts.subjects} subjects · {counts.levels} levels · {counts.classes} classes</p>
        </div>
        <div className="px-4 py-4">
          <p className="text-[10px] font-bold uppercase tracking-[.14em] text-muted-foreground">Question inventory</p>
          <p className="mt-1 text-sm font-semibold tabular-nums text-foreground">{counts.questions} active</p>
        </div>
      </div>

      <Alert className="mb-6">
        <ShieldCheck />
        <AlertTitle>Approved bundled sources only</AlertTitle>
        <AlertDescription>Administrators can inspect and apply the JSON fixtures shipped with Festacol. This workspace does not accept arbitrary uploads, and staff-authored questions are protected from fixture replacement.</AlertDescription>
      </Alert>

      <Tabs defaultValue="fixtures" className="gap-5">
        <TabsList variant="line" className="max-w-full overflow-x-auto">
          <TabsTrigger value="fixtures"><FileJson2 data-icon="inline-start" />Fixture operations</TabsTrigger>
          <TabsTrigger value="maintenance"><TriangleAlert data-icon="inline-start" />Maintenance</TabsTrigger>
        </TabsList>

        <TabsContent value="fixtures">
          <FixtureLibrary manifest={manifest} counts={counts} />
        </TabsContent>

        <TabsContent value="maintenance">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3 border-b border-border pb-3">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[.14em] text-muted-foreground">Destructive operations</p>
              <h2 className="mt-1 font-display text-lg font-extrabold text-foreground">Scoped maintenance</h2>
              <p className="mt-1 max-w-2xl text-sm leading-6 text-muted-foreground">Maintenance removes selected operational records. It does not load or refresh fixture data.</p>
            </div>
            <Badge variant="destructive"><Database />Administrator only</Badge>
          </div>
          <DataMaintenance />
        </TabsContent>
      </Tabs>
    </div>
  );
}
