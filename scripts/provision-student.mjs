// Provision a student auth account (same scheme as the Next.js app login:
// synthetic email + fst:studentHash, pre-confirmed, app_metadata identity).
// Usage: node scripts/provision-student.mjs <firstName> <lastName>
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { createClient } from "@supabase/supabase-js";

const [firstRaw, lastRaw] = process.argv.slice(2);
if (!firstRaw || !lastRaw) {
  console.error("Usage: node scripts/provision-student.mjs <firstName> <lastName>");
  process.exit(1);
}
function env(n) {
  const m = readFileSync(".env", "utf8").match(new RegExp(`^${n}=(.*)$`, "m"));
  return m[1].trim().replace(/^["']|["']$/g, "");
}
const normPart = (v) => String(v ?? "").trim().replace(/[^\p{L}\p{M}' -]/gu, "").replace(/\s+/gu, " ").slice(0, 40);
const normText = (v) => String(v ?? "").trim().replace(/\s+/gu, " ").toLocaleLowerCase("en");
const first = normPart(firstRaw);
const last = normPart(lastRaw);
if (first.length < 2 || last.length < 2) throw new Error("Names must be 2+ chars.");
const studentHash = createHash("sha256").update(`festacol-student|${normText(first)}|${normText(last)}`).digest("hex");
const clean = (v) => v.trim().toLowerCase().replace(/[^a-z0-9]+/g, ".").replace(/^\.+|\.+$/g, "").slice(0, 40) || "student";
const email = `${clean(first)}.${clean(last)}.student@festacol.local`;
const password = `fst:${studentHash}`;

const s = createClient(env("NEXT_PUBLIC_SUPABASE_URL"), env("SUPABASE_SERVICE_ROLE_KEY"), {
  auth: { persistSession: false, autoRefreshToken: false },
});
const { data: listed } = await s.auth.admin.listUsers();
const dupe = listed?.users?.find((u) => u.email?.toLowerCase() === email);
let userId;
if (dupe) {
  userId = dupe.id;
  const { error } = await s.auth.admin.updateUserById(userId, {
    password, email_confirm: true,
    app_metadata: { role: "student", student_hash: studentHash },
    user_metadata: { full_name: `${first} ${last}` },
  });
  if (error) throw new Error(error.message);
  console.log("adopted existing auth user");
} else {
  const { data: created, error } = await s.auth.admin.createUser({
    email, password, email_confirm: true,
    user_metadata: { full_name: `${first} ${last}` },
    app_metadata: { role: "student", student_hash: studentHash },
  });
  if (error || !created.user) throw new Error(error?.message ?? "Create failed.");
  userId = created.user.id;
}
const now = Date.now();
await s.from("student_profiles").upsert({
  student_hash: studentHash, candidate_hash: "", first_name: first, last_name: last,
  full_name: `${first} ${last}`, phone: "", guardian: "", current_class_id: "",
  academic_session: "2026/2027", updated_at: now,
}, { onConflict: "student_hash" });
console.log(JSON.stringify({ ok: true, email, userId, studentHash }));
