import Link from "next/link";
import { Suspense } from "react";
import { redirect } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarInset,
  SidebarProvider,
  SidebarRail,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import { AdminDialogs } from "@/components/admin/admin-dialogs";
import { AdminBreadcrumbLabel, AdminNav } from "@/components/admin/admin-nav";
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

  return (
    <SidebarProvider>
      <Sidebar collapsible="icon" className="border-neutral-800">
        <SidebarHeader className="border-b border-neutral-800 bg-neutral-950 p-3 text-white">
          <Link href="/admin" className="flex min-h-12 items-center gap-3 rounded-xl px-1 outline-none ring-neutral-600 focus-visible:ring-2">
            <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-white text-sm font-black text-neutral-950">F</span>
            <span className="min-w-0 group-data-[collapsible=icon]:hidden">
              <strong className="block truncate text-sm">Festacol</strong>
              <span className="block truncate text-[11px] text-neutral-400">Academic operations</span>
            </span>
          </Link>
        </SidebarHeader>
        <SidebarContent className="bg-neutral-950 text-white">
          <SidebarGroup>
            <SidebarGroupLabel className="text-neutral-500">Workspace</SidebarGroupLabel>
            <SidebarGroupContent><AdminNav /></SidebarGroupContent>
          </SidebarGroup>
        </SidebarContent>
        <SidebarFooter className="border-t border-neutral-800 bg-neutral-950 text-white">
          <div className="flex items-center gap-2 rounded-lg px-2 py-2 group-data-[collapsible=icon]:justify-center">
            <span className="size-2 shrink-0 rounded-full bg-emerald-400" aria-hidden="true" />
            <div className="min-w-0 group-data-[collapsible=icon]:hidden">
              <p className="truncate text-xs font-medium">Production workspace</p>
              <p className="truncate text-[11px] text-neutral-500">Supabase + Prisma</p>
            </div>
          </div>
        </SidebarFooter>
        <SidebarRail />
      </Sidebar>

      <SidebarInset className="min-w-0 bg-neutral-50/70">
        <header className="sticky top-0 z-30 flex h-14 items-center gap-3 border-b bg-background/95 px-4 backdrop-blur supports-[backdrop-filter]:bg-background/85 sm:px-6">
          <SidebarTrigger />
          <div className="h-5 w-px bg-border" aria-hidden="true" />
          <div className="min-w-0 flex-1 truncate text-sm text-muted-foreground">
            <span>Administration</span>
            <span className="px-2" aria-hidden="true">/</span>
            <AdminBreadcrumbLabel />
          </div>
          <Badge variant="outline" className="capitalize">{role}</Badge>
        </header>
        <main className="w-full flex-1 p-4 sm:p-6 lg:p-8">
          <div className="mx-auto w-full max-w-[1600px]">{children}</div>
        </main>
        <Suspense><AdminDialogs /></Suspense>
      </SidebarInset>
    </SidebarProvider>
  );
}
