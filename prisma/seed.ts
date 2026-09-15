import { readFile } from "node:fs/promises";
import path from "node:path";
import { Client } from "pg";

type Track = "SCIENCE" | "HUMANITIES" | "BUSINESS";
type Participation = "REQUIRED" | "ELECTIVE";
type PeriodStatus = "PLANNED" | "ACTIVE" | "CLOSED" | "ARCHIVED";

interface CurriculumRuleFixture {
  level: string;
  track: Track;
  participation: Participation;
}

interface SubjectFixtureRow {
  code: string;
  name: string;
  kind: "CURRICULUM" | "QUALIFIER";
  active: boolean;
  curriculum: CurriculumRuleFixture[];
}

interface SubjectFixture {
  schemaVersion: number;
  tracks: Track[];
  levels: string[];
  subjects: SubjectFixtureRow[];
}

interface ClassFixture {
  schemaVersion: number;
  academicYear: { name: string; status: PeriodStatus };
  terms: { name: string; sequence: number; status: PeriodStatus }[];
  levels: { name: string; ordinal: number }[];
  classes: {
    id: string;
    level: string;
    track: Track;
    arm: string;
    capacity: number;
    room: string;
    status: "ACTIVE" | "INACTIVE";
    offerings: string[];
  }[];
}

interface QuestionFixture {
  schemaVersion: number;
  questions: Record<string, unknown>[];
}

const TRACK_DB: Record<Track, string> = {
  SCIENCE: "science",
  HUMANITIES: "humanities",
  BUSINESS: "business",
};
const PARTICIPATION_DB: Record<Participation, string> = {
  REQUIRED: "required",
  ELECTIVE: "elective",
};
const STATUS_DB: Record<PeriodStatus, string> = {
  PLANNED: "planned",
  ACTIVE: "active",
  CLOSED: "closed",
  ARCHIVED: "archived",
};
const VALID_TRACKS = new Set<Track>(["SCIENCE", "HUMANITIES", "BUSINESS"]);
const VALID_MODES = new Set(["qualifier", "bece", "waec", "neco", "jamb", "mixed", "single"]);
const VALID_TYPES = new Set(["single", "multi", "boolean", "fill", "fill-multi"]);

async function loadJson<T>(name: string): Promise<T> {
  return JSON.parse(await readFile(path.join(process.cwd(), "public", "seed", name), "utf8")) as T;
}

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function unique(values: string[], label: string) {
  const seen = new Set<string>();
  for (const value of values) {
    assert(value.length > 0, `${label} contains an empty value.`);
    assert(!seen.has(value), `${label} contains duplicate value ${value}.`);
    seen.add(value);
  }
}

