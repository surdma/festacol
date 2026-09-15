// Dump one sample row per table to ground the normalization migration.
import { readFileSync, writeFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
function env(n) {
  const m = readFileSync(".env", "utf8").match(new RegExp(`^${n}=(.*)$`, "m"));
  return m[1].trim().replace(/^["']|["']$/g, "");
}
const s = createClient(env("NEXT_PUBLIC_SUPABASE_URL"), env("SUPABASE_SERVICE_ROLE_KEY"), {
  auth: { persistSession: false, autoRefreshToken: false },
});
const out = {};
for (const t of ["questions", "exam_sessions", "exam_attempts", "exam_states", "question_bank", "users"]) {
  const { data, error } = await s.from(t).select("*").limit(1);
  out[t] = error ? `ERR ${error.message}` : data;
}
writeFileSync("scripts/sample-rows.json", JSON.stringify(out, null, 1));
console.log("wrote scripts/sample-rows.json");
