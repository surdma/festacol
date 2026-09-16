import {
  AdminEmptyState,
  AdminFilterLinks,
  AdminPageHeader,
  AdminSearchForm,
} from "@/components/admin/admin-ui";
import { StaffDirectoryTable, type StaffDirectoryTableRow } from "@/components/admin/member-directory-tables";
import { StaffProvisionDialog } from "@/components/admin/staff-provision-dialog";
import { currentStaff } from "@/lib/auth/staff";
import { listUsers } from "@/lib/supabase/queries";
import { listStaffTeachingScopes } from "@/lib/supabase/staff-directory";

export default async function AdminStaffPage({ searchParams }: { searchParams: Promise<{ q?: string; role?: string }> }) {
  const params = await searchParams;
  const q = String(params.q ?? "").trim();
  const role = params.role === "teacher" || params.role === "administrator" ? params.role : "all";
  const { supabase, scope } = await currentStaff();
  const users = await listUsers(supabase, "staff", q);
  const teachingScopes = await listStaffTeachingScopes(supabase, users.map((user) => user.id));
  const scopesByStaff = new Map<string, typeof teachingScopes>();
  for (const item of teachingScopes) scopesByStaff.set(item.staffId, [...(scopesByStaff.get(item.staffId) ?? []), item]);

  const rows: StaffDirectoryTableRow[] = users
    .filter((user) => role === "all" || user.role === role)
    .map((user) => ({ user, teaching: scopesByStaff.get(user.id) ?? [] }));

  return (
    <div>
      <AdminPageHeader
        eyebrow="Directory"
        title="Staff"
        description="Staff records now separate identity and role from subject qualifications, actual class-subject teaching assignments, placement access and account status."
        actions={scope.isAdmin ? <StaffProvisionDialog /> : null}
      />

      <div className="mb-4 grid gap-3 md:grid-cols-[minmax(0,1fr)_auto]">
        <AdminSearchForm query={q} placeholder="Search staff name or Staff ID" hidden={{ role: role === "all" ? undefined : role }} />
        <AdminFilterLinks
          pathname="/workspace/staff"
          param="role"
          current={role}
          preserve={{ q }}
          options={[{ value: "all", label: "All staff" }, { value: "teacher", label: "Teacher" }, { value: "administrator", label: "Administrator" }]}
        />
      </div>

      {rows.length
        ? <StaffDirectoryTable rows={rows} canDelete={scope.isAdmin} />
        : <AdminEmptyState title="No matching staff" description="Change the current search or role filter." />}
    </div>
  );
}
