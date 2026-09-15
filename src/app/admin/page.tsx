import { getAdminCounts } from "@/lib/supabase/queries";
import { currentStaff } from "@/lib/auth/staff";
import { MetricCard } from "@/components/metric-card";
import { FadeUp, Stagger } from "@/components/motion";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { LayoutDashboard, Users, BookOpen, BarChart3 } from "lucide-react";
import { AdminLiveBadge } from "./live-badge";
import { MajorPicker } from "@/components/admin/major-picker";

export default async function AdminOverviewPage() {
  const { supabase, scope } = await currentStaff();
  const { sessions, attempts, users, classes } = await getAdminCounts(supabase);
  return (
    <div className="flex flex-col gap-6">
      <FadeUp>
        <div className="flex items-center gap-3">
          <div>
            <h1 className="text-2xl font-semibold">Overview</h1>
            <p className="text-muted-foreground">Live operations across exams, students and integrity.</p>
          </div>
          <AdminLiveBadge />
        </div>
      </FadeUp>
      {scope.isTeacher && scope.subjects.length === 0 ? <MajorPicker /> : null}
      <Stagger className="grid grid-cols-2 gap-4 xl:grid-cols-4">
        <MetricCard label="Exam sessions" value={String(sessions)} icon={BookOpen} />
        <MetricCard label="Attempts" value={String(attempts)} icon={BarChart3} />
        <MetricCard label="Directory users" value={String(users)} icon={Users} />
        <MetricCard label="Classes" value={String(classes)} icon={LayoutDashboard} />
      </Stagger>
      <Card>
        <CardHeader>
          <CardTitle>Next steps</CardTitle>
          <CardDescription>Each sidebar entry is its own route — no tab state.</CardDescription>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          Create an exam in Examinations, manage roster in Students/Staff, sync the Question Bank, then review integrity in Reports.
        </CardContent>
      </Card>
    </div>
  );
}
