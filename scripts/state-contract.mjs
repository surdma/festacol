import fs from 'node:fs';
import vm from 'node:vm';
import { webcrypto } from 'node:crypto';

const store = new Map();
const localStorage = { get length(){return store.size}, key(i){return [...store.keys()][i]??null}, getItem(k){return store.has(k)?store.get(k):null}, setItem(k,v){store.set(k,String(v))}, removeItem(k){store.delete(k)}, clear(){store.clear()} };
const sessions = new Map();
const sessionStorage = { get length(){return sessions.size}, key(i){return [...sessions.keys()][i]??null}, getItem(k){return sessions.has(k)?sessions.get(k):null}, setItem(k,v){sessions.set(k,String(v))}, removeItem(k){sessions.delete(k)}, clear(){sessions.clear()} };
const ctx = { window:{}, localStorage, sessionStorage, location:{href:'http://localhost/prototype/index.html'}, crypto:webcrypto, TextEncoder, TextDecoder, btoa:(v)=>Buffer.from(v,'binary').toString('base64'), atob:(v)=>Buffer.from(v,'base64').toString('binary'), URL, console, Date, Math, setTimeout, clearTimeout };
ctx.globalThis=ctx;ctx.window=ctx;
vm.createContext(ctx);
vm.runInContext(fs.readFileSync(new URL('../prototype/js/shared.js', import.meta.url),'utf8'),ctx,{filename:'shared.js'});
const F=ctx.Festacol;
if(!F||!Object.isFrozen(F))throw new Error('shared namespace was not initialized');
for(const key of ['store','questions','assessment','proctor','qr','utils'])if(!F[key])throw new Error(`Festacol.${key} is unavailable`);
if(ctx.FestacolSessionStore!==F.store||ctx.FestacolQuestionData!==F.questions||ctx.FestacolAssessmentEngine!==F.assessment||ctx.FestacolProctorPolicy!==F.proctor||ctx.FestacolQR!==F.qr)throw new Error('legacy compatibility aliases do not point to shared modules');
const S=F.store,E=F.assessment,Q=F.questions,P=F.proctor;

localStorage.setItem('festacol.exam.sessions.v3', JSON.stringify([{id:'OLD1',version:3,title:'Legacy stored exam',classLevel:'SS2',classGroup:'General',academicSession:'2026/2027',term:'First term',mode:'single',subjects:['mat'],placementTracks:[],durationSeconds:600,durationMinutes:10,questionCount:1,status:'open',instructions:'',startsAt:null,endsAt:null,attemptLimit:1,integrityPolicy:{},randomization:{},createdAt:1}]));
if(S.listSessions()[0]?.questionCount!==5)throw new Error('stored pre-5-question session was not migrated');
localStorage.removeItem('festacol.exam.sessions.v3');
const legacyV3={v:3,i:'OLD2',n:'Legacy QR',c:'SS2',g:'General',y:'2026/2027',e:'First term',m:'s',s:['mat'],d:600,q:1,x:'open',k:[1,1,1,2],o:[1,1,1]};
const legacyToken=Buffer.from(JSON.stringify(legacyV3)).toString('base64url');
if(S.decodeSession(legacyToken).questionCount!==5)throw new Error('pre-5-question v3 token was not migrated');
const legacyV2={v:2,i:'OLDV2',n:'Legacy v2',c:'SS2',m:'s',s:['mat'],d:10,q:5,x:'open'};
const legacyV2Token=Buffer.from(JSON.stringify(legacyV2)).toString('base64url');
if(S.decodeSession(legacyV2Token).durationSeconds!==600)throw new Error('v2 session token compatibility failed');

const qualifier=S.normalizeSession({mode:'qualifier',classLevel:'SS1',classGroup:'Qualifier',subjects:['q-eng','q-math','q-bst','q-social'],placementTracks:['Science','Arts'],durationSeconds:30,questionCount:5,status:'open'});
if(qualifier.durationSeconds!==30||qualifier.questionCount!==5||qualifier.placementTracks.length!==2)throw new Error('qualifier normalization failed');
for(const invalid of [1,4,151,200]){let rejected=false;try{S.normalizeSession({...qualifier,id:undefined,questionCount:invalid});}catch{rejected=true;}if(!rejected)throw new Error(`question count ${invalid} should be rejected`);}
const round=S.decodeSession(S.encodeSession(qualifier));
if(round.durationSeconds!==30||round.questionCount!==5||round.placementTracks.join(',')!=='Science,Arts')throw new Error('v3 round trip failed');
S.saveSession(qualifier);if(S.findSessionById(qualifier.id.toLowerCase())?.id!==qualifier.id)throw new Error('case-insensitive Exam ID lookup failed');
const canonicalLink=new URL(S.getSessionLink(qualifier,'http://localhost/prototype/admin.html'));
if(!canonicalLink.pathname.endsWith('/prototype/index.html')||canonicalLink.searchParams.get('route')!=='exam'||!canonicalLink.searchParams.get('session'))throw new Error('canonical index exam link failed');

