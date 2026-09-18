"use server";

import {
  createExamAction,
  getExamDetailAction,
  upsertQuestionCore,
  updateExamAction,
  type ExamWizardInput,
} from "@/app/actions/admin";
import { createQualifierExamAction } from "@/app/actions/qualifier-exams";
import type { ActionResult } from "@/app/actions/student";
import { paperForStudent } from "@/lib/assessment";
import { currentStaff, questionSubjectVisibleTo } from "@/lib/auth/staff";
import { loadExamRuntimeSession } from "@/lib/exam-session";
import { loadQuestionPayload } from "@/lib/questions";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { listClasses } from "@/lib/supabase/queries";
import type { AcademicTrack } from "@/types/db";
import type { ExamMode, QuestionType } from "@/types/exam";

export interface SubjectOption {
  id: string;
  code: string;
  name: string;
  kind: "curriculum" | "qualifier";
}

export interface OfferingOption {
  id: string;
  classId: string;
  className: string;
  classLevel: string;
  track: AcademicTrack;
  trackName: string;
  subjectId: string;
  subjectName: string;
  academicYearId: string;
  academicYear: string;
  participation: "required" | "elective";
  status: string;
}

export interface CandidateOption {
  id: string;
  name: string;
  studentNumber: string | null;
  classId: string | null;
  className: string | null;
}

export interface ExamCreationInput extends ExamWizardInput {
  studentIds: string[];
  placementTracks: AcademicTrack[];
}

async function staffContext() {
  const context = await currentStaff();
  if (!context.scope.profileId) throw new Error("Staff sign-in required.");
  return { ...context, admin: createSupabaseAdminClient() };
}

export async function getSubjectCatalogAction(): Promise<SubjectOption[]> {
  const { admin } = await staffContext();
  const { data } = await admin.from("subjects").select("id,code,name,kind").eq("active", true).order("name");
  return (data ?? []) as SubjectOption[];
}

function curriculumKey(subjectId: string, levelId: string, track: string): string {
  return `${subjectId}:${levelId}:${track}`;
}

export async function getAdminFormOptionsAction() {
  const { admin, scope } = await staffContext();
  const [subjects, classes, yearsResult, termsResult, offeringsResult, rulesResult, studentsResult, enrollmentsResult] = await Promise.all([
    getSubjectCatalogAction(),
    listClasses(admin),
    admin.from("academic_years").select("id,name,status").order("name", { ascending: false }),
    admin.from("academic_terms").select("id,academic_year_id,name,sequence,status").order("sequence"),
    admin.from("class_subject_offerings").select("id,class_id,subject_id,status").in("status", ["active", "draft"]).limit(1000),
    admin.from("subject_curriculum_rules").select("subject_id,level_id,track,participation").limit(5000),
    admin.from("school_members").select("id,first_name,last_name,student_number").eq("role", "student").eq("status", "active").order("last_name").limit(2000),
    admin.from("class_enrollments").select("student_id,class_id").eq("status", "active").is("ended_at", null).limit(3000),
  ]);
  const years = (yearsResult.data ?? []) as { id: string; name: string; status: string }[];
  const terms = (termsResult.data ?? []) as { id: string; academic_year_id: string; name: string; sequence: number; status: string }[];
  const classMap = new Map(classes.map((row) => [row.id, row]));
  const subjectMap = new Map(subjects.map((row) => [row.id, row]));
  const participationByRule = new Map(
    ((rulesResult.data ?? []) as { subject_id: string; level_id: string; track: string; participation: "required" | "elective" }[])
      .map((row) => [curriculumKey(row.subject_id, row.level_id, row.track), row.participation]),
  );
  const classIdByStudent = new Map(((enrollmentsResult.data ?? []) as { student_id: string; class_id: string }[]).map((row) => [row.student_id, row.class_id]));

  const offerings: OfferingOption[] = ((offeringsResult.data ?? []) as {
    id: string;
    class_id: string;
    subject_id: string;
    status: string;
  }[]).flatMap((row) => {
    const cls = classMap.get(row.class_id);
    const subject = subjectMap.get(row.subject_id);
    if (!cls || !subject || subject.kind !== "curriculum") return [];
    const participation = participationByRule.get(curriculumKey(row.subject_id, cls.level_id, cls.track));
    if (!participation) return [];
    return [{
      id: row.id,
      classId: row.class_id,
      className: cls.display_name,
      classLevel: cls.level_name,
      track: cls.track,
      trackName: cls.track_name,
      subjectId: row.subject_id,
      subjectName: subject.name,
      academicYearId: cls.academic_year_id,
      academicYear: cls.academic_year_name,
      participation,
      status: row.status,
    }];
  });

  const tracks = [
    { id: "science" as AcademicTrack, name: "Science" },
    { id: "humanities" as AcademicTrack, name: "Humanities" },
    { id: "business" as AcademicTrack, name: "Business" },
  ];

  const candidates: CandidateOption[] = ((studentsResult.data ?? []) as {
    id: string;
    first_name: string;
    last_name: string;
    student_number: string | null;
  }[]).map((student) => {
    const classId = classIdByStudent.get(student.id) ?? null;
    const cls = classId ? classMap.get(classId) : null;
    return {
      id: student.id,
      name: `${student.first_name} ${student.last_name}`.trim(),
      studentNumber: student.student_number,
      classId,
      className: cls?.display_name ?? null,
    };
  });

  return {
    subjects,
    classes: classes.map((row) => ({
      id: row.id,
      name: row.display_name,
      classLevel: row.level_name,
      track: row.track,
      trackName: row.track_name,
      status: row.status,
    })),
    candidates,
    tracks,
    years,
    terms,
    offerings,
    scope,
  };
}

