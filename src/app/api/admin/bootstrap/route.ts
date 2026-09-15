import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

// POST /api/admin/bootstrap creates the first administrator. SETUP_SECRET is
// required because no authenticated administrator exists yet to authorize it.
export async function POST(req: Request) {
  const body = (await req.json().catch(() => null)) as {
    email?: string;
    password?: string;
    fullName?: string;
    setupSecret?: string;
  } | null;

  const expected = process.env.SETUP_SECRET;
  if (!expected || body?.setupSecret !== expected) {
    return NextResponse.json({ error: "Forbidden." }, { status: 403 });
  }

  const email = (body?.email ?? "").trim().toLowerCase();
  const password = body?.password ?? "";
  if (!email || password.length < 8) {
    return NextResponse.json({ error: "Email and a password of 8+ characters are required." }, { status: 400 });
  }

  const admin = createSupabaseAdminClient();
  const { data: existing, error: existingError } = await admin
    .from("school_members")
    .select("id")
    .eq("role", "administrator")
    .limit(1);
  if (existingError) return NextResponse.json({ error: existingError.message }, { status: 500 });
  if ((existing ?? []).length > 0) {
    return NextResponse.json({ error: "An administrator already exists." }, { status: 409 });
  }

  const fullName = (body?.fullName ?? "").trim() || "Administrator";
  const parts = fullName.split(/\s+/).filter(Boolean);
  const firstName = parts[0] ?? "Administrator";
  const lastName = parts.slice(1).join(" ") || firstName;
  const memberId = randomUUID();
  const staffNumber = `AD-${Date.now().toString(36).toUpperCase()}`;

  const { data: created, error: createError } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name: fullName },
    app_metadata: { role: "administrator", school_member_id: memberId },
  });
  if (createError || !created.user) {
    return NextResponse.json({ error: createError?.message ?? "Administrator account could not be created." }, { status: 400 });
  }

  const { error: memberError } = await admin.from("school_members").insert({
    id: memberId,
    auth_user_id: created.user.id,
    role: "administrator",
    status: "active",
    first_name: firstName,
    last_name: lastName,
    staff_number: staffNumber,
    qualifier_access: true,
  });
  if (memberError) {
    await admin.auth.admin.deleteUser(created.user.id).catch(() => undefined);
    return NextResponse.json({ error: memberError.message }, { status: 400 });
  }

  return NextResponse.json({ ok: true, id: memberId, staffNumber });
}
