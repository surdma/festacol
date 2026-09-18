"use server";

import { randomBytes } from "node:crypto";
import { revalidatePath } from "next/cache";
import type { ActionResult } from "@/app/actions/student";
import { currentStaff } from "@/lib/auth/staff";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import type { AcademicTrack } from "@/types/db";

export interface QualifierExamInput {
  title: string;
  subjectIds: string[];
  studentIds: string[];
  placementTracks: AcademicTrack[];
  durationSeconds: number;
  questionCount: number;
  status: "open" | "draft" | "closed";
  instructions: string;
  cameraRequired: boolean;
  warnAfter: number;
}

const PLACEMENT_TRACKS = new Set<AcademicTrack>(["science", "humanities", "business"]);

function qualifierExamId() {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const bytes = randomBytes(6);
  let suffix = "";
  for (const byte of bytes) suffix += alphabet[byte % alphabet.length];
  return `FST-${suffix}`;
}

export async function createQualifierExamAction(input: QualifierExamInput): Promise<ActionResult & { id?: string }> {
  try {
    const current = await currentStaff();
    if (!current.scope.profileId || (!current.scope.isAdmin && !current.scope.isTeacher)) {
      return { ok: false, error: "Staff sign-in required." };
    }
    if (!current.scope.qualifierAccess) {
      return { ok: false, error: "Qualifier examination access is not enabled for this staff account." };
    }

    const title = input.title.trim();
    const subjectIds = [...new Set(input.subjectIds.filter(Boolean))];
    const studentIds = [...new Set(input.studentIds.filter(Boolean))];
    const placementTracks = [...new Set(input.placementTracks.filter((track) => PLACEMENT_TRACKS.has(track)))];
    if (title.length < 3) return { ok: false, error: "Enter an exam title of at least 3 characters." };
    if (!subjectIds.length) return { ok: false, error: "Choose at least one qualifier subject." };
    if (!placementTracks.length) return { ok: false, error: "Choose at least one placement outcome." };
    if (!Number.isInteger(input.durationSeconds) || input.durationSeconds < 30 || input.durationSeconds > 14400) {
      return { ok: false, error: "Duration must be between 30 seconds and 4 hours." };
    }
    if (!Number.isInteger(input.questionCount) || input.questionCount < 5 || input.questionCount > 200) {
      return { ok: false, error: "Question count must be between 5 and 200." };
    }
    if (!Number.isInteger(input.warnAfter) || input.warnAfter < 1 || input.warnAfter > 10) {
      return { ok: false, error: "Integrity warning threshold must be between 1 and 10." };
    }

    const admin = createSupabaseAdminClient();
    const [{ data: subjects, error: subjectError }, { data: year, error: yearError }] = await Promise.all([
      admin.from("subjects").select("id,code,name,kind,active").in("id", subjectIds).eq("active", true).eq("kind", "qualifier"),
      admin.from("academic_years").select("id").eq("status", "active").limit(1).maybeSingle(),
    ]);
    let students: { id: string }[] = [];
    if (studentIds.length) {
      const { data: studentRows, error: studentError } = await admin
        .from("school_members")
        .select("id")
        .in("id", studentIds)
        .eq("role", "student")
        .eq("status", "active");
      if (studentError) {
        return { ok: false, error: studentError.message ?? "Qualifier setup could not be verified." };
      }
      students = (studentRows ?? []) as { id: string }[];
    }
    if (subjectError || yearError) {
      return { ok: false, error: subjectError?.message ?? yearError?.message ?? "Qualifier setup could not be verified." };
    }
    if ((subjects ?? []).length !== subjectIds.length) {
      return { ok: false, error: "Every selected subject must be an active qualifier subject." };
    }
    if (students.length !== studentIds.length) {
      return { ok: false, error: "One or more selected candidates are no longer active students." };
    }
    if (!year) {
      return { ok: false, error: "Prepare an active academic year before creating a placement examination." };
    }

    const academicYearId = (year as { id: string }).id;
    const { data: activeTerm, error: termError } = await admin
      .from("academic_terms")
      .select("id")
      .eq("academic_year_id", academicYearId)
      .eq("status", "active")
      .order("sequence")
      .limit(1)
      .maybeSingle();
    if (termError) return { ok: false, error: termError.message };

    const id = qualifierExamId();
    const now = Date.now();
    const { error: sessionError } = await admin.from("exam_sessions").insert({
      id,
      title: title.slice(0, 72),
      academic_term_id: (activeTerm as { id?: string } | null)?.id ?? null,
      mode: "qualifier",
      status: input.status,
      closed_at: input.status === "closed" ? now : null,
      duration_seconds: input.durationSeconds,
      question_count: input.questionCount,
      instructions: input.instructions.slice(0, 140),
      starts_at: null,
      ends_at: null,
      attempt_limit: 1,
      focus_monitoring: true,
      fullscreen_prompt: true,
      clipboard_guard: true,
      camera_required: input.cameraRequired,
      warn_after: input.warnAfter,
      question_order: true,
      option_order: true,
      minimize_collisions: true,
      created_by_id: current.scope.profileId,
      created_at: now,
      updated_at: now,
    });
    if (sessionError) return { ok: false, error: sessionError.message };

    try {
      const { error: trackError } = await admin.from("exam_placement_tracks").insert(
        placementTracks.map((track) => ({ session_id: id, track })),
      );
      if (trackError) throw trackError;

      if (studentIds.length) {
        const { error: accessError } = await admin.from("exam_student_access").insert(
          studentIds.map((studentId) => ({
            session_id: id,
            student_id: studentId,
            decision: "allow",
            granted_by_id: current.scope.profileId,
            max_attempts_override: 1,
            reason: "Incoming SS1 placement candidate",
          })),
        );
        if (accessError) throw accessError;
      }
    } catch (error) {
      await admin.from("exam_sessions").delete().eq("id", id);
      return { ok: false, error: error instanceof Error ? error.message : "Qualifier audience could not be saved." };
    }

    revalidatePath("/workspace/exams");
    revalidatePath("/workspace/reports");
    return { ok: true, id };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "Qualifier examination could not be created." };
  }
}
