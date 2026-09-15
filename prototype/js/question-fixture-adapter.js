(() => {
  'use strict';

  const nativeFetch = window.fetch.bind(window);
  const prototypeTracks = Object.freeze(['Science', 'Arts', 'Social Science']);
  const trackLabels = Object.freeze({
    SCIENCE: 'Science',
    HUMANITIES: 'Arts',
    BUSINESS: 'Social Science'
  });
  const supportedModes = new Set(['qualifier', 'mixed', 'single', 'waec']);

  const requestUrl = (input) => {
    if (typeof input === 'string') return new URL(input, document.baseURI);
    if (input instanceof URL) return new URL(input.href);
    return new URL(input.url, document.baseURI);
  };

  const isQuestionFixture = (url) => /\/(?:public\/)?seed\/questions\.json$/u.test(url.pathname);

  const unique = (items) => [...new Set(items.filter(Boolean))];

  const enrichFixture = (questionPayload, subjectPayload) => {
    if (!Array.isArray(questionPayload?.questions) || !Array.isArray(subjectPayload?.subjects)) {
      throw new Error('Festacol seed fixtures are unavailable.');
    }

    const questionsBySubject = new Map();
    for (const question of questionPayload.questions) {
      const code = String(question.subjectCode || '');
      const modes = questionsBySubject.get(code) ?? [];
      modes.push(...(Array.isArray(question.examModes) ? question.examModes.filter((mode) => supportedModes.has(mode)) : []));
      questionsBySubject.set(code, modes);
    }

    const subjectsByCode = new Map();
    const subjectCatalog = subjectPayload.subjects
      .filter((subject) => subject?.active !== false && subject?.code)
      .map((subject) => {
        const qualifier = subject.kind === 'QUALIFIER';
        const curriculum = Array.isArray(subject.curriculum) ? subject.curriculum : [];
        const levels = qualifier ? ['SS1'] : unique(curriculum.map((rule) => rule.level));
        const pathways = qualifier
          ? [...prototypeTracks]
          : unique(curriculum.map((rule) => trackLabels[rule.track]));
        const modes = unique(questionsBySubject.get(subject.code) ?? []);
        const record = {
          code: subject.code,
          label: subject.name,
          levels,
          modes: modes.length ? modes : qualifier ? ['qualifier'] : ['single', 'mixed'],
          pathways: pathways.length ? pathways : [...prototypeTracks]
        };
        subjectsByCode.set(subject.code, { ...subject, prototype: record });
        return record;
      });

    const questions = questionPayload.questions.map((question) => {
      const subject = subjectsByCode.get(question.subjectCode);
      const pathways = subject?.prototype?.pathways ?? [...prototypeTracks];
      return {
        ...question,
        subject: subject?.name ?? question.subjectCode,
        pathways,
        examModes: Array.isArray(question.examModes)
          ? question.examModes.filter((mode) => supportedModes.has(mode))
          : []
      };
    });

    return { ...questionPayload, subjectCatalog, questions };
  };

  window.fetch = async (input, init) => {
    const url = requestUrl(input);
    if (!isQuestionFixture(url)) return nativeFetch(input, init);

    const subjectUrl = new URL(url.href);
    subjectUrl.pathname = subjectUrl.pathname.replace(/questions\.json$/u, 'subjects.json');
    const [questionsResponse, subjectsResponse] = await Promise.all([
      nativeFetch(input, init),
      nativeFetch(subjectUrl.href, { ...init, headers: { Accept: 'application/json', ...(init?.headers || {}) } })
    ]);

    if (!questionsResponse.ok || !subjectsResponse.ok) return questionsResponse;
    const [questionPayload, subjectPayload] = await Promise.all([
      questionsResponse.json(),
      subjectsResponse.json()
    ]);
    const payload = enrichFixture(questionPayload, subjectPayload);
    return new Response(JSON.stringify(payload), {
      status: 200,
      headers: { 'Content-Type': 'application/json; charset=utf-8' }
    });
  };
})();