function validateExamShape(input: ExamCreationInput): string | null {
  if (input.title.trim().length < 3) return "Enter an exam title of at least 3 characters.";
  if (!Number.isInteger(input.durationSeconds) || input.durationSeconds < 30 || input.durationSeconds > 14400) return "Duration must be between 30 seconds and 4 hours.";
  if (!Number.isInteger(input.questionCount) || input.questionCount < 5 || input.questionCount > 200) return "Question count must be between 5 and 200.";
  if (!Number.isInteger(input.warnAfter) || input.warnAfter < 1 || input.warnAfter > 10) return "Integrity warning threshold must be between 1 and 10.";
  if (input.mode === "waec" && input.classLevel !== "SS3") return "WAEC examinations are configured for SS3.";

  const subjectIds = [...new Set(input.subjectIds)];
  if (input.mode === "qualifier") {
    if (input.classLevel !== "SS1") return "Qualifier questions use the incoming SS1 readiness level.";
    if (!subjectIds.length || subjectIds.length > 6) return "Choose between 1 and 6 qualifier subjects.";
    if (!input.placementTracks.length) return "Choose at least one placement outcome.";
    return null;
  }

  if (input.mode === "mixed" && (subjectIds.length < 2 || subjectIds.length > 12)) return "Mixed examinations require between 2 and 12 subjects.";
  if (["single", "waec", "bece", "neco", "jamb"].includes(input.mode) && subjectIds.length !== 1) return "This examination mode requires exactly one subject.";
  if (subjectIds.length && !input.offeringIds.length) return "Subject examinations require explicit class subject offerings.";
  if (!subjectIds.length && !input.classIds.length) return "General examinations require at least one class target.";
  return null;
}

async function eligibleQuestionCount(input: ExamCreationInput): Promise<number> {
  const { admin } = await staffContext();
  let query = admin.from("questions").select("id,subject_id,exam_modes").eq("status", "active").limit(5000);
  if (input.subjectIds.length) query = query.in("subject_id", [...new Set(input.subjectIds)]);
  const [{ data: questions }, { data: level }] = await Promise.all([
    query,
    admin.from("academic_levels").select("id").eq("name", input.classLevel).eq("active", true).maybeSingle(),
  ]);
  const levelId = (level as { id?: string } | null)?.id;
  if (!levelId) return 0;
  const eligibleByMode = ((questions ?? []) as { id: number; subject_id: string; exam_modes: string[] }[]).filter((question) =>
    (question.exam_modes ?? []).includes(input.mode)
      && (!input.subjectIds.length || input.subjectIds.includes(question.subject_id)),
  );
  if (!eligibleByMode.length) return 0;
  const { data: links } = await admin.from("question_academic_levels").select("question_id").eq("level_id", levelId).in("question_id", eligibleByMode.map((question) => question.id));
  return new Set(((links ?? []) as { question_id: number }[]).map((link) => Number(link.question_id))).size;
}

