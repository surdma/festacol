import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { StudentLoginForm } from "./login-form";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default async function RootPage() {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase.auth.getUser();
  if (data.user?.user_metadata?.student_hash ?? data.user?.app_metadata?.student_hash) redirect("/dashboard");
  if ((data.user?.app_metadata?.role ?? data.user?.user_metadata?.role) === "administrator") redirect("/admin");

  return (
    <main className="min-h-dvh bg-muted p-4 sm:p-7">
      <div className="mx-auto grid min-h-[calc(100dvh-2rem)] max-w-6xl overflow-hidden rounded-[2rem] border border-border bg-card shadow-xl sm:min-h-[calc(100dvh-3.5rem)] lg:grid-cols-[0.85fr_1.15fr]">
        <section className="flex flex-col justify-between bg-primary p-7 text-primary-foreground sm:p-10">
          <div className="flex items-center gap-3">
            <span className="grid size-11 place-items-center rounded-xl bg-primary-foreground text-sm font-black text-primary">F</span>
            <div>
              <strong className="block font-display text-sm font-extrabold">Festacol</strong>
              <span className="text-xs text-primary-foreground/60">Student portal</span>
            </div>
          </div>

          <div className="py-12">
            <p className="text-xs font-extrabold uppercase tracking-[0.18em] text-primary-foreground/45">Private student workspace</p>
            <h1 className="mt-4 max-w-xl font-display text-4xl font-extrabold leading-tight sm:text-5xl">Your exams, results and progress stay behind sign in.</h1>
            <p className="mt-5 max-w-sm text-base leading-7 text-primary-foreground/65">Candidates must authenticate before the academic dashboard becomes available.</p>
          </div>

          <span className="text-xs text-primary-foreground/45">Secure exam delivery · integrity monitoring · placement guidance</span>
        </section>

        <section className="flex items-center p-7 sm:p-11">
          <Card className="mx-auto w-full max-w-xl border-0 bg-transparent py-0 shadow-none">
            <CardHeader className="px-0">
              <Badge className="mb-2">Student authentication</Badge>
              <CardTitle className="font-display text-3xl font-extrabold">Sign in with your candidate credentials.</CardTitle>
              <CardDescription className="mt-2 text-base leading-7">Use the first name and last name given by your school to open your academic workspace.</CardDescription>
            </CardHeader>
            <CardContent className="px-0 pt-3">
              <StudentLoginForm />
            </CardContent>
          </Card>
        </section>
      </div>
    </main>
  );
}
