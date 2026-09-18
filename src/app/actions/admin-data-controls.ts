"use server";

import { revalidatePath } from "next/cache";
import type { ActionResult } from "@/app/actions/student";
import { currentStaff } from "@/lib/auth/staff";
import { activeAllocatedQuestionIds } from "@/lib/question-integrity";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export type CleanupKind = "attempts" | "sessions" | "staff-questions" | "whatsapp" | "integrity-events";

export interface AttemptFilter {
  mode: "unsubmitted" | "submitted" | "all";
  olderThanDays?: number | null;
  sessionId?: string | null;
}

export interface SessionFilter {
  status: "draft" | "closed" | "non-open";
  termId?: string | null;
  olderThanDays?: number | null;
}

export interface StaffQuestionFilter {
  subjectId?: string | null;
}

export interface WhatsappFilter {
  classId?: string | null;
}

export interface IntegrityFilter {
  olderThanDays?: number | null;
}

export type CleanupFilter = AttemptFilter | SessionFilter | StaffQuestionFilter | WhatsappFilter | IntegrityFilter;

export interface CleanupOverview {
  sessions: { total: number | null; draft: number | null; open: number | null; closed: number | null };
  attempts: { total: number | null; submitted: number | null; inProgress: number | null };
  responses: number | null;
  integrityEvents: number | null;
  staffQuestions: number | null;
  preparedQuestions: number | null;
  whatsappLinks: number | null;
}

export interface CleanupOptionLists {
  sessions: { id: string; title: string; status: string }[];
  classes: { id: string; label: string }[];
  subjects: { id: string; code: string; name: string }[];
  terms: { id: string; name: string; year: string; status: string }[];
}

export interface CleanupPreview {
  total: number;
  note?: string;
}

export interface CleanupChunk {
  deleted: number;
  skipped: number;
  total: number;
  done: boolean;
  note?: string;
}

type AdminClient = ReturnType<typeof createSupabaseAdminClient>;

interface CountQueryResult {
  count: number | null;
  error: { message: string } | null;
}

interface CountQuery extends PromiseLike<CountQueryResult> {
  eq(column: string, value: unknown): CountQuery;
  neq(column: string, value: unknown): CountQuery;
  not(column: string, operator: string, value: unknown): CountQuery;
  is(column: string, value: unknown): CountQuery;
  lt(column: string, value: unknown): CountQuery;
}

async function requireAdmin(): Promise<AdminClient> {
  const current = await currentStaff();
  if (!current.scope.profileId || !current.scope.isAdmin) throw new Error("Administrator sign-in required.");
  return createSupabaseAdminClient();
}

function olderThanCutoff(days?: number | null): number | null {
  if (!days || !Number.isFinite(days) || days <= 0) return null;
  return Date.now() - Math.floor(days) * 86_400_000;
}

async function headCount(
  admin: AdminClient,
  table: string,
  apply: (query: CountQuery) => CountQuery,
  column = "id",
): Promise<number> {
  const query = admin.from(table).select(column, { count: "exact", head: true }) as unknown as CountQuery;
  const { count, error } = await apply(query);
  if (error) throw new Error(error.message);
  return count ?? 0;
}

export async function getCleanupOverviewAction(): Promise<ActionResult & { overview?: CleanupOverview }> {
  try {
    const admin = await requireAdmin();
    // Settled individually: one failing count must never blank the whole page.
    const results = await Promise.allSettled([
      headCount(admin, "exam_sessions", (q) => q),
      headCount(admin, "exam_sessions", (q) => q.eq("status", "draft")),
      headCount(admin, "exam_sessions", (q) => q.eq("status", "open")),
      headCount(admin, "exam_sessions", (q) => q.eq("status", "closed")),
      headCount(admin, "exam_attempts", (q) => q),
      headCount(admin, "exam_attempts", (q) => q.not("submitted_at", "is", null)),
      // exam_attempt_responses has a composite key (attempt_id, question_id) and no id column.
      headCount(admin, "exam_attempt_responses", (q) => q, "attempt_id"),
      headCount(admin, "exam_integrity_events", (q) => q),
      headCount(admin, "questions", (q) => q.not("creator_id", "is", null)),
      headCount(admin, "questions", (q) => q.is("creator_id", null)),
      headCount(admin, "whatsapp_groups", (q) => q),
    ]);
    const values = results.map((result) => (result.status === "fulfilled" ? result.value : null));
    const [
      sessionsTotal,
      sessionsDraft,
      sessionsOpen,
      sessionsClosed,
      attemptsTotal,
      attemptsSubmitted,
      responses,
      integrityEvents,
      staffQuestions,
      preparedQuestions,
      whatsappLinks,
    ] = values;
    if (values.every((value) => value === null)) {
      throw new Error("No storage counts could be loaded.");
    }
    return {
      ok: true,
      overview: {
        sessions: { total: sessionsTotal, draft: sessionsDraft, open: sessionsOpen, closed: sessionsClosed },
        attempts: {
          total: attemptsTotal,
          submitted: attemptsSubmitted,
          inProgress: attemptsTotal !== null && attemptsSubmitted !== null ? attemptsTotal - attemptsSubmitted : null,
        },
        responses,
        integrityEvents,
        staffQuestions,
        preparedQuestions,
        whatsappLinks,
      },
    };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "Storage overview could not be loaded." };
  }
}

