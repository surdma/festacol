import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const questionsPath = resolve("public/seed/questions.json");
const subjectsPath = resolve("public/seed/subjects.json");
const mode = process.argv.includes("--check") ? "check" : "write";

const TRACKS = {
  Science: "SCIENCE",
  Art: "ART",
  Arts: "ART",
  "Social Science": "SOCIAL_SCIENCE",
};
const REQUIRED_ACROSS_TRACKS = new Set(["eng", "mat", "civ"]);

function sameSet(left, right) {
  return left.length === right.length && left.every((value) => right.includes(value));
}

function mapTracks(pathways, context) {
  if (!Array.isArray(pathways) || pathways.length === 0) {
    throw new Error(`${context}: pathways must be a non-empty array`);
  }
  const tracks = [...new Set(pathways.map((pathway) => TRACKS[String(pathway)]))];
  if (tracks.some((track) => !track)) {
    throw new Error(`${context}: unsupported pathway ${JSON.stringify(pathways)}`);
  }
  return tracks.sort();
}

const source = JSON.parse(readFileSync(questionsPath, "utf8"));
if (!source || Array.isArray(source) || !Array.isArray(source.questions)) {
  throw new Error("questions.json must be the versioned object fixture");
}

let subjectFixture;
let normalizedQuestions;

if (Array.isArray(source.subjectCatalog)) {
  const seenCodes = new Set();
  const subjects = source.subjectCatalog.map((entry, index) => {
    const code = String(entry.code ?? "").trim();
    const name = String(entry.label ?? "").trim();
    if (!code || !name) throw new Error(`subjectCatalog[${index}]: code and label are required`);
    if (seenCodes.has(code)) throw new Error(`subjectCatalog: duplicate code ${code}`);
    seenCodes.add(code);
    const tracks = mapTracks(entry.pathways, `subject ${code}`);
    const levels = Array.isArray(entry.levels) ? [...new Set(entry.levels.map(String))] : [];
    const modes = Array.isArray(entry.modes) ? [...new Set(entry.modes.map(String))] : [];
    return {
      code,
      name,
      active: true,
      levels,
      modes,
      trackRules: tracks.map((track) => ({
        track,
        participation: REQUIRED_ACROSS_TRACKS.has(code) ? "REQUIRED" : "ELECTIVE",
      })),
    };
  });

  const byCode = new Map(subjects.map((subject) => [subject.code, subject]));
  normalizedQuestions = source.questions.map((question, index) => {
    const code = String(question.subjectCode ?? "").trim();
    const subject = byCode.get(code);
    if (!subject) throw new Error(`question[${index}] id=${question.id}: unknown subjectCode ${code}`);

    const questionTracks = mapTracks(question.pathways, `question ${question.id}`);
    const subjectTracks = subject.trackRules.map((rule) => rule.track).sort();
    if (!sameSet(questionTracks, subjectTracks)) {
      throw new Error(`question ${question.id}: pathway exception must be modeled explicitly before deduplication`);
    }

    const levels = Array.isArray(question.levels) ? question.levels.map(String) : [];
    if (levels.some((level) => !subject.levels.includes(level))) {
      throw new Error(`question ${question.id}: level is outside subject ${code} fixture`);
    }

    const examModes = Array.isArray(question.examModes) ? question.examModes.map(String) : [];
    if (examModes.some((examMode) => !subject.modes.includes(examMode))) {
      throw new Error(`question ${question.id}: exam mode is outside subject ${code} fixture`);
    }

    const { subject: _legacySubject, pathways: _legacyPathways, ...rest } = question;
    return rest;
  });

  subjectFixture = {
    schemaVersion: 4,
    fixtureId: "festacol-subject-catalog-2026-09",
    tracks: ["SCIENCE", "ART", "SOCIAL_SCIENCE"],
    subjects,
  };
} else {
  subjectFixture = JSON.parse(readFileSync(subjectsPath, "utf8"));
  normalizedQuestions = source.questions;
}

const normalizedQuestionFixture = {
  ...source,
  schemaVersion: 4,
  subjectCatalog: undefined,
  questions: normalizedQuestions,
};
delete normalizedQuestionFixture.subjectCatalog;

const questionOutput = `${JSON.stringify(normalizedQuestionFixture, null, 2)}\n`;
const subjectOutput = `${JSON.stringify(subjectFixture, null, 2)}\n`;

if (mode === "check") {
  const currentQuestions = readFileSync(questionsPath, "utf8");
  const currentSubjects = readFileSync(subjectsPath, "utf8");
  if (currentQuestions !== questionOutput || currentSubjects !== subjectOutput) {
    throw new Error("Seed fixtures are not normalized. Run node scripts/reconstruct-seed-fixtures.mjs");
  }
  console.log(JSON.stringify({ ok: true, questions: normalizedQuestions.length, subjects: subjectFixture.subjects.length }));
} else {
  writeFileSync(questionsPath, questionOutput);
  writeFileSync(subjectsPath, subjectOutput);
  console.log(JSON.stringify({ ok: true, questions: normalizedQuestions.length, subjects: subjectFixture.subjects.length }));
}
