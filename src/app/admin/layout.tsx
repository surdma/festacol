import Link from "next/link";
import { Suspense } from "react";
import { Sidebar, SidebarContent, SidebarFooter, SidebarGroup, SidebarGroupLabel, SidebarHeader, SidebarMenu, SidebarMenuButton, SidebarMenuItem, SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { adminNav } from "@/lib/nav";
import { AdminDialogs } from "@/components/admin/admin-dialogs";
import { createSupabaseServerClient } from "@/lib/supabase/server";

// The sidebar only renders for signed-in staff. Visitors (e.g. /admin/login)
// get a bare page — no nav leaks before authentication. The proxy already
// redirects unauthenticated /admin/* traffic; this covers the login route.
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase.auth.getUser();
  const role =
    (data.user?.app_metadata?.role as string | undefined) ??
    (data.user?.user_metadata?.role as string | undefined);
  const signedIn = role === "administrator" || role === "teacher";

  if (!signedIn) {
    return <main className="flex min-h-svh flex-1 flex-col">{children}</main>;
  }

  return (
    <SidebarProvider>
      <Sidebar>
        <SidebarHeader>
          <Link href="/admin" className="flex items-center gap-2 px-2 py-1">
            <span className="flex size-8 items-center justify-center rounded-lg bg-primary font-bold text-primary-foreground">F</span>
            <span className="flex flex-col">
              <span className="text-sm font-semibold">Festacol</span>
              <span className="text-xs text-muted-foreground">{role === "administrator" ? "Admin workspace" : "Staff workspace"}</span>
            </span>
          </Link>
        </SidebarHeader>
        <SidebarContent>
          <SidebarGroup>
            <SidebarGroupLabel>Manage</SidebarGroupLabel>
            <SidebarMenu>
              {adminNav.map((item) => (
                <SidebarMenuItem key={item.href}>
                  <SidebarMenuButton render={<Link href={item.href} />}>
                    <item.icon />
                    <span>{item.label}</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroup>
        </SidebarContent>
        <SidebarFooter>
          <p className="px-2 text-xs text-muted-foreground">Supabase + Prisma</p>
        </SidebarFooter>
      </Sidebar>
      <main className="flex min-h-svh flex-1 flex-col">
        <header className="sticky top-0 z-10 flex items-center gap-2 border-b bg-background px-4 py-2">
          <SidebarTrigger />
          <p className="text-sm text-muted-foreground">Admin</p>
        </header>
        <div className="mx-auto w-full max-w-[1600px] flex-1 p-4 sm:p-6">{children}</div>
        <Suspense>
          <AdminDialogs />
        </Suspense>
      </main>
    </SidebarProvider>
  );
}
