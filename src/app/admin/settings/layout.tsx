import { SettingsNav } from "@/components/admin/settings/settings-nav";
import { currentStaff } from "@/lib/auth/staff";

export default async function SettingsLayout({ children }: { children: React.ReactNode }) {
  const { scope } = await currentStaff();

  return (
    <div className="grid gap-5 lg:grid-cols-[260px_minmax(0,1fr)] lg:items-start">
      <aside className="lg:sticky lg:top-21">
        <div className="rounded-2xl border border-neutral-200 bg-neutral-100/70 p-2">
          <div className="hidden px-3 pb-2 pt-2 lg:block">
            <p className="text-[10px] font-bold uppercase tracking-[.16em] text-neutral-500">{scope.isAdmin ? "School settings" : "My settings"}</p>
            <p className="mt-1 text-xs leading-5 text-neutral-500">{scope.isAdmin ? "Configure the academic environment and your account." : "Manage the teaching settings available to your role."}</p>
          </div>
          <SettingsNav role={scope.role} />
        </div>
      </aside>
      <div className="min-w-0">{children}</div>
    </div>
  );
}
