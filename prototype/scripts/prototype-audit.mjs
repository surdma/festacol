import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');
const exists = (file) => fs.existsSync(path.join(root, file));

const legacyRequired = [
  'admin.html',
  'student.html',
  'exam.html',
  'js/session-store.js',
  'js/proctor-policy.js',
  'js/question-data.js',
  'js/assessment-engine.js',
  'js/student-dashboard.js',
  'js/exam-app.js',
  'js/admin-app.js',
  'js/qr.js',
  'data/questions.json'
];
for (const file of legacyRequired) {
  if (!exists(file)) throw new Error(`Missing required prototype file: ${file}`);
}

const targetRuntime = [
  'js/shared.js',
  'js/admin.js',
  'js/student.js',
  'js/exam.js'
];
const targetSurfaces = [
  'index.html',
  'admin.html',
  'student.html',
  'exam.html'
];
const targetRuntimeReady = targetRuntime.every(exists);

const assertUniqueIds = (file) => {
  const source = read(file);
  const ids = [...source.matchAll(/\sid="([^"]+)"/gu)].map((match) => match[1]);
  const duplicates = ids.filter((id, index) => ids.indexOf(id) !== index);
  if (duplicates.length) throw new Error(`${file} contains duplicate ids: ${[...new Set(duplicates)].join(', ')}`);
};

for (const file of ['admin.html', 'student.html', 'exam.html']) {
  const source = read(file);
  for (const token of ['@tailwindcss/browser@4', 'flowbite@4.0.1/dist/flowbite.min.css', 'flowbite@4.0.1/dist/flowbite.min.js']) {
    if (!source.includes(token)) throw new Error(`${file} is missing ${token}`);
  }
  assertUniqueIds(file);
}

const adminHtml = read('admin.html');
for (const forbidden of ['./assets/festacol.css', './assets/academic-v3.css', 'admin-core-a.js', 'admin-core-b.js', 'admin-pages-a.js', 'admin-pages-b.js', 'admin-workflows-a.js', 'admin-workflows-b.js', 'admin-details.js', 'admin-academic.js', 'admin-proctor-hotfix.js', 'admin-detail-drawer', 'admin-drawer-scrim']) {
  if (adminHtml.includes(forbidden)) throw new Error(`Admin must not load legacy/duplicate layer: ${forbidden}`);
}
for (const token of ['desktop-nav', 'mobile-nav-dialog', 'admin-dialog', './js/proctor-policy.js', './js/admin-app.js']) {
  if (!adminHtml.includes(token)) throw new Error(`Admin shell missing ${token}`);
}

const obsoleteAdmin = [
  'js/student-proctor-hotfix.js',
  'js/admin-core-a.js',
  'js/admin-core-b.js',
  'js/admin-pages-a.js',
  'js/admin-pages-b.js',
  'js/admin-workflows-a.js',
  'js/admin-workflows-b.js',
  'js/admin-details.js',
  'js/admin-academic.js',
  'js/admin-proctor-hotfix.js'
];
for (const file of obsoleteAdmin) {
  if (exists(file)) throw new Error(`Duplicate admin runtime should be removed: ${file}`);
}

const admin = read('js/admin-app.js');
for (const token of ['data-proctor-camera', 'question-count-range', 'min="5"', 'Math.min(150', 'authorizeRewrite', 'rewriteArchivedAt', 'Exam ID', 'exam-detail-qr', 'whatsapp-form', 'whatsAppGroupForClass', 'data-attempt-detail', 'Integrity / proctor log', 'data-exam-edit', 'data-reset-unfinished']) {
  if (!admin.includes(token)) throw new Error(`Integrated admin runtime missing ${token}`);
}
for (const forbidden of ['openDrawer', 'data-session-link', 'Copy exam link', 'Open exam link', 'Dynamic link']) {
  if (admin.includes(forbidden)) throw new Error(`Admin runtime still exposes obsolete side-sheet/raw-link behavior: ${forbidden}`);
}

