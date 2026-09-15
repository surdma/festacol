"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import type { ActionResult } from "@/app/actions/student";
import { currentStaff } from "@/lib/auth/staff";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import type { AcademicTrack, OfferingStatus } from "@/types/db";

const TRACKS = new Set<AcademicTrack>(["science", "art", "social_science"]);

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
    revalidatePath("/admin/classes");
    return { ok: true, id };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "Class save failed." };
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
    revalidatePath("/admin/classes");
    revalidatePath("/admin/exams");
    return { ok: true, id };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "Offering save failed." };
  }
}
