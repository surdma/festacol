"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import type { ActionResult } from "@/app/actions/student";
import { currentStaff } from "@/lib/auth/staff";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { listClasses } from "@/lib/supabase/queries";
import type { AcademicTrack, OfferingStatus } from "@/types/db";

const TRACKS = new Set<AcademicTrack>(["science", "humanities", "business"]);

async function requireAdmin() {
  const current = await currentStaff();
  if (!current.scope.profileId || !current.scope.isAdmin) throw new Error("Administrator sign-in required.");
  return createSupabaseAdminClient();
}

export async function upsertClassAction(input: {
  id?: string;
  classLevel: string;
  track: AcademicTrack;
  arm: string;
  capacity: number;
  room: string;
}): Promise<ActionResult & { id?: string }> {
  try {
    const admin = await requireAdmin();
    const levelName = input.classLevel.trim().toUpperCase();
    if (!["SS1", "SS2", "SS3"].includes(levelName)) return { ok: false, error: "Unsupported academic level." };
    if (!TRACKS.has(input.track)) return { ok: false, error: "Choose a supported academic track." };
    if (!Number.isInteger(input.capacity) || input.capacity < 1 || input.capacity > 500) {
      return { ok: false, error: "Capacity must be between 1 and 500." };
    }
    const arm = input.arm.trim().toUpperCase().slice(0, 4);
    if (!arm) return { ok: false, error: "Class arm is required." };

    const [{ data: level }, { data: currentYear }] = await Promise.all([
      admin.from("academic_levels").select("id").eq("name", levelName).eq("active", true).maybeSingle(),
      admin.from("academic_years").select("id").eq("status", "active").order("starts_on", { ascending: false }).limit(1).maybeSingle(),
    ]);
    const levelId = (level as { id?: string } | null)?.id;
    if (!levelId) return { ok: false, error: "Academic level is not configured." };

    let academicYearId = (currentYear as { id?: string } | null)?.id ?? null;
    if (input.id) {
      const { data: existing } = await admin.from("classes").select("academic_year_id").eq("id", input.id).maybeSingle();
      academicYearId = (existing as { academic_year_id?: string } | null)?.academic_year_id ?? academicYearId;
    }
    if (!academicYearId) return { ok: false, error: "Set an active academic year before creating classes." };

    const { data: duplicate } = await admin
      .from("classes")
      .select("id")
      .eq("academic_year_id", academicYearId)
      .eq("level_id", levelId)
      .eq("track", input.track)
      .eq("arm", arm);
    if (((duplicate ?? []) as { id: string }[]).some((row) => row.id !== input.id)) {
      return { ok: false, error: "That level, track and arm already exists for the academic year." };
    }

    const id = input.id ?? `${levelName.toLowerCase()}-${input.track}-${arm.toLowerCase()}-${Date.now().toString(36)}`;
    const payload = {
      id,
      level_id: levelId,
      track: input.track,
      academic_year_id: academicYearId,
      arm,
      capacity: input.capacity,
      room: input.room.trim(),
      status: "active",
      updated_at: new Date().toISOString(),
    };
    const write = input.id
      ? await admin.from("classes").update(payload).eq("id", input.id)
      : await admin.from("classes").insert(payload);
    if (write.error) return { ok: false, error: write.error.message };
    revalidatePath("/workspace/classes");
    return { ok: true, id };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "Class save failed." };
  }
}

export interface ClassOfferingOption {
  subjectId: string;
  subjectName: string;
  participation: "required" | "elective";
  offeringId: string | null;
  status: string | null;
}

export interface ClassOfferingOptions {
  classId: string;
  displayName: string;
  options: ClassOfferingOption[];
}