export async function listCleanupOptionsAction(): Promise<ActionResult & { options?: CleanupOptionLists }> {
  try {
    const admin = await requireAdmin();
    const [{ data: sessions, error: sessionError }, { data: classes, error: classError }, { data: subjects, error: subjectError }, { data: terms, error: termError }] =
      await Promise.all([
        admin.from("exam_sessions").select("id,title,status").order("updated_at", { ascending: false }).limit(200),
        admin.from("classes").select("id,arm,track,level:academic_levels(name)").order("id").limit(500),
        admin.from("subjects").select("id,code,name").order("name").limit(500),
        admin.from("academic_terms").select("id,name,status,academic_year:academic_years(name)").order("sequence").limit(100),
      ]);
    if (sessionError || classError || subjectError || termError) {
      throw new Error(sessionError?.message ?? classError?.message ?? subjectError?.message ?? termError?.message);
    }
    return {
      ok: true,
      options: {
        sessions: ((sessions ?? []) as { id: string; title: string; status: string }[]).map((row) => ({
          id: row.id,
          title: row.title,
          status: row.status,
        })),
        classes: ((classes ?? []) as unknown as { id: string; arm: string; track: string; level: { name: string } | { name: string }[] | null }[]).map((row) => ({
          id: row.id,
          label: `${Array.isArray(row.level) ? row.level[0]?.name : row.level?.name ?? row.id} · ${row.track} · ${row.arm}`,
        })),
        subjects: ((subjects ?? []) as { id: string; code: string; name: string }[]).map((row) => ({
          id: row.id,
          code: row.code,
          name: row.name,
        })),
        terms: ((terms ?? []) as unknown as { id: string; name: string; status: string; academic_year: { name: string } | { name: string }[] | null }[]).map((row) => ({
          id: row.id,
          name: row.name,
          year: (Array.isArray(row.academic_year) ? row.academic_year[0]?.name : row.academic_year?.name) ?? "",
          status: row.status,
        })),
      },
    };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "Clean-up options could not be loaded." };
  }
}

function applyAttemptFilter(query: CountQuery, filter: AttemptFilter): CountQuery {
  let next = query;
  if (filter.mode === "submitted") next = next.not("submitted_at", "is", null);
  if (filter.mode === "unsubmitted") next = next.is("submitted_at", null);
  const cutoff = olderThanCutoff(filter.olderThanDays);
  if (cutoff !== null) next = next.lt("created_at", cutoff);
  if (filter.sessionId) next = next.eq("session_id", filter.sessionId);
  return next;
}

function applySessionFilter(query: CountQuery, filter: SessionFilter): CountQuery {
  // Open sessions are never removable: they may be live in classrooms.
  let next = filter.status === "non-open" ? query.neq("status", "open") : query.eq("status", filter.status);
  const cutoff = olderThanCutoff(filter.olderThanDays);
  if (cutoff !== null) next = next.lt("created_at", cutoff);
  if (filter.termId) next = next.eq("academic_term_id", filter.termId);
  return next;
}

