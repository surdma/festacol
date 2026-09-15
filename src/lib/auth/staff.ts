import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { ExamSessionRow, UserRow } from "@/types/db";

export interface StaffScope {
  role: string;
  isAdmin: boolean;
  isTeacher: boolean;
  profileId: string | null;
  staffId: string | null;
  subjects: string[];
  qualifierAccess: boolean;
}

export type QuestionScope = Pick<StaffScope, "isAdmin" | "subjects" | "qualifierAccess">;

// Transitional subject visibility. Subject identity becomes UUID-based in the
// curriculum cutover; already, the subject set comes from relational staff
// qualifications rather than users.subjects[].
export function questionSubjectVisibleTo(subjectCode: string, scope: QuestionScope): boolean {
  if (scope.isAdmin) return true;
  if (scope.subjects.includes(subjectCode)) return true;
  return scope.qualifierAccess && subjectCode.startsWith("q-");
}

export async function currentStaff(): Promise<{
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>;
  scope: StaffScope;
  staff: UserRow | null;
}> {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase.auth.getUser();
  const authUser = data.user;
  if (!authUser) {
    return {
      supabase,
      staff: null,
      scope: { role: "", isAdmin: false, isTeacher: false, profileId: null, staffId: null, subjects: [], qualifierAccess: false },
    };
  }

  const { data: profileRow } = await supabase
    .from("academic_profiles")
    .select("id,legacy_user_id,role,status")
    .eq("auth_user_id", authUser.id)
    .eq("status", "active")
    .in("role", ["teacher", "administrator"])
    .maybeSingle();
  const profile = profileRow as { id: string; legacy_user_id: string | null; role: string; status: string } | null;
  if (!profile) {
    return {
      supabase,
      staff: null,
      scope: { role: "", isAdmin: false, isTeacher: false, profileId: null, staffId: null, subjects: [], qualifierAccess: false },
    };
  }

  const [{ data: extension }, { data: qualifications }, { data: legacy }] = await Promise.all([
    supabase.from("staff_academic_profiles").select("qualifier_access").eq("profile_id", profile.id).maybeSingle(),
    supabase.from("staff_subject_qualifications").select("subject_code").eq("staff_profile_id", profile.id).eq("active", true),
    profile.legacy_user_id
      ? supabase.from("users").select("*").eq("id", profile.legacy_user_id).maybeSingle()
      : Promise.resolve({ data: null }),
  ]);
  const staffExtension = extension as { qualifier_access: boolean } | null;
  const subjects = ((qualifications ?? []) as { subject_code: string }[]).map((row) => row.subject_code);
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
      subjects,
      qualifierAccess: Boolean(staffExtension?.qualifier_access),
    },
  };
}

// Transitional legacy exam visibility; replaced by relational exam staff /
// subject targets in the curriculum/exam cutover.
export function examVisibleTo(session: Pick<ExamSessionRow, "subjects" | "mode" | "cohosts">, scope: StaffScope): boolean {
  if (scope.isAdmin) return true;
  if (scope.staffId && (session.cohosts ?? []).includes(scope.staffId)) return true;
  if (session.mode === "qualifier") return scope.qualifierAccess;
  const mine = new Set(scope.subjects);
  return (session.subjects ?? []).some((subject) => mine.has(subject));
}
