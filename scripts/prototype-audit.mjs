import fs from 'node:fs';
import path from 'node:path';
const root=process.cwd();
const read=(file)=>fs.readFileSync(path.join(root,file),'utf8');
const required=[
  'prototype/admin.html','prototype/student.html','prototype/exam.html','prototype/assets/festacol.css','prototype/assets/academic-v3.css',
  'prototype/js/session-store.js','prototype/js/question-data.js','prototype/js/assessment-engine.js','prototype/js/student-dashboard.js','prototype/js/student-app.js','prototype/js/admin-academic.js',
  'prototype/js/admin-core-a.js','prototype/js/admin-core-b.js','prototype/js/admin-pages-a.js','prototype/js/admin-pages-b.js','prototype/js/admin-workflows-a.js','prototype/js/admin-workflows-b.js','prototype/js/admin-details.js','prototype/js/admin-app.js','prototype/data/questions.json'
];
for(const file of required)if(!fs.existsSync(path.join(root,file)))throw new Error(`Missing required prototype file: ${file}`);
for(const file of ['prototype/admin.html','prototype/student.html','prototype/exam.html']){
  const source=read(file);
  for(const token of ['fonts.googleapis.com','fonts.gstatic.com','@tailwindcss/browser@4','flowbite@4.0.1/dist/flowbite.min.css','flowbite@4.0.1/dist/flowbite.min.js','cdn.jsdelivr.net/npm/apexcharts','./assets/festacol.css','./assets/academic-v3.css'])if(!source.includes(token))throw new Error(`${file} is missing ${token}`);
  const ids=[...source.matchAll(/\sid="([^"]+)"/gu)].map((match)=>match[1]);
  const dup=ids.filter((id,index)=>ids.indexOf(id)!==index);if(dup.length)throw new Error(`${file} contains duplicate ids: ${[...new Set(dup)].join(', ')}`);
}
const adminHtml=read('prototype/admin.html');
if((adminHtml.match(/data-admin-route="overview"/gu)||[]).length!==2)throw new Error('Overview route must appear exactly once in desktop nav and once in mobile nav; the brand link must not duplicate it.');
for(const token of ['view=exams','view=students','view=placements','view=promotions','view=integrity'])if(!adminHtml.includes(token))throw new Error(`Admin intelligence navigation is missing ${token}`);
const admin=read('prototype/js/admin-academic.js');
for(const token of ['wizard-v3-stepper','duration-range','question-count-range','data-v3-track','placementReports','promotionReports','integrityReports','class-level-section'])if(!admin.includes(token))throw new Error(`Academic admin runtime is missing ${token}`);
const store=read('prototype/js/session-store.js');
for(const token of ['durationSeconds','attemptLimit: 1','studentHash','attemptsForStudent','placementTracks','integrityPolicy','randomization','resetUnfinishedAttempt','getAttemptResetAt','isAttemptInvalidated'])if(!store.includes(token))throw new Error(`Session contract is missing ${token}`);
const engine=read('prototype/js/assessment-engine.js');
for(const token of ['studentHash','candidateHash','paperForStudent','paperFingerprint','attemptHash','scoreAttempt','placementFor','answersMayBeRevealed'])if(!engine.includes(token))throw new Error(`Assessment engine is missing ${token}`);
const dashboard=read('prototype/js/student-dashboard.js');
for(const token of ['student-sidebar','student-first-name','student-last-name','Analytics','Exam history','Progress & promotion','Answers remain locked'])if(!dashboard.includes(token))throw new Error(`Student dashboard is missing ${token}`);
const exam=read('prototype/js/student-app.js');
for(const token of ['visibilitychange','window-blur','fullscreen-exit','clipboard-','Store.hasSubmittedAttempt','paperFingerprint','Attempt 1 of 1','remainingSeconds','elapsedActiveSeconds','pagehide','persist'])if(!exam.includes(token))throw new Error(`Exam integrity/attempt contract is missing ${token}`);
if(/\bbg-black\b/u.test(exam))throw new Error('Exam runtime still contains deprecated black slab treatment.');
if(!admin.includes('data-reset-attempt'))throw new Error('Academic admin runtime is missing unfinished-attempt reset controls.');
const css=read('prototype/assets/academic-v3.css');
for(const token of ['.student-sidebar','.wizard-v3-stepper','.range-control','.class-level-section','.integrity-event'])if(!css.includes(token))throw new Error(`Academic design layer is missing ${token}`);
const payload=JSON.parse(read('prototype/data/questions.json'));
if(!Array.isArray(payload.questions)||payload.questions.length<20)throw new Error('Question bank is unexpectedly small or invalid.');
console.log(`Prototype audit passed: ${payload.questions.length} JSON questions, 3 application surfaces, sidebar student analytics, academic admin reports, one-attempt and integrity contracts.`);
