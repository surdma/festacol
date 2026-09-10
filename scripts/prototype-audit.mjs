import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');
const requiredFiles = [
  'prototype/admin.html',
  'prototype/student.html',
  'prototype/exam.html',
  'prototype/assets/festacol.css',
  'prototype/js/admin-core-a.js',
  'prototype/js/admin-core-b.js',
  'prototype/js/admin-pages-a.js',
  'prototype/js/admin-pages-b.js',
  'prototype/js/admin-workflows-a.js',
  'prototype/js/admin-workflows-b.js',
  'prototype/js/admin-details.js',
  'prototype/js/admin-app.js',
  'prototype/js/student-dashboard.js',
  'prototype/js/student-app.js',
  'prototype/js/session-store.js',
  'prototype/js/question-data.js',
  'prototype/data/questions.json'
];
for (const file of requiredFiles) if (!fs.existsSync(path.join(root, file))) throw new Error(`Missing required prototype file: ${file}`);

const htmlFiles = ['prototype/admin.html', 'prototype/student.html', 'prototype/exam.html'];
const requiredHtmlTokens = [
  'fonts.googleapis.com',
  'fonts.gstatic.com',
  '@tailwindcss/browser@4',
  'flowbite@4.0.1/dist/flowbite.min.css',
  'flowbite@4.0.1/dist/flowbite.min.js',
  'cdn.jsdelivr.net/npm/apexcharts',
  './assets/festacol.css'
];
for (const file of htmlFiles) {
  const source = read(file);
  for (const token of requiredHtmlTokens) if (!source.includes(token)) throw new Error(`${file} is missing ${token}`);
  const ids = [...source.matchAll(/\sid="([^"]+)"/gu)].map((match) => match[1]);
  const duplicates = ids.filter((id, index) => ids.indexOf(id) !== index);
  if (duplicates.length) throw new Error(`${file} contains duplicate ids: ${[...new Set(duplicates)].join(', ')}`);
}

const admin = ['admin-core-a.js','admin-core-b.js','admin-pages-a.js','admin-pages-b.js','admin-workflows-a.js','admin-workflows-b.js','admin-details.js','admin-app.js'].map((file) => read(`prototype/js/${file}`)).join('\n');
for (const route of ['overview', 'users', 'exams', 'classes', 'questions', 'reports', 'settings']) if (!admin.includes(`${route}:`)) throw new Error(`Admin runtime is missing route: ${route}`);
for (const component of ['modal-card', 'drawer-panel', 'stepper', 'data-table']) {
  const css = ['festacol-foundation.css','festacol-admin.css','festacol-exam.css'].map((file) => read(`prototype/assets/${file}`)).join('\n');
  if (!css.includes(`.${component}`)) throw new Error(`Shared design system is missing .${component}`);
}

const exam = read('prototype/js/student-app.js');
if (/\bbg-black\b/u.test(exam)) throw new Error('Exam runtime still contains the deprecated black slab treatment.');
if (!exam.includes('timer-pill') || !exam.includes('exam-card')) throw new Error('Exam runtime is missing the focused assessment UI primitives.');

const dashboard = read('prototype/js/student-dashboard.js');
if (!dashboard.includes('flowbite-illustrations')) throw new Error('Student dashboard is missing verified Flowbite illustration usage.');
if (!admin.includes('flowbite-illustrations')) throw new Error('Admin runtime is missing verified Flowbite illustration usage.');

const questionPayload = JSON.parse(read('prototype/data/questions.json'));
if (!Array.isArray(questionPayload.questions) || questionPayload.questions.length < 20) throw new Error('Question bank is unexpectedly small or invalid.');
console.log(`Prototype audit passed: ${questionPayload.questions.length} JSON questions, 3 application surfaces, 7 admin routes.`);