function validateFixtures(subjects: SubjectFixture, classes: ClassFixture, questions: QuestionFixture) {
  assert(subjects.schemaVersion === 5, "subjects.json must use schemaVersion 5.");
  assert(classes.schemaVersion === 5, "classes.json must use schemaVersion 5.");
  assert(questions.schemaVersion === 5, "questions.json must use schemaVersion 5.");
  assert(subjects.subjects.length > 0, "subjects.json has no subjects.");
  assert(classes.classes.length > 0, "classes.json has no classes.");
  assert(questions.questions.length > 0, "questions.json has no questions.");

  unique(subjects.subjects.map((subject) => subject.code), "subject codes");
  unique(classes.levels.map((level) => level.name), "academic levels");
  unique(classes.classes.map((item) => item.id), "class ids");
  unique(subjects.tracks, "subject fixture tracks");
  assert(
    subjects.tracks.length === VALID_TRACKS.size && subjects.tracks.every((track) => VALID_TRACKS.has(track)),
    "subjects.json tracks must be exactly SCIENCE, HUMANITIES and BUSINESS.",
  );

  const levelNames = new Set(classes.levels.map((level) => level.name));
  const subjectByCode = new Map(subjects.subjects.map((subject) => [subject.code, subject]));
  const ruleKeys = new Set<string>();

  for (const subject of subjects.subjects) {
    assert(subject.code === subject.code.trim().toLowerCase(), `Subject code ${subject.code} must be lowercase and trimmed.`);
    assert(subject.name.trim().length > 0, `Subject ${subject.code} has no name.`);
    if (subject.kind === "QUALIFIER") {
      assert(subject.curriculum.length === 0, `Qualifier subject ${subject.code} must not have senior curriculum rules.`);
      continue;
    }
    assert(subject.curriculum.length > 0, `Curriculum subject ${subject.code} has no curriculum rules.`);
    for (const rule of subject.curriculum) {
      assert(levelNames.has(rule.level), `Subject ${subject.code} references unknown level ${rule.level}.`);
      assert(VALID_TRACKS.has(rule.track), `Subject ${subject.code} references invalid track ${rule.track}.`);
      const key = `${subject.code}:${rule.level}:${rule.track}`;
      assert(!ruleKeys.has(key), `Duplicate curriculum rule ${key}.`);
      ruleKeys.add(key);
    }
  }

  for (const coreCode of ["eng", "mat", "civ", "comp"]) {
    for (const level of levelNames) {
      for (const track of VALID_TRACKS) {
        const subject = subjectByCode.get(coreCode);
        const rule = subject?.curriculum.find((item) => item.level === level && item.track === track);
        assert(rule?.participation === "REQUIRED", `${coreCode} must be REQUIRED for ${level} ${track}.`);
      }
    }
  }
  const chemistry = subjectByCode.get("chem");
  assert(chemistry, "Chemistry is missing from the subject catalog.");
  assert(chemistry.curriculum.every((rule) => rule.track === "SCIENCE"), "Chemistry must be Science-only.");

  for (const item of classes.classes) {
    assert(levelNames.has(item.level), `Class ${item.id} references unknown level ${item.level}.`);
    assert(VALID_TRACKS.has(item.track), `Class ${item.id} has invalid track ${item.track}.`);
    assert(Number.isInteger(item.capacity) && item.capacity > 0, `Class ${item.id} has invalid capacity.`);
    unique(item.offerings, `offerings for ${item.id}`);
    for (const code of item.offerings) {
      const subject = subjectByCode.get(code);
      assert(subject, `Class ${item.id} references unknown subject ${code}.`);
      assert(subject.kind === "CURRICULUM", `Class ${item.id} cannot offer qualifier subject ${code}.`);
      assert(
        subject.curriculum.some((rule) => rule.level === item.level && rule.track === item.track),
        `Subject ${code} is not allowed for ${item.level} ${item.track}.`,
      );
    }
  }

  const questionIds = questions.questions.map((question) => String(question.id ?? ""));
  unique(questionIds, "question ids");
  for (const question of questions.questions) {
    const id = Number(question.id);
    assert(Number.isSafeInteger(id) && id > 0, `Question ${String(question.id)} has an invalid id.`);
    const code = String(question.subjectCode ?? "");
    assert(subjectByCode.has(code), `Question ${id} references unknown subject ${code}.`);
    const qLevels = Array.isArray(question.levels) ? question.levels.map(String) : [];
    assert(qLevels.length > 0, `Question ${id} has no academic levels.`);
    for (const level of qLevels) assert(levelNames.has(level), `Question ${id} references unknown level ${level}.`);
    const modes = Array.isArray(question.examModes) ? question.examModes.map(String) : [];
    assert(modes.length > 0, `Question ${id} has no exam modes.`);
    for (const mode of modes) assert(VALID_MODES.has(mode), `Question ${id} has invalid exam mode ${mode}.`);
    const type = String(question.type ?? "");
    assert(VALID_TYPES.has(type), `Question ${id} has invalid type ${type}.`);
    assert(String(question.prompt ?? "").trim().length > 0, `Question ${id} has no prompt.`);
  }
}

function questionAnswerValues(question: Record<string, unknown>, type: string): string[] {
  if (type === "fill" || type === "fill-multi") return [];
  if (type === "boolean") return [String(question.answer).toLowerCase()];
  if (Array.isArray(question.answers)) return question.answers.map(String);
  if (Array.isArray(question.answer)) return question.answer.map(String);
  return question.answer === undefined ? [] : [String(question.answer)];
}

