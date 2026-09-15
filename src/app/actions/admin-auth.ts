"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { ActionResult } from "@/app/actions/student";

// Admin sign-in: email + password Supabase Auth. The account must carry
// app_metadata.role === "administrator" (set in Dashboard → Auth → Users).
// The proxy guard enforces this on every /admin/* request.
export async function signInAdminAction(input: { email: string; password: string; next?: string }): Promise<ActionResult & { next?: string }> {
  const email = input.email.trim().toLowerCase();
  if (!email || !input.password) return { ok: false, error: "Enter email and password." };
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password: input.password });
  if (error) return { ok: false, error: error.message };
  const { data } = await supabase.auth.getUser();
  const role =
    (data.user?.app_metadata?.role as string | undefined) ??
    (data.user?.user_metadata?.role as string | undefined);
  if (role !== "administrator") {
    await supabase.auth.signOut();
    return { ok: false, error: "This account is not an administrator." };
  }
  revalidatePath("/admin");
  return { ok: true, next: input.next && input.next.startsWith("/admin") ? input.next : "/admin" };
}

export async function signOutAdminAction() {
  const supabase = await createSupabaseServerClient();
  await supabase.auth.signOut();
  redirect("/admin/login");
}
