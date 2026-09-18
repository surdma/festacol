import type { SupabaseClient } from "@supabase/supabase-js";
import type { AcademicTrack } from "@/types/db";

export const SCIENCE_PLACEMENT_THRESHOLD = 55;

export interface PlacementClassOption {
  classId: string;
  levelName: string;
  track: AcademicTrack;
  arm: string;
  whatsappName: string | null;
  whatsappUrl: string | null;
}

function safeWhatsappInvite(value: string | null | undefined): string | null {
  if (!value) return null;
  try {
    const url = new URL(value);
    const host = url.hostname.toLowerCase();
    const allowedHost =
      host === "chat.whatsapp.com" ||
      host === "wa.me" ||
      host === "whatsapp.com" ||
      host.endsWith(".whatsapp.com");
    return url.protocol === "https:" && allowedHost ? url.toString() : null;
  } catch {
    return null;
  }
}

export function qualifiesForScience(score: number): boolean {
  return Number.isFinite(score) && score > SCIENCE_PLACEMENT_THRESHOLD;
}

export async function loadSs1PlacementClasses(
  client: SupabaseClient,
): Promise<PlacementClassOption[]> {
  const { data: levelData, error: levelError } = await client
    .from("academic_levels")
    .select("id,name")
    .eq("name", "SS1")
    .eq("active", true)
    .maybeSingle();
  if (levelError) throw new Error(levelError.message);

  const level = levelData as { id: string; name: string } | null;
  if (!level) return [];

  const { data: classData, error: classError } = await client
    .from("classes")
    .select("id,track,arm")
    .eq("level_id", level.id)
    .eq("status", "active")
    .order("track", { ascending: true })
    .order("arm", { ascending: true });
  if (classError) throw new Error(classError.message);

  const classes = (classData ?? []) as {
    id: string;
    track: AcademicTrack;
    arm: string;
  }[];
  if (!classes.length) return [];

  const classIds = classes.map((item) => item.id);
  const { data: groupData, error: groupError } = await client
    .from("whatsapp_groups")
    .select("class_id,name,invite_url,updated_at")
    .in("class_id", classIds)
    .order("updated_at", { ascending: false });
  if (groupError) throw new Error(groupError.message);

  const groupByClass = new Map<
    string,
    { name: string; invite_url: string; updated_at: number }
  >();
  for (const row of (groupData ?? []) as {
    class_id: string;
    name: string;
    invite_url: string;
    updated_at: number;
  }[]) {
    if (!groupByClass.has(row.class_id)) groupByClass.set(row.class_id, row);
  }

  return classes.map((item) => {
    const group = groupByClass.get(item.id);
    return {
      classId: item.id,
      levelName: level.name,
      track: item.track,
      arm: item.arm,
      whatsappName: group?.name?.trim() || null,
      whatsappUrl: safeWhatsappInvite(group?.invite_url),
    };
  });
}

async function activeEnrollmentRows(client: SupabaseClient, studentId: string) {
  const { data, error } = await client
    .from("class_enrollments")
    .select("id,class_id,enrolled_at")
    .eq("student_id", studentId)
    .eq("status", "active")
    .is("ended_at", null)
    .order("enrolled_at", { ascending: true })
    .order("id", { ascending: true });
  if (error) throw new Error(error.message);
  return (data ?? []) as { id: string; class_id: string; enrolled_at: string }[];
}

export async function assignStudentPlacementClass(input: {
  client: SupabaseClient;
  studentId: string;
  classId: string;
  scienceEligible: boolean;
}): Promise<PlacementClassOption> {
  const options = await loadSs1PlacementClasses(input.client);
  const target = options.find((item) => item.classId === input.classId);
  if (!target) throw new Error("Choose an active SS1 class.");
  if (!input.scienceEligible && target.track === "science") {
    throw new Error("Science placement requires a score above 55%.");
  }

  const placementClassIds = new Set(options.map((item) => item.classId));
  const activeBefore = await activeEnrollmentRows(input.client, input.studentId);
  const nonPlacement = activeBefore.find((row) => !placementClassIds.has(row.class_id));
  if (nonPlacement) {
    throw new Error(
      "Your account already has a confirmed class outside this placement flow. Ask a staff member before changing it.",
    );
  }

  const { error: upsertError } = await input.client
    .from("class_enrollments")
    .upsert(
      {
        student_id: input.studentId,
        class_id: target.classId,
        status: "active",
        ended_at: null,
      },
      { onConflict: "student_id,class_id" },
    );
  if (upsertError) throw new Error(upsertError.message);

  const otherIds = activeBefore
    .filter((row) => row.class_id !== target.classId)
    .map((row) => row.id);
  if (otherIds.length) {
    const { error: endError } = await input.client
      .from("class_enrollments")
      .update({
        status: "ended",
        ended_at: new Date().toISOString(),
      })
      .in("id", otherIds);
    if (endError) throw new Error(endError.message);
  }

  const activeAfter = await activeEnrollmentRows(input.client, input.studentId);
  const selected = activeAfter.filter((row) => row.class_id === target.classId);
  const extras = activeAfter.filter((row) => row.class_id !== target.classId);
  if (selected.length !== 1 || extras.length) {
    throw new Error("Your placement class could not be finalized safely.");
  }

  return target;
}

export async function autoAssignSciencePlacement(input: {
  client: SupabaseClient;
  studentId: string;
}): Promise<PlacementClassOption | null> {
  const options = await loadSs1PlacementClasses(input.client);
  const placementClassIds = new Set(options.map((item) => item.classId));
  const active = await activeEnrollmentRows(input.client, input.studentId);

  if (active.length) {
    const current = options.find((item) => item.classId === active[0].class_id) ?? null;
    if (current && active.every((row) => placementClassIds.has(row.class_id))) return current;
    return null;
  }

  const scienceClasses = options.filter((item) => item.track === "science");
  if (scienceClasses.length !== 1) return null;

  return assignStudentPlacementClass({
    client: input.client,
    studentId: input.studentId,
    classId: scienceClasses[0].classId,
    scienceEligible: true,
  });
}
