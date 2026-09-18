import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { currentStaff } from "@/lib/auth/staff";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

async function requireAdminSession() {
  const context = await currentStaff();
  return context.scope.isAdmin && context.scope.profileId ? context : null;
}

function uniqueIds(input: unknown): string[] {
  return [...new Set((Array.isArray(input) ? input : []).map((value) => String(value).trim()).filter(Boolean))].slice(0, 100);
}

async function resolveScope(admin: ReturnType<typeof createSupabaseAdminClient>, subjectIds: string[], offeringIds: string[]) {
  const [{ data: subjects, error: subjectError }, { data: offerings, error: offeringError }] = await Promise.all([
    subjectIds.length
      ? admin.from("subjects").select("id,code,name").in("id", subjectIds).eq("active", true).eq("kind", "curriculum")
      : Promise.resolve({ data: [], error: null }),
    offeringIds.length
      ? admin.from("class_subject_offerings").select("id,class_id,subject_id,status").in("id", offeringIds)
      : Promise.resolve({ data: [], error: null }),
  ]);

  if (subjectError || offeringError) {
    return { error: subjectError?.message ?? offeringError?.message ?? "Scope could not be resolved." } as const;
  }

  const subjectRows = (subjects ?? []) as { id: string; code: string; name: string }[];
  const offeringRows = (offerings ?? []) as { id: string; class_id: string; subject_id: string; status: string }[];
  if (subjectRows.length !== subjectIds.length) return { error: "One or more subjects are unavailable." } as const;
  if (offeringRows.length !== offeringIds.length || offeringRows.some((offering) => offering.status !== "active")) {
    return { error: "One or more teaching assignments reference an inactive offering." } as const;
  }

  const qualified = new Set(subjectIds);
  if (offeringRows.some((offering) => !qualified.has(offering.subject_id))) {
    return { error: "Every teaching assignment requires qualification in that offering's subject." } as const;
  }
  return { subjectRows, offeringRows } as const;
}

async function removeProvisionedMember(admin: ReturnType<typeof createSupabaseAdminClient>, memberId: string, authUserId: string) {
  await admin.from("school_members").delete().eq("id", memberId);
  await admin.auth.admin.deleteUser(authUserId).catch(() => undefined);
}

// POST /api/admin/staff provisions one Supabase Auth identity plus one canonical
// school member, subject qualifications and concrete class-subject assignments.
export async function POST(req: Request) {
  if (!(await requireAdminSession())) {
    return NextResponse.json({ error: "Administrator sign-in required." }, { status: 403 });
  }

  const body = (await req.json().catch(() => null)) as {
    email?: string;
    password?: string;
    fullName?: string;
    subjectIds?: unknown;
    offeringIds?: unknown;
    qualifierAccess?: boolean;
  } | null;
  const email = (body?.email ?? "").trim().toLowerCase();
  const password = body?.password ?? "";
  const fullName = (body?.fullName ?? "").trim();
  const subjectIds = uniqueIds(body?.subjectIds);
  const offeringIds = uniqueIds(body?.offeringIds);

  if (!email || fullName.length < 3) return NextResponse.json({ error: "Email and full name are required." }, { status: 400 });
  if (password.length < 8) return NextResponse.json({ error: "Password of 8+ characters is required." }, { status: 400 });
  if (!subjectIds.length) return NextResponse.json({ error: "Choose at least one subject qualification." }, { status: 400 });

  const admin = createSupabaseAdminClient();
  const scope = await resolveScope(admin, subjectIds, offeringIds);
  if ("error" in scope) return NextResponse.json({ error: scope.error }, { status: 400 });

  const memberId = randomUUID();
  const staffNumber = `ST-${Date.now().toString(36).toUpperCase()}`;
  const parts = fullName.split(/\s+/).filter(Boolean);
  const firstName = parts[0] ?? fullName;
  const lastName = parts.slice(1).join(" ") || firstName;

  const { data: created, error: createError } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name: fullName },
    app_metadata: { role: "teacher", school_member_id: memberId },
  });
  if (createError || !created.user) {
    return NextResponse.json({ error: createError?.message ?? "Authentication account could not be created." }, { status: 400 });
  }

  const { error: memberError } = await admin.from("school_members").insert({
    id: memberId,
    auth_user_id: created.user.id,
    role: "teacher",
    status: "active",
    first_name: firstName,
    last_name: lastName,
    staff_number: staffNumber,
  });
  if (memberError) {
    await removeProvisionedMember(admin, memberId, created.user.id);
    return NextResponse.json({ error: memberError.message }, { status: 400 });
  }

  const { error: qualificationError } = await admin.from("staff_subject_qualifications").insert(
    scope.subjectRows.map((subject) => ({ staff_id: memberId, subject_id: subject.id, active: true })),
  );
  if (qualificationError) {
    await removeProvisionedMember(admin, memberId, created.user.id);
    return NextResponse.json({ error: qualificationError.message }, { status: 400 });
  }

  if (scope.offeringRows.length) {
    const { error: assignmentError } = await admin.from("teaching_assignments").insert(
      scope.offeringRows.map((offering) => ({
        id: randomUUID(),
        staff_id: memberId,
        offering_id: offering.id,
        assignment_role: "teacher",
      })),
    );
    if (assignmentError) {
      await removeProvisionedMember(admin, memberId, created.user.id);
      return NextResponse.json({ error: assignmentError.message }, { status: 400 });
    }
  }

  return NextResponse.json({ ok: true, id: memberId, staffNumber });
}

