// Seed WAEC subject catalog (service-role). Same source the app uses.
import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
import { WAEC_SUBJECTS } from "../src/lib/subjects-catalog";

function env(name: string): string {
  const m = readFileSync(".env", "utf8").match(new RegExp(`^${name}=(.*)$`, "m"));
  if (!m) throw new Error(`${name} missing`);
  return m[1].trim().replace(/^["']|["']$/g, "");
}

const s = createClient(env("NEXT_PUBLIC_SUPABASE_URL"), env("SUPABASE_SERVICE_ROLE_KEY"), {
  auth: { persistSession: false, autoRefreshToken: false },
});

const now = Date.now();
async function main() {
  const { error } = await s.from("subjects").upsert(
    WAEC_SUBJECTS.map((x) => ({ code: x.code, name: x.name, category: x.category, streams: x.streams, active: true, updated_at: now })),
  );
  if (error) throw new Error(error.message);
  console.log(JSON.stringify({ ok: true, count: WAEC_SUBJECTS.length }));
}
void main();
