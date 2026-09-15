import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { ExamSessionRow, UserRow } from "@/types/db";

export interface StaffScope {
  role: string;
  isAdmin: boolean;
  isTeacher: boolean;
  profileId: string | null;
  staffId: string | null;
  subjectIds: string[];
  qualifierAccess: boolean;
}

export type QuestionScope = Pick<StaffScope, "isAdmin" | "profileId" | "subjectIds" | "qualifierAccess">;

export function questionSubjectVisibleTo(subjectId: string, scope: QuestionScope): boolean {
  if (scope.isAdmin) return true;
  return Boolean(subjectId) && scope.subjectIds.includes(subjectId);
}

export async function currentStaff(): Promise<{
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>;
  scope: StaffScope;
  staff: UserRow | null;
}> {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase.auth.getUser();
  const authUser = data.user;
  const emptyScope: StaffScope = {
    role: "",
    isAdmin: false,
    isTeacher: false,
    profileId: null,
    staffId: null,
    subjectIds: [],
    qualifierAccess: false,
  };
  if (!authUser) return { supabase, staff: null, scope: emptyScope };

  const { data: profileRow } = await supabase
    .from("academic_profiles")
    .select("id,legacy_user_id,role,status")
    .eq("auth_user_id", authUser.id)
    .eq("status", "active")
    .in("role", ["teacher", "administrator"])
    .maybeSingle();
  const profile = profileRow as { id: string; legacy_user_id: string | null; role: string; status: string } | null;
  if (!profile) return { supabase, staff: null, scope: emptyScope };

  const [{ data: extension }, { data: qualifications }, { data: legacy }] = await Promise.all([
    supabase.from("staff_academic_profiles").select("qualifier_access").eq("profile_id", profile.id).maybeSingle(),
    supabase.from("staff_subject_qualifications").select("subject_id").eq("staff_profile_id", profile.id).eq("active", true).not("subject_id", "is", null),
    profile.legacy_user_id
      ? supabase.from("users").select("*").eq("id", profile.legacy_user_id).maybeSingle()
      : Promise.resolve({ data: null }),
  ]);
  const role = profile.role;
  return {
    supabase,
    staff: (legacy ?? null) as UserRow | null,
    scope: {
      role,
      isAdmin: role === "administrator",
      isTeacher: role === "teacher",
      profileId: profile.id,
      staffId: profile.legacy_user_id,
      subjectIds: ((qualifications ?? []) as { subject_id: string }[]).map((row) => row.subject_id),
      qualifierAccess: role === "administrator" || Boolean((extension as { qualifier_access?: boolean } | null)?.qualifier_access),
    },
  };
}

// Compatibility helper for pages not yet converted to explicit relational
// queries. The subject set in this helper is canonical UUID-based.
export function examVisibleTo(
  session: Pick<ExamSessionRow, "mode"> & { subjectIds?: string[]; cohosts?: string[] },
  scope: StaffScope,
): boolean {
  if (scope.isAdmin) return true;
  if (scope.staffId && (session.cohosts ?? []).includes(scope.staffId)) return true;
  if (session.mode === "qualifier" && scope.qualifierAccess) return true;
  return (session.subjectIds ?? []).some((subjectId) => scope.subjectIds.includes(subjectId));
}
