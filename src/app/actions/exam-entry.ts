"use server";

import { revalidatePath } from "next/cache";
import type { ActionResult } from "@/app/actions/student";
import { signInLinkedStudent } from "@/app/actions/student";
import {
  provisionNewStudentAccount,
  resolveExistingStudentIdentity,
} from "@/lib/auth/student";
import { normalizeExamToken } from "@/lib/exam-links";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { studentLoginSchema } from "@/lib/validation";

function cleanName(value: string) {
  return value.trim().replace(/\s+/g, " ");
}

// Machine-readable entry outcome for the exam-link form. `entered` means the
// student session is ready and the client should route to the exam surface.
// `placement-first` means this class exam cannot admit the unknown name on
// its own (zero or several targeted classes) — the client should direct the
// candidate to a placement exam first. `not-eligible` means an explicit deny
// grant blocks this student — deny always wins and the client must not offer
// a retry path into the same exam.
export type ExamEntryNext = "entered" | "placement-first" | "not-eligible";

export interface ExamEntryResult extends ActionResult {
  next?: ExamEntryNext;
  examId?: string;
}

// Name-based exam entry. Known roster students sign straight in (placement
// exams also get an explicit grant); unknown names are provisioned as new
// student accounts. Placement exams admit anyone; class exams admit unknown
// names only when the exam config points at exactly one class, in which case
// the exam config enrolls them there — otherwise the school must register
// them first. Class-exam eligibility itself is always rechecked server-side
// on the exam page, so entry never bypasses class gating.
export async function enterExamByNameAction(input: {
  token: string;
  firstName: string;
  lastName: string;
}): Promise<ExamEntryResult> {
  const parsed = studentLoginSchema.safeParse({
    firstName: input.firstName,
    lastName: input.lastName,
  });
  if (!parsed.success)
    return { ok: false, error: "Enter first and last name." };
  const firstName = cleanName(parsed.data.firstName);
  const lastName = cleanName(parsed.data.lastName);

  const token = normalizeExamToken(input.token);
  if (!token) return { ok: false, error: "This exam link is invalid." };

  // Never let a staff session silently become a student session through an
  // exam link. Staff must sign out first.
  const sessionSupabase = await createSupabaseServerClient();
  const { data: sessionUser } = await sessionSupabase.auth.getUser();
  if (sessionUser.user) {
    const { data: currentMember } = await sessionSupabase
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
          "You are signed in with a staff account. Sign out first, then enter the exam with a student account.",
      };
    }
  }

  const admin = createSupabaseAdminClient();
  const { data: link, error: linkError } = await admin
    .from("exam_session_links")
    .select("session_id,active,expires_at")
    .eq("token", token)
    .eq("active", true)
    .maybeSingle();
  if (linkError || !link)
    return { ok: false, error: "This exam link is invalid." };
  const row = link as { session_id: string; expires_at?: string | null };
  if (
    row.expires_at &&
    new Date(String(row.expires_at)).getTime() <= Date.now()
  ) {
    return { ok: false, error: "This exam link has expired." };
  }

  const examId = String(row.session_id).toUpperCase();
  const { data: session, error: sessionError } = await admin
    .from("exam_sessions")
    .select("id,status,mode")
    .eq("id", examId)
    .maybeSingle();
  if (sessionError || !session) return { ok: false, error: "Exam not found." };
  const exam = session as { id: string; status: string; mode: string };
  if (exam.status !== "open")
    return { ok: false, error: "This examination is not open." };
  const isPlacement = exam.mode === "qualifier";

  async function grantOpenAccess(studentId: string): Promise<string | null> {
    const { data: existing } = await admin
      .from("exam_student_access")
      .select("decision")
      .eq("session_id", examId)
      .eq("student_id", studentId)
      .maybeSingle();
    if ((existing as { decision?: string } | null)?.decision === "deny") {
      return "This examination is not assigned to you.";
    }
    const { error } = await admin.from("exam_student_access").upsert(
      {
        session_id: examId,
        student_id: studentId,
        decision: "allow",
        granted_by_id: null,
        reason: isPlacement
          ? "Open placement entry through exam link"
          : "Class entry through exam link",
      },
      { onConflict: "session_id,student_id" },
    );
    if (error) return "Exam access could not be granted.";
    return null;
  }

  // The exam config enrolls unknown students when it points at exactly one
  // class (direct class targets plus classes behind offering targets).
  // Zero or several classes means the exam cannot decide — the school must
  // register the student first.
  async function singleTargetClass(): Promise<string | null> {
    const { data: classTargets } = await admin
      .from("exam_class_targets")
      .select("class_id")
      .eq("session_id", examId);
    const directIds = ((classTargets ?? []) as { class_id: string }[]).map(
      (row) => row.class_id,
    );
    const { data: offeringTargets } = await admin
      .from("exam_offering_targets")
      .select("offering_id")
      .eq("session_id", examId);
    const offeringIds = (
      (offeringTargets ?? []) as { offering_id: string }[]
    ).map((row) => row.offering_id);
    let offeringClassIds: string[] = [];
    if (offeringIds.length) {
      const { data: offerings } = await admin
        .from("class_subject_offerings")
        .select("class_id")
        .in("id", offeringIds);
      offeringClassIds = ((offerings ?? []) as { class_id: string }[]).map(
        (row) => row.class_id,
      );
    }
    const distinct = [...new Set([...directIds, ...offeringClassIds])];
    return distinct.length === 1 ? distinct[0] : null;
  }

  async function enrollInClass(
    studentId: string,
    classId: string,
  ): Promise<string | null> {
    const { error } = await admin.from("class_enrollments").upsert(
      {
        student_id: studentId,
        class_id: classId,
        status: "active",
        ended_at: null,
      },
      { onConflict: "student_id,class_id" },
    );
    if (error) return "Class enrollment failed. Try again.";
    return null;
  }

  async function signInMember(
    member: Awaited<ReturnType<typeof resolveExistingStudentIdentity>>,
  ): Promise<ExamEntryResult> {
    const result = await signInLinkedStudent(member);
    if (!result.ok) return result;
    revalidatePath("/dashboard/exam");
    return { ok: true, next: "entered", examId };
  }

  async function explicitDeny(studentId: string): Promise<boolean> {
    const { data } = await admin
      .from("exam_student_access")
      .select("decision")
      .eq("session_id", examId)
      .eq("student_id", studentId)
      .maybeSingle();
    return (data as { decision?: string } | null)?.decision === "deny";
  }

  try {
    const member = await resolveExistingStudentIdentity(firstName, lastName);
    // Deny always wins — even for known roster students on class exams that
    // otherwise rely on my_exam_access at the exam surface.
    if (await explicitDeny(member.memberId)) {
      return {
        ok: false,
        error: "This examination is not assigned to you.",
        next: "not-eligible",
      };
    }
    if (isPlacement) {
      const grantError = await grantOpenAccess(member.memberId);
      if (grantError)
        return { ok: false, error: grantError, next: "not-eligible" };
    }
    return await signInMember(member);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Sign-in failed.";
    if (!message.startsWith("No active student record matches"))
      return { ok: false, error: message };

    // Unknown name: provision the account, then let the exam config finish
    // the profile — placement students start class-less, class-exam students
    // join the exam's single targeted class.
    let classId: string | null = null;
    if (!isPlacement) {
      classId = await singleTargetClass();
      if (!classId) {
        return {
          ok: false,
          error:
            "No student record matches those names and this exam covers several classes. Ask your school to register you first, or start with a placement exam.",
          next: "placement-first",
        };
      }
    }
    let member: Awaited<ReturnType<typeof resolveExistingStudentIdentity>>;
    try {
      member = await provisionNewStudentAccount(firstName, lastName);
    } catch (provisionError) {
      return {
        ok: false,
        error:
          provisionError instanceof Error
            ? provisionError.message
            : "Sign-in failed.",
      };
    }
    if (classId) {
      const enrollError = await enrollInClass(member.memberId, classId);
      if (enrollError) return { ok: false, error: enrollError };
    }
    const grantError = await grantOpenAccess(member.memberId);
    if (grantError)
      return { ok: false, error: grantError, next: "not-eligible" };
    return await signInMember(member);
  }
}
