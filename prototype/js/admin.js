(() => {
  'use strict';

  const Store = window.FestacolSessionStore;
  const Data = window.FestacolQuestionData;
  const QR = window.FestacolQR;

  if (!Store || !Data || !QR) {
    throw new Error('Festacol session studio dependencies are unavailable.');
  }

  const MODE_COPY = Object.freeze({
    qualifier: { title: 'SS1 Placement Qualifier', description: 'JSS/BECE-level aptitude across English, Mathematics, Basic Science, Social Studies, Business and Digital Technologies.' },
    mixed: { title: 'Mixed Subject Examination', description: 'One timed paper assembled deterministically from two or more selected subjects.' },
    single: { title: 'Single Subject Examination', description: 'One focused subject paper for the selected senior-school class.' },
    waec: { title: 'WAEC Subject Practice', description: 'SS3 subject-specific practice configured from the selected WAEC-domain subject.' }
  });

  const state = {
    payload: null,
    classLevel: 'SS1',
    mode: 'qualifier',
    subjects: [],
    generatedSession: null,
    generatedLink: ''
  };

  const form = document.getElementById('session-form');
  const titleInput = document.getElementById('session-title');
  const durationInput = document.getElementById('duration');
  const questionCountInput = document.getElementById('question-count');
  const subjectFieldset = document.getElementById('subject-fieldset');
  const subjectOptions = document.getElementById('subject-options');
  const subjectHelp = document.getElementById('subject-help');
  const availableCount = document.getElementById('available-count');
  const formSummary = document.getElementById('form-summary');
  const sessionSpec = document.getElementById('session-spec');
  const linkEmpty = document.getElementById('link-empty');
  const linkResult = document.getElementById('link-result');
  const sessionLink = document.getElementById('session-link');
  const openLink = document.getElementById('open-link');
  const copyLink = document.getElementById('copy-link');
  const alertRoot = document.getElementById('admin-alert');
  const savedSessionList = document.getElementById('saved-session-list');
  const attemptList = document.getElementById('attempt-list');

  const primaryChoice = 'min-h-12 rounded-xl bg-black px-4 text-sm font-bold text-white shadow-sm focus:outline-none focus:ring-2 focus:ring-black focus:ring-offset-2';
  const secondaryChoice = 'min-h-12 rounded-xl px-4 text-sm font-bold text-neutral-600 hover:bg-white hover:text-black focus:outline-none focus:ring-2 focus:ring-black';
  const modeActive = 'group min-h-32 rounded-2xl border-2 border-black bg-black p-5 text-left text-white shadow-lg shadow-neutral-300 transition hover:-translate-y-0.5 focus:outline-none focus:ring-2 focus:ring-black focus:ring-offset-2 motion-reduce:transform-none';
  const modeIdle = 'group min-h-32 rounded-2xl border-2 border-neutral-200 bg-white p-5 text-left text-black transition hover:-translate-y-0.5 hover:border-black focus:outline-none focus:ring-2 focus:ring-black focus:ring-offset-2 motion-reduce:transform-none';

  const escapeText = (value) => String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');

  const formatDateTime = (timestamp) => {
    if (!timestamp) return 'No schedule limit';
    return new Intl.DateTimeFormat('en-NG', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(timestamp));
  };

  const dateInputValue = (element) => {
    if (!element.value) return null;
    const value = new Date(element.value).getTime();
    return Number.isFinite(value) ? value : null;
  };

  const showAlert = (message, tone = 'error') => {
    const dark = tone === 'success';
    alertRoot.className = dark
      ? 'mb-6 flex items-start gap-3 rounded-2xl border-2 border-black bg-black p-4 text-sm leading-6 text-white shadow-lg'
      : 'mb-6 flex items-start gap-3 rounded-2xl border-2 border-black bg-white p-4 text-sm leading-6 text-black shadow-lg';
    alertRoot.innerHTML = `<strong class="shrink-0 font-black uppercase tracking-widest">${dark ? 'Ready' : 'Check'}</strong><span>${escapeText(message)}</span>`;
  };

  const hideAlert = () => {
    alertRoot.className = 'mb-6 hidden';
    alertRoot.textContent = '';
  };

  const forceValidClass = () => {
    if (state.mode === 'qualifier') state.classLevel = 'SS1';
    if (state.mode === 'waec') state.classLevel = 'SS3';
  };

  const matchingQuestions = () => {
    if (!state.payload) return [];
    return state.payload.questions.filter((question) => {
      if (!question.levels.includes(state.classLevel) || !question.examModes.includes(state.mode)) return false;
      if (state.mode === 'qualifier') return true;
      return state.subjects.includes(question.subjectCode);
    });
  };

  const selectedSubjectLabels = () => state.subjects.map((code) => Data.subjectByCode(state.payload, code)?.label).filter(Boolean);

  const sessionCoverage = () => {
    if (state.mode === 'qualifier') return 'Science · Arts · Social Science placement';
    const labels = selectedSubjectLabels();
    return labels.length ? labels.join(' · ') : 'Choose subject coverage';
  };

  const maxQuestions = () => matchingQuestions().length;

  const normalizeQuestionCount = () => {
    const max = maxQuestions();
    questionCountInput.max = String(Math.max(max, 1));
    const current = Number(questionCountInput.value);
    if (max > 0 && (!Number.isInteger(current) || current < 1 || current > max)) questionCountInput.value = String(max);
    if (max === 0) questionCountInput.value = '1';
    availableCount.textContent = `${max} ready`;
  };

  const updateClassControls = () => {
    document.querySelectorAll('[data-class-level]').forEach((button) => {
      const selected = button.dataset.classLevel === state.classLevel;
      const forcedOut = (state.mode === 'qualifier' && button.dataset.classLevel !== 'SS1') || (state.mode === 'waec' && button.dataset.classLevel !== 'SS3');
      button.className = selected ? primaryChoice : secondaryChoice;
      button.disabled = forcedOut;
      button.classList.toggle('opacity-35', forcedOut);
      button.classList.toggle('cursor-not-allowed', forcedOut);
      button.setAttribute('aria-pressed', String(selected));
    });
  };

  const updateModeControls = () => {
    document.querySelectorAll('[data-mode]').forEach((button) => {
      const active = button.dataset.mode === state.mode;
      button.className = active ? modeActive : modeIdle;
      button.setAttribute('aria-pressed', String(active));
      const eyebrow = button.querySelector('span:first-child');
      const description = button.querySelector('span:last-child');
      if (eyebrow) eyebrow.className = active ? 'block text-xs font-black uppercase tracking-widest text-neutral-400' : 'block text-xs font-black uppercase tracking-widest text-neutral-500';
      if (description) description.className = active ? 'mt-2 block text-sm leading-5 text-neutral-300' : 'mt-2 block text-sm leading-5 text-neutral-600';
    });
  };

  const renderSubjects = () => {
    if (state.mode === 'qualifier') {
      state.subjects = [];
      subjectFieldset.classList.add('hidden');
      return;
    }

    subjectFieldset.classList.remove('hidden');
    const available = Data.availableSubjects(state.payload, state.classLevel, state.mode);
    const codes = new Set(available.map((subject) => subject.code));
    state.subjects = state.subjects.filter((code) => codes.has(code));

    if ((state.mode === 'single' || state.mode === 'waec') && state.subjects.length > 1) state.subjects = state.subjects.slice(0, 1);
    subjectHelp.textContent = state.mode === 'mixed'
      ? 'Choose 2–6 subjects. Questions are distributed across the selected subjects.'
      : 'Choose exactly one subject for this session.';

    subjectOptions.innerHTML = available.map((subject) => {
      const checked = state.subjects.includes(subject.code);
      return `
        <label class="flex min-h-14 cursor-pointer items-center gap-3 rounded-xl border-2 ${checked ? 'border-black bg-black text-white' : 'border-neutral-200 bg-white text-black hover:border-black'} px-4 transition focus-within:ring-2 focus-within:ring-black focus-within:ring-offset-2">
          <input type="checkbox" data-subject="${escapeText(subject.code)}" class="size-4 rounded border-neutral-400 text-black focus:ring-black" ${checked ? 'checked' : ''}>
          <span class="min-w-0 flex-1 text-sm font-bold">${escapeText(subject.label)}</span>
          <span class="text-xs ${checked ? 'text-neutral-400' : 'text-neutral-500'}">${state.classLevel}</span>
        </label>`;
    }).join('');

    subjectOptions.querySelectorAll('[data-subject]').forEach((checkbox) => checkbox.addEventListener('change', () => {
      const code = checkbox.dataset.subject;
      if (state.mode === 'mixed') {
        if (checkbox.checked && state.subjects.length >= 6) { checkbox.checked = false; showAlert('A mixed prototype session can include up to six subjects so the portable QR remains reliably scannable.'); return; }
        state.subjects = checkbox.checked ? [...new Set([...state.subjects, code])] : state.subjects.filter((item) => item !== code);
      } else {
        state.subjects = checkbox.checked ? [code] : [];
      }
      renderSubjects();
      updateComputedState();
      clearGeneratedResult();
    }));
  };

  const renderSessionSpec = () => {
    const count = Number(questionCountInput.value) || 0;
    const duration = Number(durationInput.value) || 0;
    sessionSpec.innerHTML = `
      <div class="rounded-2xl border border-neutral-800 bg-neutral-950 p-5">
        <p class="text-xs font-black uppercase tracking-widest text-neutral-500">Candidate sees</p>
        <h3 class="mt-3 font-serif text-2xl font-bold leading-tight">${escapeText(titleInput.value.trim() || MODE_COPY[state.mode].title)}</h3>
        <p class="mt-2 text-sm leading-6 text-neutral-400">${escapeText(MODE_COPY[state.mode].description)}</p>
      </div>
      <dl class="divide-y divide-neutral-800 border-y border-neutral-800 text-sm">
        <div class="flex items-start justify-between gap-5 py-3"><dt class="text-neutral-500">Class</dt><dd class="font-bold text-white">${escapeText(state.classLevel)}</dd></div>
        <div class="flex items-start justify-between gap-5 py-3"><dt class="text-neutral-500">Format</dt><dd class="max-w-48 text-right font-bold text-white">${escapeText(Store.getModeLabel(state.mode))}</dd></div>
        <div class="flex items-start justify-between gap-5 py-3"><dt class="text-neutral-500">Coverage</dt><dd class="max-w-56 text-right font-bold text-white">${escapeText(sessionCoverage())}</dd></div>
        <div class="flex items-start justify-between gap-5 py-3"><dt class="text-neutral-500">Paper</dt><dd class="font-bold text-white">${count} questions · ${duration} min</dd></div>
      </dl>`;
  };

  const updateComputedState = () => {
    normalizeQuestionCount();
    renderSessionSpec();
    formSummary.textContent = `${state.classLevel} · ${Store.getModeLabel(state.mode)} · ${questionCountInput.value} questions · ${durationInput.value || 0} minutes`;
  };

  const clearGeneratedResult = () => {
    state.generatedSession = null;
    state.generatedLink = '';
    linkResult.classList.add('hidden');
    linkEmpty.classList.remove('hidden');
    document.getElementById('qr-code').replaceChildren();
  };

  const sessionFromForm = () => {
    const startsAt = dateInputValue(document.getElementById('starts-at'));
    const endsAt = dateInputValue(document.getElementById('ends-at'));
    if (startsAt && endsAt && endsAt <= startsAt) throw new Error('The closing time must be after the opening time.');

    const available = maxQuestions();
    const requestedCount = Number(questionCountInput.value);
    if (available === 0) throw new Error('No questions match this class and exam format.');
    if (!Number.isInteger(requestedCount) || requestedCount < 1 || requestedCount > available) throw new Error(`Choose between 1 and ${available} available questions.`);
    if (state.mode === 'mixed' && (state.subjects.length < 2 || state.subjects.length > 6)) throw new Error('Choose between two and six subjects for a mixed examination.');
    if ((state.mode === 'single' || state.mode === 'waec') && state.subjects.length !== 1) throw new Error('Choose exactly one subject for this examination format.');

    return Store.normalizeSession({
      title: titleInput.value,
      classLevel: state.classLevel,
      mode: state.mode,
      subjects: state.subjects,
      durationMinutes: Number(durationInput.value),
      questionCount: requestedCount,
      status: 'open',
      instructions: document.getElementById('instructions').value,
      startsAt,
      endsAt
    });
  };

  const renderGenerated = (session) => {
    const link = Store.getSessionLink(session, document.baseURI);
    const qrRoot = document.getElementById('qr-code');
    QR.render(qrRoot, link);
    state.generatedSession = session;
    state.generatedLink = link;
    sessionLink.textContent = link;
    openLink.href = link;
    linkEmpty.classList.add('hidden');
    linkResult.classList.remove('hidden');
  };

  const renderSavedSessions = () => {
    const sessions = Store.listSessions();
    if (!sessions.length) {
      savedSessionList.innerHTML = `<div class="p-8 text-center"><p class="font-serif text-2xl font-bold">No sessions yet.</p><p class="mt-2 text-sm text-neutral-600">Create a configuration above and it will be saved here on this browser.</p></div>`;
      return;
    }

    savedSessionList.innerHTML = sessions.map((session, index) => {
      const link = Store.getSessionLink(session, document.baseURI);
      const coverage = session.mode === 'qualifier'
        ? 'Science · Arts · Social Science placement'
        : session.subjects.map((code) => Data.subjectByCode(state.payload, code)?.label || code).join(' · ');
      const statusClass = session.status === 'open' ? 'bg-black text-white' : 'border border-neutral-400 bg-white text-black';
      return `
        <article class="grid gap-5 border-b-2 border-black p-5 last:border-b-0 sm:p-6 lg:grid-cols-12 lg:items-center">
          <div class="lg:col-span-1"><span class="font-serif text-3xl font-bold text-neutral-300">${String(index + 1).padStart(2, '0')}</span></div>
          <div class="min-w-0 lg:col-span-5">
            <div class="flex flex-wrap items-center gap-2"><h3 class="font-serif text-xl font-bold">${escapeText(session.title)}</h3><span class="rounded-full px-2.5 py-1 text-xs font-bold ${statusClass}">${escapeText(session.status)}</span></div>
            <p class="mt-2 text-sm leading-6 text-neutral-600">${escapeText(session.classLevel)} · ${escapeText(Store.getModeLabel(session.mode))} · ${escapeText(coverage)}</p>
            <p class="mt-1 text-xs text-neutral-500">${session.questionCount} questions · ${session.durationMinutes} minutes · ID ${escapeText(session.id)}</p>
          </div>
          <div class="lg:col-span-3">
            <p class="text-xs font-black uppercase tracking-widest text-neutral-500">Access window</p>
            <p class="mt-1 text-sm font-semibold">${session.startsAt ? `Opens ${escapeText(formatDateTime(session.startsAt))}` : 'Open immediately'}</p>
            <p class="mt-1 text-xs text-neutral-500">${session.endsAt ? `Closes ${escapeText(formatDateTime(session.endsAt))}` : 'No closing time'}</p>
          </div>
          <div class="flex flex-wrap gap-2 lg:col-span-3 lg:justify-end">
            <button type="button" data-session-show="${escapeText(session.id)}" class="min-h-10 rounded-xl bg-black px-3 text-xs font-bold text-white hover:bg-neutral-800 focus:outline-none focus:ring-2 focus:ring-black focus:ring-offset-2">Show QR</button>
            <button type="button" data-session-copy="${escapeText(session.id)}" data-session-link="${escapeText(link)}" class="min-h-10 rounded-xl border-2 border-black bg-white px-3 text-xs font-bold hover:bg-neutral-100 focus:outline-none focus:ring-2 focus:ring-black">Copy link</button>
            <button type="button" data-session-delete="${escapeText(session.id)}" class="min-h-10 rounded-xl px-3 text-xs font-bold text-neutral-600 hover:bg-neutral-100 hover:text-black focus:outline-none focus:ring-2 focus:ring-black">Delete</button>
          </div>
        </article>`;
    }).join('');

    savedSessionList.querySelectorAll('[data-session-copy]').forEach((button) => button.addEventListener('click', async () => {
      await copyText(button.dataset.sessionLink);
      showAlert('Session link copied.', 'success');
    }));
    savedSessionList.querySelectorAll('[data-session-show]').forEach((button) => button.addEventListener('click', () => {
      const session = sessions.find((item) => item.id === button.dataset.sessionShow);
      if (!session) return;
      try {
        renderGenerated(session);
        document.getElementById('qr-code').scrollIntoView({ behavior: 'smooth', block: 'center' });
      } catch (error) {
        showAlert(error instanceof Error ? error.message : 'The QR code could not be generated.');
      }
    }));
    savedSessionList.querySelectorAll('[data-session-delete]').forEach((button) => button.addEventListener('click', () => {
      Store.deleteSession(button.dataset.sessionDelete);
      renderSavedSessions();
      showAlert('Session removed from this browser registry.', 'success');
    }));
  };

  const renderAttempts = () => {
    const attempts = Store.getAttempts();
    if (!attempts.length) {
      attemptList.innerHTML = `<div class="p-8 text-center"><p class="font-serif text-2xl font-bold">No local attempts recorded.</p><p class="mt-2 text-sm text-neutral-600">A student attempt made on this same browser and origin will appear here.</p></div>`;
      return;
    }

    attemptList.innerHTML = attempts.map((attempt) => `
      <article class="grid gap-4 border-b border-neutral-200 p-5 last:border-b-0 sm:grid-cols-12 sm:items-center">
        <div class="sm:col-span-5"><p class="font-serif text-lg font-bold">${escapeText(attempt.studentName || 'Unnamed candidate')}</p><p class="mt-1 text-sm text-neutral-600">${escapeText(attempt.sessionTitle)} · ${escapeText(attempt.classLevel)}</p></div>
        <div class="sm:col-span-3"><p class="text-xs font-black uppercase tracking-widest text-neutral-500">Progress</p><p class="mt-1 text-sm font-bold">${attempt.answered} / ${attempt.questionCount} answered</p></div>
        <div class="sm:col-span-4 sm:text-right"><p class="text-xs font-black uppercase tracking-widest text-neutral-500">Attempt</p><p class="mt-1 text-sm font-semibold">${escapeText(attempt.id)}</p><p class="mt-1 text-xs text-neutral-500">${escapeText(formatDateTime(attempt.submittedAt || attempt.startedAt))}</p></div>
      </article>`).join('');
  };

  const copyText = async (text) => {
    if (navigator.clipboard?.writeText) {
      try {
        await navigator.clipboard.writeText(text);
        return;
      } catch {
        // Fall through to a selection-based copy attempt.
      }
    }
    const input = document.createElement('textarea');
    input.value = text;
    input.setAttribute('readonly', '');
    input.className = 'fixed left-0 top-0 size-px opacity-0';
    document.body.appendChild(input);
    input.select();
    document.execCommand('copy');
    input.remove();
  };

  const setMode = (mode) => {
    state.mode = mode;
    forceValidClass();
    state.subjects = [];
    titleInput.value = MODE_COPY[mode].title;
    updateModeControls();
    updateClassControls();
    renderSubjects();
    updateComputedState();
    clearGeneratedResult();
    hideAlert();
  };

  const bind = () => {
    document.querySelectorAll('[data-class-level]').forEach((button) => button.addEventListener('click', () => {
      if (button.disabled) return;
      state.classLevel = button.dataset.classLevel;
      state.subjects = [];
      updateClassControls();
      renderSubjects();
      updateComputedState();
      clearGeneratedResult();
      hideAlert();
    }));

    document.querySelectorAll('[data-mode]').forEach((button) => button.addEventListener('click', () => setMode(button.dataset.mode)));

    [titleInput, durationInput, questionCountInput, document.getElementById('starts-at'), document.getElementById('ends-at'), document.getElementById('instructions')].forEach((input) => input.addEventListener('input', () => {
      updateComputedState();
      clearGeneratedResult();
      hideAlert();
    }));

    form.addEventListener('submit', (event) => {
      event.preventDefault();
      hideAlert();
      try {
        const session = sessionFromForm();
        const filtered = Data.questionsForSession(state.payload, session);
        if (filtered.length !== session.questionCount) throw new Error('The selected question pool cannot satisfy this session exactly.');
        Store.saveSession(session);
        renderGenerated(session);
        renderSavedSessions();
        showAlert('Dynamic session link and QR created. Scan or open it to verify the student entry flow.', 'success');
      } catch (error) {
        showAlert(error instanceof Error ? error.message : 'The session could not be created.');
      }
    });

    copyLink.addEventListener('click', async () => {
      if (!state.generatedLink) return;
      await copyText(state.generatedLink);
      showAlert('Session link copied.', 'success');
    });

    window.addEventListener('storage', (event) => {
      if (event.key?.startsWith('festacol.')) {
        renderSavedSessions();
        renderAttempts();
      }
    });
  };

  const boot = async () => {
    try {
      state.payload = await Data.load();
      updateModeControls();
      updateClassControls();
      renderSubjects();
      updateComputedState();
      renderSavedSessions();
      renderAttempts();
      bind();
    } catch (error) {
      showAlert(error instanceof Error ? error.message : 'Question data could not be loaded.');
      form.querySelectorAll('input, textarea, button').forEach((element) => { element.disabled = true; });
    }
  };

  boot();
})();
