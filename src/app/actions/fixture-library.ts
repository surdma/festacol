"use server";

import { readFile } from "node:fs/promises";
import path from "node:path";
import { revalidatePath } from "next/cache";
import type { ActionResult } from "@/app/actions/student";
import { seedSubjectCatalogFromFixtureAction, syncQuestionBankFromFixtureAction } from "@/app/actions/question-bank";
import { currentStaff } from "@/lib/auth/staff";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export type SchoolDataSource = "subjects" | "academic-structure" | "question-bank";

type Track = "SCIENCE" | "HUMANITIES" | "BUSINESS";
type PeriodStatus = "PLANNED" | "ACTIVE" | "CLOSED" | "ARCHIVED";

interface ClassFixture {
  schemaVersion: number;
  academicYear: { name: string; status: PeriodStatus };
  terms: { name: string; sequence: number; status: PeriodStatus }[];
  levels: { name: string; ordinal: number }[];
  classes: {
    id: string;
    level: string;
    track: Track;
    arm: string;
    capacity: number;
    room: string;
    status: "ACTIVE" | "INACTIVE";
    offerings: string[];
  }[];
}

const TRACK_DB: Record<Track, "science" | "humanities" | "business"> = {
  SCIENCE: "science",
  HUMANITIES: "humanities",
  BUSINESS: "business",
};

const PERIOD_STATUS_DB: Record<PeriodStatus, "planned" | "active" | "closed" | "archived"> = {
  PLANNED: "planned",
  ACTIVE: "active",
  CLOSED: "closed",
  ARCHIVED: "archived",
};

async function requireAdministrator() {
  const current = await currentStaff();
  if (!current.scope.profileId || !current.scope.isAdmin) throw new Error("Administrator sign-in required.");
  return createSupabaseAdminClient();
}

async function loadClassFixture(): Promise<ClassFixture> {
  const raw = await readFile(path.join(process.cwd(), "public", "seed", "classes.json"), "utf8");
  const fixture = JSON.parse(raw) as ClassFixture;
  if (fixture.schemaVersion !== 5 || !fixture.academicYear?.name || !fixture.levels?.length || !fixture.classes?.length) {
    throw new Error("The prepared class data is incomplete or uses an unsupported version.");
  }
  if (new Set(fixture.classes.map((item) => item.id)).size !== fixture.classes.length) {
    throw new Error("The prepared class data contains duplicate class records.");
  }
  return fixture;
}

async function syncAcademicStructureFromFixtureAction(): Promise<ActionResult & { count?: number; detail?: string }> {
  try {
    const admin = await requireAdministrator();
    const fixture = await loadClassFixture();
    const now = new Date().toISOString();

    const { error: yearError } = await admin.from("academic_years").upsert({
      name: fixture.academicYear.name,
      status: PERIOD_STATUS_DB[fixture.academicYear.status],
      updated_at: now,
    }, { onConflict: "name" });
    if (yearError) return { ok: false, error: yearError.message };

    const { data: yearRow, error: yearLookupError } = await admin
      .from("academic_years")
      .select("id")
      .eq("name", fixture.academicYear.name)
      .single();
    if (yearLookupError || !yearRow) return { ok: false, error: yearLookupError?.message ?? "Academic year could not be prepared." };
    const academicYearId = (yearRow as { id: string }).id;

    const { error: levelError } = await admin.from("academic_levels").upsert(
      fixture.levels.map((level) => ({ name: level.name, ordinal: level.ordinal, active: true })),
      { onConflict: "name" },
    );
    if (levelError) return { ok: false, error: levelError.message };

    const { data: levelRows, error: levelLookupError } = await admin
      .from("academic_levels")
      .select("id,name")
      .in("name", fixture.levels.map((level) => level.name));
    if (levelLookupError) return { ok: false, error: levelLookupError.message };
    const levelIdByName = new Map(((levelRows ?? []) as { id: string; name: string }[]).map((row) => [row.name, row.id]));

    const { error: termError } = await admin.from("academic_terms").upsert(
      fixture.terms.map((term) => ({
        academic_year_id: academicYearId,
        name: term.name,
        sequence: term.sequence,
        status: PERIOD_STATUS_DB[term.status],
        updated_at: now,
      })),
      { onConflict: "academic_year_id,sequence" },
    );
    if (termError) return { ok: false, error: termError.message };

    const offeringCodes = [...new Set(fixture.classes.flatMap((item) => item.offerings))];
    const { data: subjectRows, error: subjectError } = offeringCodes.length
      ? await admin.from("subjects").select("id,code,active,kind").in("code", offeringCodes)
      : { data: [], error: null };
    if (subjectError) return { ok: false, error: subjectError.message };
    const subjects = (subjectRows ?? []) as { id: string; code: string; active: boolean; kind: string }[];
    const subjectIdByCode = new Map(subjects.filter((subject) => subject.active && subject.kind === "curriculum").map((subject) => [subject.code, subject.id]));
    const missingCodes = offeringCodes.filter((code) => !subjectIdByCode.has(code));
    if (missingCodes.length) {
      return { ok: false, error: `Load the subject curriculum first. Missing subjects: ${missingCodes.join(", ")}.` };
    }

    const classRows = fixture.classes.map((item) => {
      const levelId = levelIdByName.get(item.level);
      if (!levelId) throw new Error(`Academic level ${item.level} is unavailable.`);
      return {
        id: item.id,
        level_id: levelId,
        track: TRACK_DB[item.track],
        academic_year_id: academicYearId,
        arm: item.arm,
        capacity: item.capacity,
        room: item.room,
        status: item.status === "ACTIVE" ? "active" : "inactive",
        updated_at: now,
      };
    });
    const { error: classError } = await admin.from("classes").upsert(classRows, { onConflict: "id" });
    if (classError) return { ok: false, error: classError.message };

    const offerings = fixture.classes.flatMap((item) => item.offerings.map((code) => ({
      class_id: item.id,
      subject_id: subjectIdByCode.get(code)!,
      status: "active",
      updated_at: now,
    })));
    if (offerings.length) {
      const { error: offeringError } = await admin.from("class_subject_offerings").upsert(offerings, { onConflict: "class_id,subject_id" });
      if (offeringError) return { ok: false, error: offeringError.message };
    }

    revalidatePath("/admin/data-library");
    revalidatePath("/admin/settings");
    revalidatePath("/admin/settings/academic");
    revalidatePath("/admin/classes");
    return { ok: true, count: fixture.classes.length, detail: `${fixture.levels.length} senior levels and ${fixture.terms.length} terms prepared.` };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "The academic structure could not be loaded." };
  }
}

export async function loadSchoolDataSourceAction(source: SchoolDataSource): Promise<ActionResult & { count?: number; detail?: string }> {
  try {
    await requireAdministrator();
    if (source === "subjects") {
      const result = await seedSubjectCatalogFromFixtureAction();
      if (result.ok) revalidatePath("/admin/data-library");
      return { ...result, detail: result.ok ? "Subject curriculum and study-track rules are up to date." : undefined };
    }
    if (source === "academic-structure") return syncAcademicStructureFromFixtureAction();
    if (source === "question-bank") {
      const result = await syncQuestionBankFromFixtureAction();
      if (result.ok) revalidatePath("/admin/data-library");
      return { ...result, detail: result.ok ? "Prepared questions are up to date while staff-authored questions remain protected." : undefined };
    }
    return { ok: false, error: "Choose a supported school data source." };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "School data could not be loaded." };
  }
}
