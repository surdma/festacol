"use server";

import { revalidatePath } from "next/cache";
import type { ActionResult } from "@/app/actions/student";
import { currentStaff } from "@/lib/auth/staff";
import { listClasses } from "@/lib/supabase/queries";
import type { ExamAttemptContextSnapshot } from "@/types/db";

async function requireAcademicAdmin() {
  const context = await currentStaff();
  if (!context.scope.isAdmin) throw new Error("Administrator sign-in required.");
  return context.supabase;
}

export async function deleteClassSafelyAction(classId: string): Promise<ActionResult> {
  try {
    const supabase = await requireAcademicAdmin();
    const [{ count: activeCount, error: activeError }, { count: totalCount, error: totalError }] = await Promise.all([
      supabase
        .from("class_enrollments")
        .select("id", { count: "exact", head: true })
        .eq("class_id", classId)
        .eq("status", "active")
        .is("ended_at", null),
      supabase.from("class_enrollments").select("id", { count: "exact", head: true }).eq("class_id", classId),
    ]);
    if (activeError || totalError) return { ok: false, error: activeError?.message ?? totalError?.message ?? "Class enrollment history could not be checked." };
    if ((activeCount ?? 0) > 0) {
      return {
        ok: false,
        error: `Move the ${activeCount} actively enrolled student${activeCount === 1 ? "" : "s"} to another class before deleting this class.`,
      };
    }
    if ((totalCount ?? 0) > 0) {
      return { ok: false, error: "This class has historical enrolment records and must be preserved for audit history. Mark it inactive instead of deleting it." };
    }

    const { error } = await supabase.from("classes").delete().eq("id", classId);
    if (error) return { ok: false, error: error.message };
    revalidatePath("/workspace/classes");
    revalidatePath("/workspace/students");
    return { ok: true };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "Delete failed." };
  }
}

function validWhatsappInvite(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === "https:" && (url.hostname === "chat.whatsapp.com" || url.hostname === "www.whatsapp.com");
  } catch {
    return false;
  }
}

export async function upsertSingleClassWhatsappAction(input: {
  id?: string;
  classId: string;
  name: string;
  inviteUrl: string;
}): Promise<ActionResult & { id?: string }> {
  try {
    const supabase = await requireAcademicAdmin();
    if (!input.classId) return { ok: false, error: "Choose a class." };
    if (!input.name.trim()) return { ok: false, error: "Enter a group name." };
    if (!validWhatsappInvite(input.inviteUrl)) return { ok: false, error: "Use an official https://chat.whatsapp.com/ invite link." };

    const { data: conflicts, error: conflictError } = await supabase
      .from("whatsapp_groups")
      .select("id,class_id")
      .eq("class_id", input.classId)
      .limit(2);
    if (conflictError) return { ok: false, error: conflictError.message };
    const conflict = ((conflicts ?? []) as { id: string; class_id: string }[]).find((group) => group.id !== input.id);
    if (conflict) return { ok: false, error: "This class already has a WhatsApp group. Edit the existing class mapping instead." };

    const now = Date.now();
    const id = input.id ?? `WA-${now.toString(36).toUpperCase()}`;
    const row = {
      class_id: input.classId,
      name: input.name.trim().slice(0, 80),
      invite_url: input.inviteUrl.trim(),
      updated_at: now,
    };
    const result = input.id
      ? await supabase.from("whatsapp_groups").update(row).eq("id", input.id)
      : await supabase.from("whatsapp_groups").insert({ ...row, id, created_at: now });
    if (result.error) return { ok: false, error: result.error.message };
    revalidatePath("/workspace/classes");
    return { ok: true, id };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "WhatsApp group save failed." };
  }
}

interface AcademicAttemptRow {
  id: string;
  session_id: string;
  student_id: string;
  attempt_number: number;
  context_snapshot: ExamAttemptContextSnapshot;
  score: number | null;
  integrity_score: number | null;
  assigned_track: string | null;
  placement_confidence: number | null;
  started_at: number | null;
  submitted_at: number | null;
  created_at: number;
}

