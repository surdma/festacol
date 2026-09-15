import { listUsers } from "@/lib/supabase/queries";
import { currentStaff } from "@/lib/auth/staff";
import { FadeUp } from "@/components/motion";
import { DirectoryTable } from "../students/page";
import { StaffProvisionDialog } from "@/components/admin/staff-provision-dialog";

export default async function AdminStaffPage() {
  const { supabase, scope } = await currentStaff();
  const users = await listUsers(supabase, "staff");
  return (
    <FadeUp className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <div><h1 className="text-2xl font-semibold">Staff</h1><p className="text-muted-foreground">Route: /admin/staff</p></div>
        {scope.isAdmin ? <StaffProvisionDialog /> : null}
      </div>
      <DirectoryTable users={users} kind="staff" />
    </FadeUp>
  );
}
