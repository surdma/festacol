import { redirect } from "next/navigation";
import { Suspense } from "react";
import { AccessDenied } from "@/components/access-denied";
import { AdminDialogs } from "@/components/admin/admin-dialogs";
import { ApplicationShell } from "@/components/shell/application-shell";
import type { CreatorSessionRealtimeRef } from "@/components/shell/realtime-notification-sync";
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

  const [notifications, creatorSessionResult] = await Promise.all([
    getAdminTopbarNotifications(supabase, scope),
    scope.profileId
      ? supabase
          .from("exam_sessions")
          .select("id,title")
          .eq("created_by_id", scope.profileId)
          .limit(250)
      : Promise.resolve({ data: [] }),
  ]);
  const creatorSessions = (creatorSessionResult.data ?? []) as CreatorSessionRealtimeRef[];
  const profileName = role === "administrator" ? "Administrator" : "Teacher";

  return (
    <ApplicationShell
      surface="staff"
      role={role}
      profileName={profileName}
      profileDetail={user.email}
      notifications={notifications}
      realtimeRecipientId={scope.profileId}
      realtimeCreatorSessions={creatorSessions}
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
