import { type NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { updateSession } from "@/lib/supabase/middleware";

// Next.js 16 proxy: refresh the Supabase session, then authorize staff routes
// through the database-owned academic profile rather than JWT role metadata.
export default async function proxy(request: NextRequest) {
  const response = await updateSession(request);
  const path = request.nextUrl.pathname;

  if (path.startsWith("/admin") && !path.startsWith("/admin/login")) {
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll: () => request.cookies.getAll(),
          setAll: () => undefined,
        },
      },
    );
    const { data } = await supabase.auth.getUser();
    const user = data.user;
    if (!user) {
      const login = new URL("/admin/login", request.url);
      login.searchParams.set("next", path);
      return NextResponse.redirect(login);
    }
    const { data: profile } = await supabase
      .from("academic_profiles")
      .select("role,status")
      .eq("auth_user_id", user.id)
      .eq("status", "active")
      .in("role", ["teacher", "administrator"])
      .maybeSingle();
    if (!profile) {
      const login = new URL("/admin/login", request.url);
      login.searchParams.set("next", path);
      return NextResponse.redirect(login);
    }
    return response;
  }

  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"],
};
