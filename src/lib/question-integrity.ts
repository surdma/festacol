import type { createSupabaseAdminClient } from "@/lib/supabase/admin";

type AdminClient = ReturnType<typeof createSupabaseAdminClient>;

const ACTIVE_ATTEMPT_PAGE_SIZE = 500;

export async function activeAllocatedQuestionIds(
  admin: AdminClient,
  questionIds: readonly number[],
): Promise<Set<number>> {
  const requested = new Set(
    questionIds
      .map(Number)
      .filter((id) => Number.isSafeInteger(id) && id > 0),
  );
  const active = new Set<number>();
  if (!requested.size) return active;

  for (let offset = 0; ; offset += ACTIVE_ATTEMPT_PAGE_SIZE) {
    const { data, error } = await admin
      .from("exam_attempts")
      .select("question_ids")
      .is("submitted_at", null)
      .range(offset, offset + ACTIVE_ATTEMPT_PAGE_SIZE - 1);
    if (error) throw new Error(error.message);

    const rows = (data ?? []) as { question_ids: number[] | null }[];
    for (const row of rows) {
      for (const rawId of row.question_ids ?? []) {
        const id = Number(rawId);
        if (requested.has(id)) active.add(id);
      }
    }

    if (rows.length < ACTIVE_ATTEMPT_PAGE_SIZE || active.size === requested.size) break;
  }

  return active;
}

export function activeQuestionMutationMessage(questionId?: number): string {
  return questionId
    ? `Question ${questionId} is currently allocated to an examination in progress. Wait until every active attempt using it has finished before editing, replacing, or deleting it.`
    : "One or more selected questions are currently allocated to examinations in progress. Wait until those active attempts finish before changing the question bank.";
}
