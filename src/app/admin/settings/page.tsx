import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { FadeUp } from "@/components/motion";

export default function AdminSettingsPage() {
  return (
    <FadeUp className="flex flex-col gap-4">
      <div><h1 className="text-2xl font-semibold">Settings</h1><p className="text-muted-foreground">Route: /admin/settings</p></div>
      <Card><CardHeader><CardTitle>Workspace</CardTitle><CardDescription>Admin accounts use Supabase Auth (email + password, role=administrator).</CardDescription></CardHeader>
      <CardContent className="text-sm text-muted-foreground">Data reset actions run as Server Actions with a service-role guard (phase 2).</CardContent></Card>
    </FadeUp>
  );
}