const studentHash=await E.studentHash('Amina','Bello');
const candidateHash=await E.candidateHash(qualifier.id,'Amina','Bello');
const otherHash=await E.candidateHash(qualifier.id,'David','Okafor');
if(studentHash===candidateHash||candidateHash===otherHash)throw new Error('hash separation failed');
const payload={questionSetId:'contract',subjectCatalog:[{code:'q-eng',levels:['SS1']},{code:'q-math',levels:['SS1']},{code:'q-bst',levels:['SS1']},{code:'q-social',levels:['SS1']}],questions:[
{id:1,subject:'English Studies',subjectCode:'q-eng',domain:'Grammar',label:'Q1',prompt:'x',levels:['SS1'],examModes:['qualifier'],type:'single',options:['was','were','is','has been']},
{id:2,subject:'English Studies',subjectCode:'q-eng',domain:'Comprehension',label:'Q2',prompt:'x',levels:['SS1'],examModes:['qualifier'],type:'single',options:['Rain','A market day','A power cut','A visitor']},
{id:3,subject:'Mathematics',subjectCode:'q-math',domain:'Number',label:'Q3',prompt:'x',levels:['SS1'],examModes:['qualifier'],type:'single',options:['12','24','36','42']},
{id:4,subject:'Mathematics',subjectCode:'q-math',domain:'Geometry',label:'Q4',prompt:'x',levels:['SS1'],examModes:['qualifier'],type:'single',options:['55°','60°','65°','70°']},
{id:5,subject:'Basic Science & Technology',subjectCode:'q-bst',domain:'Matter',label:'Q5',prompt:'x',levels:['SS1'],examModes:['qualifier'],type:'single',options:['Condensation','Evaporation','Freezing','Melting']},
{id:7,subject:'Social & Citizenship Studies',subjectCode:'q-social',domain:'Citizenship',label:'Q7',prompt:'x',levels:['SS1'],examModes:['qualifier'],type:'single',options:['Protecting public property','Damaging community facilities','Ignoring lawful rules','Preventing lawful opinions']}
]};
Q.validatePayload(payload);
const paper=E.paperForStudent(payload,qualifier,candidateHash),again=E.paperForStudent(payload,qualifier,candidateHash),other=E.paperForStudent(payload,qualifier,otherHash);
if(paper.length!==5||JSON.stringify(paper)!==JSON.stringify(again)||JSON.stringify(paper)===JSON.stringify(other))throw new Error('deterministic paper contract failed');
const responses={};for(const q of paper){const correct={1:'were',2:'Rain',3:'36',4:'65°',5:'Evaporation',7:'Protecting public property'}[q.id];responses[String(q.id)]=correct;}
const now=Date.now();const result=E.scoreAttempt(paper,{responses,questionTimings:{},integrityEvents:[{type:'window-blur',at:now-500}],startedAt:now-20000,submittedAt:now,elapsedActiveSeconds:7},qualifier);
if(result.elapsedSeconds!==7||result.accuracy!==100||result.integrityScore>=100)throw new Error('scoring/integrity contract failed');
if(E.valueIsCorrect({id:6,type:'multi'},['Wind energy','Solar energy'])!==true||E.valueIsCorrect({id:8,type:'boolean'},true)!==true)throw new Error('legacy answer-key parity failed');

