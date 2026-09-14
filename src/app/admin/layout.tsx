import { redirect } from "next/navigation";
import { Suspense } from "react";
import { AdminDialogs } from "@/components/admin/admin-dialogs";
import { AdminSidebarBrand, AdminSidebarFooter, AdminTopbar } from "@/components/admin/admin-chrome";
import { AdminNav } from "@/components/admin/admin-nav";
import { getAdminTopbarNotifications } from "@/lib/admin-notifications";
import { currentStaff } from "@/lib/auth/staff";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const { supabase, scope } = await currentStaff();
  const { data } = await supabase.auth.getUser();
  const user = data.user;
  const role = scope.role;

  if (!user) return <main className="min-h-dvh bg-neutral-50">{children}</main>;
  if (role !== "administrator" && role !== "teacher") redirect("/admin/login");

  const displayName =
    (user.user_metadata?.full_name as string | undefined)?.trim() ||
    (user.user_metadata?.name as string | undefined)?.trim() ||
    user.email?.split("@")[0] ||
    (role === "administrator" ? "Administrator" : "Teacher");
  const email = user.email ?? "";
  const notifications = await getAdminTopbarNotifications(supabase, scope);

  return (
    <div className="min-h-screen bg-neutral-50 text-neutral-950">
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 border-r border-neutral-800 bg-neutral-950 text-white lg:flex lg:flex-col">
        <div className="border-b border-neutral-800 px-5 py-5"><AdminSidebarBrand /></div>
        <div className="px-4 pb-2 pt-4"><p className="text-[10px] font-bold uppercase tracking-[.16em] text-neutral-500">Workspace</p></div>
        <AdminNav />
        <AdminSidebarFooter displayName={displayName} email={email} role={role} />
      </aside>

      <div className="min-h-screen lg:pl-64">
        <AdminTopbar notifications={notifications} />
        <main className="mx-auto w-full max-w-[1600px] px-4 py-5 sm:px-6 lg:px-8">{children}</main>
      </div>

      <Suspense>
        <AdminDialogs />
      </Suspense>
    </div>
  );
}
