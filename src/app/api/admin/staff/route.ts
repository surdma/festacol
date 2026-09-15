import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

async function requireAdminSession() {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase.auth.getUser();
  const role =
    (data.user?.app_metadata?.role as string | undefined) ??
    (data.user?.user_metadata?.role as string | undefined);
  if (!data.user || role !== "administrator") return null;
  return supabase;
}

function cleanSubjects(input: unknown): string[] {
  const list = Array.isArray(input) ? input : String(input ?? "").split(",");
  return [...new Set(list.map((s) => String(s).trim()).filter(Boolean))].slice(0, 12);
}

// POST /api/admin/staff — provision staff login (admin session required).
// Creates the auth user (pre-confirmed, app_metadata.role=teacher) AND the
// linked roster row. Teachers can never reach this: requireAdminSession()
// rejects them, so staff cannot add other staff.
export async function POST(req: Request) {
  if (!(await requireAdminSession())) return NextResponse.json({ error: "Administrator sign-in required." }, { status: 403 });
  const body = (await req.json().catch(() => null)) as {
    email?: string; password?: string; fullName?: string; subjects?: unknown;
    qualifierAccess?: boolean; classId?: string;
  } | null;
  const email = (body?.email ?? "").trim().toLowerCase();
  const fullName = (body?.fullName ?? "").trim();
  if (!email || fullName.length < 3) return NextResponse.json({ error: "Email and full name are required." }, { status: 400 });
  if ((body?.password ?? "").length < 8) return NextResponse.json({ error: "Password of 8+ characters is required." }, { status: 400 });

  const admin = createSupabaseAdminClient();
  const parts = fullName.split(/\s+/);
  const rosterId = `ST-${Date.now().toString(36).toUpperCase()}`;
  const { data: created, error: createError } = await admin.auth.admin.createUser({
    email,
    password: body!.password!,
    email_confirm: true,
    user_metadata: { full_name: fullName },
    app_metadata: { role: "teacher", staff_id: rosterId },
  });
  if (createError || !created.user) return NextResponse.json({ error: createError?.message ?? "Create failed." }, { status: 400 });

  const { error: rosterError } = await admin.from("users").insert({
    id: rosterId,
    full_name: fullName,
    first_name: parts[0] ?? fullName,
    last_name: ((parts.slice(1).join(" ") || parts[0]) ?? fullName),
    class_id: body?.classId || null,
    role: "teacher",
    status: "active",
    academic_session: "2026/2027",
    promotion_status: "on-track",
    joined_at: Date.now(),
    auth_user_id: created.user.id,
    email,
    subjects: cleanSubjects(body?.subjects),
    qualifier_access: Boolean(body?.qualifierAccess),
  });
  if (rosterError) {
    await admin.auth.admin.deleteUser(created.user.id);
    return NextResponse.json({ error: rosterError.message }, { status: 400 });
  }
  return NextResponse.json({ ok: true, id: rosterId });
}

// PATCH /api/admin/staff — update staff scope (admin session required).
// Body: { id, subjects?, qualifierAccess?, classId?, status? }
export async function PATCH(req: Request) {
  if (!(await requireAdminSession())) return NextResponse.json({ error: "Administrator sign-in required." }, { status: 403 });
  const body = (await req.json().catch(() => null)) as {
    id?: string; subjects?: unknown; qualifierAccess?: boolean; classId?: string; status?: string;
  } | null;
  if (!body?.id) return NextResponse.json({ error: "Staff id is required." }, { status: 400 });

  const admin = createSupabaseAdminClient();
  const { data: row } = await admin.from("users").select("auth_user_id").eq("id", body.id).maybeSingle();
  const patch: Record<string, unknown> = {};
  if (body.subjects !== undefined) patch.subjects = cleanSubjects(body.subjects);
  if (body.qualifierAccess !== undefined) patch.qualifier_access = Boolean(body.qualifierAccess);
  if (body.classId !== undefined) patch.class_id = body.classId || null;
  if (body.status !== undefined) {
    if (!["active", "inactive"].includes(body.status)) return NextResponse.json({ error: "Invalid status." }, { status: 400 });
    patch.status = body.status;
  }
  if (!Object.keys(patch).length) return NextResponse.json({ error: "Nothing to update." }, { status: 400 });
  const { error } = await admin.from("users").update(patch).eq("id", body.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  const authId = (row as { auth_user_id: string | null } | null)?.auth_user_id;
  if (authId && body.status) {
    if (body.status === "inactive") await admin.auth.admin.signOut(authId).catch(() => undefined);
  }
  return NextResponse.json({ ok: true });
}
