// Live DB census (service-role, read-only counts).
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

for (const t of ["classes", "users", "student_profiles", "questions", "exam_sessions", "exam_attempts", "question_bank"]) {
  const { count, error } = await s.from(t).select("*", { count: "exact", head: true });
  console.log(t, error ? `ERR ${error.message}` : count);
}
