import fs from 'node:fs';
import vm from 'node:vm';
import { webcrypto } from 'node:crypto';

const questionFile = new URL('../data/questions.json', import.meta.url);
const seedPayload = JSON.parse(fs.readFileSync(questionFile, 'utf8'));
const local = new Map();
const session = new Map();
const storage = (map) => ({
  get length(){return map.size}, key(i){return [...map.keys()][i]??null},
  getItem(k){return map.has(k)?map.get(k):null}, setItem(k,v){map.set(k,String(v))},
  removeItem(k){map.delete(k)}, clear(){map.clear()}
});
const localStorage=storage(local), sessionStorage=storage(session);
const ctx={window:{},localStorage,sessionStorage,location:{href:'http://localhost/prototype/index.html'},crypto:webcrypto,TextEncoder,TextDecoder,btoa:(v)=>Buffer.from(v,'binary').toString('base64'),atob:(v)=>Buffer.from(v,'base64').toString('binary'),URL,console,Date,Math,setTimeout,clearTimeout,fetch:async()=>({ok:true,status:200,json:async()=>structuredClone(seedPayload)})};
ctx.globalThis=ctx;ctx.window=ctx;
vm.createContext(ctx);
vm.runInContext(fs.readFileSync(new URL('../js/shared.js',import.meta.url),'utf8'),ctx,{filename:'shared.js'});
const F=ctx.Festacol;
if(!F||!Object.isFrozen(F))throw new Error('shared namespace was not initialized');
for(const key of ['store','questions','assessment','proctor','qr','utils'])if(!F[key])throw new Error(`Festacol.${key} unavailable`);
if(ctx.FestacolSessionStore!==F.store||ctx.FestacolQuestionData!==F.questions||ctx.FestacolAssessmentEngine!==F.assessment||ctx.FestacolProctorPolicy!==F.proctor||ctx.FestacolQR!==F.qr)throw new Error('legacy compatibility aliases do not point to shared modules');
const S=F.store,Q=F.questions,A=F.assessment,P=F.proctor;

// Preserve session compatibility/routing.
localStorage.setItem('festacol.exam.sessions.v3',JSON.stringify([{id:'OLD1',version:3,title:'Legacy stored exam',classLevel:'SS2',classGroup:'General',academicSession:'2026/2027',term:'First term',mode:'single',subjects:['mat'],placementTracks:[],durationSeconds:600,durationMinutes:10,questionCount:1,status:'open',instructions:'',startsAt:null,endsAt:null,attemptLimit:1,integrityPolicy:{},randomization:{},createdAt:1}]));
if(S.listSessions()[0]?.questionCount!==5)throw new Error('stored pre-5-question session was not migrated');
localStorage.removeItem('festacol.exam.sessions.v3');
const legacyV2={v:2,i:'OLDV2',n:'Legacy v2',c:'SS2',m:'s',s:['mat'],d:10,q:5,x:'open'};
if(S.decodeSession(Buffer.from(JSON.stringify(legacyV2)).toString('base64url')).durationSeconds!==600)throw new Error('v2 token compatibility failed');
const qualifier=S.normalizeSession({mode:'qualifier',classLevel:'SS1',classGroup:'Qualifier',subjects:['q-eng','q-math','q-bst','q-social'],placementTracks:['Science','Arts'],durationSeconds:30,questionCount:5,status:'open'});
S.saveSession(qualifier);
if(S.findSessionById(qualifier.id.toLowerCase())?.id!==qualifier.id)throw new Error('case-insensitive Exam ID lookup failed');
const canonical=new URL(S.getSessionLink(qualifier,'http://localhost/prototype/admin.html'));
if(!canonical.pathname.endsWith('/prototype/index.html')||canonical.searchParams.get('route')!=='exam')throw new Error('canonical exam route failed');

// Seed validation + approved inventory.
const loaded=await Q.load();
if(loaded.questions.filter(q=>!q.custom).length!==720)throw new Error('seed bank is not exactly 720 validated records');
const types=new Set(loaded.questions.map(q=>q.type));
for(const type of ['single','multi','boolean','fill','fill-multi'])if(!types.has(type))throw new Error(`missing response type ${type}`);
Q.validateRoutingCoverage({...loaded,questions:loaded.questions.filter(q=>!q.custom)});

// Legacy 1-43 scoring parity now comes only from question metadata.
const legacyAnswers={1:'were',2:'Rain',3:'36',4:'65°',5:'Evaporation',6:['Solar energy','Wind energy'],7:'Protecting public property',8:true,9:'Invoice',10:'Printer',11:'T7!qP2#zL9',12:true,13:'hard-working',14:'had come',15:{answer:'analyses'},16:'He had prepared consistently',17:'5',18:'2⁵',19:'8',20:'36°',21:'Chloroplast',22:'population',23:['Glucose','Oxygen'],24:'Electron',25:true,26:'valence electrons',27:'50 km/h',28:'Elastic potential energy',29:true,30:'inflation',31:'Labour',32:'Judiciary',33:'choose representatives',34:'personification',35:'drama',36:'Obeying lawful rules',37:true,38:'contours',39:'Barometer',40:['Crop rotation','Adding compost'],41:'Hoe',42:true,43:'Router'};
for(const [id,response] of Object.entries(legacyAnswers)){
  const q=Q.questionById(loaded,Number(id)); if(!q||A.scoreQuestion(q,response)!==true)throw new Error(`legacy scoring parity failed for ${id}`);
}
if(/ANSWER_KEYS/u.test(fs.readFileSync(new URL('../js/shared.js',import.meta.url),'utf8')))throw new Error('hardcoded answer-key table remains');

