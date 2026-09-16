export interface GeneratedQuestionConcept {
  domain: string;
  term: string;
  definition: string;
}

export interface GeneratedQuestionFixtureSpec {
  version: 1;
  subjectCode: string;
  subjectName: string;
  baseId: number;
  levels: string[];
  examModes: string[];
  concepts: GeneratedQuestionConcept[];
}

export interface QuestionFixtureDocument {
  schemaVersion: number;
  questionSetId?: string;
  questions?: Record<string, unknown>[];
  generator?: GeneratedQuestionFixtureSpec;
}

export interface ExpandedQuestionFixture {
  schemaVersion: number;
  questionSetId?: string;
  questions: Record<string, unknown>[];
}

export const GENERATED_QUESTIONS_PER_CONCEPT = 10;
export const GENERATED_CONCEPTS_PER_SUBJECT = 10;
export const GENERATED_QUESTIONS_PER_SUBJECT = GENERATED_QUESTIONS_PER_CONCEPT * GENERATED_CONCEPTS_PER_SUBJECT;

function assertFixture(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function distinct(values: string[], label: string) {
  const normalized = values.map((value) => value.trim().toLocaleLowerCase("en"));
  assertFixture(normalized.every(Boolean), `${label} contains an empty value.`);
  assertFixture(new Set(normalized).size === normalized.length, `${label} contains duplicate values.`);
}

function choiceWindow<T>(items: T[], index: number): [T, T, T, T] {
  const size = items.length;
  return [items[index % size], items[(index + 1) % size], items[(index + 2) % size], items[(index + 3) % size]];
}

function difficultyFor(variant: number): "easy" | "medium" | "hard" {
  if (variant <= 2) return "easy";
  if (variant <= 6) return "medium";
  return "hard";
}

function fixtureQuestionBase(spec: GeneratedQuestionFixtureSpec, concept: GeneratedQuestionConcept, id: number, variant: number) {
  return {
    id,
    subjectCode: spec.subjectCode,
    domain: concept.domain,
    levels: spec.levels,
    examModes: spec.examModes,
    difficulty: difficultyFor(variant),
    label: `${spec.subjectName} · ${concept.domain} · Baseline ${variant + 1}`,
    explanation: `In this baseline fixture, ${concept.term} is defined as ${concept.definition}.`,
  };
}

function expandConcept(spec: GeneratedQuestionFixtureSpec, concepts: GeneratedQuestionConcept[], conceptIndex: number): Record<string, unknown>[] {
  const concept = concepts[conceptIndex];
  const [current, next, third, fourth] = choiceWindow(concepts, conceptIndex);
  const base = spec.baseId + conceptIndex * GENERATED_QUESTIONS_PER_CONCEPT;
  const correctPair = `${current.term} — ${current.definition}`;
  const nextPair = `${next.term} — ${next.definition}`;
  const wrongPairOne = `${third.term} — ${fourth.definition}`;
  const wrongPairTwo = `${fourth.term} — ${third.definition}`;

  return [
    {
      ...fixtureQuestionBase(spec, concept, base, 0),
      type: "single",
      prompt: `Which statement best describes ${current.term} in ${spec.subjectName}?`,
      options: [current.definition, next.definition, third.definition, fourth.definition],
      answer: current.definition,
    },
    {
      ...fixtureQuestionBase(spec, concept, base + 1, 1),
      type: "single",
      prompt: `Which ${spec.subjectName} concept matches this description: ${current.definition}?`,
      options: [current.term, next.term, third.term, fourth.term],
      answer: current.term,
    },
    {
      ...fixtureQuestionBase(spec, concept, base + 2, 2),
      type: "boolean",
      prompt: `True or false: In ${spec.subjectName}, ${current.term} is ${current.definition}.`,
      answer: true,
    },
    {
      ...fixtureQuestionBase(spec, concept, base + 3, 3),
      type: "boolean",
      prompt: `True or false: In ${spec.subjectName}, ${current.term} is ${next.definition}.`,
      answer: false,
    },
    {
      ...fixtureQuestionBase(spec, concept, base + 4, 4),
      type: "fill",
      prompt: `Identify the ${spec.subjectName} concept described as "${current.definition}".`,
      fillTemplate: [
        { text: "Answer: " },
        { blank: "answer", placeholder: "concept" },
      ],
      acceptedAnswers: [current.term, current.term.toLocaleLowerCase("en")],
    },
    {
      ...fixtureQuestionBase(spec, concept, base + 5, 5),
      type: "multi",
      prompt: `Select exactly TWO correctly matched ${spec.subjectName} pairs.`,
      instruction: "Select exactly TWO answers.",
      requiredSelections: 2,
      options: [correctPair, nextPair, wrongPairOne, wrongPairTwo],
      answers: [correctPair, nextPair],
    },
    {
      ...fixtureQuestionBase(spec, concept, base + 6, 6),
      type: "single",
      prompt: `Which ${spec.subjectName} pair is correctly matched?`,
      options: [correctPair, `${current.term} — ${next.definition}`, `${third.term} — ${current.definition}`, `${fourth.term} — ${third.definition}`],
      answer: correctPair,
    },
    {
      ...fixtureQuestionBase(spec, concept, base + 7, 7),
      type: "fill-multi",
      prompt: `Complete both ${spec.subjectName} concepts from their descriptions.`,
      fillTemplate: [
        { text: `${current.definition} = ` },
        { blank: "first", placeholder: "first concept" },
        { text: `; ${next.definition} = ` },
        { blank: "second", placeholder: "second concept" },
      ],
      acceptedAnswers: [
        [current.term, current.term.toLocaleLowerCase("en")],
        [next.term, next.term.toLocaleLowerCase("en")],
      ],
    },
    {
      ...fixtureQuestionBase(spec, concept, base + 8, 8),
      type: "single",
      prompt: `A learner encounters the description "${current.definition}". Which term should be used?`,
      options: [current.term, next.term, third.term, fourth.term],
      answer: current.term,
    },
    {
      ...fixtureQuestionBase(spec, concept, base + 9, 9),
      type: "boolean",
      prompt: `True or false: ${current.term} belongs to the ${current.domain} area of ${spec.subjectName}.`,
      answer: true,
    },
  ];
}

export function expandQuestionFixture(document: QuestionFixtureDocument, sourceName: string): ExpandedQuestionFixture {
  const hasQuestions = Array.isArray(document.questions);
  const hasGenerator = Boolean(document.generator);
  assertFixture(hasQuestions !== hasGenerator, `${sourceName} must contain either questions or generator metadata, but not both.`);

  if (hasQuestions) {
    return {
      schemaVersion: document.schemaVersion,
      questionSetId: document.questionSetId,
      questions: document.questions ?? [],
    };
  }

  const spec = document.generator!;
  assertFixture(spec.version === 1, `${sourceName} has an unsupported generator version.`);
  assertFixture(spec.subjectCode.trim().length > 0, `${sourceName} has no subjectCode.`);
  assertFixture(spec.subjectName.trim().length > 0, `${sourceName} has no subjectName.`);
  assertFixture(Number.isSafeInteger(spec.baseId) && spec.baseId > 0, `${sourceName} has an invalid baseId.`);
  assertFixture(spec.levels.length > 0, `${sourceName} has no academic levels.`);
  assertFixture(spec.examModes.length > 0, `${sourceName} has no exam modes.`);
  assertFixture(spec.concepts.length === GENERATED_CONCEPTS_PER_SUBJECT, `${sourceName} must define exactly ${GENERATED_CONCEPTS_PER_SUBJECT} concepts.`);
  distinct(spec.concepts.map((concept) => concept.term), `${sourceName} concept terms`);
  distinct(spec.concepts.map((concept) => concept.definition), `${sourceName} concept definitions`);
  assertFixture(spec.concepts.every((concept) => concept.domain.trim().length > 0), `${sourceName} contains a concept without a domain.`);

  const questions = spec.concepts.flatMap((_, index) => expandConcept(spec, spec.concepts, index));
  assertFixture(questions.length === GENERATED_QUESTIONS_PER_SUBJECT, `${sourceName} did not generate ${GENERATED_QUESTIONS_PER_SUBJECT} questions.`);

  return {
    schemaVersion: document.schemaVersion,
    questionSetId: document.questionSetId,
    questions,
  };
}
