import { LogOut, Mail, ShieldCheck, UserRound } from "lucide-react";
import { signOutAdminAction } from "@/app/actions/admin-auth";
import { AdminPageHeader, adminSecondaryButtonClass } from "@/components/admin/admin-ui";
import { Button } from "@/components/ui/button";
import { currentStaff } from "@/lib/auth/staff";

function Detail({ label, value, icon: Icon }: { label: string; value: string; icon: typeof UserRound }) {
  return (
    <div className="flex items-start gap-3 rounded-2xl border border-neutral-200 bg-white p-4">
      <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-neutral-100 text-neutral-700"><Icon className="size-4" /></span>
      <div className="min-w-0"><p className="text-[10px] font-bold uppercase tracking-[.14em] text-neutral-500">{label}</p><p className="mt-1 truncate text-sm font-bold text-neutral-950">{value}</p></div>
    </div>
  );
}

export default async function AccountSettingsPage() {
  const { supabase, scope } = await currentStaff();
  const [{ data: authData }, { data: memberRow }] = await Promise.all([
    supabase.auth.getUser(),
    scope.profileId
      ? supabase.from("school_members").select("first_name,last_name,staff_number,role,status,qualifier_access").eq("id", scope.profileId).maybeSingle()
      : Promise.resolve({ data: null }),
  ]);
  const member = memberRow as { first_name: string; last_name: string; staff_number: string | null; role: string; status: string; qualifier_access: boolean } | null;
  const displayRole = scope.isAdmin ? "Administrator" : "Teacher";

  return (
    <div>
      <AdminPageHeader eyebrow="Account & access" title="Your staff account" description="Review the identity and school access attached to the account currently signed in." />

      <section className="overflow-hidden rounded-3xl bg-neutral-950 p-6 text-white shadow-sm sm:p-7">
        <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex min-w-0 items-center gap-4">
            <span className="grid size-14 shrink-0 place-items-center rounded-2xl bg-white font-display text-lg font-black text-neutral-950">{member ? `${member.first_name.charAt(0)}${member.last_name.charAt(0)}` : "FS"}</span>
            <div className="min-w-0"><p className="text-xs font-semibold text-neutral-400">{displayRole}</p><h2 className="mt-1 truncate font-display text-xl font-extrabold">{member ? `${member.first_name} ${member.last_name}` : "Staff account"}</h2><p className="mt-1 truncate text-xs text-neutral-400">{authData.user?.email ?? "Signed-in account"}</p></div>
          </div>
          <span className="inline-flex w-fit items-center gap-2 rounded-full border border-emerald-400/20 bg-emerald-400/10 px-3 py-1.5 text-xs font-bold text-emerald-300"><span className="size-1.5 rounded-full bg-emerald-300" />{member?.status === "active" ? "Active staff account" : "Staff account"}</span>
        </div>
      </section>

      <section className="mt-5 grid gap-3 sm:grid-cols-2">
        <Detail label="Staff name" value={member ? `${member.first_name} ${member.last_name}` : "Not available"} icon={UserRound} />
        <Detail label="School role" value={displayRole} icon={ShieldCheck} />
        <Detail label="Staff number" value={member?.staff_number ?? "Not assigned"} icon={UserRound} />
        <Detail label="Sign-in email" value={authData.user?.email ?? "Not available"} icon={Mail} />
      </section>

      <section className="mt-5 rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm">
        <p className="text-[10px] font-bold uppercase tracking-[.14em] text-neutral-500">Sign-in</p>
        <div className="mt-2 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div><h2 className="font-display text-lg font-extrabold text-neutral-950">End this session</h2><p className="mt-1 text-sm leading-6 text-neutral-500">Sign out when you finish using a shared school computer.</p></div>
          <form action={signOutAdminAction}><Button type="submit" variant="outline" className={adminSecondaryButtonClass}><LogOut className="size-4" />Sign out</Button></form>
        </div>
      </section>
    </div>
  );
}
