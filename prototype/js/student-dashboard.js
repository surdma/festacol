(() => {
  'use strict';

  const Store = window.FestacolSessionStore;
  const Data = window.FestacolQuestionData;
  const Engine = window.FestacolAssessmentEngine;
  const root = document.getElementById('student-root');
  if (!Store || !Data || !Engine || !root) throw new Error('Festacol student dashboard dependencies are unavailable.');

  const ART = {
    student: 'https://raw.githubusercontent.com/themesberg/flowbite-illustrations/main/src/3d/light/woman-laptop-chart.svg',
    question: 'https://raw.githubusercontent.com/themesberg/flowbite-illustrations/main/src/3d/light/man-question-marks.svg'
  };
  const e = (value) => String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');

  const url = new URL(location.href);
  const token = url.searchParams.get('session');
  const pages = new Set(['home', 'exams', 'analytics', 'history', 'progress', 'profile']);
  let page = pages.has(url.searchParams.get('page')) ? url.searchParams.get('page') : 'home';
  let data = null;
  let session = null;
  let sessionError = '';

  try {
    if (token) session = Store.resolveSession(Store.decodeSession(token));
  } catch (failure) {
    sessionError = failure.message;
  }

  const profile = () => Store.getStudentProfile();
  const portalAuthed = () => {
    const current = profile();
    return Boolean(current?.studentHash && Store.getStudentAuth() === current.studentHash);
  };
  const attempts = () => {
    const current = profile();
    return current?.studentHash ? Store.attemptsForStudent(current.studentHash) : [];
  };
  const sessionState = (value) => {
    const now = Date.now();
    if (!value) return 'missing';
    if (value.status !== 'open') return value.status;
    if (value.startsAt && now < value.startsAt) return 'scheduled';
    if (value.endsAt && now > value.endsAt) return 'closed';
    return 'open';
  };
  const answerUnlocked = (attempt) => {
    const source = Store.listSessions().find((item) => item.id === attempt.sessionId) || session;
    return Engine.answersMayBeRevealed(source, source?.status);
  };
  const navHref = (next) => `./student.html?page=${encodeURIComponent(next)}`;
  const examHref = () => `./exam.html?session=${encodeURIComponent(token || '')}`;
  const badge = (text, tone = 'neutral') => `<span class="badge badge-${tone}">${e(text)}</span>`;
  const icon = (path) => `<svg class="fb-icon" aria-hidden="true" viewBox="0 0 24 24" fill="none"><path stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="${path}"/></svg>`;
  const icons = {
    home: icon('M4 10.5 12 4l8 6.5V19a1 1 0 0 1-1 1h-5v-5h-4v5H5a1 1 0 0 1-1-1v-8.5Z'),
    exam: icon('M7 4h10a2 2 0 0 1 2 2v14H5V6a2 2 0 0 1 2-2Zm2 5h6M9 13h6M9 17h4'),
    chart: icon('M5 19V9m5 10V5m5 14v-7m4 7H3'),
    history: icon('M3 12a9 9 0 1 0 3-6.7L3 8m0 0h5M3 8V3m9 4v5l3 2'),
    progress: icon('m5 13 4 4L19 7M5 7h6'),
    profile: icon('M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8Zm-7 8a7 7 0 0 1 14 0')
  };
  const navItems = [
    ['home', 'Dashboard', icons.home],
    ['exams', 'My exams', icons.exam],
    ['analytics', 'Analytics', icons.chart],
    ['history', 'Exam history', icons.history],
    ['progress', 'Progress & promotion', icons.progress],
    ['profile', 'Profile', icons.profile]
  ];

  const gate = (message = '') => {
    root.innerHTML = `<main class="min-h-dvh bg-neutral-100 p-4 sm:p-7"><div class="mx-auto grid min-h-[calc(100dvh-2rem)] max-w-6xl overflow-hidden rounded-[2rem] border border-neutral-200 bg-white shadow-xl sm:min-h-[calc(100dvh-3.5rem)] lg:grid-cols-[.85fr_1.15fr]">
      <section class="flex flex-col justify-between bg-black p-7 text-white sm:p-10"><div class="flex items-center gap-3"><span class="grid size-10 place-items-center rounded-xl bg-white text-sm font-black text-black">F</span><div><strong class="block font-display text-sm font-extrabold">Festacol</strong><span class="text-xs text-neutral-400">Student portal</span></div></div><div class="py-12"><p class="text-xs font-extrabold uppercase tracking-[.18em] text-neutral-500">Private student workspace</p><h1 class="mt-4 font-display text-4xl font-extrabold leading-tight sm:text-5xl">Your exams, results and progress stay behind sign in.</h1><p class="mt-5 max-w-sm text-sm leading-7 text-neutral-400">Candidates must authenticate before the academic dashboard becomes available.</p></div><span class="text-xs text-neutral-600">2026/2027 academic session</span></section>
      <section class="flex items-center p-7 sm:p-11"><div class="mx-auto w-full max-w-xl"><span class="badge badge-brand">Student authentication</span><h2 class="mt-4 font-display text-3xl font-extrabold text-neutral-950">Sign in with your candidate credentials.</h2><p class="mt-3 text-sm leading-7 text-neutral-600">Your first name is your username and your last name is your password.${session ? ' After sign in, Festacol will open the exact examination from your link.' : ''}</p>${message ? `<div class="alert alert-danger mt-5"><strong>Unable to continue</strong><span>${e(message)}</span></div>` : ''}
        <form id="student-login-form" class="mt-7 grid gap-4 sm:grid-cols-2" novalidate><label class="text-sm font-bold text-neutral-800">First name · username<input id="student-first-name" class="field mt-2" autocomplete="given-name" required></label><label class="text-sm font-bold text-neutral-800">Last name · password<input id="student-last-name" type="password" class="field mt-2" autocomplete="current-password" required></label><p id="student-login-error" class="hidden text-sm font-bold text-rose-700 sm:col-span-2" role="alert"></p><button class="btn btn-primary btn-lg sm:col-span-2" type="submit">${session ? 'Continue to examination' : 'Open student portal'}</button></form>
        ${session ? `<div class="mt-6 rounded-2xl border border-neutral-200 bg-neutral-50 p-4"><p class="text-xs font-extrabold uppercase tracking-[.14em] text-neutral-500">Linked examination</p><strong class="mt-1 block text-sm text-neutral-950">${e(session.title)}</strong><span class="mt-1 block text-xs text-neutral-500">${e(session.classLevel)} · ${e(Store.getModeLabel(session.mode))}</span></div>` : ''}
      </div></section>
    </div></main>`;
    bindGate();
  };

  const shell = (content) => {
    const current = profile();
    return `<div class="min-h-dvh bg-slate-50"><button id="student-menu" class="icon-btn fixed left-4 top-4 z-50 lg:hidden" aria-label="Open student navigation">${icon('M5 7h14M5 12h14M5 17h14')}</button><div id="student-scrim" class="student-sidebar-scrim hidden"></div><aside id="student-sidebar" class="student-sidebar fixed inset-y-0 left-0 z-50 hidden w-72 flex-col lg:flex"><div class="p-5"><a href="${navHref('home')}" class="flex items-center gap-3"><span class="brand-mark">F</span><span><strong class="font-display text-base font-extrabold text-slate-950">Festacol</strong><small class="block text-xs text-slate-500">Student intelligence portal</small></span></a></div><nav class="grid gap-1 px-3">${navItems.map(([key,label,ic])=>`<a href="${navHref(key)}" class="nav-link" ${page===key?'aria-current="page"':''}>${ic}${label}</a>`).join('')}</nav><div class="mt-auto border-t border-slate-200 p-4"><div class="flex items-center gap-3"><span class="avatar">${e((current?.firstName?.[0]||'')+(current?.lastName?.[0]||''))}</span><div class="min-w-0 flex-1"><strong class="block truncate text-sm text-slate-900">${e(current?.fullName||'Student')}</strong><span class="text-xs text-slate-500">${e(current?.academicSession||Store.ACADEMIC_SESSION)}</span></div><button class="btn btn-quiet btn-sm" data-student-logout>Sign out</button></div></div></aside><main class="min-h-dvh lg:pl-72"><header class="glassbar sticky top-0 z-30 px-4 py-3 pl-16 lg:pl-6"><div class="mx-auto flex max-w-7xl items-center justify-between gap-4"><div><p class="eyebrow">Student portal</p><h1 class="font-display text-lg font-extrabold text-slate-950">${e(navItems.find((item)=>item[0]===page)?.[1]||'Dashboard')}</h1></div>${badge(current?.academicSession||Store.ACADEMIC_SESSION,'brand')}</div></header><div class="mx-auto max-w-7xl p-4 sm:p-6 lg:p-7">${content}</div></main></div>`;
  };

  const metric = (label, value, detail) => `<article class="student-metric"><span class="student-metric-dot"></span><span class="eyebrow">${e(label)}</span><strong>${e(value)}</strong><small>${e(detail)}</small></article>`;
  const activeAttemptCard = () => {
    const open = attempts().find((attempt) => attempt.startedAt && !attempt.submittedAt);
    if (!open) return `<section class="surface-raised overflow-hidden lg:grid lg:grid-cols-[1fr_280px]"><div class="p-6 sm:p-8"><span class="badge badge-neutral">No active exam</span><h2 class="mt-4 font-display text-3xl font-extrabold text-slate-950">Use the examination link or QR code issued by your school.</h2><p class="mt-3 max-w-xl text-sm leading-6 text-slate-600">Exam links carry the exact session configuration. After authentication, they open directly into instructions or resume the same attempt.</p></div><div class="illustration-well p-5"><img src="${ART.question}" alt="Student considering an examination question" class="mx-auto h-52"></div></section>`;
    const savedSession = Store.listSessions().find((item) => item.id === open.sessionId);
    if (!savedSession) return `<section class="surface-raised p-6"><span class="badge badge-warning">In progress</span><h2 class="mt-3 font-display text-2xl font-extrabold">${e(open.sessionTitle)}</h2><p class="mt-2 text-sm text-slate-600">Reopen the original exam link to resume this attempt.</p></section>`;
    const link = new URL('./exam.html', location.href); link.searchParams.set('session', Store.encodeSession(savedSession));
    return `<section class="session-feature p-6 sm:p-8"><span class="badge badge-warning">In progress</span><h2 class="mt-4 font-display text-3xl font-extrabold text-slate-950">${e(open.sessionTitle)}</h2><p class="mt-2 text-sm text-slate-600">Your exact attempt is saved and can be resumed while the examination remains available.</p><a class="btn btn-primary mt-6" href="${e(link.href)}">Resume examination</a></section>`;
  };
  const dashboard = () => {
    const all = attempts();
    const submitted = all.filter((attempt) => attempt.submittedAt);
    const average = submitted.length ? Math.round(submitted.reduce((total,attempt)=>total+(attempt.score||0),0)/submitted.length) : 0;
    return `${activeAttemptCard()}<section class="student-metric-grid mt-5">${metric('Completed',submitted.length,'submitted exams')}${metric('Average',submitted.length?`${average}%`:'—','across scored attempts')}${metric('Integrity',submitted.length?`${Math.round(submitted.reduce((total,attempt)=>total+(attempt.integrityScore??100),0)/submitted.length)}%`:'—','recorded browser signals')}${metric('Academic session',profile()?.academicSession||Store.ACADEMIC_SESSION,'current student profile')}</section>`;
  };
  const examsPage = () => `<section class="surface overflow-hidden"><div class="border-b border-slate-200 p-5"><h2 class="section-title">Exam activity</h2><p class="mt-1 text-xs text-slate-500">All attempts associated with this student identity.</p></div>${attempts().length?attempts().map((attempt)=>`<div class="student-attempt-row"><div class="min-w-0 flex-1"><strong class="block truncate text-sm text-slate-900">${e(attempt.sessionTitle)}</strong><span class="text-xs text-slate-500">${e(attempt.classLevel)} · ${attempt.submittedAt?'Submitted':'In progress'}</span></div>${badge(attempt.submittedAt?'locked':'resume',attempt.submittedAt?'success':'warning')}</div>`).join(''):'<p class="p-6 text-sm text-slate-500">No exam attempts yet.</p>'}</section>`;
  const analyticsPage = () => {
    const submitted = attempts().filter((attempt) => attempt.submittedAt);
    if (!submitted.length) return '<section class="surface p-7 text-sm text-slate-600">No submitted results yet.</section>';
    const attempt = submitted[0];
    const unlocked = answerUnlocked(attempt);
    return `<section class="student-metric-grid">${metric('Score',`${attempt.score??0}%`,'latest submitted exam')}${metric('Completion',`${attempt.completion??100}%`,'questions completed')}${metric('Pace',`${attempt.paceIndex??0}`,'exam-derived pace index')}${metric('Integrity',`${attempt.integrityScore??100}%`,'browser integrity score')}</section><section class="surface mt-5 p-5"><h2 class="section-title">Subject performance</h2><div class="mt-4 grid gap-3">${(attempt.subjectStats||[]).map((item)=>`<div class="mini-metric"><span>${e(item.subject)}</span><strong>${item.percent}%</strong></div>`).join('')||'<p class="text-sm text-slate-500">No subject breakdown available.</p>'}</div><div class="mt-5 alert ${unlocked?'alert-success':'alert-info'}"><strong>${unlocked?'Answer review unlocked':'Answers remain locked'}</strong><span>${unlocked?'The examination is closed, so review details may now be displayed.':'Correct answers are hidden until the administrator closes the examination.'}</span></div>${unlocked?`<div class="mt-4 space-y-3">${(attempt.details||[]).map((detail,index)=>`<article class="surface-soft p-4"><strong class="text-sm">Question ${index+1}</strong><p class="mt-1 text-xs text-slate-500">Correct answer: ${e(detail.correctAnswer||'Unavailable')}</p></article>`).join('')}</div>`:''}</section>`;
  };
  const historyPage = () => `<section class="surface overflow-hidden"><div class="border-b border-slate-200 p-5"><h2 class="section-title">Exam history</h2></div>${attempts().map((attempt)=>`<div class="student-attempt-row"><div class="flex-1"><strong class="block text-sm">${e(attempt.sessionTitle)}</strong><span class="text-xs text-slate-500">${attempt.submittedAt?new Date(attempt.submittedAt).toLocaleString('en-NG'):'Unsubmitted · resumable while open'}</span></div><strong>${attempt.submittedAt?`${attempt.score??0}%`:'—'}</strong></div>`).join('')||'<p class="p-6 text-sm text-slate-500">No history yet.</p>'}</section>`;
  const progressPage = () => {
    const completed = attempts().filter((attempt) => attempt.submittedAt);
    const qualifier = completed.find((attempt) => attempt.placement);
    const placement = qualifier?.placement;
    return `<section class="grid gap-5 lg:grid-cols-2"><article class="surface-raised p-6"><p class="eyebrow">Academic session</p><h2 class="mt-2 font-display text-2xl font-extrabold">${e(profile()?.academicSession||Store.ACADEMIC_SESSION)}</h2><p class="mt-2 text-sm text-slate-600">Student: ${e(profile()?.fullName||'—')}</p></article><article class="surface-raised p-6"><p class="eyebrow">Placement / promotion</p><h2 class="mt-2 font-display text-2xl font-extrabold">${e(placement?.assignedTrack||'Pending')}</h2><p class="mt-2 text-sm text-slate-600">${placement?`${placement.confidence}% confidence · exam-derived recommendation`:'Complete a qualifier or promotion assessment to populate this view.'}</p></article></section>`;
  };
  const profilePage = () => {
    const current = profile();
    return `<section class="surface-raised max-w-3xl p-6"><h2 class="section-title">Profile management</h2><p class="mt-2 text-sm text-slate-600">Your examination identity is fixed to the authenticated first and last name. Contact the school to change those credentials.</p><form id="student-profile-form" class="mt-6 grid gap-4 sm:grid-cols-2"><label class="text-sm font-bold">First name<input class="field mt-2" value="${e(current?.firstName||'')}" disabled></label><label class="text-sm font-bold">Last name<input class="field mt-2" value="${e(current?.lastName||'')}" disabled></label><label class="text-sm font-bold">Guardian<input id="profile-guardian" class="field mt-2" value="${e(current?.guardian||'')}"></label><label class="text-sm font-bold">Phone<input id="profile-phone" class="field mt-2" value="${e(current?.phone||'')}"></label><button class="btn btn-primary sm:col-span-2" type="submit">Save profile</button></form></section>`;
  };

  const render = () => {
    if (sessionError) {
      gate(sessionError);
      return;
    }
    if (!portalAuthed()) {
      gate();
      return;
    }
    if (session) {
      location.replace(examHref());
      return;
    }
    const body = ({ home: dashboard, exams: examsPage, analytics: analyticsPage, history: historyPage, progress: progressPage, profile: profilePage }[page])();
    root.innerHTML = shell(body);
    bindPortal();
  };

  const bindGate = () => {
    document.getElementById('student-login-form')?.addEventListener('submit', async (event) => {
      event.preventDefault();
      const error = document.getElementById('student-login-error');
      try {
        const first = document.getElementById('student-first-name').value;
        const last = document.getElementById('student-last-name').value;
        const credentials = Engine.candidateCredentials(first, last);
        const studentHash = await Engine.studentHash(first, last);
        Store.setStudentAuth(studentHash);
        const existing = profile();
        Store.saveStudentProfile({ ...existing, firstName: credentials.firstName, lastName: credentials.lastName, fullName: credentials.fullName, candidateHash: existing?.candidateHash || studentHash, studentHash, academicSession: session?.academicSession || existing?.academicSession || Store.ACADEMIC_SESSION });
        if (session) {
          const candidateHash = await Engine.candidateHash(session.id, first, last);
          Store.setActiveCandidate(session.id, candidateHash);
          Store.saveStudentProfile({ ...Store.getStudentProfile(), candidateHash, currentClassId: session.classGroup, academicSession: session.academicSession });
          location.replace(examHref());
          return;
        }
        render();
      } catch (failure) {
        error.textContent = failure.message;
        error.classList.remove('hidden');
      }
    });
  };

  const bindPortal = () => {
    document.getElementById('student-menu')?.addEventListener('click', () => {
      document.getElementById('student-sidebar')?.classList.add('student-sidebar-open');
      document.getElementById('student-scrim')?.classList.remove('hidden');
    });
    document.getElementById('student-scrim')?.addEventListener('click', () => {
      document.getElementById('student-sidebar')?.classList.remove('student-sidebar-open');
      document.getElementById('student-scrim')?.classList.add('hidden');
    });
    document.querySelector('[data-student-logout]')?.addEventListener('click', () => {
      Store.clearStudentAuth();
      render();
    });
    document.getElementById('student-profile-form')?.addEventListener('submit', (event) => {
      event.preventDefault();
      const current = profile();
      Store.saveStudentProfile({ ...current, guardian: document.getElementById('profile-guardian').value, phone: document.getElementById('profile-phone').value });
      render();
    });
  };

  Data.load().then((payload) => {
    data = payload;
    render();
  }).catch((failure) => {
    root.innerHTML = `<main class="p-6"><div class="alert alert-danger"><strong>Question data unavailable</strong><span>${e(failure.message)}</span></div></main>`;
  });
})();