interface ResponseStatRow {
  attempt_id: string;
  question_id: number;
  correct: boolean | null;
  seconds: number;
}

function recordAttempt(attempt: AcademicAttemptRow): Record<string, unknown> {
  return {
    id: attempt.id,
    session_id: attempt.session_id,
    student_id: attempt.student_id,
    attempt_number: attempt.attempt_number,
    context_snapshot: attempt.context_snapshot,
    score: attempt.score,
    integrity_score: attempt.integrity_score,
    assigned_track: attempt.assigned_track,
    placement_confidence: attempt.placement_confidence,
    started_at: attempt.started_at,
    submitted_at: attempt.submitted_at,
    created_at: attempt.created_at,
  };
}

function buildSubjectStats(
  responses: ResponseStatRow[],
  questionSubject: Map<string, string>,
  subjectName: Map<string, string>,
) {
  const buckets = new Map<string, { attemptId: string; subjectId: string; total: number; correct: number; seconds: number }>();
  for (const response of responses) {
    if (response.correct == null) continue;
    const subjectId = questionSubject.get(String(response.question_id));
    if (!subjectId) continue;
    const key = `${response.attempt_id}:${subjectId}`;
    const bucket = buckets.get(key) ?? { attemptId: response.attempt_id, subjectId, total: 0, correct: 0, seconds: 0 };
    bucket.total += 1;
    if (response.correct) bucket.correct += 1;
    bucket.seconds += Number(response.seconds ?? 0);
    buckets.set(key, bucket);
  }
  return [...buckets.values()].map((bucket) => ({
    attempt_id: bucket.attemptId,
    subject_id: bucket.subjectId,
    subject_name: subjectName.get(bucket.subjectId) ?? "Subject",
    total: bucket.total,
    correct: bucket.correct,
    seconds: bucket.seconds,
    percent: bucket.total ? Math.round((bucket.correct / bucket.total) * 100) : 0,
  }));
}

export async function getStudentAcademicRecordAction(userId: string) {
  const { supabase } = await currentStaff();
  const { data: member } = await supabase
    .from("school_members")
    .select("id,role,status,first_name,last_name,student_number,guardian,phone,promotion_status")
    .eq("id", userId)
    .eq("role", "student")
    .maybeSingle();
  const student = member as {
    id: string;
    role: string;
    status: string;
    first_name: string;
    last_name: string;
    student_number: string | null;
    guardian: string | null;
    phone: string | null;
    promotion_status: string | null;
  } | null;
  if (!student) return { user: null, classRow: null, whatsappGroup: null, attempts: [], stats: [], events: [] };

  const [{ data: enrollment }, classes, { data: attempts }] = await Promise.all([
    supabase
      .from("class_enrollments")
      .select("class_id")
      .eq("student_id", userId)
      .eq("status", "active")
      .is("ended_at", null)
      .limit(1)
      .maybeSingle(),
    listClasses(supabase),
    supabase
      .from("exam_attempts")
      .select("id,session_id,student_id,attempt_number,context_snapshot,score,integrity_score,assigned_track,placement_confidence,started_at,submitted_at,created_at")
      .eq("student_id", userId)
      .order("created_at", { ascending: false })
      .limit(100),
  ]);

  const classId = (enrollment as { class_id?: string } | null)?.class_id ?? null;
  const classRow = classes.find((row) => row.id === classId) ?? null;
  const { data: whatsapp } = classId
    ? await supabase.from("whatsapp_groups").select("id,class_id,name,invite_url,updated_at").eq("class_id", classId).maybeSingle()
    : { data: null };

  const attemptRows = (attempts ?? []) as AcademicAttemptRow[];
  const attemptIds = attemptRows.map((attempt) => attempt.id);
  const [{ data: responses }, { data: events }] = attemptIds.length
    ? await Promise.all([
      supabase.from("exam_attempt_responses").select("attempt_id,question_id,correct,seconds").in("attempt_id", attemptIds),
      supabase.from("exam_integrity_events").select("attempt_id,type,detail,at").in("attempt_id", attemptIds).order("at", { ascending: false }),
    ])
    : [{ data: [] }, { data: [] }];

  const responseRows = (responses ?? []) as ResponseStatRow[];
  const questionIds = [...new Set(responseRows.map((row) => Number(row.question_id)))];
  const { data: questions } = questionIds.length
    ? await supabase.from("questions").select("id,subject_id").in("id", questionIds)
    : { data: [] };
  const questionRows = (questions ?? []) as { id: number; subject_id: string }[];
  const subjectIds = [...new Set(questionRows.map((row) => row.subject_id))];
  const { data: subjects } = subjectIds.length
    ? await supabase.from("subjects").select("id,name").in("id", subjectIds)
    : { data: [] };
  const questionSubject = new Map(questionRows.map((row) => [String(row.id), row.subject_id]));
  const subjectName = new Map(((subjects ?? []) as { id: string; name: string }[]).map((row) => [row.id, row.name]));

  return {
    user: { ...student, full_name: `${student.first_name} ${student.last_name}`.trim(), class_id: classId },
    classRow,
    whatsappGroup: whatsapp,
    attempts: attemptRows.map(recordAttempt),
    stats: buildSubjectStats(responseRows, questionSubject, subjectName),
    events: events ?? [],
  };
}