export async function getExamCoverageAction(input: ExamCreationInput): Promise<{ ok: boolean; count: number; error?: string }> {
  const shapeError = validateExamShape(input);
  if (shapeError) return { ok: false, count: 0, error: shapeError };
  const { admin } = await staffContext();

  if (input.mode === "qualifier") {
    const { data: qualifierSubjects, error } = await admin.from("subjects").select("id").in("id", [...new Set(input.subjectIds)]).eq("kind", "qualifier").eq("active", true);
    if (error) return { ok: false, count: 0, error: error.message };
    if ((qualifierSubjects ?? []).length !== [...new Set(input.subjectIds)].length) {
      return { ok: false, count: 0, error: "Qualifier papers may use only active qualifier subjects." };
    }
  } else if (input.offeringIds.length) {
    const { data: offerings } = await admin.from("class_subject_offerings").select("id,subject_id,class_id,status").in("id", input.offeringIds);
    const rows = (offerings ?? []) as { id: string; subject_id: string; class_id: string; status: string }[];
    if (rows.length !== [...new Set(input.offeringIds)].length || rows.some((row) => row.status !== "active")) return { ok: false, count: 0, error: "One or more subject offerings are unavailable." };
    const offeredSubjects = new Set(rows.map((row) => row.subject_id));
    if (input.subjectIds.some((subjectId) => !offeredSubjects.has(subjectId))) return { ok: false, count: 0, error: "Every exam subject needs a selected class subject offering." };
  }

  const count = await eligibleQuestionCount(input);
  if (count < input.questionCount) return { ok: false, count, error: `Only ${count} eligible questions are available for this paper.` };
  return { ok: true, count };
}

export async function createExamParityAction(input: ExamCreationInput): Promise<ActionResult & { id?: string }> {
  try {
    const shapeError = validateExamShape(input);
    if (shapeError) return { ok: false, error: shapeError };
    const coverage = await getExamCoverageAction(input);
    if (!coverage.ok) return { ok: false, error: coverage.error };

    if (input.mode === "qualifier") {
      return createQualifierExamAction({
        title: input.title,
        subjectIds: [...new Set(input.subjectIds)],
        studentIds: [...new Set(input.studentIds)],
        placementTracks: [...new Set(input.placementTracks)],
        durationSeconds: input.durationSeconds,
        questionCount: input.questionCount,
        status: input.status,
        instructions: input.instructions,
        cameraRequired: input.cameraRequired,
        warnAfter: input.warnAfter,
      });
    }

    return createExamAction({
      title: input.title,
      classLevel: input.classLevel,
      mode: input.mode,
      subjectIds: [...new Set(input.subjectIds)],
      offeringIds: [...new Set(input.offeringIds)],
      classIds: [...new Set(input.classIds)],
      durationSeconds: input.durationSeconds,
      questionCount: input.questionCount,
      status: input.status,
      instructions: input.instructions,
      cameraRequired: input.cameraRequired,
      warnAfter: input.warnAfter,
    });
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "Create failed." };
  }
}

export interface ExamEditorPatch {
  title: string;
  durationSeconds: number;
  questionCount: number;
  instructions: string;
  status: string;
  cameraRequired: boolean;
  warnAfter: number;
  subjectIds: string[];
  offeringIds: string[];
}

