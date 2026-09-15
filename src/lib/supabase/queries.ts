import type { SupabaseClient } from "@supabase/supabase-js";
import type { ClassRow, ExamAttemptRow, ExamSessionRow, QuestionRow, SubjectRow } from "@/types/db";

async function count(client: SupabaseClient, table: string): Promise<number> {
  const { count } = await client.from(table).select("*", { count: "exact", head: true });
  return count ?? 0;
}

export async function getAdminCounts(client: SupabaseClient) {
  const [sessions, attempts, profiles, classes] = await Promise.all([
    count(client, "exam_sessions"),
    count(client, "exam_attempts"),
    count(client, "academic_profiles"),
    count(client, "classes"),
  ]);
  return { sessions, attempts, users: profiles, classes };
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
  track_name: string | null;
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
  let profileQuery = client
    .from("academic_profiles")
    .select("id,first_name,last_name,role,status")
    .order("last_name")
    .order("first_name")
    .limit(200);
  profileQuery = role === "student" ? profileQuery.eq("role", "student") : profileQuery.in("role", ["teacher", "administrator"]);
  if (q) {
    const escaped = q.replaceAll(",", " ");
    profileQuery = profileQuery.or(`first_name.ilike.%${escaped}%,last_name.ilike.%${escaped}%`);
  }
  const { data: profileData } = await profileQuery;
  const profiles = (profileData ?? []) as {
    id: string;
    first_name: string;
    last_name: string;
    role: "student" | "teacher" | "administrator";
    status: string;
  }[];
  if (!profiles.length) return [];

  const profileIds = profiles.map((profile) => profile.id);
  const [studentExtResult, staffExtResult, enrollmentResult, qualificationResult, subjectResult, assignmentResult, offeringResult] = await Promise.all([
    role === "student"
      ? client.from("student_academic_profiles").select("profile_id,student_number,phone,guardian,promotion_status").in("profile_id", profileIds)
      : Promise.resolve({ data: [] }),
    role === "staff"
      ? client.from("staff_academic_profiles").select("profile_id,staff_number,qualifier_access").in("profile_id", profileIds)
      : Promise.resolve({ data: [] }),
    role === "student"
      ? client.from("class_enrollments").select("student_profile_id,class_id,enrolled_at").in("student_profile_id", profileIds).is("ended_at", null)
      : Promise.resolve({ data: [] }),
    role === "staff"
      ? client.from("staff_subject_qualifications").select("staff_profile_id,subject_id").in("staff_profile_id", profileIds).eq("active", true)
      : Promise.resolve({ data: [] }),
    client.from("subjects").select("id,name").eq("active", true),
    role === "staff"
      ? client.from("teaching_assignments").select("staff_profile_id,offering_id,assigned_at").in("staff_profile_id", profileIds).is("ended_at", null)
      : Promise.resolve({ data: [] }),
    client.from("class_subject_offerings").select("id,class_id"),
  ]);

  const studentExt = new Map(
    ((studentExtResult.data ?? []) as { profile_id: string; student_number: string | null; phone: string; guardian: string; promotion_status: string }[])
      .map((row) => [row.profile_id, row]),
  );
  const staffExt = new Map(
    ((staffExtResult.data ?? []) as { profile_id: string; staff_number: string | null; qualifier_access: boolean }[])
      .map((row) => [row.profile_id, row]),
  );
  const enrollments = new Map<string, { class_id: string; enrolled_at: string }>();
  for (const row of ((enrollmentResult.data ?? []) as { student_profile_id: string; class_id: string; enrolled_at: string }[])) {
    const current = enrollments.get(row.student_profile_id);
    if (!current || row.enrolled_at > current.enrolled_at) enrollments.set(row.student_profile_id, { class_id: row.class_id, enrolled_at: row.enrolled_at });
  }
  const subjectNames = new Map(((subjectResult.data ?? []) as { id: string; name: string }[]).map((row) => [row.id, row.name]));
  const subjectIdsByStaff = new Map<string, string[]>();
  for (const row of ((qualificationResult.data ?? []) as { staff_profile_id: string; subject_id: string }[])) {
    subjectIdsByStaff.set(row.staff_profile_id, [...(subjectIdsByStaff.get(row.staff_profile_id) ?? []), row.subject_id]);
  }
  const offeringClass = new Map(((offeringResult.data ?? []) as { id: string; class_id: string }[]).map((row) => [row.id, row.class_id]));
  const staffClass = new Map<string, string>();
  for (const row of ((assignmentResult.data ?? []) as { staff_profile_id: string; offering_id: string; assigned_at: string }[])) {
    const classId = offeringClass.get(row.offering_id);
    if (classId && !staffClass.has(row.staff_profile_id)) staffClass.set(row.staff_profile_id, classId);
  }

  return profiles.map((profile) => {
    const student = studentExt.get(profile.id);
    const staff = staffExt.get(profile.id);
    const subjectIds = subjectIdsByStaff.get(profile.id) ?? [];
    return {
      id: profile.id,
      first_name: profile.first_name,
      last_name: profile.last_name,
      full_name: `${profile.first_name} ${profile.last_name}`.trim(),
      role: profile.role,
      status: profile.status,
      student_number: student?.student_number ?? null,
      staff_number: staff?.staff_number ?? null,
      phone: student?.phone ?? "",
      guardian: student?.guardian ?? "",
      promotion_status: student?.promotion_status ?? "",
      class_id: role === "student" ? enrollments.get(profile.id)?.class_id ?? null : staffClass.get(profile.id) ?? null,
      subject_ids: subjectIds,
      subjects: subjectIds.map((id) => subjectNames.get(id) ?? id),
      qualifier_access: Boolean(staff?.qualifier_access),
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
    ["art", "Art"],
    ["social_science", "Social Science"],
  ]);
  return ((classData ?? []) as ClassRow[]).map((row) => {
    const levelName = levelNames.get(row.level_id) ?? "Class";
    const trackName = row.track ? trackNames.get(row.track) ?? row.track : null;
    return {
      ...row,
      level_name: levelName,
      track_name: trackName,
      academic_year_name: yearNames.get(row.academic_year_id) ?? "",
      display_name: `${levelName} ${trackName ?? ""} ${row.arm}`.replace(/\s+/g, " ").trim(),
    };
  });
}

export async function listQuestions(client: SupabaseClient): Promise<QuestionRow[]> {
  const { data } = await client.from("questions").select("*").order("id").limit(120);
  return (data ?? []) as QuestionRow[];
}

export async function listActiveSubjects(client: SupabaseClient): Promise<SubjectRow[]> {
  const { data } = await client.from("subjects").select("*").eq("active", true).order("name");
  return (data ?? []) as SubjectRow[];
}

export async function attemptsForStudent(client: SupabaseClient, studentProfileId: string): Promise<ExamAttemptRow[]> {
  const { data } = await client
    .from("exam_attempts")
    .select("*")
    .eq("student_profile_id", studentProfileId)
    .order("created_at", { ascending: false });
  return (data ?? []) as ExamAttemptRow[];
}
