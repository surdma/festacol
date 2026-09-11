(() => {
  'use strict';

  const SUPPORTED_TYPES = new Set(['single', 'multi', 'boolean', 'fill', 'fill-multi']);
  let baseCache = null;

  const validateQuestion = (question, ids) => {
    if (!question || !Number.isInteger(question.id) || ids.has(question.id)) throw new Error('Every question must have a unique integer id.');
    if (!question.subject || !question.subjectCode || !question.domain || !question.label || !question.prompt) throw new Error(`Question ${question.id} is missing required metadata.`);
    if (!SUPPORTED_TYPES.has(question.type)) throw new Error(`Question ${question.id} has an unsupported response type.`);
    if (!Array.isArray(question.levels) || question.levels.length === 0) throw new Error(`Question ${question.id} needs at least one class level.`);
    if (!Array.isArray(question.examModes) || question.examModes.length === 0) throw new Error(`Question ${question.id} needs at least one exam mode.`);
    if ((question.type === 'single' || question.type === 'multi') && (!Array.isArray(question.options) || question.options.length < 2)) throw new Error(`Question ${question.id} must provide options.`);
    if (question.type === 'multi' && (!Number.isInteger(question.requiredSelections) || question.requiredSelections < 1 || question.requiredSelections > question.options.length)) throw new Error(`Question ${question.id} has an invalid selection count.`);
    if ((question.type === 'fill' || question.type === 'fill-multi') && (!Array.isArray(question.fillTemplate) || !question.fillTemplate.some((part) => part?.blank))) throw new Error(`Question ${question.id} needs a response blank.`);
    ids.add(question.id);
  };

  const validatePayload = (payload) => {
    if (!payload || !payload.questionSetId || !Array.isArray(payload.questions) || payload.questions.length === 0) throw new Error('Question data is unavailable.');
    if (!Array.isArray(payload.subjectCatalog) || payload.subjectCatalog.length === 0) throw new Error('Question subject catalogue is unavailable.');
    const ids = new Set();
    payload.questions.forEach((question) => validateQuestion(question, ids));
    return {
      ...payload,
      assessmentAlignment: {
        ...(payload.assessmentAlignment || {}),
        note: 'Prototype scoring keys are evaluated client-side only to exercise analytics and placement. They are inspectable and are not a security boundary; production answer keys, authentication, scoring and attempt allocation must live on a protected server.'
      }
    };
  };

  const resolveUrl = () => {
    const script = document.currentScript;
    if (script?.src) return new URL('../data/questions.json', script.src).href;
    return new URL('./data/questions.json', document.baseURI).href;
  };
  const DATA_URL = resolveUrl();

  const load = async () => {
    if (!baseCache) {
      const response = await fetch(DATA_URL, { headers: { Accept: 'application/json' }, cache: 'no-store' });
      if (!response.ok) throw new Error(`Question data request failed (${response.status}).`);
      baseCache = validatePayload(await response.json());
    }
    const customQuestions = window.FestacolSessionStore?.listCustomQuestions?.() || [];
    if (!customQuestions.length) return baseCache;
    return validatePayload({ ...baseCache, questions: [...customQuestions, ...baseCache.questions] });
  };

  const availableSubjects = (payload, classLevel, mode) => payload.subjectCatalog.filter((subject) => {
    if (!subject.levels.includes(classLevel)) return false;
    return payload.questions.some((question) => question.subjectCode === subject.code && question.levels.includes(classLevel) && question.examModes.includes(mode));
  });

  const eligibleQuestions = (payload, session) => payload.questions.filter((question) => {
    if (!question.levels.includes(session.classLevel) || !question.examModes.includes(session.mode)) return false;
    if (session.mode === 'qualifier') return !session.subjects?.length || session.subjects.includes(question.subjectCode);
    return session.subjects.includes(question.subjectCode);
  });

  const interleaveBySubject = (questions, subjectOrder, limit) => {
    const buckets = new Map(subjectOrder.map((code) => [code, []]));
    questions.forEach((question) => {
      if (!buckets.has(question.subjectCode)) buckets.set(question.subjectCode, []);
      buckets.get(question.subjectCode).push(question);
    });
    const orderedCodes = [...buckets.keys()];
    const result = [];
    let cursor = 0;
    while (result.length < limit && orderedCodes.some((code) => buckets.get(code).length > 0)) {
      const code = orderedCodes[cursor % orderedCodes.length];
      const bucket = buckets.get(code);
      if (bucket.length > 0) result.push(bucket.shift());
      cursor += 1;
    }
    return result;
  };

  const questionsForSession = (payload, session) => {
    const candidates = eligibleQuestions(payload, session);
    const limit = Math.min(session.questionCount, candidates.length);
    if (session.mode === 'single' || session.mode === 'waec') return candidates.slice(0, limit);
    const subjectOrder = session.subjects?.length ? session.subjects : [...new Set(candidates.map((question) => question.subjectCode))];
    return interleaveBySubject(candidates, subjectOrder, limit);
  };

  const subjectByCode = (payload, code) => payload.subjectCatalog.find((subject) => subject.code === code) || null;
  const questionById = (payload, id) => payload.questions.find((question) => question.id === Number(id)) || null;

  window.FestacolQuestionData = Object.freeze({ load, availableSubjects, eligibleQuestions, questionsForSession, subjectByCode, questionById });
})();
