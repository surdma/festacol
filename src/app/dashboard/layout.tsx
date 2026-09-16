import { AccessDenied } from "@/components/access-denied";
import { ApplicationShell } from "@/components/shell/application-shell";
import { currentStudent } from "@/lib/auth/current-student";
import { getStudentTopbarNotifications } from "@/lib/student-notifications";
import { createSupabaseServerClient } from "@/lib/supabase/server";

function MinimalShell({ children }: { children: React.ReactNode }) {
  return (
    <main className="grid min-h-dvh place-items-center bg-background p-4">
      <div className="w-full max-w-md">{children}</div>
    </main>
  );
}

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const context = await currentStudent();
  if (!context) {
    const supabase = await createSupabaseServerClient();
    const { data } = await supabase.auth.getUser();
    const authUser = data.user;
    if (authUser) {
      const { data: member } = await supabase
        .from("school_members")
        .select("role")
        .eq("auth_user_id", authUser.id)
        .eq("status", "active")
        .maybeSingle();
      const role = (member as { role?: string } | null)?.role;
      if (role === "teacher" || role === "administrator") {
        return (
          <MinimalShell>
            <AccessDenied
              title="Staff accounts cannot open the student portal"
              message="You are signed in with a staff account, which has no student permission. Sign out first, then sign in with a student account."
              signInHref="/"
              signInLabel="Go to student sign in"
              returnHref="/workspace"
            />
          </MinimalShell>
        );
      }
    }

    // The proxy redirects anonymous dashboard routes before this layout. The
    // minimal fallback is retained only for the legacy /dashboard/exam
    // compatibility route, whose page immediately redirects to /exam.
    return <MinimalShell>{children}</MinimalShell>;
  }

  const notifications = await getStudentTopbarNotifications(
    context.supabase,
    context.profile.profile_id,
    Boolean(context.enrollment),
  );

  return (
    <ApplicationShell
      surface="student"
      role="student"
      profileName={context.profile.full_name}
      profileDetail={context.profile.student_number ?? "Student account"}
      notifications={notifications}
    >
      {children}
    </ApplicationShell>
  );
}
