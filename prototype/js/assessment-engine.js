(() => {
  'use strict';

  const TRACKS = Object.freeze(['Science', 'Arts', 'Social Science']);
  const ANSWER_KEYS = Object.freeze({
    1: 'were', 2: 'Rain', 3: '36', 4: '65°', 5: 'Evaporation', 6: ['Solar energy', 'Wind energy'],
    7: 'Protecting public property', 8: true, 9: 'Invoice', 10: 'Printer', 11: 'T7!qP2#zL9', 12: true,
    13: 'hard-working', 14: 'had come', 15: 'analyses', 16: 'He had prepared consistently', 17: '5', 18: '2⁵',
    19: '8', 20: '36°', 21: 'Chloroplast', 22: 'population', 23: ['Glucose', 'Oxygen'], 24: 'Electron',
    25: true, 26: 'valence electrons', 27: '50 km/h', 28: 'Elastic potential energy', 29: true, 30: 'inflation',
    31: 'Labour', 32: 'Judiciary', 33: 'choose representatives', 34: 'personification', 35: 'drama',
    36: 'Obeying lawful rules', 37: true, 38: 'contours', 39: 'Barometer', 40: ['Crop rotation', 'Adding compost'],
    41: 'Hoe', 42: true, 43: 'Router'
  });

  const TRACK_WEIGHTS = Object.freeze({
    Science: Object.freeze({ 'q-math': 1.5, 'q-bst': 1.55, 'q-digital': 1.05, 'q-eng': .75, 'q-social': .55, 'q-business': .45 }),
    Arts: Object.freeze({ 'q-eng': 1.55, 'q-social': 1.25, 'q-business': .7, 'q-digital': .55, 'q-math': .55, 'q-bst': .45 }),
    'Social Science': Object.freeze({ 'q-social': 1.45, 'q-business': 1.45, 'q-eng': 1.0, 'q-math': .85, 'q-digital': .75, 'q-bst': .55 })
  });

  const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
  const normalizeText = (value) => String(value ?? '').trim().replace(/\s+/gu, ' ').toLocaleLowerCase('en');
  const normalizeNamePart = (value) => String(value ?? '').trim().replace(/[^\p{L}\p{M}' -]/gu, '').replace(/\s+/gu, ' ').slice(0, 40);

  const candidateCredentials = (firstName, lastName) => {
    const first = normalizeNamePart(firstName);
    const last = normalizeNamePart(lastName);
    if (first.length < 2) throw new Error('Enter the student first name.');
    if (last.length < 2) throw new Error('Enter the student last name.');
    return { firstName: first, lastName: last, fullName: `${first} ${last}` };
  };

  const fallbackHash = (value) => {
    let hashA = 0x811c9dc5;
    let hashB = 0x9e3779b9;
    for (let index = 0; index < value.length; index += 1) {
      const code = value.charCodeAt(index);
      hashA = Math.imul(hashA ^ code, 0x01000193) >>> 0;
      hashB = Math.imul(hashB ^ code, 0x85ebca6b) >>> 0;
    }
    return `${hashA.toString(16).padStart(8, '0')}${hashB.toString(16).padStart(8, '0')}`;
  };

  const hashText = async (value) => {
    const text = String(value);
    if (globalThis.crypto?.subtle && globalThis.TextEncoder) {
      const buffer = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
      return [...new Uint8Array(buffer)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
    }
    return fallbackHash(text).repeat(4).slice(0, 64);
  };

  const studentHash = async (firstName, lastName) => {
    const identity = candidateCredentials(firstName, lastName);
    return hashText(`festacol-student|${normalizeText(identity.firstName)}|${normalizeText(identity.lastName)}`);
  };

  const candidateHash = async (sessionId, firstName, lastName) => {
    const identityHash = await studentHash(firstName, lastName);
    return hashText(`festacol-attempt|${String(sessionId).toUpperCase()}|${identityHash}`);
  };

  const seedFrom = (value) => {
    let seed = 2166136261;
    for (const char of String(value)) seed = Math.imul(seed ^ char.charCodeAt(0), 16777619) >>> 0;
    return seed || 0x9e3779b9;
  };

  const rngFor = (seedInput) => {
    let state = seedFrom(seedInput);
    return () => {
      state += 0x6D2B79F5;
      let value = state;
      value = Math.imul(value ^ value >>> 15, value | 1);
      value ^= value + Math.imul(value ^ value >>> 7, value | 61);
      return ((value ^ value >>> 14) >>> 0) / 4294967296;
    };
  };

  const shuffled = (items, seed) => {
    const output = [...items];
    const random = rngFor(seed);
    for (let index = output.length - 1; index > 0; index -= 1) {
      const swap = Math.floor(random() * (index + 1));
      [output[index], output[swap]] = [output[swap], output[index]];
    }
    return output;
  };

  const eligibleQuestions = (payload, session) => payload.questions.filter((question) => {
    if (!question.levels.includes(session.classLevel) || !question.examModes.includes(session.mode)) return false;
    if (session.mode === 'qualifier') return !session.subjects?.length || session.subjects.includes(question.subjectCode);
    return session.subjects.includes(question.subjectCode);
  });

  const paperForStudent = (payload, session, studentHash) => {
    const candidates = eligibleQuestions(payload, session);
    const target = Math.min(Number(session.questionCount) || 0, candidates.length);
    if (!target) return [];
    const subjectOrder = session.mode === 'single' || session.mode === 'waec'
      ? [...new Set(candidates.map((question) => question.subjectCode))]
      : (session.subjects?.length ? session.subjects : [...new Set(candidates.map((question) => question.subjectCode))]);
    const randomizeQuestions = session.randomization?.questionOrder !== false;
    const collisionSalt = session.randomization?.minimizePaperCollisions !== false ? `${studentHash}|${session.id}` : String(session.id);
    const orderedSubjects = randomizeQuestions ? shuffled(subjectOrder, `${collisionSalt}|subjects`) : [...subjectOrder];
    const buckets = new Map(orderedSubjects.map((code) => [code, randomizeQuestions ? shuffled(candidates.filter((question) => question.subjectCode === code), `${collisionSalt}|${code}`) : candidates.filter((question) => question.subjectCode === code)]));
    const selected = [];
    let cursor = 0;
    while (selected.length < target && [...buckets.values()].some((bucket) => bucket.length)) {
      const code = orderedSubjects[cursor % orderedSubjects.length];
      const bucket = buckets.get(code);
      if (bucket?.length) selected.push(bucket.shift());
      cursor += 1;
    }
    return selected.map((question, index) => {
      const clone = { ...question };
      if (Array.isArray(question.options) && session.randomization?.optionOrder !== false) clone.options = shuffled(question.options, `${studentHash}|${session.id}|${question.id}|${index}`);
      if (Array.isArray(question.fillTemplate)) clone.fillTemplate = question.fillTemplate.map((part) => ({ ...part }));
      return clone;
    });
  };

  const valueIsCorrect = (question, response) => {
    const key = ANSWER_KEYS[question.id];
    if (key === undefined) return null;
    if (Array.isArray(key)) {
      const received = Array.isArray(response) ? response.map(normalizeText).sort() : [];
      const expected = key.map(normalizeText).sort();
      return received.length === expected.length && received.every((value, index) => value === expected[index]);
    }
    if (question.type === 'fill' || question.type === 'fill-multi') {
      const values = response && typeof response === 'object' ? Object.values(response) : [response];
      return values.length > 0 && normalizeText(values[0]) === normalizeText(key);
    }
    if (typeof key === 'boolean') return response === key;
    return normalizeText(response) === normalizeText(key);
  };

  const answerDisplay = (question) => {
    const key = ANSWER_KEYS[question.id];
    if (Array.isArray(key)) return key.join(' + ');
    if (key === true) return 'True';
    if (key === false) return 'False';
    return String(key ?? 'Scoring key unavailable');
  };

  const scoreAttempt = (paper, state, session) => {
    const details = paper.map((question) => {
      const response = state.responses?.[String(question.id)];
      const correct = valueIsCorrect(question, response);
      return { questionId: question.id, subjectCode: question.subjectCode, subject: question.subject, domain: question.domain, correct, response: response ?? null, correctAnswer: answerDisplay(question), seconds: Math.max(0, Number(state.questionTimings?.[String(question.id)]) || 0) };
    });
    const scored = details.filter((item) => item.correct !== null);
    const correctCount = scored.filter((item) => item.correct).length;
    const accuracy = scored.length ? Math.round(correctCount / scored.length * 100) : 0;
    const answered = paper.filter((question) => { const value = state.responses?.[String(question.id)]; return Array.isArray(value) ? value.length > 0 : value && typeof value === 'object' ? Object.values(value).some((v) => String(v ?? '').trim()) : value === true || value === false || String(value ?? '').trim().length > 0; }).length;
    const completion = paper.length ? Math.round(answered / paper.length * 100) : 0;
    const activeElapsed = Number(state.elapsedActiveSeconds);
    const elapsedSeconds = Math.max(1, Math.round(Number.isFinite(activeElapsed) && activeElapsed > 0 ? activeElapsed : ((state.submittedAt || Date.now()) - (state.startedAt || Date.now())) / 1000));
    const durationSeconds = Math.max(30, Number(session.durationSeconds) || Number(session.durationMinutes) * 60 || 3600);
    const avgSeconds = paper.length ? Math.round(elapsedSeconds / paper.length) : 0;
    const expectedPerQuestion = Math.max(10, durationSeconds / Math.max(1, paper.length));
    const paceIndex = Math.round(clamp(100 - Math.max(0, avgSeconds - expectedPerQuestion * .55) / expectedPerQuestion * 65, 25, 100));
    const integrityEvents = Array.isArray(state.integrityEvents) ? state.integrityEvents : [];
    const integrityScore = Math.max(0, 100 - integrityEvents.filter((event) => !['focus-return', 'fullscreen-enter'].includes(event.type)).length * 8);
    const bySubject = {};
    for (const item of details) { const bucket = bySubject[item.subjectCode] ||= { subjectCode: item.subjectCode, subject: item.subject, total: 0, correct: 0, seconds: 0 }; bucket.total += 1; if (item.correct) bucket.correct += 1; bucket.seconds += item.seconds; }
    const subjectStats = Object.values(bySubject).map((bucket) => ({ ...bucket, percent: bucket.total ? Math.round(bucket.correct / bucket.total * 100) : 0 }));
    const reasoningIndex = Math.round(accuracy * .78 + completion * .14 + paceIndex * .08);
    const result = { correctCount, scoredCount: scored.length, accuracy, completion, elapsedSeconds, avgSeconds, paceIndex, reasoningIndex, integrityScore, integrityEventCount: integrityEvents.length, subjectStats, details };
    if (session.mode === 'qualifier') result.placement = placementFor(result, session);
    return result;
  };

  function placementFor(result, session) {
    const enabled = (session.placementTracks || TRACKS).filter((track) => TRACKS.includes(track));
    const tracks = enabled.length ? enabled : [...TRACKS];
    const stats = new Map(result.subjectStats.map((item) => [item.subjectCode, item.percent]));
    const scoredTracks = tracks.map((track) => { const weights = TRACK_WEIGHTS[track]; let totalWeight = 0, weighted = 0; Object.entries(weights).forEach(([subjectCode, weight]) => { if (!stats.has(subjectCode)) return; totalWeight += weight; weighted += stats.get(subjectCode) * weight; }); const academic = totalWeight ? weighted / totalWeight : result.accuracy; const score = academic * .82 + result.paceIndex * .08 + result.completion * .08 + result.integrityScore * .02; return { track, score: Math.round(score), academic: Math.round(academic) }; }).sort((a, b) => b.score - a.score);
    const best = scoredTracks[0], second = scoredTracks[1], gap = second ? best.score - second.score : 15;
    const confidence = clamp(55 + gap * 3 + Math.round((best.score - 50) * .25), 55, 96);
    return { assignedTrack: best.track, confidence, trackScores: scoredTracks, basis: 'Assessment accuracy, subject profile, completion, pace and recorded integrity signals', note: 'This is an exam-derived placement recommendation, not a permanent measure of intelligence.' };
  }

  const paperFingerprint = async (sessionId, studentHash, paper) => hashText(`${sessionId}|${studentHash}|${paper.map((question) => `${question.id}:${(question.options || []).join('~')}`).join('|')}`);
  const attemptHash = async (sessionId, studentHash, fingerprint) => hashText(`attempt|${sessionId}|${studentHash}|${fingerprint}`);
  const answersMayBeRevealed = (session, effectiveStatus = session?.status) => { if (!session) return false; if (effectiveStatus === 'closed') return true; return Boolean(session.endsAt && Date.now() > Number(session.endsAt)); };
  window.FestacolAssessmentEngine = Object.freeze({ TRACKS, candidateCredentials, studentHash, candidateHash, hashText, paperForStudent, paperFingerprint, attemptHash, scoreAttempt, valueIsCorrect, answerDisplay, answersMayBeRevealed });
})();