// PATCH /api/admin/staff replaces active qualification/assignment scope while
// retaining assignment history by ending rows that are no longer selected.
export async function PATCH(req: Request) {
  if (!(await requireAdminSession())) {
    return NextResponse.json({ error: "Administrator sign-in required." }, { status: 403 });
  }

  const body = (await req.json().catch(() => null)) as {
    id?: string;
    subjectIds?: unknown;
    offeringIds?: unknown;
    qualifierAccess?: boolean;
    status?: string;
  } | null;
  if (!body?.id) return NextResponse.json({ error: "Staff id is required." }, { status: 400 });

  const admin = createSupabaseAdminClient();
  const { data: member } = await admin
    .from("school_members")
    .select("id,auth_user_id,role")
    .eq("id", body.id)
    .maybeSingle();
  const person = member as { id: string; auth_user_id: string | null; role: string } | null;
  if (!person || !["teacher", "administrator"].includes(person.role)) {
    return NextResponse.json({ error: "Staff record not found." }, { status: 404 });
  }

  const subjectIds = body.subjectIds === undefined ? null : uniqueIds(body.subjectIds);
  const offeringIds = body.offeringIds === undefined ? null : uniqueIds(body.offeringIds);
  let resolved: Awaited<ReturnType<typeof resolveScope>> | null = null;

  if (subjectIds !== null || offeringIds !== null) {
    const currentSubjectIds = subjectIds ?? ((await admin
      .from("staff_subject_qualifications")
      .select("subject_id")
      .eq("staff_id", person.id)
      .eq("active", true)).data ?? []).map((row) => String((row as { subject_id: string }).subject_id));
    const currentOfferingIds = offeringIds ?? ((await admin
      .from("teaching_assignments")
      .select("offering_id")
      .eq("staff_id", person.id)
      .is("ended_at", null)).data ?? []).map((row) => String((row as { offering_id: string }).offering_id));
    resolved = await resolveScope(admin, currentSubjectIds, currentOfferingIds);
    if ("error" in resolved) return NextResponse.json({ error: resolved.error }, { status: 400 });
  }

  if (body.status !== undefined && !["active", "inactive"].includes(body.status)) {
    return NextResponse.json({ error: "Invalid status." }, { status: 400 });
  }

  const memberPatch: Record<string, unknown> = {};
  if (body.status !== undefined) memberPatch.status = body.status;
  if (Object.keys(memberPatch).length) {
    memberPatch.updated_at = new Date().toISOString();
    const { error } = await admin.from("school_members").update(memberPatch).eq("id", person.id);
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  }

  if (resolved && !("error" in resolved)) {
    const activeSubjectIds = new Set(resolved.subjectRows.map((subject) => subject.id));
    await admin.from("staff_subject_qualifications").update({ active: false }).eq("staff_id", person.id);
    if (resolved.subjectRows.length) {
      const { error } = await admin.from("staff_subject_qualifications").upsert(
        resolved.subjectRows.map((subject) => ({ staff_id: person.id, subject_id: subject.id, active: true })),
        { onConflict: "staff_id,subject_id" },
      );
      if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    }

    const { data: existingAssignments, error: existingError } = await admin
      .from("teaching_assignments")
      .select("id,offering_id")
      .eq("staff_id", person.id)
      .is("ended_at", null);
    if (existingError) return NextResponse.json({ error: existingError.message }, { status: 400 });

    const desiredOfferingIds = new Set(resolved.offeringRows.map((offering) => offering.id));
    const existing = (existingAssignments ?? []) as { id: string; offering_id: string }[];
    const nowIso = new Date().toISOString();
    for (const assignment of existing) {
      if (!desiredOfferingIds.has(assignment.offering_id)) {
        const { error } = await admin.from("teaching_assignments").update({ ended_at: nowIso }).eq("id", assignment.id);
        if (error) return NextResponse.json({ error: error.message }, { status: 400 });
      }
    }

    const existingByOffering = new Set(existing.map((assignment) => assignment.offering_id));
    const additions = resolved.offeringRows.filter((offering) => !existingByOffering.has(offering.id));
    if (additions.length) {
      const { error } = await admin.from("teaching_assignments").insert(
        additions.map((offering) => ({
          id: randomUUID(),
          staff_id: person.id,
          offering_id: offering.id,
          assignment_role: "teacher",
        })),
      );
      if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    }

    if (resolved.offeringRows.some((offering) => !activeSubjectIds.has(offering.subject_id))) {
      return NextResponse.json({ error: "Teaching assignment qualification mismatch." }, { status: 400 });
    }
  }

  if (person.auth_user_id && body.status === "inactive") {
    await admin.auth.admin.signOut(person.auth_user_id).catch(() => undefined);
  }
  return NextResponse.json({ ok: true });
}
