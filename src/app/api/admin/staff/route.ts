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
    subjectIds.length ? admin.from("subjects").select("id,code,name").in("id", subjectIds).eq("active", true) : Promise.resolve({ data: [], error: null }),
    offeringIds.length ? admin.from("class_subject_offerings").select("id,class_id,subject_id,academic_year_id,academic_term_id,status").in("id", offeringIds) : Promise.resolve({ data: [], error: null }),
  ]);
  if (subjectError || offeringError) return { error: subjectError?.message ?? offeringError?.message ?? "Scope could not be resolved." } as const;
  const subjectRows = (subjects ?? []) as { id: string; code: string; name: string }[];
  const offeringRows = (offerings ?? []) as { id: string; class_id: string; subject_id: string; academic_year_id: string; academic_term_id: string | null; status: string }[];
  if (subjectRows.length !== subjectIds.length) return { error: "One or more subjects are unavailable." } as const;
  if (offeringRows.length !== offeringIds.length || offeringRows.some((offering) => offering.status !== "active")) return { error: "One or more teaching assignments reference an inactive offering." } as const;
  const qualified = new Set(subjectIds);
  if (offeringRows.some((offering) => !qualified.has(offering.subject_id))) return { error: "Every teaching assignment requires qualification in that offering's subject." } as const;
  return { subjectRows, offeringRows } as const;
}

// POST /api/admin/staff — provision one Supabase Auth identity plus the linked
// academic staff profile, subject qualifications and explicit teaching assignments.
export async function POST(req: Request) {
  if (!(await requireAdminSession())) return NextResponse.json({ error: "Administrator sign-in required." }, { status: 403 });
  const body = (await req.json().catch(() => null)) as {
    email?: string; password?: string; fullName?: string; subjectIds?: unknown; offeringIds?: unknown; qualifierAccess?: boolean;
  } | null;
  const email = (body?.email ?? "").trim().toLowerCase();
  const fullName = (body?.fullName ?? "").trim();
  const subjectIds = uniqueIds(body?.subjectIds);
  const offeringIds = uniqueIds(body?.offeringIds);
  if (!email || fullName.length < 3) return NextResponse.json({ error: "Email and full name are required." }, { status: 400 });
  if ((body?.password ?? "").length < 8) return NextResponse.json({ error: "Password of 8+ characters is required." }, { status: 400 });
  if (!subjectIds.length) return NextResponse.json({ error: "Choose at least one subject qualification." }, { status: 400 });

  const admin = createSupabaseAdminClient();
  const scope = await resolveScope(admin, subjectIds, offeringIds);
  if ("error" in scope) return NextResponse.json({ error: scope.error }, { status: 400 });

  const profileId = randomUUID();
  const rosterId = `ST-${Date.now().toString(36).toUpperCase()}`;
  const parts = fullName.split(/\s+/);
  const firstName = parts[0] ?? fullName;
  const lastName = parts.slice(1).join(" ") || firstName;
  const { data: created, error: createError } = await admin.auth.admin.createUser({
    email,
    password: body!.password!,
    email_confirm: true,
    user_metadata: { full_name: fullName },
    app_metadata: { role: "teacher", academic_profile_id: profileId },
  });
  if (createError || !created.user) return NextResponse.json({ error: createError?.message ?? "Authentication account could not be created." }, { status: 400 });

  const cleanup = async () => {
    await admin.from("academic_profiles").delete().eq("id", profileId);
    await admin.from("users").delete().eq("id", rosterId);
    await admin.auth.admin.deleteUser(created.user.id).catch(() => undefined);
  };

  const compatibilityCodes = scope.subjectRows.map((subject) => subject.code);
  const { error: legacyError } = await admin.from("users").insert({
    id: rosterId,
    full_name: fullName,
    first_name: firstName,
    last_name: lastName,
    class_id: null,
    role: "teacher",
    status: "active",
    academic_session: "2026/2027",
    promotion_status: "on-track",
    joined_at: Date.now(),
    auth_user_id: created.user.id,
    email,
    subjects: compatibilityCodes,
    qualifier_access: Boolean(body?.qualifierAccess),
  });
  if (legacyError) { await cleanup(); return NextResponse.json({ error: legacyError.message }, { status: 400 }); }

  const { error: profileError } = await admin.from("academic_profiles").insert({
    id: profileId,
    auth_user_id: created.user.id,
    legacy_user_id: rosterId,
    role: "teacher",
    status: "active",
    full_name: fullName,
    first_name: firstName,
    last_name: lastName,
    email,
  });
  if (profileError) { await cleanup(); return NextResponse.json({ error: profileError.message }, { status: 400 }); }

  const { error: staffError } = await admin.from("staff_academic_profiles").insert({
    profile_id: profileId,
    qualifier_access: Boolean(body?.qualifierAccess),
  });
  if (staffError) { await cleanup(); return NextResponse.json({ error: staffError.message }, { status: 400 }); }

  const { error: qualificationError } = await admin.from("staff_subject_qualifications").insert(scope.subjectRows.map((subject) => ({
    staff_profile_id: profileId,
    subject_id: subject.id,
    subject_code: subject.code,
    active: true,
  })));
  if (qualificationError) { await cleanup(); return NextResponse.json({ error: qualificationError.message }, { status: 400 }); }

  if (scope.offeringRows.length) {
    const codeBySubject = new Map(scope.subjectRows.map((subject) => [subject.id, subject.code]));
    const { error: assignmentError } = await admin.from("teaching_assignments").insert(scope.offeringRows.map((offering) => ({
      id: randomUUID(),
      staff_profile_id: profileId,
      class_id: offering.class_id,
      subject_id: offering.subject_id,
      subject_code: codeBySubject.get(offering.subject_id),
      offering_id: offering.id,
      academic_year_id: offering.academic_year_id,
      academic_term_id: offering.academic_term_id,
      assignment_role: "teacher",
      status: "active",
    })));
    if (assignmentError) { await cleanup(); return NextResponse.json({ error: assignmentError.message }, { status: 400 }); }
  }
  return NextResponse.json({ ok: true, id: rosterId, profileId });
}

