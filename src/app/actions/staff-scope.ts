"use server";

import { currentStaff } from "@/lib/auth/staff";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export async function getStaffScopeDetailAction(staffId: string) {
  const current = await currentStaff();
  if (!current.scope.isAdmin || !current.scope.profileId) throw new Error("Administrator sign-in required.");
  const admin = createSupabaseAdminClient();
  const { data: memberRow } = await admin
    .from("school_members")
    .select("id,auth_user_id,first_name,last_name,staff_number,status,role,qualifier_access")
    .eq("id", staffId)
    .maybeSingle();
  const member = memberRow as {
    id: string;
    auth_user_id: string | null;
    first_name: string;
    last_name: string;
    staff_number: string | null;
    status: string;
    role: string;
    qualifier_access: boolean;
  } | null;
  if (!member || !["teacher", "administrator"].includes(member.role)) return null;
  const [{ data: qualifications }, { data: assignments }] = await Promise.all([
    admin.from("staff_subject_qualifications").select("subject_id").eq("staff_id", member.id).eq("active", true),
    admin.from("teaching_assignments").select("offering_id").eq("staff_id", member.id).is("ended_at", null),
  ]);
  return {
    memberId: member.id,
    authUserId: member.auth_user_id,
    staffNumber: member.staff_number,
    fullName: `${member.first_name} ${member.last_name}`.trim(),
    status: member.status,
    role: member.role,
    qualifierAccess: member.qualifier_access,
    subjectIds: ((qualifications ?? []) as { subject_id: string }[]).map((row) => row.subject_id),
    offeringIds: ((assignments ?? []) as { offering_id: string }[]).map((row) => row.offering_id),
  };
}
