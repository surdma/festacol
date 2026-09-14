import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { StudentLoginForm } from "./login-form";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default async function RootPage() {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase.auth.getUser();
  if (data.user?.user_metadata?.student_hash ?? data.user?.app_metadata?.student_hash) redirect("/dashboard");
  if ((data.user?.app_metadata?.role ?? data.user?.user_metadata?.role) === "administrator") redirect("/admin");

  return (
    <div className="grid min-h-svh lg:grid-cols-[0.85fr_1.15fr]">
      <div className="hidden flex-col justify-between bg-neutral-950 p-10 text-white lg:flex">
        <p className="text-sm font-semibold">Festacol</p>
        <div className="flex flex-col gap-3">
          <h1 className="text-3xl font-semibold">Private student workspace</h1>
          <p className="text-white/70">Sign in with your first and last name to open your dashboard, analytics and secure exams.</p>
        </div>
        <p className="text-xs text-white/50">Secure exam delivery · integrity monitoring · placement guidance</p>
      </div>
      <div className="flex items-center justify-center p-6">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle>Student sign in</CardTitle>
            <CardDescription>Use the firstname and lastname given by your school.</CardDescription>
          </CardHeader>
          <CardContent>
            <StudentLoginForm />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
