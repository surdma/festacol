"use server";

import { revalidatePath } from "next/cache";
import type { ActionResult } from "@/app/actions/student";
import { signInLinkedStudent } from "@/app/actions/student";
import { currentStudent } from "@/lib/auth/current-student";
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
// a retry path into the same exam. `not-qualified` means the student's level
// ordinal sits below the exam's minimum target level (e.g. SS1 student opening
// an SS2-targeted exam) — the client shows the blocked copy with no retry into
// the same exam.
export type ExamEntryNext =
  | "entered"
  | "placement-first"
  | "not-eligible"
  | "not-qualified";

export interface ExamEntryResult extends ActionResult {
  next?: ExamEntryNext;
  examId?: string;
  /**
   * Short student ID (FST-XXXXX) surfaced so the entry form can show the
   * write-this-down reveal. Present for known members and newly provisioned
   * accounts alike; null only when no member was resolved.
   */
  studentNumber?: string | null;
  /** True only when this call provisioned a brand-new student account. */
  provisioned?: boolean;
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
    provisioned: boolean,
  ): Promise<ExamEntryResult> {
    const result = await signInLinkedStudent(member);
    if (!result.ok) return result;
    revalidatePath("/dashboard/exam");
    return {
      ok: true,
      next: "entered",
      examId,
      studentNumber: member.studentNumber,
      provisioned,
    };
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

  // Level gate (mirrors the `not_qualified` branch of `my_exam_access` /
  // `allocate_my_exam_attempt` so the entry hint matches enforcement).
  // Resolves the student's level ordinal from the active enrollment
  // (unassigned = ordinal 1, the SS1 holding pool) against the exam's minimum
  // target level ordinal across class + offering targets. Qualifier exams
  // carry no class targets, so the NULL minimum leaves them open.
  // Returns a user-facing blocked message, or null when qualified.
  async function levelBlock(studentId: string): Promise<string | null> {
    const [{ data: enrollments }, { data: classTargets }, { data: offeringTargets }] =
      await Promise.all([
        admin
          .from("class_enrollments")
          .select("class_id")
          .eq("student_id", studentId)
          .eq("status", "active")
          .is("ended_at", null),
        admin.from("exam_class_targets").select("class_id").eq("session_id", examId),
        admin.from("exam_offering_targets").select("offering_id").eq("session_id", examId),
      ]);
    const enrollmentClassIds = ((enrollments ?? []) as { class_id: string }[]).map(
      (row) => row.class_id,
    );
    const directClassIds = ((classTargets ?? []) as { class_id: string }[]).map(
      (row) => row.class_id,
    );
    const offeringIds = ((offeringTargets ?? []) as { offering_id: string }[]).map(
      (row) => row.offering_id,
    );
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
    const targetClassIds = [...new Set([...directClassIds, ...offeringClassIds])];
    if (!targetClassIds.length) return null;

    const [{ data: studentClasses }, { data: targetClasses }] = await Promise.all([
      enrollmentClassIds.length
        ? admin.from("classes").select("level_id").in("id", enrollmentClassIds)
        : Promise.resolve({ data: [] as { level_id: string }[] }),
      admin.from("classes").select("id,level_id").in("id", targetClassIds),
    ]);
    const levelIds = [
      ...new Set([
        ...((studentClasses ?? []) as { level_id: string }[]).map((row) => row.level_id),
        ...((targetClasses ?? []) as { level_id: string }[]).map((row) => row.level_id),
      ]),
    ];
    if (!levelIds.length) return null;
    const { data: levels } = await admin
      .from("academic_levels")
      .select("id,name,ordinal")
      .in("id", levelIds);
    const ordinalById = new Map(
      ((levels ?? []) as { id: string; name: string; ordinal: number }[]).map(
        (row) => [row.id, row] as const,
      ),
    );
    const studentOrdinal = Math.max(
      1,
      ...((studentClasses ?? []) as { level_id: string }[]).map(
        (row) => ordinalById.get(row.level_id)?.ordinal ?? 1,
      ),
    );
    const targetRows = ((targetClasses ?? []) as { id: string; level_id: string }[]).map(
      (row) => ordinalById.get(row.level_id),
    );
    if (targetRows.some((row) => !row)) return null;
    const minTarget = Math.min(...targetRows.map((row) => row!.ordinal));
    if (studentOrdinal >= minTarget) return null;
    const studentName =
      ordinalById.get(
        ((studentClasses ?? []) as { level_id: string }[])[0]?.level_id ?? "",
      )?.name ?? "SS1";
    const targetName =
      [...ordinalById.values()].find((row) => row.ordinal === minTarget)?.name ??
      "a higher level";
    return (
      `This examination is for ${targetName} students. Your current level ` +
      `(${enrollmentClassIds.length ? studentName : "unassigned"}) does not qualify. ` +
      `Ask your school about a placement exam.`
    );
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
    // Level gate second: SS1-enrolled students opening SS2-targeted exams are
    // blocked here with the same not-qualified outcome the RPC enforces at
    // my_exam_access / allocate_my_exam_attempt.
    if (!isPlacement) {
      const blocked = await levelBlock(member.memberId);
      if (blocked) {
        return { ok: false, error: blocked, next: "not-qualified" };
      }
    }
    if (isPlacement) {
      const grantError = await grantOpenAccess(member.memberId);
      if (grantError)
        return { ok: false, error: grantError, next: "not-eligible" };
    }
    return await signInMember(member, false);
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
    // Freshly provisioned students join the exam's single targeted class (or
    // stay unassigned for placement exams), so the level gate below trivially
    // passes — it runs anyway so entry can never admit what allocation rejects.
    if (!isPlacement) {
      const blocked = await levelBlock(member.memberId);
      if (blocked) {
        return { ok: false, error: blocked, next: "not-qualified" };
      }
    }
    const grantError = await grantOpenAccess(member.memberId);
    if (grantError)
      return { ok: false, error: grantError, next: "not-eligible" };
    return await signInMember(member, true);
  }
}

