// One-shot first-admin provisioning (mirror of POST /api/admin/bootstrap).
// Usage: node scripts/provision-admin.mjs <email> <password> [fullName]
// Reads SUPABASE_URL + SERVICE ROLE from .env. Refuses if an admin roster
// row already exists. Rotate the password after first sign-in.
import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";

const [email, password, fullName = "Administrator"] = process.argv.slice(2);
if (!email || !password || password.length < 8) {
  console.error("Usage: node scripts/provision-admin.mjs <email> <password> [fullName]");
  process.exit(1);
}

function env(name) {
  const m = readFileSync(".env", "utf8").match(new RegExp(`^${name}=(.*)$`, "m"));
  if (!m) throw new Error(`${name} missing in .env`);
  return m[1].trim().replace(/^["']|["']$/g, "");
}

const admin = createClient(env("NEXT_PUBLIC_SUPABASE_URL"), env("SUPABASE_SERVICE_ROLE_KEY"), {
  auth: { persistSession: false, autoRefreshToken: false },
});

const { data: existing } = await admin.from("users").select("id").eq("role", "administrator").limit(1);
if (existing?.length) {
  console.error("An administrator roster row already exists — refusing.");
  process.exit(2);
}

const parts = fullName.trim().split(/\s+/);
let userId;
const { data: listed } = await admin.auth.admin.listUsers();
const dupe = listed?.users?.find((u) => u.email?.toLowerCase() === email.toLowerCase());
if (dupe) {
  console.log("Auth user exists — adopting it.");
  userId = dupe.id;
  const { error } = await admin.auth.admin.updateUserById(userId, {
    password, email_confirm: true, app_metadata: { role: "administrator" },
  });
  if (error) throw new Error(error.message);
} else {
  const { data: created, error } = await admin.auth.admin.createUser({
    email, password, email_confirm: true,
    user_metadata: { full_name: fullName },
    app_metadata: { role: "administrator" },
  });
  if (error || !created.user) throw new Error(error?.message ?? "Create failed.");
  userId = created.user.id;
}

const rosterId = `AD-${Date.now().toString(36).toUpperCase()}`;
const { error: rosterError } = await admin.from("users").insert({
  id: rosterId, full_name: fullName,
  first_name: parts[0] ?? fullName,
  last_name: (parts.slice(1).join(" ") || parts[0]) ?? fullName,
  role: "administrator", status: "active",
  class_id: null,
  academic_session: "2026/2027", promotion_status: "on-track",
  joined_at: Date.now(), auth_user_id: userId, email,
  subjects: [], qualifier_access: true,
});
if (rosterError) throw new Error(rosterError.message);
await admin.auth.admin.updateUserById(userId, { app_metadata: { role: "administrator", staff_id: rosterId } });
console.log(JSON.stringify({ ok: true, id: rosterId, email }));