export async function getExamEditorDetailAction(examId: string) {
  const detail = await getExamDetailAction(examId);
  if (!detail.session) {
    return { ...detail, structureLocked: false, subjectIds: [] as string[], offeringIds: [] as string[] };
  }

  const { admin } = await staffContext();
  const sessionId = examId.toUpperCase();
  const [subjectResult, offeringResult] = await Promise.all([
    admin.from("exam_subject_targets").select("subject_id").eq("session_id", sessionId),
    admin.from("exam_offering_targets").select("offering_id").eq("session_id", sessionId),
  ]);
  if (subjectResult.error || offeringResult.error) {
    throw new Error(subjectResult.error?.message ?? offeringResult.error?.message ?? "Exam subjects could not be loaded.");
  }

  return {
    ...detail,
    structureLocked: false,
    subjectIds: ((subjectResult.data ?? []) as { subject_id: string }[]).map((row) => row.subject_id),
    offeringIds: ((offeringResult.data ?? []) as { offering_id: string }[]).map((row) => row.offering_id),
  };
}

async function replaceExamEditorTargets(
  admin: ReturnType<typeof createSupabaseAdminClient>,
  sessionId: string,
  subjectIds: string[],
  offeringIds: string[],
): Promise<string | null> {
  const { error: deleteSubjectError } = await admin.from("exam_subject_targets").delete().eq("session_id", sessionId);
  if (deleteSubjectError) return deleteSubjectError.message;

  if (subjectIds.length) {
    const { error } = await admin.from("exam_subject_targets").insert(
      subjectIds.map((subjectId) => ({ session_id: sessionId, subject_id: subjectId })),
    );
    if (error) return error.message;
  }

  const { error: deleteOfferingError } = await admin.from("exam_offering_targets").delete().eq("session_id", sessionId);
  if (deleteOfferingError) return deleteOfferingError.message;

  if (offeringIds.length) {
    const { error } = await admin.from("exam_offering_targets").insert(
      offeringIds.map((offeringId) => ({ session_id: sessionId, offering_id: offeringId })),
    );
    if (error) return error.message;
  }

  return null;
}

function sameStringSet(left: string[], right: string[]): boolean {
  if (left.length !== right.length) return false;
  const expected = new Set(left);
  return right.every((value) => expected.has(value));
}