// ---------------------------------------------------------------- wizard data

export interface ExamWizardLevel {
  id: string;
  name: string;
  ordinal: number;
}

export interface ExamWizardClass {
  id: string;
  levelId: string;
  levelName: string;
  levelOrdinal: number;
  track: string;
  arm: string;
}

export interface ExamWizardExam {
  id: string;
  title: string;
  mode: string;
  status: string;
}

export interface ExamWizardData {
  exam: ExamWizardExam;
  levels: ExamWizardLevel[];
  classes: ExamWizardClass[];
  /** Active enrollment of the calling student, or null when unassigned. */
  enrolledClassId: string | null;
}

export type ExamWizardDataResult =
  | { ok: true; data: ExamWizardData }
  | { ok: false; error: string };

// Buttons-only pre-exam wizard data: level buttons (SS1/SS2/SS3) → arm/class
// buttons → exam-session confirm. Student-scoped (server re-checks the student
// session; staff sessions are refused so a staff account can never walk the
// exam path), read-only, and resolved from the same link token as entry.
// Every wizard transition is re-validated downstream by allocate_my_exam_attempt
// (targeting + not-qualified level gate + attempt limits).
export async function getExamEntryWizardDataAction(
  token: string,
): Promise<ExamWizardDataResult> {
  const ctx = await currentStudent();
  if (!ctx) return { ok: false, error: "Sign in required." };

  const clean = normalizeExamToken(token);
  if (!clean) return { ok: false, error: "This exam link is invalid." };

  const admin = createSupabaseAdminClient();
  const { data: link } = await admin
    .from("exam_session_links")
    .select("session_id,active,expires_at")
    .eq("token", clean)
    .eq("active", true)
    .maybeSingle();
  const row = link as {
    session_id: string;
    expires_at?: string | null;
  } | null;
  if (!row) return { ok: false, error: "This exam link is invalid." };
  if (
    row.expires_at &&
    new Date(String(row.expires_at)).getTime() <= Date.now()
  ) {
    return { ok: false, error: "This exam link has expired." };
  }

  const examId = String(row.session_id).toUpperCase();
  const [{ data: session }, { data: levels }, { data: classes }] =
    await Promise.all([
      admin
        .from("exam_sessions")
        .select("id,title,mode,status")
        .eq("id", examId)
        .maybeSingle(),
      admin
        .from("academic_levels")
        .select("id,name,ordinal")
        .eq("active", true)
        .order("ordinal"),
      admin
        .from("classes")
        .select("id,level_id,track,arm")
        .eq("status", "active")
        .limit(200),
    ]);
  const exam = session as {
    id: string;
    title: string;
    mode: string;
    status: string;
  } | null;
  if (!exam) return { ok: false, error: "Exam not found." };

  // Caller enrollment: unassigned (zero active class_enrollments) is a first-
  // class state — the wizard labels it the SS1 holding pool and, for
  // no-account qualifiers, prefills the track from the placement auto-suggest
  // (see getUserDetailAction placementSuggestion). Never auto-promotes.
  const { data: enrollment } = await admin
    .from("class_enrollments")
    .select("class_id")
    .eq("student_id", ctx.profile.profile_id)
    .eq("status", "active")
    .is("ended_at", null)
    .limit(1)
    .maybeSingle();

  const classRows = ((classes ?? []) as {
    id: string;
    level_id: string;
    track: string;
    arm: string;
  }[]);
  const levelById = new Map(
    ((levels ?? []) as ExamWizardLevel[]).map((level) => [level.id, level]),
  );
  const resolvedClasses: ExamWizardClass[] = [];
  for (const item of classRows) {
    const level = levelById.get(item.level_id);
    if (!level) continue;
    resolvedClasses.push({
      id: item.id,
      levelId: item.level_id,
      levelName: level.name,
      levelOrdinal: level.ordinal,
      track: item.track,
      arm: item.arm,
    });
  }
  return {
    ok: true,
    data: {
      exam: {
        id: exam.id,
        title: exam.title,
        mode: exam.mode,
        status: exam.status,
      },
      levels: ((levels ?? []) as ExamWizardLevel[]).map((level) => ({
        id: level.id,
        name: level.name,
        ordinal: level.ordinal,
      })),
      classes: resolvedClasses,
      enrolledClassId:
        (enrollment as { class_id?: string } | null)?.class_id ?? null,
    },
  };
}
