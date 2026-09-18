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
const finalization = await source("src/lib/exam-finalization.ts");
const attemptRpc = await source("supabase/auth-rpc.sql");
const assessment = await source("src/lib/assessment.ts");
const adminParity = await source("src/app/actions/admin-parity.ts");
const focusCapsule = await source("src/components/exam/exam-focus-capsule.tsx");
if (!stateAction.includes('paper: ExamPaperQuestionDTO[]')) {
  violations.push("src/app/actions/exam-state.ts: PaperStatus does not expose the answer-free ExamPaperQuestionDTO[] shape");
}
if (!finalization.includes("scoreAttempt")) {
  violations.push("src/lib/exam-finalization.ts: expected server-side grading path is missing");
}
if (!finalization.includes("context_snapshot?.durationSeconds") || !finalization.includes("persistedBudget")) {
  violations.push("src/lib/exam-finalization.ts: attempt duration is not frozen to the start-time snapshot/fallback budget");
}
if (!attemptRpc.includes("'durationSeconds',v_session.duration_seconds") || !attemptRpc.includes("'questionCount',v_session.question_count") || !attemptRpc.includes("'allowFillQuestions',v_session.allow_fill_questions")) {
  violations.push("supabase/auth-rpc.sql: attempt allocator does not snapshot duration/question count/fill policy");
}
if (!assessment.includes("session.allowFillQuestions") || !assessment.includes('question.type === "fill"') || !assessment.includes('question.type === "fill-multi"')) {
  violations.push("src/lib/assessment.ts: paper eligibility does not enforce the exam fill-question policy");
}
if (!adminParity.includes("input.allowFillQuestions") || !adminParity.includes('question.qtype !== "fill"') || !adminParity.includes('question.qtype !== "fill-multi"')) {
  violations.push("src/app/actions/admin-parity.ts: creation coverage does not match the runtime fill-question policy");
}
if (focusCapsule.includes("ExamStatusWatch")) {
  violations.push("src/components/exam/exam-focus-capsule.tsx: generic session refresh would let future-starter edits disturb active writers");
}

if (!stateAction.includes("attemptDurationSeconds(state, session)") || !stateAction.includes("paperForStudent({ questions: payload.questions }, attemptSession")) {
  violations.push("src/app/actions/exam-state.ts: first paper allocation is not pinned to the attempt snapshot");
}

for (const token of ["patch.remainingSeconds", "patch.elapsedActiveSeconds"]) {
  if (stateAction.includes(token)) {
    violations.push(`src/app/actions/exam-state.ts: browser-controlled clock token remains ${JSON.stringify(token)}`);
  }
}
for (const required of [
  "authoritativeAttemptClock",
  "progressPatchSchema",
  "submitReasonSchema",
  "finalizeExamAttempt",
]) {
  if (!stateAction.includes(required)) {
    violations.push(`src/app/actions/exam-state.ts: trusted exam-state boundary is missing ${JSON.stringify(required)}`);
  }
}

for (const required of [
  '.from("exam_attempts")',
  '.from("exam_attempt_responses")',
  '"exam-closed"',
]) {
  if (!finalization.includes(required)) {
    violations.push(`src/lib/exam-finalization.ts: trusted finalization boundary is missing ${JSON.stringify(required)}`);
  }
}

const workspace = await source("src/components/exam/exam-workspace.tsx");
if (workspace.includes("<ExamPreflight")) {
  violations.push("src/components/exam/exam-workspace.tsx: Phase 2 preflight friction was reintroduced into the active candidate path");
}
if (!workspace.includes("if (context.cameraRequired) void camera.start();") || !workspace.includes("void loadPaper();")) {
  violations.push("src/components/exam/exam-workspace.tsx: eligible candidates do not auto-request camera and proceed directly to paper loading");
}
if (workspace.includes("context.cameraRequired && !camera.ready")) {
  violations.push("src/components/exam/exam-workspace.tsx: camera permission still blocks paper entry or recovery");
}
if (!focusCapsule.includes("isLastQuestion") || !focusCapsule.includes('variant="destructive"')) {
  violations.push("src/components/exam/exam-focus-capsule.tsx: final-question destructive submission affordance is missing");
}
for (const token of ["remainingSeconds: Math.max", "elapsedActiveSeconds: Math.max"]) {
  if (workspace.includes(token)) {
    violations.push(`src/components/exam/exam-workspace.tsx: candidate save payload still supplies authoritative clock field ${JSON.stringify(token)}`);
  }
}
for (const required of ['submitFinal("exam-closed")', "festacol:exam-session-changed"]) {
  if (!workspace.includes(required)) {
    violations.push(`src/components/exam/exam-workspace.tsx: forced submission recovery is missing ${JSON.stringify(required)}`);
  }
}
if (!/processingReason\s*===\s*"time-expired"\s*\|\|\s*processingReason\s*===\s*"exam-closed"/su.test(workspace)) {
  violations.push("src/components/exam/exam-workspace.tsx: automatic reconnect retry must be narrowed to time-expired/exam-closed");
}
if (!workspace.includes('processingReason === "potential-malpractice"') || !workspace.includes("terminateForMalpractice")) {
  violations.push("src/components/exam/exam-workspace.tsx: malpractice reconnect recovery must remain on the disqualification path");
}

const rls = await source("supabase/rls.sql");
for (const required of [
  "attempt_responses_student_read_open",
  "REVOKE UPDATE(",
  "ON public.exam_attempts FROM authenticated",
  "REVOKE INSERT(attempt_id,question_id,response_text,response_values,seconds,flagged,updated_at)",
  "ON public.exam_attempt_responses FROM authenticated",
  "questions_staff_read",
  "question_levels_staff_read",
  "question_blanks_staff_read",
]) {
  if (!rls.includes(required)) {
    violations.push(`supabase/rls.sql: candidate data boundary is missing ${JSON.stringify(required)}`);
  }
}
for (const forbidden of [
  "exam_attempts_student_runtime_update",
  "attempt_responses_student_insert_open",
  "attempt_responses_student_update_open",
  "questions_student_read",
  "question_levels_student_read",
  "question_blanks_student_read",
]) {
  if (rls.includes(forbidden)) {
    violations.push(`supabase/rls.sql: direct candidate mutation/answer-key policy remains ${JSON.stringify(forbidden)}`);
  }
}

const questionPolicyStart = rls.indexOf("-- ------------------------------------------------------------- question bank");
const questionPolicyEnd = rls.indexOf("-- --------------------------------------------------------------- communication", questionPolicyStart);
if (questionPolicyStart < 0 || questionPolicyEnd < 0) {
  violations.push("supabase/rls.sql: question-bank policy boundary is missing");
} else {
  const questionPolicies = rls.slice(questionPolicyStart, questionPolicyEnd);
  if (/student_is_targeted_for_exam|student_read/iu.test(questionPolicies)) {
    violations.push("supabase/rls.sql: student-readable question-bank policy would expose answer-bearing rows");
  }
}

if (violations.length) {
  console.error("Exam client security-boundary validation failed:\n" + violations.map((item) => `- ${item}`).join("\n"));
  process.exit(1);
}

console.log("Exam client security-boundary validation passed.");
