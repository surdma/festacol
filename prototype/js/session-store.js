(() => {
  'use strict';

  const SESSION_STORE_KEY = 'festacol.exam.sessions.v2';
  const ATTEMPT_STORE_KEY = 'festacol.exam.attempts.v2';
  const STUDENT_STATE_PREFIX = 'festacol.student.session.v2:';
  const PAYLOAD_VERSION = 2;

  const MODE_LABELS = Object.freeze({
    qualifier: 'SS1 stream qualifier',
    mixed: 'Mixed-subject examination',
    single: 'Single-subject examination',
    waec: 'WAEC subject practice'
  });

  const MODE_CODES = Object.freeze({ qualifier: 'q', mixed: 'm', single: 's', waec: 'w' });
  const CODE_MODES = Object.freeze({ q: 'qualifier', m: 'mixed', s: 'single', w: 'waec' });

  const readJson = (key, fallback) => {
    try {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : fallback;
    } catch {
      return fallback;
    }
  };

  const writeJson = (key, value) => {
    localStorage.setItem(key, JSON.stringify(value));
  };

  const utf8ToBase64Url = (value) => {
    const bytes = new TextEncoder().encode(value);
    let binary = '';
    bytes.forEach((byte) => { binary += String.fromCharCode(byte); });
    return btoa(binary).replaceAll('+', '-').replaceAll('/', '_').replace(/=+$/u, '');
  };

  const base64UrlToUtf8 = (value) => {
    const normalized = value.replaceAll('-', '+').replaceAll('_', '/');
    const padded = normalized + '='.repeat((4 - (normalized.length % 4 || 4)) % 4);
    const binary = atob(padded);
    const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
    return new TextDecoder().decode(bytes);
  };

  const sanitizeTitle = (value) => String(value || '').trim().replace(/\s+/gu, ' ').slice(0, 40);
  const sanitizeName = (value) => String(value || '').trim().replace(/\s+/gu, ' ').slice(0, 80);

  const makeId = () => {
    if (crypto?.randomUUID) return crypto.randomUUID().split('-')[0].toUpperCase();
    return Math.random().toString(36).slice(2, 10).toUpperCase();
  };

  const normalizeSession = (input) => {
    const mode = String(input.mode || '');
    const classLevel = String(input.classLevel || '');
    const subjects = Array.isArray(input.subjects) ? [...new Set(input.subjects.map(String))] : [];
    const durationMinutes = Number(input.durationMinutes);
    const questionCount = Number(input.questionCount);

    if (!Object.hasOwn(MODE_LABELS, mode)) throw new Error('Unsupported examination mode.');
    if (!['SS1', 'SS2', 'SS3'].includes(classLevel)) throw new Error('Choose SS1, SS2, or SS3.');
    if (mode === 'qualifier' && classLevel !== 'SS1') throw new Error('Qualifier sessions are reserved for incoming SS1 candidates.');
    if (mode === 'waec' && classLevel !== 'SS3') throw new Error('WAEC subject practice sessions are configured for SS3.');
    if (mode === 'mixed' && (subjects.length < 2 || subjects.length > 6)) throw new Error('Mixed examinations need between two and six subjects.');
    if ((mode === 'single' || mode === 'waec') && subjects.length !== 1) throw new Error('This examination mode requires exactly one subject.');
    if (!Number.isInteger(durationMinutes) || durationMinutes < 5 || durationMinutes > 240) throw new Error('Duration must be between 5 and 240 minutes.');
    if (!Number.isInteger(questionCount) || questionCount < 1 || questionCount > 100) throw new Error('Question count must be between 1 and 100.');

    return {
      id: String(input.id || makeId()).slice(0, 16),
      version: PAYLOAD_VERSION,
      title: sanitizeTitle(input.title) || MODE_LABELS[mode],
      classLevel,
      mode,
      subjects,
      durationMinutes,
      questionCount,
      status: ['open', 'draft', 'closed'].includes(input.status) ? input.status : 'open',
      instructions: String(input.instructions || '').trim().slice(0, 80),
      startsAt: input.startsAt ? Number(input.startsAt) : null,
      endsAt: input.endsAt ? Number(input.endsAt) : null,
      createdAt: Number(input.createdAt) || Date.now()
    };
  };

  const toPayload = (session) => ({
    v: PAYLOAD_VERSION,
    i: session.id,
    n: session.title,
    c: session.classLevel,
    m: MODE_CODES[session.mode],
    s: session.subjects,
    d: session.durationMinutes,
    q: session.questionCount,
    x: session.status,
    r: session.instructions || undefined,
    a: session.startsAt || undefined,
    z: session.endsAt || undefined
  });

  const fromPayload = (payload) => normalizeSession({
    id: payload.i,
    title: payload.n,
    classLevel: payload.c,
    mode: CODE_MODES[payload.m],
    subjects: payload.s || [],
    durationMinutes: payload.d,
    questionCount: payload.q,
    status: payload.x,
    instructions: payload.r || '',
    startsAt: payload.a || null,
    endsAt: payload.z || null,
    createdAt: Date.now()
  });

  const encodeSession = (sessionInput) => utf8ToBase64Url(JSON.stringify(toPayload(normalizeSession(sessionInput))));

  const decodeSession = (token) => {
    if (!token) throw new Error('No examination session was provided.');
    let parsed;
    try {
      parsed = JSON.parse(base64UrlToUtf8(token));
    } catch {
      throw new Error('This examination link is not valid.');
    }
    if (parsed?.v !== PAYLOAD_VERSION) throw new Error('This examination link uses an unsupported format.');
    return fromPayload(parsed);
  };

  const getSessionLink = (session, baseHref = window.location.href) => {
    const url = new URL('./index.html', baseHref);
    url.search = '';
    url.hash = '';
    url.searchParams.set('session', encodeSession(session));
    return url.href;
  };

  const listSessions = () => {
    const sessions = readJson(SESSION_STORE_KEY, []);
    return Array.isArray(sessions) ? sessions : [];
  };

  const saveSession = (input) => {
    const session = normalizeSession(input);
    const sessions = listSessions();
    const next = [session, ...sessions.filter((item) => item.id !== session.id)].slice(0, 50);
    writeJson(SESSION_STORE_KEY, next);
    return session;
  };

  const updateSessionStatus = (sessionId, status) => {
    if (!['open', 'draft', 'closed'].includes(status)) throw new Error('Unsupported session status.');
    const sessions = listSessions();
    const session = sessions.find((item) => item.id === sessionId);
    if (!session) return null;
    const updated = { ...session, status };
    writeJson(SESSION_STORE_KEY, sessions.map((item) => item.id === sessionId ? updated : item));
    return updated;
  };

  const deleteSession = (sessionId) => {
    const sessions = listSessions().filter((item) => item.id !== sessionId);
    writeJson(SESSION_STORE_KEY, sessions);
  };

  const getAttempts = () => {
    const attempts = readJson(ATTEMPT_STORE_KEY, []);
    return Array.isArray(attempts) ? attempts : [];
  };

  const recordAttempt = (attempt) => {
    const normalized = {
      id: String(attempt.id || makeId()),
      sessionId: String(attempt.sessionId || ''),
      sessionTitle: sanitizeTitle(attempt.sessionTitle),
      studentName: sanitizeName(attempt.studentName),
      classLevel: String(attempt.classLevel || ''),
      mode: String(attempt.mode || ''),
      startedAt: Number(attempt.startedAt) || null,
      submittedAt: Number(attempt.submittedAt) || null,
      answered: Number(attempt.answered) || 0,
      questionCount: Number(attempt.questionCount) || 0
    };
    const attempts = getAttempts();
    writeJson(ATTEMPT_STORE_KEY, [normalized, ...attempts.filter((item) => item.id !== normalized.id)].slice(0, 200));
    return normalized;
  };

  const studentStateKey = (sessionId) => `${STUDENT_STATE_PREFIX}${sessionId}`;
  const getStudentState = (sessionId) => readJson(studentStateKey(sessionId), null);
  const saveStudentState = (sessionId, value) => writeJson(studentStateKey(sessionId), value);
  const clearStudentState = (sessionId) => localStorage.removeItem(studentStateKey(sessionId));

  const getModeLabel = (mode) => MODE_LABELS[mode] || 'Examination session';

  window.FestacolSessionStore = Object.freeze({
    PAYLOAD_VERSION,
    MODE_LABELS,
    normalizeSession,
    encodeSession,
    decodeSession,
    getSessionLink,
    listSessions,
    saveSession,
    updateSessionStatus,
    deleteSession,
    getAttempts,
    recordAttempt,
    getStudentState,
    saveStudentState,
    clearStudentState,
    sanitizeName,
    getModeLabel
  });
})();
