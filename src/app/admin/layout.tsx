import type { CSSProperties } from "react";
import { Suspense } from "react";
import { redirect } from "next/navigation";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarInset,
  SidebarProvider,
  SidebarRail,
} from "@/components/ui/sidebar";
import { AdminDialogs } from "@/components/admin/admin-dialogs";
import { AdminNav } from "@/components/admin/admin-nav";
import { AdminSidebarBrand, AdminSidebarFooter, AdminTopbar } from "@/components/admin/admin-chrome";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase.auth.getUser();
  const user = data.user;
  const role =
    (user?.app_metadata?.role as string | undefined) ??
    (user?.user_metadata?.role as string | undefined) ??
    "";

  if (!user) return <main className="min-h-dvh bg-background">{children}</main>;
  if (role !== "administrator" && role !== "teacher") redirect("/admin/login");

  const displayName =
    (user.user_metadata?.full_name as string | undefined)?.trim() ||
    (user.user_metadata?.name as string | undefined)?.trim() ||
    user.email?.split("@")[0] ||
    (role === "administrator" ? "Administrator" : "Teacher");
  const email = user.email ?? "";

  return (
    <SidebarProvider
      style={
        {
          "--sidebar-width": "17.5rem",
          "--sidebar-width-icon": "4.5rem",
        } as CSSProperties
      }
      className="bg-neutral-950 md:bg-[#f3f4f6]"
    >
      <Sidebar
        variant="inset"
        collapsible="icon"
        className="border-0 [&_[data-slot=sidebar-inner]]:overflow-hidden [&_[data-slot=sidebar-inner]]:rounded-[24px] [&_[data-slot=sidebar-inner]]:bg-neutral-950 [&_[data-slot=sidebar-inner]]:shadow-[0_18px_60px_rgba(0,0,0,0.22)] [&_[data-slot=sidebar-inner]]:ring-1 [&_[data-slot=sidebar-inner]]:ring-white/[0.07]"
      >
        <SidebarHeader className="bg-neutral-950 p-3 pb-2 text-white">
          <AdminSidebarBrand />
        </SidebarHeader>
        <SidebarContent className="bg-neutral-950 px-1 pb-3 text-white">
          <AdminNav />
        </SidebarContent>
        <SidebarFooter className="bg-neutral-950 p-3 pt-2 text-white">
          <AdminSidebarFooter displayName={displayName} email={email} role={role} />
        </SidebarFooter>
        <SidebarRail />
      </Sidebar>

      <SidebarInset className="min-w-0 overflow-hidden bg-[#f7f8fa] md:rounded-[28px] md:shadow-[0_12px_40px_rgba(15,23,42,0.06)] md:ring-1 md:ring-black/[0.045]">
        <AdminTopbar displayName={displayName} role={role} />
        <main className="w-full flex-1 p-4 sm:p-6 lg:p-8">
          <div className="mx-auto w-full max-w-[1600px]">{children}</div>
        </main>
        <Suspense><AdminDialogs /></Suspense>
      </SidebarInset>
    </SidebarProvider>
  );
}
