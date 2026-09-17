import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

const ROOT = resolve(process.cwd());

const candidateClientFiles = [
  "src/components/exam/exam-focus-capsule.tsx",
  "src/components/exam/exam-workspace.tsx",
  "src/components/exam/question-card.tsx",
  "src/components/exam/exam-question-navigator.tsx",
  "src/components/exam/exam-results.tsx",
];

const candidateResultFiles = [
  "src/app/actions/exam-experience.ts",
  "src/app/dashboard/analytics/page.tsx",
  "src/components/exam/exam-results.tsx",
];

const violations = [];

async function source(path) {
  return readFile(resolve(ROOT, path), "utf8");
}

for (const path of candidateClientFiles) {
  const content = await source(path);
  for (const token of ["correct_answer", "correctAnswer", "scoreAttempt", "ExamResultReviewItem"]) {
    if (content.includes(token)) {
      violations.push(`${path}: candidate client contains forbidden grading token ${JSON.stringify(token)}`);
    }
  }
  if (/import\s+type\s*\{[^}]*\bQuestionDTO\b[^}]*\}\s+from\s+["']@\/types\/exam["']/su.test(content)) {
    violations.push(`${path}: candidate client imports internal QuestionDTO instead of ExamPaperQuestionDTO`);
  }
}

for (const path of candidateResultFiles) {
  const content = await source(path);
  for (const token of ["correct_answer", "correctAnswer", "answersMayBeRevealed", "canReviewAnswers", "ExamResultReviewItem"]) {
    if (content.includes(token)) {
      violations.push(`${path}: candidate result surface contains forbidden answer-review token ${JSON.stringify(token)}`);
    }
  }
}

const types = await source("src/types/exam.ts");
const safeTypeStart = types.indexOf("export interface ExamPaperQuestionDTO");
const internalTypeStart = types.indexOf("export interface QuestionDTO", safeTypeStart + 1);
if (safeTypeStart < 0 || internalTypeStart < 0) {
  violations.push("src/types/exam.ts: ExamPaperQuestionDTO security boundary is missing");
} else {
  const safeBlock = types.slice(safeTypeStart, internalTypeStart);
  for (const token of ["answer", "correct", "explanation", "difficulty", "examModes", "levels"]) {
    if (safeBlock.includes(token)) {
      violations.push(`src/types/exam.ts: ExamPaperQuestionDTO contains forbidden internal token ${JSON.stringify(token)}`);
    }
  }
}

const questions = await source("src/lib/questions.ts");
const sanitizeStart = questions.indexOf("export function sanitizePaper");
if (sanitizeStart < 0) {
  violations.push("src/lib/questions.ts: sanitizePaper is missing");
} else {
  const sanitizeBlock = questions.slice(sanitizeStart, questions.indexOf("\n}", sanitizeStart) + 2);
  if (!sanitizeBlock.includes("ExamPaperQuestionDTO[]")) {
    violations.push("src/lib/questions.ts: sanitizePaper does not return ExamPaperQuestionDTO[]");
  }
  if (sanitizeBlock.includes("...rest") || sanitizeBlock.includes("...question")) {
    violations.push("src/lib/questions.ts: sanitizePaper must use an explicit allow-list projection, not object spread");
  }
  for (const token of ["answer:", "correctAnswers", "blanks:", "difficulty:", "examModes:", "levels:"]) {
    if (sanitizeBlock.includes(token)) {
      violations.push(`src/lib/questions.ts: sanitizePaper projects forbidden grading/internal field ${JSON.stringify(token)}`);
    }
  }
}

const stateAction = await source("src/app/actions/exam-state.ts");
if (!stateAction.includes('paper: ExamPaperQuestionDTO[]')) {
  violations.push("src/app/actions/exam-state.ts: PaperStatus does not expose the answer-free ExamPaperQuestionDTO[] shape");
}
if (!stateAction.includes("scoreAttempt")) {
  violations.push("src/app/actions/exam-state.ts: expected server-side grading path is missing");
}

const rls = await source("supabase/rls.sql");
for (const required of [
  "correct IS NULL",
  "correct_answer IS NULL",
  "graded_at IS NULL",
  "attempt_responses_student_read_open",
]) {
  if (!rls.includes(required)) {
    violations.push(`supabase/rls.sql: candidate response grading boundary is missing ${JSON.stringify(required)}`);
  }
}

if (violations.length) {
  console.error("Exam client security-boundary validation failed:\n" + violations.map((item) => `- ${item}`).join("\n"));
  process.exit(1);
}

console.log("Exam client security-boundary validation passed.");
