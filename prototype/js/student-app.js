(() => {
  'use strict';

  const Store = window.FestacolSessionStore;
  const Data = window.FestacolQuestionData;
  const root = document.getElementById('app');
  const token = new URL(document.baseURI).searchParams.get('session');

  const ICON = Object.freeze({
    check: '<svg class="size-5" aria-hidden="true" xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="none" viewBox="0 0 24 24"><path stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8.5 11.5 11 14l4-4m6 2a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z"/></svg>',
    flag: '<svg class="size-5" aria-hidden="true" xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="none" viewBox="0 0 24 24"><path stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 14v7M5 4.971v9.541c5.6-5.538 8.4 2.64 14-.086v-9.54C13.4 7.61 10.6-.568 5 4.97Z"/></svg>',
    clock: '<svg class="size-5" aria-hidden="true" xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="none" viewBox="0 0 24 24"><path stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z"/></svg>',
    warn: '<svg class="size-5 shrink-0" aria-hidden="true" xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="none" viewBox="0 0 24 24"><path stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 13V8m0 8h.01M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z"/></svg>'
  });

  const BTN_PRIMARY = 'inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-black px-5 py-3 text-sm font-bold text-white shadow-sm transition duration-200 hover:bg-neutral-800 focus:outline-none focus:ring-2 focus:ring-black focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-40 motion-reduce:transition-none';
  const BTN_LIGHT = 'inline-flex min-h-12 items-center justify-center gap-2 rounded-xl border-2 border-neutral-300 bg-white px-5 py-3 text-sm font-bold text-black transition duration-200 hover:border-black hover:bg-neutral-50 focus:outline-none focus:ring-2 focus:ring-black focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-40 motion-reduce:transition-none';
  const BADGE = 'inline-flex min-h-7 items-center rounded-full border px-3 py-1 text-xs font-bold';
  const FIELD = 'block min-h-12 w-full rounded-xl border-2 border-neutral-300 bg-white px-4 py-3 text-base text-black placeholder:text-neutral-400 transition duration-200 hover:border-neutral-500 focus:border-black focus:outline-none focus:ring-4 focus:ring-neutral-200 motion-reduce:transition-none';

  let payload = null;
  let session = null;
  let questions = [];
  let state = null;
  let tickTimer = null;
  let saveTimer = null;

  const escapeText = (value) => String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');

  const initials = (name) => name.split(/\s+/u).filter(Boolean).slice(0, 2).map((part) => part[0]?.toUpperCase()).join('') || 'ST';
  const formatDateTime = (timestamp) => timestamp ? new Intl.DateTimeFormat('en-NG', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(timestamp)) : 'Not set';

  const getSubjectLabels = () => session.subjects.map((code) => Data.subjectByCode(payload, code)?.label || code);
  const modeLabel = () => Store.getModeLabel(session.mode);
  const examDescriptor = () => {
    if (session.mode === 'qualifier') return 'Science · Arts · Social Science placement';
    const labels = getSubjectLabels();
    if (session.mode === 'mixed') return labels.join(' · ');
    return labels[0] || 'Subject examination';
  };

  const availability = () => {
    const now = Date.now();
    if (session.status !== 'open') return { allowed: false, title: session.status === 'closed' ? 'This session is closed' : 'This session is not open yet', detail: 'Use the current examination link provided by the school.' };
    if (session.startsAt && now < session.startsAt) return { allowed: false, title: 'This session has not started', detail: `It opens ${formatDateTime(session.startsAt)}.` };
    if (session.endsAt && now > session.endsAt) return { allowed: false, title: 'This session has ended', detail: `The access window closed ${formatDateTime(session.endsAt)}.` };
    return { allowed: true };
  };

  const defaultState = () => ({
    version: 2,
    studentName: '',
    activeQuestion: 0,
    responses: {},
    flagged: [],
    startedAt: null,
    endAt: null,
    submittedAt: null,
    attemptId: null,
    view: 'access',
    filter: 'all',
    saveStatus: 'Saved'
  });

  const loadState = () => {
    const saved = Store.getStudentState(session.id);
    if (!saved || saved.version !== 2) return defaultState();
    return { ...defaultState(), ...saved, responses: saved.responses || {}, flagged: Array.isArray(saved.flagged) ? saved.flagged : [] };
  };

  const persist = () => Store.saveStudentState(session.id, state);

  const currentQuestion = () => questions[state.activeQuestion];
  const responseFor = (question) => state.responses[String(question.id)];

  const questionStatus = (question) => {
    const response = responseFor(question);
    if (question.type === 'multi') {
      const count = Array.isArray(response) ? response.length : 0;
      if (!count) return 'unanswered';
      return count === question.requiredSelections ? 'answered' : 'incomplete';
    }
    if (question.type === 'fill' || question.type === 'fill-multi') {
      const blanks = question.fillTemplate.filter((part) => part.blank).map((part) => part.blank);
      const values = response && typeof response === 'object' ? response : {};
      const completed = blanks.filter((key) => String(values[key] || '').trim()).length;
      if (!completed) return 'unanswered';
      return completed === blanks.length ? 'answered' : 'incomplete';
    }
    if (question.type === 'boolean') return response === true || response === false ? 'answered' : 'unanswered';
    return response !== undefined && response !== null && response !== '' ? 'answered' : 'unanswered';
  };

  const answeredCount = () => questions.filter((question) => questionStatus(question) === 'answered').length;
  const incompleteCount = () => questions.filter((question) => questionStatus(question) === 'incomplete').length;
  const unansweredCount = () => questions.filter((question) => questionStatus(question) === 'unanswered').length;

  const stopClock = () => {
    if (tickTimer) window.clearInterval(tickTimer);
    tickTimer = null;
  };

  const remainingMs = () => Math.max(0, Number(state.endAt || 0) - Date.now());

  const scheduleSave = () => {
    state.saveStatus = 'Saving…';
    persist();
    renderExamChrome();
    if (saveTimer) window.clearTimeout(saveTimer);
    saveTimer = window.setTimeout(() => {
      state.saveStatus = 'Saved';
      persist();
      renderExamChrome();
    }, 450);
  };

  const ensureAttemptRecord = (submitted = false) => {
    Store.recordAttempt({
      id: state.attemptId,
      sessionId: session.id,
      sessionTitle: session.title,
      studentName: state.studentName,
      classLevel: session.classLevel,
      mode: session.mode,
      startedAt: state.startedAt,
      submittedAt: submitted ? state.submittedAt : null,
      answered: answeredCount(),
      questionCount: questions.length
    });
  };

  const pageBrand = (inverse = false) => `
    <div class="flex items-center gap-3">
      <span class="grid size-10 place-items-center rounded-xl ${inverse ? 'bg-white text-black' : 'bg-black text-white'} text-sm font-black tracking-tight" aria-hidden="true">F</span>
      <div>
        <strong class="block text-sm font-black tracking-tight">Festacol</strong>
        <span class="block text-xs ${inverse ? 'text-neutral-400' : 'text-neutral-500'}">Student examination</span>
      </div>
    </div>`;

  const shell = (content, options = {}) => {
    root.innerHTML = `
      <main class="min-h-dvh ${options.dark ? 'bg-black text-white' : 'bg-neutral-100 text-black'}">
        ${content}
      </main>`;
  };

  const renderFatal = (eyebrow, title, detail) => {
    stopClock();
    shell(`
      <div class="mx-auto grid min-h-dvh max-w-7xl grid-cols-12 lg:border-x lg:border-neutral-800">
        <section class="col-span-12 flex min-h-72 flex-col justify-between bg-black p-6 text-white sm:p-10 lg:col-span-5 lg:min-h-dvh lg:p-12">
          ${pageBrand(true)}
          <div class="max-w-md py-12">
            <p class="text-xs font-bold uppercase tracking-widest text-neutral-400">${escapeText(eyebrow)}</p>
            <h1 class="mt-5 font-serif text-5xl font-bold leading-none tracking-tight sm:text-6xl">Exam access.</h1>
            <p class="mt-6 max-w-sm text-sm leading-7 text-neutral-300">Festacol opens the exact examination encoded in the link issued by your school.</p>
          </div>
          <span class="text-xs text-neutral-500">No class, subject or exam type is assumed.</span>
        </section>
        <section class="col-span-12 flex items-center bg-white p-6 sm:p-10 lg:col-span-7 lg:min-h-dvh lg:p-16">
          <div class="w-full max-w-xl">
            <span class="${BADGE} border-neutral-300 bg-neutral-50 text-neutral-700">${escapeText(eyebrow)}</span>
            <h2 class="mt-6 font-serif text-4xl font-bold tracking-tight text-black sm:text-5xl">${escapeText(title)}</h2>
            <p class="mt-5 max-w-lg text-base leading-8 text-neutral-600">${escapeText(detail)}</p>
            <div class="mt-8 border-l-4 border-black bg-neutral-100 p-5 text-sm leading-6 text-neutral-700">Open the exact dynamic examination link or scan the QR code provided by your school.</div>
          </div>
        </section>
      </div>`);
  };

  const renderAccess = () => {
    const gate = availability();
    if (!gate.allowed) return renderFatal('Session unavailable', gate.title, gate.detail);

    shell(`
      <div class="mx-auto grid min-h-dvh max-w-7xl grid-cols-12 bg-white lg:border-x lg:border-neutral-300">
        <section class="relative col-span-12 flex min-h-96 flex-col justify-between overflow-hidden bg-black p-6 text-white sm:p-10 lg:col-span-5 lg:min-h-dvh lg:p-12">
          <div class="relative z-10">${pageBrand(true)}</div>
          <div class="relative z-10 py-12">
            <div class="flex flex-wrap gap-2">
              <span class="${BADGE} border-neutral-700 bg-neutral-900 text-neutral-200">${escapeText(session.classLevel)}</span>
              <span class="${BADGE} border-neutral-700 bg-neutral-900 text-neutral-200">${escapeText(modeLabel())}</span>
            </div>
            <p class="mt-10 text-xs font-bold uppercase tracking-widest text-neutral-500">Session ${escapeText(session.id)}</p>
            <h1 class="mt-4 max-w-lg font-serif text-5xl font-bold leading-none tracking-tight sm:text-6xl lg:text-7xl">${escapeText(session.title)}</h1>
            <p class="mt-7 max-w-md text-base leading-7 text-neutral-300">${escapeText(examDescriptor())}</p>
          </div>
          <div class="relative z-10 grid grid-cols-3 border-t border-neutral-800 pt-6">
            <div><span class="block text-2xl font-black tabular-nums">${session.durationMinutes}</span><span class="text-xs text-neutral-500">minutes</span></div>
            <div><span class="block text-2xl font-black tabular-nums">${questions.length}</span><span class="text-xs text-neutral-500">questions</span></div>
            <div><span class="block text-2xl font-black">${escapeText(session.classLevel)}</span><span class="text-xs text-neutral-500">class</span></div>
          </div>
        </section>

        <section class="col-span-12 flex items-center bg-white p-6 sm:p-10 lg:col-span-7 lg:min-h-dvh lg:p-16">
          <div class="w-full max-w-xl lg:mx-auto">
            <p class="text-xs font-bold uppercase tracking-widest text-neutral-500">Candidate identification</p>
            <h2 class="mt-4 font-serif text-4xl font-bold tracking-tight sm:text-5xl">Enter your full name.</h2>
            <p class="mt-4 max-w-lg text-base leading-7 text-neutral-600">Your full name is recorded with this examination attempt on this device so the submission can be identified.</p>

            <form id="identity-form" class="mt-10" novalidate>
              <label for="student-name" class="mb-3 block text-sm font-bold text-black">Full name</label>
              <input id="student-name" name="studentName" type="text" autocomplete="name" class="${FIELD}" placeholder="e.g. Amina Yusuf Bello" value="${escapeText(state.studentName)}" aria-describedby="student-name-help student-name-error">
              <p id="student-name-help" class="mt-3 text-sm leading-6 text-neutral-500">Enter your first name and at least one other name as they should appear on this attempt.</p>
              <p id="student-name-error" class="mt-3 hidden text-sm font-bold text-black" role="alert"></p>

              <div class="mt-8 rounded-2xl border-2 border-black bg-neutral-50 p-5">
                <div class="grid gap-4 sm:grid-cols-2">
                  <div><span class="text-xs font-bold uppercase tracking-wider text-neutral-500">Exam type</span><strong class="mt-1 block text-sm">${escapeText(modeLabel())}</strong></div>
                  <div><span class="text-xs font-bold uppercase tracking-wider text-neutral-500">Coverage</span><strong class="mt-1 block text-sm">${escapeText(examDescriptor())}</strong></div>
                </div>
              </div>

              <button type="submit" class="${BTN_PRIMARY} mt-8 w-full sm:w-auto">Continue to instructions</button>
            </form>
          </div>
        </section>
      </div>`);

    document.getElementById('identity-form').addEventListener('submit', (event) => {
      event.preventDefault();
      const input = document.getElementById('student-name');
      const error = document.getElementById('student-name-error');
      const name = Store.sanitizeName(input.value);
      const parts = name.split(/\s+/u).filter((part) => part.length >= 2);
      if (parts.length < 2) {
        error.textContent = 'Enter your full name using at least two names.';
        error.classList.remove('hidden');
        input.setAttribute('aria-invalid', 'true');
        input.focus();
        return;
      }
      state.studentName = name;
      state.view = state.startedAt ? 'exam' : 'briefing';
      persist();
      render();
    });
  };

  const renderBriefing = () => {
    shell(`
      <div class="min-h-dvh bg-neutral-100">
        <header class="border-b border-neutral-300 bg-white">
          <div class="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-5 sm:px-6 lg:px-8">
            ${pageBrand(false)}
            <div class="flex items-center gap-3">
              <div class="hidden text-right sm:block"><strong class="block text-sm">${escapeText(state.studentName)}</strong><span class="text-xs text-neutral-500">${escapeText(session.classLevel)}</span></div>
              <span class="grid size-10 place-items-center rounded-full bg-black text-xs font-black text-white" aria-hidden="true">${escapeText(initials(state.studentName))}</span>
            </div>
          </div>
        </header>

        <div class="mx-auto max-w-7xl px-4 py-8 sm:px-6 sm:py-12 lg:px-8">
          <div class="grid grid-cols-12 gap-6">
            <section class="col-span-12 overflow-hidden rounded-3xl bg-black text-white lg:col-span-8">
              <div class="p-7 sm:p-10 lg:p-12">
                <div class="flex flex-wrap gap-2">
                  <span class="${BADGE} border-neutral-700 bg-neutral-900 text-white">${escapeText(session.classLevel)}</span>
                  <span class="${BADGE} border-neutral-700 bg-neutral-900 text-white">${escapeText(modeLabel())}</span>
                  <span class="${BADGE} border-neutral-700 bg-neutral-900 text-white">Session ${escapeText(session.id)}</span>
                </div>
                <h1 class="mt-10 max-w-3xl font-serif text-5xl font-bold leading-none tracking-tight sm:text-6xl">${escapeText(session.title)}</h1>
                <p class="mt-6 max-w-2xl text-base leading-8 text-neutral-300">${escapeText(examDescriptor())}</p>
              </div>
              <div class="grid grid-cols-2 border-t border-neutral-800 sm:grid-cols-4">
                ${[
                  ['Duration', `${session.durationMinutes} min`],
                  ['Questions', String(questions.length)],
                  ['Class', session.classLevel],
                  ['Identity', state.studentName]
                ].map(([label, value]) => `<div class="border-b border-neutral-800 p-5 last:border-b-0 sm:border-b-0 sm:border-r sm:last:border-r-0"><span class="block text-xs uppercase tracking-wider text-neutral-500">${escapeText(label)}</span><strong class="mt-2 block truncate text-sm text-white">${escapeText(value)}</strong></div>`).join('')}
              </div>
            </section>

            <aside class="col-span-12 rounded-3xl border-2 border-black bg-white p-6 lg:col-span-4 lg:p-8">
              <p class="text-xs font-bold uppercase tracking-widest text-neutral-500">Before you begin</p>
              <ol class="mt-6 space-y-5 text-sm leading-6 text-neutral-700">
                <li class="flex gap-3"><span class="grid size-7 shrink-0 place-items-center rounded-full bg-black text-xs font-black text-white">1</span><span>The timer starts only after you press <strong>Start examination</strong>.</span></li>
                <li class="flex gap-3"><span class="grid size-7 shrink-0 place-items-center rounded-full bg-black text-xs font-black text-white">2</span><span>Your answers are saved on this device as you move between questions.</span></li>
                <li class="flex gap-3"><span class="grid size-7 shrink-0 place-items-center rounded-full bg-black text-xs font-black text-white">3</span><span>You can flag questions and review them before final submission.</span></li>
              </ol>
              ${session.instructions ? `<div class="mt-7 border-l-4 border-black bg-neutral-100 p-4 text-sm leading-6 text-neutral-700"><strong class="block text-black">School instruction</strong><span class="mt-1 block">${escapeText(session.instructions)}</span></div>` : ''}
              ${session.mode === 'qualifier' ? `<div class="mt-7 rounded-2xl bg-neutral-950 p-5 text-sm leading-6 text-neutral-300"><strong class="block text-white">Placement qualifier</strong><span class="mt-1 block">This session is configured to support later Science, Arts or Social Science stream-placement review. The prototype does not calculate that placement on the device.</span></div>` : ''}
              <button id="start-exam" type="button" class="${BTN_PRIMARY} mt-8 w-full">Start examination</button>
              <button id="change-name" type="button" class="mt-3 min-h-11 w-full text-sm font-bold text-neutral-600 underline decoration-neutral-300 underline-offset-4 hover:text-black focus:outline-none focus:ring-2 focus:ring-black">Change candidate name</button>
            </aside>
          </div>
        </div>
      </div>`);

    document.getElementById('start-exam').addEventListener('click', () => {
      state.startedAt = Date.now();
      state.endAt = state.startedAt + session.durationMinutes * 60_000;
      state.attemptId = state.attemptId || `${session.id}-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
      state.view = 'exam';
      persist();
      ensureAttemptRecord(false);
      render();
    });
    document.getElementById('change-name').addEventListener('click', () => {
      state.view = 'access';
      persist();
      render();
    });
  };

  const renderTriangleDiagram = () => `
    <figure class="mb-8 max-w-2xl rounded-2xl border-2 border-black bg-neutral-50 p-6">
      <svg class="h-auto w-full text-black" viewBox="0 0 560 280" role="img" aria-labelledby="triangle-title triangle-desc">
        <title id="triangle-title">Triangle ABC</title>
        <desc id="triangle-desc">A triangle with A at the left base, B at the right base and C at the top. Angle A is 50 degrees and angle B is 65 degrees.</desc>
        <path d="M80 230 L480 230 L300 45 Z" fill="none" stroke="currentColor" stroke-width="4" stroke-linejoin="round"/>
        <text x="62" y="255" font-size="22" fill="currentColor">A</text><text x="488" y="255" font-size="22" fill="currentColor">B</text><text x="292" y="32" font-size="22" fill="currentColor">C</text>
        <text x="120" y="215" font-size="20" fill="currentColor">50°</text><text x="410" y="215" font-size="20" fill="currentColor">65°</text>
      </svg>
      <figcaption class="mt-4 text-sm font-semibold text-neutral-600">Figure for this question</figcaption>
    </figure>`;

  const renderTable = (table) => `
    <div class="mb-8 overflow-hidden rounded-2xl border-2 border-black">
      <table class="w-full text-left text-sm"><thead class="bg-black text-white"><tr>${table.headers.map((header) => `<th scope="col" class="px-4 py-3 font-bold">${escapeText(header)}</th>`).join('')}</tr></thead><tbody class="divide-y divide-neutral-200">${table.rows.map((row) => `<tr>${row.map((cell) => `<td class="px-4 py-3 text-neutral-700">${escapeText(cell)}</td>`).join('')}</tr>`).join('')}</tbody></table>
    </div>`;

  const renderOptions = (question, inputType) => {
    const response = responseFor(question);
    const selected = inputType === 'checkbox' ? (Array.isArray(response) ? response : []) : [response];
    return `<fieldset class="space-y-3"><legend class="sr-only">Answer choices</legend>${question.options.map((option, index) => {
      const checked = selected.includes(index);
      return `<label class="group flex min-h-16 cursor-pointer items-center gap-4 rounded-2xl border-2 ${checked ? 'border-black bg-black text-white shadow-lg' : 'border-neutral-300 bg-white text-black hover:border-black hover:bg-neutral-50'} px-5 py-4 transition duration-200 focus-within:ring-4 focus-within:ring-neutral-200 motion-reduce:transition-none">
        <input class="sr-only" type="${inputType}" name="question-${question.id}" value="${index}" ${checked ? 'checked' : ''}>
        <span class="grid size-9 shrink-0 place-items-center rounded-full border-2 ${checked ? 'border-white bg-white text-black' : 'border-neutral-400 bg-white text-black'} text-xs font-black">${String.fromCharCode(65 + index)}</span>
        <span class="text-base font-semibold leading-6">${escapeText(option)}</span>
      </label>`;
    }).join('')}</fieldset>`;
  };

  const renderBoolean = (question) => {
    const response = responseFor(question);
    return `<fieldset class="grid gap-3 sm:grid-cols-2"><legend class="sr-only">True or false</legend>${[[true, 'True'], [false, 'False']].map(([value, label]) => {
      const checked = response === value;
      return `<label class="flex min-h-20 cursor-pointer items-center justify-center rounded-2xl border-2 ${checked ? 'border-black bg-black text-white shadow-lg' : 'border-neutral-300 bg-white text-black hover:border-black'} px-6 text-lg font-black transition duration-200 focus-within:ring-4 focus-within:ring-neutral-200 motion-reduce:transition-none"><input class="sr-only" type="radio" name="question-${question.id}" value="${value}" ${checked ? 'checked' : ''}>${label}</label>`;
    }).join('')}</fieldset>`;
  };

  const renderFill = (question) => {
    const response = responseFor(question) || {};
    return `<div class="rounded-2xl border-2 border-black bg-neutral-50 p-6"><div class="flex flex-wrap items-baseline gap-2 text-lg font-semibold leading-10">${question.fillTemplate.map((part) => part.text ? `<span>${escapeText(part.text)}</span>` : `<span class="inline-block min-w-48"><label class="sr-only" for="q${question.id}-${part.blank}">Answer for blank</label><input id="q${question.id}-${part.blank}" data-blank="${part.blank}" type="text" autocomplete="off" value="${escapeText(response[part.blank] || '')}" placeholder="${escapeText(part.placeholder || 'answer')}" class="block min-h-11 w-full border-0 border-b-2 border-black bg-transparent px-2 py-1 text-center text-base font-bold text-black placeholder:text-neutral-400 focus:border-black focus:outline-none focus:ring-0"></span>`).join('')}</div></div>`;
  };

  const renderQuestionBody = (question) => {
    const prefix = `${question.diagram === 'triangle' ? renderTriangleDiagram() : ''}${question.table ? renderTable(question.table) : ''}`;
    if (question.type === 'single') return prefix + renderOptions(question, 'radio');
    if (question.type === 'multi') return prefix + renderOptions(question, 'checkbox');
    if (question.type === 'boolean') return prefix + renderBoolean(question);
    if (question.type === 'fill' || question.type === 'fill-multi') return prefix + renderFill(question);
    return '';
  };

  const renderExamChrome = () => {
    const q = currentQuestion();
    const progress = document.getElementById('exam-progress');
    const answered = document.getElementById('answered-count');
    const save = document.getElementById('save-status');
    const timer = document.getElementById('timer-text');
    const subject = document.getElementById('current-subject');
    if (progress) progress.textContent = `${state.activeQuestion + 1} / ${questions.length}`;
    if (answered) answered.textContent = `${answeredCount()} answered`;
    if (save) save.textContent = state.saveStatus;
    if (subject && q) subject.textContent = q.subject;
    if (timer && state.endAt) {
      const remaining = remainingMs();
      const totalSeconds = Math.ceil(remaining / 1000);
      const minutes = Math.floor(totalSeconds / 60);
      const seconds = totalSeconds % 60;
      timer.textContent = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
      const timerBox = document.getElementById('timer-box');
      if (timerBox) {
        timerBox.className = remaining <= 5 * 60_000
          ? 'flex min-h-12 items-center gap-2 rounded-xl bg-white px-4 text-sm font-black tabular-nums text-black ring-4 ring-white/20'
          : 'flex min-h-12 items-center gap-2 rounded-xl border border-neutral-700 bg-neutral-900 px-4 text-sm font-black tabular-nums text-white';
      }
      if (remaining <= 0 && !state.submittedAt) completeSubmission(true);
    }
  };

  const startClock = () => {
    stopClock();
    renderExamChrome();
    tickTimer = window.setInterval(renderExamChrome, 1000);
  };

  const navigatorButton = (question, index) => {
    const status = questionStatus(question);
    const active = index === state.activeQuestion;
    const flagged = state.flagged.includes(question.id);
    const base = 'relative grid size-11 place-items-center rounded-xl border text-xs font-black transition duration-150 focus:outline-none focus:ring-2 focus:ring-white focus:ring-offset-2 focus:ring-offset-black motion-reduce:transition-none';
    const cls = active ? 'border-white bg-white text-black' : status === 'answered' ? 'border-neutral-600 bg-neutral-800 text-white hover:bg-neutral-700' : status === 'incomplete' ? 'border-dashed border-neutral-400 bg-black text-white' : 'border-neutral-700 bg-black text-neutral-400 hover:border-white hover:text-white';
    return `<button type="button" data-question-index="${index}" class="${base} ${cls}" aria-label="Question ${index + 1}, ${status}${flagged ? ', flagged' : ''}">${index + 1}${flagged ? '<span class="absolute -right-1 -top-1 size-2 rounded-full bg-white ring-2 ring-black" aria-hidden="true"></span>' : ''}</button>`;
  };

  const renderNavigator = () => {
    const grid = document.getElementById('question-grid');
    if (!grid) return;
    const items = questions.map((question, index) => ({ question, index })).filter(({ question }) => {
      if (state.filter === 'flagged') return state.flagged.includes(question.id);
      if (state.filter === 'unanswered') return questionStatus(question) !== 'answered';
      return true;
    });
    grid.innerHTML = items.length ? items.map(({ question, index }) => navigatorButton(question, index)).join('') : '<p class="col-span-5 py-6 text-center text-sm text-neutral-400">No questions in this filter.</p>';
    grid.querySelectorAll('[data-question-index]').forEach((button) => button.addEventListener('click', () => {
      state.activeQuestion = Number(button.dataset.questionIndex);
      persist();
      renderExam();
    }));
  };

  const bindQuestion = (question) => {
    document.querySelectorAll(`input[name="question-${question.id}"]`).forEach((input) => input.addEventListener('change', () => {
      if (question.type === 'multi') {
        const selected = [...document.querySelectorAll(`input[name="question-${question.id}"]:checked`)].map((item) => Number(item.value));
        if (selected.length > question.requiredSelections) {
          input.checked = false;
          return;
        }
        state.responses[String(question.id)] = selected;
      } else if (question.type === 'boolean') {
        state.responses[String(question.id)] = input.value === 'true';
      } else {
        state.responses[String(question.id)] = Number(input.value);
      }
      scheduleSave();
      renderExam();
    }));
    document.querySelectorAll('[data-blank]').forEach((input) => input.addEventListener('input', () => {
      const existing = state.responses[String(question.id)] || {};
      state.responses[String(question.id)] = { ...existing, [input.dataset.blank]: input.value };
      scheduleSave();
      renderNavigator();
      renderExamChrome();
    }));
  };

  const renderExam = () => {
    state.view = 'exam';
    persist();
    const question = currentQuestion();
    shell(`
      <div class="min-h-dvh bg-neutral-100">
        <header class="sticky top-0 z-30 bg-black text-white shadow-xl">
          <div class="mx-auto grid max-w-7xl grid-cols-12 items-center gap-3 px-4 py-3 sm:px-6 lg:px-8">
            <div class="col-span-7 flex min-w-0 items-center gap-3 lg:col-span-5">
              <span class="grid size-10 shrink-0 place-items-center rounded-xl bg-white text-sm font-black text-black" aria-hidden="true">F</span>
              <div class="min-w-0"><strong class="block truncate text-sm font-black">${escapeText(session.title)}</strong><span class="block truncate text-xs text-neutral-400">${escapeText(state.studentName)} · ${escapeText(session.classLevel)}</span></div>
            </div>
            <div class="col-span-5 hidden text-center lg:col-span-3 lg:block"><span id="current-subject" class="text-xs font-bold uppercase tracking-widest text-neutral-400">${escapeText(question.subject)}</span><strong id="exam-progress" class="mt-1 block text-sm">${state.activeQuestion + 1} / ${questions.length}</strong></div>
            <div class="col-span-5 flex items-center justify-end gap-2 lg:col-span-4">
              <button id="mobile-nav" type="button" class="min-h-12 rounded-xl border border-neutral-700 bg-neutral-900 px-3 text-xs font-bold text-white hover:bg-neutral-800 focus:outline-none focus:ring-2 focus:ring-white lg:hidden">Questions</button>
              <div id="timer-box" class="flex min-h-12 items-center gap-2 rounded-xl border border-neutral-700 bg-neutral-900 px-4 text-sm font-black tabular-nums text-white">${ICON.clock}<span id="timer-text">--:--</span></div>
              <div class="hidden min-h-12 items-center gap-2 rounded-xl border border-neutral-700 bg-neutral-900 px-4 text-xs font-bold text-neutral-300 sm:flex">${ICON.check}<span id="save-status">${escapeText(state.saveStatus)}</span></div>
            </div>
          </div>
        </header>

        <div class="mx-auto grid max-w-7xl grid-cols-12 gap-6 px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
          <section class="col-span-12 min-w-0 lg:col-span-9">
            <article class="overflow-hidden rounded-3xl border-2 border-black bg-white shadow-xl shadow-neutral-300/50">
              <div class="border-b-2 border-black bg-neutral-50 px-6 py-4 sm:px-8">
                <div class="flex flex-wrap items-center justify-between gap-3">
                  <div class="flex items-center gap-3"><span class="grid size-9 place-items-center rounded-full bg-black text-xs font-black text-white">${state.activeQuestion + 1}</span><div><span class="block text-xs font-bold uppercase tracking-widest text-neutral-500">${escapeText(question.subject)}</span><span class="text-xs text-neutral-500">${escapeText(question.label)}</span></div></div>
                  <span id="answered-count" class="${BADGE} border-neutral-300 bg-white text-neutral-600">${answeredCount()} answered</span>
                </div>
              </div>
              <div class="p-6 sm:p-8 lg:p-10">
                ${question.passage ? `<div class="mb-8 border-l-4 border-black bg-neutral-100 p-5"><p class="text-xs font-black uppercase tracking-widest text-neutral-500">Read the passage</p><p class="mt-3 max-w-3xl text-base leading-8 text-neutral-700">${escapeText(question.passage)}</p></div>` : ''}
                <h1 class="max-w-4xl font-serif text-3xl font-bold leading-tight tracking-tight text-black sm:text-4xl">${escapeText(question.prompt)}</h1>
                ${question.instruction ? `<p class="mt-4 text-sm font-bold text-neutral-600">${escapeText(question.instruction)}</p>` : ''}
                <div class="mt-9">${renderQuestionBody(question)}</div>
              </div>
              <footer class="flex flex-wrap items-center justify-between gap-3 border-t-2 border-black bg-white p-4 sm:p-5">
                <div class="flex flex-1 gap-2 sm:flex-none">
                  <button id="flag" type="button" class="${state.flagged.includes(question.id) ? 'inline-flex min-h-12 flex-1 items-center justify-center gap-2 rounded-xl bg-black px-4 text-sm font-bold text-white sm:flex-none' : BTN_LIGHT + ' flex-1 sm:flex-none'}" aria-pressed="${state.flagged.includes(question.id)}">${ICON.flag}${state.flagged.includes(question.id) ? 'Flagged' : 'Flag'}</button>
                  <button id="clear" type="button" class="min-h-12 flex-1 rounded-xl px-4 text-sm font-bold text-neutral-600 underline decoration-neutral-300 underline-offset-4 hover:text-black focus:outline-none focus:ring-2 focus:ring-black sm:flex-none">Clear</button>
                </div>
                <div class="flex flex-1 gap-2 sm:flex-none">
                  <button id="previous" type="button" class="${BTN_LIGHT} flex-1 sm:flex-none" ${state.activeQuestion === 0 ? 'disabled' : ''}>Previous</button>
                  <button id="next" type="button" class="${BTN_PRIMARY} flex-1 sm:flex-none">${state.activeQuestion === questions.length - 1 ? 'Review answers' : 'Next'}</button>
                </div>
              </footer>
            </article>
          </section>

          <aside id="desktop-navigator" class="col-span-3 hidden lg:block">
            <div class="sticky top-24 overflow-hidden rounded-3xl bg-black p-5 text-white shadow-xl">
              <div class="border-b border-neutral-800 pb-5"><p class="text-xs font-bold uppercase tracking-widest text-neutral-500">Question map</p><div class="mt-2 flex items-end justify-between"><strong class="font-serif text-3xl">${questions.length}</strong><span class="text-xs text-neutral-400">${answeredCount()} complete</span></div></div>
              <div class="mt-5 grid grid-cols-3 gap-1 rounded-xl bg-neutral-900 p-1" role="group" aria-label="Question filters">
                ${['all','unanswered','flagged'].map((filter) => `<button type="button" data-filter="${filter}" class="min-h-10 rounded-lg ${state.filter === filter ? 'bg-white text-black' : 'text-neutral-400 hover:text-white'} px-2 text-xs font-bold capitalize focus:outline-none focus:ring-2 focus:ring-white">${filter}</button>`).join('')}
              </div>
              <div id="question-grid" class="mt-5 grid grid-cols-5 gap-2"></div>
              <button id="review-now" type="button" class="mt-6 min-h-12 w-full rounded-xl bg-white px-4 text-sm font-black text-black hover:bg-neutral-200 focus:outline-none focus:ring-2 focus:ring-white focus:ring-offset-2 focus:ring-offset-black">Review answers</button>
            </div>
          </aside>
        </div>

        <div id="mobile-drawer" class="fixed inset-0 z-50 hidden bg-black/70 p-4 lg:hidden" aria-hidden="true">
          <div class="ml-auto h-full w-full max-w-sm overflow-y-auto rounded-3xl bg-black p-5 text-white shadow-2xl">
            <div class="flex items-center justify-between border-b border-neutral-800 pb-4"><div><p class="text-xs font-bold uppercase tracking-widest text-neutral-500">Question map</p><strong class="mt-1 block text-lg">${answeredCount()} / ${questions.length} answered</strong></div><button id="close-mobile-nav" type="button" class="grid size-11 place-items-center rounded-xl border border-neutral-700 hover:bg-neutral-900 focus:outline-none focus:ring-2 focus:ring-white" aria-label="Close question map"><svg class="size-5" aria-hidden="true" xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="none" viewBox="0 0 24 24"><path stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18 17.94 6M18 18 6.06 6"/></svg></button></div>
            <div class="mt-5 grid grid-cols-3 gap-1 rounded-xl bg-neutral-900 p-1">${['all','unanswered','flagged'].map((filter) => `<button type="button" data-filter="${filter}" class="min-h-10 rounded-lg ${state.filter === filter ? 'bg-white text-black' : 'text-neutral-400'} px-2 text-xs font-bold capitalize">${filter}</button>`).join('')}</div>
            <div id="mobile-question-grid" class="mt-5 grid grid-cols-5 gap-2"></div>
            <button id="mobile-review" type="button" class="mt-6 min-h-12 w-full rounded-xl bg-white px-4 text-sm font-black text-black">Review answers</button>
          </div>
        </div>
      </div>`);

    renderNavigator();
    const mobileGrid = document.getElementById('mobile-question-grid');
    if (mobileGrid) {
      mobileGrid.innerHTML = document.getElementById('question-grid').innerHTML;
      mobileGrid.querySelectorAll('[data-question-index]').forEach((button) => button.addEventListener('click', () => {
        state.activeQuestion = Number(button.dataset.questionIndex);
        persist();
        renderExam();
      }));
    }
    bindQuestion(question);
    renderExamChrome();
    startClock();

    document.getElementById('previous').addEventListener('click', () => { if (state.activeQuestion > 0) { state.activeQuestion -= 1; persist(); renderExam(); } });
    document.getElementById('next').addEventListener('click', () => { if (state.activeQuestion < questions.length - 1) { state.activeQuestion += 1; persist(); renderExam(); } else { state.view = 'review'; persist(); render(); } });
    document.getElementById('flag').addEventListener('click', () => {
      state.flagged = state.flagged.includes(question.id) ? state.flagged.filter((id) => id !== question.id) : [...state.flagged, question.id];
      scheduleSave();
      renderExam();
    });
    document.getElementById('clear').addEventListener('click', () => { delete state.responses[String(question.id)]; scheduleSave(); renderExam(); });
    document.querySelectorAll('[data-filter]').forEach((button) => button.addEventListener('click', () => { state.filter = button.dataset.filter; persist(); renderExam(); }));
    document.getElementById('review-now').addEventListener('click', () => { state.view = 'review'; persist(); render(); });
    document.getElementById('mobile-review').addEventListener('click', () => { state.view = 'review'; persist(); render(); });
    document.getElementById('mobile-nav').addEventListener('click', () => { const drawer = document.getElementById('mobile-drawer'); drawer.classList.remove('hidden'); drawer.setAttribute('aria-hidden','false'); });
    document.getElementById('close-mobile-nav').addEventListener('click', () => { const drawer = document.getElementById('mobile-drawer'); drawer.classList.add('hidden'); drawer.setAttribute('aria-hidden','true'); });
  };

  const renderReview = () => {
    stopClock();
    shell(`
      <div class="min-h-dvh bg-neutral-100">
        <header class="bg-black text-white"><div class="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-4 sm:px-6 lg:px-8">${pageBrand(true)}<div id="review-timer" class="flex min-h-12 items-center gap-2 rounded-xl border border-neutral-700 bg-neutral-900 px-4 text-sm font-black tabular-nums">${ICON.clock}<span id="timer-text">--:--</span></div></div></header>
        <div class="mx-auto max-w-7xl px-4 py-8 sm:px-6 sm:py-12 lg:px-8">
          <div class="grid grid-cols-12 gap-6">
            <section class="col-span-12 lg:col-span-8">
              <p class="text-xs font-bold uppercase tracking-widest text-neutral-500">Final review</p>
              <h1 class="mt-4 font-serif text-5xl font-bold tracking-tight text-black sm:text-6xl">Check before you submit.</h1>
              <p class="mt-5 max-w-2xl text-base leading-8 text-neutral-600">You can return to any question. Submission ends this attempt and cannot be undone in the prototype.</p>
              <div class="mt-8 grid gap-3 sm:grid-cols-3">
                ${[['Answered', answeredCount(), 'bg-black text-white'], ['Unanswered', unansweredCount(), 'bg-white text-black'], ['Incomplete', incompleteCount(), 'bg-white text-black']].map(([label, count, cls]) => `<div class="rounded-2xl border-2 border-black ${cls} p-5"><span class="text-xs font-bold uppercase tracking-wider opacity-70">${label}</span><strong class="mt-3 block font-serif text-4xl">${count}</strong></div>`).join('')}
              </div>
              <div class="mt-8 overflow-hidden rounded-3xl border-2 border-black bg-white">
                ${questions.map((question, index) => { const status = questionStatus(question); return `<button type="button" data-open-question="${index}" class="grid w-full grid-cols-12 items-center gap-3 border-b border-neutral-200 px-5 py-4 text-left last:border-b-0 hover:bg-neutral-50 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-black"><span class="col-span-2 grid size-10 place-items-center rounded-xl ${status === 'answered' ? 'bg-black text-white' : 'border-2 border-black bg-white text-black'} text-xs font-black sm:col-span-1">${index + 1}</span><span class="col-span-7 min-w-0 sm:col-span-8"><strong class="block truncate text-sm">${escapeText(question.subject)}</strong><span class="mt-1 block truncate text-xs text-neutral-500">${escapeText(question.prompt)}</span></span><span class="col-span-3 text-right text-xs font-bold uppercase tracking-wider text-neutral-500">${status}${state.flagged.includes(question.id) ? ' · flagged' : ''}</span></button>`; }).join('')}
              </div>
            </section>
            <aside class="col-span-12 lg:col-span-4">
              <div class="sticky top-6 rounded-3xl bg-black p-7 text-white shadow-xl">
                <p class="text-xs font-bold uppercase tracking-widest text-neutral-500">Candidate</p>
                <div class="mt-4 flex items-center gap-3"><span class="grid size-12 place-items-center rounded-full bg-white text-sm font-black text-black">${escapeText(initials(state.studentName))}</span><div><strong class="block">${escapeText(state.studentName)}</strong><span class="text-xs text-neutral-400">${escapeText(session.classLevel)} · ${escapeText(modeLabel())}</span></div></div>
                <div class="mt-7 border-t border-neutral-800 pt-6"><span class="text-xs uppercase tracking-wider text-neutral-500">Session</span><strong class="mt-1 block text-sm">${escapeText(session.title)}</strong></div>
                <button id="back-exam" type="button" class="mt-8 min-h-12 w-full rounded-xl border border-neutral-600 bg-neutral-900 px-4 text-sm font-bold text-white hover:bg-neutral-800 focus:outline-none focus:ring-2 focus:ring-white">Return to questions</button>
                <button id="submit-exam" type="button" class="mt-3 min-h-12 w-full rounded-xl bg-white px-4 text-sm font-black text-black hover:bg-neutral-200 focus:outline-none focus:ring-2 focus:ring-white focus:ring-offset-2 focus:ring-offset-black">Submit examination</button>
                <p class="mt-4 text-xs leading-5 text-neutral-500">${unansweredCount() + incompleteCount() ? `${unansweredCount() + incompleteCount()} response(s) still need attention.` : 'All questions have complete responses.'}</p>
              </div>
            </aside>
          </div>
        </div>
      </div>`);
    startClock();
    document.querySelectorAll('[data-open-question]').forEach((button) => button.addEventListener('click', () => { state.activeQuestion = Number(button.dataset.openQuestion); state.view='exam'; persist(); render(); }));
    document.getElementById('back-exam').addEventListener('click', () => { state.view='exam'; persist(); render(); });
    document.getElementById('submit-exam').addEventListener('click', () => completeSubmission(false));
  };

  const completeSubmission = (automatic) => {
    if (state.submittedAt) return;
    state.submittedAt = Date.now();
    state.view = 'submitted';
    persist();
    ensureAttemptRecord(true);
    stopClock();
    renderSubmitted(automatic);
  };

  const renderSubmitted = (automatic = false) => {
    stopClock();
    shell(`
      <div class="mx-auto grid min-h-dvh max-w-7xl grid-cols-12 bg-white lg:border-x lg:border-neutral-300">
        <section class="col-span-12 flex flex-col justify-between bg-black p-6 text-white sm:p-10 lg:col-span-5 lg:min-h-dvh lg:p-12">
          ${pageBrand(true)}
          <div class="py-12"><span class="grid size-16 place-items-center rounded-full bg-white text-black">${ICON.check}</span><p class="mt-8 text-xs font-bold uppercase tracking-widest text-neutral-500">Attempt received</p><h1 class="mt-4 font-serif text-5xl font-bold leading-none sm:text-6xl">Submitted.</h1><p class="mt-6 max-w-sm text-base leading-7 text-neutral-300">${automatic ? 'Time expired and the local attempt was submitted automatically.' : 'Your local examination attempt has been recorded successfully.'}</p></div>
          <span class="text-xs text-neutral-500">Session ${escapeText(session.id)}</span>
        </section>
        <section class="col-span-12 flex items-center p-6 sm:p-10 lg:col-span-7 lg:min-h-dvh lg:p-16"><div class="w-full max-w-xl lg:mx-auto"><p class="text-xs font-bold uppercase tracking-widest text-neutral-500">Submission receipt</p><h2 class="mt-4 font-serif text-4xl font-bold sm:text-5xl">${escapeText(state.studentName)}</h2><div class="mt-8 overflow-hidden rounded-3xl border-2 border-black">${[['Examination',session.title],['Class',session.classLevel],['Type',modeLabel()],['Coverage',examDescriptor()],['Answered',`${answeredCount()} of ${questions.length}`],['Submitted',formatDateTime(state.submittedAt)],['Attempt ID',state.attemptId]].map(([label,value])=>`<div class="grid grid-cols-12 gap-3 border-b border-neutral-200 px-5 py-4 last:border-b-0"><span class="col-span-4 text-xs font-bold uppercase tracking-wider text-neutral-500">${escapeText(label)}</span><strong class="col-span-8 text-sm text-black">${escapeText(value)}</strong></div>`).join('')}</div><p class="mt-6 text-sm leading-6 text-neutral-600">Results or stream-placement decisions are not calculated in this browser prototype.</p></div></section>
      </div>`);
  };

  const render = () => {
    if (!session || !questions.length) return;
    if (state.submittedAt) return renderSubmitted(false);
    if (state.startedAt && remainingMs() <= 0) return completeSubmission(true);
    if (!state.studentName || state.view === 'access') return renderAccess();
    if (!state.startedAt || state.view === 'briefing') return renderBriefing();
    if (state.view === 'review') return renderReview();
    return renderExam();
  };

  const init = async () => {
    if (!Store || !Data) return renderFatal('Configuration error', 'The examination application could not start', 'Required prototype modules are unavailable.');
    if (!token) return renderFatal('Dynamic link required', 'No examination session was found', 'This page does not select a class, subject or examination by default.');
    try {
      session = Store.decodeSession(token);
    } catch (error) {
      return renderFatal('Invalid examination link', 'This examination link cannot be used', error.message);
    }
    try {
      payload = await Data.load();
      questions = Data.questionsForSession(payload, session);
    } catch (error) {
      return renderFatal('Question data unavailable', 'The question set could not be loaded', error.message);
    }
    if (questions.length !== session.questionCount) {
      return renderFatal('Session configuration mismatch', 'This examination cannot start safely', `The link requests ${session.questionCount} questions but ${questions.length} matching questions are currently available.`);
    }
    state = loadState();
    render();
  };

  init();
})();
