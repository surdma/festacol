(() => {
  'use strict';

  const { store, assessment, proctor, utils } = window.Festacol || {};
  const root = document.getElementById('app');
  if (!store || !assessment || !proctor || !utils || !root) {
    throw new Error('Festacol student dependencies are unavailable.');
  }

  const ART = Object.freeze({
    question: 'https://raw.githubusercontent.com/themesberg/flowbite-illustrations/main/src/3d/light/man-question-marks.svg'
  });
  const PAGES = new Set(['home', 'exams', 'analytics', 'history', 'progress', 'profile']);
  const currentUrl = new URL(location.href);
  const token = currentUrl.searchParams.get('session');
  let page = PAGES.has(currentUrl.searchParams.get('page')) ? currentUrl.searchParams.get('page') : 'home';
  let session = null;
  let sessionError = '';
  let lastDialogFocus = null;
  let lastMenuFocus = null;

  const escapeHtml = (value) => String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');

  const fieldClass = 'mt-2 block min-h-11 w-full rounded-xl border border-neutral-300 bg-white px-3 py-2.5 text-base text-neutral-950 shadow-sm outline-none transition focus:border-neutral-950 focus:ring-4 focus:ring-neutral-200 disabled:cursor-not-allowed disabled:bg-neutral-100 disabled:text-neutral-500 motion-reduce:transition-none';
  const primaryButton = 'inline-flex min-h-11 items-center justify-center rounded-xl bg-neutral-950 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-neutral-800 focus:outline-none focus:ring-4 focus:ring-neutral-300 disabled:cursor-not-allowed disabled:opacity-50 motion-reduce:transition-none';
  const secondaryButton = 'inline-flex min-h-11 items-center justify-center rounded-xl border border-neutral-300 bg-white px-4 py-2.5 text-sm font-semibold text-neutral-800 shadow-sm transition hover:bg-neutral-50 focus:outline-none focus:ring-4 focus:ring-neutral-200 motion-reduce:transition-none';
  const cardClass = 'rounded-2xl border border-neutral-200 bg-white shadow-sm';
  const raisedCardClass = 'rounded-2xl border border-neutral-200 bg-white shadow-lg shadow-neutral-950/5';
  const eyebrowClass = 'text-xs font-semibold uppercase tracking-[0.14em] text-neutral-500';

  const badgeClasses = Object.freeze({
    brand: 'inline-flex min-h-7 items-center rounded-full bg-neutral-950 px-2.5 py-1 text-xs font-semibold text-white',
    neutral: 'inline-flex min-h-7 items-center rounded-full bg-neutral-100 px-2.5 py-1 text-xs font-semibold text-neutral-700',
    success: 'inline-flex min-h-7 items-center rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-800 ring-1 ring-inset ring-emerald-200',
    warning: 'inline-flex min-h-7 items-center rounded-full bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-800 ring-1 ring-inset ring-amber-200'
  });

  try {
    if (token) session = store.resolveSession(store.decodeSession(token));
  } catch (failure) {
    sessionError = failure.message;
  }

  const profile = () => store.getStudentProfile();
  const portalAuthed = () => {
    const current = profile();
    return Boolean(current?.studentHash && store.getStudentAuth() === current.studentHash);
  };
  const attempts = () => {
    const current = profile();
    return current?.studentHash ? store.attemptsForStudent(current.studentHash) : [];
  };
  const answerUnlocked = (attempt) => {
    const source = store.listSessions().find((item) => item.id === attempt.sessionId) || session;
    return assessment.answersMayBeRevealed(source, source?.status);
  };
  const navHref = (next) => utils.routeUrl('student', { page: next }, location.href);
  const examHref = (examSession = session) => utils.routeUrl(
    'exam',
    examSession ? { session: store.encodeSession(examSession) } : { session: token || undefined },
    location.href
  );
  const badge = (text, tone = 'neutral') => `<span class="${badgeClasses[tone] || badgeClasses.neutral}">${escapeHtml(text)}</span>`;

  const navItems = Object.freeze([
    ['home', 'Dashboard'],
    ['exams', 'My exams'],
    ['analytics', 'Analytics'],
    ['history', 'Exam history'],
    ['progress', 'Progress & promotion'],
    ['profile', 'Profile']
  ]);

  const examAccessMarkup = () => `
    <button id="exam-id-launch" type="button" class="${primaryButton} fixed bottom-4 right-4 z-40 shadow-xl sm:bottom-6 sm:right-6">Enter exam ID</button>
    <dialog id="exam-id-dialog" aria-labelledby="exam-id-title" class="w-[calc(100%_-_1.5rem)] max-w-lg rounded-2xl border border-neutral-200 bg-white p-0 text-neutral-950 shadow-2xl backdrop:bg-neutral-950/50 backdrop:backdrop-blur-sm sm:w-[calc(100%_-_3rem)]">
      <form id="exam-id-form" class="p-5 sm:p-6">
        <div class="flex items-start gap-4">
          <div class="min-w-0 flex-1">
            <p class="${eyebrowClass}">Manual exam access</p>
            <h2 id="exam-id-title" class="mt-1 font-display text-2xl font-extrabold text-neutral-950">Enter the Exam ID.</h2>
            <p class="mt-2 text-sm leading-6 text-neutral-600">Use the ID shown below the QR code by your school if you cannot scan it.</p>
          </div>
          <button id="exam-id-close" type="button" class="grid size-11 shrink-0 place-items-center rounded-xl border border-neutral-300 bg-white text-sm font-semibold text-neutral-700 transition hover:bg-neutral-50 focus:outline-none focus:ring-4 focus:ring-neutral-200 motion-reduce:transition-none" aria-label="Close Exam ID dialog">Close</button>
        </div>
        <label for="exam-id-input" class="mt-6 block text-sm font-semibold text-neutral-800">Exam ID</label>
        <input id="exam-id-input" class="${fieldClass} font-mono uppercase tracking-[.12em]" maxlength="20" autocomplete="off" placeholder="e.g. A1B2C3D4" required>
        <div id="exam-id-error" class="mt-3 hidden rounded-xl border border-red-200 bg-red-50 p-3 text-sm font-medium text-red-800" role="alert"></div>
        <button class="${primaryButton} mt-5 w-full" type="submit">Open examination</button>
      </form>
    </dialog>`;

  const mount = (markup) => {
    root.innerHTML = `${markup}${examAccessMarkup()}`;
    bindExamAccess();
  };

  const gateMarkup = (message = '') => `
    <main class="min-h-dvh bg-neutral-100 p-4 sm:p-7">
      <div class="mx-auto grid min-h-[calc(100dvh-2rem)] max-w-6xl overflow-hidden rounded-[2rem] border border-neutral-200 bg-white shadow-xl sm:min-h-[calc(100dvh-3.5rem)] lg:grid-cols-[.85fr_1.15fr]">
        <section class="flex flex-col justify-between bg-neutral-950 p-7 text-white sm:p-10">
          <div class="flex items-center gap-3"><span class="grid size-11 place-items-center rounded-xl bg-white text-sm font-black text-black">F</span><div><strong class="block font-display text-sm font-extrabold">Festacol</strong><span class="text-xs text-neutral-400">Student portal</span></div></div>
          <div class="py-12"><p class="text-xs font-extrabold uppercase tracking-[.18em] text-neutral-500">Private student workspace</p><h1 class="mt-4 font-display text-4xl font-extrabold leading-tight sm:text-5xl">Your exams, results and progress stay behind sign in.</h1><p class="mt-5 max-w-sm text-base leading-7 text-neutral-400">Candidates must authenticate before the academic dashboard becomes available.</p></div>
          <span class="text-xs text-neutral-500">${escapeHtml(store.ACADEMIC_SESSION)} academic session</span>
        </section>
        <section class="flex items-center p-7 sm:p-11">
          <div class="mx-auto w-full max-w-xl">
            ${badge('Student authentication', 'brand')}
            <h2 class="mt-4 font-display text-3xl font-extrabold text-neutral-950">Sign in with your candidate credentials.</h2>
            <p class="mt-3 text-base leading-7 text-neutral-600">Your first name is your username and your last name is your password.${session ? ' After sign in, Festacol will open the exact examination from your link.' : ''}</p>
            ${message ? `<div class="mt-5 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-900" role="alert"><strong class="block font-semibold">Unable to continue</strong><span class="mt-1 block">${escapeHtml(message)}</span></div>` : ''}
            <form id="student-login-form" class="mt-7 grid gap-4 sm:grid-cols-2" novalidate>
              <label for="student-first-name" class="text-sm font-semibold text-neutral-800">First name · username</label>
              <label for="student-last-name" class="text-sm font-semibold text-neutral-800 sm:col-start-2">Last name · password</label>
              <input id="student-first-name" class="${fieldClass} mt-0" autocomplete="given-name" required>
              <input id="student-last-name" type="password" class="${fieldClass} mt-0" autocomplete="current-password" required>
              <p id="student-login-error" class="hidden rounded-xl border border-red-200 bg-red-50 p-3 text-sm font-medium text-red-800 sm:col-span-2" role="alert"></p>
              <button class="${primaryButton} sm:col-span-2" type="submit">${session ? 'Continue to examination' : 'Open student portal'}</button>
            </form>
            ${session ? `<div class="mt-6 rounded-2xl border border-neutral-200 bg-neutral-50 p-4"><p class="${eyebrowClass}">Linked examination</p><strong class="mt-1 block text-sm text-neutral-950">${escapeHtml(session.title)}</strong><span class="mt-1 block text-xs text-neutral-500">${escapeHtml(session.classLevel)} · ${escapeHtml(store.getModeLabel(session.mode))}</span></div>` : ''}
          </div>
        </section>
      </div>
    </main>`;

  const shellMarkup = (content) => {
    const current = profile();
    const activeTitle = navItems.find(([key]) => key === page)?.[1] || 'Dashboard';
    const navigation = navItems.map(([key, label]) => {
      const active = page === key;
      return `<a href="${navHref(key)}" class="flex min-h-11 items-center rounded-xl px-3 text-sm font-semibold transition focus:outline-none focus:ring-4 focus:ring-neutral-200 motion-reduce:transition-none ${active ? 'bg-neutral-950 text-white' : 'text-neutral-600 hover:bg-neutral-100 hover:text-neutral-950'}" ${active ? 'aria-current="page"' : ''}>${escapeHtml(label)}</a>`;
    }).join('');
    const initials = `${current?.firstName?.[0] || ''}${current?.lastName?.[0] || ''}` || 'S';

    return `<div class="min-h-dvh bg-neutral-50">
      <button id="student-menu" type="button" class="fixed left-4 top-4 z-40 grid size-11 place-items-center rounded-xl border border-neutral-200 bg-white text-sm font-semibold text-neutral-800 shadow-sm transition hover:bg-neutral-50 focus:outline-none focus:ring-4 focus:ring-neutral-200 lg:hidden motion-reduce:transition-none" aria-controls="student-sidebar" aria-expanded="false">Menu</button>
      <div id="student-scrim" class="fixed inset-0 z-40 hidden bg-neutral-950/40 backdrop-blur-sm lg:hidden"></div>
      <aside id="student-sidebar" class="fixed inset-y-0 left-0 z-50 hidden w-[min(19rem,88vw)] flex-col border-r border-neutral-200 bg-white shadow-2xl shadow-neutral-950/10 lg:flex lg:w-72 lg:shadow-none">
        <div class="p-5"><a href="${navHref('home')}" class="flex min-h-11 items-center gap-3 rounded-xl focus:outline-none focus:ring-4 focus:ring-neutral-200"><span class="grid size-11 place-items-center rounded-xl bg-neutral-950 text-sm font-black text-white">F</span><span><strong class="block font-display text-base font-extrabold text-neutral-950">Festacol</strong><small class="block text-xs text-neutral-500">Student intelligence portal</small></span></a></div>
        <nav class="grid gap-1 px-3" aria-label="Student navigation">${navigation}</nav>
        <div class="mt-auto border-t border-neutral-200 p-4"><div class="flex items-center gap-3"><span class="grid size-11 shrink-0 place-items-center rounded-full bg-neutral-100 text-xs font-bold text-neutral-700">${escapeHtml(initials)}</span><div class="min-w-0 flex-1"><strong class="block truncate text-sm text-neutral-900">${escapeHtml(current?.fullName || 'Student')}</strong><span class="text-xs text-neutral-500">${escapeHtml(current?.academicSession || store.ACADEMIC_SESSION)}</span></div><button class="${secondaryButton} min-h-10 px-3 text-xs" type="button" data-student-logout>Sign out</button></div></div>
      </aside>
      <main class="min-h-dvh lg:pl-72">
        <header class="sticky top-0 z-30 border-b border-neutral-200 bg-white/95 px-4 py-3 pl-16 backdrop-blur lg:pl-6"><div class="mx-auto flex max-w-7xl items-center justify-between gap-4"><div><p class="${eyebrowClass}">Student portal</p><h1 class="font-display text-lg font-extrabold text-neutral-950">${escapeHtml(activeTitle)}</h1></div>${badge(current?.academicSession || store.ACADEMIC_SESSION, 'brand')}</div></header>
        <div class="mx-auto max-w-7xl p-4 sm:p-6 lg:p-7">${content}</div>
      </main>
    </div>`;
  };

  const metric = (label, value, detail) => `<article class="relative min-h-32 overflow-hidden ${cardClass} p-4"><span class="absolute right-4 top-4 size-2.5 rounded-full bg-neutral-950 ring-4 ring-neutral-100"></span><span class="${eyebrowClass}">${escapeHtml(label)}</span><strong class="mt-3 block font-display text-2xl font-extrabold tabular-nums text-neutral-950">${escapeHtml(value)}</strong><small class="mt-2 block text-xs leading-5 text-neutral-500">${escapeHtml(detail)}</small></article>`;

  const activeAttemptCard = () => {
    const open = attempts().find((attempt) => attempt.startedAt && !attempt.submittedAt);
    if (!open) return `<section class="${raisedCardClass} overflow-hidden lg:grid lg:grid-cols-[1fr_280px]"><div class="p-6 sm:p-8">${badge('No active exam')}<h2 class="mt-4 font-display text-3xl font-extrabold text-neutral-950">Use the examination link or QR code issued by your school.</h2><p class="mt-3 max-w-xl text-base leading-7 text-neutral-600">Exam links carry the exact session configuration. After authentication, they open directly into instructions or resume the same attempt.</p></div><div class="relative overflow-hidden border-t border-neutral-200 bg-neutral-100 p-5 lg:border-l lg:border-t-0"><img src="${ART.question}" alt="Student considering an examination question" class="mx-auto h-52 max-w-full" loading="lazy"></div></section>`;
    const savedSession = store.listSessions().find((item) => item.id === open.sessionId);
    if (!savedSession) return `<section class="${raisedCardClass} p-6">${badge('In progress', 'warning')}<h2 class="mt-3 font-display text-2xl font-extrabold text-neutral-950">${escapeHtml(open.sessionTitle)}</h2><p class="mt-2 text-sm leading-6 text-neutral-600">Reopen the original exam link to resume this attempt.</p></section>`;
    return `<section class="${raisedCardClass} p-6 sm:p-8">${badge('In progress', 'warning')}<h2 class="mt-4 font-display text-3xl font-extrabold text-neutral-950">${escapeHtml(open.sessionTitle)}</h2><p class="mt-2 text-base leading-7 text-neutral-600">Your exact attempt is saved and can be resumed while the examination remains available.</p><a class="${primaryButton} mt-6" href="${examHref(savedSession)}">Resume examination</a></section>`;
  };

  const dashboard = () => {
    const all = attempts();
    const submitted = all.filter((attempt) => attempt.submittedAt);
    const average = submitted.length ? Math.round(submitted.reduce((total, attempt) => total + (attempt.score || 0), 0) / submitted.length) : 0;
    const integrity = submitted.length ? Math.round(submitted.reduce((total, attempt) => total + (attempt.integrityScore ?? 100), 0) / submitted.length) : null;
    return `${activeAttemptCard()}<section class="mt-5 grid grid-cols-2 gap-3 xl:grid-cols-4">${metric('Completed', submitted.length, 'submitted exams')}${metric('Average', submitted.length ? `${average}%` : '—', 'across scored attempts')}${metric('Integrity', integrity === null ? '—' : `${integrity}%`, 'recorded browser signals')}${metric('Academic session', profile()?.academicSession || store.ACADEMIC_SESSION, 'current student profile')}</section>`;
  };

  const attemptRow = (attempt, trailing) => `<div class="flex min-h-[4.5rem] items-center gap-3 border-b border-neutral-100 px-4 py-3 last:border-b-0"><div class="min-w-0 flex-1"><strong class="block truncate text-sm text-neutral-950">${escapeHtml(attempt.sessionTitle)}</strong><span class="mt-1 block text-xs text-neutral-500">${escapeHtml(attempt.classLevel || '—')} · ${attempt.submittedAt ? 'Submitted' : 'In progress'}</span></div>${trailing}</div>`;
  const examsPage = () => `<section class="${cardClass} overflow-hidden"><div class="border-b border-neutral-200 p-5"><h2 class="font-display text-lg font-extrabold text-neutral-950">Exam activity</h2><p class="mt-1 text-sm text-neutral-500">All attempts associated with this student identity.</p></div>${attempts().length ? attempts().map((attempt) => attemptRow(attempt, badge(attempt.submittedAt ? 'Locked' : 'Resume', attempt.submittedAt ? 'success' : 'warning'))).join('') : '<p class="p-6 text-sm text-neutral-500">No exam attempts yet.</p>'}</section>`;

  const analyticsPage = () => {
    const submitted = attempts().filter((attempt) => attempt.submittedAt);
    if (!submitted.length) return `<section class="${cardClass} p-7 text-sm text-neutral-600">No submitted results yet.</section>`;
    const attempt = submitted[0];
    const unlocked = answerUnlocked(attempt);
    const subjectStats = (attempt.subjectStats || []).map((item) => `<div class="flex items-center justify-between gap-4 rounded-xl border border-neutral-200 bg-neutral-50 p-3"><span class="text-sm text-neutral-700">${escapeHtml(item.subject)}</span><strong class="tabular-nums text-neutral-950">${escapeHtml(`${item.percent}%`)}</strong></div>`).join('');
    const details = unlocked ? (attempt.details || []).map((detail, index) => `<article class="rounded-xl border border-neutral-200 bg-neutral-50 p-4"><strong class="text-sm text-neutral-950">Question ${index + 1}</strong><p class="mt-1 text-xs text-neutral-500">Correct answer: ${escapeHtml(detail.correctAnswer || 'Unavailable')}</p></article>`).join('') : '';
    return `<section class="grid grid-cols-2 gap-3 xl:grid-cols-4">${metric('Score', `${attempt.score ?? 0}%`, 'latest submitted exam')}${metric('Completion', `${attempt.completion ?? 100}%`, 'questions completed')}${metric('Pace', `${attempt.paceIndex ?? 0}`, 'exam-derived pace index')}${metric('Integrity', `${attempt.integrityScore ?? 100}%`, 'browser integrity score')}</section><section class="${cardClass} mt-5 p-5"><h2 class="font-display text-lg font-extrabold text-neutral-950">Subject performance</h2><div class="mt-4 grid gap-3">${subjectStats || '<p class="text-sm text-neutral-500">No subject breakdown available.</p>'}</div><div class="mt-5 rounded-xl border p-4 text-sm ${unlocked ? 'border-emerald-200 bg-emerald-50 text-emerald-900' : 'border-blue-200 bg-blue-50 text-blue-900'}"><strong class="block font-semibold">${unlocked ? 'Answer review unlocked' : 'Answers remain locked'}</strong><span class="mt-1 block">${unlocked ? 'The examination is closed, so review details may now be displayed.' : 'Correct answers are hidden until the administrator closes the examination.'}</span></div>${details ? `<div class="mt-4 grid gap-3">${details}</div>` : ''}</section>`;
  };

  const historyPage = () => `<section class="${cardClass} overflow-hidden"><div class="border-b border-neutral-200 p-5"><h2 class="font-display text-lg font-extrabold text-neutral-950">Exam history</h2></div>${attempts().length ? attempts().map((attempt) => attemptRow(attempt, `<strong class="tabular-nums text-neutral-950">${attempt.submittedAt ? `${attempt.score ?? 0}%` : '—'}</strong>`)).join('') : '<p class="p-6 text-sm text-neutral-500">No history yet.</p>'}</section>`;

  const progressPage = () => {
    const completed = attempts().filter((attempt) => attempt.submittedAt);
    const qualifier = completed.find((attempt) => attempt.placement);
    const placement = qualifier?.placement;
    return `<section class="grid gap-5 lg:grid-cols-2"><article class="${raisedCardClass} p-6"><p class="${eyebrowClass}">Academic session</p><h2 class="mt-2 font-display text-2xl font-extrabold text-neutral-950">${escapeHtml(profile()?.academicSession || store.ACADEMIC_SESSION)}</h2><p class="mt-2 text-sm text-neutral-600">Student: ${escapeHtml(profile()?.fullName || '—')}</p></article><article class="${raisedCardClass} p-6"><p class="${eyebrowClass}">Placement / promotion</p><h2 class="mt-2 font-display text-2xl font-extrabold text-neutral-950">${escapeHtml(placement?.assignedTrack || 'Pending')}</h2><p class="mt-2 text-sm text-neutral-600">${placement ? `${escapeHtml(placement.confidence)}% confidence · exam-derived recommendation` : 'Complete a qualifier or promotion assessment to populate this view.'}</p></article></section>`;
  };

  const profilePage = () => {
    const current = profile();
    return `<section class="${raisedCardClass} max-w-3xl p-6"><h2 class="font-display text-lg font-extrabold text-neutral-950">Profile management</h2><p class="mt-2 text-sm leading-6 text-neutral-600">Your examination identity is fixed to the authenticated first and last name. Contact the school to change those credentials.</p><form id="student-profile-form" class="mt-6 grid gap-4 sm:grid-cols-2"><label for="profile-first" class="text-sm font-semibold text-neutral-800">First name</label><label for="profile-last" class="text-sm font-semibold text-neutral-800 sm:col-start-2">Last name</label><input id="profile-first" class="${fieldClass} mt-0" value="${escapeHtml(current?.firstName || '')}" disabled><input id="profile-last" class="${fieldClass} mt-0" value="${escapeHtml(current?.lastName || '')}" disabled><label for="profile-guardian" class="text-sm font-semibold text-neutral-800">Guardian</label><label for="profile-phone" class="text-sm font-semibold text-neutral-800 sm:col-start-2">Phone</label><input id="profile-guardian" class="${fieldClass} mt-0" value="${escapeHtml(current?.guardian || '')}"><input id="profile-phone" class="${fieldClass} mt-0" value="${escapeHtml(current?.phone || '')}"><button class="${primaryButton} sm:col-span-2" type="submit">Save profile</button></form></section>`;
  };

  const render = () => {
    if (sessionError) {
      mount(gateMarkup(sessionError));
      bindGate();
      return;
    }
    if (!portalAuthed()) {
      mount(gateMarkup());
      bindGate();
      return;
    }
    if (session) {
      location.replace(examHref(session));
      return;
    }
    const renderPage = { home: dashboard, exams: examsPage, analytics: analyticsPage, history: historyPage, progress: progressPage, profile: profilePage }[page] || dashboard;
    mount(shellMarkup(renderPage()));
    bindPortal();
  };

  const bindGate = () => {
    document.getElementById('student-login-form')?.addEventListener('submit', async (event) => {
      event.preventDefault();
      const error = document.getElementById('student-login-error');
      error?.classList.add('hidden');
      try {
        const first = document.getElementById('student-first-name')?.value || '';
        const last = document.getElementById('student-last-name')?.value || '';
        const credentials = assessment.candidateCredentials(first, last);
        const studentHash = await assessment.studentHash(first, last);
        store.setStudentAuth(studentHash);
        const existing = profile();
        store.saveStudentProfile({ ...existing, firstName: credentials.firstName, lastName: credentials.lastName, fullName: credentials.fullName, candidateHash: existing?.candidateHash || studentHash, studentHash, academicSession: session?.academicSession || existing?.academicSession || store.ACADEMIC_SESSION });
        if (session) {
          const candidateHash = await assessment.candidateHash(session.id, first, last);
          store.setActiveCandidate(session.id, candidateHash);
          store.saveStudentProfile({ ...store.getStudentProfile(), candidateHash, currentClassId: session.classGroup, academicSession: session.academicSession });
          location.replace(examHref(session));
          return;
        }
        render();
      } catch (failure) {
        if (error) {
          error.textContent = failure.message;
          error.classList.remove('hidden');
        }
      }
    });
  };

  const closeMenu = ({ restoreFocus = true } = {}) => {
    const sidebar = document.getElementById('student-sidebar');
    const scrim = document.getElementById('student-scrim');
    const trigger = document.getElementById('student-menu');
    sidebar?.classList.add('hidden');
    sidebar?.classList.remove('flex');
    scrim?.classList.add('hidden');
    trigger?.setAttribute('aria-expanded', 'false');
    if (restoreFocus) lastMenuFocus?.focus?.();
  };

  const bindPortal = () => {
    const menu = document.getElementById('student-menu');
    menu?.addEventListener('click', () => {
      const sidebar = document.getElementById('student-sidebar');
      const scrim = document.getElementById('student-scrim');
      lastMenuFocus = document.activeElement;
      sidebar?.classList.remove('hidden');
      sidebar?.classList.add('flex');
      scrim?.classList.remove('hidden');
      menu.setAttribute('aria-expanded', 'true');
      sidebar?.querySelector('a')?.focus();
    });
    document.getElementById('student-scrim')?.addEventListener('click', () => closeMenu());
    document.querySelector('[data-student-logout]')?.addEventListener('click', () => {
      store.clearStudentAuth();
      render();
    });
    document.getElementById('student-profile-form')?.addEventListener('submit', (event) => {
      event.preventDefault();
      const current = profile();
      store.saveStudentProfile({ ...current, guardian: document.getElementById('profile-guardian')?.value || '', phone: document.getElementById('profile-phone')?.value || '' });
      render();
    });
  };

  function bindExamAccess() {
    const launch = document.getElementById('exam-id-launch');
    const dialog = document.getElementById('exam-id-dialog');
    const close = document.getElementById('exam-id-close');
    const form = document.getElementById('exam-id-form');
    const input = document.getElementById('exam-id-input');
    const error = document.getElementById('exam-id-error');
    if (!launch || !dialog || !form || !input || !error) return;

    const closeDialog = () => {
      if (dialog.open) dialog.close();
      lastDialogFocus?.focus?.();
    };

    launch.addEventListener('click', () => {
      lastDialogFocus = document.activeElement;
      error.classList.add('hidden');
      error.textContent = '';
      dialog.showModal();
      queueMicrotask(() => input.focus());
    });
    close?.addEventListener('click', closeDialog);
    dialog.addEventListener('click', (event) => {
      if (event.target === dialog) closeDialog();
    });
    dialog.addEventListener('cancel', (event) => {
      event.preventDefault();
      closeDialog();
    });
    dialog.addEventListener('close', () => {
      lastDialogFocus?.focus?.();
    });
    form.addEventListener('submit', (event) => {
      event.preventDefault();
      error.classList.add('hidden');
      error.textContent = '';
      const id = input.value.trim().toUpperCase();
      const found = store.findSessionById(id);
      if (!found) {
        error.textContent = 'No examination matches that ID. Check the characters and try again.';
        error.classList.remove('hidden');
        return;
      }
      if (found.status === 'draft') {
        error.textContent = 'This examination has not been published yet.';
        error.classList.remove('hidden');
        return;
      }
      if (found.status === 'closed' || (found.endsAt && Date.now() > found.endsAt)) {
        error.textContent = 'This examination is closed.';
        error.classList.remove('hidden');
        return;
      }
      if (found.startsAt && Date.now() < found.startsAt) {
        error.textContent = 'This examination is not open yet.';
        error.classList.remove('hidden');
        return;
      }
      const link = proctor.decorateStudentLink(store.getSessionLink(found, location.href), proctor.getAdminPolicy(found.id).cameraRequired);
      location.assign(link);
    });
  }

  document.addEventListener('keydown', (event) => {
    if (event.key !== 'Escape') return;
    const dialog = document.getElementById('exam-id-dialog');
    if (dialog?.open) return;
    const sidebar = document.getElementById('student-sidebar');
    if (sidebar && !sidebar.classList.contains('hidden') && matchMedia('(max-width: 1023px)').matches) closeMenu();
  });

  render();
})();
