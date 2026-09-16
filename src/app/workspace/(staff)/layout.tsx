import { redirect } from "next/navigation";
import { Suspense } from "react";
import { AccessDenied } from "@/components/access-denied";
import { AdminDialogs } from "@/components/admin/admin-dialogs";
import { ApplicationShell } from "@/components/shell/application-shell";
import { getAdminTopbarNotifications } from "@/lib/admin-notifications";
import { currentStaff } from "@/lib/auth/staff";
import { AdminLiveBadge } from "./live-badge";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { supabase, scope, user } = await currentStaff();
  const role = scope.role;

  if (!user) redirect("/workspace/login");
  if (role !== "administrator" && role !== "teacher") {
    return (
      <main className="grid min-h-dvh place-items-center bg-neutral-50 p-4">
        <AccessDenied
          title="Student accounts cannot open administration"
          message="You are signed in with a student account, which has no staff permission. Sign out first, then sign in with a staff account."
          signInHref="/workspace/login"
          signInLabel="Go to staff sign in"
          returnHref="/dashboard"
        />
      </main>
    );
  }

  const notifications = await getAdminTopbarNotifications(supabase, scope);
  const profileName = role === "administrator" ? "Administrator" : "Teacher";

  return (
    <ApplicationShell
      surface="staff"
      role={role}
      profileName={profileName}
      profileDetail={user.email}
      notifications={notifications}
      sidebarStatus={<AdminLiveBadge />}
      overlays={
        <Suspense>
          <AdminDialogs />
        </Suspense>
      }
    >
      <div id="admin-alert" className="hidden" />
      {children}
    </ApplicationShell>
  );
}
