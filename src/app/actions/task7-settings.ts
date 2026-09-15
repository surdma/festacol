"use server";

import { revalidatePath } from "next/cache";
import type { ActionResult } from "@/app/actions/student";
import { currentStaff } from "@/lib/auth/staff";

export type AdminDataScope = "sessions" | "activity" | "whatsapp" | "custom-questions";

async function requireAdmin() {
  const context = await currentStaff();
  if (!context.scope.isAdmin) throw new Error("Administrator sign-in required.");
  return context.supabase;
}

async function deleteAllByStringKey(supabase: Awaited<ReturnType<typeof requireAdmin>>, table: string, key: string) {
  const { error } = await supabase.from(table).delete().neq(key, "");
  if (error) throw new Error(error.message);
}

export async function clearAdminDataScopeAction(scope: AdminDataScope): Promise<ActionResult> {
  try {
    const supabase = await requireAdmin();

    if (scope === "sessions") {
      // ExamAttempt.sessionId uses ON DELETE SET NULL, so submitted audit records
      // survive while live states, proctor policy and session-owned markers cascade.
      await deleteAllByStringKey(supabase, "exam_sessions", "id");
      revalidatePath("/admin/exams");
      revalidatePath("/admin/reports");
      revalidatePath("/admin/settings");
      return { ok: true };
    }

    if (scope === "activity") {
      // Integrity events do not carry a database FK to ExamAttempt. Clear them
      // explicitly before deleting attempts so no event is left orphaned.
      const { error: integrityError } = await supabase.from("exam_integrity_events").delete().gt("id", 0);
      if (integrityError) throw new Error(integrityError.message);
      await deleteAllByStringKey(supabase, "exam_states", "session_id");
      await deleteAllByStringKey(supabase, "exam_reset_markers", "session_id");
      await deleteAllByStringKey(supabase, "exam_background_markers", "session_id");
      await deleteAllByStringKey(supabase, "exam_attempts", "attempt_hash");
      revalidatePath("/admin/students");
      revalidatePath("/admin/classes");
      revalidatePath("/admin/exams");
      revalidatePath("/admin/reports");
      revalidatePath("/admin/settings");
      return { ok: true };
    }

    if (scope === "whatsapp") {
      await deleteAllByStringKey(supabase, "whatsapp_groups", "id");
      revalidatePath("/admin/classes");
      revalidatePath("/admin/settings");
      return { ok: true };
    }

    if (scope === "custom-questions") {
      // Bank questions are seeded with created_by = null. Preserve them and
      // delete only staff/admin-authored records; attempt answer question FKs
      // become NULL and historical answer text remains intact.
      const { error } = await supabase.from("questions").delete().not("created_by", "is", null);
      if (error) throw new Error(error.message);
      revalidatePath("/admin/questions");
      revalidatePath("/admin/settings");
      return { ok: true };
    }

    return { ok: false, error: "Unsupported data-management scope." };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "Data-management action failed." };
  }
}
