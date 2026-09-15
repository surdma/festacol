import { createSupabaseServerClient } from "@/lib/supabase/server";

export interface CurrentStudentProfile {
  profile_id: string;
  student_number: string | null;
  first_name: string;
  last_name: string;
  full_name: string;
  email: string;
  phone: string;
  guardian: string;
  promotion_status: string;
}

export interface CurrentStudentEnrollment {
  id: string;
  class_id: string;
  academic_year_id: string;
  status: string;
  enrolled_at: string;
}

// Server-side student identity. Authorization is derived only from the
// Supabase Auth UUID linked to academic_profiles; JWT metadata and name hashes
// are deliberately ignored.
export async function currentStudent() {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase.auth.getUser();
  const authUser = data.user;
  if (!authUser) return null;

  const { data: academic } = await supabase
    .from("academic_profiles")
    .select("id,role,status,first_name,last_name,full_name,email")
    .eq("auth_user_id", authUser.id)
    .eq("role", "student")
    .eq("status", "active")
    .maybeSingle();
  const person = academic as {
    id: string;
    role: string;
    status: string;
    first_name: string;
    last_name: string;
    full_name: string;
    email: string;
  } | null;
  if (!person) return null;

  const [{ data: extension }, { data: enrollment }] = await Promise.all([
    supabase
      .from("student_academic_profiles")
      .select("profile_id,student_number,guardian,phone,promotion_status")
      .eq("profile_id", person.id)
      .maybeSingle(),
    supabase
      .from("class_enrollments")
      .select("id,class_id,academic_year_id,status,enrolled_at")
      .eq("student_profile_id", person.id)
      .eq("status", "active")
      .order("enrolled_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);
  const student = extension as {
    profile_id: string;
    student_number: string | null;
    guardian: string;
    phone: string;
    promotion_status: string;
  } | null;
  if (!student) return null;

  const activeEnrollment = (enrollment ?? null) as CurrentStudentEnrollment | null;
  const { data: classRow } = activeEnrollment
    ? await supabase.from("classes").select("*").eq("id", activeEnrollment.class_id).maybeSingle()
    : { data: null };

  const profile: CurrentStudentProfile = {
    profile_id: person.id,
    student_number: student.student_number,
    first_name: person.first_name,
    last_name: person.last_name,
    full_name: person.full_name,
    email: person.email,
    phone: student.phone,
    guardian: student.guardian,
    promotion_status: student.promotion_status,
  };

  return {
    supabase,
    authUserId: authUser.id,
    profile,
    enrollment: activeEnrollment,
    classRow: classRow ?? null,
  };
}
