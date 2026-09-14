import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { ExamSessionRow, UserRow } from "@/types/db";

export interface StaffScope {
  role: string;
  isAdmin: boolean;
  isTeacher: boolean;
  staffId: string | null;
  subjects: string[];
  qualifierAccess: boolean;
}

// Who is behind the admin-area session, and what may they see?
// Admins: everything. Teachers: own subjects (+qualifier iff granted,
// +cohosted exams). Reads happen here so pages can filter server-side.
export async function currentStaff(): Promise<{ supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>; scope: StaffScope; staff: UserRow | null }> {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase.auth.getUser();
  const user = data.user;
  const role =
    (user?.app_metadata?.role as string | undefined) ??
    (user?.user_metadata?.role as string | undefined) ??
    "";
  const staffId =
    (user?.app_metadata?.staff_id as string | undefined) ??
    (user?.user_metadata?.staff_id as string | undefined) ??
    null;
  let staff: UserRow | null = null;
  if (staffId) {
    const { data: row } = await supabase.from("users").select("*").eq("id", staffId).maybeSingle();
    staff = (row ?? null) as UserRow | null;
  }
  return {
    supabase,
    staff,
    scope: {
      role,
      isAdmin: role === "administrator",
      isTeacher: role === "teacher",
      staffId,
      subjects: staff?.subjects ?? [],
      qualifierAccess: staff?.qualifier_access ?? false,
    },
  };
}

// Teacher exam visibility: subject overlap, qualifier privilege, or cohost.
export function examVisibleTo(session: Pick<ExamSessionRow, "subjects" | "mode" | "cohosts">, scope: StaffScope): boolean {
  if (scope.isAdmin) return true;
  if (scope.staffId && (session.cohosts ?? []).includes(scope.staffId)) return true;
  if (session.mode === "qualifier") return scope.qualifierAccess;
  const mine = new Set(scope.subjects);
  return (session.subjects ?? []).some((s) => mine.has(s));
}
