import { NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

// POST /api/admin/bootstrap — creates the FIRST administrator without
// touching Supabase web. Protected by SETUP_SECRET (not by session, since
// no admin exists yet to hold one).
// Body: { email, password, fullName?, setupSecret }
// Refuses when an administrator roster row already exists (recovery after
// that is Supabase web auth + the app_metadata SQL in the spec).
// Rotate/remove SETUP_SECRET after first use.
export async function POST(req: Request) {
  const body = (await req.json().catch(() => null)) as {
    email?: string; password?: string; fullName?: string; setupSecret?: string;
  } | null;
  const expected = process.env.SETUP_SECRET;
  if (!expected || body?.setupSecret !== expected) {
    return NextResponse.json({ error: "Forbidden." }, { status: 403 });
  }
  const email = (body.email ?? "").trim().toLowerCase();
  if (!email || (body.password ?? "").length < 8) {
    return NextResponse.json({ error: "Email and a password of 8+ characters are required." }, { status: 400 });
  }

  const admin = createSupabaseAdminClient();
  const { data: existing } = await admin.from("users").select("id").eq("role", "administrator").limit(1);
  if (existing && existing.length > 0) {
    return NextResponse.json({ error: "An administrator already exists." }, { status: 409 });
  }

  const fullName = (body.fullName ?? "").trim() || "Administrator";
  const parts = fullName.split(/\s+/);
  const { data: created, error: createError } = await admin.auth.admin.createUser({
    email,
    password: body.password!,
    email_confirm: true,
    user_metadata: { full_name: fullName },
    app_metadata: { role: "administrator" },
  });
  if (createError || !created.user) {
    return NextResponse.json({ error: createError?.message ?? "Create failed." }, { status: 400 });
  }
  const rosterId = `AD-${Date.now().toString(36).toUpperCase()}`;
  const { error: rosterError } = await admin.from("users").insert({
    id: rosterId,
    full_name: fullName,
    first_name: parts[0] ?? fullName,
    last_name: ((parts.slice(1).join(" ") || parts[0]) ?? fullName),
    role: "administrator",
    status: "active",
    academic_session: "2026/2027",
    promotion_status: "on-track",
    joined_at: Date.now(),
    auth_user_id: created.user.id,
    email,
    subjects: [],
    qualifier_access: true,
  });
  if (rosterError) {
    await admin.auth.admin.deleteUser(created.user.id);
    return NextResponse.json({ error: rosterError.message }, { status: 400 });
  }
  await admin.auth.admin.updateUserById(created.user.id, { app_metadata: { role: "administrator", staff_id: rosterId } });
  return NextResponse.json({ ok: true, id: rosterId });
}
