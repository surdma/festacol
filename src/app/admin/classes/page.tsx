import Link from "next/link";
import { ExternalLink, MessageCircle, Plus, School, Users } from "lucide-react";
import { AdminPageHeader } from "@/components/admin/admin-ui";
import { StatusBadge } from "@/components/status-badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { currentStaff } from "@/lib/auth/staff";
import { listClasses } from "@/lib/supabase/queries";

interface GroupRow { id: string; class_id: string; name: string; invite_url: string }
interface StudentClassRow { class_id: string | null; status: string }

export default async function AdminClassesPage() {
  const { supabase, scope } = await currentStaff();
  const [classes, groupsResult, studentsResult] = await Promise.all([
    listClasses(supabase),
    supabase.from("whatsapp_groups").select("id,class_id,name,invite_url").limit(300),
    supabase.from("users").select("class_id,status").eq("role", "student").limit(1000),
  ]);
  const groups = (groupsResult.data ?? []) as GroupRow[];
  const students = (studentsResult.data ?? []) as StudentClassRow[];
  const occupancy = new Map<string, number>();
  for (const student of students.filter((item) => item.status === "active" && item.class_id)) occupancy.set(student.class_id!, (occupancy.get(student.class_id!) ?? 0) + 1);
  const groupByClass = new Map(groups.map((group) => [group.class_id, group]));
  const active = classes.filter((item) => item.status === "active");
  const withoutCommunication = active.filter((item) => !groupByClass.has(item.id)).length;

  return (
    <div className="flex flex-col gap-5">
      <AdminPageHeader
        eyebrow="Academic structure"
        title="Classes"
        description="Monitor class capacity and communication coverage. Class and WhatsApp mutations remain administrator-only while teachers retain read access."
        actions={scope.isAdmin ? <Button render={<Link href="/admin/classes?modal=class-new" />}><Plus data-icon="inline-start" />Add class</Button> : null}
      />

      <div className="grid gap-3 sm:grid-cols-3">
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">Active classes</CardTitle></CardHeader><CardContent><p className="text-2xl font-semibold tabular-nums">{active.length}</p></CardContent></Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">Active students</CardTitle></CardHeader><CardContent><p className="text-2xl font-semibold tabular-nums">{students.filter((item) => item.status === "active").length}</p></CardContent></Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">Communication gaps</CardTitle></CardHeader><CardContent><p className="text-2xl font-semibold tabular-nums">{withoutCommunication}</p></CardContent></Card>
      </div>

      {classes.length ? (
        <div className="grid gap-4 md:grid-cols-2 2xl:grid-cols-3">
          {classes.map((item) => {
            const count = occupancy.get(item.id) ?? 0;
            const capacity = Math.max(1, Number(item.capacity));
            const percent = Math.min(100, Math.round((count / capacity) * 100));
            const group = groupByClass.get(item.id);
            return (
              <Card key={item.id} className="overflow-hidden">
                <CardHeader className="border-b">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0"><p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">{item.class_level} · {item.stream}</p><CardTitle className="mt-1 truncate text-lg">{item.name}</CardTitle></div>
                    <StatusBadge tone={item.status === "active" ? "emerald" : "neutral"}>{item.status}</StatusBadge>
                  </div>
                </CardHeader>
                <CardContent className="flex flex-col gap-4 p-5">
                  <div>
                    <div className="mb-2 flex items-center justify-between text-xs"><span className="flex items-center gap-2 text-muted-foreground"><Users className="size-4" />Capacity</span><strong className="tabular-nums">{count}/{capacity}</strong></div>
                    <Progress value={percent} />
                    <p className="mt-2 text-xs text-muted-foreground">{percent}% occupied{item.room ? ` · ${item.room}` : ""}</p>
                  </div>
                  <div className="rounded-lg border bg-muted/30 p-3">
                    <div className="flex items-start gap-3">
                      <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-background"><MessageCircle className="size-4" /></span>
                      <div className="min-w-0 flex-1">{group ? <><strong className="block truncate text-sm">{group.name}</strong><a href={group.invite_url} target="_blank" rel="noreferrer" className="mt-1 inline-flex items-center gap-1 text-xs font-medium underline-offset-4 hover:underline">Open WhatsApp <ExternalLink className="size-3.5" /></a></> : <><strong className="block text-sm">No WhatsApp group</strong><p className="mt-1 text-xs text-muted-foreground">Communication setup is incomplete.</p></>}</div>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button size="sm" variant="outline" render={<Link href={`/admin/classes?modal=class&class=${encodeURIComponent(item.id)}`} />}><School data-icon="inline-start" />View class</Button>
                    {scope.isAdmin && !group ? <Button size="sm" render={<Link href={`/admin/classes?modal=whatsapp-new&class=${encodeURIComponent(item.id)}`} />}>Add WhatsApp</Button> : null}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      ) : (
        <Card><CardContent className="p-8 text-center"><School className="mx-auto size-8 text-muted-foreground" /><h2 className="mt-3 font-medium">No classes configured</h2><p className="mt-1 text-sm text-muted-foreground">Create the academic structure before assigning students.</p></CardContent></Card>
      )}
    </div>
  );
}