export async function getClassAcademicRecordAction(classId: string) {
  const { supabase } = await currentStaff();
  const classes = await listClasses(supabase);
  const classRow = classes.find((row) => row.id === classId) ?? null;
  if (!classRow) return { classRow: null, students: [], whatsappGroup: null, sessions: [], attempts: [] };

  const [{ data: enrollments }, { data: whatsapp }, { data: offerings }, { data: classTargets }] = await Promise.all([
    supabase
      .from("class_enrollments")
      .select("student_id")
      .eq("class_id", classId)
      .eq("status", "active")
      .is("ended_at", null)
      .limit(500),
    supabase.from("whatsapp_groups").select("id,class_id,name,invite_url,updated_at").eq("class_id", classId).maybeSingle(),
    supabase.from("class_subject_offerings").select("id").eq("class_id", classId).in("status", ["active", "draft"]),
    supabase.from("exam_class_targets").select("session_id").eq("class_id", classId),
  ]);

  const studentIds = ((enrollments ?? []) as { student_id: string }[]).map((row) => row.student_id);
  const { data: members } = studentIds.length
    ? await supabase.from("school_members").select("id,first_name,last_name,status").in("id", studentIds).order("last_name")
    : { data: [] };
  const students = ((members ?? []) as { id: string; first_name: string; last_name: string; status: string }[]).map((member) => ({
    ...member,
    full_name: `${member.first_name} ${member.last_name}`.trim(),
    class_id: classId,
  }));

  const offeringIds = ((offerings ?? []) as { id: string }[]).map((row) => row.id);
  const { data: offeringTargets } = offeringIds.length
    ? await supabase.from("exam_offering_targets").select("session_id").in("offering_id", offeringIds)
    : { data: [] };
  const sessionIds = [...new Set([
    ...((classTargets ?? []) as { session_id: string }[]).map((row) => row.session_id),
    ...((offeringTargets ?? []) as { session_id: string }[]).map((row) => row.session_id),
  ])];
  const { data: sessions } = sessionIds.length
    ? await supabase.from("exam_sessions").select("id,title,mode,status,question_count,created_at").in("id", sessionIds).order("created_at", { ascending: false })
    : { data: [] };
  const { data: attempts } = sessionIds.length && studentIds.length
    ? await supabase
      .from("exam_attempts")
      .select("id,session_id,student_id,attempt_number,context_snapshot,score,integrity_score,submitted_at,created_at")
      .in("session_id", sessionIds)
      .in("student_id", studentIds)
      .order("created_at", { ascending: false })
      .limit(2000)
    : { data: [] };

  return { classRow, students, whatsappGroup: whatsapp, sessions: sessions ?? [], attempts: (attempts ?? []) as Record<string, unknown>[] };
}
