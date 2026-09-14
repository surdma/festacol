import type { SupabaseClient } from "@supabase/supabase-js";
import type { ClassRow, ExamAttemptRow, ExamSessionRow, ExamStateRow, QuestionRow, StudentProfileRow, SubjectRow, UserRow } from "@/types/db";

async function count(client: SupabaseClient, table: string): Promise<number> {
  const { count } = await client.from(table).select("*", { count: "exact", head: true });
  return count ?? 0;
}

export async function getAdminCounts(client: SupabaseClient) {
  const [sessions, attempts, users, classes] = await Promise.all([
    count(client, "exam_sessions"),
    count(client, "exam_attempts"),
    count(client, "users"),
    count(client, "classes"),
  ]);
  return { sessions, attempts, users, classes };
}

export async function listUsers(client: SupabaseClient, role: "student" | "staff", q = ""): Promise<UserRow[]> {
  let query = client.from("users").select("*").order("full_name").limit(200);
  if (role === "student") query = query.eq("role", "student");
  else query = query.in("role", ["teacher", "administrator"]);
  if (q) query = query.ilike("full_name", `%${q}%`);
  const { data } = await query;
  return (data ?? []) as UserRow[];
}

export async function listSessions(client: SupabaseClient): Promise<ExamSessionRow[]> {
  const { data } = await client.from("exam_sessions").select("*").order("updated_at", { ascending: false }).limit(100);
  return (data ?? []) as ExamSessionRow[];
}

export async function findSessionById(client: SupabaseClient, rawId: string): Promise<ExamSessionRow | null> {
  const id = rawId.toUpperCase();
  const { data } = await client.from("exam_sessions").select("*").or(`id.eq.${id},id.ilike.${id}`).limit(1).maybeSingle();
  return (data ?? null) as ExamSessionRow | null;
}

export async function listClasses(client: SupabaseClient): Promise<ClassRow[]> {
  const { data } = await client.from("classes").select("*").limit(100);
  return (data ?? []) as ClassRow[];
}

export async function listQuestions(client: SupabaseClient): Promise<QuestionRow[]> {
  const { data } = await client.from("questions").select("*").order("id").limit(120);
  return (data ?? []) as QuestionRow[];
}

export async function listActiveSubjects(client: SupabaseClient): Promise<SubjectRow[]> {
  const { data } = await client.from("subjects").select("*").eq("active", true).order("name");
  return (data ?? []) as SubjectRow[];
}

export async function attemptsForStudent(client: SupabaseClient, studentHash: string): Promise<ExamAttemptRow[]> {
  const { data } = await client.from("exam_attempts").select("*").eq("student_hash", studentHash).order("created_at", { ascending: false });
  return (data ?? []) as ExamAttemptRow[];
}

export async function getStudentProfile(client: SupabaseClient, studentHash: string): Promise<StudentProfileRow | null> {
  const { data } = await client.from("student_profiles").select("*").eq("student_hash", studentHash).maybeSingle();
  return (data ?? null) as StudentProfileRow | null;
}

export async function getExamState(client: SupabaseClient, sessionId: string, candidateHash: string): Promise<ExamStateRow | null> {
  const { data } = await client
    .from("exam_states")
    .select("*")
    .eq("session_id", sessionId)
    .eq("candidate_hash", candidateHash)
    .maybeSingle();
  return (data ?? null) as ExamStateRow | null;
}

export async function saveExamState(
  client: SupabaseClient,
  sessionId: string,
  candidateHash: string,
  state: Record<string, unknown>,
): Promise<void> {
  await client.from("exam_states").upsert(
    { session_id: sessionId, candidate_hash: candidateHash, state, updated_at: Date.now() },
    { onConflict: "session_id,candidate_hash" },
  );
}
