import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { createClient } from "@supabase/supabase-js";

function env(name) {
  const direct = process.env[name]?.trim();
  if (direct) return direct;
  const match = readFileSync(".env", "utf8").match(new RegExp(`^${name}=(.*)$`, "m"));
  if (!match) throw new Error(`${name} missing`);
  return match[1].trim().replace(/^["']|["']$/g, "");
}

const TRACK_DB = {
  SCIENCE: "science",
  ART: "art",
  SOCIAL_SCIENCE: "social_science",
};
const STATUS_DB = { ACTIVE: "active", ARCHIVED: "archived" };
const LEVEL_ORDINAL = { SS1: 1, SS2: 2, SS3: 3 };

const fixture = JSON.parse(readFileSync(resolve("public/seed/classes.json"), "utf8"));
if (fixture.schemaVersion !== 4 || !fixture.academicYear || !Array.isArray(fixture.classes)) {
  throw new Error("Unsupported classes fixture");
}

const supabase = createClient(env("NEXT_PUBLIC_SUPABASE_URL"), env("SUPABASE_SERVICE_ROLE_KEY"), {
  auth: { persistSession: false, autoRefreshToken: false },
});

const levels = [...new Set(fixture.classes.map((row) => String(row.level)))];
for (const level of levels) {
  if (!(level in LEVEL_ORDINAL)) throw new Error(`Unsupported academic level ${level}`);
}

const classIds = fixture.classes.map((row) => String(row.id));
if (new Set(classIds).size !== classIds.length) throw new Error("classes fixture contains duplicate ids");

const { error: yearError } = await supabase.from("academic_years").upsert(
  { name: fixture.academicYear, status: "active", updated_at: new Date().toISOString() },
  { onConflict: "name" },
);
if (yearError) throw new Error(yearError.message);

const { data: year, error: yearLookupError } = await supabase
  .from("academic_years")
  .select("id")
  .eq("name", fixture.academicYear)
  .single();
if (yearLookupError || !year) throw new Error(yearLookupError?.message ?? "Academic year was not created");

const { error: levelError } = await supabase.from("academic_levels").upsert(
  levels.map((name) => ({ name, ordinal: LEVEL_ORDINAL[name], active: true })),
  { onConflict: "name" },
);
if (levelError) throw new Error(levelError.message);

const { data: levelRows, error: levelLookupError } = await supabase
  .from("academic_levels")
  .select("id,name")
  .in("name", levels);
if (levelLookupError) throw new Error(levelLookupError.message);
const levelIdByName = new Map((levelRows ?? []).map((row) => [row.name, row.id]));
if (levelIdByName.size !== levels.length) throw new Error("Not every fixture academic level resolved");

const now = new Date().toISOString();
const rows = fixture.classes.map((row) => {
  const levelId = levelIdByName.get(row.level);
  if (!levelId) throw new Error(`Missing level id for ${row.level}`);
  if (row.track !== null && !(row.track in TRACK_DB)) throw new Error(`Unsupported class track ${row.track}`);
  if (!(row.status in STATUS_DB)) throw new Error(`Unsupported class status ${row.status}`);
  return {
    id: row.id,
    level_id: levelId,
    track: row.track === null ? null : TRACK_DB[row.track],
    academic_year_id: year.id,
    arm: row.arm ?? "",
    capacity: Number(row.capacity),
    room: row.room ?? "",
    status: STATUS_DB[row.status],
    updated_at: now,
  };
});

const { error: classError } = await supabase.from("classes").upsert(rows, { onConflict: "id" });
if (classError) throw new Error(classError.message);

console.log(JSON.stringify({ ok: true, academicYear: fixture.academicYear, classes: rows.length }));