export async function updateExamParityAction(
  id: string,
  patch: ExamEditorPatch,
): Promise<ActionResult> {
  try {
    const detail = await getExamDetailAction(id);
    const session = detail.session as { mode?: ExamMode; duration_seconds?: number; question_count?: number } | null;
    if (!session) return { ok: false, error: "Exam not found or outside your scope." };
    if (patch.title.trim().length < 3) return { ok: false, error: "Enter an exam title of at least 3 characters." };
    if (!Number.isInteger(patch.warnAfter) || patch.warnAfter < 1 || patch.warnAfter > 10) return { ok: false, error: "Integrity warning threshold must be between 1 and 10." };
    if (!Number.isInteger(patch.durationSeconds) || patch.durationSeconds < 30 || patch.durationSeconds > 14400) return { ok: false, error: "Duration must be between 30 seconds and 4 hours." };
    if (!Number.isInteger(patch.questionCount) || patch.questionCount < 5 || patch.questionCount > 200) return { ok: false, error: "Question count must be between 5 and 200." };
    if (!["open", "closed"].includes(patch.status)) return { ok: false, error: "Exam availability must be Open or Closed." };

    const mode = session.mode;
    if (!mode) return { ok: false, error: "Exam mode is unavailable." };

    const subjectIds = [...new Set(patch.subjectIds.filter(Boolean))];
    const offeringIds = [...new Set(patch.offeringIds.filter(Boolean))];
    const { admin, scope } = await staffContext();
    const sessionId = id.toUpperCase();

    const [existingSubjectResult, existingOfferingResult, classTargetResult] = await Promise.all([
      admin.from("exam_subject_targets").select("subject_id").eq("session_id", sessionId),
      admin.from("exam_offering_targets").select("offering_id").eq("session_id", sessionId),
      admin.from("exam_class_targets").select("class_id").eq("session_id", sessionId),
    ]);
    if (existingSubjectResult.error || existingOfferingResult.error || classTargetResult.error) {
      return {
        ok: false,
        error: existingSubjectResult.error?.message
          ?? existingOfferingResult.error?.message
          ?? classTargetResult.error?.message
          ?? "Exam relationships could not be loaded.",
      };
    }

    const previousSubjectIds = ((existingSubjectResult.data ?? []) as { subject_id: string }[]).map((row) => row.subject_id);
    const previousOfferingIds = ((existingOfferingResult.data ?? []) as { offering_id: string }[]).map((row) => row.offering_id);
    const targetClassIds = new Set(((classTargetResult.data ?? []) as { class_id: string }[]).map((row) => row.class_id));

    if (mode === "qualifier") {
      if (!scope.isAdmin && !scope.qualifierAccess) return { ok: false, error: "Qualifier examination access is not enabled for this staff account." };
      if (!subjectIds.length || subjectIds.length > 6) return { ok: false, error: "Choose between 1 and 6 qualifier subjects." };
      if (offeringIds.length) return { ok: false, error: "Placement examinations do not use class subject offerings." };

      const { data: selectedSubjects, error } = await admin
        .from("subjects")
        .select("id")
        .in("id", subjectIds)
        .eq("kind", "qualifier")
        .eq("active", true);
      if (error) return { ok: false, error: error.message };
      if ((selectedSubjects ?? []).length !== subjectIds.length) {
        return { ok: false, error: "Every selected subject must be an active placement subject." };
      }
    } else {
      if (mode === "mixed" && (subjectIds.length < 2 || subjectIds.length > 12)) {
        return { ok: false, error: "Mixed examinations require between 2 and 12 subjects." };
      }
      if (["single", "waec", "bece", "neco", "jamb"].includes(mode) && subjectIds.length !== 1) {
        return { ok: false, error: "This examination mode requires exactly one subject." };
      }
      if (!subjectIds.length) return { ok: false, error: "Choose at least one subject." };
      if (!offeringIds.length) return { ok: false, error: "Every exam subject needs an active class subject offering." };
      if (!scope.isAdmin && subjectIds.some((subjectId) => !questionSubjectVisibleTo(subjectId, scope))) {
        return { ok: false, error: "One or more selected subjects are outside your teaching scope." };
      }

      const { data: offerings, error } = await admin
        .from("class_subject_offerings")
        .select("id,class_id,subject_id,status")
        .in("id", offeringIds);
      if (error) return { ok: false, error: error.message };
      const rows = (offerings ?? []) as { id: string; class_id: string; subject_id: string; status: string }[];
      if (rows.length !== offeringIds.length || rows.some((row) => row.status !== "active")) {
        return { ok: false, error: "One or more selected subject offerings are unavailable." };
      }
      if (rows.some((row) => !targetClassIds.has(row.class_id))) {
        return { ok: false, error: "Subject offerings must belong to classes already targeted by this examination." };
      }
      if (rows.some((row) => !subjectIds.includes(row.subject_id))) {
        return { ok: false, error: "Remove class offerings that do not belong to the selected subjects." };
      }
      const offeredSubjects = new Set(rows.map((row) => row.subject_id));
      if (subjectIds.some((subjectId) => !offeredSubjects.has(subjectId))) {
        return { ok: false, error: "Every selected subject needs an active offering in the target classes." };
      }
    }

    const subjectChanged = !sameStringSet(previousSubjectIds, subjectIds);
    if (patch.questionCount !== Number(session.question_count) || subjectChanged) {
      const runtime = await loadExamRuntimeSession(admin, sessionId);
      if (!runtime) return { ok: false, error: "Exam details could not be loaded for question coverage validation." };

      const payload = await loadQuestionPayload();
      const candidatePaper = paperForStudent(
        { questions: payload.questions },
        { ...runtime.session, subjectIds, questionCount: patch.questionCount },
        `editor-coverage:${sessionId}`,
      );
      if (candidatePaper.length < patch.questionCount) {
        return {
          ok: false,
          error: `Only ${candidatePaper.length} eligible questions are available for the selected subjects.`,
        };
      }
    }

    const relationshipError = await replaceExamEditorTargets(admin, sessionId, subjectIds, offeringIds);
    if (relationshipError) {
      await replaceExamEditorTargets(admin, sessionId, previousSubjectIds, previousOfferingIds);
      return { ok: false, error: relationshipError };
    }

    const result = await updateExamAction(id, {
      title: patch.title,
      durationSeconds: patch.durationSeconds,
      questionCount: patch.questionCount,
      instructions: patch.instructions,
      status: patch.status,
      cameraRequired: patch.cameraRequired,
      warnAfter: patch.warnAfter,
    });

    if (!result.ok) {
      const { data: currentSession } = await admin
        .from("exam_sessions")
        .select("title,duration_seconds,question_count,instructions,status,camera_required,warn_after")
        .eq("id", sessionId)
        .maybeSingle();
      const row = currentSession as {
        title?: string;
        duration_seconds?: number;
        question_count?: number;
        instructions?: string;
        status?: string;
        camera_required?: boolean;
        warn_after?: number;
      } | null;
      const scalarUpdateApplied = Boolean(
        row
        && row.title === patch.title.trim().slice(0, 72)
        && Number(row.duration_seconds) === patch.durationSeconds
        && Number(row.question_count) === patch.questionCount
        && String(row.instructions ?? "") === patch.instructions.slice(0, 140)
        && row.status === patch.status
        && Boolean(row.camera_required) === patch.cameraRequired
        && Number(row.warn_after) === patch.warnAfter,
      );
      if (!scalarUpdateApplied) {
        await replaceExamEditorTargets(admin, sessionId, previousSubjectIds, previousOfferingIds);
      }
      return result;
    }

    return { ok: true };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "Update failed." };
  }
}