const fingerprint=await E.paperFingerprint(qualifier.id,candidateHash,paper),attemptHash=await E.attemptHash(qualifier.id,candidateHash,fingerprint);
S.recordAttempt({id:'A1',attemptHash,candidateHash,studentHash,sessionId:qualifier.id,sessionTitle:qualifier.title,studentName:'Amina Bello',firstName:'Amina',lastName:'Bello',startedAt:now-20000,submittedAt:now,score:100,integrityScore:result.integrityScore,integrityEvents:[{type:'window-blur',at:now-500}]});
if(!S.hasSubmittedAttempt(qualifier.id,candidateHash)||S.attemptsForStudent(studentHash).length!==1)throw new Error('student/exam relationship failed');
const archived=S.authorizeRewrite(qualifier.id,candidateHash);
if(!archived.rewriteArchivedAt||archived.rewriteSourceAttemptHash!==candidateHash)throw new Error('rewrite did not archive original attempt');
if(S.findAttempt(qualifier.id,candidateHash))throw new Error('rewrite did not release current candidate lock');
let staleRejected=false;try{S.recordAttempt({id:'STALE',attemptHash:'stale',candidateHash,studentHash,sessionId:qualifier.id,startedAt:archived.rewriteArchivedAt});}catch{staleRejected=true;}if(!staleRejected)throw new Error('rewrite reset marker accepted a stale replacement');
S.recordAttempt({id:'A2',attemptHash:'replacement',candidateHash,studentHash,sessionId:qualifier.id,sessionTitle:qualifier.title,studentName:'Amina Bello',startedAt:archived.rewriteArchivedAt+1});
if(!S.findAttempt(qualifier.id,candidateHash)||S.attemptsForSession(qualifier.id).length!==2)throw new Error('rewrite replacement attempt failed');

const resumeHash=await E.candidateHash(qualifier.id,'Resume','Candidate'),resumeStudentHash=await E.studentHash('Resume','Candidate');
S.setStudentAuth(resumeStudentHash);S.setActiveCandidate(qualifier.id,resumeHash);
const resumeState={version:4,candidateHash:resumeHash,studentHash:resumeStudentHash,startedAt:Date.now()+5,remainingSeconds:24,elapsedActiveSeconds:6,lastActiveAt:null,submittedAt:null};
if(S.saveStudentState(qualifier.id,resumeHash,resumeState)!==true)throw new Error('unfinished state did not persist');
S.recordAttempt({id:'R1',attemptHash:'R1',candidateHash:resumeHash,studentHash:resumeStudentHash,sessionId:qualifier.id,sessionTitle:'Resume exam',studentName:'Resume Candidate',startedAt:resumeState.startedAt,remainingSeconds:24});
const reset=S.resetUnfinishedAttempt(qualifier.id,resumeHash);
if(!reset.resetAt||S.findAttempt(qualifier.id,resumeHash)||S.getStudentState(qualifier.id,resumeHash)||S.getStudentAuth())throw new Error('unfinished reset failed');

const currentStudent=S.listUsers().find((user)=>user.role==='student');
const destinationClass=S.listClasses().find((item)=>item.id!==currentStudent.classId&&item.classLevel==='SS2')||S.listClasses().find((item)=>item.id!==currentStudent.classId);
const movedStudent=S.saveUser({...currentStudent,classId:destinationClass.id});
const storedStudent=S.listUsers().find((user)=>user.id===currentStudent.id);
if(Array.isArray(movedStudent.classId)||Array.isArray(storedStudent.classId)||storedStudent.classId!==destinationClass.id)throw new Error('student class relationship is not exactly one scalar classId');

const group=S.saveWhatsAppGroup({classId:destinationClass.id,name:'SS2 Parents',inviteUrl:'https://chat.whatsapp.com/ABCDEFGHIJKLMNOPQRSTUV'});
if(S.whatsAppGroupForClass(destinationClass.id)?.id!==group.id)throw new Error('WhatsApp class association failed');
let badWhatsApp=false;try{S.saveWhatsAppGroup({classId:destinationClass.id,name:'Bad',inviteUrl:'https://example.com/group'});}catch{badWhatsApp=true;}if(!badWhatsApp)throw new Error('invalid WhatsApp link was accepted');

P.setAdminPolicy(qualifier.id,{cameraRequired:true});
const decorated=P.decorateStudentLink(S.getSessionLink(qualifier,'http://localhost/prototype/admin.html'),true);
if(!P.policyFromUrl(decorated)?.cameraRequired||P.sessionIdFromLink(decorated)!==qualifier.id)throw new Error('proctor decorated-link contract failed');
if(!F.qr.svgFor(decorated).startsWith('<svg'))throw new Error('QR SVG contract failed');

const retainedAttemptCount=S.attemptsForSession(qualifier.id).length;
S.deleteSession(qualifier.id);
if(S.findSessionById(qualifier.id))throw new Error('session definition was not deleted');
if(S.attemptsForSession(qualifier.id).length!==retainedAttemptCount)throw new Error('deleting a session erased retained attempt history');

console.log('state/shared contract: PASS');