// Generic type scoring and invalid-response behavior.
const single=loaded.questions.find(q=>q.type==='single'&&q.id>43);
const multi=loaded.questions.find(q=>q.type==='multi'&&q.id>43);
const boolean=loaded.questions.find(q=>q.type==='boolean'&&q.id>43);
const fill=loaded.questions.find(q=>q.type==='fill'&&q.id>43);
const fillMulti=loaded.questions.find(q=>q.type==='fill-multi'&&q.id>43);
if(!A.scoreQuestion(single,single.answer)||A.scoreQuestion(single,'definitely-wrong'))throw new Error('single scoring failed');
if(!A.scoreQuestion(boolean,boolean.answer)||A.scoreQuestion(boolean,!boolean.answer))throw new Error('boolean scoring failed');
if(!A.scoreQuestion(multi,[...multi.answers].reverse())||A.scoreQuestion(multi,[multi.answers[0]]))throw new Error('multi exact-set scoring failed');
if(!A.scoreQuestion(fill,{answer:fill.acceptedAnswers[0]})||A.scoreQuestion(fill,{answer:'wrong'}))throw new Error('fill scoring failed');
const blankKeys=fillMulti.fillTemplate.filter(p=>p.blank).map(p=>String(p.blank));
const fmResponse=Object.fromEntries(blankKeys.map((key,i)=>[key,fillMulti.acceptedAnswers[i][0]]));
if(!A.scoreQuestion(fillMulti,fmResponse)||A.scoreQuestion(fillMulti,{}))throw new Error('fill-multi scoring failed');

// Malformed answer metadata must fail concretely.
for(const bad of [
  {...single,id:900001,answer:'not-in-options'},
  {...boolean,id:900002,answer:'true'},
  {...multi,id:900003,answers:[multi.answers[0]]},
  {...fill,id:900004,acceptedAnswers:[]},
  {...fillMulti,id:900005,acceptedAnswers:[['only-one']]}
]){
  let rejected=false;try{Q.validatePayload({questionSetId:'bad',subjectCatalog:loaded.subjectCatalog,questions:[bad]});}catch{rejected=true;}if(!rejected)throw new Error(`malformed ${bad.type} answer metadata was accepted`);
}

// Seed overrides alter loaded content/scoring and reset restores it.
const seed=loaded.questions.find(q=>q.type==='single'&&q.id>43);
const alternate=seed.options.find(v=>v!==seed.answer);
S.saveQuestionOverride(seed.id,{answer:alternate,prompt:`${seed.prompt} [edited]`});
if(!Array.isArray(S.listQuestionOverrides())||S.listQuestionOverrides().length!==1)throw new Error('override API does not return array');
const overridden=await Q.load();
const edited=Q.questionById(overridden,seed.id);
if(edited.answer!==alternate||edited.source!=='edited-seed'||!edited.prompt.endsWith('[edited]')||!A.scoreQuestion(edited,alternate)||A.scoreQuestion(edited,seed.answer))throw new Error('seed override did not affect content/scoring');
S.resetQuestionOverride(seed.id);
const restored=Q.questionById(await Q.load(),seed.id);
if(restored.answer!==seed.answer||restored.prompt!==seed.prompt||restored.source==='edited-seed')throw new Error('reset did not restore seed');

// Teacher-authored valid questions participate; answerless legacy records are quarantined.
const custom={id:1000001,subject:'Mathematics',subjectCode:'mat',domain:'Contract',levels:['SS2'],pathways:['Science'],examModes:['single','mixed'],type:'single',difficulty:'medium',label:'Contract question',prompt:'For the Task 5 contract only, choose the value four.',options:['3','4','5','6'],answer:'4',explanation:'Four is the requested value.'};
S.saveCustomQuestion(custom);
localStorage.setItem('festacol.admin.custom-questions.v1',JSON.stringify([custom,{id:1000002,subject:'Mathematics',subjectCode:'mat',domain:'Legacy',levels:['SS2'],pathways:['Science'],examModes:['single'],type:'single',difficulty:'medium',label:'Legacy',prompt:'Legacy question without an answer.',options:['A','B'],explanation:'Legacy persisted record.'}]));
const withCustom=await Q.load();
if(!Q.questionById(withCustom,custom.id)||!A.scoreQuestion(Q.questionById(withCustom,custom.id),'4'))throw new Error('teacher-authored scoring failed');
if(Q.questionById(withCustom,1000002)||withCustom.quarantinedCustomQuestions?.length!==1)throw new Error('legacy answerless custom question was not quarantined');

