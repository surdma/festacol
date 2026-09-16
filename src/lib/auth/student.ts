import { randomUUID } from "node:crypto";
import {
  candidateCredentials,
  candidateHashFor,
  studentHashFor,
} from "@/lib/assessment";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export interface ExistingStudentIdentity {
  memberId: string;
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
  const clean = (value: string) =>
    value
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, ".")
      .replace(/^\.+|\.+$/g, "")
      .slice(0, 40) || "student";
  return `${clean(firstName)}.${clean(lastName)}.student@festacol.local`;
}

export function studentEmailForMember(memberId: string): string {
  return `student.${memberId.toLowerCase()}@festacol.local`;
}

export function studentPasswordForMember(memberId: string): string {
  return `fst-v2:${memberId}`;
}

// Resolve one EXISTING active roster member. This function never inserts a
// student domain row. Duplicate normalized names are rejected by the RPC.
export async function resolveExistingStudentIdentity(
  firstName: string,
  lastName: string,
): Promise<ExistingStudentIdentity> {
  const id = candidateCredentials(firstName, lastName);
  const admin = createSupabaseAdminClient();
  const { data, error } = await admin.rpc("resolve_student_member_by_name", {
    p_first_name: nameKey(id.firstName),
    p_last_name: nameKey(id.lastName),
  });
  if (error) {
    if (error.message.includes("student_identity_ambiguous")) {
      throw new Error(
        "More than one student has those names. Contact your school administrator to use a unique student identity.",
      );
    }
    throw new Error(error.message);
  }
  const matches = (data ?? []) as {
    member_id: string;
    auth_user_id: string | null;
    first_name: string;
    last_name: string;
    student_number: string | null;
  }[];
  if (matches.length === 0)
    throw new Error(
      "No active student record matches those names. Contact your school administrator.",
    );
  if (matches.length !== 1)
    throw new Error(
      "More than one student has those names. Contact your school administrator to use a unique student identity.",
    );

  const rosterMember = matches[0];
  const { data: member, error: memberError } = await admin
    .from("school_members")
    .select("phone,guardian")
    .eq("id", rosterMember.member_id)
    .eq("role", "student")
    .maybeSingle();
  if (memberError) throw new Error(memberError.message);
  if (!member)
    throw new Error(
      "Student record is incomplete. Contact your school administrator.",
    );
  const student = member as { phone: string | null; guardian: string | null };
  return {
    memberId: rosterMember.member_id,
    authUserId: rosterMember.auth_user_id,
    firstName: rosterMember.first_name,
    lastName: rosterMember.last_name,
    fullName: `${rosterMember.first_name} ${rosterMember.last_name}`.trim(),
    studentNumber: rosterMember.student_number,
    phone: student.phone ?? "",
    guardian: student.guardian ?? "",
  };
}

export async function claimStudentAuthIdentity(
  memberId: string,
  authUserId: string,
): Promise<boolean> {
  const admin = createSupabaseAdminClient();
  const { data, error } = await admin.rpc("claim_student_auth_identity", {
    p_member_id: memberId,
    p_auth_user_id: authUserId,
  });
  if (error) throw new Error(error.message);
  return data === true;
}

export const STUDENT_ID_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
export const STUDENT_ID_PREFIX = "FST-";
export const STUDENT_ID_CONFLICT_ERROR = "Student ID is already in use.";

export function normalizeStudentNumber(value: string): string {
  return value.trim().toUpperCase();
}

export const SPLIT_NAME_ERROR = "Enter the student's first and last name.";
export const STUDENT_ID_FORMAT_ERROR =
  "Enter a valid Student ID (for example FST-XXXXX).";

export function collapseName(value: string): string {
  return value.trim().replace(/\s+/g, " ");
}

export interface SplitStudentNameInput {
  fullName?: string;
  firstName?: string;
  lastName?: string;
}

// Split-name hygiene for roster writes. Prefers explicit first/last name;
// falls back to splitting a single full-name field. Single-token names are
// rejected so a mononym can never collapse first and last name together.
export function resolveStudentNames(
  input: SplitStudentNameInput,
): { firstName: string; lastName: string } | { error: string } {
  const hasSplit =
    input.firstName !== undefined || input.lastName !== undefined;
  if (hasSplit) {
    const firstName = collapseName(input.firstName ?? "");
    const lastName = collapseName(input.lastName ?? "");
    if (firstName.length < 2 || lastName.length < 2)
      return { error: SPLIT_NAME_ERROR };
    return { firstName, lastName };
  }
  const parts = collapseName(input.fullName ?? "")
    .split(" ")
    .filter(Boolean);
  if (parts.length < 2) return { error: SPLIT_NAME_ERROR };
  const firstName = parts[0];
  const lastName = parts.slice(1).join(" ");
  if (firstName.length < 2 || lastName.length < 2)
    return { error: SPLIT_NAME_ERROR };
  return { firstName, lastName };
}

