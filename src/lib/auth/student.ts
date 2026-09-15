import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { candidateHashFor, candidateCredentials, studentHashFor } from "@/lib/assessment";

export interface ExistingStudentIdentity {
  profileId: string;
  authUserId: string | null;
  firstName: string;
  lastName: string;
  fullName: string;
  studentNumber: string | null;
  phone: string;
  guardian: string;
}

function nameKey(value: string): string {
  return value.trim().replace(/\s+/g, " ").toLowerCase();
}

// Compatibility-only address/password helpers for Auth. They are not academic
// identities and are never used for authorization.
export function studentEmailFor(firstName: string, lastName: string): string {
  const clean = (value: string) => value.trim().toLowerCase().replace(/[^a-z0-9]+/g, ".").replace(/^\.+|\.+$/g, "").slice(0, 40) || "student";
  return `${clean(firstName)}.${clean(lastName)}.student@festacol.local`;
}

export function studentEmailForProfile(profileId: string): string {
  return `student.${profileId.toLowerCase()}@festacol.local`;
}

export function studentPasswordForProfile(profileId: string): string {
  return `fst-v2:${profileId}`;
}

// Resolve an EXISTING roster student. This function never inserts a student.
// Duplicate normalized names are rejected by the service-role RPC.
export async function resolveExistingStudentIdentity(firstName: string, lastName: string): Promise<ExistingStudentIdentity> {
  const id = candidateCredentials(firstName, lastName);
  const admin = createSupabaseAdminClient();
  const { data, error } = await admin.rpc("resolve_student_profile_by_name", {
    p_first_name: nameKey(id.firstName),
    p_last_name: nameKey(id.lastName),
  });
  if (error) {
    if (error.message.includes("student_identity_ambiguous")) {
      throw new Error("More than one student has those names. Contact your school administrator to use a unique student identity.");
    }
    throw new Error(error.message);
  }
  const matches = (data ?? []) as {
    profile_id: string;
    auth_user_id: string | null;
    first_name: string;
    last_name: string;
    student_number: string | null;
  }[];
  if (matches.length === 0) throw new Error("No active student record matches those names. Contact your school administrator.");
  if (matches.length !== 1) throw new Error("More than one student has those names. Contact your school administrator to use a unique student identity.");

  const profile = matches[0];
  const { data: member, error: memberError } = await admin
    .from("school_members")
    .select("phone,guardian")
    .eq("id", profile.profile_id)
    .eq("role", "student")
    .maybeSingle();
  if (memberError) throw new Error(memberError.message);
  if (!member) throw new Error("Student record is incomplete. Contact your school administrator.");
  const student = member as { phone: string | null; guardian: string | null };
  return {
    profileId: profile.profile_id,
    authUserId: profile.auth_user_id,
    firstName: profile.first_name,
    lastName: profile.last_name,
    fullName: `${profile.first_name} ${profile.last_name}`.trim(),
    studentNumber: profile.student_number,
    phone: student.phone ?? "",
    guardian: student.guardian ?? "",
  };
}

export async function claimStudentAuthIdentity(profileId: string, authUserId: string): Promise<boolean> {
  const admin = createSupabaseAdminClient();
  const { data, error } = await admin.rpc("claim_student_auth_identity", {
    p_profile_id: profileId,
    p_auth_user_id: authUserId,
  });
  if (error) throw new Error(error.message);
  return data === true;
}

// Used only to recover an Auth account created by the legacy name-hash wrapper.
export async function legacyStudentCredential(firstName: string, lastName: string) {
  const id = candidateCredentials(firstName, lastName);
  const studentHash = await studentHashFor(id.firstName, id.lastName);
  return {
    email: studentEmailFor(id.firstName, id.lastName),
    password: `fst:${studentHash}`,
    studentHash,
  };
}

export async function candidateHashForSession(sessionId: string, firstName: string, lastName: string) {
  return candidateHashFor(sessionId, firstName, lastName);
}
