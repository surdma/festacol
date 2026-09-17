"use server";

import { revalidatePath } from "next/cache";
import type { ActionResult } from "@/app/actions/student";
import { currentStudent } from "@/lib/auth/current-student";
import { normalizeExamToken } from "@/lib/exam-links";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export type ExamOnboardingNext = "configure" | "exam" | "dashboard";

export interface ExamEntryContext {
  id: string;
  title: string;
  mode: string;
  status: string;
  startsAt: number | null;
  endsAt: number | null;
}

export type ExamEntryContextResult =
  | { ok: true; exam: ExamEntryContext }
  | { ok: false; error: string };

export interface ExamOnboardingLevel {
  id: string;
  name: string;
  ordinal: number;
}

export interface ExamOnboardingClass {
  id: string;
  levelId: string;
  levelName: string;
  levelOrdinal: number;
  track: string;
  arm: string;
}

export interface ExamOnboardingEnrollment {
  classId: string;
  levelId: string;
  levelName: string;
  levelOrdinal: number;
  track: string;
  arm: string;
}

export interface ExamOnboardingData {
  exam: ExamEntryContext;
  levels: ExamOnboardingLevel[];
  classes: ExamOnboardingClass[];
  enrollment: ExamOnboardingEnrollment | null;
}

export type ExamOnboardingDataResult =
  | { ok: true; data: ExamOnboardingData }
  | { ok: false; error: string };

export interface CompleteExamOnboardingInput {
  token: string;
  levelId: string;
  classId?: string | null;
  placementConsent: boolean;
}

export interface CompleteExamOnboardingResult extends ActionResult {
  next?: Exclude<ExamOnboardingNext, "configure">;
}

interface LinkRow {
  session_id: string;
  expires_at: string | null;
}

interface SessionRow {
  id: string;
  title: string;
  mode: string;
  status: string;
  starts_at: number | null;
  ends_at: number | null;
}

interface ClassRow {
  id: string;
  level_id: string;
  track: string;
  arm: string;
}

function accessMessage(reason: string | null | undefined) {
  if (reason === "not_started") return "This examination has not started yet.";
  if (reason === "ended") return "This examination has closed.";
  if (reason === "not_open") return "This examination is not open.";
  if (reason === "not_qualified") return "Your confirmed class level does not qualify for this examination.";
  if (reason === "not_eligible") return "This examination is not assigned to your confirmed class.";
  return "This examination is unavailable for your account.";
}

async function loadExamEntryContext(rawToken: string): Promise<ExamEntryContextResult> {
  const token = normalizeExamToken(rawToken);
  if (!token) return { ok: false, error: "This exam link is missing or malformed." };

  const admin = createSupabaseAdminClient();
  const { data: link, error: linkError } = await admin
    .from("exam_session_links")
    .select("session_id,expires_at")
    .eq("token", token)
    .eq("active", true)
    .maybeSingle();
  if (linkError || !link) return { ok: false, error: "This exam link is invalid or unavailable." };

  const linkRow = link as LinkRow;
  if (linkRow.expires_at && new Date(linkRow.expires_at).getTime() <= Date.now()) {
    return { ok: false, error: "This exam link has expired." };
  }

  const { data: session, error: sessionError } = await admin
    .from("exam_sessions")
    .select("id,title,mode,status,starts_at,ends_at")
    .eq("id", String(linkRow.session_id).toUpperCase())
    .maybeSingle();
  if (sessionError || !session) return { ok: false, error: "This examination is unavailable." };

  const row = session as SessionRow;
  const now = Date.now();
  if (row.status !== "open") return { ok: false, error: "This examination is not open." };
  if (row.starts_at !== null && now < Number(row.starts_at)) {
    return { ok: false, error: "This examination has not started yet." };
  }
  if (row.ends_at !== null && now > Number(row.ends_at)) {
    return { ok: false, error: "This examination has closed." };
  }

  return {
    ok: true,
    exam: {
      id: row.id,
      title: row.title,
      mode: row.mode,
      status: row.status,
      startsAt: row.starts_at === null ? null : Number(row.starts_at),
      endsAt: row.ends_at === null ? null : Number(row.ends_at),
    },
  };
}

async function activeEnrollmentFor(studentId: string) {
  const admin = createSupabaseAdminClient();
  const { data, error } = await admin
    .from("class_enrollments")
    .select("id,class_id,enrolled_at")
    .eq("student_id", studentId)
    .eq("status", "active")
    .is("ended_at", null)
    .order("enrolled_at", { ascending: true })
    .limit(3);
  if (error) throw new Error(error.message);
  const rows = (data ?? []) as { id: string; class_id: string; enrolled_at: string }[];
  if (rows.length > 1) {
    throw new Error("Your account has more than one active class. Ask a staff member to correct the enrollment before continuing.");
  }
  return rows[0] ?? null;
}

