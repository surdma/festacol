import fs from 'node:fs';
import path from 'node:path';
const root=process.cwd();
const read=(file)=>fs.readFileSync(path.join(root,file),'utf8');
const required=[
  'prototype/admin.html','prototype/student.html','prototype/exam.html','prototype/assets/festacol.css','prototype/assets/academic-v3.css',
  'prototype/js/session-store.js','prototype/js/question-data.js','prototype/js/assessment-engine.js','prototype/js/student-dashboard.js','prototype/js/student-app.js','prototype/js/exam-integrity-hotfix.js','prototype/js/admin-academic.js',
  'prototype/js/admin-core-a.js','prototype/js/admin-core-b.js','prototype/js/admin-pages-a.js','prototype/js/admin-pages-b.js','prototype/js/admin-workflows-a.js','prototype/js/admin-workflows-b.js','prototype/js/admin-details.js','prototype/js/admin-app.js','prototype/js/qr.js','prototype/data/questions.json'
];
for(const file of required)if(!fs.existsSync(path.join(root,file)))throw new Error(`Missing required prototype file: ${file}`);
for(const file of ['prototype/admin.html','prototype/student.html','prototype/exam.html']){
  const source=read(file);
  for(const token of ['fonts.googleapis.com','fonts.gstatic.com','@tailwindcss/browser@4','flowbite@4.0.1/dist/flowbite.min.css','flowbite@4.0.1/dist/flowbite.min.js'])if(!source.includes(token))throw new Error(`${file} is missing ${token}`);
  const ids=[...source.matchAll(/\sid="([^"]+)"/gu)].map((match)=>match[1]);
  const dup=ids.filter((id,index)=>ids.indexOf(id)!==index);if(dup.length)throw new Error(`${file} contains duplicate ids: ${[...new Set(dup)].join(', ')}`);
}
for(const file of ['prototype/admin.html','prototype/student.html']){
  const source=read(file);
  for(const token of ['cdn.jsdelivr.net/npm/apexcharts','./assets/festacol.css','./assets/academic-v3.css'])if(!source.includes(token))throw new Error(`${file} is missing ${token}`);
}
const examHtml=read('prototype/exam.html');
for(const token of ['bg-gray-50','rounded-xl','focus:ring-4','motion-reduce:','./js/student-app.js','./js/exam-integrity-hotfix.js'])if(!examHtml.includes(token))throw new Error(`Exam Tailwind/Flowbite shell is missing ${token}`);
for(const token of ['./assets/festacol.css','./assets/academic-v3.css','./assets/exam-app-theme.css','./js/exam-flowbite-ui.js'])if(examHtml.includes(token))throw new Error(`Exam page must not load a legacy presentation layer: ${token}`);
if(fs.existsSync(path.join(root,'prototype/js/exam-flowbite-ui.js')))throw new Error('The legacy post-render exam UI adapter must be removed; student-app.js owns final exam markup.');
const adminHtml=read('prototype/admin.html');
if((adminHtml.match(/data-admin-route="overview"/gu)||[]).length!==2)throw new Error('Overview route must appear exactly once in desktop nav and once in mobile nav; the brand link must not duplicate it.');
for(const token of ['view=exams','view=students','view=placements','view=promotions','view=integrity','./js/qr.js'])if(!adminHtml.includes(token))throw new Error(`Admin navigation/runtime is missing ${token}`);
const admin=read('prototype/js/admin-academic.js');
for(const token of ['wizard-v3-stepper','duration-range','question-count-range','data-v3-track','placementReports','promotionReports','integrityReports','class-level-section','data-session-link'])if(!admin.includes(token))throw new Error(`Academic admin runtime is missing ${token}`);
const adminApp=read('prototype/js/admin-app.js');
for(const token of ['directExamLink','./exam.html','data-exam-qr','data-exam-edit','exam-edit-form','FestacolQR'])if(!adminApp.includes(token))throw new Error(`Admin distribution/edit runtime is missing ${token}`);
const store=read('prototype/js/session-store.js');
for(const token of ['durationSeconds','attemptLimit: 1','studentHash','attemptsForStudent','placementTracks','integrityPolicy','randomization','resetUnfinishedAttempt','getAttemptResetAt','isAttemptInvalidated'])if(!store.includes(token))throw new Error(`Session contract is missing ${token}`);
const engine=read('prototype/js/assessment-engine.js');
for(const token of ['studentHash','candidateHash','paperForStudent','paperFingerprint','attemptHash','scoreAttempt','placementFor','answersMayBeRevealed'])if(!engine.includes(token))throw new Error(`Assessment engine is missing ${token}`);
const dashboard=read('prototype/js/student-dashboard.js');
for(const token of ['student-sidebar','student-login-form','portalAuthed','location.replace(examHref())','data-student-logout','Analytics','Exam history','Progress & promotion','Answers remain locked'])if(!dashboard.includes(token))throw new Error(`Student dashboard/auth gate is missing ${token}`);
const exam=read('prototype/js/student-app.js');
for(const token of ['student-login-form','Before you begin','data-start','data-exam-workspace','question-map','question-drawer','data-previous','data-next','data-review','data-modal-target="submit-modal"','data-confirm-submit','role="progressbar"','Flag for review','Submit examination','visibilitychange','window-blur','fullscreen-exit','clipboard-','Store.hasSubmittedAttempt','paperFingerprint','Attempt 1 of 1','remainingSeconds','elapsedActiveSeconds','pagehide','persist'])if(!exam.includes(token))throw new Error(`Exam access/workspace contract is missing ${token}`);
for(const obsolete of ['data-clear-answer','Save & next','Review answers','Review & submit','modal-shell','modal-card','btn btn-','exam-card'])if(exam.includes(obsolete))throw new Error(`Exam runtime still contains obsolete UI behavior/component: ${obsolete}`);
if(exam.includes('data-enter-exam'))throw new Error('Exam runtime must not route candidates back through a dashboard enter-exam step.');
if(/<style|\.style\./u.test(exam))throw new Error('Exam runtime must use Flowbite/Tailwind utilities rather than custom style injection.');
const integrity=read('prototype/js/exam-integrity-hotfix.js');
for(const token of ['data-background-time-note','data-dismiss-target="#background-time-note"','data-camera-gate','role="dialog"','data-camera-retry','data-camera-preview','reconcilePersistedBackground'])if(!integrity.includes(token))throw new Error(`Exam integrity runtime is missing ${token}`);
for(const obsolete of ['badge-warning','alert alert-','btn btn-','modal-shell','modal-card'])if(integrity.includes(obsolete))throw new Error(`Exam integrity runtime still contains obsolete UI component: ${obsolete}`);
if(!admin.includes('data-reset-attempt'))throw new Error('Academic admin runtime is missing unfinished-attempt reset controls.');
const css=read('prototype/assets/academic-v3.css');
for(const token of ['.student-sidebar','.wizard-v3-stepper','.range-control','.class-level-section','.integrity-event'])if(!css.includes(token))throw new Error(`Academic design layer is missing ${token}`);
const payload=JSON.parse(read('prototype/data/questions.json'));
if(!Array.isArray(payload.questions)||payload.questions.length<20)throw new Error('Question bank is unexpectedly small or invalid.');
console.log(`Prototype audit passed: ${payload.questions.length} JSON questions, direct Flowbite/Tailwind exam rendering, student exam workflow, direct QR/link entry, gated student portal, one-attempt and integrity contracts.`);
