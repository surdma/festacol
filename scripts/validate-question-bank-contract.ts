import { readFile } from "node:fs/promises";
import path from "node:path";
import { loadQuestionBankFixture } from "../src/lib/question-fixture-loader";

interface SubjectFixtureRow {
  code: string;
  name: string;
  kind: "CURRICULUM" | "QUALIFIER";
  active: boolean;
}

interface SubjectFixture {
  schemaVersion: number;
  subjects: SubjectFixtureRow[];
}

const MINIMUM_QUESTIONS_PER_ACTIVE_SUBJECT = 100;

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

async function main() {
  const subjectFixture = JSON.parse(
    await readFile(path.join(process.cwd(), "public", "seed", "subjects.json"), "utf8"),
  ) as SubjectFixture;
  assert(subjectFixture.schemaVersion === 5, "subjects.json must use schemaVersion 5.");

  const bank = await loadQuestionBankFixture();
  const activeSubjects = subjectFixture.subjects.filter((subject) => subject.active);
  const activeByCode = new Map(activeSubjects.map((subject) => [subject.code, subject]));
  const counts = new Map<string, number>();
  const ids = new Set<number>();

  for (const question of bank.questions) {
    const id = Number(question.id);
    const code = String(question.subjectCode ?? "");
    assert(Number.isSafeInteger(id) && id > 0, `Question ${String(question.id)} has an invalid id.`);
    assert(!ids.has(id), `Question bank contains duplicate id ${id}.`);
    ids.add(id);
    assert(activeByCode.has(code), `Question ${id} references inactive or unknown subject ${code}.`);
    counts.set(code, (counts.get(code) ?? 0) + 1);

    const modes = Array.isArray(question.examModes) ? question.examModes.map(String) : [];
    const levels = Array.isArray(question.levels) ? question.levels.map(String) : [];
    assert(modes.length > 0, `Question ${id} has no exam mode.`);
    assert(levels.length > 0, `Question ${id} has no academic level.`);
    const subject = activeByCode.get(code)!;
    if (subject.kind === "QUALIFIER") {
      assert(modes.every((mode) => mode === "qualifier"), `Qualifier question ${id} may only use qualifier mode.`);
      assert(levels.every((level) => level === "SS1"), `Qualifier question ${id} must target incoming SS1.`);
    } else {
      assert(!modes.includes("qualifier"), `Curriculum question ${id} cannot use qualifier mode.`);
    }
  }

  const shortfalls = activeSubjects
    .map((subject) => ({ ...subject, count: counts.get(subject.code) ?? 0 }))
    .filter((subject) => subject.count < MINIMUM_QUESTIONS_PER_ACTIVE_SUBJECT);
  assert(
    shortfalls.length === 0,
    `Every active subject needs at least ${MINIMUM_QUESTIONS_PER_ACTIVE_SUBJECT} questions. Shortfalls: ${shortfalls.map((subject) => `${subject.code}=${subject.count}`).join(", ")}`,
  );

  const minimumTotal = activeSubjects.length * MINIMUM_QUESTIONS_PER_ACTIVE_SUBJECT;
  assert(bank.questions.length >= minimumTotal, `Question bank must contain at least ${minimumTotal} materialized questions.`);

  console.log(
    `Question bank contract passed: ${activeSubjects.length} active subjects, ${bank.questions.length} materialized questions, minimum ${MINIMUM_QUESTIONS_PER_ACTIVE_SUBJECT} per subject across ${bank.files.length} fixture files.`,
  );
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
