// Inspect distinct question subject codes in the live bank.
import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
function env(n) {
  const m = readFileSync(".env", "utf8").match(new RegExp(`^${n}=(.*)$`, "m"));
  return m[1].trim().replace(/^["']|["']$/g, "");
}
const s = createClient(env("NEXT_PUBLIC_SUPABASE_URL"), env("SUPABASE_SERVICE_ROLE_KEY"), {
  auth: { persistSession: false, autoRefreshToken: false },
});
const { data, error } = await s.from("questions").select("subject_code").limit(1000);
if (error) throw new Error(error.message);
const counts = new Map();
for (const r of data) counts.set(r.subject_code, (counts.get(r.subject_code) ?? 0) + 1);
console.log(JSON.stringify([...counts.entries()].sort(), null, 1));