async function claimInitialClass(studentId: string, levelId: string, classId: string) {
  const admin = createSupabaseAdminClient();
  const before = await activeEnrollmentFor(studentId);
  if (before) {
    if (before.class_id !== classId) {
      throw new Error("Your class is already confirmed. A staff member must make any class change.");
    }
    return;
  }

  const { data: selectedClass, error: classError } = await admin
    .from("classes")
    .select("id,level_id,status")
    .eq("id", classId)
    .eq("status", "active")
    .maybeSingle();
  if (classError || !selectedClass) throw new Error("Choose an active class.");
  if ((selectedClass as { level_id: string }).level_id !== levelId) {
    throw new Error("The selected class does not belong to the selected level.");
  }

  const { error: writeError } = await admin.from("class_enrollments").upsert(
    {
      student_id: studentId,
      class_id: classId,
      status: "active",
      ended_at: null,
    },
    { onConflict: "student_id,class_id" },
  );
  if (writeError) throw new Error(writeError.message);

  // Converge concurrent first-time confirmations to one persisted enrollment.
  // The earliest active row wins; later concurrent rows are ended immediately.
  const { data: activeRows, error: activeError } = await admin
    .from("class_enrollments")
    .select("id,class_id,enrolled_at")
    .eq("student_id", studentId)
    .eq("status", "active")
    .is("ended_at", null)
    .order("enrolled_at", { ascending: true })
    .order("id", { ascending: true })
    .limit(10);
  if (activeError) throw new Error(activeError.message);
  const rows = (activeRows ?? []) as { id: string; class_id: string; enrolled_at: string }[];
  const winner = rows[0];
  if (!winner) throw new Error("Your class confirmation could not be saved.");
  if (rows.length > 1) {
    const loserIds = rows.slice(1).map((row) => row.id);
    const { error: cleanupError } = await admin
      .from("class_enrollments")
      .update({ status: "ended", ended_at: new Date().toISOString() })
      .in("id", loserIds);
    if (cleanupError) throw new Error(cleanupError.message);
  }
  if (winner.class_id !== classId) {
    throw new Error("Another class confirmation was saved first. Reload to continue with the confirmed class.");
  }
}

async function normalExamOutcome(sessionId: string): Promise<CompleteExamOnboardingResult> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.rpc("my_exam_access", { p_session_id: sessionId });
  if (error) return { ok: false, error: "Exam eligibility could not be verified.", next: "dashboard" };
  const access = (Array.isArray(data) ? data[0] : data) as {
    eligible?: boolean;
    denial_reason?: string | null;
  } | null;
  if (!access?.eligible) {
    return { ok: false, error: accessMessage(access?.denial_reason), next: "dashboard" };
  }
  return { ok: true, next: "exam" };
}

export async function getExamEntryContextAction(token: string): Promise<ExamEntryContextResult> {
  return loadExamEntryContext(token);
}

export async function getExamOnboardingDataAction(token: string): Promise<ExamOnboardingDataResult> {
  const ctx = await currentStudent();
  if (!ctx) return { ok: false, error: "Sign in with your student credentials to continue." };
  const entry = await loadExamEntryContext(token);
  if (!entry.ok) return entry;

  const admin = createSupabaseAdminClient();
  const [{ data: levels, error: levelError }, { data: classes, error: classError }] = await Promise.all([
    admin.from("academic_levels").select("id,name,ordinal").eq("active", true).order("ordinal"),
    admin.from("classes").select("id,level_id,track,arm").eq("status", "active").order("id"),
  ]);
  if (levelError || classError) return { ok: false, error: "Academic configuration could not be loaded." };

  let enrollmentRow: { class_id: string } | null = null;
  try {
    const current = await activeEnrollmentFor(ctx.profile.profile_id);
    enrollmentRow = current ? { class_id: current.class_id } : null;
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "Enrollment could not be loaded." };
  }

  const levelRows = (levels ?? []) as ExamOnboardingLevel[];
  const levelById = new Map(levelRows.map((level) => [level.id, level]));
  const classRows = ((classes ?? []) as ClassRow[])
    .map((item): ExamOnboardingClass | null => {
      const level = levelById.get(item.level_id);
      if (!level) return null;
      return {
        id: item.id,
        levelId: item.level_id,
        levelName: level.name,
        levelOrdinal: level.ordinal,
        track: item.track,
        arm: item.arm,
      };
    })
    .filter((item): item is ExamOnboardingClass => item !== null);

  const enrolledClass = enrollmentRow
    ? classRows.find((item) => item.id === enrollmentRow.class_id) ?? null
    : null;
  if (enrollmentRow && !enrolledClass) {
    return { ok: false, error: "Your confirmed class is no longer active. Ask a staff member to update your enrollment." };
  }

  return {
    ok: true,
    data: {
      exam: entry.exam,
      levels: levelRows.map((level) => ({ id: level.id, name: level.name, ordinal: level.ordinal })),
      classes: classRows,
      enrollment: enrolledClass
        ? {
            classId: enrolledClass.id,
            levelId: enrolledClass.levelId,
            levelName: enrolledClass.levelName,
            levelOrdinal: enrolledClass.levelOrdinal,
            track: enrolledClass.track,
            arm: enrolledClass.arm,
          }
        : null,
    },
  };
}

