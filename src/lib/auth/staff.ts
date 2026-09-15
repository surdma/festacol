import { createSupabaseServerClient } from "@/lib/supabase/server";

export interface StaffScope {
  role: string;
  isAdmin: boolean;
  isTeacher: boolean;
  profileId: string | null;
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
}> {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase.auth.getUser();
  const authUser = data.user;
  const emptyScope: StaffScope = {
    role: "",
    isAdmin: false,
    isTeacher: false,
    profileId: null,
    subjectIds: [],
    qualifierAccess: false,
  };
  if (!authUser) return { supabase, scope: emptyScope };

  const { data: profileRow } = await supabase
    .from("academic_profiles")
    .select("id,role,status")
    .eq("auth_user_id", authUser.id)
    .eq("status", "active")
    .in("role", ["teacher", "administrator"])
    .maybeSingle();
  const profile = profileRow as { id: string; role: string; status: string } | null;
  if (!profile) return { supabase, scope: emptyScope };

  const [{ data: extension }, { data: qualifications }] = await Promise.all([
    supabase.from("staff_academic_profiles").select("qualifier_access").eq("profile_id", profile.id).maybeSingle(),
    supabase
      .from("staff_subject_qualifications")
      .select("subject_id")
      .eq("staff_profile_id", profile.id)
      .eq("active", true),
  ]);

  return {
    supabase,
    scope: {
      role: profile.role,
      isAdmin: profile.role === "administrator",
      isTeacher: profile.role === "teacher",
      profileId: profile.id,
      subjectIds: ((qualifications ?? []) as { subject_id: string }[]).map((row) => row.subject_id),
      qualifierAccess:
        profile.role === "administrator" ||
        Boolean((extension as { qualifier_access?: boolean } | null)?.qualifier_access),
    },
  };
}