export interface QuestionEditorInput {
  id?: number;
  subjectId: string;
  kind: QuestionType;
  prompt: string;
  options: string[];
  correctAnswers: string[];
  levels: string[];
  fillTemplate?: string;
  blankAnswers?: string[][];
  difficulty?: string;
  domain?: string;
  explanation?: string;
}

function questionValidation(input: QuestionEditorInput): string | null {
  if (!input.subjectId) return "Choose a subject.";
  if (input.prompt.trim().length < 3) return "Enter the question prompt.";
  if (!input.levels.length) return "Choose at least one class level.";
  if (!["single", "multi", "boolean", "fill", "fill-multi"].includes(input.kind)) return "Unsupported question type.";
  if (input.kind === "single" || input.kind === "multi") {
    const options = [...new Set(input.options.map((value) => value.trim()).filter(Boolean))];
    if (options.length < 2) return "Choice questions need at least two distinct options.";
    const answers = [...new Set(input.correctAnswers.map((value) => value.trim()).filter(Boolean))];
    if (!answers.length || answers.some((answer) => !options.includes(answer))) return "Every correct answer must match one of the supplied options.";
    if (input.kind === "single" && answers.length !== 1) return "Single-choice questions require exactly one correct answer.";
  }
  if (input.kind === "boolean" && !["true", "false"].includes(String(input.correctAnswers[0]).toLowerCase())) return "Choose True or False as the correct answer.";
  if (input.kind === "fill" || input.kind === "fill-multi") {
    const markers = (input.fillTemplate ?? "").match(/___/g)?.length ?? 0;
    if (!markers) return "Fill questions need at least one ___ blank marker.";
    if ((input.blankAnswers ?? []).length !== markers) return "Provide accepted answers for every blank.";
    if ((input.blankAnswers ?? []).some((answers) => !answers.some((answer) => answer.trim()))) return "Every blank needs at least one accepted answer.";
    if (input.kind === "fill" && markers !== 1) return "Single-gap fill questions require exactly one blank.";
  }
  return null;
}