export async function previewCleanupAction(
  kind: CleanupKind,
  filter: CleanupFilter,
): Promise<ActionResult & { preview?: CleanupPreview }> {
  try {
    const admin = await requireAdmin();
    if (kind === "attempts") {
      const total = await headCount(admin, "exam_attempts", (q) => applyAttemptFilter(q, filter as AttemptFilter));
      return { ok: true, preview: { total } };
    }
    if (kind === "sessions") {
      const total = await headCount(admin, "exam_sessions", (q) => applySessionFilter(q, filter as SessionFilter));
      return { ok: true, preview: { total, note: "Open sessions are never included. Their results are removed first." } };
    }
    if (kind === "staff-questions") {
      const subjectId = (filter as StaffQuestionFilter).subjectId ?? null;
      let query = admin.from("questions").select("id", { count: "exact", head: true }).not("creator_id", "is", null);
      if (subjectId) query = query.eq("subject_id", subjectId);
      const { count, error } = await query;
      if (error) throw new Error(error.message);
      const total = count ?? 0;
      // Questions used in marked results cannot be deleted (results reference them).
      // Enumerate candidates in chunks to find the referenced ones.
      let protectedCount = 0;
      const pageSize = 1000;
      for (let offset = 0; offset < total; offset += pageSize) {
        let page = admin.from("questions").select("id").not("creator_id", "is", null).order("id").range(offset, offset + pageSize - 1);
        if (subjectId) page = page.eq("subject_id", subjectId);
        const { data, error: pageError } = await page;
        if (pageError) throw new Error(pageError.message);
        const ids = ((data ?? []) as { id: number }[]).map((row) => Number(row.id));
        if (!ids.length) break;
        const blocked = new Set(await activeAllocatedQuestionIds(admin, ids));
        for (let start = 0; start < ids.length; start += 500) {
          const slice = ids.slice(start, start + 500);
          const { data: refs, error: refError } = await admin.from("exam_attempt_responses").select("question_id").in("question_id", slice);
          if (refError) throw new Error(refError.message);
          for (const row of (refs ?? []) as { question_id: number }[]) blocked.add(Number(row.question_id));
        }
        protectedCount += blocked.size;
      }
      return {
        ok: true,
        preview: {
          total: Math.max(0, total - protectedCount),
          note: protectedCount > 0
            ? `${protectedCount} used by active papers or marked results will be skipped automatically.`
            : undefined,
        },
      };
    }
    if (kind === "whatsapp") {
      const classId = (filter as WhatsappFilter).classId ?? null;
      const total = await headCount(admin, "whatsapp_groups", (q) => (classId ? q.eq("class_id", classId) : q));
      return { ok: true, preview: { total } };
    }
    const cutoff = olderThanCutoff((filter as IntegrityFilter).olderThanDays);
    const total = await headCount(admin, "exam_integrity_events", (q) => (cutoff !== null ? q.lt("at", cutoff) : q));
    return { ok: true, preview: { total } };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "Estimate could not be loaded." };
  }
}

const CHUNK_SIZES: Record<CleanupKind, number> = {
  attempts: 300,
  sessions: 50,
  "staff-questions": 500,
  whatsapp: 500,
  "integrity-events": 1000,
};

function revalidateCleanupTargets(kind: CleanupKind) {
  revalidatePath("/workspace/data-library");
  revalidatePath("/workspace/settings");
  if (kind === "attempts" || kind === "sessions" || kind === "integrity-events") {
    revalidatePath("/workspace/exams");
    revalidatePath("/workspace/reports");
    revalidatePath("/workspace/students");
    revalidatePath("/workspace/classes");
  }
  if (kind === "staff-questions") revalidatePath("/workspace/questions");
  if (kind === "whatsapp") revalidatePath("/workspace/classes");
}

