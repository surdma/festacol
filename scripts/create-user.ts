import "dotenv/config";
import { randomUUID } from "node:crypto";
import * as readline from "node:readline/promises";
import { createClient } from "@supabase/supabase-js";

// Interactive staff provisioning (replaces scripts/provision-admin.mjs).
// Usage: pnpm create-user
// Prompts for everything; every optional input can be skipped with Enter.

type StaffRole = "administrator" | "teacher";

function serviceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key)
    throw new Error(
      "NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY missing in .env",
    );
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

interface Prompter {
  question(prompt: string, hidden?: boolean): Promise<string>;
  close(): void;
}

// Interactive terminal prompts with masked password entry.
function interactivePrompter(): Prompter {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });
  const askHidden = (prompt: string): Promise<string> =>
    new Promise((resolve) => {
      const input = process.stdin;
      process.stdout.write(prompt);
      let value = "";
      rl.pause();
      input.setRawMode(true);
      input.resume();
      const done = (result: string) => {
        input.setRawMode(false);
        input.pause();
        input.removeListener("data", onData);
        rl.resume();
        process.stdout.write("\n");
        resolve(result);
      };
      const onData = (buf: Buffer) => {
        for (const ch of buf.toString("utf8")) {
          if (ch === "\n" || ch === "\r" || ch === "\u0004") return done(value);
          if (ch === "\u0003") {
            process.stdout.write("\n");
            process.exit(130);
          }
          if (ch === "\u007f" || ch === "\b") value = value.slice(0, -1);
          else value += ch;
        }
      };
      input.on("data", onData);
    });
  return {
    question: async (prompt, hidden = false) =>
      (hidden ? await askHidden(prompt) : await rl.question(prompt)).trim(),
    close: () => rl.close(),
  };
}

// Piped / redirected stdin (CI, scripted runs): sequential readline reads
// only serve the first line on some platforms, so consume all lines upfront.
async function pipedPrompter(): Promise<Prompter> {
  let chunks = "";
  process.stdin.setEncoding("utf8");
  for await (const chunk of process.stdin) chunks += chunk;
  const lines = chunks.split(/\r?\n/);
  let index = 0;
  return {
    question: async (prompt, hidden = false) => {
      const value = (lines[index++] ?? "").trim();
      process.stdout.write(`${prompt}${hidden ? "***" : value}\n`);
      return value;
    },
    close: () => undefined,
  };
}

async function askRequired(
  prompter: Prompter,
  prompt: string,
  validate: (v: string) => string | null,
  hidden = false,
): Promise<string> {
  for (;;) {
    const value = await prompter.question(prompt, hidden);
    const problem = validate(value);
    if (!problem) return value;
    console.log(`  ${problem} Try again.`);
  }
}

const isEmail = (v: string) =>
  /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)
    ? null
    : "That is not a valid email address.";

async function main() {
  const prompter = process.stdin.isTTY
    ? interactivePrompter()
    : await pipedPrompter();

  console.log(
    "Create staff account (administrator or teacher). Press Enter to skip optional inputs.\n",
  );

  const email = (await askRequired(prompter, "Email: ", isEmail)).toLowerCase();
  const password = await askRequired(
    prompter,
    "Password (8+ chars): ",
    (v) => (v.length >= 8 ? null : "Password must be at least 8 characters."),
    true,
  );
  const confirm = await prompter.question("Confirm password: ", true);
  if (confirm !== password) {
    console.error("Passwords do not match. Aborting.");
    process.exit(1);
  }
  const firstName = await askRequired(prompter, "First name: ", (v) =>
    v.length >= 2 ? null : "First name must be 2+ characters.",
  );
  const lastName = await askRequired(prompter, "Last name: ", (v) =>
    v.length >= 2 ? null : "Last name must be 2+ characters.",
  );

  console.log("Role:\n  1) administrator\n  2) teacher");
  const roleChoice = await prompter.question("Role [1]: ");
  const role: StaffRole = roleChoice === "2" ? "teacher" : "administrator";
  if (roleChoice !== "" && roleChoice !== "1" && roleChoice !== "2") {
    console.error("Role must be 1 or 2. Aborting.");
    process.exit(1);
  }

  const prefix = role === "administrator" ? "AD" : "TR";
  const autoStaffNumber = `${prefix}-${Date.now().toString(36).toUpperCase()}`;
  const staffNumberInput = await prompter.question(
    `Staff number [${autoStaffNumber}]: `,
  );
  const staffNumber = staffNumberInput || autoStaffNumber;
  const phoneInput = await prompter.question("Phone (optional): ");
  const qualifierDefault = role === "administrator";
  const qualifierInput = await prompter.question(
    `Qualifier access? [${qualifierDefault ? "Y/n" : "y/N"}]: `,
  );
  const qualifierAccess =
    qualifierInput === ""
      ? qualifierDefault
      : /^(y|yes)$/i.test(qualifierInput);
  prompter.close();

  const fullName = `${firstName} ${lastName}`;
  const admin = serviceClient();
  const memberId = randomUUID();

  const { data: listed, error: listError } = await admin.auth.admin.listUsers();
  if (listError)
    throw new Error(`Could not list auth users: ${listError.message}`);
  const dupe = listed.users.find((u) => u.email?.toLowerCase() === email);

  let authUserId: string;
  let createdNew = false;
  if (dupe) {
    const { data: linked } = await admin
      .from("school_members")
      .select("id")
      .eq("auth_user_id", dupe.id)
      .limit(1);
    if ((linked ?? []).length > 0) {
      console.error(
        `${email} is already linked to a school member. Nothing created.`,
      );
      process.exit(2);
    }
    const { error } = await admin.auth.admin.updateUserById(dupe.id, {
      password,
      email_confirm: true,
      app_metadata: { role, school_member_id: memberId },
    });
    if (error)
      throw new Error(`Could not adopt existing auth user: ${error.message}`);
    authUserId = dupe.id;
    console.log("Adopted existing auth account (password updated).");
  } else {
    const { data: created, error } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { full_name: fullName },
      app_metadata: { role, school_member_id: memberId },
    });
    if (error || !created.user)
      throw new Error(error?.message ?? "Auth account could not be created.");
    authUserId = created.user.id;
    createdNew = true;
  }

  const { error: memberError } = await admin.from("school_members").insert({
    id: memberId,
    auth_user_id: authUserId,
    role,
    status: "active",
    first_name: firstName,
    last_name: lastName,
    staff_number: staffNumber,
    phone: phoneInput || null,
    qualifier_access: qualifierAccess,
  });
  if (memberError) {
    if (createdNew)
      await admin.auth.admin.deleteUser(authUserId).catch(() => undefined);
    throw new Error(
      `Member insert failed${createdNew ? " (auth account rolled back)" : ""}: ${memberError.message}`,
    );
  }

  console.log(`\nCreated ${role}: ${email} (${fullName}, ${staffNumber})`);
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
