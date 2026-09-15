"use server";

import { currentStaff } from "@/lib/auth/staff";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export async function getStaffScopeDetailAction(staffKey: string) {
  const current = await currentStaff();
  if (!current.scope.isAdmin || !current.scope.profileId) throw new Error("Administrator sign-in required.");
  const admin = createSupabaseAdminClient();
  const { data: profile } = await admin
    .from("academic_profiles")
    .select("id,legacy_user_id,full_name,email,status,role")
    .or(`id.eq.${staffKey},legacy_user_id.eq.${staffKey}`)
    .maybeSingle();
  const person = profile as { id: string; legacy_user_id: string | null; full_name: string; email: string; status: string; role: string } | null;
  if (!person || !["teacher", "administrator"].includes(person.role)) return null;
  const [{ data: extension }, { data: qualifications }, { data: assignments }] = await Promise.all([
    admin.from("staff_academic_profiles").select("qualifier_access").eq("profile_id", person.id).maybeSingle(),
    admin.from("staff_subject_qualifications").select("subject_id").eq("staff_profile_id", person.id).eq("active", true).not("subject_id", "is", null),
    admin.from("teaching_assignments").select("offering_id").eq("staff_profile_id", person.id).eq("status", "active").not("offering_id", "is", null),
  ]);
  return {
    profileId: person.id,
    legacyUserId: person.legacy_user_id,
    fullName: person.full_name,
    email: person.email,
    status: person.status,
    role: person.role,
    qualifierAccess: Boolean((extension as { qualifier_access?: boolean } | null)?.qualifier_access),
    subjectIds: ((qualifications ?? []) as { subject_id: string }[]).map((row) => row.subject_id),
    offeringIds: ((assignments ?? []) as { offering_id: string }[]).map((row) => row.offering_id),
  };
}