// Pathway and level intersection.
const scienceOnly=loaded.questions.find(q=>q.pathways.length===1&&q.pathways[0]==='Science'&&q.levels.length===1&&q.levels[0]==='SS2'&&q.examModes.includes('single'));
if(!scienceOnly)throw new Error('no SS2 Science-only seed found');
const scienceSession={classLevel:'SS2',mode:'single',subjects:[scienceOnly.subjectCode],classGroup:'Science',questionCount:10,randomization:{questionOrder:false,optionOrder:false,minimizePaperCollisions:false}};
const artsSession={...scienceSession,classGroup:'Arts'};
const ss1Session={...scienceSession,classLevel:'SS1'};
if(!Q.eligibleQuestions(loaded,scienceSession).some(q=>q.id===scienceOnly.id))throw new Error('Science route lost Science-only item');
if(Q.eligibleQuestions(loaded,artsSession).some(q=>q.id===scienceOnly.id))throw new Error('Arts route received Science-only item');
if(Q.eligibleQuestions(loaded,ss1Session).some(q=>q.id===scienceOnly.id))throw new Error('SS1 route received SS2-only item');

// Deterministic paper + attempt/rewrite/reset/core state regression.
const studentHash=await A.studentHash('Amina','Bello');
const candidateHash=await A.candidateHash(qualifier.id,'Amina','Bello');
const otherHash=await A.candidateHash(qualifier.id,'David','Okafor');
const paper=A.paperForStudent(loaded,qualifier,studentHash), again=A.paperForStudent(loaded,qualifier,studentHash), other=A.paperForStudent(loaded,qualifier,otherHash);
if(paper.length!==5||JSON.stringify(paper)!==JSON.stringify(again)||JSON.stringify(paper)===JSON.stringify(other))throw new Error('deterministic paper contract failed');
const responses=Object.fromEntries(paper.map(q=>[String(q.id),q.type==='multi'?q.answers:q.type==='boolean'?q.answer:q.type==='fill'?{answer:q.acceptedAnswers[0]}:q.type==='fill-multi'?Object.fromEntries(q.fillTemplate.filter(p=>p.blank).map((p,i)=>[p.blank,q.acceptedAnswers[i][0]])) : q.answer]));
const now=Date.now(); const result=A.scoreAttempt(paper,{responses,questionTimings:{},integrityEvents:[{type:'window-blur',at:now-500}],startedAt:now-20000,submittedAt:now,elapsedActiveSeconds:7},qualifier);
if(result.elapsedSeconds!==7||result.accuracy!==100||result.integrityScore>=100)throw new Error('attempt scoring/integrity regression');
const fingerprint=await A.paperFingerprint(qualifier.id,studentHash,paper),attemptHash=await A.attemptHash(qualifier.id,studentHash,fingerprint);
S.recordAttempt({id:'A1',attemptHash,candidateHash,studentHash,sessionId:qualifier.id,sessionTitle:qualifier.title,studentName:'Amina Bello',startedAt:now-20000,submittedAt:now,score:100});
const archived=S.authorizeRewrite(qualifier.id,candidateHash); if(!archived.rewriteArchivedAt||S.findAttempt(qualifier.id,candidateHash))throw new Error('rewrite regression');
let staleRejected=false;try{S.recordAttempt({id:'STALE',attemptHash:'stale',candidateHash,studentHash,sessionId:qualifier.id,startedAt:archived.rewriteArchivedAt});}catch{staleRejected=true;}if(!staleRejected)throw new Error('reset equality boundary regressed');

const currentStudent=S.listUsers().find(u=>u.role==='student'); const cls=S.listClasses().find(c=>c.id!==currentStudent.classId);
S.saveUser({...currentStudent,classId:cls.id}); if(Array.isArray(S.listUsers().find(u=>u.id===currentStudent.id).classId))throw new Error('one-class scalar contract failed');
const group=S.saveWhatsAppGroup({classId:cls.id,name:'Parents',inviteUrl:'https://chat.whatsapp.com/ABCDEFGHIJKLMNOPQRSTUV'}); if(S.whatsAppGroupForClass(cls.id)?.id!==group.id)throw new Error('WhatsApp association failed');
P.setAdminPolicy(qualifier.id,{cameraRequired:true}); const decorated=P.decorateStudentLink(S.getSessionLink(qualifier,'http://localhost/prototype/admin.html'),true); if(!P.policyFromUrl(decorated)?.cameraRequired||!F.qr.svgFor(decorated).startsWith('<svg'))throw new Error('proctor/QR regression');
const retained=S.attemptsForSession(qualifier.id).length; S.deleteSession(qualifier.id); if(S.attemptsForSession(qualifier.id).length!==retained)throw new Error('session deletion erased attempts');

console.log('state/shared contract: PASS (720 validated seeds)');
