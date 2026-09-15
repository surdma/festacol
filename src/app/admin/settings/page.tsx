import { currentStaff } from "@/lib/auth/staff";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { FadeUp } from "@/components/motion";
import { SubjectsManager } from "./subjects-manager";

export default async function AdminSettingsPage() {
  const { supabase, scope } = await currentStaff();
  if (!scope.isAdmin) {
    return (
      <FadeUp className="flex flex-col gap-4">
        <div><h1 className="text-2xl font-semibold">Settings</h1><p className="text-muted-foreground">Workspace settings are managed by administrators.</p></div>
      </FadeUp>
    );
  }
  const { data } = await supabase.from("subjects").select("*").order("name");
  return (
    <FadeUp className="flex flex-col gap-4">
      <div><h1 className="text-2xl font-semibold">Settings</h1><p className="text-muted-foreground">Workspace catalogs — subjects feed exams, questions and teacher majors.</p></div>
      <Card><CardHeader><CardTitle>Workspace</CardTitle><CardDescription>Admin accounts use Supabase Auth (email + password, role=administrator).</CardDescription></CardHeader></Card>
      <SubjectsManager initial={(data ?? []) as { code: string; name: string; category: string; streams: string[]; active: boolean }[]} />
    </FadeUp>
  );
}