function questionBlanks(question: Record<string, unknown>, id: number) {
  const template = question.fillTemplate;
  if (!Array.isArray(template)) return { fillTemplate: null as string | null, blanks: [] as Record<string, unknown>[] };

  const acceptedSource = question.acceptedAnswers;
  let position = 0;
  const blanks: Record<string, unknown>[] = [];
  const text = template.map((raw) => {
    const part = raw as { text?: string; blank?: string; placeholder?: string };
    if (part.blank === undefined) return part.text ?? "";

    let accepted: string[] = [];
    if (Array.isArray(acceptedSource)) {
      if (acceptedSource.length > 0 && Array.isArray(acceptedSource[0])) {
        accepted = ((acceptedSource[position] ?? []) as unknown[]).map(String);
      } else if (position === 0) {
        accepted = (acceptedSource as unknown[]).map(String);
      }
    }

    blanks.push({
      question_id: id,
      position,
      blank_key: String(part.blank || `b${position}`),
      placeholder: String(part.placeholder ?? ""),
      accepted,
    });
    return `{{${position++}}}`;
  }).join("");

  return { fillTemplate: text, blanks };
}

async function seedDatabase(subjectFixture: SubjectFixture, classFixture: ClassFixture, questionFixture: QuestionFixture) {
  const databaseUrl = process.env.DATABASE_URL;
  assert(databaseUrl, "DATABASE_URL is required to seed the database.");

  const client = new Client({ connectionString: databaseUrl });
  await client.connect();
  try {
    await client.query("BEGIN");

    const levelIdByName = new Map<string, string>();
    for (const level of classFixture.levels) {
      const result = await client.query<{ id: string }>(
        `INSERT INTO academic_levels(name,ordinal,active)
         VALUES ($1,$2,true)
         ON CONFLICT (name) DO UPDATE SET ordinal=EXCLUDED.ordinal,active=true
         RETURNING id`,
        [level.name, level.ordinal],
      );
      levelIdByName.set(level.name, result.rows[0].id);
    }

    const yearResult = await client.query<{ id: string }>(
      `INSERT INTO academic_years(name,status)
       VALUES ($1,$2::academic_period_status)
       ON CONFLICT (name) DO UPDATE SET status=EXCLUDED.status,updated_at=now()
       RETURNING id`,
      [classFixture.academicYear.name, STATUS_DB[classFixture.academicYear.status]],
    );
    const academicYearId = yearResult.rows[0].id;

    for (const term of classFixture.terms) {
      await client.query(
        `INSERT INTO academic_terms(academic_year_id,name,sequence,status)
         VALUES ($1,$2,$3,$4::academic_period_status)
         ON CONFLICT (academic_year_id,sequence)
         DO UPDATE SET name=EXCLUDED.name,status=EXCLUDED.status,updated_at=now()`,
        [academicYearId, term.name, term.sequence, STATUS_DB[term.status]],
      );
    }

    const subjectIdByCode = new Map<string, string>();
    for (const subject of subjectFixture.subjects) {
      const result = await client.query<{ id: string }>(
        `INSERT INTO subjects(code,name,kind,active)
         VALUES ($1,$2,$3::subject_kind,$4)
         ON CONFLICT (code)
         DO UPDATE SET name=EXCLUDED.name,kind=EXCLUDED.kind,active=EXCLUDED.active,updated_at=now()
         RETURNING id`,
        [subject.code, subject.name, subject.kind.toLowerCase(), subject.active],
      );
      subjectIdByCode.set(subject.code, result.rows[0].id);
    }

    for (const subject of subjectFixture.subjects) {
      const subjectId = subjectIdByCode.get(subject.code)!;
      for (const rule of subject.curriculum) {
        await client.query(
          `INSERT INTO subject_curriculum_rules(subject_id,level_id,track,participation)
           VALUES ($1,$2,$3::academic_track,$4::offering_participation)
           ON CONFLICT (subject_id,level_id,track)
           DO UPDATE SET participation=EXCLUDED.participation,updated_at=now()`,
          [subjectId, levelIdByName.get(rule.level), TRACK_DB[rule.track], PARTICIPATION_DB[rule.participation]],
        );
      }
    }

    for (const item of classFixture.classes) {
      await client.query(
        `INSERT INTO classes(id,level_id,track,academic_year_id,arm,capacity,room,status)
         VALUES ($1,$2,$3::academic_track,$4,$5,$6,$7,$8::record_status)
         ON CONFLICT (id)
         DO UPDATE SET level_id=EXCLUDED.level_id,track=EXCLUDED.track,academic_year_id=EXCLUDED.academic_year_id,
                       arm=EXCLUDED.arm,capacity=EXCLUDED.capacity,room=EXCLUDED.room,status=EXCLUDED.status,
                       updated_at=now()`,
        [
          item.id,
          levelIdByName.get(item.level),
          TRACK_DB[item.track],
          academicYearId,
          item.arm,
          item.capacity,
          item.room,
          item.status.toLowerCase(),
        ],
      );
      for (const code of item.offerings) {
        await client.query(
          `INSERT INTO class_subject_offerings(class_id,subject_id,status)
           VALUES ($1,$2,'active')
           ON CONFLICT (class_id,subject_id)
           DO UPDATE SET status='active',updated_at=now()`,
          [item.id, subjectIdByCode.get(code)],
        );
      }
    }

    for (const question of questionFixture.questions) {
      const id = Number(question.id);
      const existing = await client.query<{ creator_id: string | null }>(
        "SELECT creator_id FROM questions WHERE id=$1",
        [id],
      );
      if (existing.rows[0]?.creator_id) {
        throw new Error(`Question ${id} is staff-authored and cannot be overwritten by fixture seeding.`);
      }

      const type = String(question.type);
      const { fillTemplate, blanks } = questionBlanks(question, id);
      const answerValues = questionAnswerValues(question, type);
      const options = Array.isArray(question.options) ? question.options.map(String) : [];
      const modes = Array.isArray(question.examModes) ? question.examModes.map(String) : [];

      await client.query(
        `INSERT INTO questions(
           id,subject_id,qtype,prompt,options,correct_answers,fill_template,instruction,
           exam_modes,difficulty,domain,explanation,status,creator_id,created_at,updated_at
         )
         VALUES ($1,$2,$3::question_type,$4,$5,$6,$7,$8,$9::exam_mode[],$10,$11,$12,'active',NULL,now(),$13)
         ON CONFLICT (id) DO UPDATE SET
           subject_id=EXCLUDED.subject_id,qtype=EXCLUDED.qtype,prompt=EXCLUDED.prompt,
           options=EXCLUDED.options,correct_answers=EXCLUDED.correct_answers,
           fill_template=EXCLUDED.fill_template,instruction=EXCLUDED.instruction,
           exam_modes=EXCLUDED.exam_modes,difficulty=EXCLUDED.difficulty,
           domain=EXCLUDED.domain,explanation=EXCLUDED.explanation,status='active',
           updated_at=EXCLUDED.updated_at`,
        [
          id,
          subjectIdByCode.get(String(question.subjectCode)),
          type,
          String(question.prompt ?? ""),
          options,
          answerValues,
          fillTemplate,
          String(question.instruction ?? ""),
          modes,
          String(question.difficulty ?? "medium"),
          String(question.domain ?? ""),
          String(question.explanation ?? ""),
          Date.now(),
        ],
      );

      await client.query("DELETE FROM question_academic_levels WHERE question_id=$1", [id]);
      for (const levelName of (question.levels as unknown[]).map(String)) {
        await client.query(
          "INSERT INTO question_academic_levels(question_id,level_id) VALUES ($1,$2)",
          [id, levelIdByName.get(levelName)],
        );
      }

      await client.query("DELETE FROM question_blanks WHERE question_id=$1", [id]);
      for (const blank of blanks) {
        await client.query(
          `INSERT INTO question_blanks(question_id,position,blank_key,placeholder,accepted)
           VALUES ($1,$2,$3,$4,$5)`,
          [blank.question_id, blank.position, blank.blank_key, blank.placeholder, blank.accepted],
        );
      }
    }

    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    await client.end();
  }
}

async function main() {
  const [subjects, classes, questions] = await Promise.all([
    loadJson<SubjectFixture>("subjects.json"),
    loadJson<ClassFixture>("classes.json"),
    loadJson<QuestionFixture>("questions.json"),
  ]);

  validateFixtures(subjects, classes, questions);

  if (process.argv.includes("--validate-only")) {
    console.log(
      `Fixture validation passed: ${subjects.subjects.length} subjects, ${classes.classes.length} classes, ${questions.questions.length} questions.`,
    );
    return;
  }

  await seedDatabase(subjects, classes, questions);
  console.log(
    `Seed completed: ${subjects.subjects.length} subjects, ${classes.classes.length} classes, ${questions.questions.length} questions and all required relation rows.`,
  );
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
