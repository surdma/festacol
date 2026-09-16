import { createServerClient } from "@supabase/ssr";
import { type NextRequest, NextResponse } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

// Next.js 16 proxy: refresh the Supabase session, then enforce role
// separation. Staff routes require an active teacher/administrator member;
// student dashboard routes require an active student member. Cross-role
// sessions are sent to /denied (never to the opposite login form), and
// anonymous dashboard visits preserve the full destination as ?next= so a
// logout-to-switch always returns to the page just left.
//
// Staff base is /workspace. Legacy /admin URLs redirect to the same suffix
// under /workspace before any auth check so bookmarks and old links keep
// working with their ?next= destination intact.
export default async function proxy(request: NextRequest) {
  const response = await updateSession(request);
  const path = request.nextUrl.pathname;
  const fullPath = `${request.nextUrl.pathname}${request.nextUrl.search}`;

  // Legacy staff-base redirect: /admin* -> /workspace* with the embedded
  // ?next=/admin/... destination rewritten to /workspace/... as well.
  if (path === "/admin" || path.startsWith("/admin/")) {
    const suffix = path.slice("/admin".length);
    const target = new URL(`/workspace${suffix}`, request.url);
    target.search = "";
    for (const [key, value] of request.nextUrl.searchParams) {
      if (key === "next" && value.startsWith("/admin")) {
        target.searchParams.append(key, `/workspace${value.slice("/admin".length)}`);
      } else {
        target.searchParams.append(key, value);
      }
    }
    return NextResponse.redirect(target);
  }

  function supabaseForRequest() {
    return createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll: () => request.cookies.getAll(),
          setAll: () => undefined,
        },
      },
    );
  }

  async function roleForUser(userId: string): Promise<string | null> {
    const supabase = supabaseForRequest();
    const { data: member } = await supabase
      .from("school_members")
      .select("role")
      .eq("auth_user_id", userId)
      .eq("status", "active")
      .maybeSingle();
    return (member as { role?: string } | null)?.role ?? null;
  }

  if (path.startsWith("/dashboard")) {
    const supabase = supabaseForRequest();
    const { data } = await supabase.auth.getUser();
    const user = data.user;
    if (!user) {
      // Public placement entry stays reachable so new students can join an
      // open qualifier directly through an exam link. The exam page itself
      // decides between entry form and sign-in redirect; every other
      // dashboard route is hidden here with its destination preserved.
      if (path.startsWith("/dashboard/exam")) return response;
      const login = new URL("/", request.url);
      login.searchParams.set("next", fullPath);
      return NextResponse.redirect(login);
    }
    const role = await roleForUser(user.id);
    if (role !== "student") {
      const denied = new URL("/denied", request.url);
      denied.searchParams.set("from", fullPath);
      denied.searchParams.set("reason", "staff-on-student");
      return NextResponse.redirect(denied);
    }
    return response;
  }

  if (path.startsWith("/workspace") && !path.startsWith("/workspace/login")) {
    const supabase = supabaseForRequest();
    const { data } = await supabase.auth.getUser();
    const user = data.user;
    if (!user) {
      const login = new URL("/workspace/login", request.url);
      login.searchParams.set("next", fullPath);
      return NextResponse.redirect(login);
    }
    const role = await roleForUser(user.id);
    if (role === "teacher" || role === "administrator") return response;
    if (role === "student") {
      const denied = new URL("/denied", request.url);
      denied.searchParams.set("from", fullPath);
      denied.searchParams.set("reason", "student-on-staff");
      return NextResponse.redirect(denied);
    }
    const login = new URL("/workspace/login", request.url);
    login.searchParams.set("next", fullPath);
    return NextResponse.redirect(login);
  }

  return response;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
