(() => {
  'use strict';

  const SESSION_STORE_KEY = 'festacol.exam.sessions.v2';
  const ATTEMPT_STORE_KEY = 'festacol.exam.attempts.v2';
  const STUDENT_STATE_PREFIX = 'festacol.student.session.v2:';
  const USER_STORE_KEY = 'festacol.admin.users.v1';
  const CLASS_STORE_KEY = 'festacol.admin.classes.v1';
  const CUSTOM_QUESTION_STORE_KEY = 'festacol.admin.custom-questions.v1';
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
    const url = new URL('./student.html', baseHref);
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



  const DEFAULT_CLASSES = Object.freeze([
    { id: 'ss1-general', classLevel: 'SS1', name: 'SS1 General', stream: 'Foundation', capacity: 180, room: 'Senior Block A', status: 'active' },
    { id: 'ss2-science', classLevel: 'SS2', name: 'SS2 Science', stream: 'Science', capacity: 64, room: 'Science Wing', status: 'active' },
    { id: 'ss2-arts', classLevel: 'SS2', name: 'SS2 Arts', stream: 'Arts', capacity: 58, room: 'Humanities Wing', status: 'active' },
    { id: 'ss2-social', classLevel: 'SS2', name: 'SS2 Social Science', stream: 'Social Science', capacity: 62, room: 'Commerce Wing', status: 'active' },
    { id: 'ss3-science', classLevel: 'SS3', name: 'SS3 Science', stream: 'Science', capacity: 60, room: 'Science Wing', status: 'active' },
    { id: 'ss3-arts', classLevel: 'SS3', name: 'SS3 Arts', stream: 'Arts', capacity: 54, room: 'Humanities Wing', status: 'active' },
    { id: 'ss3-social', classLevel: 'SS3', name: 'SS3 Social Science', stream: 'Social Science', capacity: 56, room: 'Commerce Wing', status: 'active' }
  ]);

  const DEFAULT_USERS = Object.freeze([
    { id: 'ST-2401', fullName: 'Amina Yusuf Bello', classId: 'ss2-science', role: 'student', status: 'active', guardian: 'Yusuf Bello', joinedAt: Date.now() - 86400000 * 90 },
    { id: 'ST-2402', fullName: 'David Chukwu Okafor', classId: 'ss2-arts', role: 'student', status: 'active', guardian: 'Chukwu Okafor', joinedAt: Date.now() - 86400000 * 84 },
    { id: 'ST-2403', fullName: 'Zainab Musa Ibrahim', classId: 'ss3-social', role: 'student', status: 'active', guardian: 'Musa Ibrahim', joinedAt: Date.now() - 86400000 * 77 },
    { id: 'ST-2404', fullName: 'Tolu Adeyemi James', classId: 'ss1-general', role: 'student', status: 'active', guardian: 'Adeyemi James', joinedAt: Date.now() - 86400000 * 46 },
    { id: 'AD-001', fullName: 'Examination Administrator', classId: '', role: 'administrator', status: 'active', guardian: '', joinedAt: Date.now() - 86400000 * 200 }
  ]);

  const listClasses = () => {
    const value = readJson(CLASS_STORE_KEY, null);
    return Array.isArray(value) && value.length ? value : DEFAULT_CLASSES.map((item) => ({ ...item }));
  };

  const saveClass = (input) => {
    const name = String(input.name || '').trim().slice(0, 60);
    const classLevel = String(input.classLevel || '');
    if (!name || !['SS1', 'SS2', 'SS3'].includes(classLevel)) throw new Error('Class name and level are required.');
    const item = {
      id: String(input.id || makeId()).slice(0, 24),
      classLevel,
      name,
      stream: String(input.stream || 'General').trim().slice(0, 40),
      capacity: Math.max(1, Math.min(500, Number(input.capacity) || 40)),
      room: String(input.room || '').trim().slice(0, 50),
      status: input.status === 'archived' ? 'archived' : 'active'
    };
    const classes = listClasses();
    writeJson(CLASS_STORE_KEY, [item, ...classes.filter((entry) => entry.id !== item.id)]);
    return item;
  };

  const deleteClass = (classId) => writeJson(CLASS_STORE_KEY, listClasses().filter((item) => item.id !== classId));

  const listUsers = () => {
    const value = readJson(USER_STORE_KEY, null);
    const base = Array.isArray(value) && value.length ? value : DEFAULT_USERS.map((item) => ({ ...item }));
    const attempts = getAttempts();
    const names = new Set(base.map((item) => item.fullName.toLowerCase()));
    const inferred = attempts.filter((attempt) => attempt.studentName && !names.has(attempt.studentName.toLowerCase())).map((attempt) => ({
      id: `AT-${String(attempt.id).slice(-6)}`,
      fullName: attempt.studentName,
      classId: listClasses().find((item) => item.classLevel === attempt.classLevel)?.id || '',
      role: 'student',
      status: 'active',
      guardian: '',
      joinedAt: attempt.startedAt || Date.now()
    }));
    return [...base, ...inferred];
  };

  const saveUser = (input) => {
    const fullName = sanitizeName(input.fullName);
    if (fullName.split(/\s+/u).filter(Boolean).length < 2) throw new Error('Enter at least two names for the user.');
    const item = {
      id: String(input.id || `ST-${Math.floor(1000 + Math.random() * 9000)}`).slice(0, 24),
      fullName,
      classId: String(input.classId || ''),
      role: ['student', 'teacher', 'administrator'].includes(input.role) ? input.role : 'student',
      status: input.status === 'inactive' ? 'inactive' : 'active',
      guardian: sanitizeName(input.guardian || ''),
      joinedAt: Number(input.joinedAt) || Date.now()
    };
    const current = readJson(USER_STORE_KEY, DEFAULT_USERS.map((entry) => ({ ...entry })));
    writeJson(USER_STORE_KEY, [item, ...current.filter((entry) => entry.id !== item.id)]);
    return item;
  };

  const updateUserStatus = (userId, status) => {
    const current = readJson(USER_STORE_KEY, DEFAULT_USERS.map((entry) => ({ ...entry })));
    const next = current.map((entry) => entry.id === userId ? { ...entry, status: status === 'inactive' ? 'inactive' : 'active' } : entry);
    writeJson(USER_STORE_KEY, next);
    return next.find((entry) => entry.id === userId) || null;
  };

  const deleteUser = (userId) => {
    const current = readJson(USER_STORE_KEY, DEFAULT_USERS.map((entry) => ({ ...entry })));
    writeJson(USER_STORE_KEY, current.filter((entry) => entry.id !== userId));
  };

  const listCustomQuestions = () => {
    const value = readJson(CUSTOM_QUESTION_STORE_KEY, []);
    return Array.isArray(value) ? value : [];
  };

  const saveCustomQuestion = (input) => {
    const question = { ...input, id: Number(input.id) || Math.floor(100000 + Math.random() * 899999), custom: true };
    const current = listCustomQuestions();
    writeJson(CUSTOM_QUESTION_STORE_KEY, [question, ...current.filter((entry) => entry.id !== question.id)].slice(0, 250));
    return question;
  };

  const deleteCustomQuestion = (questionId) => writeJson(CUSTOM_QUESTION_STORE_KEY, listCustomQuestions().filter((item) => item.id !== Number(questionId)));


  const clearSessions = () => localStorage.removeItem(SESSION_STORE_KEY);
  const clearAttempts = () => localStorage.removeItem(ATTEMPT_STORE_KEY);
  const clearAllStudentStates = () => {
    const keys = [];
    for (let index = 0; index < localStorage.length; index += 1) {
      const key = localStorage.key(index);
      if (key?.startsWith(STUDENT_STATE_PREFIX)) keys.push(key);
    }
    keys.forEach((key) => localStorage.removeItem(key));
    return keys.length;
  };

  const clearPrototypeData = () => {
    const studentStateCount = clearAllStudentStates();
    clearSessions();
    clearAttempts();
    localStorage.removeItem(USER_STORE_KEY);
    localStorage.removeItem(CLASS_STORE_KEY);
    localStorage.removeItem(CUSTOM_QUESTION_STORE_KEY);
    return studentStateCount;
  };

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
    clearSessions,
    clearAttempts,
    clearAllStudentStates,
    clearPrototypeData,
    sanitizeName,
    getModeLabel,
    listClasses,
    saveClass,
    deleteClass,
    listUsers,
    saveUser,
    updateUserStatus,
    deleteUser,
    listCustomQuestions,
    saveCustomQuestion,
    deleteCustomQuestion
  });
})();
