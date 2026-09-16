"use server";

import { revalidatePath } from "next/cache";
import { currentStudent } from "@/lib/auth/current-student";
import {
  claimStudentAuthIdentity,
  legacyStudentCredential,
  provisionNewStudentAccount,
  resolveExistingStudentIdentity,
  studentEmailForMember,
  studentPasswordForMember,
} from "@/lib/auth/student";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { studentLoginSchema } from "@/lib/validation";

export interface ActionResult {
  ok: boolean;
  error?: string;
}

export interface StudentSignInResult extends ActionResult {
  provisioned?: boolean;
  studentNumber?: string | null;
}

export async function signInLinkedStudent(
  member: Awaited<ReturnType<typeof resolveExistingStudentIdentity>>,
): Promise<ActionResult> {
  const supabase = await createSupabaseServerClient();
  const admin = createSupabaseAdminClient();
  const password = studentPasswordForMember(member.memberId);
  let authUserId = member.authUserId;
  let email = "";

  if (authUserId) {
    const { data: existing, error: lookupError } =
      await admin.auth.admin.getUserById(authUserId);
    if (lookupError || !existing.user)
      return {
        ok: false,
        error:
          "Student login is linked to a missing Auth account. Contact your school administrator.",
      };
    email = existing.user.email ?? studentEmailForMember(member.memberId);
    const { error: updateError } = await admin.auth.admin.updateUserById(
      authUserId,
      {
        email,
        password,
        email_confirm: true,
        user_metadata: { full_name: member.fullName },
        app_metadata: { role: "student", school_member_id: member.memberId },
      },
    );
    if (updateError) return { ok: false, error: updateError.message };
  } else {
    // Recover the old Auth wrapper if one already exists. This only happens
    // after the roster member was resolved uniquely, so a free-typed name can
    // never create or select an academic student record.
    const legacy = await legacyStudentCredential(
      member.firstName,
      member.lastName,
    );
    const legacySignIn = await supabase.auth.signInWithPassword({
      email: legacy.email,
      password: legacy.password,
    });
    if (!legacySignIn.error && legacySignIn.data.user) {
      authUserId = legacySignIn.data.user.id;
      email = legacySignIn.data.user.email ?? legacy.email;
      if (!(await claimStudentAuthIdentity(member.memberId, authUserId))) {
        await supabase.auth.signOut({ scope: "local" });
        return {
          ok: false,
          error: "This student record is already linked to another login.",
        };
      }
      const { error: updateError } = await admin.auth.admin.updateUserById(
        authUserId,
        {
          password,
          user_metadata: { full_name: member.fullName },
          app_metadata: { role: "student", school_member_id: member.memberId },
        },
      );
      if (updateError) return { ok: false, error: updateError.message };
      await supabase.auth.signOut({ scope: "local" });
    } else {
      email = studentEmailForMember(member.memberId);
      const { data: created, error: createError } =
        await admin.auth.admin.createUser({
          email,
          password,
          email_confirm: true,
          user_metadata: { full_name: member.fullName },
          app_metadata: { role: "student", school_member_id: member.memberId },
        });
      if (createError || !created.user)
        return {
          ok: false,
          error: createError?.message ?? "Student login could not be created.",
        };
      authUserId = created.user.id;
      const claimed = await claimStudentAuthIdentity(
        member.memberId,
        authUserId,
      );
      if (!claimed) {
        await admin.auth.admin.deleteUser(authUserId);
        return {
          ok: false,
          error: "This student record is already linked to another login.",
        };
      }
    }
  }

  if (!authUserId || !email)
    return { ok: false, error: "Student login could not be resolved." };
  const { error: signInError } = await supabase.auth.signInWithPassword({
    email,
    password,
  });
  if (signInError) return { ok: false, error: signInError.message };
  return { ok: true };
}

// First + last name are the one student credential surface. Existing roster
// students sign straight in; unknown names are provisioned as brand-new
// student accounts with no class yet. The caller decides whether the signed-in
// student continues to the dashboard or returns to a preserved exam link.
export async function signInStudentAction(input: {
  firstName: string;
  lastName: string;
}): Promise<StudentSignInResult> {
  const parsed = studentLoginSchema.safeParse(input);
  if (!parsed.success)
    return { ok: false, error: "Enter first and last name." };
  const supabase = await createSupabaseServerClient();
  const { data: sessionUser } = await supabase.auth.getUser();
  if (sessionUser.user) {
    const { data: currentMember } = await supabase
      .from("school_members")
      .select("role")
      .eq("auth_user_id", sessionUser.user.id)
      .eq("status", "active")
      .maybeSingle();
    const currentRole = (currentMember as { role?: string } | null)?.role;
    if (currentRole === "teacher" || currentRole === "administrator") {
      return {
        ok: false,
        error:
          "You are signed in with a staff account. Sign out first, then sign in as a student.",
      };
    }
  }
  const firstName = parsed.data.firstName.trim().replace(/\s+/g, " ");
  const lastName = parsed.data.lastName.trim().replace(/\s+/g, " ");
  try {
    const member = await resolveExistingStudentIdentity(firstName, lastName);
    const result = await signInLinkedStudent(member);
    if (!result.ok) return result;
    revalidatePath("/dashboard");
    revalidatePath("/exam");
    return {
      ok: true,
      provisioned: false,
      studentNumber: member.studentNumber,
    };
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Student sign-in failed.";
    if (!message.startsWith("No active student record matches")) {
      return { ok: false, error: message };
    }
    try {
      const member = await provisionNewStudentAccount(firstName, lastName);
      const result = await signInLinkedStudent(member);
      if (!result.ok) return result;
      revalidatePath("/dashboard");
      revalidatePath("/exam");
      return {
        ok: true,
        provisioned: true,
        studentNumber: member.studentNumber,
      };
    } catch (provisionError) {
      return {
        ok: false,
        error:
          provisionError instanceof Error
            ? provisionError.message
            : "Student sign-in failed.",
      };
    }
  }
}

export async function updateProfileAction(input: {
  phone: string;
  guardian: string;
}): Promise<ActionResult> {
  const ctx = await currentStudent();
  if (!ctx) return { ok: false, error: "Sign in required." };
  const { error } = await ctx.supabase
    .from("school_members")
    .update({
      phone: input.phone.slice(0, 20),
      guardian: input.guardian.slice(0, 80),
      updated_at: new Date().toISOString(),
    })
    .eq("id", ctx.profile.profile_id)
    .eq("role", "student");
  if (error) return { ok: false, error: error.message };
  revalidatePath("/dashboard/profile");
  return { ok: true };
}