const store = read('js/session-store.js');
for (const token of ['questionCount < 5', 'questionCount > 150', 'findSessionById', 'authorizeRewrite', 'rewriteArchivedAt', 'listWhatsAppGroups', 'saveWhatsAppGroup', 'whatsAppGroupForClass', 'attemptsForStudent', 'attemptsForSession', 'resetUnfinishedAttempt']) {
  if (!store.includes(token)) throw new Error(`Session store missing ${token}`);
}

const student = read('student.html');
if (student.includes('student-proctor-hotfix.js')) throw new Error('Student shell must not load the obsolete proctor hotfix');
for (const token of ['exam-id-launch', 'exam-id-dialog', 'exam-id-form', 'findSessionById', 'decorateStudentLink']) {
  if (!student.includes(token)) throw new Error(`Manual Exam ID flow missing ${token}`);
}

const css = read('assets/festacol.css');
if (css.includes('festacol-exam.css')) throw new Error('Shared legacy CSS still imports deleted festacol-exam.css');

const examHtml = read('exam.html');
for (const obsolete of ['./assets/festacol.css', './assets/academic-v3.css', './js/student-app.js', './js/exam-integrity-hotfix.js']) {
  if (examHtml.includes(obsolete)) throw new Error(`Exam page loads obsolete layer: ${obsolete}`);
}
if (!examHtml.includes('./js/exam-app.js')) throw new Error('Exam page must load the single exam-app runtime');

const exam = read('js/exam-app.js');
for (const token of ['data-exam-workspace', 'requestCamera', 'reconcilePersistedBackground', 'visibilitychange', 'clipboard-', 'time-expired', 'session-ended', 'Store.clearStudentAuth()']) {
  if (!exam.includes(token)) throw new Error(`Exam runtime missing ${token}`);
}

const payload = JSON.parse(read('data/questions.json'));
if (!Array.isArray(payload.questions) || payload.questions.length < 20) throw new Error('Question bank is unexpectedly small or invalid.');
for (const type of ['single', 'multi', 'boolean', 'fill']) {
  if (!payload.questions.some((question) => question.type === type)) throw new Error(`Question bank no longer exercises ${type}`);
}

// Staged final architecture contract. It becomes active automatically only after all
// four target runtimes exist, so Tasks 2-11 can migrate consumers without a flag day.
if (targetRuntimeReady) {
  for (const file of [...targetRuntime, ...targetSurfaces]) {
    if (!exists(file)) throw new Error(`Missing target prototype file: ${file}`);
  }

  const indexHtml = read('index.html');
  for (const token of ['@tailwindcss/browser@4', 'type="text/tailwindcss"', 'flowbite@4.0.1/dist/flowbite.min.js', './js/shared.js']) {
    if (!indexHtml.includes(token)) throw new Error(`Canonical index shell missing ${token}`);
  }
  for (const forbidden of ['flowbite.min.css', '<link rel="stylesheet"', './js/session-store.js', './js/question-data.js', './js/assessment-engine.js', './js/proctor-policy.js', './js/qr.js']) {
    if (indexHtml.includes(forbidden)) throw new Error(`Canonical index shell contains forbidden legacy/style dependency: ${forbidden}`);
  }

  for (const file of targetSurfaces) assertUniqueIds(file);

  const aliasRoutes = new Map([
    ['admin.html', 'admin'],
    ['student.html', 'student'],
    ['exam.html', 'exam']
  ]);
  for (const [file, route] of aliasRoutes) {
    const source = read(file);
    const routePattern = new RegExp(`(?:route=${route}|set\\(['"']route['"']\\s*,\\s*['"']${route}['"']\\))`, 'u');
    if (!source.includes('index.html') || !routePattern.test(source)) throw new Error(`${file} must forward to index.html with route=${route}`);
    if (/href=["'][^"']+\.css/iu.test(source)) throw new Error(`${file} must not load a CSS file in the target architecture`);
  }
}

console.log(`Prototype audit passed: ${payload.questions.length} questions; preservation contract active; target-runtime contract ${targetRuntimeReady ? 'active' : 'staged'}.`);
