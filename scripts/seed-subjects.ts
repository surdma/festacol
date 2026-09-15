import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { createClient } from "@supabase/supabase-js";

type AcademicTrack = "SCIENCE" | "ART" | "SOCIAL_SCIENCE";
type Participation = "REQUIRED" | "ELECTIVE";

interface SubjectFixtureRow {
  code: string;
  name: string;
  active: boolean;
  levels: string[];
  modes: string[];
  trackRules: Array<{ track: AcademicTrack; participation: Participation }>;
}

interface SubjectFixture {
  schemaVersion: number;
  fixtureId: string;
  tracks: AcademicTrack[];
  subjects: SubjectFixtureRow[];
}

function env(name: string): string {
  const direct = process.env[name]?.trim();
  if (direct) return direct;
  const match = readFileSync(".env", "utf8").match(new RegExp(`^${name}=(.*)$`, "m"));
  if (!match) throw new Error(`${name} missing`);
  return match[1].trim().replace(/^["']|["']$/g, "");
}

function loadFixture(): SubjectFixture {
  const fixture = JSON.parse(readFileSync(resolve("public/seed/subjects.json"), "utf8")) as SubjectFixture;
  if (fixture.schemaVersion !== 4 || !Array.isArray(fixture.subjects)) {
    throw new Error("Unsupported subjects fixture");
  }
  return fixture;
}

const TRACK_DB: Record<AcademicTrack, string> = {
  SCIENCE: "science",
  ART: "art",
  SOCIAL_SCIENCE: "social_science",
};
const PARTICIPATION_DB: Record<Participation, string> = {
  REQUIRED: "required",
  ELECTIVE: "elective",
};

const supabase = createClient(env("NEXT_PUBLIC_SUPABASE_URL"), env("SUPABASE_SERVICE_ROLE_KEY"), {
  auth: { persistSession: false, autoRefreshToken: false },
});

async function main() {
  const fixture = loadFixture();
  const codes = fixture.subjects.map((subject) => subject.code);
  if (new Set(codes).size !== codes.length) throw new Error("subjects fixture contains duplicate codes");

  const now = new Date().toISOString();
  const { error: subjectError } = await supabase.from("subjects").upsert(
    fixture.subjects.map((subject) => ({
      code: subject.code,
      name: subject.name,
      active: subject.active,
      updated_at: now,
    })),
    { onConflict: "code" },
  );
  if (subjectError) throw new Error(subjectError.message);

  const { data: rows, error: lookupError } = await supabase
    .from("subjects")
    .select("id,code")
    .in("code", codes);
  if (lookupError) throw new Error(lookupError.message);

  const subjectIdByCode = new Map(((rows ?? []) as Array<{ id: string; code: string }>).map((row) => [row.code, row.id]));
  if (subjectIdByCode.size !== fixture.subjects.length) {
    throw new Error("Not every fixture subject resolved to a canonical subject row");
  }

  const subjectIds = [...subjectIdByCode.values()];
  if (subjectIds.length) {
    const { error: deleteError } = await supabase.from("subject_track_rules").delete().in("subject_id", subjectIds);
    if (deleteError) throw new Error(deleteError.message);
  }

  const rules = fixture.subjects.flatMap((subject) => {
    const subjectId = subjectIdByCode.get(subject.code);
    if (!subjectId) throw new Error(`Missing subject id for ${subject.code}`);
    return subject.trackRules.map((rule) => ({
      subject_id: subjectId,
      track: TRACK_DB[rule.track],
      participation: PARTICIPATION_DB[rule.participation],
      updated_at: now,
    }));
  });

  if (rules.length) {
    const { error: ruleError } = await supabase.from("subject_track_rules").upsert(rules, {
      onConflict: "subject_id,track",
    });
    if (ruleError) throw new Error(ruleError.message);
  }

  console.log(JSON.stringify({ ok: true, subjects: fixture.subjects.length, trackRules: rules.length }));
}

void main();
