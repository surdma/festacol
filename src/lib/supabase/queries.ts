import type { SupabaseClient } from "@supabase/supabase-js";
import type { ClassRow, ExamAttemptRow, ExamSessionRow, QuestionRow, SubjectRow } from "@/types/db";

async function count(client: SupabaseClient, table: string): Promise<number> {
  const { count } = await client.from(table).select("*", { count: "exact", head: true });
  return count ?? 0;
}

export async function getAdminCounts(client: SupabaseClient) {
  const [sessions, attempts, members, classes] = await Promise.all([
    count(client, "exam_sessions"),
    count(client, "exam_attempts"),
    count(client, "school_members"),
    count(client, "classes"),
  ]);
  return { sessions, attempts, users: members, classes };
}

export interface DirectoryUserRow {
  id: string;
  first_name: string;
  last_name: string;
  full_name: string;
  role: "student" | "teacher" | "administrator";
  status: string;
  student_number: string | null;
  staff_number: string | null;
  phone: string;
  guardian: string;
  promotion_status: string;
  class_id: string | null;
  subject_ids: string[];
  subjects: string[];
  qualifier_access: boolean;
}

export interface ClassDirectoryRow extends ClassRow {
  level_name: string;
  track_name: string;
  academic_year_name: string;
  display_name: string;
}

export interface ExamSessionDirectoryRow extends ExamSessionRow {
  subjectIds: string[];
  subjectNames: string[];
  targetLabels: string[];
}

