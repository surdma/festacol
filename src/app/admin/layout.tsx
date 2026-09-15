import { Suspense } from "react";
import { AdminSidebarBrand, AdminSidebarFooter, AdminTopbar } from "@/components/admin/admin-chrome";
import { AdminDialogs } from "@/components/admin/admin-dialogs";
import { AdminNav } from "@/components/admin/admin-nav";
import { getAdminTopbarNotifications } from "@/lib/admin-notifications";
import { currentStaff } from "@/lib/auth/staff";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const { supabase, scope, user } = await currentStaff();
  const role = scope.role;

  // Logged-out and non-staff sessions only ever reach this layout on
  // /admin/login: proxy.ts redirects them away from every other /admin
  // route first. Render bare — redirecting here would 307 to self forever.
  if (!user || (role !== "administrator" && role !== "teacher")) {
    return <main className="min-h-dvh bg-neutral-50">{children}</main>;
  }

  const notifications = await getAdminTopbarNotifications(supabase, scope);

  return (
    <div className="min-h-screen bg-neutral-50 text-neutral-950">
      <a href="#admin-root" className="fixed left-4 top-4 z-[200] -translate-y-24 rounded-xl bg-neutral-950 px-4 py-2.5 text-sm font-semibold text-white transition focus:translate-y-0 focus:outline-none focus:ring-4 focus:ring-neutral-300 motion-reduce:transition-none">Skip to application</a>
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 border-r border-neutral-800 bg-neutral-950 text-white lg:flex lg:flex-col">
        <div className="border-b border-neutral-800 px-5 py-5"><AdminSidebarBrand /></div>
        <div className="px-4 pb-2 pt-4"><p className="text-[10px] font-bold uppercase tracking-[.16em] text-neutral-500">Workspace</p></div>
        <AdminNav />
        <AdminSidebarFooter />
      </aside>

      <div className="lg:pl-64">
        <AdminTopbar notifications={notifications} />
        <div id="admin-alert" className="hidden" />
        <main id="admin-root" tabIndex={-1} className="mx-auto max-w-[1600px] px-4 py-5 outline-none sm:px-6 lg:px-8">{children}</main>
      </div>

      <Suspense><AdminDialogs /></Suspense>
    </div>
  );
}
