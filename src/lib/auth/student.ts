import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { candidateHashFor, candidateCredentials, studentHashFor } from "@/lib/assessment";

export interface ExistingStudentIdentity {
  profileId: string;
  authUserId: string | null;
  firstName: string;
  lastName: string;
  fullName: string;
  email: string;
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
  // Student UX is still name-based, so this credential is intentionally an
  // internal Auth wrapper rather than a user-known secret. Authorization is
  // enforced by the linked academic profile and exam eligibility relations.
  return `fst-v2:${profileId}`;
}

// Resolve an EXISTING roster student. This function never inserts a student.
// Duplicate normalized names are rejected instead of being guessed.
export async function resolveExistingStudentIdentity(firstName: string, lastName: string): Promise<ExistingStudentIdentity> {
  const id = candidateCredentials(firstName, lastName);
  const admin = createSupabaseAdminClient();
  const { data, error } = await admin
    .from("academic_profiles")
    .select("id,auth_user_id,first_name,last_name,full_name,email")
    .eq("role", "student")
    .eq("status", "active")
    .eq("first_name_key", nameKey(id.firstName))
    .eq("last_name_key", nameKey(id.lastName))
    .limit(2);
  if (error) throw new Error(error.message);
  const matches = (data ?? []) as {
    id: string;
    auth_user_id: string | null;
    first_name: string;
    last_name: string;
    full_name: string;
    email: string;
  }[];
  if (matches.length === 0) throw new Error("No active student record matches those names. Contact your school administrator.");
  if (matches.length !== 1) throw new Error("More than one student has those names. Contact your school administrator to use a unique student identity.");

  const profile = matches[0];
  const { data: student, error: studentError } = await admin
    .from("student_academic_profiles")
    .select("student_number,phone,guardian")
    .eq("profile_id", profile.id)
    .maybeSingle();
  if (studentError) throw new Error(studentError.message);
  if (!student) throw new Error("Student academic profile is incomplete. Contact your school administrator.");
  const extension = student as { student_number: string | null; phone: string; guardian: string };
  return {
    profileId: profile.id,
    authUserId: profile.auth_user_id,
    firstName: profile.first_name,
    lastName: profile.last_name,
    fullName: profile.full_name,
    email: profile.email,
    studentNumber: extension.student_number,
    phone: extension.phone,
    guardian: extension.guardian,
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
