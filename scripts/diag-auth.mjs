// List auth users + student profiles to diagnose prototype login.
import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
function env(n) {
  const m = readFileSync(".env", "utf8").match(new RegExp(`^${n}=(.*)$`, "m"));
  return m[1].trim().replace(/^["']|["']$/g, "");
}
const s = createClient(env("NEXT_PUBLIC_SUPABASE_URL"), env("SUPABASE_SERVICE_ROLE_KEY"), {
  auth: { persistSession: false, autoRefreshToken: false },
});
const { data: listed } = await s.auth.admin.listUsers();
console.log("AUTH USERS:", (listed?.users ?? []).map((u) => ({
  email: u.email, confirmed: Boolean(u.email_confirmed_at),
  app_role: u.app_metadata?.role, student_hash: u.app_metadata?.student_hash ? "set" : "-",
})));
const { data: profiles } = await s.from("student_profiles").select("first_name,last_name,student_hash");
console.log("PROFILES:", profiles);
