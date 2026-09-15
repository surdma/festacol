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

async function deleteAll(supabase: Awaited<ReturnType<typeof requireAdmin>>, table: string, key = "id") {
  const { error } = await supabase.from(table).delete().not(key, "is", null);
  if (error) throw new Error(error.message);
}

export async function clearAdminDataScopeAction(scope: AdminDataScope): Promise<ActionResult> {
  try {
    const supabase = await requireAdmin();

    if (scope === "sessions") {
      await deleteAll(supabase, "exam_attempts");
      await deleteAll(supabase, "exam_sessions");
      revalidatePath("/admin/exams");
      revalidatePath("/admin/reports");
      revalidatePath("/admin/settings");
      return { ok: true };
    }

    if (scope === "activity") {
      await deleteAll(supabase, "exam_attempts");
      revalidatePath("/admin/students");
      revalidatePath("/admin/classes");
      revalidatePath("/admin/exams");
      revalidatePath("/admin/reports");
      revalidatePath("/admin/settings");
      return { ok: true };
    }

    if (scope === "whatsapp") {
      await deleteAll(supabase, "whatsapp_groups");
      revalidatePath("/admin/classes");
      revalidatePath("/admin/settings");
      return { ok: true };
    }

    if (scope === "custom-questions") {
      const { error } = await supabase.from("questions").delete().not("creator_id", "is", null);
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
