(() => {
  'use strict';

  const Store = window.FestacolSessionStore;
  const Data = window.FestacolQuestionData;
  const root = document.getElementById('student-root');
  if (!Store || !Data || !root) throw new Error('Festacol student dashboard dependencies are unavailable.');

  const ART = Object.freeze({
    student: 'https://raw.githubusercontent.com/themesberg/flowbite-illustrations/main/src/3d/light/woman-laptop-chart.svg',
    connect: 'https://raw.githubusercontent.com/themesberg/flowbite-illustrations/main/src/3d/light/people-connecting.svg',
    question: 'https://raw.githubusercontent.com/themesberg/flowbite-illustrations/main/src/3d/light/man-question-marks.svg'
  });

  const ICON = Object.freeze({
    home: '<svg class="fb-icon" aria-hidden="true" viewBox="0 0 24 24" fill="none"><path stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="m4 12 8-8 8 8M6 10.5V19a1 1 0 0 0 1 1h3v-3a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1v3h3a1 1 0 0 0 1-1v-8.5"/></svg>',
    book: '<svg class="fb-icon" aria-hidden="true" viewBox="0 0 24 24" fill="none"><path stroke="currentColor" stroke-linejoin="round" stroke-width="2" d="M12.1429 11v9m0-9c-2.50543-.7107-3.19099-1.39543-6.13657-1.34968-.48057.00746-.86348.38718-.86348.84968v7.2884c0 .4824.41455.8682.91584.8617 2.77491-.0362 3.45995.6561 6.08421 1.3499m0-9c2.5053-.7107 3.1067-1.39542 6.0523-1.34968.4806.00746.9477.38718.9477.84968v7.2884c0 .4824-.4988.8682-1 .8617-2.775-.0362-3.3758.6561-6 1.3499m2-14c0 1.10457-.8955 2-2 2-1.1046 0-2-.89543-2-2s.8954-2 2-2c1.1045 0 2 .89543 2 2Z"/></svg>',
    users: '<svg class="fb-icon" aria-hidden="true" viewBox="0 0 24 24" fill="none"><path stroke="currentColor" stroke-linecap="round" stroke-width="2" d="M4.5 17H4a1 1 0 0 1-1-1 3 3 0 0 1 3-3h1m0-3.05A2.5 2.5 0 1 1 9 5.5M19.5 17h.5a1 1 0 0 0 1-1 3 3 0 0 0-3-3h-1m0-3.05a2.5 2.5 0 1 0-2-4.45m.5 13.5h-7a1 1 0 0 1-1-1 3 3 0 0 1 3-3h3a3 3 0 0 1 3 3 1 1 0 0 1-1 1Zm-1-9.5a2.5 2.5 0 1 1-5 0 2.5 2.5 0 0 1 5 0Z"/></svg>',
    arrow: '<svg class="fb-icon" aria-hidden="true" viewBox="0 0 24 24" fill="none"><path stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="m9 5 7 7-7 7"/></svg>'
  });

  const e = (value) => String(value ?? '').replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;').replaceAll("'", '&#039;');
  const url = new URL(location.href);
  const token = url.searchParams.get('session');
  const tab = ['home', 'exams', 'history'].includes(url.searchParams.get('tab')) ? url.searchParams.get('tab') : 'home';
  const attempts = Store.getAttempts();
  let data = null;
  let session = null;
  let questions = [];
  let sessionError = '';

  const formatDate = (timestamp) => timestamp ? new Intl.DateTimeFormat('en-NG', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(timestamp)) : 'Any time';
  const sessionState = (item) => {
    const now = Date.now();
    if (item.status !== 'open') return item.status;
    if (item.startsAt && now < item.startsAt) return 'scheduled';
    if (item.endsAt && now > item.endsAt) return 'closed';
    return 'ready';
  };
  const badge = (value) => `<span class="badge badge-${value === 'ready' || value === 'submitted' ? 'success' : value === 'scheduled' ? 'info' : value === 'closed' ? 'danger' : 'warning'}">${e(value)}</span>`;
  const currentStudent = () => session ? Store.getStudentState(session.id)?.studentName || '' : '';
  const coverage = () => {
    if (!session) return '';
    if (session.mode === 'qualifier') return 'English · Mathematics · Science · Social & digital aptitude';
    return session.subjects.map((code) => Data.subjectByCode(data, code)?.label || code).join(' · ');
  };
  const navHref = (next) => {
    const target = new URL('./student.html', location.href);
    target.search = '';
    target.searchParams.set('tab', next);
    if (token) target.searchParams.set('session', token);
    return target.pathname.split('/').pop() + target.search;
  };

  const header = () => `
    <header class="student-topbar sticky top-0 z-30 border-b border-slate-200/80 bg-white/90 backdrop-blur-xl">
      <div class="mx-auto flex max-w-7xl items-center gap-4 px-4 py-3 sm:px-6 lg:px-8">
        <a href="${navHref('home')}" class="flex min-h-11 items-center gap-3 rounded-xl pr-2 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-blue-100" aria-label="Festacol student home">
          <span class="brand-mark">F</span><span><strong class="block font-display text-sm font-extrabold text-slate-950">Festacol</strong><span class="block text-[11px] font-semibold text-slate-500">Student workspace</span></span>
        </a>
        <nav class="ml-auto hidden items-center gap-1 rounded-xl bg-slate-100 p-1 sm:flex" aria-label="Student navigation">
          ${[['home', 'Dashboard', ICON.home], ['exams', 'My exams', ICON.book], ['history', 'History', ICON.users]].map(([key, label, icon]) => `<a href="${navHref(key)}" class="student-nav-link" ${tab === key ? 'aria-current="page"' : ''}>${icon}${label}</a>`).join('')}
        </nav>
        <div class="ml-auto sm:ml-0">${currentStudent() ? `<div class="hidden text-right md:block"><strong class="block text-sm text-slate-900">${e(currentStudent())}</strong><span class="text-xs text-slate-500">${e(session?.classLevel || 'Student')}</span></div>` : '<span class="badge badge-info">Student access</span>'}</div>
      </div>
      <nav class="grid grid-cols-3 border-t border-slate-200 bg-white p-1 sm:hidden" aria-label="Student mobile navigation">
        ${[['home', 'Home'], ['exams', 'Exams'], ['history', 'History']].map(([key, label]) => `<a href="${navHref(key)}" class="student-mobile-nav" ${tab === key ? 'aria-current="page"' : ''}>${label}</a>`).join('')}
      </nav>
    </header>`;

  const noSessionCard = () => `
    <section class="surface-raised overflow-hidden lg:grid lg:grid-cols-[1fr_320px]">
      <div class="p-6 sm:p-8">
        <span class="badge badge-info">Secure access</span>
        <h2 class="mt-4 max-w-2xl font-display text-3xl font-extrabold tracking-tight text-slate-950 sm:text-4xl">Your examination opens from the exact school link.</h2>
        <p class="mt-4 max-w-2xl text-base leading-7 text-slate-600">Scan the QR code or open the link supplied by your school. Festacol does not guess your class, examination type or subjects.</p>
        <div class="mt-6 flex flex-wrap gap-3"><span class="badge badge-neutral">Dynamic class</span><span class="badge badge-neutral">Dynamic subjects</span><span class="badge badge-neutral">Timed attempt</span></div>
      </div>
      <div class="illustration-well min-h-60 p-6"><img src="${ART.question}" alt="Student reviewing questions on a digital learning screen" class="mx-auto h-52 w-auto object-contain" loading="lazy"></div>
    </section>`;

  const sessionCard = () => {
    const status = sessionState(session);
    const state = Store.getStudentState(session.id) || {};
    const progress = state.startedAt && !state.submittedAt;
    const submitted = Boolean(state.submittedAt);
    return `
      <section class="session-feature overflow-hidden">
        <div class="relative z-10 max-w-3xl p-6 sm:p-8 lg:p-10">
          <div class="flex flex-wrap items-center gap-2">${badge(submitted ? 'submitted' : status)}<span class="badge badge-neutral">${e(Store.getModeLabel(session.mode))}</span></div>
          <h2 class="mt-5 font-display text-3xl font-extrabold tracking-tight text-slate-950 sm:text-4xl">${e(session.title)}</h2>
          <p class="mt-3 max-w-2xl text-sm leading-6 text-slate-600">${e(coverage())}</p>
          <div class="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
            ${[['Class', session.classLevel], ['Questions', questions.length], ['Duration', `${session.durationMinutes} min`], ['Window', session.startsAt ? formatDate(session.startsAt) : 'Open now']].map(([label, value]) => `<div class="mini-metric"><span>${e(label)}</span><strong>${e(value)}</strong></div>`).join('')}
          </div>
          <div class="mt-7 flex flex-wrap gap-3">
            ${submitted ? `<button type="button" data-open-receipt class="btn btn-secondary">View receipt</button>` : status === 'ready' ? `<button type="button" data-enter-session class="btn btn-primary btn-lg">${progress ? 'Resume examination' : currentStudent() ? 'Review & enter exam' : 'Identify & continue'} ${ICON.arrow}</button>` : `<button type="button" class="btn btn-secondary" disabled>${e(status === 'scheduled' ? 'Opens later' : 'Unavailable')}</button>`}
          </div>
        </div>
        <img src="${ART.student}" alt="Student working confidently on a laptop" class="session-feature-art" loading="eager">
      </section>`;
  };

  const identityPanel = () => !session || currentStudent() ? '' : `
    <section class="surface-raised mt-5 p-5 sm:p-6" id="identity-panel">
      <div class="grid gap-6 lg:grid-cols-[1fr_auto] lg:items-end">
        <div>
          <span class="badge badge-warning">Identity required</span>
          <h3 class="mt-3 font-display text-xl font-extrabold text-slate-950">Who is taking this examination?</h3>
          <p class="mt-1 text-sm leading-6 text-slate-600">Use your full name exactly as the school should identify this attempt.</p>
        </div>
        <form id="student-identity-form" class="grid gap-2 sm:grid-cols-[minmax(260px,1fr)_auto]" novalidate>
          <div><label class="sr-only" for="student-full-name">Full name</label><input id="student-full-name" class="field" autocomplete="name" placeholder="e.g. Amina Yusuf Bello" aria-describedby="student-name-error"><p id="student-name-error" class="mt-1 hidden text-xs font-bold text-rose-700" role="alert"></p></div>
          <button class="btn btn-primary" type="submit">Continue ${ICON.arrow}</button>
        </form>
      </div>
    </section>`;

  const recentAttempts = () => {
    const rows = attempts.slice(0, 5);
    return `<section class="surface mt-5 overflow-hidden"><div class="flex items-center justify-between border-b border-slate-200 px-5 py-4"><div><p class="eyebrow">Activity</p><h3 class="mt-1 font-display text-lg font-extrabold text-slate-950">Recent attempts</h3></div><a href="${navHref('history')}" class="btn btn-ghost btn-sm">View history</a></div>${rows.length ? `<div class="divide-y divide-slate-100">${rows.map((attempt) => `<div class="flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center"><div class="min-w-0 flex-1"><strong class="block truncate text-sm text-slate-900">${e(attempt.sessionTitle)}</strong><span class="mt-1 block text-xs text-slate-500">${e(attempt.classLevel)} · ${attempt.submittedAt ? `Submitted ${formatDate(attempt.submittedAt)}` : 'In progress'}</span></div><div class="flex items-center gap-3">${badge(attempt.submittedAt ? 'submitted' : 'draft')}<span class="text-xs font-bold tabular-nums text-slate-600">${attempt.answered}/${attempt.questionCount}</span></div></div>`).join('')}</div>` : `<div class="p-8 text-center"><p class="font-semibold text-slate-700">No attempts on this device yet.</p><p class="mt-1 text-sm text-slate-500">Your activity will appear here after you start an examination.</p></div>`}</section>`;
  };

  const renderHome = () => `
    <div class="page-enter mx-auto max-w-7xl px-4 py-6 sm:px-6 sm:py-8 lg:px-8">
      <div class="mb-6 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between"><div><p class="eyebrow">Student dashboard</p><h1 class="mt-1 font-display text-3xl font-extrabold tracking-tight text-slate-950">${currentStudent() ? `Welcome, ${e(currentStudent().split(' ')[0])}.` : 'Ready when you are.'}</h1><p class="mt-2 text-sm text-slate-600">Your exam access, progress and recent activity in one place.</p></div>${session ? `<span class="badge badge-info">${e(session.id)}</span>` : ''}</div>
      ${session ? sessionCard() + identityPanel() : noSessionCard()}
      <div class="mt-5 grid gap-5 lg:grid-cols-[1.35fr_.65fr]">${recentAttempts()}<aside class="surface mt-5 overflow-hidden"><div class="illustration-well p-5"><img src="${ART.connect}" alt="Students connecting through an online learning platform" class="mx-auto h-36 w-auto" loading="lazy"></div><div class="p-5"><span class="badge badge-success">Before you begin</span><h3 class="mt-3 font-display text-lg font-extrabold text-slate-950">Use a stable browser and power source.</h3><p class="mt-2 text-sm leading-6 text-slate-600">Your responses save on this device as you work. Avoid clearing browser storage during an active paper.</p></div></aside></div>
    </div>`;

  const renderExams = () => `<div class="page-enter mx-auto max-w-7xl px-4 py-6 sm:px-6 sm:py-8 lg:px-8"><p class="eyebrow">My exams</p><h1 class="mt-1 font-display text-3xl font-extrabold text-slate-950">Examination access</h1><p class="mt-2 max-w-2xl text-sm leading-6 text-slate-600">Only examinations encoded in your school-issued link appear here.</p><div class="mt-6">${session ? sessionCard() + identityPanel() : noSessionCard()}</div></div>`;
  const renderHistory = () => `<div class="page-enter mx-auto max-w-7xl px-4 py-6 sm:px-6 sm:py-8 lg:px-8"><p class="eyebrow">Attempt history</p><h1 class="mt-1 font-display text-3xl font-extrabold text-slate-950">This device</h1><p class="mt-2 max-w-2xl text-sm leading-6 text-slate-600">Prototype history is browser-local and is not a school-wide student record.</p><div class="mt-6">${recentAttempts()}</div></div>`;

  const render = () => {
    root.innerHTML = `${header()}<main>${tab === 'exams' ? renderExams() : tab === 'history' ? renderHistory() : renderHome()}</main>`;
    bind();
    root.focus({ preventScroll: true });
  };

  const saveName = (value) => {
    if (!session) return;
    const name = Store.sanitizeName(value);
    if (name.split(/\s+/u).filter(Boolean).length < 2) throw new Error('Enter your full name with at least two names.');
    const prior = Store.getStudentState(session.id) || {};
    Store.saveStudentState(session.id, { version: 2, activeQuestion: 0, responses: {}, flagged: [], startedAt: null, endAt: null, submittedAt: null, attemptId: null, view: 'briefing', filter: 'all', saveStatus: 'Saved', ...prior, studentName: name, view: prior.startedAt ? prior.view || 'exam' : 'briefing' });
  };

  const enterExam = () => {
    if (!session) return;
    const target = new URL('./exam.html', location.href);
    target.search = '';
    target.searchParams.set('session', token);
    location.href = target.href;
  };

  const bind = () => {
    document.getElementById('student-identity-form')?.addEventListener('submit', (event) => {
      event.preventDefault();
      const input = document.getElementById('student-full-name');
      const error = document.getElementById('student-name-error');
      try { saveName(input.value); render(); } catch (failure) { error.textContent = failure.message; error.classList.remove('hidden'); input.setAttribute('aria-invalid', 'true'); input.focus(); }
    });
    document.querySelector('[data-enter-session]')?.addEventListener('click', () => {
      if (!currentStudent()) { document.getElementById('student-full-name')?.focus(); return; }
      enterExam();
    });
    document.querySelector('[data-open-receipt]')?.addEventListener('click', enterExam);
  };

  const start = async () => {
    try { data = await Data.load(); } catch (failure) { sessionError = failure.message; }
    if (token) {
      try { session = Store.decodeSession(token); questions = data ? Data.questionsForSession(data, session) : []; if (data && questions.length !== session.questionCount) sessionError = 'This session does not have enough matching questions.'; } catch (failure) { sessionError = failure.message; }
    }
    if (sessionError) {
      root.innerHTML = `${header()}<main class="mx-auto max-w-4xl px-4 py-12 sm:px-6"><section class="surface-raised grid gap-8 overflow-hidden p-6 sm:p-8 md:grid-cols-[1fr_240px] md:items-center"><div><span class="badge badge-danger">Unable to open session</span><h1 class="mt-4 font-display text-3xl font-extrabold text-slate-950">Check your examination link.</h1><p class="mt-3 text-sm leading-6 text-slate-600">${e(sessionError)}</p></div><div class="illustration-well p-4"><img src="${ART.question}" alt="Student looking for the correct examination link" class="mx-auto h-48 w-auto"></div></section></main>`;
      return;
    }
    render();
  };

  start();
})();