// PATCH /api/admin/staff — replace active qualifications/teaching assignments
// without erasing history. Removed relationships are marked inactive/ended.
export async function PATCH(req: Request) {
  if (!(await requireAdminSession())) return NextResponse.json({ error: "Administrator sign-in required." }, { status: 403 });
  const body = (await req.json().catch(() => null)) as {
    id?: string; subjectIds?: unknown; offeringIds?: unknown; qualifierAccess?: boolean; status?: string;
  } | null;
  if (!body?.id) return NextResponse.json({ error: "Staff id is required." }, { status: 400 });
  const admin = createSupabaseAdminClient();
  const { data: profile } = await admin.from("academic_profiles").select("id,legacy_user_id,auth_user_id,role").or(`id.eq.${body.id},legacy_user_id.eq.${body.id}`).maybeSingle();
  const person = profile as { id: string; legacy_user_id: string | null; auth_user_id: string | null; role: string } | null;
  if (!person || !["teacher", "administrator"].includes(person.role)) return NextResponse.json({ error: "Staff record not found." }, { status: 404 });

  const subjectIds = body.subjectIds === undefined
    ? null
    : uniqueIds(body.subjectIds);
  const offeringIds = body.offeringIds === undefined
    ? null
    : uniqueIds(body.offeringIds);
  let resolved: Awaited<ReturnType<typeof resolveScope>> | null = null;
  if (subjectIds !== null || offeringIds !== null) {
    const currentSubjectIds = subjectIds ?? ((await admin.from("staff_subject_qualifications").select("subject_id").eq("staff_profile_id", person.id).eq("active", true).not("subject_id", "is", null)).data ?? []).map((row) => String((row as { subject_id: string }).subject_id));
    const currentOfferingIds = offeringIds ?? ((await admin.from("teaching_assignments").select("offering_id").eq("staff_profile_id", person.id).eq("status", "active").not("offering_id", "is", null)).data ?? []).map((row) => String((row as { offering_id: string }).offering_id));
    resolved = await resolveScope(admin, currentSubjectIds, currentOfferingIds);
    if ("error" in resolved) return NextResponse.json({ error: resolved.error }, { status: 400 });
  }

  if (body.status !== undefined && !["active", "inactive"].includes(body.status)) return NextResponse.json({ error: "Invalid status." }, { status: 400 });
  const nowIso = new Date().toISOString();
  if (body.status !== undefined) {
    await admin.from("academic_profiles").update({ status: body.status, updated_at: nowIso }).eq("id", person.id);
    if (person.legacy_user_id) await admin.from("users").update({ status: body.status }).eq("id", person.legacy_user_id);
  }
  if (body.qualifierAccess !== undefined) {
    await admin.from("staff_academic_profiles").update({ qualifier_access: Boolean(body.qualifierAccess), updated_at: nowIso }).eq("profile_id", person.id);
    if (person.legacy_user_id) await admin.from("users").update({ qualifier_access: Boolean(body.qualifierAccess) }).eq("id", person.legacy_user_id);
  }

  if (resolved && !("error" in resolved)) {
    const activeSubjectIds = new Set(resolved.subjectRows.map((subject) => subject.id));
    await admin.from("staff_subject_qualifications").update({ active: false }).eq("staff_profile_id", person.id);
    if (resolved.subjectRows.length) {
      const { error } = await admin.from("staff_subject_qualifications").upsert(resolved.subjectRows.map((subject) => ({
        staff_profile_id: person.id,
        subject_id: subject.id,
        subject_code: subject.code,
        active: true,
      })), { onConflict: "staff_profile_id,subject_code" });
      if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    }
    if (person.legacy_user_id) await admin.from("users").update({ subjects: resolved.subjectRows.map((subject) => subject.code), class_id: null }).eq("id", person.legacy_user_id);

    const { data: existingAssignments } = await admin.from("teaching_assignments").select("id,offering_id").eq("staff_profile_id", person.id).eq("status", "active");
    const desiredOfferingIds = new Set(resolved.offeringRows.map((offering) => offering.id));
    for (const assignment of ((existingAssignments ?? []) as { id: string; offering_id: string | null }[])) {
      if (!assignment.offering_id || !desiredOfferingIds.has(assignment.offering_id)) {
        await admin.from("teaching_assignments").update({ status: "ended", ended_at: nowIso }).eq("id", assignment.id);
      }
    }
    const existingByOffering = new Set(((existingAssignments ?? []) as { id: string; offering_id: string | null }[]).map((assignment) => assignment.offering_id).filter(Boolean));
    const codeBySubject = new Map(resolved.subjectRows.map((subject) => [subject.id, subject.code]));
    const additions = resolved.offeringRows.filter((offering) => !existingByOffering.has(offering.id));
    if (additions.length) {
      const { error } = await admin.from("teaching_assignments").insert(additions.map((offering) => ({
        id: randomUUID(),
        staff_profile_id: person.id,
        class_id: offering.class_id,
        subject_id: offering.subject_id,
        subject_code: codeBySubject.get(offering.subject_id),
        offering_id: offering.id,
        academic_year_id: offering.academic_year_id,
        academic_term_id: offering.academic_term_id,
        assignment_role: "teacher",
        status: "active",
      })));
      if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    }
    // Defensive: a teaching assignment can never survive without subject qualification.
    if (resolved.offeringRows.some((offering) => !activeSubjectIds.has(offering.subject_id))) {
      return NextResponse.json({ error: "Teaching assignment qualification mismatch." }, { status: 400 });
    }
  }

  if (person.auth_user_id && body.status === "inactive") await admin.auth.admin.signOut(person.auth_user_id).catch(() => undefined);
  return NextResponse.json({ ok: true });
}
