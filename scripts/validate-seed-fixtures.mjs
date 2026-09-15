import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const read = (name) => JSON.parse(readFileSync(resolve("public/seed", name), "utf8"));
const subjects = read("subjects.json");
const classes = read("classes.json");
const questions = read("questions.json");

const TRACKS = new Set(["SCIENCE", "ART", "SOCIAL_SCIENCE"]);
const PARTICIPATION = new Set(["REQUIRED", "ELECTIVE"]);
const LEVELS = new Set(["SS1", "SS2", "SS3"]);
const fail = (message) => {
  throw new Error(`Seed fixture validation failed: ${message}`);
};
const unique = (values, label) => {
  if (new Set(values).size !== values.length) fail(`${label} contains duplicates`);
};

if (subjects.schemaVersion !== 4 || classes.schemaVersion !== 4 || questions.schemaVersion !== 4) {
  fail("all fixtures must use schemaVersion 4");
}
if (JSON.stringify(new Set(subjects.tracks)) !== JSON.stringify(TRACKS)) {
  const listed = new Set(subjects.tracks ?? []);
  if (listed.size !== TRACKS.size || [...TRACKS].some((track) => !listed.has(track))) {
    fail("subjects.tracks must be SCIENCE, ART and SOCIAL_SCIENCE only");
  }
}

const subjectRows = Array.isArray(subjects.subjects) ? subjects.subjects : [];
if (!subjectRows.length) fail("subjects.json has no subjects");
unique(subjectRows.map((row) => row.code), "subject codes");
const subjectByCode = new Map(subjectRows.map((row) => [row.code, row]));

for (const subject of subjectRows) {
  if (!subject.code || !subject.name) fail("every subject requires code and name");
  if (!Array.isArray(subject.levels) || subject.levels.some((level) => !LEVELS.has(level))) {
    fail(`subject ${subject.code} has an unsupported academic level`);
  }
  if (!Array.isArray(subject.modes) || !Array.isArray(subject.trackRules)) {
    fail(`subject ${subject.code} must declare modes and trackRules arrays`);
  }
  unique(subject.trackRules.map((rule) => rule.track), `track rules for ${subject.code}`);
  for (const rule of subject.trackRules) {
    if (!TRACKS.has(rule.track)) fail(`subject ${subject.code} has invalid track ${rule.track}`);
    if (!PARTICIPATION.has(rule.participation)) fail(`subject ${subject.code} has invalid participation`);
  }
  if (subject.modes.includes("qualifier") && subject.trackRules.length) {
    fail(`qualifier subject ${subject.code} must not be assigned to a senior academic track`);
  }
}

const expectedTracks = {
  eng: ["ART", "SCIENCE", "SOCIAL_SCIENCE"],
  mat: ["ART", "SCIENCE", "SOCIAL_SCIENCE"],
  chem: ["SCIENCE"],
  phy: ["SCIENCE"],
  bio: ["SCIENCE"],
  agric: ["SCIENCE"],
  geo: ["SCIENCE"],
  gov: ["ART"],
  lit: ["ART"],
  eco: ["SOCIAL_SCIENCE"],
};
for (const [code, expected] of Object.entries(expectedTracks)) {
  const subject = subjectByCode.get(code);
  if (!subject) fail(`required input-bank subject ${code} is missing`);
  const actual = subject.trackRules.map((rule) => rule.track).sort();
  if (actual.join(",") !== [...expected].sort().join(",")) {
    fail(`subject ${code} track rules are ${actual.join(",") || "none"}; expected ${expected.join(",")}`);
  }
}

const classRows = Array.isArray(classes.classes) ? classes.classes : [];
if (!classRows.length || !classes.academicYear) fail("classes.json requires academicYear and classes");
unique(classRows.map((row) => row.id), "class ids");
for (const row of classRows) {
  if (!LEVELS.has(row.level)) fail(`class ${row.id} has invalid level ${row.level}`);
  if (row.track !== null && !TRACKS.has(row.track)) fail(`class ${row.id} has invalid track ${row.track}`);
  for (const legacyKey of ["stream", "grp", "class_level", "academic_session", "programmeId", "programme_id"]) {
    if (legacyKey in row) fail(`class ${row.id} contains legacy field ${legacyKey}`);
  }
}

const questionRows = Array.isArray(questions.questions) ? questions.questions : [];
if (!questionRows.length) fail("questions.json has no questions");
if ("subjectCatalog" in questions) fail("questions.json must not embed a subject catalog");
unique(questionRows.map((row) => row.id), "question ids");
for (const question of questionRows) {
  const subject = subjectByCode.get(question.subjectCode);
  if (!subject) fail(`question ${question.id} references unknown subjectCode ${question.subjectCode}`);
  for (const legacyKey of ["subject", "subjectName", "pathways", "streams", "category"]) {
    if (legacyKey in question) fail(`question ${question.id} contains duplicated legacy field ${legacyKey}`);
  }
  if (!Array.isArray(question.levels) || question.levels.some((level) => !subject.levels.includes(level))) {
    fail(`question ${question.id} has academic levels outside subject ${subject.code}`);
  }
}

console.log(JSON.stringify({
  ok: true,
  subjects: subjectRows.length,
  classes: classRows.length,
  questions: questionRows.length,
}));
