// Inspect fill/multi/boolean question shapes + distinct types.
import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
function env(n) {
  const m = readFileSync(".env", "utf8").match(new RegExp(`^${n}=(.*)$`, "m"));
  return m[1].trim().replace(/^["']|["']$/g, "");
}
const s = createClient(env("NEXT_PUBLIC_SUPABASE_URL"), env("SUPABASE_SERVICE_ROLE_KEY"), {
  auth: { persistSession: false, autoRefreshToken: false },
});
const { data } = await s.from("questions").select("id,data").limit(1000);
const byType = {};
for (const r of data) {
  const t = r.data?.type ?? "?";
  byType[t] = (byType[t] ?? 0) + 1;
}
console.log("TYPES", JSON.stringify(byType));
for (const r of data) {
  if (["fill", "fill-multi", "multi", "boolean"].includes(r.data?.type) && !byType[`shown_${r.data.type}`]) {
    byType[`shown_${r.data.type}`] = 1;
    console.log(`--- ${r.data.type} id=${r.id} ---`);
    console.log(JSON.stringify(r.data, null, 1).slice(0, 2000));
  }
}
