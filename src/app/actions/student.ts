"use server";

import { revalidatePath } from "next/cache";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { ensureStudentProfile, studentEmailFor } from "@/lib/auth/student";
import { studentLoginSchema } from "@/lib/validation";
import { candidateCredentials } from "@/lib/assessment";

export interface ActionResult {
  ok: boolean;
  error?: string;
}

// Student sign-in: firstname + lastname only (prototype UX preserved).
// Runs entirely on the server: no Supabase keys, emails, or password
// derivation ever reach the browser. Auth identity is stored in
// app_metadata (server-writable only) — never user_metadata, which the
// user can edit and must not drive authorization.
export async function signInStudentAction(input: { firstName: string; lastName: string }): Promise<ActionResult> {
  const parsed = studentLoginSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Enter first and last name." };

  const id = candidateCredentials(parsed.data.firstName, parsed.data.lastName);
  const { profile, studentHash } = await ensureStudentProfile({ firstName: id.firstName, lastName: id.lastName });
  const email = studentEmailFor(id.firstName, id.lastName);
  const password = `fst:${studentHash}`;
  const supabase = await createSupabaseServerClient();

  const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });
  if (signInError) {
    // Provision via service-role so email is pre-confirmed and app_metadata
    // is set authoritatively (anon signUp could neither).
    const admin = createSupabaseAdminClient();
    const { error: createError } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { full_name: profile.full_name },
      app_metadata: { student_hash: studentHash, role: "student" },
    });
    if (createError) return { ok: false, error: createError.message };
    const { error: retryError } = await supabase.auth.signInWithPassword({ email, password });
    if (retryError) return { ok: false, error: retryError.message };
  }

  revalidatePath("/dashboard");
  return { ok: true };
}

export async function signOutStudentAction(): Promise<ActionResult> {
  const supabase = await createSupabaseServerClient();
  await supabase.auth.signOut();
  revalidatePath("/");
  return { ok: true };
}

export async function updateProfileAction(input: { phone: string; guardian: string }): Promise<ActionResult> {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase.auth.getUser();
  const studentHash =
    (data.user?.app_metadata?.student_hash as string | undefined) ??
    (data.user?.user_metadata?.student_hash as string | undefined);
  if (!studentHash) return { ok: false, error: "Sign in required." };
  const { error } = await supabase
    .from("student_profiles")
    .update({ phone: input.phone.slice(0, 20), guardian: input.guardian.slice(0, 80), updated_at: Date.now() })
    .eq("student_hash", studentHash);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/dashboard/profile");
  return { ok: true };
}
