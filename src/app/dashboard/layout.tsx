import Link from "next/link";
import { Sidebar, SidebarContent, SidebarFooter, SidebarGroup, SidebarGroupLabel, SidebarHeader, SidebarMenu, SidebarMenuButton, SidebarMenuItem, SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { StudentProvider } from "@/hooks/use-student";
import { studentNav } from "@/lib/nav";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getStudentProfile } from "@/lib/supabase/queries";

async function currentStudent() {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase.auth.getUser();
  const user = data.user;
  if (!user) return null;
  const sHash =
    (user.app_metadata?.student_hash as string | undefined) ??
    (user.user_metadata?.student_hash as string | undefined) ??
    null;
  if (!sHash) return null;
  const profile = await getStudentProfile(supabase, sHash);
  if (!profile) return null;
  return { firstName: profile.first_name, lastName: profile.last_name, fullName: profile.full_name, studentHash: profile.student_hash };
}

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const student = await currentStudent();
  return (
    <StudentProvider initial={student}>
      <SidebarProvider>
        <Sidebar>
          <SidebarHeader>
            <Link href="/dashboard" className="flex items-center gap-2 px-2 py-1">
              <span className="flex size-8 items-center justify-center rounded-lg bg-primary font-bold text-primary-foreground">F</span>
              <span className="flex flex-col">
                <span className="text-sm font-semibold">Festacol</span>
                <span className="text-xs text-muted-foreground">Student portal</span>
              </span>
            </Link>
          </SidebarHeader>
          <SidebarContent>
            <SidebarGroup>
              <SidebarGroupLabel>Learn</SidebarGroupLabel>
              <SidebarMenu>
                {studentNav.map((item) => (
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
            <p className="truncate px-2 text-xs text-muted-foreground">{student ? student.fullName : "Not signed in"}</p>
          </SidebarFooter>
        </Sidebar>
        <main className="flex min-h-svh flex-1 flex-col">
          <header className="sticky top-0 z-10 flex items-center gap-2 border-b bg-background px-4 py-2">
            <SidebarTrigger />
            <p className="text-sm text-muted-foreground">Student portal</p>
          </header>
          <div className="mx-auto w-full max-w-7xl flex-1 p-4 sm:p-6 lg:p-7">{children}</div>
        </main>
      </SidebarProvider>
    </StudentProvider>
  );
}
