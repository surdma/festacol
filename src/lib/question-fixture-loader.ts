import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import {
  QUESTION_FIXTURE_DIRECTORIES,
  QUESTION_FIXTURE_FILES,
  QUESTION_FIXTURE_SCHEMA_VERSION,
} from "@/lib/fixture-sources";
import {
  expandQuestionFixture,
  type ExpandedQuestionFixture,
  type QuestionFixtureDocument,
} from "@/lib/question-fixture-expander";

export interface LoadedQuestionBank extends ExpandedQuestionFixture {
  files: string[];
}

async function loadJson<T>(relativePath: string): Promise<T> {
  const raw = await readFile(path.join(process.cwd(), "public", "seed", relativePath), "utf8");
  return JSON.parse(raw) as T;
}

async function discoverGeneratedFixtureFiles(): Promise<string[]> {
  const discovered: string[] = [];
  for (const relativeDirectory of QUESTION_FIXTURE_DIRECTORIES) {
    const absoluteDirectory = path.join(process.cwd(), "public", "seed", relativeDirectory);
    let entries: string[];
    try {
      entries = await readdir(absoluteDirectory);
    } catch (error) {
      const code = error && typeof error === "object" && "code" in error ? String(error.code) : "";
      if (code === "ENOENT") continue;
      throw error;
    }
    for (const entry of entries.sort()) {
      if (entry.endsWith(".json")) discovered.push(`${relativeDirectory}/${entry}`);
    }
  }
  return discovered;
}

export async function listQuestionFixtureFiles(): Promise<string[]> {
  const generated = await discoverGeneratedFixtureFiles();
  return [...QUESTION_FIXTURE_FILES, ...generated];
}

export async function loadQuestionBankFixture(): Promise<LoadedQuestionBank> {
  const files = await listQuestionFixtureFiles();
  const documents = await Promise.all(files.map((name) => loadJson<QuestionFixtureDocument>(name)));
  const fixtures = documents.map((document, index) => {
    const name = files[index];
    if (document.schemaVersion !== QUESTION_FIXTURE_SCHEMA_VERSION) {
      throw new Error(`Unsupported question fixture ${name}.`);
    }
    return expandQuestionFixture(document, name);
  });

  const questions = fixtures.flatMap((fixture) => fixture.questions);
  const baseQuestionId = fixtures.find((fixture) => fixture.questionSetId)?.questionSetId ?? "festacol-question-bank";

  return {
    schemaVersion: QUESTION_FIXTURE_SCHEMA_VERSION,
    questionSetId: baseQuestionId,
    questions,
    files,
  };
}
