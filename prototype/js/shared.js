(() => {
  'use strict';

  const global = globalThis;
  const win = global.window || global;

  const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
  const uniqueStrings = (value) => Array.isArray(value) ? [...new Set(value.map(String).filter(Boolean))] : [];
  const sanitizeTitle = (value) => String(value || '').trim().replace(/\s+/gu, ' ').slice(0, 72);
  const sanitizeName = (value) => String(value || '').trim().replace(/\s+/gu, ' ').slice(0, 80);
  const normalizeText = (value) => String(value ?? '').trim().replace(/\s+/gu, ' ').toLocaleLowerCase('en');
  const makeId = () => global.crypto?.randomUUID ? global.crypto.randomUUID().split('-')[0].toUpperCase() : Math.random().toString(36).slice(2, 10).toUpperCase();
  const utf8ToBase64Url = (value) => {
    const bytes = new TextEncoder().encode(value);
    let binary = '';
    bytes.forEach((byte) => { binary += String.fromCharCode(byte); });
    return btoa(binary).replaceAll('+', '-').replaceAll('/', '_').replace(/=+$/u, '');
  };
  const base64UrlToUtf8 = (value) => {
    const normalized = String(value || '').replaceAll('-', '+').replaceAll('_', '/');
    const padded = normalized + '='.repeat((4 - (normalized.length % 4 || 4)) % 4);
    const binary = atob(padded);
    return new TextDecoder().decode(Uint8Array.from(binary, (char) => char.charCodeAt(0)));
  };
  const durationLabel = (seconds) => {
    const value = Math.max(0, Number(seconds) || 0);
    if (value < 60) return `${value} sec`;
    if (value % 3600 === 0) return `${value / 3600} hr${value === 3600 ? '' : 's'}`;
    if (value >= 3600) return `${Math.floor(value / 3600)}h ${Math.round(value % 3600 / 60)}m`;
    return `${Math.round(value / 60)} min`;
  };
  const routeUrl = (route, params = {}, baseHref = global.location?.href || 'http://localhost/prototype/index.html') => {
    const url = new URL('./index.html', baseHref);
    url.search = '';
    url.hash = '';
    url.searchParams.set('route', route);
    Object.entries(params).forEach(([key, value]) => {
      if (value === undefined || value === null || value === '') return;
      url.searchParams.set(key, String(value));
    });
    return url.href;
  };
  const utils = Object.freeze({ clamp, uniqueStrings, sanitizeTitle, sanitizeName, normalizeText, durationLabel, routeUrl, utf8ToBase64Url, base64UrlToUtf8 });

  const PAYLOAD_VERSION = 3;
  const SUPPORTED_PAYLOAD_VERSIONS = new Set([2, 3]);
  const ACADEMIC_SESSION = '2026/2027';
  const TRACKS = Object.freeze(['Science', 'Arts', 'Social Science']);
  const MODE_LABELS = Object.freeze({ qualifier: 'SS1 stream qualifier', mixed: 'Mixed-subject examination', single: 'Single-subject examination', waec: 'WAEC subject practice' });
  const MODE_CODES = Object.freeze({ qualifier: 'q', mixed: 'm', single: 's', waec: 'w' });
  const CODE_MODES = Object.freeze({ q: 'qualifier', m: 'mixed', s: 'single', w: 'waec' });

  const normalizeIntegrityPolicy = (value = {}) => ({ focusMonitoring: value.focusMonitoring !== false, fullscreenPrompt: value.fullscreenPrompt !== false, clipboardGuard: value.clipboardGuard !== false, warnAfter: clamp(Math.round(Number(value.warnAfter) || 2), 1, 10) });
  const normalizeRandomization = (value = {}) => ({ questionOrder: value.questionOrder !== false, optionOrder: value.optionOrder !== false, minimizePaperCollisions: value.minimizePaperCollisions !== false });
  const normalizeSession = (input = {}) => {
    const mode = String(input.mode || '');
    const classLevel = String(input.classLevel || '');
    const subjects = uniqueStrings(input.subjects);
    const requestedTracks = uniqueStrings(input.placementTracks).filter((track) => TRACKS.includes(track));
    const placementTracks = mode === 'qualifier' && !requestedTracks.length ? [...TRACKS] : requestedTracks;
    const durationSeconds = Math.round(Number(input.durationSeconds ?? Number(input.durationMinutes) * 60));
    const questionCount = Math.round(Number(input.questionCount));
    if (!Object.hasOwn(MODE_LABELS, mode)) throw new Error('Unsupported examination mode.');
    if (!['SS1', 'SS2', 'SS3'].includes(classLevel)) throw new Error('Choose SS1, SS2, or SS3.');
    if (mode === 'qualifier' && classLevel !== 'SS1') throw new Error('Qualifier sessions are reserved for incoming SS1 candidates.');
    if (mode === 'waec' && classLevel !== 'SS3') throw new Error('WAEC subject practice sessions are configured for SS3.');
    if (mode === 'mixed' && (subjects.length < 2 || subjects.length > 12)) throw new Error('Mixed examinations need between two and twelve subjects.');
    if ((mode === 'single' || mode === 'waec') && subjects.length !== 1) throw new Error('This examination mode requires exactly one subject.');
    if (mode === 'qualifier' && subjects.length && subjects.some((code) => !code.startsWith('q-'))) throw new Error('Qualifier sessions can only use placement-domain subjects.');
    if (mode === 'qualifier' && placementTracks.length < 1) throw new Error('Choose at least one eligible placement track.');
    if (!Number.isInteger(durationSeconds) || durationSeconds < 30 || durationSeconds > 10800) throw new Error('Duration must be between 30 seconds and 3 hours.');
    if (!Number.isInteger(questionCount) || questionCount < 5 || questionCount > 150) throw new Error('Question count must be between 5 and 150.');
    return { id: String(input.id || makeId()).trim().toUpperCase().slice(0, 20), version: PAYLOAD_VERSION, title: sanitizeTitle(input.title) || MODE_LABELS[mode], classLevel, classGroup: String(input.classGroup || (mode === 'qualifier' ? 'Qualifier' : 'General')).slice(0, 40), academicSession: String(input.academicSession || ACADEMIC_SESSION).slice(0, 20), term: String(input.term || 'First term').slice(0, 24), mode, subjects, placementTracks: mode === 'qualifier' ? placementTracks : [], durationSeconds, durationMinutes: durationSeconds / 60, questionCount, status: ['open', 'draft', 'closed'].includes(input.status) ? input.status : 'open', instructions: String(input.instructions || '').trim().slice(0, 140), startsAt: input.startsAt ? Number(input.startsAt) : null, endsAt: input.endsAt ? Number(input.endsAt) : null, attemptLimit: 1, integrityPolicy: normalizeIntegrityPolicy(input.integrityPolicy), randomization: normalizeRandomization(input.randomization), createdAt: Number(input.createdAt) || Date.now(), updatedAt: Number(input.updatedAt) || Date.now() };
  };
  const toPayload = (s) => ({ v: PAYLOAD_VERSION, i: s.id, n: s.title, c: s.classLevel, g: s.classGroup, y: s.academicSession, e: s.term, m: MODE_CODES[s.mode], s: s.subjects, t: s.placementTracks?.length ? s.placementTracks : undefined, d: s.durationSeconds, q: s.questionCount, x: s.status, r: s.instructions || undefined, a: s.startsAt || undefined, z: s.endsAt || undefined, k: [s.integrityPolicy.focusMonitoring ? 1 : 0, s.integrityPolicy.fullscreenPrompt ? 1 : 0, s.integrityPolicy.clipboardGuard ? 1 : 0, s.integrityPolicy.warnAfter], o: [s.randomization.questionOrder ? 1 : 0, s.randomization.optionOrder ? 1 : 0, s.randomization.minimizePaperCollisions ? 1 : 0] });
  const fromPayloadV3 = (p) => normalizeSession({ id: p.i, title: p.n, classLevel: p.c, classGroup: p.g, academicSession: p.y, term: p.e, mode: CODE_MODES[p.m], subjects: p.s || [], placementTracks: p.t || TRACKS, durationSeconds: p.d, questionCount: clamp(Number(p.q) || 5, 5, 150), status: p.x, instructions: p.r || '', startsAt: p.a || null, endsAt: p.z || null, integrityPolicy: { focusMonitoring: p.k?.[0] !== 0, fullscreenPrompt: p.k?.[1] !== 0, clipboardGuard: p.k?.[2] !== 0, warnAfter: p.k?.[3] || 2 }, randomization: { questionOrder: p.o?.[0] !== 0, optionOrder: p.o?.[1] !== 0, minimizePaperCollisions: p.o?.[2] !== 0 }, createdAt: Date.now() });
  const fromPayloadV2 = (p) => normalizeSession({ id: p.i, title: p.n, classLevel: p.c, mode: CODE_MODES[p.m], subjects: p.s || [], placementTracks: CODE_MODES[p.m] === 'qualifier' ? TRACKS : [], durationSeconds: Number(p.d) * 60, questionCount: clamp(Number(p.q) || 5, 5, 150), status: p.x, instructions: p.r || '', startsAt: p.a || null, endsAt: p.z || null, createdAt: Date.now() });
  const encodeSession = (input) => utf8ToBase64Url(JSON.stringify(toPayload(normalizeSession(input))));
  const decodeSession = (token) => { if (!token) throw new Error('No examination session was provided.'); let payload; try { payload = JSON.parse(base64UrlToUtf8(token)); } catch { throw new Error('This examination link is not valid.'); } if (!SUPPORTED_PAYLOAD_VERSIONS.has(payload?.v)) throw new Error('This examination link uses an unsupported format.'); return payload.v === 2 ? fromPayloadV2(payload) : fromPayloadV3(payload); };
  const getSessionLink = (session, baseHref = global.location?.href || 'http://localhost/prototype/index.html') => routeUrl('exam', { session: encodeSession(session) }, baseHref);
  const getModeLabel = (mode) => MODE_LABELS[mode] || 'Examination session';

  const normalizeAttempt = (a = {}) => ({ id: String(a.id || makeId()), attemptHash: String(a.attemptHash || ''), candidateHash: String(a.candidateHash || ''), studentHash: String(a.studentHash || ''), paperFingerprint: String(a.paperFingerprint || ''), sessionId: String(a.sessionId || '').toUpperCase(), sessionTitle: sanitizeTitle(a.sessionTitle), firstName: sanitizeName(a.firstName || '').split(' ')[0] || '', lastName: sanitizeName(a.lastName || '').split(' ').slice(-1)[0] || '', studentName: sanitizeName(a.studentName || [a.firstName, a.lastName].filter(Boolean).join(' ')), classLevel: String(a.classLevel || ''), classGroup: String(a.classGroup || ''), academicSession: String(a.academicSession || ACADEMIC_SESSION), mode: String(a.mode || ''), sessionStatus: String(a.sessionStatus || ''), sessionEndsAt: Number(a.sessionEndsAt) || null, subjects: uniqueStrings(a.subjects), startedAt: Number(a.startedAt) || null, submittedAt: Number(a.submittedAt) || null, remainingSeconds: Number.isFinite(Number(a.remainingSeconds)) ? Number(a.remainingSeconds) : null, elapsedActiveSeconds: Number(a.elapsedActiveSeconds) || 0, answered: Number(a.answered) || 0, questionCount: Number(a.questionCount) || 0, score: Number.isFinite(Number(a.score)) ? Number(a.score) : null, correctCount: Number.isFinite(Number(a.correctCount)) ? Number(a.correctCount) : null, completion: Number.isFinite(Number(a.completion)) ? Number(a.completion) : null, paceIndex: Number.isFinite(Number(a.paceIndex)) ? Number(a.paceIndex) : null, reasoningIndex: Number.isFinite(Number(a.reasoningIndex)) ? Number(a.reasoningIndex) : null, integrityScore: Number.isFinite(Number(a.integrityScore)) ? Number(a.integrityScore) : null, integrityEvents: Array.isArray(a.integrityEvents) ? a.integrityEvents.slice(-100) : [], subjectStats: Array.isArray(a.subjectStats) ? a.subjectStats : [], placement: a.placement && typeof a.placement === 'object' ? a.placement : null, details: Array.isArray(a.details) ? a.details : [], questionIds: Array.isArray(a.questionIds) ? a.questionIds.map(Number) : [], submissionReason: String(a.submissionReason || ''), rewriteArchivedAt: Number(a.rewriteArchivedAt) || null, rewriteSourceAttemptHash: String(a.rewriteSourceAttemptHash || '') });

  // ---------------------------------------------------------------------------
  // Supabase persistence layer.
  // Durable entities live in Postgres via PostgREST. Ephemeral per-tab pointers
  // (current auth, active candidate, camera session flags) live only in JS
  // memory — never localStorage / sessionStorage.
  // When Supabase is not configured (missing anon key, offline, Node contract
  // tests), an in-memory Map backend with identical semantics is used so the
  // UI behaviour and contracts stay verifiable.
  // ---------------------------------------------------------------------------
  const supabase = () => (win.FestacolSupabase?.getClient ? win.FestacolSupabase.getClient() : null);
  const backendName = () => (supabase() ? 'supabase' : 'memory');

  const mem = {
    sessions: new Map(), attempts: new Map(), states: new Map(), profiles: new Map(),
    resets: new Map(), background: new Map(), users: new Map(), classes: new Map(),
    customQuestions: new Map(), overrides: new Map(), whatsapp: new Map(), proctor: new Map(),
    qbankMeta: null, qbankItems: new Map(),
    seeded: false
  };

  // No demo dataset anywhere: every backend starts empty and only stores
  // records the school creates through the app. The memory fallback below is
  // a transparent store with identical semantics (used by offline checks).
  const ensureMemSeeded = () => {
    if (mem.seeded) return;
    mem.seeded = true;
  };

  // Ephemeral per-tab pointers only (never persisted).
  let currentAuthHash = '';
  const activeCandidateBySession = new Map();
  const cameraSessionFlags = new Map();

  // --- row mappers (Supabase snake_case <-> app camelCase) ---
  const sessionToRow = (s) => ({ id: s.id, title: s.title, class_level: s.classLevel, class_group: s.classGroup, academic_session: s.academicSession, term: s.term, mode: s.mode, subjects: s.subjects, placement_tracks: s.placementTracks, duration_seconds: s.durationSeconds, question_count: s.questionCount, status: s.status, instructions: s.instructions, starts_at: s.startsAt, ends_at: s.endsAt, attempt_limit: 1, integrity_policy: s.integrityPolicy, randomization: s.randomization, created_at: s.createdAt, updated_at: s.updatedAt });
  const sessionFromRow = (r) => normalizeSession({ id: r.id, title: r.title, classLevel: r.class_level, classGroup: r.class_group, academicSession: r.academic_session, term: r.term, mode: r.mode, subjects: r.subjects, placementTracks: r.placement_tracks, durationSeconds: r.duration_seconds, questionCount: clamp(Number(r.question_count) || 5, 5, 150), status: r.status, instructions: r.instructions, startsAt: r.starts_at, endsAt: r.ends_at, integrityPolicy: r.integrity_policy, randomization: r.randomization, createdAt: r.created_at, updatedAt: r.updated_at });
  const attemptToRow = (a) => ({ id: a.id, attempt_hash: a.attemptHash, candidate_hash: a.candidateHash, student_hash: a.studentHash, paper_fingerprint: a.paperFingerprint, session_id: a.sessionId, session_title: a.sessionTitle, first_name: a.firstName, last_name: a.lastName, student_name: a.studentName, class_level: a.classLevel, class_group: a.classGroup, academic_session: a.academicSession, mode: a.mode, session_status: a.sessionStatus, session_ends_at: a.sessionEndsAt, subjects: a.subjects, started_at: a.startedAt, submitted_at: a.submittedAt, remaining_seconds: a.remainingSeconds, elapsed_active_seconds: a.elapsedActiveSeconds, answered: a.answered, question_count: a.questionCount, score: a.score, correct_count: a.correctCount, completion: a.completion, pace_index: a.paceIndex, reasoning_index: a.reasoningIndex, integrity_score: a.integrityScore, integrity_events: a.integrityEvents, subject_stats: a.subjectStats, placement: a.placement, details: a.details, question_ids: a.questionIds, submission_reason: a.submissionReason, rewrite_archived_at: a.rewriteArchivedAt, rewrite_source_attempt_hash: a.rewriteSourceAttemptHash });
  const attemptFromRow = (r) => normalizeAttempt({ id: r.id, attemptHash: r.attempt_hash, candidateHash: r.candidate_hash, studentHash: r.student_hash, paperFingerprint: r.paper_fingerprint, sessionId: r.session_id, sessionTitle: r.session_title, firstName: r.first_name, lastName: r.last_name, studentName: r.student_name, classLevel: r.class_level, classGroup: r.class_group, academicSession: r.academic_session, mode: r.mode, sessionStatus: r.session_status, sessionEndsAt: r.session_ends_at, subjects: r.subjects, startedAt: r.started_at, submittedAt: r.submitted_at, remainingSeconds: r.remaining_seconds, elapsedActiveSeconds: r.elapsed_active_seconds, answered: r.answered, questionCount: r.question_count, score: r.score, correctCount: r.correct_count, completion: r.completion, paceIndex: r.pace_index, reasoningIndex: r.reasoning_index, integrityScore: r.integrity_score, integrityEvents: r.integrity_events, subjectStats: r.subject_stats, placement: r.placement, details: r.details, questionIds: r.question_ids, submissionReason: r.submission_reason, rewriteArchivedAt: r.rewrite_archived_at, rewriteSourceAttemptHash: r.rewrite_source_attempt_hash });

  const throwSupabase = (error, fallbackMessage) => {
    if (!error) return;
    throw new Error(error.message || fallbackMessage || 'Supabase request failed.');
  };

  // --- sessions ---
  const listSessions = async () => {
    const client = supabase();
    if (!client) {
      ensureMemSeeded();
      return [...mem.sessions.values()].map((s) => { try { return normalizeSession({ ...s, questionCount: clamp(Number(s.questionCount) || 5, 5, 150) }); } catch { return null; } }).filter(Boolean).sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
    }
    const { data, error } = await client.from('exam_sessions').select('*').order('created_at', { ascending: false }).limit(80);
    throwSupabase(error, 'Unable to list examination sessions.');
    return (data || []).map((row) => { try { return sessionFromRow(row); } catch { return null; } }).filter(Boolean);
  };
  const saveSession = async (input) => {
    const prior = input?.id ? await findSessionById(String(input.id)) : null;
    const session = normalizeSession({ ...input, createdAt: input.createdAt || prior?.createdAt || Date.now(), updatedAt: Date.now() });
    const client = supabase();
    if (!client) {
      ensureMemSeeded();
      mem.sessions.set(session.id, session);
      return session;
    }
    const { error } = await client.from('exam_sessions').upsert(sessionToRow(session), { onConflict: 'id' });
    throwSupabase(error, 'Unable to save examination session.');
    return session;
  };
  const findSessionById = async (sessionId) => {
    const id = String(sessionId || '').trim().toUpperCase();
    if (!id) return null;
    const client = supabase();
    if (!client) {
      ensureMemSeeded();
      const found = mem.sessions.get(id) || [...mem.sessions.values()].find((s) => s.id === id);
      return found ? normalizeSession(found) : null;
    }
    const { data, error } = await client.from('exam_sessions').select('*').eq('id', id).maybeSingle();
    if (error) throwSupabase(error, 'Unable to load examination session.');
    return data ? sessionFromRow(data) : null;
  };
  const updateSessionStatus = async (sessionId, status) => {
    if (!['open', 'draft', 'closed'].includes(status)) throw new Error('Unsupported session status.');
    const found = await findSessionById(sessionId);
    if (!found) return null;
    return saveSession({ ...found, status });
  };
  const deleteSession = async (sessionId) => {
    const id = String(sessionId).toUpperCase();
    const client = supabase();
    if (!client) { ensureMemSeeded(); mem.sessions.delete(id); return; }
    const { error } = await client.from('exam_sessions').delete().eq('id', id);
    throwSupabase(error, 'Unable to delete examination session.');
  };
  const resolveSession = async (session) => (session?.id ? await findSessionById(session.id) : null) || session;

  // --- attempts ---
  const getAttempts = async () => {
    const client = supabase();
    if (!client) {
      ensureMemSeeded();
      return [...mem.attempts.values()].map(normalizeAttempt).sort((a, b) => ((b.submittedAt || b.startedAt || 0)) - ((a.submittedAt || a.startedAt || 0))).slice(0, 500);
    }
    const { data, error } = await client.from('exam_attempts').select('*').order('started_at', { ascending: false }).limit(500);
    throwSupabase(error, 'Unable to list attempts.');
    return (data || []).map(attemptFromRow);
  };
  const getAttemptResetAt = async (sessionId, candidateHash) => {
    const sid = String(sessionId).toUpperCase();
    const ch = String(candidateHash || '');
    if (!ch) return 0;
    const client = supabase();
    if (!client) { ensureMemSeeded(); return Number(mem.resets.get(`${sid}:${ch}`)) || 0; }
    const { data, error } = await client.from('attempt_reset_markers').select('reset_at').eq('session_id', sid).eq('candidate_hash', ch).maybeSingle();
    if (error) throwSupabase(error, 'Unable to load reset marker.');
    return Number(data?.reset_at) || 0;
  };
  const isAttemptInvalidated = async (sessionId, candidateHash, startedAt = 0) => {
    const resetAt = await getAttemptResetAt(sessionId, candidateHash);
    return Boolean(resetAt && resetAt >= Number(startedAt || 0));
  };
  const recordAttempt = async (attempt) => {
    const normalized = normalizeAttempt(attempt);
    if (normalized.candidateHash && normalized.startedAt && await isAttemptInvalidated(normalized.sessionId, normalized.candidateHash, normalized.startedAt)) throw new Error('This unfinished attempt was reset by an administrator.');
    const client = supabase();
    if (!client) {
      ensureMemSeeded();
      const key = normalized.attemptHash || normalized.id;
      mem.attempts.set(key, normalized);
      return normalized;
    }
    const { error } = await client.from('exam_attempts').upsert(attemptToRow(normalized), { onConflict: 'attempt_hash' });
    throwSupabase(error, 'Unable to record attempt.');
    return normalized;
  };
  const findAttempt = async (sessionId, candidateHash) => {
    const sid = String(sessionId).toUpperCase();
    const client = supabase();
    if (!client) {
      ensureMemSeeded();
      return [...mem.attempts.values()].find((a) => a.sessionId === sid && a.candidateHash === candidateHash && !a.rewriteArchivedAt) || null;
    }
    const { data, error } = await client.from('exam_attempts').select('*').eq('session_id', sid).eq('candidate_hash', candidateHash).is('rewrite_archived_at', null).limit(1).maybeSingle();
    if (error) throwSupabase(error, 'Unable to load attempt.');
    return data ? attemptFromRow(data) : null;
  };
  const attemptsForCandidate = async (candidateHash) => (await getAttempts()).filter((a) => a.candidateHash === candidateHash || a.rewriteSourceAttemptHash === candidateHash);
  const attemptsForStudent = async (studentHash) => (await getAttempts()).filter((a) => a.studentHash === studentHash || (!a.studentHash && a.candidateHash === studentHash));
  const attemptsForSession = async (sessionId) => (await getAttempts()).filter((a) => a.sessionId === String(sessionId || '').toUpperCase());
  const hasSubmittedAttempt = async (sessionId, candidateHash) => Boolean((await findAttempt(sessionId, candidateHash))?.submittedAt);

  // --- student state (in-progress papers) ---
  const getStudentState = async (sessionId, candidateHash) => {
    const sid = String(sessionId).toUpperCase();
    const ch = candidateHash ?? activeCandidateBySession.get(sid) ?? '';
    const client = supabase();
    if (!client) { ensureMemSeeded(); return mem.states.get(`${sid}:${ch || 'anonymous'}`) || null; }
    const { data, error } = await client.from('student_states').select('state').eq('session_id', sid).eq('candidate_hash', ch || 'anonymous').maybeSingle();
    if (error) throwSupabase(error, 'Unable to load student state.');
    return data?.state || null;
  };
  const saveStudentState = async (sessionId, candidateHashOrValue, maybeValue) => {
    const sid = String(sessionId).toUpperCase();
    const legacy = maybeValue === undefined;
    const candidateHash = legacy ? (activeCandidateBySession.get(sid) || '') : candidateHashOrValue;
    const value = legacy ? candidateHashOrValue : maybeValue;
    if (candidateHash && value?.startedAt && await isAttemptInvalidated(sid, candidateHash, value.startedAt)) return false;
    const key = String(candidateHash || 'anonymous');
    const client = supabase();
    if (!client) { ensureMemSeeded(); mem.states.set(`${sid}:${key}`, value); }
    else {
      const { error } = await client.from('student_states').upsert({ session_id: sid, candidate_hash: key, state: value, updated_at: Date.now() }, { onConflict: 'session_id,candidate_hash' });
      throwSupabase(error, 'Unable to save student state.');
    }
    if (candidateHash) activeCandidateBySession.set(sid, String(candidateHash));
    return true;
  };
  const clearStudentState = async (sessionId, candidateHash) => {
    const sid = String(sessionId).toUpperCase();
    const ch = String(candidateHash ?? activeCandidateBySession.get(sid) ?? 'anonymous');
    const client = supabase();
    if (!client) { ensureMemSeeded(); mem.states.delete(`${sid}:${ch}`); return; }
    const { error } = await client.from('student_states').delete().eq('session_id', sid).eq('candidate_hash', ch);
    throwSupabase(error, 'Unable to clear student state.');
  };

  // --- ephemeral auth pointers (memory only) ---
  const setActiveCandidate = (sessionId, candidateHash) => {
    const sid = String(sessionId).toUpperCase();
    if (candidateHash) activeCandidateBySession.set(sid, String(candidateHash));
    else activeCandidateBySession.delete(sid);
  };
  const getActiveCandidate = (sessionId) => activeCandidateBySession.get(String(sessionId).toUpperCase()) || '';
  const clearActiveCandidate = (sessionId) => { activeCandidateBySession.delete(String(sessionId).toUpperCase()); };
  const setStudentAuth = (studentHash) => { const value = String(studentHash || ''); if (!value) throw new Error('Student identity is required.'); currentAuthHash = value; return value; };
  const getStudentAuth = () => currentAuthHash || '';
  const clearStudentAuth = () => { currentAuthHash = ''; };

  const resetUnfinishedAttempt = async (sessionId, candidateHash) => {
    const sid = String(sessionId).toUpperCase();
    const attempt = await findAttempt(sid, candidateHash);
    const state = await getStudentState(sid, candidateHash);
    if (attempt?.submittedAt || state?.submittedAt) throw new Error('Submitted attempts require the rewrite action so their audit history is preserved.');
    if (!attempt && !state?.startedAt) throw new Error('No unfinished attempt was found for this candidate.');
    const resetAt = Date.now();
    const client = supabase();
    if (!client) {
      ensureMemSeeded();
      mem.resets.set(`${sid}:${candidateHash}`, resetAt);
      for (const [key, item] of mem.attempts) { if (item.sessionId === sid && item.candidateHash === candidateHash && !item.rewriteArchivedAt) mem.attempts.delete(key); }
      mem.states.delete(`${sid}:${candidateHash}`);
    } else {
      const { error: resetError } = await client.from('attempt_reset_markers').upsert({ session_id: sid, candidate_hash: candidateHash, reset_at: resetAt }, { onConflict: 'session_id,candidate_hash' });
      throwSupabase(resetError, 'Unable to reset attempt.');
      const { error: delError } = await client.from('exam_attempts').delete().eq('session_id', sid).eq('candidate_hash', candidateHash).is('rewrite_archived_at', null);
      throwSupabase(delError, 'Unable to reset attempt.');
      await clearStudentState(sid, candidateHash);
    }
    if (getActiveCandidate(sid) === candidateHash) { clearActiveCandidate(sid); clearStudentAuth(); }
    return { ...(attempt || { sessionId: sid, candidateHash, studentName: state?.studentName || '' }), resetAt };
  };
  const authorizeRewrite = async (sessionId, candidateHash) => {
    const sid = String(sessionId).toUpperCase();
    const attempt = await findAttempt(sid, candidateHash);
    if (!attempt?.submittedAt) throw new Error('Only a submitted attempt can be opened for a rewrite.');
    const resetAt = Date.now();
    const archiveSuffix = `rewrite-${resetAt.toString(36)}`;
    const archived = normalizeAttempt({ ...attempt, id: `${attempt.id}-${archiveSuffix}`, attemptHash: `${attempt.attemptHash}:${archiveSuffix}`, candidateHash: `${attempt.candidateHash}:${archiveSuffix}`, rewriteSourceAttemptHash: attempt.candidateHash, rewriteArchivedAt: resetAt });
    const client = supabase();
    if (!client) {
      ensureMemSeeded();
      for (const [key, item] of mem.attempts) { if (item.attemptHash === attempt.attemptHash) mem.attempts.delete(key); }
      mem.attempts.set(archived.attemptHash, archived);
      mem.resets.set(`${sid}:${candidateHash}`, resetAt);
      mem.states.delete(`${sid}:${candidateHash}`);
    } else {
      const { error: insError } = await client.from('exam_attempts').insert(attemptToRow(archived));
      throwSupabase(insError, 'Unable to archive attempt.');
      const { error: delError } = await client.from('exam_attempts').delete().eq('attempt_hash', attempt.attemptHash);
      throwSupabase(delError, 'Unable to archive attempt.');
      const { error: resetError } = await client.from('attempt_reset_markers').upsert({ session_id: sid, candidate_hash: candidateHash, reset_at: resetAt }, { onConflict: 'session_id,candidate_hash' });
      throwSupabase(resetError, 'Unable to authorize rewrite.');
      await clearStudentState(sid, candidateHash);
    }
    if (getActiveCandidate(sid) === candidateHash) { clearActiveCandidate(sid); clearStudentAuth(); }
    return archived;
  };

  // --- background markers (timer reconciliation; Supabase-backed) ---
  const getBackgroundMarker = async (sessionId, candidateHash) => {
    const sid = String(sessionId).toUpperCase();
    const ch = String(candidateHash || '');
    const client = supabase();
    if (!client) { ensureMemSeeded(); return mem.background.get(`${sid}:${ch}`) || null; }
    const { data, error } = await client.from('background_markers').select('marker').eq('session_id', sid).eq('candidate_hash', ch).maybeSingle();
    if (error) throwSupabase(error, 'Unable to load background marker.');
    return data?.marker || null;
  };
  const setBackgroundMarker = async (sessionId, candidateHash, marker) => {
    const sid = String(sessionId).toUpperCase();
    const ch = String(candidateHash || '');
    if (!ch || !sid) return;
    const client = supabase();
    if (!client) { ensureMemSeeded(); mem.background.set(`${sid}:${ch}`, marker); return; }
    const { error } = await client.from('background_markers').upsert({ session_id: sid, candidate_hash: ch, marker, updated_at: Date.now() }, { onConflict: 'session_id,candidate_hash' });
    throwSupabase(error, 'Unable to save background marker.');
  };
  const clearBackgroundMarker = async (sessionId, candidateHash) => {
    const sid = String(sessionId).toUpperCase();
    const ch = String(candidateHash || '');
    const client = supabase();
    if (!client) { ensureMemSeeded(); mem.background.delete(`${sid}:${ch}`); return; }
    const { error } = await client.from('background_markers').delete().eq('session_id', sid).eq('candidate_hash', ch);
    throwSupabase(error, 'Unable to clear background marker.');
  };

  // --- student profiles (Supabase; single "current" profile tracked in memory) ---
  let currentProfileHash = '';
  const getStudentProfile = async () => {
    if (!currentProfileHash) return null;
    const client = supabase();
    if (!client) { ensureMemSeeded(); return mem.profiles.get(currentProfileHash) || null; }
    const { data, error } = await client.from('student_profiles').select('*').eq('student_hash', currentProfileHash).maybeSingle();
    if (error) throwSupabase(error, 'Unable to load student profile.');
    if (!data) return null;
    return { firstName: data.first_name, lastName: data.last_name, fullName: data.full_name, candidateHash: data.candidate_hash, studentHash: data.student_hash, phone: data.phone, guardian: data.guardian, currentClassId: data.current_class_id, academicSession: data.academic_session, updatedAt: data.updated_at };
  };
  const saveStudentProfile = async (input = {}) => {
    const profile = { firstName: sanitizeName(input.firstName).split(' ')[0] || '', lastName: sanitizeName(input.lastName).split(' ').slice(-1)[0] || '', fullName: sanitizeName(input.fullName || `${input.firstName || ''} ${input.lastName || ''}`), candidateHash: String(input.candidateHash || ''), studentHash: String(input.studentHash || input.candidateHash || ''), phone: String(input.phone || '').trim().slice(0, 24), guardian: sanitizeName(input.guardian || ''), currentClassId: String(input.currentClassId || ''), academicSession: String(input.academicSession || ACADEMIC_SESSION), updatedAt: Date.now() };
    if (!profile.firstName || !profile.lastName || !profile.candidateHash || !profile.studentHash) throw new Error('First name, last name and candidate identity are required.');
    const client = supabase();
    if (!client) { ensureMemSeeded(); mem.profiles.set(profile.studentHash, profile); }
    else {
      const { error } = await client.from('student_profiles').upsert({ student_hash: profile.studentHash, candidate_hash: profile.candidateHash, first_name: profile.firstName, last_name: profile.lastName, full_name: profile.fullName, phone: profile.phone, guardian: profile.guardian, current_class_id: profile.currentClassId, academic_session: profile.academicSession, updated_at: profile.updatedAt }, { onConflict: 'student_hash' });
      throwSupabase(error, 'Unable to save student profile.');
    }
    currentProfileHash = profile.studentHash;
    return profile;
  };
  const clearStudentProfile = async () => { currentProfileHash = ''; };

  // --- users / classes (live records only — never demo data) ---
  const listClasses = async () => {
    const client = supabase();
    if (!client) { ensureMemSeeded(); return [...mem.classes.values()]; }
    const { data, error } = await client.from('classes').select('*');
    throwSupabase(error, 'Unable to list classes.');
    // Live database is the source of truth — no demo records are merged in.
    return (data || []).map((r) => ({ id: r.id, classLevel: r.class_level, name: r.name, stream: r.stream, group: r.grp, capacity: r.capacity, room: r.room, academicSession: r.academic_session, status: r.status }));
  };
  const saveClass = async (input = {}) => {
    const classLevel = String(input.classLevel || '');
    const stream = String(input.stream || input.group || 'General').trim().slice(0, 40);
    const name = String(input.name || `${classLevel} ${stream}`).trim().slice(0, 60);
    if (!name || !['SS1', 'SS2', 'SS3'].includes(classLevel)) throw new Error('Class name and level are required.');
    const item = { id: String(input.id || makeId()).slice(0, 24), classLevel, name, stream, group: String(input.group || stream).slice(0, 40), capacity: clamp(Math.round(Number(input.capacity) || 40), 1, 500), room: String(input.room || '').trim().slice(0, 50), academicSession: String(input.academicSession || ACADEMIC_SESSION), status: input.status === 'archived' ? 'archived' : 'active' };
    const client = supabase();
    if (!client) { ensureMemSeeded(); mem.classes.set(item.id, item); return item; }
    const { error } = await client.from('classes').upsert({ id: item.id, class_level: item.classLevel, name: item.name, stream: item.stream, grp: item.group, capacity: item.capacity, room: item.room, academic_session: item.academicSession, status: item.status }, { onConflict: 'id' });
    throwSupabase(error, 'Unable to save class.');
    return item;
  };
  const deleteClass = async (classId) => {
    const client = supabase();
    if (!client) { ensureMemSeeded(); mem.classes.delete(classId); for (const [k, g] of mem.whatsapp) { if (g.classId === classId) mem.whatsapp.delete(k); } return; }
    const { error } = await client.from('classes').delete().eq('id', classId);
    throwSupabase(error, 'Unable to delete class.');
    await client.from('whatsapp_groups').delete().eq('class_id', classId);
  };
  const listUsers = async () => {
    const client = supabase();
    if (!client) { ensureMemSeeded(); return [...mem.users.values()]; }
    const { data, error } = await client.from('app_users').select('*');
    throwSupabase(error, 'Unable to list users.');
    // Live database is the source of truth — no demo records are merged in.
    return (data || []).map((r) => ({ id: r.id, fullName: r.full_name, firstName: r.first_name, lastName: r.last_name, classId: r.class_id, role: r.role, status: r.status, guardian: r.guardian, academicSession: r.academic_session, promotionStatus: r.promotion_status, joinedAt: r.joined_at }));
  };
  const saveUser = async (input = {}) => {
    const fullName = sanitizeName(input.fullName || `${input.firstName || ''} ${input.lastName || ''}`);
    const parts = fullName.split(/\s+/u).filter(Boolean);
    if (parts.length < 2) throw new Error('Enter at least first and last name for the user.');
    const item = { id: String(input.id || `ST-${Math.floor(1000 + Math.random() * 9000)}`).slice(0, 24), fullName, firstName: sanitizeName(input.firstName || parts[0]).split(' ')[0], lastName: sanitizeName(input.lastName || parts.at(-1)).split(' ').at(-1), classId: String(input.classId || ''), role: ['student', 'teacher', 'administrator'].includes(input.role) ? input.role : 'student', status: input.status === 'inactive' ? 'inactive' : 'active', guardian: sanitizeName(input.guardian || ''), academicSession: String(input.academicSession || ACADEMIC_SESSION), promotionStatus: String(input.promotionStatus || 'on-track'), joinedAt: Number(input.joinedAt) || Date.now() };
    const client = supabase();
    if (!client) { ensureMemSeeded(); mem.users.set(item.id, item); return item; }
    const { error } = await client.from('app_users').upsert({ id: item.id, full_name: item.fullName, first_name: item.firstName, last_name: item.lastName, class_id: item.classId, role: item.role, status: item.status, guardian: item.guardian, academic_session: item.academicSession, promotion_status: item.promotionStatus, joined_at: item.joinedAt }, { onConflict: 'id' });
    throwSupabase(error, 'Unable to save user.');
    return item;
  };
  const updateUserStatus = async (userId, status) => {
    const users = await listUsers();
    const found = users.find((e) => e.id === userId);
    if (!found) return null;
    return saveUser({ ...found, status: status === 'inactive' ? 'inactive' : 'active' });
  };
  const updatePromotion = async (userId, promotionStatus, classId = null) => {
    const users = await listUsers();
    const found = users.find((e) => e.id === userId);
    if (!found) return null;
    return saveUser({ ...found, promotionStatus, classId: classId || found.classId });
  };
  const deleteUser = async (userId) => {
    const client = supabase();
    if (!client) { ensureMemSeeded(); mem.users.delete(userId); return; }
    const { error } = await client.from('app_users').delete().eq('id', userId);
    throwSupabase(error, 'Unable to delete user.');
  };

  // --- custom questions / overrides ---
  const listCustomQuestions = async () => {
    const client = supabase();
    if (!client) { ensureMemSeeded(); return [...mem.customQuestions.values()]; }
    const { data, error } = await client.from('custom_questions').select('*').limit(250);
    throwSupabase(error, 'Unable to list custom questions.');
    return (data || []).map((r) => r.data);
  };
  const saveCustomQuestion = async (input = {}) => {
    const existing = await listCustomQuestions();
    const supplied = input.id === undefined || input.id === null || input.id === '' ? null : Number(input.id);
    let id = supplied;
    if (id === null) {
      const ids = new Set(existing.map((item) => Number(item.id)));
      id = Math.max(1000000, ...ids, 999999) + 1;
      while (ids.has(id)) id += 1;
    }
    if (!Number.isInteger(id) || id < 1) throw new Error('Teacher-authored question id must be a positive integer.');
    const duplicate = existing.find((entry) => Number(entry.id) === id);
    if (duplicate && Number(input.id) === id && !input.custom) throw new Error(`Teacher-authored question id ${id} already exists.`);
    const q = { ...input, id, custom: true, source: 'teacher' };
    const client = supabase();
    if (!client) { ensureMemSeeded(); mem.customQuestions.set(id, q); return q; }
    const { error } = await client.from('custom_questions').upsert({ id, data: q }, { onConflict: 'id' });
    throwSupabase(error, 'Unable to save custom question.');
    return q;
  };
  const deleteCustomQuestion = async (questionId) => {
    const client = supabase();
    if (!client) { ensureMemSeeded(); mem.customQuestions.delete(Number(questionId)); return; }
    const { error } = await client.from('custom_questions').delete().eq('id', Number(questionId));
    throwSupabase(error, 'Unable to delete custom question.');
  };
  const listQuestionOverrides = async () => {
    const client = supabase();
    if (!client) { ensureMemSeeded(); return [...mem.overrides.values()]; }
    const { data, error } = await client.from('question_overrides').select('*').limit(720);
    throwSupabase(error, 'Unable to list question overrides.');
    return (data || []).map((r) => ({ questionId: Number(r.question_id), patch: r.patch, updatedAt: r.updated_at }));
  };
  const saveQuestionOverride = async (questionId, patch = {}) => {
    const id = Number(questionId);
    if (!Number.isInteger(id) || id < 1) throw new Error('Question override requires a positive integer seed id.');
    if (!patch || typeof patch !== 'object' || Array.isArray(patch)) throw new Error('Question override patch must be an object.');
    if (Object.hasOwn(patch, 'id') && Number(patch.id) !== id) throw new Error('A seed override cannot change the question id.');
    const safePatch = JSON.parse(JSON.stringify({ ...patch, id: undefined }));
    delete safePatch.id;
    const item = { questionId: id, patch: safePatch, updatedAt: Date.now() };
    const client = supabase();
    if (!client) { ensureMemSeeded(); mem.overrides.set(id, item); return item; }
    const { error } = await client.from('question_overrides').upsert({ question_id: id, patch: safePatch, updated_at: item.updatedAt }, { onConflict: 'question_id' });
    throwSupabase(error, 'Unable to save question override.');
    return item;
  };
  const resetQuestionOverride = async (questionId) => {
    const client = supabase();
    if (!client) { ensureMemSeeded(); mem.overrides.delete(Number(questionId)); return; }
    const { error } = await client.from('question_overrides').delete().eq('question_id', Number(questionId));
    throwSupabase(error, 'Unable to reset question override.');
  };

  // --- question bank (seed questions + catalogue live in Supabase) ---
  // Runtime source of truth. Admin "Load question bank" populates
  // these tables; questions.load() reads from here, never from the seed file.
  const getQuestionBankStatus = async () => {
    const client = supabase();
    if (!client) {
      ensureMemSeeded();
      return { backend: 'memory', configured: false, meta: mem.qbankMeta, questionCount: mem.qbankItems.size, syncedAt: mem.qbankMeta?.updatedAt || null };
    }
    const { data: meta, error: metaError } = await client.from('question_bank_meta').select('*').eq('id', 1).maybeSingle();
    if (metaError && metaError.code !== 'PGRST205') throwSupabase(metaError, 'Unable to load question bank status.');
    let questionCount = 0;
    if (!metaError) {
      const { count, error: countError } = await client.from('question_bank_items').select('id', { count: 'exact', head: true });
      if (countError && countError.code !== 'PGRST205') throwSupabase(countError, 'Unable to count question bank.');
      questionCount = count || 0;
    }
    return { backend: 'supabase', configured: true, meta: meta || null, questionCount, syncedAt: meta?.updated_at || null, missingTables: Boolean(metaError) };
  };
  const loadQuestionBankFromDb = async () => {
    const client = supabase();
    if (!client) {
      ensureMemSeeded();
      if (!mem.qbankMeta) return null;
      return { questionSetId: mem.qbankMeta.questionSetId, subjectCatalog: mem.qbankMeta.subjectCatalog, assessmentAlignment: mem.qbankMeta.assessmentAlignment, questions: [...mem.qbankItems.values()].map((r) => r.data) };
    }
    const { data: meta, error: metaError } = await client.from('question_bank_meta').select('*').eq('id', 1).maybeSingle();
    if (metaError) {
      if (metaError.code === 'PGRST205') return null; // migration not run yet
      throwSupabase(metaError, 'Unable to load question bank.');
    }
    if (!meta) return null;
    const questions = [];
    const pageSize = 1000;
    let from = 0;
    for (;;) {
      const { data: rows, error } = await client.from('question_bank_items').select('data').order('id', { ascending: true }).range(from, from + pageSize - 1);
      if (error) throwSupabase(error, 'Unable to load question bank items.');
      (rows || []).forEach((r) => questions.push(r.data));
      if (!rows || rows.length < pageSize) break;
      from += pageSize;
    }
    return { questionSetId: meta.question_set_id, subjectCatalog: meta.subject_catalog, assessmentAlignment: meta.assessment_alignment, questions };
  };
  const syncQuestionBank = async (payload) => {
    if (!payload || !payload.questionSetId || !Array.isArray(payload.questions) || !payload.questions.length) throw new Error('Question payload is empty.');
    if (!Array.isArray(payload.subjectCatalog) || !payload.subjectCatalog.length) throw new Error('Subject catalogue is missing.');
    const now = Date.now();
    const meta = { questionSetId: payload.questionSetId, subjectCatalog: payload.subjectCatalog, assessmentAlignment: payload.assessmentAlignment || null, questionCount: payload.questions.length, updatedAt: now };
    const client = supabase();
    if (!client) {
      ensureMemSeeded();
      mem.qbankMeta = meta;
      mem.qbankItems.clear();
      payload.questions.forEach((q) => mem.qbankItems.set(Number(q.id), { data: q }));
      return { ...meta, backend: 'memory' };
    }
    const { error: metaError } = await client.from('question_bank_meta').upsert({ id: 1, question_set_id: meta.questionSetId, subject_catalog: meta.subjectCatalog, assessment_alignment: meta.assessmentAlignment, question_count: meta.questionCount, updated_at: now }, { onConflict: 'id' });
    throwSupabase(metaError, 'Unable to sync question catalogue. Run migration_question_bank.sql first.');
    const rows = payload.questions.map((q) => ({ id: Number(q.id), data: q, subject_code: String(q.subjectCode || ''), updated_at: now }));
    for (let i = 0; i < rows.length; i += 500) {
      const { error } = await client.from('question_bank_items').upsert(rows.slice(i, i + 500), { onConflict: 'id' });
      throwSupabase(error, 'Unable to sync question items.');
    }
    return { ...meta, backend: 'supabase' };
  };

  // --- whatsapp ---
  const normalizeWhatsAppUrl = (value) => {
    let url;
    try { url = new URL(String(value || '').trim()); } catch { throw new Error('Enter a valid WhatsApp group invite link.'); }
    const host = url.hostname.toLowerCase();
    if (url.protocol !== 'https:' || !['chat.whatsapp.com', 'www.whatsapp.com', 'whatsapp.com'].includes(host)) throw new Error('Use a secure WhatsApp group invite link from chat.whatsapp.com.');
    if (host === 'chat.whatsapp.com' && url.pathname.replaceAll('/', '').length < 6) throw new Error('The WhatsApp invite code is incomplete.');
    return url.href;
  };
  const listWhatsAppGroups = async () => {
    const client = supabase();
    if (!client) { ensureMemSeeded(); return [...mem.whatsapp.values()]; }
    const { data, error } = await client.from('whatsapp_groups').select('*').limit(80);
    throwSupabase(error, 'Unable to list WhatsApp groups.');
    return (data || []).map((r) => ({ id: r.id, classId: r.class_id, name: r.name, inviteUrl: r.invite_url, createdAt: r.created_at, updatedAt: r.updated_at }));
  };
  const saveWhatsAppGroup = async (input = {}) => {
    const classId = String(input.classId || '');
    const classes = await listClasses();
    const cls = classes.find((item) => item.id === classId);
    if (!cls) throw new Error('Choose an existing class for this WhatsApp group.');
    const item = { id: String(input.id || makeId()).slice(0, 24), classId, name: sanitizeTitle(input.name || `${cls.name} Parents`), inviteUrl: normalizeWhatsAppUrl(input.inviteUrl), createdAt: Number(input.createdAt) || Date.now(), updatedAt: Date.now() };
    const client = supabase();
    if (!client) {
      ensureMemSeeded();
      for (const [k, g] of mem.whatsapp) { if (g.id === item.id || g.classId === classId) mem.whatsapp.delete(k); }
      mem.whatsapp.set(item.id, item);
      return item;
    }
    const current = await listWhatsAppGroups();
    for (const g of current) {
      if (g.classId === classId && g.id !== item.id) await client.from('whatsapp_groups').delete().eq('id', g.id);
    }
    const { error } = await client.from('whatsapp_groups').upsert({ id: item.id, class_id: item.classId, name: item.name, invite_url: item.inviteUrl, created_at: item.createdAt, updated_at: item.updatedAt }, { onConflict: 'id' });
    throwSupabase(error, 'Unable to save WhatsApp group.');
    return item;
  };
  const deleteWhatsAppGroup = async (groupId) => {
    const client = supabase();
    if (!client) { ensureMemSeeded(); mem.whatsapp.delete(groupId); return; }
    const { error } = await client.from('whatsapp_groups').delete().eq('id', groupId);
    throwSupabase(error, 'Unable to delete WhatsApp group.');
  };
  const whatsAppGroupForClass = async (classId) => (await listWhatsAppGroups()).find((item) => item.classId === classId) || null;

  const clearSessions = async () => {
    const client = supabase();
    if (!client) { ensureMemSeeded(); mem.sessions.clear(); return; }
    const { error } = await client.from('exam_sessions').delete().neq('id', '__none__');
    throwSupabase(error, 'Unable to clear sessions.');
  };
  const clearAttempts = async () => {
    const client = supabase();
    if (!client) { ensureMemSeeded(); mem.attempts.clear(); return; }
    const { error } = await client.from('exam_attempts').delete().neq('attempt_hash', '__none__');
    throwSupabase(error, 'Unable to clear attempts.');
  };
  const clearAllStudentStates = async () => {
    const client = supabase();
    if (!client) {
      ensureMemSeeded();
      const count = mem.states.size + mem.resets.size;
      mem.states.clear(); mem.resets.clear(); mem.background.clear();
      activeCandidateBySession.clear(); currentAuthHash = '';
      return count;
    }
    await client.from('student_states').delete().neq('session_id', '__none__');
    await client.from('attempt_reset_markers').delete().neq('session_id', '__none__');
    await client.from('background_markers').delete().neq('session_id', '__none__');
    activeCandidateBySession.clear(); currentAuthHash = '';
    return 0;
  };
  const clearPrototypeData = async () => {
    await clearAllStudentStates();
    await clearSessions();
    await clearAttempts();
    await clearStudentProfile();
    const client = supabase();
    if (!client) {
      ensureMemSeeded();
      mem.users.clear(); mem.classes.clear(); mem.customQuestions.clear(); mem.overrides.clear(); mem.whatsapp.clear(); mem.proctor.clear();
      mem.seeded = false;
      return 0;
    }
    await client.from('app_users').delete().neq('id', '__none__');
    await client.from('classes').delete().neq('id', '__none__');
    await client.from('custom_questions').delete().neq('id', -1);
    await client.from('question_overrides').delete().neq('question_id', -1);
    await client.from('whatsapp_groups').delete().neq('id', '__none__');
    await client.from('student_profiles').delete().neq('student_hash', '__none__');
    await client.from('proctor_policies').delete().neq('session_id', '__none__');
    return 0;
  };

  // Test/compat helper: direct in-memory seeding without touching Supabase.
  const __seedMemory = (kind, value) => {
    ensureMemSeeded();
    if (kind === 'session') { mem.sessions.set(value.id, { ...value }); return; }
    if (kind === 'customQuestions') mem.customQuestions.set(Number(value.id), value);
  };

  const store = Object.freeze({
    PAYLOAD_VERSION, MODE_LABELS, TRACKS, ACADEMIC_SESSION,
    normalizeSession, encodeSession, decodeSession, getSessionLink, resolveSession,
    findSessionById, listSessions, saveSession, updateSessionStatus, deleteSession,
    normalizeAttempt, getAttempts, recordAttempt, findAttempt, attemptsForCandidate,
    attemptsForStudent, attemptsForSession, hasSubmittedAttempt,
    resetUnfinishedAttempt, authorizeRewrite,
    getStudentState, saveStudentState, clearStudentState,
    getBackgroundMarker, setBackgroundMarker, clearBackgroundMarker,
    setActiveCandidate, getActiveCandidate, clearActiveCandidate,
    setStudentAuth, getStudentAuth, clearStudentAuth,
    getAttemptResetAt, isAttemptInvalidated,
    getStudentProfile, saveStudentProfile, clearStudentProfile,
    clearSessions, clearAttempts, clearAllStudentStates, clearPrototypeData,
    sanitizeName, sanitizeTitle, getModeLabel, durationLabel,
    listClasses, saveClass, deleteClass, listUsers, saveUser,
    updateUserStatus, updatePromotion, deleteUser,
    listCustomQuestions, saveCustomQuestion, deleteCustomQuestion,
    listQuestionOverrides, saveQuestionOverride, resetQuestionOverride,
    getQuestionBankStatus, loadQuestionBankFromDb, syncQuestionBank,
    listWhatsAppGroups, saveWhatsAppGroup, deleteWhatsAppGroup, whatsAppGroupForClass,
    backendName, __seedMemory
  });

  const proctor = (() => {
    const bool = (value) => value === true || value === 1 || value === '1' || value === 'true';
    const readPayload = (token) => { try { return JSON.parse(base64UrlToUtf8(token)); } catch { return null; } };
    const writePayload = (payload) => utf8ToBase64Url(JSON.stringify(payload));
    const getAdminPolicy = async (sessionId) => {
      if (!sessionId) return { cameraRequired: false };
      const sid = String(sessionId).toUpperCase();
      const client = supabase();
      if (!client) { ensureMemSeeded(); return { cameraRequired: bool(mem.proctor.get(sid)?.cameraRequired) }; }
      const { data, error } = await client.from('proctor_policies').select('*').eq('session_id', sid).maybeSingle();
      if (error) throwSupabase(error, 'Unable to load proctor policy.');
      return { cameraRequired: bool(data?.camera_required) };
    };
    const setAdminPolicy = async (sessionId, policy = {}) => {
      if (!sessionId) throw new Error('Session id is required for proctoring policy.');
      const sid = String(sessionId).toUpperCase();
      const normalized = { cameraRequired: bool(policy.cameraRequired), updatedAt: Date.now() };
      const client = supabase();
      if (!client) { ensureMemSeeded(); mem.proctor.set(sid, normalized); return normalized; }
      const { error } = await client.from('proctor_policies').upsert({ session_id: sid, camera_required: normalized.cameraRequired, updated_at: normalized.updatedAt }, { onConflict: 'session_id' });
      throwSupabase(error, 'Unable to save proctor policy.');
      return normalized;
    };
    const policyFromUrl = (href = global.location?.href || 'http://localhost/prototype/index.html') => {
      const url = new URL(href, global.location?.href || 'http://localhost/prototype/index.html');
      const payload = readPayload(url.searchParams.get('session'));
      if (payload && Object.hasOwn(payload, 'p')) return { cameraRequired: payload.p === 1 || payload.p === true };
      const legacyValue = url.searchParams.get('camera');
      if (legacyValue !== null) return { cameraRequired: legacyValue === '1' || legacyValue === 'true' };
      return null;
    };
    const rememberFromUrl = async (sessionId, href = global.location?.href || 'http://localhost/prototype/index.html') => {
      if (!sessionId) return { cameraRequired: false };
      const sid = String(sessionId).toUpperCase();
      const fromUrl = policyFromUrl(href);
      if (fromUrl) {
        if (fromUrl.cameraRequired) cameraSessionFlags.set(sid, true);
        else cameraSessionFlags.delete(sid);
        return fromUrl;
      }
      if (cameraSessionFlags.get(sid)) return { cameraRequired: true };
      const admin = await getAdminPolicy(sid);
      return { cameraRequired: admin.cameraRequired };
    };
    const isCameraRequired = async (sessionId, href = global.location?.href || 'http://localhost/prototype/index.html') => (await rememberFromUrl(sessionId, href)).cameraRequired;
    const decorateStudentLink = (href, cameraRequired) => {
      const url = new URL(href, global.location?.href || 'http://localhost/prototype/index.html');
      const token = url.searchParams.get('session');
      const payload = readPayload(token);
      if (payload) {
        if (cameraRequired) payload.p = 1;
        else delete payload.p;
        url.searchParams.set('session', writePayload(payload));
      }
      url.searchParams.delete('camera');
      return url.href;
    };
    const sessionIdFromLink = (href) => {
      try {
        const token = new URL(href, global.location?.href || 'http://localhost/prototype/index.html').searchParams.get('session');
        if (!token) return '';
        return decodeSession(token).id || '';
      } catch { return ''; }
    };
    return Object.freeze({ getAdminPolicy, setAdminPolicy, policyFromUrl, rememberFromUrl, isCameraRequired, decorateStudentLink, sessionIdFromLink });
  })();


  const questions = (() => {
    const SUPPORTED_TYPES = new Set(['single', 'multi', 'boolean', 'fill', 'fill-multi']);
    const SUPPORTED_LEVELS = new Set(['SS1', 'SS2', 'SS3']);
    const SUPPORTED_PATHWAYS = new Set(store.TRACKS);
    const SUPPORTED_MODES = new Set(['qualifier', 'mixed', 'single', 'waec']);
    const SUPPORTED_DIFFICULTY = new Set(['easy', 'medium', 'hard']);
    let baseCache = null;

    const fillBlanks = (question) => (Array.isArray(question.fillTemplate) ? question.fillTemplate : []).filter((part) => part?.blank).map((part) => String(part.blank));
    const validateAnswerShape = (q) => {
      if (q.type === 'single' && (!Array.isArray(q.options) || !q.options.includes(q.answer))) throw new Error(`Question ${q.id} has an invalid single-choice answer.`);
      if (q.type === 'boolean' && typeof q.answer !== 'boolean') throw new Error(`Question ${q.id} has an invalid true/false answer.`);
      if (q.type === 'multi' && (!Array.isArray(q.answers) || q.answers.length !== q.requiredSelections || q.answers.some((answer) => !q.options.includes(answer)) || new Set(q.answers.map(normalizeText)).size !== q.answers.length)) throw new Error(`Question ${q.id} has invalid multiple-choice answers.`);
      if (q.type === 'fill' && (!Array.isArray(q.acceptedAnswers) || !q.acceptedAnswers.length || q.acceptedAnswers.some((answer) => Array.isArray(answer) || !normalizeText(answer)))) throw new Error(`Question ${q.id} needs accepted fill answers.`);
      if (q.type === 'fill-multi') {
        const blanks = fillBlanks(q);
        if (!blanks.length || !Array.isArray(q.acceptedAnswers) || q.acceptedAnswers.length !== blanks.length || q.acceptedAnswers.some((entry) => !Array.isArray(entry) || !entry.length || entry.some((answer) => !normalizeText(answer)))) throw new Error(`Question ${q.id} needs accepted fill answers for every blank.`);
      }
    };
    const validateQuestion = (question, ids, subjectCodes) => {
      if (!question || !Number.isInteger(question.id) || ids.has(question.id)) throw new Error('Every question must have a unique integer id.');
      if (!question.subject || !question.subjectCode || !subjectCodes.has(question.subjectCode) || !question.domain || !question.label || !question.prompt || !String(question.explanation || '').trim()) throw new Error(`Question ${question.id} is missing required metadata.`);
      if (!SUPPORTED_TYPES.has(question.type)) throw new Error(`Question ${question.id} has an unsupported response type.`);
      if (!Array.isArray(question.levels) || !question.levels.length || question.levels.some((level) => !SUPPORTED_LEVELS.has(level))) throw new Error(`Question ${question.id} needs valid class levels.`);
      if (!Array.isArray(question.pathways) || !question.pathways.length || question.pathways.some((pathway) => !SUPPORTED_PATHWAYS.has(pathway))) throw new Error(`Question ${question.id} needs valid pathways.`);
      if (!Array.isArray(question.examModes) || !question.examModes.length || question.examModes.some((mode) => !SUPPORTED_MODES.has(mode))) throw new Error(`Question ${question.id} needs valid exam modes.`);
      if (!SUPPORTED_DIFFICULTY.has(question.difficulty)) throw new Error(`Question ${question.id} needs a valid difficulty.`);
      if ((question.type === 'single' || question.type === 'multi') && (!Array.isArray(question.options) || question.options.length < 2 || new Set(question.options.map(normalizeText)).size !== question.options.length)) throw new Error(`Question ${question.id} must provide unique options.`);
      if (question.type === 'multi' && (!Number.isInteger(question.requiredSelections) || question.requiredSelections < 1 || question.requiredSelections > question.options.length)) throw new Error(`Question ${question.id} has an invalid selection count.`);
      if ((question.type === 'fill' || question.type === 'fill-multi') && !fillBlanks(question).length) throw new Error(`Question ${question.id} needs a response blank.`);
      validateAnswerShape(question);
      ids.add(question.id);
    };
    const validatePayload = (payload, { minimumQuestions = 1 } = {}) => {
      if (!payload || !payload.questionSetId || !Array.isArray(payload.questions) || payload.questions.length < minimumQuestions) throw new Error(`Question data must include at least ${minimumQuestions} question${minimumQuestions === 1 ? '' : 's'}.`);
      if (!Array.isArray(payload.subjectCatalog) || !payload.subjectCatalog.length) throw new Error('Question subject catalogue is unavailable.');
      const subjectCodes = new Set();
      for (const subject of payload.subjectCatalog) {
        if (!subject?.code || subjectCodes.has(subject.code) || !subject.label || !Array.isArray(subject.levels) || !subject.levels.length || !Array.isArray(subject.modes) || !subject.modes.length || !Array.isArray(subject.pathways) || !subject.pathways.length) throw new Error('Question subject catalogue contains invalid or duplicate records.');
        subjectCodes.add(subject.code);
      }
      const ids = new Set();
      payload.questions.forEach((question) => validateQuestion(question, ids, subjectCodes));
      return { ...payload, assessmentAlignment: { ...(payload.assessmentAlignment || {}), note: 'Prototype scoring keys are evaluated client-side only to exercise analytics and placement. They are inspectable and are not a security boundary; production answer keys, authentication, scoring and attempt allocation must live on a protected server.' } };
    };
    const routePathway = (session = {}) => {
      const explicit = String(session.pathway || session.stream || '').trim();
      if (SUPPORTED_PATHWAYS.has(explicit)) return explicit;
      const classGroup = String(session.classGroup || '').trim();
      return SUPPORTED_PATHWAYS.has(classGroup) ? classGroup : '';
    };
    const isEligible = (question, session) => {
      if (!question.levels.includes(session.classLevel) || !question.examModes.includes(session.mode)) return false;
      if (session.mode === 'qualifier') {
        if (session.subjects?.length && !session.subjects.includes(question.subjectCode)) return false;
        const requested = uniqueStrings(session.placementTracks).filter((track) => SUPPORTED_PATHWAYS.has(track));
        return !requested.length || requested.some((track) => question.pathways.includes(track));
      }
      if (!session.subjects?.includes(question.subjectCode)) return false;
      const pathway = routePathway(session);
      return !pathway || question.pathways.includes(pathway);
    };
    const validateRoutingCoverage = (payload) => {
      for (const subject of payload.subjectCatalog) {
        for (const level of subject.levels) {
          const modes = subject.modes.filter((mode) => mode !== 'waec' || level === 'SS3');
          for (const mode of modes) {
            const pathways = subject.pathways.length ? subject.pathways : [...store.TRACKS];
            for (const pathway of pathways) {
              const session = { classLevel: level, mode, subjects: [subject.code], classGroup: pathway, placementTracks: [pathway] };
              if (!payload.questions.some((question) => isEligible(question, session))) throw new Error(`Question bank has no eligible inventory for ${subject.code}/${level}/${mode}/${pathway}.`);
            }
          }
        }
      }
      return true;
    };
    // Seed file lives in Next.js public/ (canonical location). The runtime
    // prefers Supabase; these URLs are only the one-time sync source.
    // '/seed/questions.json' works when served from the repo root (Next dev,
    // root static server); '/public/seed/questions.json' covers plain static
    // servers rooted at the repo (e.g. Playwright).
    const seedCandidates = () => {
      const base = global.document?.baseURI || global.location?.href || 'http://localhost/prototype/index.html';
      return ['/seed/questions.json', '/public/seed/questions.json'].map((path) => new URL(path, base).href);
    };
    const applyOverrides = async (payload) => {
      const seedIds = new Set(payload.questions.map((question) => question.id));
      const overrideRecords = await store.listQuestionOverrides();
      for (const record of overrideRecords) {
        if (!seedIds.has(Number(record?.questionId))) throw new Error(`Question override ${record?.questionId} does not match a seed question.`);
      }
      const overrides = new Map(overrideRecords.map((entry) => [Number(entry.questionId), entry]));
      const mergedSeeds = payload.questions.map((question) => {
        const record = overrides.get(question.id);
        if (!record) return { ...question, source: question.source || 'seed' };
        return { ...question, ...(record.patch || {}), id: question.id, source: 'edited-seed' };
      });
      const validCustom = [];
      const quarantinedCustomQuestions = [];
      for (const raw of await store.listCustomQuestions()) {
        if (seedIds.has(Number(raw?.id)) || validCustom.some((item) => item.id === Number(raw?.id))) throw new Error(`Teacher-authored question id ${raw?.id} duplicates an existing question id.`);
        const candidate = { ...raw, custom: true, source: 'teacher' };
        try {
          const ids = new Set(mergedSeeds.map((item) => item.id));
          validateQuestion(candidate, ids, new Set(payload.subjectCatalog.map((item) => item.code)));
          validCustom.push(candidate);
        } catch (error) {
          quarantinedCustomQuestions.push({ ...candidate, validationError: error.message });
        }
      }
      const combined = validatePayload({ ...payload, questions: [...mergedSeeds, ...validCustom] });
      return { ...combined, quarantinedCustomQuestions };
    };
    const loadSeedFile = async () => {
      if (typeof global.fetch !== 'function') throw new Error('Question data cannot be loaded in this environment.');
      let lastError = null;
      for (const url of seedCandidates()) {
        try {
          const response = await global.fetch(url, { headers: { Accept: 'application/json' }, cache: 'no-store' });
          if (response.ok) return response.json();
          lastError = new Error(`Question seed request failed (${response.status}).`);
        } catch (error) { lastError = error; }
      }
      throw lastError || new Error('Question seed file could not be loaded.');
    };
    const load = async () => {
      if (!baseCache) {
        // Primary source: Supabase question bank (populated via Admin sync).
        // The JSON seed file is only the sync source, never the runtime source
        // once the database has been synced.
        let fromDb = null;
        try { fromDb = await store.loadQuestionBankFromDb(); } catch { fromDb = null; }
        if (fromDb && Array.isArray(fromDb.questions) && fromDb.questions.length) {
          baseCache = validatePayload({ ...fromDb, assessmentAlignment: fromDb.assessmentAlignment }, { minimumQuestions: 720 });
          validateRoutingCoverage(baseCache);
        } else {
          const seedJson = await loadSeedFile();
          baseCache = validatePayload(seedJson, { minimumQuestions: 720 });
          validateRoutingCoverage(baseCache);
        }
      }
      const merged = await applyOverrides(baseCache);
      validateRoutingCoverage({ ...merged, questions: merged.questions.filter((question) => !question.custom) });
      return merged;
    };
    const syncSeedFileToDatabase = async () => {
      const seedJson = await loadSeedFile();
      const validated = validatePayload(seedJson, { minimumQuestions: 720 });
      validateRoutingCoverage(validated);
      return store.syncQuestionBank(validated);
    };
    const resetCache = () => { baseCache = null; };
    const availableSubjects = (payload, classLevel, mode, pathway = '') => payload.subjectCatalog.filter((subject) => {
      if (!subject.levels.includes(classLevel)) return false;
      return payload.questions.some((question) => isEligible(question, { classLevel, mode, subjects: [subject.code], classGroup: pathway, placementTracks: pathway ? [pathway] : [] }));
    });
    const eligibleQuestions = (payload, session) => payload.questions.filter((question) => isEligible(question, session));
    const interleaveBySubject = (items, subjectOrder, limit) => { const buckets = new Map(subjectOrder.map((code) => [code, []])); items.forEach((question) => { if (!buckets.has(question.subjectCode)) buckets.set(question.subjectCode, []); buckets.get(question.subjectCode).push(question); }); const orderedCodes = [...buckets.keys()]; const result = []; let cursor = 0; while (result.length < limit && orderedCodes.some((code) => buckets.get(code).length > 0)) { const code = orderedCodes[cursor % orderedCodes.length]; const bucket = buckets.get(code); if (bucket.length > 0) result.push(bucket.shift()); cursor += 1; } return result; };
    const questionsForSession = (payload, session) => { const candidates = eligibleQuestions(payload, session); const limit = Math.min(session.questionCount, candidates.length); if (session.mode === 'single' || session.mode === 'waec') return candidates.slice(0, limit); const subjectOrder = session.subjects?.length ? session.subjects : [...new Set(candidates.map((question) => question.subjectCode))]; return interleaveBySubject(candidates, subjectOrder, limit); };
    const subjectByCode = (payload, code) => payload.subjectCatalog.find((subject) => subject.code === code) || null;
    const questionById = (payload, id) => payload.questions.find((question) => question.id === Number(id)) || null;
    return Object.freeze({ load, syncSeedFileToDatabase, resetCache, validatePayload, validateAnswerShape, validateRoutingCoverage, availableSubjects, eligibleQuestions, questionsForSession, subjectByCode, questionById });
  })();

  const assessment = (() => {
    const TRACKS = Object.freeze(['Science', 'Arts', 'Social Science']);
    const TRACK_WEIGHTS = Object.freeze({ Science: Object.freeze({ 'q-math': 1.5, 'q-bst': 1.55, 'q-digital': 1.05, 'q-eng': .75, 'q-social': .55, 'q-business': .45 }), Arts: Object.freeze({ 'q-eng': 1.55, 'q-social': 1.25, 'q-business': .7, 'q-digital': .55, 'q-math': .55, 'q-bst': .45 }), 'Social Science': Object.freeze({ 'q-social': 1.45, 'q-business': 1.45, 'q-eng': 1.0, 'q-math': .85, 'q-digital': .75, 'q-bst': .55 }) });
    const normalizeNamePart = (value) => String(value ?? '').trim().replace(/[^\p{L}\p{M}' -]/gu, '').replace(/\s+/gu, ' ').slice(0, 40);
    const candidateCredentials = (firstName, lastName) => { const first = normalizeNamePart(firstName); const last = normalizeNamePart(lastName); if (first.length < 2) throw new Error('Enter the student first name.'); if (last.length < 2) throw new Error('Enter the student last name.'); return { firstName: first, lastName: last, fullName: `${first} ${last}` }; };
    const fallbackHash = (value) => { let hashA = 0x811c9dc5; let hashB = 0x9e3779b9; for (let index = 0; index < value.length; index += 1) { const code = value.charCodeAt(index); hashA = Math.imul(hashA ^ code, 0x01000193) >>> 0; hashB = Math.imul(hashB ^ code, 0x85ebca6b) >>> 0; } return `${hashA.toString(16).padStart(8, '0')}${hashB.toString(16).padStart(8, '0')}`; };
    const hashText = async (value) => { const text = String(value); if (global.crypto?.subtle && global.TextEncoder) { const buffer = await global.crypto.subtle.digest('SHA-256', new TextEncoder().encode(text)); return [...new Uint8Array(buffer)].map((byte) => byte.toString(16).padStart(2, '0')).join(''); } return fallbackHash(text).repeat(4).slice(0, 64); };
    const studentHash = async (firstName, lastName) => { const identity = candidateCredentials(firstName, lastName); return hashText(`festacol-student|${normalizeText(identity.firstName)}|${normalizeText(identity.lastName)}`); };
    const candidateHash = async (sessionId, firstName, lastName) => { const identityHash = await studentHash(firstName, lastName); return hashText(`festacol-attempt|${String(sessionId).toUpperCase()}|${identityHash}`); };
    const seedFrom = (value) => { let seed = 2166136261; for (const char of String(value)) seed = Math.imul(seed ^ char.charCodeAt(0), 16777619) >>> 0; return seed || 0x9e3779b9; };
    const rngFor = (seedInput) => { let state = seedFrom(seedInput); return () => { state += 0x6D2B79F5; let value = state; value = Math.imul(value ^ value >>> 15, value | 1); value ^= value + Math.imul(value ^ value >>> 7, value | 61); return ((value ^ value >>> 14) >>> 0) / 4294967296; }; };
    const shuffled = (items, seed) => { const output = [...items]; const random = rngFor(seed); for (let index = output.length - 1; index > 0; index -= 1) { const swap = Math.floor(random() * (index + 1)); [output[index], output[swap]] = [output[swap], output[index]]; } return output; };
    const paperForStudent = (payload, session, studentHashValue) => { const candidates = questions.eligibleQuestions(payload, session); const target = Math.min(Number(session.questionCount) || 0, candidates.length); if (!target) return []; const subjectOrder = session.mode === 'single' || session.mode === 'waec' ? [...new Set(candidates.map((question) => question.subjectCode))] : (session.subjects?.length ? session.subjects : [...new Set(candidates.map((question) => question.subjectCode))]); const randomizeQuestions = session.randomization?.questionOrder !== false; const collisionSalt = session.randomization?.minimizePaperCollisions !== false ? `${studentHashValue}|${session.id}` : String(session.id); const orderedSubjects = randomizeQuestions ? shuffled(subjectOrder, `${collisionSalt}|subjects`) : [...subjectOrder]; const buckets = new Map(orderedSubjects.map((code) => [code, randomizeQuestions ? shuffled(candidates.filter((question) => question.subjectCode === code), `${collisionSalt}|${code}`) : candidates.filter((question) => question.subjectCode === code)])); const selected = []; let cursor = 0; while (selected.length < target && [...buckets.values()].some((bucket) => bucket.length)) { const code = orderedSubjects[cursor % orderedSubjects.length]; const bucket = buckets.get(code); if (bucket?.length) selected.push(bucket.shift()); cursor += 1; } return selected.map((question, index) => { const clone = { ...question }; if (Array.isArray(question.options) && session.randomization?.optionOrder !== false) clone.options = shuffled(question.options, `${studentHashValue}|${session.id}|${question.id}|${index}`); if (Array.isArray(question.fillTemplate)) clone.fillTemplate = question.fillTemplate.map((part) => ({ ...part })); return clone; }); };
    const normalizeBoolean = (value) => { if (value === true || value === false) return value; const text = normalizeText(value); if (text === 'true') return true; if (text === 'false') return false; return null; };
    const matchesAccepted = (value, accepted) => accepted.some((answer) => normalizeText(value) === normalizeText(answer));
    const scoreQuestion = (question, response) => {
      try {
        if (!question || !question.type) return false;
        if (question.type === 'single') return normalizeText(response) !== '' && normalizeText(response) === normalizeText(question.answer);
        if (question.type === 'boolean') { const received = normalizeBoolean(response); return received !== null && received === question.answer; }
        if (question.type === 'multi') {
          if (!Array.isArray(response) || !Array.isArray(question.answers)) return false;
          const received = [...new Set(response.map(normalizeText).filter(Boolean))].sort();
          const expected = [...new Set(question.answers.map(normalizeText).filter(Boolean))].sort();
          return received.length === expected.length && received.every((value, index) => value === expected[index]);
        }
        if (question.type === 'fill') {
          const value = response && typeof response === 'object' && !Array.isArray(response) ? Object.values(response)[0] : response;
          return normalizeText(value) !== '' && Array.isArray(question.acceptedAnswers) && matchesAccepted(value, question.acceptedAnswers);
        }
        if (question.type === 'fill-multi') {
          if (!Array.isArray(question.acceptedAnswers)) return false;
          const blanks = (question.fillTemplate || []).filter((part) => part?.blank).map((part) => String(part.blank));
          const values = Array.isArray(response) ? response : (response && typeof response === 'object' ? blanks.map((key) => response[key]) : []);
          return values.length === question.acceptedAnswers.length && values.every((value, index) => normalizeText(value) !== '' && matchesAccepted(value, question.acceptedAnswers[index] || []));
        }
        return false;
      } catch { return false; }
    };
    const valueIsCorrect = scoreQuestion;
    const answerDisplay = (question) => {
      if (!question) return 'Scoring key unavailable';
      if (question.type === 'multi') return Array.isArray(question.answers) ? question.answers.join(' + ') : 'Scoring key unavailable';
      if (question.type === 'fill') return Array.isArray(question.acceptedAnswers) ? question.acceptedAnswers.join(' / ') : 'Scoring key unavailable';
      if (question.type === 'fill-multi') return Array.isArray(question.acceptedAnswers) ? question.acceptedAnswers.map((answers) => Array.isArray(answers) ? answers.join(' / ') : '').join(' + ') : 'Scoring key unavailable';
      if (question.answer === true) return 'True';
      if (question.answer === false) return 'False';
      return String(question.answer ?? 'Scoring key unavailable');
    };
    function placementFor(result, session) { const enabled = (session.placementTracks || TRACKS).filter((track) => TRACKS.includes(track)); const tracks = enabled.length ? enabled : [...TRACKS]; const stats = new Map(result.subjectStats.map((item) => [item.subjectCode, item.percent])); const scoredTracks = tracks.map((track) => { const weights = TRACK_WEIGHTS[track]; let totalWeight = 0, weighted = 0; Object.entries(weights).forEach(([subjectCode, weight]) => { if (!stats.has(subjectCode)) return; totalWeight += weight; weighted += stats.get(subjectCode) * weight; }); const academic = totalWeight ? weighted / totalWeight : result.accuracy; const score = academic * .82 + result.paceIndex * .08 + result.completion * .08 + result.integrityScore * .02; return { track, score: Math.round(score), academic: Math.round(academic) }; }).sort((a, b) => b.score - a.score); const best = scoredTracks[0], second = scoredTracks[1], gap = second ? best.score - second.score : 15; const confidence = clamp(55 + gap * 3 + Math.round((best.score - 50) * .25), 55, 96); return { assignedTrack: best.track, confidence, trackScores: scoredTracks, basis: 'Assessment accuracy, subject profile, completion, pace and recorded integrity signals', note: 'This is an exam-derived placement recommendation, not a permanent measure of intelligence.' }; }
    const scoreAttempt = (paper, state, session) => { const details = paper.map((question) => { const response = state.responses?.[String(question.id)]; const correct = scoreQuestion(question, response); return { questionId: question.id, subjectCode: question.subjectCode, subject: question.subject, domain: question.domain, correct, response: response ?? null, correctAnswer: answerDisplay(question), seconds: Math.max(0, Number(state.questionTimings?.[String(question.id)]) || 0) }; }); const correctCount = details.filter((item) => item.correct).length; const accuracy = details.length ? Math.round(correctCount / details.length * 100) : 0; const answered = paper.filter((question) => { const value = state.responses?.[String(question.id)]; return Array.isArray(value) ? value.length > 0 : value && typeof value === 'object' ? Object.values(value).some((v) => String(v ?? '').trim()) : value === true || value === false || String(value ?? '').trim().length > 0; }).length; const completion = paper.length ? Math.round(answered / paper.length * 100) : 0; const activeElapsed = Number(state.elapsedActiveSeconds); const elapsedSeconds = Math.max(1, Math.round(Number.isFinite(activeElapsed) && activeElapsed > 0 ? activeElapsed : ((state.submittedAt || Date.now()) - (state.startedAt || Date.now())) / 1000)); const durationSeconds = Math.max(30, Number(session.durationSeconds) || Number(session.durationMinutes) * 60 || 3600); const avgSeconds = paper.length ? Math.round(elapsedSeconds / paper.length) : 0; const expectedPerQuestion = Math.max(10, durationSeconds / Math.max(1, paper.length)); const paceIndex = Math.round(clamp(100 - Math.max(0, avgSeconds - expectedPerQuestion * .55) / expectedPerQuestion * 65, 25, 100)); const integrityEvents = Array.isArray(state.integrityEvents) ? state.integrityEvents : []; const integrityScore = Math.max(0, 100 - integrityEvents.filter((event) => !['focus-return', 'fullscreen-enter'].includes(event.type)).length * 8); const bySubject = {}; for (const item of details) { const bucket = bySubject[item.subjectCode] ||= { subjectCode: item.subjectCode, subject: item.subject, total: 0, correct: 0, seconds: 0 }; bucket.total += 1; if (item.correct) bucket.correct += 1; bucket.seconds += item.seconds; } const subjectStats = Object.values(bySubject).map((bucket) => ({ ...bucket, percent: bucket.total ? Math.round(bucket.correct / bucket.total * 100) : 0 })); const reasoningIndex = Math.round(accuracy * .78 + completion * .14 + paceIndex * .08); const result = { correctCount, scoredCount: details.length, accuracy, completion, elapsedSeconds, avgSeconds, paceIndex, reasoningIndex, integrityScore, integrityEventCount: integrityEvents.length, subjectStats, details }; if (session.mode === 'qualifier') result.placement = placementFor(result, session); return result; };
    const paperFingerprint = async (sessionId, studentHashValue, paper) => hashText(`${sessionId}|${studentHashValue}|${paper.map((question) => `${question.id}:${(question.options || []).join('~')}`).join('|')}`);
    const attemptHash = async (sessionId, studentHashValue, fingerprint) => hashText(`attempt|${sessionId}|${studentHashValue}|${fingerprint}`);
    const answersMayBeRevealed = (session, effectiveStatus = session?.status) => { if (!session) return false; if (effectiveStatus === 'closed') return true; return Boolean(session.endsAt && Date.now() > Number(session.endsAt)); };
    return Object.freeze({ TRACKS, candidateCredentials, studentHash, candidateHash, hashText, paperForStudent, paperFingerprint, attemptHash, scoreQuestion, scoreAttempt, valueIsCorrect, answerDisplay, answersMayBeRevealed });
  })();

  const qr = (() => {
    const TYPE_NUMBER = 15, ERROR_LEVEL = 1, MODULE_COUNT = TYPE_NUMBER * 4 + 17, ALIGNMENT = [6, 26, 48, 70];
    const RS_BLOCKS = [{ total: 109, data: 87 }, { total: 109, data: 87 }, { total: 109, data: 87 }, { total: 109, data: 87 }, { total: 109, data: 87 }, { total: 110, data: 88 }];
    const PAD0 = 0xec, PAD1 = 0x11, G15 = 0x0537, G18 = 0x1f25, G15_MASK = 0x5412;
    const EXP = new Array(512), LOG = new Array(256); for (let i = 0; i < 8; i += 1) EXP[i] = 1 << i; for (let i = 8; i < 256; i += 1) EXP[i] = EXP[i - 4] ^ EXP[i - 5] ^ EXP[i - 6] ^ EXP[i - 8]; for (let i = 0; i < 255; i += 1) LOG[EXP[i]] = i; for (let i = 255; i < 512; i += 1) EXP[i] = EXP[i - 255];
    const gfMul = (a,b) => (!a || !b) ? 0 : EXP[LOG[a] + LOG[b]];
    const polyMultiply = (a,b) => { const out = new Array(a.length+b.length-1).fill(0); for(let i=0;i<a.length;i+=1)for(let j=0;j<b.length;j+=1)out[i+j]^=gfMul(a[i],b[j]); return out; };
    const generatorPolynomial = (degree) => { let poly=[1]; for(let i=0;i<degree;i+=1)poly=polyMultiply(poly,[1,EXP[i]]); return poly; };
    const rsRemainder = (data, degree) => { const generator=generatorPolynomial(degree); const result=[...data,...new Array(degree).fill(0)]; for(let i=0;i<data.length;i+=1){const factor=result[i];if(!factor)continue;for(let j=0;j<generator.length;j+=1)result[i+j]^=gfMul(generator[j],factor);} return result.slice(data.length); };
    class BitBuffer { constructor(){this.bits=[];} put(value,length){for(let i=length-1;i>=0;i-=1)this.bits.push(((value>>>i)&1)===1);} putBytes(bytes){bytes.forEach((byte)=>this.put(byte,8));} toBytes(){const bytes=[];for(let i=0;i<this.bits.length;i+=8){let value=0;for(let j=0;j<8;j+=1)if(this.bits[i+j])value|=0x80>>>j;bytes.push(value);}return bytes;} }
    const dataCodewords = (text) => { const bytes=[...new TextEncoder().encode(text)]; const capacity=RS_BLOCKS.reduce((sum,block)=>sum+block.data,0); if(bytes.length>capacity-4)throw new Error('The generated examination link is too long for the local QR encoder.'); const buffer=new BitBuffer();buffer.put(0b0100,4);buffer.put(bytes.length,16);buffer.putBytes(bytes);const maxBits=capacity*8;const terminator=Math.min(4,maxBits-buffer.bits.length);for(let i=0;i<terminator;i+=1)buffer.bits.push(false);while(buffer.bits.length%8)buffer.bits.push(false);let output=buffer.toBytes();let pad=true;while(output.length<capacity){output.push(pad?PAD0:PAD1);pad=!pad;}return output; };
    const interleave=(data)=>{const dataBlocks=[],ecBlocks=[];let offset=0;RS_BLOCKS.forEach((block)=>{const chunk=data.slice(offset,offset+block.data);offset+=block.data;dataBlocks.push(chunk);ecBlocks.push(rsRemainder(chunk,block.total-block.data));});const out=[];const maxData=Math.max(...dataBlocks.map((block)=>block.length));const maxEc=Math.max(...ecBlocks.map((block)=>block.length));for(let i=0;i<maxData;i+=1)dataBlocks.forEach((block)=>{if(i<block.length)out.push(block[i]);});for(let i=0;i<maxEc;i+=1)ecBlocks.forEach((block)=>{if(i<block.length)out.push(block[i]);});return out;};
    const bchDigit=(value)=>{let digit=0;while(value){digit+=1;value>>>=1;}return digit;}; const bchTypeInfo=(data)=>{let value=data<<10;while(bchDigit(value)-bchDigit(G15)>=0)value^=G15<<(bchDigit(value)-bchDigit(G15));return((data<<10)|value)^G15_MASK;}; const bchTypeNumber=(data)=>{let value=data<<12;while(bchDigit(value)-bchDigit(G18)>=0)value^=G18<<(bchDigit(value)-bchDigit(G18));return(data<<12)|value;};
    const maskValue=(pattern,row,col)=>{switch(pattern){case 0:return(row+col)%2===0;case 1:return row%2===0;case 2:return col%3===0;case 3:return(row+col)%3===0;case 4:return(Math.floor(row/2)+Math.floor(col/3))%2===0;case 5:return((row*col)%2)+((row*col)%3)===0;case 6:return((((row*col)%2)+((row*col)%3))%2)===0;case 7:return((((row*col)%3)+((row+col)%2))%2)===0;default:return false;}};
    const createMatrix=()=>Array.from({length:MODULE_COUNT},()=>new Array(MODULE_COUNT).fill(null));
    const finder=(matrix,row,col)=>{for(let r=-1;r<=7;r+=1){if(row+r<0||row+r>=MODULE_COUNT)continue;for(let c=-1;c<=7;c+=1){if(col+c<0||col+c>=MODULE_COUNT)continue;const dark=(r>=0&&r<=6&&(c===0||c===6))||(c>=0&&c<=6&&(r===0||r===6))||(r>=2&&r<=4&&c>=2&&c<=4);matrix[row+r][col+c]=dark;}}};
    const alignment=(matrix)=>{ALIGNMENT.forEach((row)=>ALIGNMENT.forEach((col)=>{if(matrix[row][col]!==null)return;for(let r=-2;r<=2;r+=1)for(let c=-2;c<=2;c+=1)matrix[row+r][col+c]=Math.abs(r)===2||Math.abs(c)===2||(r===0&&c===0);}));};
    const timing=(matrix)=>{for(let i=8;i<MODULE_COUNT-8;i+=1){if(matrix[i][6]===null)matrix[i][6]=i%2===0;if(matrix[6][i]===null)matrix[6][i]=i%2===0;}};
    const typeInfo=(matrix,test,pattern)=>{const bits=bchTypeInfo((ERROR_LEVEL<<3)|pattern);for(let i=0;i<15;i+=1){const dark=!test&&((bits>>i)&1)===1;if(i<6)matrix[i][8]=dark;else if(i<8)matrix[i+1][8]=dark;else matrix[MODULE_COUNT-15+i][8]=dark;}for(let i=0;i<15;i+=1){const dark=!test&&((bits>>i)&1)===1;if(i<8)matrix[8][MODULE_COUNT-i-1]=dark;else if(i<9)matrix[8][15-i]=dark;else matrix[8][15-i-1]=dark;}matrix[MODULE_COUNT-8][8]=!test;};
    const typeNumber=(matrix,test)=>{const bits=bchTypeNumber(TYPE_NUMBER);for(let i=0;i<18;i+=1){const dark=!test&&((bits>>i)&1)===1;matrix[Math.floor(i/3)][(i%3)+MODULE_COUNT-11]=dark;matrix[(i%3)+MODULE_COUNT-11][Math.floor(i/3)]=dark;}};
    const mapData=(matrix,bytes,pattern)=>{let row=MODULE_COUNT-1,direction=-1,byteIndex=0,bitIndex=7;for(let col=MODULE_COUNT-1;col>0;col-=2){if(col===6)col-=1;while(true){for(let c=0;c<2;c+=1){const targetCol=col-c;if(matrix[row][targetCol]!==null)continue;let dark=false;if(byteIndex<bytes.length)dark=((bytes[byteIndex]>>>bitIndex)&1)===1;if(maskValue(pattern,row,targetCol))dark=!dark;matrix[row][targetCol]=dark;bitIndex-=1;if(bitIndex===-1){byteIndex+=1;bitIndex=7;}}row+=direction;if(row<0||row>=MODULE_COUNT){row-=direction;direction=-direction;break;}}}};
    const buildMatrix=(bytes,pattern,test=false)=>{const matrix=createMatrix();finder(matrix,0,0);finder(matrix,MODULE_COUNT-7,0);finder(matrix,0,MODULE_COUNT-7);alignment(matrix);timing(matrix);typeInfo(matrix,test,pattern);typeNumber(matrix,test);mapData(matrix,bytes,pattern);return matrix;};
    const lostPoint=(matrix)=>{const size=matrix.length;let score=0;for(let row=0;row<size;row+=1){for(let col=0;col<size;col+=1){let same=0;const dark=matrix[row][col];for(let r=-1;r<=1;r+=1)for(let c=-1;c<=1;c+=1){if(!r&&!c)continue;const rr=row+r,cc=col+c;if(rr>=0&&rr<size&&cc>=0&&cc<size&&matrix[rr][cc]===dark)same+=1;}if(same>5)score+=3+same-5;}}for(let row=0;row<size-1;row+=1)for(let col=0;col<size-1;col+=1){const count=Number(matrix[row][col])+Number(matrix[row+1][col])+Number(matrix[row][col+1])+Number(matrix[row+1][col+1]);if(count===0||count===4)score+=3;}for(let row=0;row<size;row+=1)for(let col=0;col<size-6;col+=1)if(matrix[row][col]&&!matrix[row][col+1]&&matrix[row][col+2]&&matrix[row][col+3]&&matrix[row][col+4]&&!matrix[row][col+5]&&matrix[row][col+6])score+=40;for(let col=0;col<size;col+=1)for(let row=0;row<size-6;row+=1)if(matrix[row][col]&&!matrix[row+1][col]&&matrix[row+2][col]&&matrix[row+3][col]&&matrix[row+4][col]&&!matrix[row+5][col]&&matrix[row+6][col])score+=40;let darkCount=0;matrix.forEach((line)=>line.forEach((cell)=>{if(cell)darkCount+=1;}));score+=Math.abs((100*darkCount/size/size)-50)/5*10;return score;};
    const matrixFor=(text)=>{const codewords=interleave(dataCodewords(text));let bestPattern=0,bestScore=Infinity;for(let pattern=0;pattern<8;pattern+=1){const score=lostPoint(buildMatrix(codewords,pattern,true));if(score<bestScore){bestScore=score;bestPattern=pattern;}}return buildMatrix(codewords,bestPattern,false);};
    const svgFor=(text)=>{const matrix=matrixFor(String(text));const margin=4;const size=matrix.length+margin*2;let path='';for(let row=0;row<matrix.length;row+=1)for(let col=0;col<matrix.length;col+=1)if(matrix[row][col])path+=`M${col+margin} ${row+margin}h1v1h-1z`;return `<svg viewBox="0 0 ${size} ${size}" role="img" aria-label="QR code for the dynamic examination link" xmlns="http://www.w3.org/2000/svg"><rect width="${size}" height="${size}" fill="white"/><path d="${path}" fill="black"/></svg>`;};
    const render=(element,text)=>{if(!element)throw new Error('QR target element is missing.');element.innerHTML=svgFor(String(text));const svg=element.querySelector('svg');if(svg)svg.classList.add('h-auto','w-full');};
    return Object.freeze({ render, svgFor });
  })();


  const Festacol = Object.freeze({ store, questions, assessment, proctor, qr, utils });
  win.Festacol = Festacol;
  win.FestacolSessionStore = store;
  win.FestacolQuestionData = questions;
  win.FestacolAssessmentEngine = assessment;
  win.FestacolProctorPolicy = proctor;
  win.FestacolQR = qr;
})();
