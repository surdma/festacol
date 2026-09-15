import Link from "next/link";
import { MoreHorizontal } from "lucide-react";
import {
  AdminEmptyState,
  AdminFilterLinks,
  AdminPageHeader,
  AdminSearchForm,
  adminIconButtonClass,
  adminSurfaceClass,
} from "@/components/admin/admin-ui";
import { StaffProvisionDialog } from "@/components/admin/staff-provision-dialog";
import { StatusBadge } from "@/components/status-badge";
import { Button } from "@/components/ui/button";
import { currentStaff } from "@/lib/auth/staff";
import { listClasses, listUsers } from "@/lib/supabase/queries";

function initials(name: string) {
  return name.split(/\s+/).filter(Boolean).map((part) => part[0]).join("").slice(0, 2).toUpperCase();
}

export default async function AdminStaffPage({ searchParams }: { searchParams: Promise<{ q?: string; role?: string }> }) {
  const params = await searchParams;
  const q = String(params.q ?? "").trim();
  const role = params.role === "teacher" || params.role === "administrator" ? params.role : "all";
  const { supabase, scope } = await currentStaff();
  const [users, classes] = await Promise.all([listUsers(supabase, "staff", q), listClasses(supabase)]);
  const classNames = new Map(classes.map((item) => [item.id, item.name]));
  const visible = users.filter((user) => role === "all" || user.role === role);

  return (
    <div>
      <AdminPageHeader
        eyebrow="Directory"
        title="Staff"
        description="Teacher and administrator records are kept separate from the student directory while production access remains tied to Supabase Auth and subject scope."
        actions={scope.isAdmin ? <StaffProvisionDialog /> : null}
      />

      <div className="mb-4 grid gap-3 md:grid-cols-[minmax(0,1fr)_auto]">
        <AdminSearchForm query={q} placeholder="Search staff name" hidden={{ role: role === "all" ? undefined : role }} />
        <AdminFilterLinks
          pathname="/admin/staff"
          param="role"
          current={role}
          preserve={{ q }}
          options={[{ value: "all", label: "All staff" }, { value: "teacher", label: "Teacher" }, { value: "administrator", label: "Administrator" }]}
        />
      </div>

      <section className={`${adminSurfaceClass} overflow-hidden`}>
        {visible.length ? (
          <>
            <div className="hidden overflow-x-auto md:block">
              <table className="w-full text-left text-sm">
                <thead className="border-b border-neutral-200 bg-neutral-50 text-[11px] font-bold uppercase tracking-[.1em] text-neutral-500">
                  <tr>
                    <th className="whitespace-nowrap px-4 py-3">User</th>
                    <th className="whitespace-nowrap px-4 py-3">Role</th>
                    <th className="whitespace-nowrap px-4 py-3">Subject scope</th>
                    <th className="whitespace-nowrap px-4 py-3">Class</th>
                    <th className="whitespace-nowrap px-4 py-3">Status</th>
                    {scope.isAdmin ? <th className="whitespace-nowrap px-4 py-3"><span className="sr-only">Manage</span></th> : null}
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-100">
                  {visible.map((user) => (
                    <tr key={user.id} className="hover:bg-neutral-50">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <span className="grid size-9 place-items-center rounded-lg bg-neutral-100 text-xs font-bold text-neutral-800">{initials(user.full_name)}</span>
                          <span><strong className="block text-neutral-950">{user.full_name}</strong><span className="text-xs text-neutral-500">{user.email || user.id}</span></span>
                        </div>
                      </td>
                      <td className="px-4 py-3 capitalize text-neutral-700">{user.role}</td>
                      <td className="max-w-sm px-4 py-3 text-neutral-700">
                        <span className="text-sm">{user.subjects?.length ? user.subjects.join(", ") : user.role === "administrator" ? "All subjects" : "Not configured"}</span>
                        {user.qualifier_access ? <div className="mt-1"><StatusBadge tone="blue">Qualifier access</StatusBadge></div> : null}
                      </td>
                      <td className="px-4 py-3 text-neutral-700">{user.class_id ? classNames.get(user.class_id) ?? user.class_id : "—"}</td>
                      <td className="px-4 py-3"><StatusBadge tone={user.status === "active" ? "emerald" : "neutral"}>{user.status}</StatusBadge></td>
                      {scope.isAdmin ? <td className="px-4 py-3 text-right"><Button size="icon" variant="outline" render={<Link href={`/admin/staff?modal=staff-edit&staff=${encodeURIComponent(user.id)}`} />} className={adminIconButtonClass} aria-label={`Manage ${user.full_name}`}><MoreHorizontal className="size-5" /></Button></td> : null}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="divide-y divide-neutral-100 md:hidden">
              {visible.map((user) => {
                const content = <><span className="grid size-10 shrink-0 place-items-center rounded-xl bg-neutral-100 text-xs font-bold text-neutral-800">{initials(user.full_name)}</span><span className="min-w-0 flex-1"><strong className="block truncate text-sm text-neutral-950">{user.full_name}</strong><span className="mt-1 block truncate text-xs text-neutral-500">{classNames.get(user.class_id ?? "") || user.role}</span></span><StatusBadge tone={user.status === "active" ? "emerald" : "neutral"}>{user.status}</StatusBadge></>;
                return scope.isAdmin ? <Link key={user.id} href={`/admin/staff?modal=staff-edit&staff=${encodeURIComponent(user.id)}`} className="flex w-full items-center gap-3 p-4 text-left transition hover:bg-neutral-50">{content}</Link> : <div key={user.id} className="flex w-full items-center gap-3 p-4">{content}</div>;
              })}
            </div>
          </>
        ) : <AdminEmptyState title="No matching staff" description="Change the current search or role filter." />}
      </section>
    </div>
  );
}
