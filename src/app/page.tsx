import { redirect } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  isExamDestination,
  safeStudentDestination,
} from "@/lib/auth/student-navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { StudentLoginForm } from "./login-form";

export default async function RootPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const next = safeStudentDestination((await searchParams).next);
  const continuingToExam = isExamDestination(next);
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase.auth.getUser();
  if (data.user) {
    const { data: member } = await supabase
      .from("school_members")
      .select("role,status")
      .eq("auth_user_id", data.user.id)
      .eq("status", "active")
      .maybeSingle();
    if (member?.role === "student") redirect(next ?? "/dashboard");
    // Staff sessions have no student permission: never show the student
    // login form to them. Preserve the student destination they just tried to
    // open so the denial explains where to go after switching accounts.
    if (member?.role === "administrator" || member?.role === "teacher") {
      if (next) {
        redirect(
          `/denied?from=${encodeURIComponent(next)}&reason=staff-on-student`,
        );
      }
      redirect("/workspace");
    }
  }

  return (
    <main className="min-h-dvh bg-background p-4 sm:p-7">
      <div className="mx-auto grid min-h-[calc(100dvh-2rem)] max-w-6xl overflow-hidden rounded-[2rem] border border-border bg-card shadow-xl sm:min-h-[calc(100dvh-3.5rem)] lg:grid-cols-[0.85fr_1.15fr]">
        <section className="flex flex-col justify-between bg-primary p-7 text-primary-foreground sm:p-10">
          <div className="flex items-center gap-3">
            <span className="grid size-11 place-items-center rounded-xl bg-primary-foreground text-sm font-black text-primary">
              F
            </span>
            <div>
              <strong className="block font-display text-sm font-extrabold">
                Festacol
              </strong>
              <span className="text-xs text-primary-foreground/60">
                Student portal
              </span>
            </div>
          </div>

          <div className="py-12">
            <p className="text-xs font-extrabold uppercase tracking-[0.18em] text-primary-foreground/45">
              Student access
            </p>
            <h1 className="mt-4 max-w-xl font-display text-4xl font-extrabold leading-tight sm:text-5xl">
              {continuingToExam ? "Secure exam access" : "Private student workspace"}
            </h1>
            <p className="mt-5 max-w-sm text-base leading-7 text-primary-foreground/65">
              {continuingToExam
                ? "Use the same student credentials as your dashboard. After sign in, you will return directly to the examination you opened."
                : "Sign in with your first and last name to open your dashboard, analytics and secure exams."}
            </p>
          </div>

          <span className="text-xs text-primary-foreground/45">
            Secure exam delivery · integrity monitoring · placement guidance
          </span>
        </section>

        <section className="flex items-center p-7 sm:p-11">
          <Card className="mx-auto w-full max-w-xl border-0 bg-transparent py-0 shadow-none">
            <CardHeader className="px-0">
              <Badge className="mb-2">Student authentication</Badge>
              <CardTitle className="font-display text-3xl font-extrabold">
                {continuingToExam ? "Continue to examination" : "Student sign in"}
              </CardTitle>
              <CardDescription className="mt-2 text-base leading-7">
                Use your first and last name as your credentials. New students get an account automatically and continue to the same destination after setup.
              </CardDescription>
            </CardHeader>
            <CardContent className="px-0 pt-3">
              <StudentLoginForm next={next} />
            </CardContent>
          </Card>
        </section>
      </div>
    </main>
  );
}