export async function runCleanupChunkAction(
  kind: CleanupKind,
  filter: CleanupFilter,
): Promise<ActionResult & { chunk?: CleanupChunk }> {
  try {
    const admin = await requireAdmin();
    const finish = (deleted: number, skipped: number, remaining: number, note?: string): ActionResult & { chunk?: CleanupChunk } => {
      const done = remaining <= 0;
      if (done) revalidateCleanupTargets(kind);
      return { ok: true, chunk: { deleted, skipped, total: deleted + remaining, done, note } };
    };

    if (kind === "attempts") {
      const size = CHUNK_SIZES.attempts;
      const { data, error } = await applyAttemptFilter(admin.from("exam_attempts").select("id").order("created_at"), filter as AttemptFilter).limit(size);
      if (error) throw new Error(error.message);
      const ids = ((data ?? []) as { id: string }[]).map((row) => row.id);
      if (!ids.length) return finish(0, 0, 0);
      // Marked answers and check-in events cascade from the attempt.
      const { error: deleteError } = await admin.from("exam_attempts").delete().in("id", ids);
      if (deleteError) throw new Error(deleteError.message);
      const remaining = await headCount(admin, "exam_attempts", (q) => applyAttemptFilter(q, filter as AttemptFilter));
      return finish(ids.length, 0, remaining);
    }

    if (kind === "sessions") {
      const size = CHUNK_SIZES.sessions;
      const { data, error } = await applySessionFilter(admin.from("exam_sessions").select("id").order("created_at"), filter as SessionFilter).limit(size);
      if (error) throw new Error(error.message);
      const ids = ((data ?? []) as { id: string }[]).map((row) => row.id);
      if (!ids.length) return finish(0, 0, 0);
      // Attempts restrict session deletes, so results go first (set-based, one statement).
      const { error: attemptError } = await admin.from("exam_attempts").delete().in("session_id", ids);
      if (attemptError) throw new Error(attemptError.message);
      const { error: sessionError } = await admin.from("exam_sessions").delete().in("id", ids);
      if (sessionError) throw new Error(sessionError.message);
      const remaining = await headCount(admin, "exam_sessions", (q) => applySessionFilter(q, filter as SessionFilter));
      return finish(ids.length, 0, remaining, "Results under each removed session were cleared first.");
    }

    if (kind === "staff-questions") {
      const size = CHUNK_SIZES["staff-questions"];
      const subjectId = (filter as StaffQuestionFilter).subjectId ?? null;
      let query = admin.from("questions").select("id").not("creator_id", "is", null).order("id").limit(size);
      if (subjectId) query = query.eq("subject_id", subjectId);
      const { data, error } = await query;
      if (error) throw new Error(error.message);
      const ids = ((data ?? []) as { id: number }[]).map((row) => Number(row.id));
      if (!ids.length) return finish(0, 0, 0);
      const { data: refs, error: refError } = await admin.from("exam_attempt_responses").select("question_id").in("question_id", ids);
      if (refError) throw new Error(refError.message);
      const protectedIds = new Set(((refs ?? []) as { question_id: number }[]).map((row) => Number(row.question_id)));
      for (const id of await activeAllocatedQuestionIds(admin, ids)) protectedIds.add(id);
      const removable = ids.filter((id) => !protectedIds.has(id));
      if (removable.length) {
        // Class links and blanks cascade; prepared questions (creator_id null) are never matched here.
        const { error: deleteError } = await admin.from("questions").delete().in("id", removable);
        if (deleteError) throw new Error(deleteError.message.includes("question_in_active_exam") ? "A question became part of an active examination while cleanup was running. Retry after the active attempt finishes." : deleteError.message);
      }
      let remainingQuery = admin.from("questions").select("id", { count: "exact", head: true }).not("creator_id", "is", null);
      if (subjectId) remainingQuery = remainingQuery.eq("subject_id", subjectId);
      const { count, error: countError } = await remainingQuery;
      if (countError) throw new Error(countError.message);
      const skipped = ids.length - removable.length;
      return finish(
        removable.length,
        skipped,
        count ?? 0,
        skipped > 0 ? `${skipped} used by active papers or marked results were skipped.` : undefined,
      );
    }

    if (kind === "whatsapp") {
      const size = CHUNK_SIZES.whatsapp;
      const classId = (filter as WhatsappFilter).classId ?? null;
      let query = admin.from("whatsapp_groups").select("id").order("id").limit(size);
      if (classId) query = query.eq("class_id", classId);
      const { data, error } = await query;
      if (error) throw new Error(error.message);
      const ids = ((data ?? []) as { id: string }[]).map((row) => row.id);
      if (!ids.length) return finish(0, 0, 0);
      const { error: deleteError } = await admin.from("whatsapp_groups").delete().in("id", ids);
      if (deleteError) throw new Error(deleteError.message);
      let remainingQuery = admin.from("whatsapp_groups").select("id", { count: "exact", head: true });
      if (classId) remainingQuery = remainingQuery.eq("class_id", classId);
      const { count, error: countError } = await remainingQuery;
      if (countError) throw new Error(countError.message);
      return finish(ids.length, 0, count ?? 0);
    }

    const cutoff = olderThanCutoff((filter as IntegrityFilter).olderThanDays);
    const size = CHUNK_SIZES["integrity-events"];
    let eventQuery = admin.from("exam_integrity_events").select("id").order("id").limit(size);
    if (cutoff !== null) eventQuery = eventQuery.lt("at", cutoff);
    const { data, error } = await eventQuery;
    if (error) throw new Error(error.message);
    const ids = ((data ?? []) as { id: number }[]).map((row) => Number(row.id));
    if (!ids.length) return finish(0, 0, 0);
    const { error: deleteError } = await admin.from("exam_integrity_events").delete().in("id", ids);
    if (deleteError) throw new Error(deleteError.message);
    let remainingQuery = admin.from("exam_integrity_events").select("id", { count: "exact", head: true });
    if (cutoff !== null) remainingQuery = remainingQuery.lt("at", cutoff);
    const { count, error: countError } = await remainingQuery;
    if (countError) throw new Error(countError.message);
    return finish(ids.length, 0, count ?? 0);
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "The clean-up step could not be completed." };
  }
}
