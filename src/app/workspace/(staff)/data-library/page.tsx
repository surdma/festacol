import { Database, ShieldCheck, TriangleAlert, Upload } from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getSchoolDataManifestAction } from "@/app/actions/fixture-library";
import { AdminPageHeader } from "@/components/admin/admin-ui";
import { DataMaintenance } from "@/components/admin/data-library/data-maintenance";
import { FixtureLibrary } from "@/components/admin/data-library/fixture-library";
import { StorageOverview } from "@/components/admin/data-library/storage-overview";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { currentStaff } from "@/lib/auth/staff";

export default async function SchoolDataLibraryPage() {
  const { supabase, scope } = await currentStaff();
  if (!scope.isAdmin) redirect("/workspace/settings");

  const [manifest, { count: subjects }, { count: levels }, { count: classes }, { count: questions }] = await Promise.all([
    getSchoolDataManifestAction(),
    supabase.from("subjects").select("id", { count: "exact", head: true }).eq("active", true),
    supabase.from("academic_levels").select("id", { count: "exact", head: true }).eq("active", true),
    supabase.from("classes").select("id", { count: "exact", head: true }).eq("status", "active"),
    supabase.from("questions").select("id", { count: "exact", head: true }).eq("status", "active"),
  ]);

  const counts = { subjects: subjects ?? 0, levels: levels ?? 0, classes: classes ?? 0, questions: questions ?? 0 };
  const preparedTotal = manifest.reduce((total, item) => total + item.bundledRecords, 0);
  const publishedTotal = counts.subjects + counts.classes + counts.questions;

  return (
    <div>
      <AdminPageHeader
        eyebrow="Administrator"
        title="School study content"
        description="Publish approved study content, clear old records with exact counts first, or see what is stored where."
        actions={
          <Button variant="outline" nativeButton={false} render={<Link href="/workspace/settings" />}>
            Back to settings
          </Button>
        }
      />

      <div className="mb-6 grid border-y border-border bg-muted/20 sm:grid-cols-4">
        <div className="border-b border-border px-4 py-4 sm:border-r sm:border-b-0">
          <p className="text-[10px] font-bold uppercase tracking-[.14em] text-muted-foreground">Content sections</p>
          <p className="mt-1 text-sm font-semibold text-foreground">{manifest.length} sections</p>
        </div>
        <div className="border-b border-border px-4 py-4 sm:border-r sm:border-b-0">
          <p className="text-[10px] font-bold uppercase tracking-[.14em] text-muted-foreground">Prepared content</p>
          <p className="mt-1 text-sm font-semibold tabular-nums text-foreground">{preparedTotal} items</p>
        </div>
        <div className="border-b border-border px-4 py-4 sm:border-r sm:border-b-0">
          <p className="text-[10px] font-bold uppercase tracking-[.14em] text-muted-foreground">Published school records</p>
          <p className="mt-1 text-sm font-semibold text-foreground">{publishedTotal} items live</p>
        </div>
        <div className="px-4 py-4">
          <p className="text-[10px] font-bold uppercase tracking-[.14em] text-muted-foreground">Exam questions live</p>
          <p className="mt-1 text-sm font-semibold tabular-nums text-foreground">{counts.questions} questions</p>
        </div>
      </div>

      <Alert className="mb-6">
        <ShieldCheck />
        <AlertTitle>Approved school content only</AlertTitle>
        <AlertDescription>Publish the study content prepared for Festacol schools. Questions written by staff are never replaced, and clean-up always shows its count before anything runs.</AlertDescription>
      </Alert>

      <Tabs defaultValue="content">
        <TabsList>
          <TabsTrigger value="content"><Upload data-icon="inline-start" />Publish</TabsTrigger>
          <TabsTrigger value="cleanup"><TriangleAlert data-icon="inline-start" />Clean-up</TabsTrigger>
          <TabsTrigger value="storage"><Database data-icon="inline-start" />Storage</TabsTrigger>
        </TabsList>
        <TabsContent value="content">
          <Card>
            <CardHeader>
              <CardTitle>Publish study content</CardTitle>
              <CardDescription>
                Check what is already published, then publish each section in order. The page stays in place while work is saving.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <FixtureLibrary manifest={manifest} counts={counts} />
            </CardContent>
          </Card>
        </TabsContent>
        <TabsContent value="cleanup">
          <Card>
            <CardHeader>
              <CardTitle>Careful clean-up</CardTitle>
              <CardDescription>
                Target one session, subject, class or term — or wipe a whole table with a typed confirmation. Clean-up never publishes new study content.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <DataMaintenance />
            </CardContent>
          </Card>
        </TabsContent>
        <TabsContent value="storage">
          <Card>
            <CardHeader>
              <CardTitle>Storage overview</CardTitle>
              <CardDescription>
                What is stored where, live from the school records — plus the safe removal order clean-up follows.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <StorageOverview />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
