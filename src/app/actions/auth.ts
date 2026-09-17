"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { safeStaffDestination, safeStudentDestination } from "@/lib/auth/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";

type AuthSurface = "student" | "staff";

function formString(formData: FormData, key: string): string | undefined {
  const value = formData.get(key);
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

async function clearSupabaseAuthCookies() {
  const cookieStore = await cookies();
  for (const cookie of cookieStore.getAll()) {
    if (cookie.name.startsWith("sb-") && cookie.name.includes("-auth-token")) {
      cookieStore.delete(cookie.name);
    }
  }
}

/**
 * End the current browser session and perform a full server redirect. Supabase
 * remains the only session source; no client auth cache is maintained.
 */
export async function signOutSessionAction(formData: FormData): Promise<never> {
  const surface: AuthSurface = formString(formData, "surface") === "staff" ? "staff" : "student";
  const rawNext = formString(formData, "next");
  const supabase = await createSupabaseServerClient();

  // `local` ends this browser session without invalidating other devices. If
  // the remote refresh token is already stale, cookie cleanup below still
  // guarantees that this browser cannot remain stuck in an authenticated loop.
  await supabase.auth.signOut({ scope: "local" }).catch(() => undefined);
  await clearSupabaseAuthCookies();

  if (surface === "staff") {
    const next = safeStaffDestination(rawNext);
    redirect(next ? `/workspace/login?next=${encodeURIComponent(next)}` : "/workspace/login");
  }

  const next = safeStudentDestination(rawNext);
  redirect(next ? `/?next=${encodeURIComponent(next)}` : "/");
}