// Curriculum subjects a class may offer (from subject_curriculum_rules for
// the class level + track) alongside the current offering state. Drives the
// class record Subjects tab and, indirectly, the exam wizard subject list.
export async function listClassOfferingOptionsAction(classId: string): Promise<ClassOfferingOptions | null> {
  try {
    const current = await currentStaff();
    if (!current.scope.profileId) throw new Error("Staff sign-in required.");
    const admin = createSupabaseAdminClient();
    const [classes, { data: classRow }] = await Promise.all([
      listClasses(admin),
      admin.from("classes").select("id,level_id,track").eq("id", classId).maybeSingle(),
    ]);
    const cls = classRow as { id: string; level_id: string; track: string } | null;
    if (!cls) return null;
    const displayName = classes.find((row) => row.id === classId)?.display_name ?? "Class";
    const [{ data: rules }, { data: offerings }] = await Promise.all([
      admin.from("subject_curriculum_rules").select("subject_id,participation").eq("level_id", cls.level_id).eq("track", cls.track),
      admin.from("class_subject_offerings").select("id,subject_id,status").eq("class_id", classId),
    ]);
    const ruleRows = (rules ?? []) as { subject_id: string; participation: "required" | "elective" }[];
    if (!ruleRows.length) return { classId, displayName, options: [] };
    const { data: subjects } = await admin
      .from("subjects")
      .select("id,name")
      .in("id", ruleRows.map((row) => row.subject_id))
      .eq("kind", "curriculum")
      .eq("active", true);
    const nameBySubject = new Map(((subjects ?? []) as { id: string; name: string }[]).map((row) => [row.id, row.name]));
    const offeringBySubject = new Map(
      ((offerings ?? []) as { id: string; subject_id: string; status: string }[]).map((row) => [row.subject_id, row]),
    );
    const options = ruleRows
      .filter((row) => nameBySubject.has(row.subject_id))
      .map((row) => ({
        subjectId: row.subject_id,
        subjectName: nameBySubject.get(row.subject_id) ?? "Subject",
        participation: row.participation,
        offeringId: offeringBySubject.get(row.subject_id)?.id ?? null,
        status: offeringBySubject.get(row.subject_id)?.status ?? null,
      }))
      .sort((a, b) => a.subjectName.localeCompare(b.subjectName));
    return { classId, displayName, options };
  } catch {
    return null;
  }
}

export async function upsertClassOfferingAction(input: {
  id?: string;
  classId: string;
  subjectId: string;
  status: OfferingStatus;
}): Promise<ActionResult & { id?: string }> {
  try {
    const admin = await requireAdmin();
    const [{ data: classRow }, { data: subject }] = await Promise.all([
      admin.from("classes").select("id,level_id,track,status").eq("id", input.classId).maybeSingle(),
      admin.from("subjects").select("id,kind,active").eq("id", input.subjectId).maybeSingle(),
    ]);
    const cls = classRow as { id: string; level_id: string; track: AcademicTrack; status: string } | null;
    const subjectRow = subject as { id: string; kind: string; active: boolean } | null;
    if (!cls || cls.status !== "active" || !subjectRow?.active || subjectRow.kind !== "curriculum") {
      return { ok: false, error: "Class or curriculum subject is unavailable." };
    }

    const { data: rule } = await admin
      .from("subject_curriculum_rules")
      .select("participation")
      .eq("subject_id", input.subjectId)
      .eq("level_id", cls.level_id)
      .eq("track", cls.track)
      .maybeSingle();
    if (!rule) return { ok: false, error: "This subject is not part of the class curriculum." };

    const { data: sameIdentity } = await admin
      .from("class_subject_offerings")
      .select("id")
      .eq("class_id", input.classId)
      .eq("subject_id", input.subjectId);
    const conflicting = ((sameIdentity ?? []) as { id: string }[]).find((row) => row.id !== input.id);
    if (conflicting) return { ok: false, error: "That subject offering already exists for this class." };

    const id = input.id ?? randomUUID();
    const payload = {
      id,
      class_id: input.classId,
      subject_id: input.subjectId,
      status: input.status,
      updated_at: new Date().toISOString(),
    };
    const write = input.id
      ? await admin.from("class_subject_offerings").update(payload).eq("id", input.id)
      : await admin.from("class_subject_offerings").insert(payload);
    if (write.error) return { ok: false, error: write.error.message };
    revalidatePath("/workspace/classes");
    revalidatePath("/workspace/exams");
    return { ok: true, id };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "Offering save failed." };
  }
}
