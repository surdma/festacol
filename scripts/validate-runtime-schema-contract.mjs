import { readdir, readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { extname, join, relative, resolve } from "node:path";

const ROOT = fileURLToPath(new URL("../src/", import.meta.url));
const REPOSITORY_ROOT = resolve(ROOT, "..");
const SOURCE_EXTENSIONS = new Set([".ts", ".tsx", ".js", ".jsx"]);
const BANNED_SOURCE_TOKENS = [
  "task7",
  "Task7",
  "academic_programmes",
  "exam_placement_programmes",
  "programme_id",
  "programmeId",
  "programme_name",
  "programmeName",
  "attempt_hash",
  "candidate_hash",
  "student_hash",
  "rewrite_archived_at",
  "rewrite_source_attempt_hash",
  "exam_attempt_subject_stats",
  "encodeSession",
  "decodeSession",
  "class_level",
  "class_group",
  "academic_session",
];

const violations = [];

async function walk(directory) {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) {
      await walk(path);
      continue;
    }
    if (!SOURCE_EXTENSIONS.has(extname(entry.name))) continue;
    const sourcePath = relative(REPOSITORY_ROOT, path);
    if (/task\d+/iu.test(entry.name)) {
      violations.push(`${sourcePath}: task-number filename is not a production domain name`);
    }
    const content = await readFile(path, "utf8");
    for (const token of BANNED_SOURCE_TOKENS) {
      if (content.includes(token)) violations.push(`${sourcePath}: contains retired runtime contract ${JSON.stringify(token)}`);
    }
  }
}

await walk(ROOT);

if (violations.length) {
  console.error("Runtime schema-contract validation failed:\n" + violations.map((item) => `- ${item}`).join("\n"));
  process.exit(1);
}

console.log("Runtime schema-contract validation passed.");
