(() => {
  'use strict';

  const QUESTION_DATA_VERSION_KEY = 'festacol-question-data-version';
  const EXAM_STATE_KEY = 'festacol-cbt-demo-v2';
  const SUPPORTED_TYPES = new Set(['single', 'multi', 'boolean', 'fill', 'fill-multi']);

  const currentScript = document.currentScript;
  const root = document.getElementById('page-root');

  const showLoadState = (title, message) => {
    if (!root) return;
    root.innerHTML = `
      <div class="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
        <div class="max-w-2xl rounded-xl border border-neutral-200 bg-white p-6 shadow-sm">
          <p class="text-xs font-bold uppercase tracking-widest text-neutral-500">Examination questions</p>
          <h1 class="mt-2 text-2xl font-bold tracking-tight text-black">${title}</h1>
          <p class="mt-3 text-sm leading-6 text-neutral-600">${message}</p>
        </div>
      </div>`;
  };

  const validateQuestion = (question, ids) => {
    if (!question || !Number.isInteger(question.id) || ids.has(question.id)) {
      throw new Error('Every question must have a unique integer id.');
    }
    if (!question.subject || !question.domain || !question.label || !question.prompt) {
      throw new Error(`Question ${question.id} is missing required subject or content fields.`);
    }
    if (!SUPPORTED_TYPES.has(question.type)) {
      throw new Error(`Question ${question.id} has an unsupported response type.`);
    }
    if ((question.type === 'single' || question.type === 'multi') && (!Array.isArray(question.options) || question.options.length < 2)) {
      throw new Error(`Question ${question.id} must provide answer options.`);
    }
    if (question.type === 'multi' && (!Number.isInteger(question.requiredSelections) || question.requiredSelections < 1 || question.requiredSelections > question.options.length)) {
      throw new Error(`Question ${question.id} has an invalid required selection count.`);
    }
    if ((question.type === 'fill' || question.type === 'fill-multi') && (!Array.isArray(question.fillTemplate) || !question.fillTemplate.some((part) => part && part.blank))) {
      throw new Error(`Question ${question.id} must define at least one response blank.`);
    }
    ids.add(question.id);
  };

  const loadApplication = async () => {
    if (!currentScript?.src) {
      throw new Error('Unable to resolve the question loader location.');
    }

    showLoadState('Loading questions…', 'Preparing the Nigerian junior-secondary examination question set.');

    const loaderUrl = new URL(currentScript.src);
    const questionsUrl = new URL('../data/questions.json', loaderUrl);
    const applicationUrl = new URL('./prototype.js', loaderUrl);

    const response = await fetch(questionsUrl, {
      headers: { Accept: 'application/json' },
      cache: 'no-store'
    });

    if (!response.ok) {
      throw new Error(`Question data request failed with status ${response.status}.`);
    }

    const payload = await response.json();

    if (!payload || !payload.questionSetId || !Array.isArray(payload.questions) || payload.questions.length === 0) {
      throw new Error('Question data is missing its version or a non-empty questions array.');
    }

    const ids = new Set();
    payload.questions.forEach((question) => validateQuestion(question, ids));

    try {
      const previousVersion = localStorage.getItem(QUESTION_DATA_VERSION_KEY);
      if (previousVersion !== payload.questionSetId) {
        localStorage.removeItem(EXAM_STATE_KEY);
        localStorage.setItem(QUESTION_DATA_VERSION_KEY, payload.questionSetId);
      }
    } catch {
      // Browser storage is optional for this prototype.
    }

    window.FESTACOL_QUESTION_META = Object.freeze({
      schemaVersion: payload.schemaVersion,
      questionSetId: payload.questionSetId,
      title: payload.title,
      level: payload.level,
      assessmentAlignment: payload.assessmentAlignment,
      currentJssSubjectDomains: payload.currentJssSubjectDomains,
      bece2026TransitionDomains: payload.bece2026TransitionDomains
    });
    window.FESTACOL_QUESTIONS = Object.freeze(payload.questions.map((question) => Object.freeze(question)));

    const script = document.createElement('script');
    script.src = applicationUrl.href;
    script.async = false;
    script.addEventListener('error', () => {
      showLoadState('Unable to start the examination', 'The examination interface could not be loaded. Please refresh the page and try again.');
    });
    document.body.appendChild(script);
  };

  loadApplication().catch((error) => {
    console.error('Festacol question loading failed:', error);
    showLoadState(
      'Questions could not be loaded',
      'The examination question set is temporarily unavailable. Refresh the page and try again.'
    );
  });
})();
