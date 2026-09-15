import type { SupabaseClient } from "@supabase/supabase-js";
import type { ClassRow, ExamAttemptRow, ExamResponseRow, ExamSessionRow, IntegrityEvent, QuestionRow, StudentProfileRow, SubjectRow, UserRow } from "@/types/db";

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

// Student attempt ownership is relational. Hashes are no longer identity.
export async function attemptsForStudent(client: SupabaseClient, studentProfileId: string): Promise<ExamAttemptRow[]> {
  const { data } = await client
    .from("exam_attempts")
    .select("*")
    .eq("student_profile_id", studentProfileId)
    .order("created_at", { ascending: false });
  return (data ?? []) as ExamAttemptRow[];
}

/** @deprecated Legacy migration lookup only. Runtime identity uses academic_profiles. */
export async function getStudentProfile(client: SupabaseClient, studentHash: string): Promise<StudentProfileRow | null> {
  const { data } = await client.from("student_profiles").select("*").eq("student_hash", studentHash).maybeSingle();
  return (data ?? null) as StudentProfileRow | null;
}

export interface ExamProgress {
  started_at: number | null;
  submitted_at: number | null;
  current_index: number;
  remaining_seconds: number;
  elapsed_active_seconds: number;
  last_active_at: number | null;
  attempt_hash: string;
  paper_fingerprint: string;
  question_ids: number[];
  responses: ExamResponseRow[];
}

export async function getExamProgress(
  client: SupabaseClient,
  sessionId: string,
  candidateHash: string,
): Promise<ExamProgress | null> {
  const [{ data: header }, { data: responses }] = await Promise.all([
    client.from("exam_states").select("*").eq("session_id", sessionId).eq("candidate_hash", candidateHash).maybeSingle(),
    client.from("exam_responses").select("*").eq("session_id", sessionId).eq("candidate_hash", candidateHash),
  ]);
  if (!header) return null;
  const h = header as Record<string, number | string | null>;
  return {
    started_at: h.started_at as number | null,
    submitted_at: h.submitted_at as number | null,
    current_index: Number(h.current_index ?? 0),
    remaining_seconds: Number(h.remaining_seconds ?? 0),
    elapsed_active_seconds: Number(h.elapsed_active_seconds ?? 0),
    last_active_at: h.last_active_at as number | null,
    attempt_hash: String(h.attempt_hash ?? ""),
    paper_fingerprint: String(h.paper_fingerprint ?? ""),
    question_ids: (h.question_ids ?? []) as number[],
    responses: (responses ?? []) as ExamResponseRow[],
  };
}

export async function saveExamProgress(
  client: SupabaseClient,
  sessionId: string,
  candidateHash: string,
  header: Record<string, number | string | number[] | null>,
  responses: { question_id: number; response_text: string | null; response_values: string[]; seconds: number; flagged: boolean }[],
): Promise<void> {
  await client.from("exam_states").upsert(
    { session_id: sessionId, candidate_hash: candidateHash, ...header, updated_at: Date.now() },
    { onConflict: "session_id,candidate_hash" },
  );
  if (responses.length) {
    await client.from("exam_responses").upsert(
      responses.map((response) => ({ session_id: sessionId, candidate_hash: candidateHash, ...response })),
      { onConflict: "session_id,candidate_hash,question_id" },
    );
  }
}

export async function getIntegrityEvents(client: SupabaseClient, sessionId: string, candidateHash: string): Promise<IntegrityEvent[]> {
  const { data } = await client
    .from("exam_integrity_events")
    .select("type,detail,at")
    .eq("session_id", sessionId)
    .eq("candidate_hash", candidateHash)
    .order("at", { ascending: false })
    .limit(100);
  return ((data ?? []) as IntegrityEvent[]).reverse();
}

export async function recordIntegrityEvent(
  client: SupabaseClient,
  sessionId: string,
  candidateHash: string,
  type: string,
  detail?: string,
): Promise<void> {
  await client.from("exam_integrity_events").insert({
    session_id: sessionId,
    candidate_hash: candidateHash,
    type,
    detail: detail ?? "",
    at: Date.now(),
  });
  const { data } = await client
    .from("exam_integrity_events")
    .select("id")
    .eq("session_id", sessionId)
    .eq("candidate_hash", candidateHash)
    .order("id", { ascending: false })
    .range(100, 500);
  const overflow = (data ?? []) as { id: number }[];
  if (overflow.length) {
    await client.from("exam_integrity_events").delete().in("id", overflow.map((row) => row.id));
  }
}
