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

  const BTN_PRIMARY = 'btn btn-primary';
  const BTN_LIGHT = 'btn btn-secondary';
  const BADGE = 'badge';
  const FIELD = 'exam-field';
  const ART = Object.freeze({
    student: 'https://raw.githubusercontent.com/themesberg/flowbite-illustrations/main/src/3d/light/woman-laptop-chart.svg',
    question: 'https://raw.githubusercontent.com/themesberg/flowbite-illustrations/main/src/3d/light/man-question-marks.svg',
    auth: 'https://raw.githubusercontent.com/themesberg/flowbite-illustrations/main/src/3d/light/authentication-form-fields.svg',
    connect: 'https://raw.githubusercontent.com/themesberg/flowbite-illustrations/main/src/3d/light/people-connecting.svg'
  });

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

  const pageBrand = () => `
    <div class="flex items-center gap-3">
      <span class="brand-mark" aria-hidden="true">F</span>
      <div>
        <strong class="block font-display text-sm font-extrabold tracking-[-.025em] text-slate-950">Festacol</strong>
        <span class="block text-[11px] font-semibold text-slate-500">Examination workspace</span>
      </div>
    </div>`;

  const shell = (content) => {
    root.innerHTML = `<main class="min-h-dvh text-slate-900">${content}</main>`;
  };

  const dashboardUrl = () => {
    const target = new URL('./student.html', location.href);
    target.search = '';
    if (token) target.searchParams.set('session', token);
    return target.href;
  };

  const renderFatal = (eyebrow, title, detail) => {
    stopClock();
    shell(`
      <div class="mx-auto flex min-h-dvh max-w-6xl items-center px-4 py-10 sm:px-6 lg:px-8">
        <section class="surface-raised grid w-full overflow-hidden lg:grid-cols-[1fr_340px]">
          <div class="p-6 sm:p-10 lg:p-12">${pageBrand()}<span class="badge badge-danger mt-10">${escapeText(eyebrow)}</span><h1 class="mt-5 max-w-2xl font-display text-4xl font-extrabold tracking-tight text-slate-950 sm:text-5xl">${escapeText(title)}</h1><p class="mt-4 max-w-xl text-base leading-7 text-slate-600">${escapeText(detail)}</p><div class="alert alert-info mt-7 max-w-xl"><span>Open the exact dynamic examination link or scan the QR code issued by your school. Festacol never guesses your class, subject or paper.</span></div><a href="./student.html" class="btn btn-primary mt-7">Go to student dashboard</a></div>
          <div class="illustration-well m-4 grid min-h-72 place-items-center p-6 lg:m-5"><img src="${ART.question}" alt="Student looking for the correct examination access" class="h-64 w-full object-contain"></div>
        </section>
      </div>`);
  };

  const renderAccess = () => {
    const gate = availability();
    if (!gate.allowed) return renderFatal('Session unavailable', gate.title, gate.detail);
    shell(`<div class="mx-auto flex min-h-dvh max-w-5xl items-center px-4 py-10 sm:px-6"><section class="surface-brand grid w-full overflow-hidden md:grid-cols-[1fr_280px]"><div class="p-7 sm:p-9">${pageBrand()}<span class="badge badge-warning mt-8">Identity required</span><h1 class="mt-4 font-display text-3xl font-extrabold text-slate-950 sm:text-4xl">Continue from your student dashboard.</h1><p class="mt-3 max-w-xl text-sm leading-6 text-slate-600">Your full name is collected before the exam workspace opens so this attempt can be identified consistently.</p><a href="${escapeText(dashboardUrl())}" class="btn btn-primary btn-lg mt-6">Open student dashboard</a></div><div class="illustration-well m-4 grid place-items-center p-5"><img src="${ART.auth}" alt="Secure student identification form" class="h-52 w-full object-contain"></div></section></div>`);
  };

  const renderBriefing = () => {
    shell(`
      <div class="min-h-dvh">
        <header class="exam-header"><div class="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-3 sm:px-6 lg:px-8">${pageBrand()}<div class="flex items-center gap-3"><div class="hidden text-right sm:block"><strong class="block text-sm text-slate-900">${escapeText(state.studentName)}</strong><span class="text-xs text-slate-500">${escapeText(session.classLevel)}</span></div><span class="avatar size-10 text-xs">${escapeText(initials(state.studentName))}</span></div></div></header>
        <div class="mx-auto max-w-7xl px-4 py-6 sm:px-6 sm:py-9 lg:px-8">
          <div class="grid gap-5 lg:grid-cols-[1.35fr_.65fr]">
            <section class="surface-brand relative overflow-hidden p-6 sm:p-8 lg:p-10">
              <div class="relative z-10 max-w-2xl"><div class="flex flex-wrap gap-2"><span class="badge badge-brand">${escapeText(session.classLevel)}</span><span class="badge badge-success">${escapeText(modeLabel())}</span><span class="badge badge-neutral">Session ${escapeText(session.id)}</span></div><p class="eyebrow mt-8">Ready to begin</p><h1 class="mt-2 max-w-2xl font-display text-4xl font-extrabold leading-tight tracking-tight text-slate-950 sm:text-5xl">${escapeText(session.title)}</h1><p class="mt-4 max-w-xl text-base leading-7 text-slate-600">${escapeText(examDescriptor())}</p><div class="mt-7 grid grid-cols-2 gap-3 sm:grid-cols-4">${[['Duration',`${session.durationMinutes} min`],['Questions',String(questions.length)],['Class',session.classLevel],['Candidate',state.studentName]].map(([label,value])=>`<div class="mini-metric"><span>${escapeText(label)}</span><strong>${escapeText(value)}</strong></div>`).join('')}</div></div>
              <img src="${ART.student}" alt="Student prepared to take a computer based examination" class="pointer-events-none absolute -bottom-10 -right-3 hidden h-72 w-60 object-contain opacity-90 xl:block">
            </section>
            <aside class="surface-raised p-5 sm:p-6"><p class="eyebrow">Before you begin</p><h2 class="mt-2 font-display text-xl font-extrabold text-slate-950">Three things to know</h2><ol class="mt-5 grid gap-4 text-sm leading-6 text-slate-600">${['The timer starts only after you press Start examination.','Responses save on this device as you move between questions.','Flag anything you want to revisit before final submission.'].map((item,index)=>`<li class="flex gap-3"><span class="step-index shrink-0 text-blue-700">${index+1}</span><span>${item}</span></li>`).join('')}</ol>${session.instructions?`<div class="alert alert-warning mt-5"><span><strong class="block">School instruction</strong>${escapeText(session.instructions)}</span></div>`:''}${session.mode==='qualifier'?`<div class="alert alert-info mt-3"><span><strong class="block">Placement qualifier</strong>This paper supports later stream-placement review; the browser does not calculate placement.</span></div>`:''}<button id="start-exam" type="button" class="btn btn-primary btn-lg mt-6 w-full">Start examination</button><button id="change-name" type="button" class="btn btn-quiet mt-2 w-full">Change student name</button></aside>
          </div>
        </div>
      </div>`);
    document.getElementById('start-exam').addEventListener('click', () => {
      const now = Date.now();
      state.startedAt = state.startedAt || now;
      state.endAt = state.endAt || now + session.durationMinutes * 60_000;
      state.attemptId = state.attemptId || `${session.id}-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
      state.view = 'exam';
      persist(); ensureAttemptRecord(false); render();
    });
    document.getElementById('change-name').addEventListener('click', () => { state.studentName = ''; state.view = 'access'; persist(); location.href = dashboardUrl(); });
  };

  const renderTriangleDiagram = () => `
    <figure class="surface-soft mb-8 max-w-2xl p-6">
      <svg class="h-auto w-full text-slate-800" viewBox="0 0 560 280" role="img" aria-labelledby="triangle-title triangle-desc">
        <title id="triangle-title">Triangle ABC</title>
        <desc id="triangle-desc">A triangle with A at the left base, B at the right base and C at the top. Angle A is 50 degrees and angle B is 65 degrees.</desc>
        <path d="M80 230 L480 230 L300 45 Z" fill="none" stroke="currentColor" stroke-width="4" stroke-linejoin="round"/>
        <text x="62" y="255" font-size="22" fill="currentColor">A</text><text x="488" y="255" font-size="22" fill="currentColor">B</text><text x="292" y="32" font-size="22" fill="currentColor">C</text>
        <text x="120" y="215" font-size="20" fill="currentColor">50°</text><text x="410" y="215" font-size="20" fill="currentColor">65°</text>
      </svg>
      <figcaption class="mt-4 text-sm font-semibold text-slate-500">Figure for this question</figcaption>
    </figure>`;

  const renderTable = (table) => `
    <div class="mb-8 overflow-hidden rounded-2xl border border-slate-200 bg-white">
      <table class="w-full text-left text-sm"><thead class="bg-slate-50 text-slate-700"><tr>${table.headers.map((header) => `<th scope="col" class="px-4 py-3 font-bold">${escapeText(header)}</th>`).join('')}</tr></thead><tbody class="divide-y divide-neutral-200">${table.rows.map((row) => `<tr>${row.map((cell) => `<td class="px-4 py-3 text-slate-700">${escapeText(cell)}</td>`).join('')}</tr>`).join('')}</tbody></table>
    </div>`;

  const renderOptions = (question, inputType) => {
    const response = responseFor(question);
    const selected = inputType === 'checkbox' ? (Array.isArray(response) ? response : []) : [response];
    return `<fieldset class="flex flex-col gap-3"><legend class="sr-only">Answer choices</legend>${question.options.map((option, index) => {
      const checked = selected.includes(index);
      return `<label class="exam-choice">
        <input class="sr-only" type="${inputType}" name="question-${question.id}" value="${index}" ${checked ? 'checked' : ''}>
        <span class="answer-marker" aria-hidden="true">${String.fromCharCode(65 + index)}</span>
        <span class="min-w-0 flex-1 pt-0.5 text-base font-semibold leading-6">${escapeText(option)}</span>
        <span class="mt-1 hidden text-[10px] font-bold uppercase tracking-[.12em] opacity-60 sm:block">${inputType === 'checkbox' ? 'Select' : 'Choose one'}</span>
      </label>`;
    }).join('')}</fieldset>`;
  };

  const renderBoolean = (question) => {
    const response = responseFor(question);
    return `<fieldset class="grid gap-3 sm:grid-cols-2"><legend class="sr-only">True or false</legend>${[[true, 'True'], [false, 'False']].map(([value, label], index) => {
      const checked = response === value;
      return `<label class="exam-choice min-h-20 items-center">
        <input class="sr-only" type="radio" name="question-${question.id}" value="${value}" ${checked ? 'checked' : ''}>
        <span class="answer-marker" aria-hidden="true">${index === 0 ? 'T' : 'F'}</span>
        <span class="text-lg font-extrabold">${label}</span>
      </label>`;
    }).join('')}</fieldset>`;
  };

  const renderFill = (question) => {
    const response = responseFor(question) || {};
    return `<div class="exam-card p-5 sm:p-6"><p class="eyebrow">Typed response</p><div class="mt-4 flex flex-wrap items-baseline gap-2 text-base font-semibold leading-10 sm:text-lg">${question.fillTemplate.map((part) => part.text ? `<span>${escapeText(part.text)}</span>` : `<span class="inline-block min-w-48 flex-1"><label class="sr-only" for="q${question.id}-${part.blank}">Answer for blank</label><input id="q${question.id}-${part.blank}" data-blank="${part.blank}" type="text" autocomplete="off" value="${escapeText(response[part.blank] || '')}" placeholder="${escapeText(part.placeholder || 'Type your answer')}" class="exam-field"></span>`).join('')}</div></div>`;
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
        timerBox.className = 'timer-pill';
        timerBox.dataset.urgent = String(remaining <= 10 * 60_000 && remaining > 5 * 60_000);
        timerBox.dataset.critical = String(remaining <= 5 * 60_000);
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
    return `<button type="button" data-question-index="${index}" class="question-map-button" data-state="${status}" data-current="${active}" data-flagged="${flagged}" aria-current="${active ? 'step' : 'false'}" aria-label="Question ${index + 1}, ${status}${flagged ? ', flagged' : ''}">${index + 1}</button>`;
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
    state.view = 'exam'; persist();
    const question = currentQuestion();
    shell(`
      <div class="min-h-dvh">
        <header class="exam-header">
          <div class="mx-auto grid max-w-7xl grid-cols-12 items-center gap-3 px-4 py-3 sm:px-6 lg:px-8">
            <div class="col-span-7 flex min-w-0 items-center gap-3 lg:col-span-5"><span class="brand-mark shrink-0" aria-hidden="true">F</span><div class="min-w-0"><strong class="block truncate text-sm font-extrabold text-slate-950">${escapeText(session.title)}</strong><span class="block truncate text-xs text-slate-500">${escapeText(state.studentName)} · ${escapeText(session.classLevel)}</span></div></div>
            <div class="col-span-3 hidden text-center lg:block"><span id="current-subject" class="eyebrow">${escapeText(question.subject)}</span><strong id="exam-progress" class="mt-1 block text-sm tabular-nums text-slate-800">${state.activeQuestion + 1} / ${questions.length}</strong></div>
            <div class="col-span-5 flex items-center justify-end gap-2 lg:col-span-4"><button id="mobile-nav" type="button" class="btn btn-secondary btn-sm lg:hidden">Questions</button><div id="timer-box" role="timer" aria-label="Remaining examination time" class="timer-pill">${ICON.clock}<span id="timer-text">--:--</span></div><div role="status" aria-live="polite" class="hidden min-h-10 items-center gap-2 rounded-xl bg-emerald-50 px-3 text-xs font-bold text-emerald-700 sm:flex">${ICON.check}<span id="save-status">${escapeText(state.saveStatus)}</span></div></div>
          </div>
          <div class="h-1 bg-slate-100"><div class="h-full bg-gradient-to-r from-blue-600 to-cyan-500 transition-all duration-300" style="width:${Math.round((state.activeQuestion + 1)/questions.length*100)}%"></div></div>
        </header>
        <div class="mx-auto grid max-w-7xl grid-cols-12 gap-5 px-4 py-5 sm:px-6 lg:px-8 lg:py-7">
          <section class="col-span-12 min-w-0 lg:col-span-9"><article class="exam-card overflow-hidden">
            <div class="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 bg-slate-50/70 px-5 py-3.5 sm:px-7"><div class="flex items-center gap-3"><span class="question-number">${String(state.activeQuestion+1).padStart(2,'0')}</span><div><span class="eyebrow">${escapeText(question.subject)}</span><span class="mt-0.5 block text-xs text-slate-500">${escapeText(question.label)}</span></div></div><span id="answered-count" class="badge badge-success">${answeredCount()} answered</span></div>
            <div class="p-5 sm:p-7 lg:p-9">${question.passage?`<div class="surface-soft mb-7 border-l-4 border-l-blue-500 p-5"><p class="eyebrow text-blue-700">Read the passage</p><p class="mt-3 max-w-3xl text-base leading-8 text-slate-700">${escapeText(question.passage)}</p></div>`:''}<h1 class="max-w-4xl font-display text-2xl font-extrabold leading-snug tracking-tight text-slate-950 sm:text-3xl">${escapeText(question.prompt)}</h1>${question.instruction?`<p class="mt-3 text-sm font-semibold text-slate-600">${escapeText(question.instruction)}</p>`:''}<div class="mt-7">${renderQuestionBody(question)}</div></div>
            <footer class="exam-footer sticky bottom-0 z-20 flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 bg-white/95 p-3 backdrop-blur-xl sm:static sm:p-4"><div class="flex flex-1 gap-2 sm:flex-none"><button id="flag" type="button" class="btn ${state.flagged.includes(question.id)?'btn-warning':'btn-secondary'} flex-1 sm:flex-none" aria-pressed="${state.flagged.includes(question.id)}">${ICON.flag}${state.flagged.includes(question.id)?'Flagged':'Flag'}</button><button id="clear" type="button" class="btn btn-quiet flex-1 sm:flex-none">Clear</button></div><div class="flex flex-1 gap-2 sm:flex-none"><button id="previous" type="button" class="btn btn-secondary flex-1 sm:flex-none" ${state.activeQuestion===0?'disabled':''}>Previous</button><button id="next" type="button" class="btn btn-primary flex-1 sm:flex-none">${state.activeQuestion===questions.length-1?'Review answers':'Next'}</button></div></footer>
          </article></section>
          <aside class="col-span-3 hidden lg:block"><div class="surface sticky top-24 p-4"><div class="flex items-end justify-between border-b border-slate-200 pb-4"><div><p class="eyebrow">Question map</p><strong class="mt-1 block font-display text-2xl font-extrabold text-slate-950">${questions.length}</strong></div><span class="text-xs font-semibold text-slate-500">${answeredCount()} complete</span></div><div class="segmented mt-4 w-full grid-cols-3" role="group" aria-label="Question filters">${['all','unanswered','flagged'].map(filter=>`<button type="button" data-filter="${filter}" aria-pressed="${state.filter===filter}">${filter}</button>`).join('')}</div><div id="question-grid" class="mt-4 grid grid-cols-5 gap-2"></div><button id="review-now" type="button" class="btn btn-secondary mt-5 w-full">Review answers</button></div></aside>
        </div>
        <div id="mobile-drawer" class="fixed inset-0 z-50 hidden bg-slate-950/35 p-3 backdrop-blur-sm lg:hidden" aria-hidden="true"><div class="ml-auto h-full w-full max-w-sm overflow-y-auto rounded-3xl bg-white p-5 shadow-2xl"><div class="flex items-center justify-between border-b border-slate-200 pb-4"><div><p class="eyebrow">Question map</p><strong class="mt-1 block text-lg text-slate-950">${answeredCount()} / ${questions.length} answered</strong></div><button id="close-mobile-nav" type="button" class="icon-btn" aria-label="Close question map">${ICON.warn.replace('M12 13V8m0 8h.01M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z','M6 18 17.94 6M18 18 6.06 6')}</button></div><div class="segmented mt-4 grid w-full grid-cols-3">${['all','unanswered','flagged'].map(filter=>`<button type="button" data-filter="${filter}" aria-pressed="${state.filter===filter}">${filter}</button>`).join('')}</div><div id="mobile-question-grid" class="mt-5 grid grid-cols-5 gap-2"></div><button id="mobile-review" type="button" class="btn btn-primary mt-6 w-full">Review answers</button></div></div>
      </div>`);
    renderNavigator();
    const mobileGrid=document.getElementById('mobile-question-grid'); if(mobileGrid){mobileGrid.innerHTML=document.getElementById('question-grid').innerHTML;mobileGrid.querySelectorAll('[data-question-index]').forEach(button=>button.addEventListener('click',()=>{state.activeQuestion=Number(button.dataset.questionIndex);persist();renderExam()}));}
    bindQuestion(question); renderExamChrome(); startClock();
    document.getElementById('previous').addEventListener('click',()=>{if(state.activeQuestion>0){state.activeQuestion-=1;persist();renderExam()}});
    document.getElementById('next').addEventListener('click',()=>{if(state.activeQuestion<questions.length-1){state.activeQuestion+=1;persist();renderExam()}else{state.view='review';persist();render()}});
    document.getElementById('flag').addEventListener('click',()=>{state.flagged=state.flagged.includes(question.id)?state.flagged.filter(id=>id!==question.id):[...state.flagged,question.id];scheduleSave();renderExam()});
    document.getElementById('clear').addEventListener('click',()=>{delete state.responses[String(question.id)];scheduleSave();renderExam()});
    document.querySelectorAll('[data-filter]').forEach(button=>button.addEventListener('click',()=>{state.filter=button.dataset.filter;persist();renderExam()}));
    document.getElementById('review-now').addEventListener('click',()=>{state.view='review';persist();render()}); document.getElementById('mobile-review').addEventListener('click',()=>{state.view='review';persist();render()});
    document.getElementById('mobile-nav').addEventListener('click',()=>{const panel=document.getElementById('mobile-drawer');panel.classList.remove('hidden');panel.setAttribute('aria-hidden','false')}); document.getElementById('close-mobile-nav').addEventListener('click',()=>{const panel=document.getElementById('mobile-drawer');panel.classList.add('hidden');panel.setAttribute('aria-hidden','true')});
  };

  const renderReview = () => {
    stopClock();
    shell(`<div class="min-h-dvh"><header class="exam-header"><div class="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-3 sm:px-6 lg:px-8">${pageBrand()}<div id="review-timer" class="timer-pill">${ICON.clock}<span id="timer-text">--:--</span></div></div></header><div class="mx-auto max-w-7xl px-4 py-6 sm:px-6 sm:py-9 lg:px-8"><div class="grid gap-5 lg:grid-cols-[1fr_320px]"><section><span class="badge badge-brand">Final review</span><h1 class="mt-4 font-display text-3xl font-extrabold tracking-tight text-slate-950 sm:text-4xl">Check your paper before submitting.</h1><p class="mt-3 max-w-2xl text-sm leading-6 text-slate-600">Return to anything unfinished or flagged. Your timer continues while you review.</p><div class="mt-6 grid grid-cols-3 gap-3">${[['Answered',answeredCount(),'success'],['Unanswered',unansweredCount(),'neutral'],['Incomplete',incompleteCount(),'warning']].map(([label,count,tone])=>`<div class="review-metric review-${tone}"><span>${label}</span><strong>${count}</strong></div>`).join('')}</div><div class="surface mt-5 overflow-hidden">${questions.map((question,index)=>{const status=questionStatus(question);return `<button type="button" data-open-question="${index}" class="review-row"><span class="question-map-button" data-state="${status}" data-current="false">${index+1}</span><span class="min-w-0 flex-1"><strong class="block truncate text-sm text-slate-900">${escapeText(question.subject)}</strong><span class="mt-1 block truncate text-xs text-slate-500">${escapeText(question.prompt)}</span></span><span class="badge ${status==='answered'?'badge-success':status==='incomplete'?'badge-warning':'badge-neutral'}">${status}${state.flagged.includes(question.id)?' · flagged':''}</span></button>`}).join('')}</div></section><aside><div class="surface-raised sticky top-24 p-5"><div class="flex items-center gap-3"><span class="avatar size-11 text-xs">${escapeText(initials(state.studentName))}</span><div><strong class="block text-sm text-slate-900">${escapeText(state.studentName)}</strong><span class="text-xs text-slate-500">${escapeText(session.classLevel)} · ${escapeText(modeLabel())}</span></div></div><div class="alert ${unansweredCount()+incompleteCount()?'alert-warning':'alert-success'} mt-5"><span>${unansweredCount()+incompleteCount()?`${unansweredCount()+incompleteCount()} response(s) still need attention.`:'All questions have complete responses.'}</span></div><button id="back-exam" type="button" class="btn btn-secondary mt-5 w-full">Return to questions</button><button id="submit-exam" type="button" class="btn btn-primary btn-lg mt-2 w-full">Submit examination</button></div></aside></div></div><div id="submit-dialog" class="modal-shell" data-open="false" aria-hidden="true"><div class="modal-backdrop" data-submit-cancel></div><section class="modal-card max-w-md" role="dialog" aria-modal="true" aria-labelledby="submit-dialog-title"><div class="p-5 sm:p-6"><span class="badge badge-warning">Final action</span><h2 id="submit-dialog-title" class="mt-3 font-display text-xl font-extrabold text-slate-950">Submit this examination?</h2><p class="mt-2 text-sm leading-6 text-slate-600">You will not be able to change responses after submission.</p><div class="mt-5 flex justify-end gap-2"><button class="btn btn-secondary" data-submit-cancel>Keep reviewing</button><button class="btn btn-primary" data-submit-confirm>Submit now</button></div></div></section></div></div>`);
    startClock();
    document.querySelectorAll('[data-open-question]').forEach(button=>button.addEventListener('click',()=>{state.activeQuestion=Number(button.dataset.openQuestion);state.view='exam';persist();render()}));
    document.getElementById('back-exam').addEventListener('click',()=>{state.view='exam';persist();render()});
    const dialog=document.getElementById('submit-dialog');
    document.getElementById('submit-exam').addEventListener('click',()=>{dialog.dataset.open='true';dialog.setAttribute('aria-hidden','false');dialog.querySelector('[data-submit-confirm]').focus()});
    dialog.querySelectorAll('[data-submit-cancel]').forEach(button=>button.addEventListener('click',()=>{dialog.dataset.open='false';dialog.setAttribute('aria-hidden','true');document.getElementById('submit-exam').focus()}));
    dialog.querySelector('[data-submit-confirm]').addEventListener('click',()=>completeSubmission(false));
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
    shell(`<div class="mx-auto flex min-h-dvh max-w-6xl items-center px-4 py-10 sm:px-6 lg:px-8"><section class="surface-raised grid w-full overflow-hidden lg:grid-cols-[1fr_340px]"><div class="p-6 sm:p-9 lg:p-11">${pageBrand()}<span class="badge badge-success mt-9">Attempt received</span><h1 class="mt-4 font-display text-4xl font-extrabold tracking-tight text-slate-950 sm:text-5xl">Examination submitted.</h1><p class="mt-3 max-w-xl text-sm leading-6 text-slate-600">${automatic?'Time expired and this local attempt was submitted automatically.':'Your local examination attempt has been recorded successfully.'}</p><div class="mt-7 overflow-hidden rounded-2xl border border-slate-200 bg-white">${[['Candidate',state.studentName],['Examination',session.title],['Class',session.classLevel],['Coverage',examDescriptor()],['Answered',`${answeredCount()} of ${questions.length}`],['Submitted',formatDateTime(state.submittedAt)],['Attempt ID',state.attemptId]].map(([label,value])=>`<div class="grid grid-cols-12 gap-3 border-b border-slate-100 px-4 py-3.5 last:border-b-0"><span class="col-span-4 text-xs font-bold text-slate-500">${escapeText(label)}</span><strong class="col-span-8 text-sm text-slate-900">${escapeText(value)}</strong></div>`).join('')}</div><div class="mt-6 flex flex-wrap gap-2"><a href="${escapeText(dashboardUrl())}" class="btn btn-primary">Back to dashboard</a><span class="alert alert-info">Results or placement decisions are not calculated in this browser prototype.</span></div></div><div class="illustration-well m-4 grid min-h-80 place-items-center p-6 lg:m-5"><img src="${ART.connect}" alt="Students connected through the Festacol learning platform" class="h-72 w-full object-contain"></div></section></div>`);
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
