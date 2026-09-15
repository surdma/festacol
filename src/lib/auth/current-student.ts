import { createSupabaseServerClient } from "@/lib/supabase/server";

export interface CurrentStudentProfile {
  profile_id: string;
  student_number: string | null;
  first_name: string;
  last_name: string;
  full_name: string;
  phone: string;
  guardian: string;
  promotion_status: string;
}

export interface CurrentStudentEnrollment {
  id: string;
  class_id: string;
  status: string;
  enrolled_at: string;
}

// Server-side student identity. Supabase Auth resolves directly to one
// canonical school_members row; there are no student profile extension tables.
export async function currentStudent() {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase.auth.getUser();
  const authUser = data.user;
  if (!authUser) return null;

  const { data: memberRow } = await supabase
    .from("school_members")
    .select("id,role,status,first_name,last_name,student_number,guardian,phone,promotion_status")
    .eq("auth_user_id", authUser.id)
    .eq("role", "student")
    .eq("status", "active")
    .maybeSingle();
  const member = memberRow as {
    id: string;
    role: string;
    status: string;
    first_name: string;
    last_name: string;
    student_number: string | null;
    guardian: string | null;
    phone: string | null;
    promotion_status: string | null;
  } | null;
  if (!member) return null;

  const { data: enrollment } = await supabase
    .from("class_enrollments")
    .select("id,class_id,status,enrolled_at")
    .eq("student_id", member.id)
    .eq("status", "active")
    .is("ended_at", null)
    .order("enrolled_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const activeEnrollment = (enrollment ?? null) as CurrentStudentEnrollment | null;
  const { data: classRow } = activeEnrollment
    ? await supabase.from("classes").select("*").eq("id", activeEnrollment.class_id).maybeSingle()
    : { data: null };

  const profile: CurrentStudentProfile = {
    profile_id: member.id,
    student_number: member.student_number,
    first_name: member.first_name,
    last_name: member.last_name,
    full_name: `${member.first_name} ${member.last_name}`.trim(),
    phone: member.phone ?? "",
    guardian: member.guardian ?? "",
    promotion_status: member.promotion_status ?? "on-track",
  };

  return {
    supabase,
    authUserId: authUser.id,
    profile,
    enrollment: activeEnrollment,
    classRow: classRow ?? null,
  };
}
