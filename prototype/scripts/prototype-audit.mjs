import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');
const exists = (file) => fs.existsSync(path.join(root, file));

const legacyRequired = [
  'admin.html','student.html','exam.html','js/session-store.js','js/proctor-policy.js','js/question-data.js','js/assessment-engine.js','js/student-dashboard.js','js/exam-app.js','js/admin-app.js','js/qr.js','data/questions.json'
];
for (const file of legacyRequired) if (!exists(file)) throw new Error(`Missing required prototype file: ${file}`);

const targetRuntime = ['js/shared.js', 'js/admin.js', 'js/student.js', 'js/exam.js'];
const targetSurfaces = ['index.html', 'admin.html', 'student.html', 'exam.html'];
const targetRuntimeReady = targetRuntime.every(exists);
const adminRuntimeReady = exists('js/admin.js');
const studentRuntimeReady = exists('js/student.js');
const examRuntimeReady = exists('js/exam.js');
const assertUniqueIds = (file) => { const source=read(file); const ids=[...source.matchAll(/\sid="([^"]+)"/gu)].map(m=>m[1]); const dup=ids.filter((id,i)=>ids.indexOf(id)!==i); if(dup.length)throw new Error(`${file} contains duplicate ids: ${[...new Set(dup)].join(', ')}`); };

for (const file of ['js/student-proctor-hotfix.js','js/admin-core-a.js','js/admin-core-b.js','js/admin-pages-a.js','js/admin-pages-b.js','js/admin-workflows-a.js','js/admin-workflows-b.js','js/admin-details.js','js/admin-academic.js','js/admin-proctor-hotfix.js']) if(exists(file))throw new Error(`Duplicate admin runtime should be removed: ${file}`);
const legacyStore=read('js/session-store.js');
for(const token of ['questionCount < 5','questionCount > 150','findSessionById','authorizeRewrite','rewriteArchivedAt','listWhatsAppGroups','saveWhatsAppGroup','whatsAppGroupForClass','attemptsForStudent','attemptsForSession','resetUnfinishedAttempt'])if(!legacyStore.includes(token))throw new Error(`Session store missing ${token}`);
const css=read('assets/festacol.css'); if(css.includes('festacol-exam.css'))throw new Error('Shared legacy CSS still imports deleted festacol-exam.css');

const payload=JSON.parse(read('data/questions.json'));
const TRACKS=new Set(['Science','Arts','Social Science']),LEVELS=new Set(['SS1','SS2','SS3']),MODES=new Set(['qualifier','single','mixed','waec']),DIFFICULTIES=new Set(['easy','medium','hard']),TYPES=new Set(['single','multi','boolean','fill','fill-multi']);
if(!Array.isArray(payload.questions)||payload.questions.length<720)throw new Error(`Question bank must contain at least 720 validated seeds; found ${payload.questions?.length||0}.`);
if(!Array.isArray(payload.subjectCatalog)||!payload.subjectCatalog.length)throw new Error('Question subject catalogue is unavailable.');
const catalog=new Map(),ids=new Set(),prompts=new Set(),seenTypes=new Set();
for(const subject of payload.subjectCatalog){if(!subject?.code||catalog.has(subject.code)||!subject.label||!subject.levels?.length||!subject.modes?.length||!subject.pathways?.length)throw new Error('Question subject catalogue contains invalid or duplicate records.');catalog.set(subject.code,subject);}
for(const q of payload.questions){
 if(!Number.isInteger(q.id)||ids.has(q.id))throw new Error(`Question ${q.id} has a duplicate/invalid id.`);ids.add(q.id);
 if(!q.subject||!catalog.has(q.subjectCode)||!q.domain||!q.label||!q.prompt||!String(q.explanation||'').trim())throw new Error(`Question ${q.id} is missing required metadata.`);
 if(prompts.has(q.prompt))throw new Error(`Question ${q.id} duplicates another prompt.`);prompts.add(q.prompt);
 if(!TYPES.has(q.type)||!DIFFICULTIES.has(q.difficulty))throw new Error(`Question ${q.id} has an invalid type/difficulty.`);seenTypes.add(q.type);
 if(!q.levels?.length||q.levels.some(v=>!LEVELS.has(v))||!q.pathways?.length||q.pathways.some(v=>!TRACKS.has(v))||!q.examModes?.length||q.examModes.some(v=>!MODES.has(v)))throw new Error(`Question ${q.id} has invalid routing metadata.`);
 if((q.type==='single'||q.type==='multi')&&(!Array.isArray(q.options)||q.options.length<2||new Set(q.options.map(v=>String(v).trim().toLowerCase())).size!==q.options.length))throw new Error(`Question ${q.id} must provide unique options.`);
 if(q.type==='single'&&!q.options.includes(q.answer))throw new Error(`Question ${q.id} has an invalid single-choice answer.`);
 if(q.type==='boolean'&&typeof q.answer!=='boolean')throw new Error(`Question ${q.id} has an invalid true/false answer.`);
 if(q.type==='multi'&&(!Array.isArray(q.answers)||q.answers.length!==q.requiredSelections||q.answers.some(a=>!q.options.includes(a))))throw new Error(`Question ${q.id} has invalid multiple-choice answers.`);
 if(q.type==='fill'&&(!Array.isArray(q.acceptedAnswers)||!q.acceptedAnswers.length||q.acceptedAnswers.some(Array.isArray)))throw new Error(`Question ${q.id} needs accepted fill answers.`);
 if(q.type==='fill-multi'){const blanks=(q.fillTemplate||[]).filter(p=>p?.blank);if(!blanks.length||!Array.isArray(q.acceptedAnswers)||q.acceptedAnswers.length!==blanks.length||q.acceptedAnswers.some(a=>!Array.isArray(a)||!a.length))throw new Error(`Question ${q.id} needs accepted fill answers for every blank.`);}
}
for(const type of TYPES)if(!seenTypes.has(type))throw new Error(`Question bank no longer exercises ${type}`);
for(const subject of payload.subjectCatalog){for(const level of subject.levels){for(const mode of subject.modes.filter(m=>m!=='waec'||level==='SS3')){for(const pathway of subject.pathways){if(!payload.questions.some(q=>q.subjectCode===subject.code&&q.levels.includes(level)&&q.examModes.includes(mode)&&q.pathways.includes(pathway)))throw new Error(`Question bank has no eligible inventory for ${subject.code}/${level}/${mode}/${pathway}.`);}}}}
const shared=read('js/shared.js');
for(const token of ['validateAnswerShape','listQuestionOverrides','saveQuestionOverride','resetQuestionOverride','scoreQuestion','quarantinedCustomQuestions'])if(!shared.includes(token))throw new Error(`Task 5 shared runtime missing ${token}`);
if(shared.includes('ANSWER_KEYS'))throw new Error('Task 5 must not retain a hardcoded ID-to-answer table.');

if(studentRuntimeReady){
 const indexHtml=read('index.html'),studentAlias=read('student.html'),studentRuntime=read('js/student.js');
 for(const token of ['@tailwindcss/browser@4','type="text/tailwindcss"','flowbite@4.0.1/dist/flowbite.min.js','./js/shared.js','./js/student.js'])if(!indexHtml.includes(token))throw new Error(`Canonical Student shell missing ${token}`);
 for(const forbidden of ['flowbite.min.css','./assets/festacol.css','./assets/academic-v3.css','./js/session-store.js','./js/question-data.js','./js/assessment-engine.js','./js/proctor-policy.js','./js/student-dashboard.js'])if(indexHtml.includes(forbidden))throw new Error(`Canonical Student shell contains forbidden legacy/style dependency: ${forbidden}`);
 if(!studentAlias.includes('index.html')||!/set\(['"]route['"]\s*,\s*['"]student['"]\)/u.test(studentAlias))throw new Error('student.html must forward to index.html with route=student.');
 for(const forbidden of ['@tailwindcss/browser@4','flowbite.min.css','flowbite.min.js','./js/shared.js','./js/student.js','./js/student-dashboard.js','<link rel="stylesheet"'])if(studentAlias.includes(forbidden))throw new Error(`Student alias must stay thin and dependency-free: ${forbidden}`);
 for(const token of ['exam-id-launch','exam-id-dialog','exam-id-form','findSessionById','decorateStudentLink'])if(!studentRuntime.includes(token))throw new Error(`Migrated Student runtime missing ${token}`);
 for(const route of ['student','exam'])if(!new RegExp(`utils\\.routeUrl\\(\\s*['"]${route}['"]`,'u').test(studentRuntime))throw new Error(`Migrated Student runtime missing canonical ${route} routeUrl call`);
 for(const forbidden of ['FestacolSessionStore','FestacolQuestionData','FestacolAssessmentEngine','FestacolProctorPolicy','./student.html','./exam.html','student-sidebar-open','badge badge-','class="field'])if(studentRuntime.includes(forbidden))throw new Error(`Migrated Student runtime still depends on legacy behavior/style: ${forbidden}`);
 assertUniqueIds('student.html');
}
if(examRuntimeReady){
 const indexHtml=read('index.html'),examAlias=read('exam.html'),examRuntime=read('js/exam.js');
 for(const token of ['./js/exam.js','./js/student.js','./js/shared.js','flowbite@4.0.1/dist/flowbite.min.js','type="text/tailwindcss"'])if(!indexHtml.includes(token))throw new Error(`Canonical Exam shell missing ${token}`);
 if(/route === ['"]admin['"] \|\| route === ['"]exam['"]/u.test(indexHtml)||indexHtml.includes("'./exam.html'"))throw new Error('Canonical index shell must load exam.js directly instead of redirecting Exam to exam.html.');
 if(!/runtimeByRoute[\s\S]*exam:\s*['"]\.\/js\/exam\.js['"]/u.test(indexHtml))throw new Error('Canonical index shell must explicitly allowlist the Exam runtime.');
 if(!examAlias.includes('index.html')||!/set\(['"]route['"]\s*,\s*['"]exam['"]\)/u.test(examAlias))throw new Error('exam.html must forward to index.html with route=exam.');
 for(const forbidden of ['@tailwindcss/browser@4','flowbite.min.css','flowbite.min.js','./js/shared.js','./js/exam.js','./js/exam-app.js','./js/session-store.js','<link rel="stylesheet"'])if(examAlias.includes(forbidden))throw new Error(`Exam alias must stay thin and dependency-free: ${forbidden}`);
 for(const token of ['data-exam-workspace','requestCamera','reconcilePersistedBackground','visibilitychange','clipboard-','time-expired','session-ended','store.clearStudentAuth()','assessment.paperForStudent','assessment.scoreAttempt','questions.load',"utils.routeUrl('student'"])if(!examRuntime.includes(token))throw new Error(`Migrated Exam runtime missing ${token}`);
 for(const forbidden of ['FestacolSessionStore','FestacolQuestionData','FestacolAssessmentEngine','FestacolProctorPolicy','./student.html','./exam.html'])if(examRuntime.includes(forbidden))throw new Error(`Migrated Exam runtime still depends on legacy behavior/routing: ${forbidden}`);
 assertUniqueIds('exam.html');
}

if(adminRuntimeReady){
 const indexHtml=read('index.html'),adminAlias=read('admin.html'),admin=read('js/admin.js');
 if(!/runtimeByRoute[\s\S]*admin:\s*['"]\.\/js\/admin\.js['"]/u.test(indexHtml))throw new Error('Canonical index shell must explicitly allowlist the Admin runtime.');
 if(indexHtml.includes("new URL('./admin.html'")||indexHtml.includes("'./admin.html'"))throw new Error('Canonical index shell must load admin.js directly instead of redirecting Admin to admin.html.');
 if(!adminAlias.includes('index.html')||!/set\(['"]route['"]\s*,\s*['"]admin['"]\)/u.test(adminAlias))throw new Error('admin.html must preserve query state and forward to index.html with route=admin.');
 for(const forbidden of ['@tailwindcss/browser@4','flowbite.min.css','flowbite.min.js','./js/shared.js','./js/admin.js','./js/admin-app.js','./js/session-store.js','<link rel="stylesheet"'])if(adminAlias.includes(forbidden))throw new Error(`Admin alias must stay thin and dependency-free: ${forbidden}`);
 for(const token of ['window.Festacol','utils.routeUrl(\'admin\'','page\') === \'users\'','history.replaceState','window.addEventListener(\'popstate\'','modal: kind','data-dropdown-toggle="admin-notification-menu"','id="mobile-nav-dialog"','role="dialog"','backdrop-blur-sm','authorizeRewrite','rewriteArchivedAt','Exam ID','exam-detail-qr','whatsapp-form','whatsAppGroupForClass','data-attempt-detail','Integrity / proctor log','data-exam-edit','data-reset-unfinished','question-correct-option','question-fill-answer',"modal==='exam-created'","menu: ['M5 7h14M5 12h14M5 17h14']","close: ['M6 18 17.94 6M18 18 6.06 6']","more: ['M6 12h.01m6 0h.01m5.99 0h.01']"])if(!admin.includes(token))throw new Error(`Task 6 Admin runtime missing ${token}`);
 for(const forbidden of ['window.FestacolSessionStore','window.FestacolQuestionData','window.FestacolAssessmentEngine','window.FestacolProctorPolicy','window.FestacolQR','./admin.html','showModal()','<dialog','notificationsDialog','☰','×','•••','event.currentTarget.value'])if(admin.includes(forbidden))throw new Error(`Migrated Admin runtime still depends on legacy behavior/shell: ${forbidden}`);
 const routeKeys=[...admin.matchAll(/data-admin-route=\\?"([^"\\]+)\\?"/gu)].map(m=>m[1]);
 const requiredRoutes=['overview','students','staff','exams','classes','questions','reports','settings'];
 for(const route of requiredRoutes)if(!admin.includes(`key: '${route}'`)&&!routeKeys.includes(route))throw new Error(`Admin navigation missing ${route}`);
 if(admin.includes("key: 'users'"))throw new Error('Admin navigation must not expose the legacy combined users route.');
 assertUniqueIds('admin.html');
}

assertUniqueIds('index.html');
if(targetRuntimeReady){
 for(const file of [...targetRuntime,...targetSurfaces])if(!exists(file))throw new Error(`Missing target prototype file: ${file}`);
 const indexHtml=read('index.html');
 for(const forbidden of ['flowbite.min.css','<link rel="stylesheet" href="./assets/','./js/session-store.js','./js/question-data.js','./js/assessment-engine.js','./js/proctor-policy.js','./js/qr.js'])if(indexHtml.includes(forbidden))throw new Error(`Canonical index shell contains forbidden legacy/style dependency: ${forbidden}`);
 for(const file of targetSurfaces)assertUniqueIds(file);
 const aliasRoutes=new Map([['admin.html','admin'],['student.html','student'],['exam.html','exam']]);
 for(const [file,route] of aliasRoutes){const source=read(file),pattern=new RegExp(`(?:route=${route}|set\\(['"']route['"']\\s*,\\s*['"']${route}['"']\\))`,'u');if(!source.includes('index.html')||!pattern.test(source))throw new Error(`${file} must forward to index.html with route=${route}`);if(/href=["'][^"']+\.css/iu.test(source))throw new Error(`${file} must not load a CSS file in the target architecture`);}
}
console.log(`Prototype audit passed: ${payload.questions.length} questions; Task 5 answer-aware contract active; Admin migration ${adminRuntimeReady?'active':'staged'}; Student migration ${studentRuntimeReady?'active':'staged'}; Exam migration ${examRuntimeReady?'active':'staged'}; final target ${targetRuntimeReady?'active':'staged'}.`);
