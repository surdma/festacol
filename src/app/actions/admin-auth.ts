"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { ActionResult } from "@/app/actions/student";

// Staff login is authenticated by Supabase Auth, then authorized by the linked
// academic profile. JWT metadata is never the source of role authorization.
export async function signInAdminAction(input: { email: string; password: string; next?: string }): Promise<ActionResult & { next?: string }> {
  const email = input.email.trim().toLowerCase();
  if (!email || !input.password) return { ok: false, error: "Enter email and password." };
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password: input.password });
  if (error) return { ok: false, error: error.message };
  const { data } = await supabase.auth.getUser();
  const user = data.user;
  if (!user) return { ok: false, error: "Authentication failed." };
  const { data: profile } = await supabase
    .from("academic_profiles")
    .select("id,role,status")
    .eq("auth_user_id", user.id)
    .eq("status", "active")
    .in("role", ["teacher", "administrator"])
    .maybeSingle();
  if (!profile) {
    await supabase.auth.signOut();
    return { ok: false, error: "This Auth account is not linked to an active staff profile." };
  }
  revalidatePath("/admin");
  return { ok: true, next: input.next && input.next.startsWith("/admin") ? input.next : "/admin" };
}

export async function signOutAdminAction() {
  const supabase = await createSupabaseServerClient();
  await supabase.auth.signOut();
  redirect("/admin/login");
}
