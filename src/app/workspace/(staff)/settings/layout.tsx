import { redirect } from "next/navigation";
import { SettingsNav } from "@/components/admin/settings/settings-nav";
import { currentStaff } from "@/lib/auth/staff";

export default async function SettingsLayout({ children }: { children: React.ReactNode }) {
  const { scope } = await currentStaff();
  if (!scope.profileId || (!scope.isAdmin && !scope.isTeacher)) redirect("/workspace/login");

  return (
    <div className="min-w-0">
      <div className="mb-5 border-b border-border pb-3 lg:hidden">
        <SettingsNav role={scope.role} />
      </div>

      <div className="grid min-w-0 gap-7 lg:grid-cols-[230px_minmax(0,1fr)] lg:items-start">
        <aside className="hidden border-r border-border pr-5 lg:sticky lg:top-20 lg:block lg:min-h-[calc(100dvh-7rem)]">
          <SettingsNav role={scope.role} />
        </aside>
        <section className="min-w-0 pb-10">{children}</section>
      </div>
    </div>
  );
}
