import fs from 'node:fs';
import vm from 'node:vm';
import { webcrypto } from 'node:crypto';
const store=new Map();
const localStorage={get length(){return store.size},key(i){return [...store.keys()][i]??null},getItem(k){return store.has(k)?store.get(k):null},setItem(k,v){store.set(k,String(v))},removeItem(k){store.delete(k)},clear(){store.clear()}};
const sessionStore=new Map();
const sessionStorage={get length(){return sessionStore.size},key(i){return [...sessionStore.keys()][i]??null},getItem(k){return sessionStore.has(k)?sessionStore.get(k):null},setItem(k,v){sessionStore.set(k,String(v))},removeItem(k){sessionStore.delete(k)},clear(){sessionStore.clear()}};
const ctx={window:{},localStorage,sessionStorage,crypto:webcrypto,TextEncoder,TextDecoder,btoa:(v)=>Buffer.from(v,'binary').toString('base64'),atob:(v)=>Buffer.from(v,'base64').toString('binary'),URL,console,Date,Math,setTimeout,clearTimeout};ctx.globalThis=ctx;ctx.window=ctx;
vm.createContext(ctx);
for(const file of ['session-store.js','assessment-engine.js'])vm.runInContext(fs.readFileSync(new URL(`../prototype/js/${file}`, import.meta.url),'utf8'),ctx,{filename:file});
const S=ctx.FestacolSessionStore,E=ctx.FestacolAssessmentEngine;
const qualifier=S.normalizeSession({mode:'qualifier',classLevel:'SS1',classGroup:'Qualifier',subjects:['q-eng','q-math','q-bst','q-social'],placementTracks:['Science','Arts'],durationSeconds:30,questionCount:4,status:'open'});
if(qualifier.durationSeconds!==30||qualifier.placementTracks.length!==2)throw new Error('qualifier normalization failed');
const round=S.decodeSession(S.encodeSession(qualifier));
if(round.durationSeconds!==30||round.placementTracks.join(',')!=='Science,Arts')throw new Error('v3 round trip failed');
const studentHash=await E.studentHash('Amina','Bello');
const candidateHash=await E.candidateHash(qualifier.id,'Amina','Bello');
const otherHash=await E.candidateHash(qualifier.id,'David','Okafor');
if(studentHash===candidateHash||candidateHash===otherHash)throw new Error('hash separation failed');
const payload={questions:[
{id:1,subject:'English Studies',subjectCode:'q-eng',domain:'Grammar',levels:['SS1'],examModes:['qualifier'],type:'single',options:['was','were','is','has been']},
{id:2,subject:'English Studies',subjectCode:'q-eng',domain:'Comprehension',levels:['SS1'],examModes:['qualifier'],type:'single',options:['Rain','A market day','A power cut','A visitor']},
{id:3,subject:'Mathematics',subjectCode:'q-math',domain:'Number',levels:['SS1'],examModes:['qualifier'],type:'single',options:['12','24','36','42']},
{id:4,subject:'Mathematics',subjectCode:'q-math',domain:'Geometry',levels:['SS1'],examModes:['qualifier'],type:'single',options:['55°','60°','65°','70°']},
{id:5,subject:'Basic Science & Technology',subjectCode:'q-bst',domain:'Matter',levels:['SS1'],examModes:['qualifier'],type:'single',options:['Condensation','Evaporation','Freezing','Melting']},
{id:7,subject:'Social & Citizenship Studies',subjectCode:'q-social',domain:'Citizenship',levels:['SS1'],examModes:['qualifier'],type:'single',options:['Protecting public property','Damaging community facilities','Ignoring lawful rules','Preventing lawful opinions']}
]};
const paper=E.paperForStudent(payload,qualifier,candidateHash);const again=E.paperForStudent(payload,qualifier,candidateHash);const other=E.paperForStudent(payload,qualifier,otherHash);
if(JSON.stringify(paper)!==JSON.stringify(again))throw new Error('paper is not deterministic');
if(JSON.stringify(paper)===JSON.stringify(other))throw new Error('paper did not vary across candidates');
const responses={};for(const q of paper){const correct={1:'were',2:'Rain',3:'36',4:'65°',5:'Evaporation',7:'Protecting public property'}[q.id];responses[String(q.id)]=correct;}
const now=Date.now();const result=E.scoreAttempt(paper,{responses,questionTimings:{},integrityEvents:[],startedAt:now-20000,submittedAt:now,elapsedActiveSeconds:7},qualifier);
if(result.elapsedSeconds!==7)throw new Error('active-time scoring did not ignore paused wall time');
if(result.accuracy!==100||!['Science','Arts'].includes(result.placement.assignedTrack))throw new Error('scoring/placement failed');
const fingerprint=await E.paperFingerprint(qualifier.id,candidateHash,paper);const attemptHash=await E.attemptHash(qualifier.id,candidateHash,fingerprint);
S.recordAttempt({id:'A1',attemptHash,candidateHash,studentHash,sessionId:qualifier.id,sessionTitle:qualifier.title,studentName:'Amina Bello',firstName:'Amina',lastName:'Bello',submittedAt:now,startedAt:now-20000,score:result.accuracy,placement:result.placement});
if(!S.hasSubmittedAttempt(qualifier.id,candidateHash))throw new Error('one-attempt lock lookup failed');
if(S.attemptsForStudent(studentHash).length!==1)throw new Error('student history lookup failed');
const resumeHash=await E.candidateHash(qualifier.id,'Resume','Candidate');
const resumeStudentHash=await E.studentHash('Resume','Candidate');
S.setStudentAuth(resumeStudentHash);S.setActiveCandidate(qualifier.id,resumeHash);
const resumeState={version:3,candidateHash:resumeHash,studentHash:resumeStudentHash,startedAt:now-5000,remainingSeconds:24,elapsedActiveSeconds:6,lastActiveAt:null,submittedAt:null};
if(S.saveStudentState(qualifier.id,resumeHash,resumeState)!==true)throw new Error('unfinished state did not persist');
S.recordAttempt({id:'R1',candidateHash:resumeHash,studentHash:resumeStudentHash,sessionId:qualifier.id,sessionTitle:'Resume exam',studentName:'Resume Candidate',firstName:'Resume',lastName:'Candidate',startedAt:resumeState.startedAt,remainingSeconds:24,elapsedActiveSeconds:6});
const reset=S.resetUnfinishedAttempt(qualifier.id,resumeHash);
if(!reset.resetAt||S.findAttempt(qualifier.id,resumeHash)||S.getStudentState(qualifier.id,resumeHash))throw new Error('unfinished attempt reset failed');
if(S.getStudentAuth())throw new Error('reset did not clear session authentication');
if(S.getAttemptResetAt(qualifier.id,resumeHash)!==reset.resetAt||!S.isAttemptInvalidated(qualifier.id,resumeHash,resumeState.startedAt))throw new Error('reset marker missing');
if(S.saveStudentState(qualifier.id,resumeHash,resumeState)!==false)throw new Error('stale state was allowed to resurrect after reset');
let staleRejected=false;try{S.recordAttempt({id:'R1',candidateHash:resumeHash,studentHash:resumeStudentHash,sessionId:qualifier.id,startedAt:resumeState.startedAt});}catch{staleRejected=true;}if(!staleRejected)throw new Error('stale attempt record was allowed after reset');
let submittedResetRejected=false;try{S.resetUnfinishedAttempt(qualifier.id,candidateHash);}catch{submittedResetRejected=true;}if(!submittedResetRejected)throw new Error('submitted attempt reset was allowed');
console.log('state/assessment contract: PASS');
