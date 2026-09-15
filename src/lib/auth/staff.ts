import type { User } from "@supabase/supabase-js";
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
  user: User | null;
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
  if (!authUser) return { supabase, scope: emptyScope, user: null };

  const { data: memberRow } = await supabase
    .from("school_members")
    .select("id,role,status,qualifier_access")
    .eq("auth_user_id", authUser.id)
    .eq("status", "active")
    .in("role", ["teacher", "administrator"])
    .maybeSingle();
  const member = memberRow as { id: string; role: string; status: string; qualifier_access: boolean } | null;
  if (!member) return { supabase, scope: emptyScope, user: authUser };

  const { data: qualifications } = await supabase
    .from("staff_subject_qualifications")
    .select("subject_id")
    .eq("staff_id", member.id)
    .eq("active", true);

  return {
    supabase,
    user: authUser,
    scope: {
      role: member.role,
      isAdmin: member.role === "administrator",
      isTeacher: member.role === "teacher",
      profileId: member.id,
      subjectIds: ((qualifications ?? []) as { subject_id: string }[]).map((row) => row.subject_id),
      qualifierAccess: member.role === "administrator" || member.qualifier_access,
    },
  };
}
