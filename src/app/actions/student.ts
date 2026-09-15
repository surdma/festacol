"use server";

import { revalidatePath } from "next/cache";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import {
  claimStudentAuthIdentity,
  legacyStudentCredential,
  resolveExistingStudentIdentity,
  studentEmailForProfile,
  studentPasswordForProfile,
} from "@/lib/auth/student";
import { currentStudent } from "@/lib/auth/current-student";
import { studentLoginSchema } from "@/lib/validation";

export interface ActionResult {
  ok: boolean;
  error?: string;
}

async function signInLinkedStudent(profile: Awaited<ReturnType<typeof resolveExistingStudentIdentity>>): Promise<ActionResult> {
  const supabase = await createSupabaseServerClient();
  const admin = createSupabaseAdminClient();
  const password = studentPasswordForProfile(profile.profileId);
  let authUserId = profile.authUserId;
  let email = "";

  if (authUserId) {
    const { data: existing, error: lookupError } = await admin.auth.admin.getUserById(authUserId);
    if (lookupError || !existing.user) return { ok: false, error: "Student login is linked to a missing Auth account. Contact your school administrator." };
    email = existing.user.email ?? studentEmailForProfile(profile.profileId);
    const { error: updateError } = await admin.auth.admin.updateUserById(authUserId, {
      email,
      password,
      email_confirm: true,
      user_metadata: { full_name: profile.fullName },
      app_metadata: { role: "student", academic_profile_id: profile.profileId },
    });
    if (updateError) return { ok: false, error: updateError.message };
  } else {
    // Recover the old Auth wrapper if one already exists. This only happens
    // after the roster profile was resolved uniquely, so a free-typed name can
    // never create or select an academic student record.
    const legacy = await legacyStudentCredential(profile.firstName, profile.lastName);
    const legacySignIn = await supabase.auth.signInWithPassword({ email: legacy.email, password: legacy.password });
    if (!legacySignIn.error && legacySignIn.data.user) {
      authUserId = legacySignIn.data.user.id;
      email = legacySignIn.data.user.email ?? legacy.email;
      if (!(await claimStudentAuthIdentity(profile.profileId, authUserId))) {
        await supabase.auth.signOut();
        return { ok: false, error: "This student record is already linked to another login." };
      }
      const { error: updateError } = await admin.auth.admin.updateUserById(authUserId, {
        password,
        user_metadata: { full_name: profile.fullName },
        app_metadata: { role: "student", academic_profile_id: profile.profileId },
      });
      if (updateError) return { ok: false, error: updateError.message };
      await supabase.auth.signOut();
    } else {
      email = studentEmailForProfile(profile.profileId);
      const { data: created, error: createError } = await admin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: { full_name: profile.fullName },
        app_metadata: { role: "student", academic_profile_id: profile.profileId },
      });
      if (createError || !created.user) return { ok: false, error: createError?.message ?? "Student login could not be created." };
      authUserId = created.user.id;
      const claimed = await claimStudentAuthIdentity(profile.profileId, authUserId);
      if (!claimed) {
        await admin.auth.admin.deleteUser(authUserId);
        return { ok: false, error: "This student record is already linked to another login." };
      }
    }
  }

  if (!authUserId || !email) return { ok: false, error: "Student login could not be resolved." };
  const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });
  if (signInError) return { ok: false, error: signInError.message };
  return { ok: true };
}

// Name-based UX remains for compatibility, but it can authenticate only a
// single EXISTING active roster student. It never provisions an academic row.
export async function signInStudentAction(input: { firstName: string; lastName: string }): Promise<ActionResult> {
  const parsed = studentLoginSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Enter first and last name." };
  try {
    const profile = await resolveExistingStudentIdentity(parsed.data.firstName, parsed.data.lastName);
    const result = await signInLinkedStudent(profile);
    if (!result.ok) return result;
    revalidatePath("/dashboard");
    return { ok: true };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "Student sign-in failed." };
  }
}

export async function signOutStudentAction(): Promise<ActionResult> {
  const supabase = await createSupabaseServerClient();
  await supabase.auth.signOut();
  revalidatePath("/");
  return { ok: true };
}

export async function updateProfileAction(input: { phone: string; guardian: string }): Promise<ActionResult> {
  const ctx = await currentStudent();
  if (!ctx) return { ok: false, error: "Sign in required." };
  const { error } = await ctx.supabase
    .from("student_academic_profiles")
    .update({
      phone: input.phone.slice(0, 20),
      guardian: input.guardian.slice(0, 80),
      updated_at: new Date().toISOString(),
    })
    .eq("profile_id", ctx.profile.profile_id);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/dashboard/profile");
  return { ok: true };
}