export async function upsertQuestionParityAction(input: QuestionEditorInput): Promise<ActionResult & { id?: number }> {
  try {
    const validation = questionValidation(input);
    if (validation) return { ok: false, error: validation };
    const current = await currentStaff();
    if (!current.scope.profileId || !questionSubjectVisibleTo(input.subjectId, current.scope)) return { ok: false, error: "Outside your subject scope." };
    const options = input.kind === "single" || input.kind === "multi" ? [...new Set(input.options.map((value) => value.trim()).filter(Boolean))] : [];
    const correctAnswers = input.kind === "fill" || input.kind === "fill-multi"
      ? []
      : input.kind === "boolean"
        ? [String(input.correctAnswers[0]).toLowerCase()]
        : [...new Set(input.correctAnswers.map((value) => value.trim()).filter(Boolean))];
    let fillTemplate: string | null = null;
    const blanks: { position: number; accepted: string[] }[] = [];
    if (input.kind === "fill" || input.kind === "fill-multi") {
      let position = 0;
      fillTemplate = String(input.fillTemplate).replace(/___/g, () => `{{${position++}}}`);
      for (let index = 0; index < (input.blankAnswers ?? []).length; index += 1) {
        blanks.push({ position: index, accepted: [...new Set((input.blankAnswers?.[index] ?? []).map((answer) => answer.trim()).filter(Boolean))] });
      }
    }
    return upsertQuestionCore({
      id: input.id,
      subjectId: input.subjectId,
      kind: input.kind,
      prompt: input.prompt,
      options,
      correctAnswers,
      levels: [...new Set(input.levels)],
      fillTemplate,
      difficulty: input.difficulty,
      domain: input.domain?.trim(),
      explanation: input.explanation?.trim(),
      blanks,
    });
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "Save failed." };
  }
}

export async function getClassDetailAction(classId: string) {
  const { admin } = await staffContext();
  const [classes, { data: enrollments }, { data: offerings }, { data: groups }] = await Promise.all([
    listClasses(admin),
    admin.from("class_enrollments").select("student_id,status").eq("class_id", classId).eq("status", "active").limit(500),
    admin.from("class_subject_offerings").select("id,subject_id,status").eq("class_id", classId).order("status"),
    admin.from("whatsapp_groups").select("*").eq("class_id", classId).order("created_at"),
  ]);
  const classRow = classes.find((row) => row.id === classId) ?? null;
  const enrollmentRows = (enrollments ?? []) as { student_id: string; status: string }[];
  const memberIds = enrollmentRows.map((row) => row.student_id);
  const { data: members } = memberIds.length
    ? await admin.from("school_members").select("id,first_name,last_name,status").in("id", memberIds).order("last_name")
    : { data: [] };
  const students = ((members ?? []) as { id: string; first_name: string; last_name: string; status: string }[]).map((row) => ({
    ...row,
    full_name: `${row.first_name} ${row.last_name}`.trim(),
  }));

  const offeringRows = (offerings ?? []) as { id: string; subject_id: string; status: string }[];
  const subjectIds = [...new Set(offeringRows.map((row) => row.subject_id))];
  const [{ data: subjects }, { data: rules }] = await Promise.all([
    subjectIds.length ? admin.from("subjects").select("id,name").in("id", subjectIds) : Promise.resolve({ data: [] }),
    classRow && subjectIds.length
      ? admin.from("subject_curriculum_rules").select("subject_id,participation").eq("level_id", classRow.level_id).eq("track", classRow.track).in("subject_id", subjectIds)
      : Promise.resolve({ data: [] }),
  ]);
  const subjectMap = new Map(((subjects ?? []) as { id: string; name: string }[]).map((row) => [row.id, row.name]));
  const participationMap = new Map(((rules ?? []) as { subject_id: string; participation: string }[]).map((row) => [row.subject_id, row.participation]));

  return {
    classRow,
    students,
    offerings: offeringRows.map((row) => ({
      ...row,
      subject_name: subjectMap.get(row.subject_id) ?? "Subject",
      participation: participationMap.get(row.subject_id) ?? null,
    })),
    groups: groups ?? [],
  };
}

export async function getWhatsappDetailAction(groupId: string) {
  const { admin, scope } = await staffContext();
  if (!scope.isAdmin) return null;
  const { data } = await admin.from("whatsapp_groups").select("*").eq("id", groupId).maybeSingle();
  return data;
}
