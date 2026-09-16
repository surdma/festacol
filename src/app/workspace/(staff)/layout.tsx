import { redirect } from "next/navigation";
import { Suspense } from "react";
import { AccessDenied } from "@/components/access-denied";
import {
  AdminSidebarBrand,
  AdminTopbar,
} from "@/components/admin/admin-chrome";
import { AdminDialogs } from "@/components/admin/admin-dialogs";
import { AdminNav } from "@/components/admin/admin-nav";
import { Toaster } from "@/components/ui/toast";
import { getAdminTopbarNotifications } from "@/lib/admin-notifications";
import { currentStaff } from "@/lib/auth/staff";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { supabase, scope, user } = await currentStaff();
  const role = scope.role;

  // Never render admin content without a staff session. Students get an
  // explicit permission-denied (proxy redirects them to /denied first; this
  // is defense in depth that hides the dashboard completely).
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

  return (
    <Toaster timeout={6000}>
      <div className="min-h-screen bg-neutral-50 text-neutral-950">
        <a
          href="#admin-root"
          className="fixed left-4 top-4 z-[200] -translate-y-24 rounded-xl bg-neutral-950 px-4 py-2.5 text-sm font-semibold text-white transition focus:translate-y-0 focus:outline-none focus:ring-4 focus:ring-neutral-300 motion-reduce:transition-none"
        >
          Skip to application
        </a>
        <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 overflow-hidden border-r border-neutral-800 bg-neutral-950 text-white lg:flex lg:flex-col">
          <div className="border-b border-neutral-800 px-5 py-5">
            <AdminSidebarBrand />
          </div>
          <div className="px-4 pb-2 pt-4">
            <p className="text-[10px] font-bold uppercase tracking-[.16em] text-neutral-500">
              Workspace
            </p>
          </div>
          <AdminNav role={role} />
        </aside>

        <div className="lg:pl-64">
          <AdminTopbar notifications={notifications} role={role} profileEmail={user.email} />
          <div id="admin-alert" className="hidden" />
          <main
            id="admin-root"
            tabIndex={-1}
            className="mx-auto max-w-[1600px] px-4 py-5 outline-none sm:px-6 lg:px-8"
          >
            {children}
          </main>
        </div>

        <Suspense>
          <AdminDialogs />
        </Suspense>
      </div>
    </Toaster>
  );
}
