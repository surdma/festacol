import { type NextRequest, NextResponse } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";
import { createServerClient } from "@supabase/ssr";

// Next.js 16: `proxy.ts` replaces `middleware.ts`.
// Refreshes the session, then guards /admin/* (except /admin/login):
// only Supabase users with app_metadata.role === "administrator" pass.
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
    const role =
      (data.user?.app_metadata?.role as string | undefined) ??
      (data.user?.user_metadata?.role as string | undefined);
    if (!data.user || (role !== "administrator" && role !== "teacher")) {
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
