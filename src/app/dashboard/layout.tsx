import Link from "next/link";
import { AccessDenied } from "@/components/access-denied";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import { StudentProvider } from "@/hooks/use-student";
import { currentStudent } from "@/lib/auth/current-student";
import { studentNav } from "@/lib/nav";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { SignOutButton } from "./sign-out-button";

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
    // Defense in depth behind proxy: never render sidebar, nav, or dashboard
    // chrome without a student session. Staff sessions get an explicit
    // permission-denied (no silent reuse of their session); anonymous users
    // get a minimal shell so only the public placement entry form can render.
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
          <StudentProvider initial={null}>
            <MinimalShell>
              <AccessDenied
                title="Staff accounts cannot open the student portal"
                message="You are signed in with a staff account, which has no student permission. Sign out first, then sign in with a student account."
                signInHref="/"
                signInLabel="Go to student sign in"
                returnHref="/workspace"
              />
            </MinimalShell>
          </StudentProvider>
        );
      }
    }
    return (
      <StudentProvider initial={null}>
        <MinimalShell>{children}</MinimalShell>
      </StudentProvider>
    );
  }
  const student = {
    profileId: context.profile.profile_id,
    firstName: context.profile.first_name,
    lastName: context.profile.last_name,
    fullName: context.profile.full_name,
  };
  return (
    <StudentProvider initial={student}>
      <SidebarProvider className="bg-background">
        <Sidebar className="border-r border-border bg-card">
          <SidebarHeader className="p-4">
            <Link
              href="/dashboard"
              className="flex min-h-11 items-center gap-3 rounded-xl px-1 outline-none focus-visible:ring-4 focus-visible:ring-ring/30"
            >
              <span className="flex size-11 items-center justify-center rounded-xl bg-primary text-sm font-black text-primary-foreground shadow-sm">
                F
              </span>
              <span className="flex min-w-0 flex-col">
                <span className="truncate font-display text-base font-extrabold">
                  Festacol
                </span>
                <span className="truncate text-xs text-muted-foreground">
                  Student intelligence portal
                </span>
              </span>
            </Link>
          </SidebarHeader>
          <SidebarContent>
            <SidebarGroup>
              <SidebarGroupLabel className="text-[10px] font-bold uppercase tracking-[0.14em]">
                Learn
              </SidebarGroupLabel>
              <SidebarMenu>
                {studentNav.map((item) => (
                  <SidebarMenuItem key={item.href}>
                    <SidebarMenuButton
                      render={<Link href={item.href} />}
                      className="min-h-11 rounded-xl font-semibold"
                    >
                      <item.icon />
                      <span>{item.label}</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroup>
          </SidebarContent>
          <SidebarFooter className="border-t border-border p-4">
            <p className="truncate text-xs text-muted-foreground">
              {student.fullName}
            </p>
            <SignOutButton />
          </SidebarFooter>
        </Sidebar>
        <main className="flex min-h-dvh flex-1 flex-col bg-background">
          <header className="sticky top-0 z-10 border-b border-border bg-card/95 px-4 py-3 backdrop-blur supports-[backdrop-filter]:bg-card/90">
            <div className="mx-auto flex w-full max-w-7xl items-center gap-3">
              <SidebarTrigger className="size-11 rounded-xl border border-border bg-card shadow-sm" />
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-muted-foreground">
                  Student portal
                </p>
                <p className="font-display text-sm font-extrabold">
                  Academic workspace
                </p>
              </div>
            </div>
          </header>
          <div className="mx-auto w-full max-w-7xl flex-1 p-4 sm:p-6 lg:p-7">
            {children}
          </div>
        </main>
      </SidebarProvider>
    </StudentProvider>
  );
}
