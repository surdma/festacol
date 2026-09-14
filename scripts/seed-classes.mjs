// Seed the fixed classes with arms (mirror of prototype/supabase/seed_classes.sql).
// Idempotent: existing ids are skipped.
import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";

function env(name) {
  const m = readFileSync(".env", "utf8").match(new RegExp(`^${name}=(.*)$`, "m"));
  if (!m) throw new Error(`${name} missing`);
  return m[1].trim().replace(/^["']|["']$/g, "");
}

const s = createClient(env("NEXT_PUBLIC_SUPABASE_URL"), env("SUPABASE_SERVICE_ROLE_KEY"), {
  auth: { persistSession: false, autoRefreshToken: false },
});

const rows = [
  ["ss1-qualifier", "SS1", "SS1 Qualifier Pool", "Qualifier", "", 240, "Admissions"],
  ["ss1-science-a", "SS1", "SS1 Science A", "Science", "A", 60, "Science Wing"],
  ["ss1-science-b", "SS1", "SS1 Science B", "Science", "B", 60, "Science Wing"],
  ["ss1-art-c", "SS1", "SS1 Art C", "Art", "C", 55, "Humanities Wing"],
  ["ss1-commercial-d", "SS1", "SS1 Commercial D", "Commercial", "D", 60, "Commerce Wing"],
  ["ss2-science-a", "SS2", "SS2 Science A", "Science", "A", 55, "Science Wing"],
  ["ss2-science-b", "SS2", "SS2 Science B", "Science", "B", 55, "Science Wing"],
  ["ss2-art-a", "SS2", "SS2 Art A", "Art", "A", 50, "Humanities Wing"],
  ["ss2-commercial-a", "SS2", "SS2 Commercial A", "Commercial", "A", 55, "Commerce Wing"],
  ["ss3-science-a", "SS3", "SS3 Science A", "Science", "A", 52, "Science Wing"],
  ["ss3-art-a", "SS3", "SS3 Art A", "Art", "A", 48, "Humanities Wing"],
  ["ss3-commercial-a", "SS3", "SS3 Commercial A", "Commercial", "A", 50, "Commerce Wing"],
].map(([id, class_level, name, stream, arm, capacity, room]) => ({
  id, class_level, name, stream, grp: stream, arm, capacity, room,
  academic_session: "2026/2027", status: "active",
}));

const { error } = await s.from("classes").upsert(rows, { onConflict: "id" });
if (error) throw new Error(error.message);
console.log(JSON.stringify({ ok: true, count: rows.length }));
