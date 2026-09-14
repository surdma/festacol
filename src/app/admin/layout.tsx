import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import type { CSSProperties } from "react";
import { Suspense } from "react";
import { AdminDialogs } from "@/components/admin/admin-dialogs";
import { AdminSidebarBrand, AdminSidebarFooter, AdminTopbar } from "@/components/admin/admin-chrome";
import { AdminNav } from "@/components/admin/admin-nav";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarInset,
  SidebarProvider,
  SidebarRail,
} from "@/components/ui/sidebar";
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

  const cookieStore = await cookies();
  const defaultOpen = cookieStore.get("sidebar_state")?.value !== "false";
  const displayName =
    (user.user_metadata?.full_name as string | undefined)?.trim() ||
    (user.user_metadata?.name as string | undefined)?.trim() ||
    user.email?.split("@")[0] ||
    (role === "administrator" ? "Administrator" : "Teacher");
  const email = user.email ?? "";

  return (
    <SidebarProvider
      defaultOpen={defaultOpen}
      style={
        {
          "--sidebar-width": "18rem",
          "--sidebar-width-icon": "4.75rem",
          "--sidebar": "oklch(0.155 0 0)",
          "--sidebar-foreground": "oklch(0.985 0 0)",
          "--sidebar-primary": "oklch(0.985 0 0)",
          "--sidebar-primary-foreground": "oklch(0.155 0 0)",
          "--sidebar-accent": "oklch(1 0 0 / 0.075)",
          "--sidebar-accent-foreground": "oklch(0.985 0 0)",
          "--sidebar-border": "oklch(1 0 0 / 0.09)",
          "--sidebar-ring": "oklch(0.74 0 0)",
        } as CSSProperties
      }
      className="bg-muted/55"
    >
      <Sidebar
        variant="inset"
        collapsible="icon"
        className="border-0 [&_[data-slot=sidebar-inner]]:overflow-hidden [&_[data-slot=sidebar-inner]]:rounded-[26px] [&_[data-slot=sidebar-inner]]:bg-sidebar [&_[data-slot=sidebar-inner]]:shadow-[0_20px_70px_rgba(0,0,0,0.24)] [&_[data-slot=sidebar-inner]]:ring-1 [&_[data-slot=sidebar-inner]]:ring-sidebar-border"
      >
        <SidebarHeader className="bg-sidebar p-3 pb-1.5 pt-[calc(0.75rem+env(safe-area-inset-top))] text-sidebar-foreground md:pt-3">
          <AdminSidebarBrand />
        </SidebarHeader>
        <SidebarContent className="bg-sidebar px-1 pb-2 text-sidebar-foreground overscroll-contain">
          <AdminNav />
        </SidebarContent>
        <SidebarFooter className="bg-sidebar p-3 pt-1.5 pb-[calc(0.75rem+env(safe-area-inset-bottom))] text-sidebar-foreground group-data-[collapsible=icon]:p-2 md:pb-3">
          <AdminSidebarFooter displayName={displayName} email={email} role={role} />
        </SidebarFooter>
        <SidebarRail className="after:bg-transparent hover:after:bg-sidebar-border" />
      </Sidebar>

      <SidebarInset className="min-w-0 overflow-hidden bg-[#f7f8fa] md:rounded-[28px] md:shadow-[0_12px_40px_rgba(15,23,42,0.06)] md:ring-1 md:ring-black/[0.045]">
        <AdminTopbar displayName={displayName} role={role} />
        <main className="w-full flex-1 p-4 sm:p-6 lg:p-8">
          <div className="mx-auto w-full max-w-[1600px]">{children}</div>
        </main>
        <Suspense>
          <AdminDialogs />
        </Suspense>
      </SidebarInset>
    </SidebarProvider>
  );
}