export async function listUsers(
  client: SupabaseClient,
  role: "student" | "staff",
  q = "",
): Promise<DirectoryUserRow[]> {
  let memberQuery = client
    .from("school_members")
    .select("id,first_name,last_name,role,status,student_number,staff_number,phone,guardian,promotion_status,qualifier_access")
    .order("last_name")
    .order("first_name")
    .limit(200);
  memberQuery = role === "student" ? memberQuery.eq("role", "student") : memberQuery.in("role", ["teacher", "administrator"]);
  // Name search plus short-ID search. Commas are PostgREST OR separators, so
  // they are neutralized first; `%` is stripped so callers cannot inject
  // wildcards. An exact (case-insensitive) student/staff number match is
  // included so a full FST-XXXXX / legacy STD- ID jumps straight to its row.
  // No status or enrollment filter is applied here: status=all (including
  // class-less placement students) is filtered in memory by the caller.
  if (q.trim()) {
    const raw = q.trim().replaceAll(",", " ").replace(/[%"]/g, "");
    const escaped = raw.slice(0, 80);
    const upper = escaped.toUpperCase();
    memberQuery = memberQuery.or(
      `first_name.ilike.%${escaped}%,last_name.ilike.%${escaped}%,student_number.ilike.%${escaped}%,staff_number.ilike.%${escaped}%,student_number.eq.${upper},staff_number.eq.${upper}`,
    );
  }
  const { data: memberData } = await memberQuery;
  const members = (memberData ?? []) as {
    id: string;
    first_name: string;
    last_name: string;
    role: "student" | "teacher" | "administrator";
    status: string;
    student_number: string | null;
    staff_number: string | null;
    phone: string | null;
    guardian: string | null;
    promotion_status: string | null;
    qualifier_access: boolean;
  }[];
  if (!members.length) return [];

  const memberIds = members.map((member) => member.id);
  const [enrollmentResult, qualificationResult, subjectResult, assignmentResult, offeringResult] = await Promise.all([
    role === "student"
      ? client.from("class_enrollments").select("student_id,class_id,enrolled_at").in("student_id", memberIds).eq("status", "active").is("ended_at", null)
      : Promise.resolve({ data: [] }),
    role === "staff"
      ? client.from("staff_subject_qualifications").select("staff_id,subject_id").in("staff_id", memberIds).eq("active", true)
      : Promise.resolve({ data: [] }),
    client.from("subjects").select("id,name").eq("active", true),
    role === "staff"
      ? client.from("teaching_assignments").select("staff_id,offering_id,assigned_at").in("staff_id", memberIds).is("ended_at", null)
      : Promise.resolve({ data: [] }),
    client.from("class_subject_offerings").select("id,class_id"),
  ]);

  const enrollments = new Map<string, { class_id: string; enrolled_at: string }>();
  for (const row of ((enrollmentResult.data ?? []) as { student_id: string; class_id: string; enrolled_at: string }[])) {
    const current = enrollments.get(row.student_id);
    if (!current || row.enrolled_at > current.enrolled_at) enrollments.set(row.student_id, { class_id: row.class_id, enrolled_at: row.enrolled_at });
  }
  const subjectNames = new Map(((subjectResult.data ?? []) as { id: string; name: string }[]).map((row) => [row.id, row.name]));
  const subjectIdsByStaff = new Map<string, string[]>();
  for (const row of ((qualificationResult.data ?? []) as { staff_id: string; subject_id: string }[])) {
    subjectIdsByStaff.set(row.staff_id, [...(subjectIdsByStaff.get(row.staff_id) ?? []), row.subject_id]);
  }
  const offeringClass = new Map(((offeringResult.data ?? []) as { id: string; class_id: string }[]).map((row) => [row.id, row.class_id]));
  const staffClass = new Map<string, string>();
  for (const row of ((assignmentResult.data ?? []) as { staff_id: string; offering_id: string; assigned_at: string }[])) {
    const classId = offeringClass.get(row.offering_id);
    if (classId && !staffClass.has(row.staff_id)) staffClass.set(row.staff_id, classId);
  }

  return members.map((member) => {
    const subjectIds = subjectIdsByStaff.get(member.id) ?? [];
    return {
      id: member.id,
      first_name: member.first_name,
      last_name: member.last_name,
      full_name: `${member.first_name} ${member.last_name}`.trim(),
      role: member.role,
      status: member.status,
      student_number: member.student_number,
      staff_number: member.staff_number,
      phone: member.phone ?? "",
      guardian: member.guardian ?? "",
      promotion_status: member.promotion_status ?? "",
      class_id: role === "student" ? enrollments.get(member.id)?.class_id ?? null : staffClass.get(member.id) ?? null,
      subject_ids: subjectIds,
      subjects: subjectIds.map((id) => subjectNames.get(id) ?? id),
      qualifier_access: member.qualifier_access,
    };
  });
}

export async function listSessions(client: SupabaseClient): Promise<ExamSessionDirectoryRow[]> {
  const { data } = await client.from("exam_sessions").select("*").order("updated_at", { ascending: false }).limit(100);
  const sessions = (data ?? []) as ExamSessionRow[];
  if (!sessions.length) return [];
  const sessionIds = sessions.map((session) => session.id);
  const [offeringTargetsResult, classTargetsResult, offeringsResult, subjectsResult] = await Promise.all([
    client.from("exam_offering_targets").select("session_id,offering_id").in("session_id", sessionIds),
    client.from("exam_class_targets").select("session_id,class_id").in("session_id", sessionIds),
    client.from("class_subject_offerings").select("id,class_id,subject_id"),
    client.from("subjects").select("id,name"),
  ]);
  const classes = await listClasses(client);
  const classById = new Map(classes.map((row) => [row.id, row]));
  const offeringById = new Map(((offeringsResult.data ?? []) as { id: string; class_id: string; subject_id: string }[]).map((row) => [row.id, row]));
  const subjectById = new Map(((subjectsResult.data ?? []) as { id: string; name: string }[]).map((row) => [row.id, row.name]));
  const offeringTargets = (offeringTargetsResult.data ?? []) as { session_id: string; offering_id: string }[];
  const classTargets = (classTargetsResult.data ?? []) as { session_id: string; class_id: string }[];
  return sessions.map((session) => {
    const offeringRows = offeringTargets.filter((target) => target.session_id === session.id).map((target) => offeringById.get(target.offering_id)).filter(Boolean) as { id: string; class_id: string; subject_id: string }[];
    const subjectIds = [...new Set(offeringRows.map((row) => row.subject_id))];
    const targetedClassIds = new Set([
      ...classTargets.filter((target) => target.session_id === session.id).map((target) => target.class_id),
      ...offeringRows.map((row) => row.class_id),
    ]);
    return {
      ...session,
      subjectIds,
      subjectNames: subjectIds.map((id) => subjectById.get(id) ?? "Subject"),
      targetLabels: [...targetedClassIds].map((id) => classById.get(id)?.display_name ?? id),
    };
  });
}

export async function findSessionById(client: SupabaseClient, rawId: string): Promise<ExamSessionRow | null> {
  const id = rawId.toUpperCase();
  const { data } = await client.from("exam_sessions").select("*").eq("id", id).maybeSingle();
  return (data ?? null) as ExamSessionRow | null;
}

export async function listClasses(client: SupabaseClient): Promise<ClassDirectoryRow[]> {
  const [{ data: classData }, { data: levels }, { data: years }] = await Promise.all([
    client.from("classes").select("*").limit(300),
    client.from("academic_levels").select("id,name"),
    client.from("academic_years").select("id,name"),
  ]);
  const levelNames = new Map(((levels ?? []) as { id: string; name: string }[]).map((row) => [row.id, row.name]));
  const yearNames = new Map(((years ?? []) as { id: string; name: string }[]).map((row) => [row.id, row.name]));
  const trackNames = new Map([
    ["science", "Science"],
    ["humanities", "Humanities"],
    ["business", "Business"],
  ]);
  return ((classData ?? []) as ClassRow[]).map((row) => {
    const levelName = levelNames.get(row.level_id) ?? "Class";
    const trackName = trackNames.get(row.track) ?? row.track;
    return {
      ...row,
      level_name: levelName,
      track_name: trackName,
      academic_year_name: yearNames.get(row.academic_year_id) ?? "",
      display_name: `${levelName} ${trackName} ${row.arm}`.replace(/\s+/g, " ").trim(),
    };
  });
}

const QUESTION_PAGE_SIZE = 1000;

export async function listQuestions(client: SupabaseClient): Promise<QuestionRow[]> {
  const questions: QuestionRow[] = [];

  for (let from = 0; ; from += QUESTION_PAGE_SIZE) {
    const { data, error } = await client
      .from("questions")
      .select("*")
      .order("id", { ascending: true })
      .range(from, from + QUESTION_PAGE_SIZE - 1);

    if (error) {
      throw new Error(`Unable to load the question bank: ${error.message}`);
    }

    const page = (data ?? []) as QuestionRow[];
    questions.push(...page);
    if (page.length < QUESTION_PAGE_SIZE) break;
  }

  return questions;
}

export async function listActiveSubjects(client: SupabaseClient): Promise<SubjectRow[]> {
  const { data } = await client.from("subjects").select("*").eq("active", true).order("name");
  return (data ?? []) as SubjectRow[];
}

export async function attemptsForStudent(client: SupabaseClient, studentId: string): Promise<ExamAttemptRow[]> {
  const { data } = await client
    .from("exam_attempts")
    .select("*")
    .eq("student_id", studentId)
    .order("created_at", { ascending: false });
  return (data ?? []) as ExamAttemptRow[];
}