export function generateStudentNumber(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(5));
  let suffix = "";
  for (const byte of bytes)
    suffix += STUDENT_ID_ALPHABET[byte % STUDENT_ID_ALPHABET.length];
  return `${STUDENT_ID_PREFIX}${suffix}`;
}

// First + last name are the student credential. When no active roster member
// matches, provision a brand-new student account (member row + Auth user +
// identity claim) so the name itself becomes the login. Callers must only
// invoke this for the "no match" case — never for ambiguous names — and only
// after their own context checks (exam link validity, staff-session guard).
// Provisioned students start class-less; exam entry or staff assignment adds
// the class afterwards. Student numbers use the short editable FST-XXXXX
// form; legacy STD- rows remain valid and are never rewritten.
export async function provisionNewStudentAccount(
  firstName: string,
  lastName: string,
): Promise<ExistingStudentIdentity> {
  const id = candidateCredentials(firstName, lastName);
  const cleanFirst = id.firstName;
  const cleanLast = id.lastName;
  const admin = createSupabaseAdminClient();
  const memberId = randomUUID();

  // Generate-and-retry so a random FST-XXXXX collision never surfaces as a
  // generic enrollment failure. Three attempts is ample for a 32^5 space.
  let studentNumber = "";
  let inserted = false;
  let lastError = "";
  for (let attempt = 0; attempt < 3; attempt += 1) {
    studentNumber = generateStudentNumber();
    const { error: insertError } = await admin.from("school_members").insert({
      id: memberId,
      role: "student",
      status: "active",
      first_name: cleanFirst,
      last_name: cleanLast,
      student_number: studentNumber,
      promotion_status: "on-track",
      updated_at: new Date().toISOString(),
    });
    if (!insertError) {
      inserted = true;
      break;
    }
    lastError = insertError.message;
    const conflict =
      (insertError as { code?: string }).code === "23505" ||
      /duplicate|already exists|student_number/i.test(insertError.message);
    if (!conflict) throw new Error("Enrollment failed. Try again.");
  }
  if (!inserted) {
    if (/duplicate|already exists|student_number/i.test(lastError)) {
      // Extremely unlikely triple collision — surface a retryable message.
      throw new Error("Enrollment failed. Try again.");
    }
    throw new Error("Enrollment failed. Try again.");
  }

  const email = studentEmailForMember(memberId);
  const password = studentPasswordForMember(memberId);
  const { data: created, error: createError } =
    await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { full_name: `${cleanFirst} ${cleanLast}`.trim() },
      app_metadata: { role: "student", school_member_id: memberId },
    });
  if (createError || !created.user) {
    await admin.from("school_members").delete().eq("id", memberId);
    throw new Error("Student login could not be created.");
  }
  const claimed = await claimStudentAuthIdentity(
    memberId,
    created.user.id,
  ).catch(() => false);
  if (!claimed) {
    await admin.auth.admin.deleteUser(created.user.id);
    await admin.from("school_members").delete().eq("id", memberId);
    throw new Error("This student record is already linked to another login.");
  }

  return {
    memberId,
    authUserId: created.user.id,
    firstName: cleanFirst,
    lastName: cleanLast,
    fullName: `${cleanFirst} ${cleanLast}`.trim(),
    studentNumber,
    phone: "",
    guardian: "",
  };
}

// Used only to recover an Auth account created by the legacy name-hash wrapper.
export async function legacyStudentCredential(
  firstName: string,
  lastName: string,
) {
  const id = candidateCredentials(firstName, lastName);
  const studentHash = await studentHashFor(id.firstName, id.lastName);
  return {
    email: studentEmailFor(id.firstName, id.lastName),
    password: `fst:${studentHash}`,
    studentHash,
  };
}

export async function candidateHashForSession(
  sessionId: string,
  firstName: string,
  lastName: string,
) {
  return candidateHashFor(sessionId, firstName, lastName);
}