export async function completeExamOnboardingAction(
  input: CompleteExamOnboardingInput,
): Promise<CompleteExamOnboardingResult> {
  const ctx = await currentStudent();
  if (!ctx) return { ok: false, error: "Sign in with your student credentials to continue." };
  const entry = await loadExamEntryContext(input.token);
  if (!entry.ok) return entry;

  const admin = createSupabaseAdminClient();
  const { data: level, error: levelError } = await admin
    .from("academic_levels")
    .select("id,name,ordinal")
    .eq("id", input.levelId)
    .eq("active", true)
    .maybeSingle();
  if (levelError || !level) return { ok: false, error: "Choose an active school level." };
  const selectedLevel = level as ExamOnboardingLevel;

  let existing: Awaited<ReturnType<typeof activeEnrollmentFor>>;
  try {
    existing = await activeEnrollmentFor(ctx.profile.profile_id);
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "Enrollment could not be verified." };
  }

  if (existing) {
    const { data: existingClass } = await admin
      .from("classes")
      .select("id,level_id")
      .eq("id", existing.class_id)
      .maybeSingle();
    const row = existingClass as { id: string; level_id: string } | null;
    if (!row) return { ok: false, error: "Your confirmed class is unavailable. Ask a staff member for help." };
    if (input.placementConsent) {
      return { ok: false, error: "Placement is only for SS1 students who do not yet have a confirmed class." };
    }
    if (row.level_id !== selectedLevel.id || input.classId !== row.id) {
      return { ok: false, error: "Your class is already confirmed. A staff member must make any class change." };
    }
    if (entry.exam.mode === "qualifier") return { ok: true, next: "dashboard" };
    return normalExamOutcome(entry.exam.id);
  }

  if (input.placementConsent) {
    if (entry.exam.mode !== "qualifier") {
      return { ok: false, error: "This link is not a placement examination." };
    }
    if (selectedLevel.name !== "SS1") {
      return { ok: false, error: "Placement is available only to incoming SS1 students." };
    }
    if (input.classId) {
      return { ok: false, error: "Do not choose a class when you are asking the placement exam to determine your SS1 track." };
    }

    const { data: existingAccess, error: accessReadError } = await admin
      .from("exam_student_access")
      .select("decision")
      .eq("session_id", entry.exam.id)
      .eq("student_id", ctx.profile.profile_id)
      .maybeSingle();
    if (accessReadError) return { ok: false, error: "Placement access could not be verified." };
    if ((existingAccess as { decision?: string } | null)?.decision === "deny") {
      return { ok: false, error: "This placement examination is not assigned to you." };
    }

    const { error: accessWriteError } = await admin.from("exam_student_access").upsert(
      {
        session_id: entry.exam.id,
        student_id: ctx.profile.profile_id,
        decision: "allow",
        max_attempts_override: 1,
        granted_by_id: null,
        reason: "SS1 placement consent through candidate onboarding",
      },
      { onConflict: "session_id,student_id" },
    );
    if (accessWriteError) return { ok: false, error: "Placement access could not be saved." };

    const { data: access, error: accessError } = await ctx.supabase.rpc("my_exam_access", {
      p_session_id: entry.exam.id,
    });
    if (accessError) return { ok: false, error: "Placement eligibility could not be verified." };
    const accessRow = (Array.isArray(access) ? access[0] : access) as {
      eligible?: boolean;
      allowed_attempts?: number;
      used_attempts?: number;
      active_attempt_id?: string | null;
      denial_reason?: string | null;
    } | null;
    if (!accessRow?.eligible) return { ok: false, error: accessMessage(accessRow?.denial_reason) };
    const allowed = Number(accessRow.allowed_attempts ?? 0);
    const used = Number(accessRow.used_attempts ?? 0);
    if (!accessRow.active_attempt_id && used >= allowed) {
      return {
        ok: false,
        next: "dashboard",
        error: "You have already used your placement attempt. A teacher or administrator must grant a retake before you can write it again.",
      };
    }

    revalidatePath("/exam");
    return { ok: true, next: "exam" };
  }

  if (!input.classId) return { ok: false, error: "Choose the class you currently belong to." };
  try {
    await claimInitialClass(ctx.profile.profile_id, selectedLevel.id, input.classId);
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "Your class could not be confirmed." };
  }

  revalidatePath("/dashboard");
  revalidatePath("/exam");
  if (entry.exam.mode === "qualifier") return { ok: true, next: "dashboard" };
  return normalExamOutcome(entry.exam.id);
}
