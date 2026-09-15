import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { candidateCredentials, candidateHashFor, studentHashFor } from "@/lib/assessment";
import type { StudentProfileRow } from "@/types/db";

// Student identity: firstname + lastname (prototype-compatible hashes).
// Runtime store is Supabase (student_profiles via service-role at login;
// RLS-safe reads afterwards). Prisma is migration-only.
// Supabase Auth wrapper: deterministic synthetic email per student so we get
// real sessions + Realtime without changing the credential UX.

export function studentEmailFor(firstName: string, lastName: string): string {
  const clean = (v: string) => v.trim().toLowerCase().replace(/[^a-z0-9]+/g, ".").replace(/^\.+|\.+$/g, "").slice(0, 40) || "student";
  return `${clean(firstName)}.${clean(lastName)}.student@festacol.local`;
}

export async function resolveStudentIdentity(firstName: string, lastName: string) {
  const id = candidateCredentials(firstName, lastName);
  const studentHash = await studentHashFor(id.firstName, id.lastName);
  return { ...id, studentHash, email: studentEmailFor(id.firstName, id.lastName) };
}

export async function ensureStudentProfile(input: { firstName: string; lastName: string; classId?: string; guardian?: string; phone?: string }) {
  const admin = createSupabaseAdminClient();
  const identity = await resolveStudentIdentity(input.firstName, input.lastName);
  const now = Date.now();
  const { data: existing } = await admin.from("student_profiles").select("*").eq("student_hash", identity.studentHash).maybeSingle();
  const row = (existing ?? null) as StudentProfileRow | null;
  if (row) {
    const { data } = await admin
      .from("student_profiles")
      .update({
        full_name: identity.fullName,
        first_name: identity.firstName,
        last_name: identity.lastName,
        guardian: input.guardian ?? row.guardian,
        phone: input.phone ?? row.phone,
        current_class_id: input.classId ?? row.current_class_id,
        updated_at: now,
      })
      .eq("student_hash", identity.studentHash)
      .select()
      .single();
    return { profile: data as StudentProfileRow, studentHash: identity.studentHash };
  }
  const { data } = await admin
    .from("student_profiles")
    .insert({
      student_hash: identity.studentHash,
      candidate_hash: "",
      first_name: identity.firstName,
      last_name: identity.lastName,
      full_name: identity.fullName,
      phone: input.phone ?? "",
      guardian: input.guardian ?? "",
      current_class_id: input.classId ?? "",
      academic_session: "2026/2027",
      updated_at: now,
    })
    .select()
    .single();
  return { profile: data as StudentProfileRow, studentHash: identity.studentHash };
}

export async function candidateHashForSession(sessionId: string, firstName: string, lastName: string) {
  return candidateHashFor(sessionId, firstName, lastName);
}
