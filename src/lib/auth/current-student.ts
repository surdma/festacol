import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getStudentProfile } from "@/lib/supabase/queries";

// Server-side current student: returns null when signed out.
export async function currentStudent() {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase.auth.getUser();
  const studentHash =
    (data.user?.app_metadata?.student_hash as string | undefined) ??
    (data.user?.user_metadata?.student_hash as string | undefined) ??
    null;
  if (!studentHash) return null;
  const profile = await getStudentProfile(supabase, studentHash);
  if (!profile) return null;
  return { supabase, profile };
}
