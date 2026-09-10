(() => {
  'use strict';

  const questions = window.FESTACOL_QUESTIONS || [];
  const STORAGE_KEY = 'festacol-cbt-demo-v2';
  const EXAM_DURATION_MS = 60 * 60 * 1000;

  const ICONS = Object.freeze({
    home: '<svg class="size-5" aria-hidden="true" xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="none" viewBox="0 0 24 24"><path stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="m4 12 8-8 8 8M6 10.5V19a1 1 0 0 0 1 1h3v-3a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1v3h3a1 1 0 0 0 1-1v-8.5"/></svg>',
    book: '<svg class="size-5" aria-hidden="true" xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="none" viewBox="0 0 24 24"><path stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 6.03v13m0-13c-2.819-.831-4.715-1.076-8.029-1.023A.99.99 0 0 0 3 6v11c0 .563.466 1.014 1.03 1.007 3.122-.043 5.018.212 7.97 1.023m0-13c2.819-.831 4.715-1.076 8.029-1.023A.99.99 0 0 1 21 6v11c0 .563-.466 1.014-1.03 1.007-3.122-.043-5.018.212-7.97 1.023"/></svg>',
    check: '<svg class="size-5" aria-hidden="true" xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="none" viewBox="0 0 24 24"><path stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8.5 11.5 11 14l4-4m6 2a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z"/></svg>',
    warn: '<svg class="size-5 shrink-0" aria-hidden="true" xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="none" viewBox="0 0 24 24"><path stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 13V8m0 8h.01M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z"/></svg>',
    flag: '<svg class="size-4" aria-hidden="true" xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="none" viewBox="0 0 24 24"><path stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 14v7M5 4.971v9.541c5.6-5.538 8.4 2.64 14-.086v-9.54C13.4 7.61 10.6-.568 5 4.97Z"/></svg>'
  });

  const BTN_PRIMARY = 'inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-black px-4 py-2.5 text-sm font-semibold text-white hover:bg-neutral-800 focus:outline-none focus:ring-2 focus:ring-black focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-40';
  const BTN_SECONDARY = 'inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border border-neutral-300 bg-white px-4 py-2.5 text-sm font-semibold text-black hover:bg-neutral-100 focus:outline-none focus:ring-2 focus:ring-black focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-40';
  const BADGE = 'inline-flex min-h-7 items-center rounded-full border px-2.5 py-1 text-xs font-semibold';
  const FIELD = 'block min-h-11 w-full rounded-lg border border-neutral-300 bg-white px-3 py-2.5 text-sm text-black placeholder:text-neutral-400 hover:border-neutral-500 focus:border-black focus:outline-none focus:ring-2 focus:ring-black';

  const defaultState = () => ({
    currentView: 'home',
    activeQuestion: 0,
    responses: {},
    flagged: [],
    startedAt: null,
    endAt: null,
    submittedAt: null,
    submissionReference: null,
    connection: 'online',
    navigatorFilter: 'all',
    requests: [
      { id: 'REQ-204', subject: 'English Language', exam: 'Continuous Assessment', requestedAt: '8 Sep 2026', status: 'Approved', note: 'Access approved. The assessment is ready to take.' },
      { id: 'REQ-197', subject: 'Biology', exam: 'Practical Theory Test', requestedAt: '7 Sep 2026', status: 'Pending', note: 'The school is reviewing this request.' },
      { id: 'REQ-184', subject: 'Government', exam: 'Make-up Test', requestedAt: '2 Sep 2026', status: 'Rejected', note: 'The request window for this test has closed.' }
    ]
  });

  function loadState() {
    const fallback = defaultState();
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return fallback;
      const parsed = JSON.parse(raw);
      return {
        ...fallback,
        ...parsed,
        responses: parsed.responses || {},
        flagged: Array.isArray(parsed.flagged) ? parsed.flagged : [],
        requests: Array.isArray(parsed.requests) ? parsed.requests : fallback.requests
      };
    } catch {
      return fallback;
    }
  }

  let state = loadState();
  let saveTimer = null;
  let clockTimer = null;

  const standardShell = document.getElementById('standard-shell');
  const examApp = document.getElementById('exam-app');
  const pageRoot = document.getElementById('page-root');
  const standardHeader = document.getElementById('standard-header');

  function persist() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch {
      // Browser storage is optional in this standalone prototype.
    }
  }

  function escapeText(value) {
    return String(value ?? '')
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;')
      .replaceAll("'", '&#039;');
  }

  function formatDateTime(timestamp) {
    if (!timestamp) return '—';
    return new Intl.DateTimeFormat('en-NG', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(timestamp));
  }

  function announce(message) {
    const region = document.getElementById('global-announcer');
    region.textContent = '';
    window.setTimeout(() => { region.textContent = message; }, 20);
  }

  function showStandardShell() {
    standardShell.classList.remove('hidden');
    examApp.classList.add('hidden');
    examApp.setAttribute('aria-hidden', 'true');
  }

  function showExamShell() {
    standardShell.classList.add('hidden');
    examApp.classList.remove('hidden');
    examApp.setAttribute('aria-hidden', 'false');
  }

  function setActiveNav(view) {
    document.querySelectorAll('[data-nav-link]').forEach((button) => {
      const active = button.dataset.view === view;
      button.className = active
        ? 'min-h-11 rounded-lg bg-neutral-100 px-3 text-sm font-semibold text-black focus:outline-none focus:ring-2 focus:ring-black focus:ring-offset-2'
        : 'min-h-11 rounded-lg px-3 text-sm font-medium text-neutral-600 hover:bg-neutral-100 hover:text-black focus:outline-none focus:ring-2 focus:ring-black focus:ring-offset-2';
      if (active) button.setAttribute('aria-current', 'page');
      else button.removeAttribute('aria-current');
    });
  }

  function navigate(view, options = {}) {
    state.currentView = view;
    persist();

    if (view === 'exam') {
      showExamShell();
      renderQuestion();
      renderConnectionState();
      startClock();
      if (!options.preserveScroll) window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }

    const timedReview = view === 'review' && state.startedAt && !state.submittedAt;
    if (!timedReview) stopClock();
    showStandardShell();
    standardHeader.classList.toggle('hidden', timedReview);
    setActiveNav(view);

    if (view === 'home') renderHome();
    else if (view === 'requests') renderRequests();
    else if (view === 'history') renderHistory();
    else if (view === 'instructions') renderInstructions();
    else if (view === 'review') renderReview();
    else if (view === 'submitted') renderSubmitted();
    else renderHome();

    if (timedReview) startClock();
    if (!options.preserveScroll) window.scrollTo({ top: 0, behavior: 'smooth' });
    requestAnimationFrame(() => pageRoot.focus({ preventScroll: true }));
  }

  function pageHeader(eyebrow, heading, description, action = '') {
    return `
      <div class="mb-8 flex flex-col gap-5 sm:mb-10 sm:flex-row sm:items-end sm:justify-between">
        <div class="max-w-3xl">
          <p class="mb-2 text-xs font-bold uppercase tracking-widest text-neutral-500">${escapeText(eyebrow)}</p>
          <h1 class="text-3xl font-bold tracking-tight text-black sm:text-4xl">${escapeText(heading)}</h1>
          <p class="mt-3 max-w-2xl text-base leading-7 text-neutral-600">${escapeText(description)}</p>
        </div>
        ${action}
      </div>`;
  }

  function statusBadge(status) {
    const map = {
      'Available now': `${BADGE} border-black bg-black text-white`,
      'Ready to take': `${BADGE} border-black bg-white text-black`,
      'In progress': `${BADGE} border-black bg-black text-white`,
      Completed: `${BADGE} border-neutral-400 bg-neutral-100 text-black`,
      Upcoming: `${BADGE} border-neutral-300 bg-white text-neutral-700`,
      'Request required': `${BADGE} border-dashed border-neutral-500 bg-white text-neutral-700`,
      Pending: `${BADGE} border-dashed border-neutral-500 bg-neutral-50 text-black`,
      Approved: `${BADGE} border-black bg-black text-white`,
      Rejected: `${BADGE} border-neutral-500 bg-white text-black`,
      Missed: `${BADGE} border-neutral-400 bg-neutral-100 text-neutral-700`,
      Closed: `${BADGE} border-neutral-400 bg-neutral-100 text-neutral-700`,
      'Access unavailable': `${BADGE} border-dashed border-neutral-500 bg-white text-neutral-700`
    };
    return `<span class="${map[status] || map.Upcoming}">${escapeText(status)}</span>`;
  }

  function examRow({ initials, subject, detail, schedule, secondaryLabel, secondaryValue, status, action, actionView, primary, disabled = false }) {
    return `
      <article class="grid grid-cols-12 gap-4 border-b border-neutral-200 p-4 last:border-b-0 sm:p-5">
        <div class="col-span-12 flex min-w-0 gap-3 sm:col-span-6 lg:col-span-5">
          <span class="grid size-10 shrink-0 place-items-center rounded-lg border border-neutral-400 text-xs font-bold" aria-hidden="true">${escapeText(initials)}</span>
          <div class="min-w-0">
            <h3 class="font-bold tracking-tight text-black">${escapeText(subject)}</h3>
            <p class="mt-1 text-sm leading-6 text-neutral-600">${escapeText(detail)}</p>
          </div>
        </div>
        <div class="col-span-6 sm:col-span-3 lg:col-span-2">
          <span class="block text-xs font-bold uppercase tracking-wider text-neutral-500">Schedule</span>
          <span class="mt-1 block text-sm font-semibold text-black">${escapeText(schedule)}</span>
        </div>
        <div class="col-span-6 sm:col-span-3 lg:col-span-2">
          <span class="block text-xs font-bold uppercase tracking-wider text-neutral-500">${escapeText(secondaryLabel)}</span>
          <span class="mt-1 block text-sm font-semibold text-black">${escapeText(secondaryValue)}</span>
          <div class="mt-2">${statusBadge(status)}</div>
        </div>
        <div class="col-span-12 flex items-center justify-start lg:col-span-3 lg:justify-end">
          <button type="button" ${disabled ? 'disabled' : `data-view="${actionView}"`} class="${primary ? BTN_PRIMARY : BTN_SECONDARY} w-full lg:w-auto">${escapeText(action)}</button>
        </div>
      </article>`;
  }

  function renderHome() {
    const inProgress = Boolean(state.startedAt && !state.submittedAt);
    const finished = Boolean(state.submittedAt);

    pageRoot.innerHTML = `
      <div class="mx-auto max-w-7xl px-4 py-10 sm:px-6 sm:py-12 lg:px-8">
        ${pageHeader(
          'Student examinations',
          inProgress ? 'Your examination is in progress.' : finished ? 'Your examination was submitted.' : 'Good evening, Maya.',
          inProgress ? 'Continue your Mathematics attempt when you are ready. Your saved responses remain available on this device.' : finished ? 'Your Mathematics submission has been received. Other assessments remain listed below.' : 'Everything you need for this term’s examinations is organized here.',
          `<button type="button" data-view="requests" class="${BTN_SECONDARY}">Request an exam</button>`
        )}

        <div class="mb-8 flex flex-wrap gap-2" aria-label="Student academic context">
          ${['FC/26/1048', 'SS 2 Science', '2026/2027 Session', 'First Term'].map((item) => `<span class="${BADGE} border-neutral-300 bg-white text-neutral-700">${item}</span>`).join('')}
        </div>

        ${inProgress ? `
          <section class="mb-8 grid gap-5 rounded-xl bg-black p-5 text-white sm:grid-cols-12 sm:items-center sm:p-6" aria-label="Examination in progress">
            <div class="sm:col-span-9">
              <p class="text-xs font-bold uppercase tracking-widest text-neutral-300">In progress</p>
              <h2 class="mt-2 text-xl font-bold tracking-tight">Mathematics · First Term Examination</h2>
              <p class="mt-2 text-sm leading-6 text-neutral-300">${answeredCount()} of ${questions.length} questions have complete responses.</p>
            </div>
            <div class="sm:col-span-3 sm:text-right">
              <button type="button" data-view="exam" class="inline-flex min-h-11 w-full items-center justify-center rounded-lg bg-white px-4 text-sm font-semibold text-black hover:bg-neutral-200 focus:outline-none focus:ring-2 focus:ring-white focus:ring-offset-2 focus:ring-offset-black sm:w-auto">Continue examination</button>
            </div>
          </section>` : ''}

        <section aria-labelledby="ready-heading">
          <div class="mb-4">
            <h2 id="ready-heading" class="text-xl font-bold tracking-tight">Ready to take</h2>
            <p class="mt-1 text-sm text-neutral-600">Examinations you can enter now.</p>
          </div>
          <div class="overflow-hidden rounded-xl border border-neutral-200 bg-white shadow-sm">
            ${examRow({ initials: 'MA', subject: 'Mathematics', detail: 'First Term Examination · 20 questions · 60 minutes', schedule: 'Today · 1:00–4:00 PM', secondaryLabel: 'Attempt', secondaryValue: finished ? 'Submitted' : inProgress ? 'In progress' : 'Not started', status: finished ? 'Completed' : inProgress ? 'In progress' : 'Available now', action: finished ? 'View receipt' : inProgress ? 'Continue' : 'View instructions', actionView: finished ? 'submitted' : inProgress ? 'exam' : 'instructions', primary: !finished })}
            ${examRow({ initials: 'EN', subject: 'English Language', detail: 'Continuous Assessment · 30 questions · 45 minutes', schedule: 'Today · 10:30 AM', secondaryLabel: 'Access', secondaryValue: 'Approved', status: 'Ready to take', action: 'Ready to take', actionView: 'home', primary: false, disabled: true })}
          </div>
        </section>

        <section class="mt-10" aria-labelledby="upcoming-heading">
          <div class="mb-4">
            <h2 id="upcoming-heading" class="text-xl font-bold tracking-tight">Coming up</h2>
            <p class="mt-1 text-sm text-neutral-600">Plan ahead for your next assessments.</p>
          </div>
          <div class="overflow-hidden rounded-xl border border-neutral-200 bg-white shadow-sm">
            ${examRow({ initials: 'BI', subject: 'Biology', detail: 'First Term Examination · 50 questions · 75 minutes', schedule: '14 Sep · 9:00 AM', secondaryLabel: 'Opens in', secondaryValue: '4 days', status: 'Upcoming', action: 'View schedule', actionView: 'history', primary: false })}
            ${examRow({ initials: 'PH', subject: 'Physics', detail: 'Mock Assessment · approval required', schedule: '16 Sep · 12:00 PM', secondaryLabel: 'Access', secondaryValue: 'Not requested', status: 'Request required', action: 'Request access', actionView: 'requests', primary: false })}
            ${examRow({ initials: 'LT', subject: 'Literature', detail: 'Reading Assessment · window closed', schedule: '9 Sep · 2:00 PM', secondaryLabel: 'Attempt', secondaryValue: 'No attempt', status: 'Missed', action: 'Closed', actionView: 'home', primary: false, disabled: true })}
          </div>
        </section>
      </div>`;
  }

  function renderRequests() {
    pageRoot.innerHTML = `
      <div class="mx-auto max-w-7xl px-4 py-10 sm:px-6 sm:py-12 lg:px-8">
        ${pageHeader('Exam requests', 'Request examination access.', 'Use this page when an examination requires school approval before you can take it.')}
        <div class="grid grid-cols-1 gap-6 lg:grid-cols-12">
          <section class="overflow-hidden rounded-xl border border-neutral-200 bg-white shadow-sm lg:col-span-7" aria-labelledby="request-form-heading">
            <div class="border-b border-neutral-200 p-5 sm:p-6">
              <h2 id="request-form-heading" class="text-lg font-bold tracking-tight">New request</h2>
              <p class="mt-1 text-sm leading-6 text-neutral-600">Choose the assessment and provide a brief reason only when needed.</p>
            </div>
            <div class="p-5 sm:p-6">
              <div id="request-message" class="mb-5 hidden" role="status" aria-live="polite"></div>
              <form id="request-form" class="grid grid-cols-1 gap-5 sm:grid-cols-2">
                <div>
                  <label for="request-session" class="mb-2 block text-sm font-semibold text-black">Academic session</label>
                  <select id="request-session" class="${FIELD}" required><option>2026/2027</option></select>
                </div>
                <div>
                  <label for="request-term" class="mb-2 block text-sm font-semibold text-black">Term</label>
                  <select id="request-term" class="${FIELD}" required><option>First Term</option></select>
                </div>
                <div>
                  <label for="request-class" class="mb-2 block text-sm font-semibold text-black">Class</label>
                  <select id="request-class" class="${FIELD}" required><option>SS 2 Science</option></select>
                </div>
                <div>
                  <label for="request-subject" class="mb-2 block text-sm font-semibold text-black">Subject</label>
                  <select id="request-subject" class="${FIELD}" required>
                    <option value="Physics">Physics</option><option value="Chemistry">Chemistry</option><option value="Biology">Biology</option><option value="Government">Government</option>
                  </select>
                </div>
                <div>
                  <label for="request-type" class="mb-2 block text-sm font-semibold text-black">Examination type</label>
                  <select id="request-type" class="${FIELD}" required><option>Examination</option><option>Continuous Assessment</option><option>Mock</option></select>
                </div>
                <div>
                  <label for="request-exam" class="mb-2 block text-sm font-semibold text-black">Examination</label>
                  <select id="request-exam" class="${FIELD}" required><option value="Mock Assessment">Mock Assessment</option><option value="First Term Examination">First Term Examination</option><option value="Make-up Test">Make-up Test</option></select>
                </div>
                <div class="sm:col-span-2">
                  <label for="request-reason" class="mb-2 block text-sm font-semibold text-black">Reason <span class="font-normal text-neutral-500">(optional)</span></label>
                  <textarea id="request-reason" rows="4" maxlength="240" class="${FIELD} resize-y" placeholder="For example: I was absent when access was assigned."></textarea>
                  <p class="mt-2 text-xs leading-5 text-neutral-500">Keep your note brief. Do not include passwords or private information.</p>
                </div>
                <div class="sm:col-span-2 sm:text-right">
                  <button type="submit" class="${BTN_PRIMARY} w-full sm:w-auto">Submit request</button>
                </div>
              </form>
            </div>
          </section>

          <aside class="overflow-hidden rounded-xl border border-neutral-200 bg-white shadow-sm lg:col-span-5" aria-labelledby="request-status-heading">
            <div class="border-b border-neutral-200 p-5 sm:p-6">
              <h2 id="request-status-heading" class="text-lg font-bold tracking-tight">Your requests</h2>
              <p class="mt-1 text-sm text-neutral-600">Approval status and next steps.</p>
            </div>
            <div id="request-list" class="p-5 sm:p-6"></div>
          </aside>
        </div>
      </div>`;

    renderRequestList();
    document.getElementById('request-form').addEventListener('submit', handleRequestSubmit);
  }

  function requestStatusAction(request) {
    if (request.status === 'Approved') return '<span class="text-xs font-semibold text-black">Ready to take</span>';
    if (request.status === 'Pending') return '<span class="text-xs text-neutral-500">No action needed</span>';
    if (request.status === 'Rejected') return '<span class="text-xs text-neutral-500">Contact your teacher if you need help</span>';
    return '';
  }

  function renderRequestList() {
    const root = document.getElementById('request-list');
    if (!root) return;

    if (!state.requests.length) {
      root.innerHTML = '<div class="rounded-xl border-2 border-dashed border-neutral-300 bg-neutral-50 p-8 text-center"><h3 class="font-bold">No requests yet</h3><p class="mt-2 text-sm leading-6 text-neutral-600">Requests and their approval status will appear here.</p></div>';
      return;
    }

    root.innerHTML = `<div class="divide-y divide-neutral-200">${state.requests.map((request) => `
      <article class="py-5 first:pt-0 last:pb-0">
        <div class="flex items-start justify-between gap-4">
          <div>
            <h3 class="font-bold text-black">${escapeText(request.subject)}</h3>
            <p class="mt-1 text-sm text-neutral-600">${escapeText(request.exam)}</p>
          </div>
          ${statusBadge(request.status)}
        </div>
        <p class="mt-3 text-xs leading-5 text-neutral-500">Requested ${escapeText(request.requestedAt)} · ${escapeText(request.note)}</p>
        <div class="mt-3">${requestStatusAction(request)}</div>
      </article>`).join('')}</div>`;
  }

  function showRequestMessage(kind, heading, detail) {
    const root = document.getElementById('request-message');
    root.className = 'mb-5 flex items-start gap-3 rounded-lg border border-neutral-400 bg-neutral-50 p-4 text-sm text-black';
    root.innerHTML = `${kind === 'warning' ? ICONS.warn : ICONS.check}<div><strong class="block font-bold">${escapeText(heading)}</strong><span class="mt-1 block leading-6 text-neutral-600">${escapeText(detail)}</span></div>`;
  }

  function handleRequestSubmit(event) {
    event.preventDefault();
    const subject = document.getElementById('request-subject').value;
    const exam = document.getElementById('request-exam').value;
    const duplicate = state.requests.some((request) => request.subject === subject && request.exam === exam && ['Pending', 'Approved'].includes(request.status));

    if (duplicate) {
      showRequestMessage('warning', 'Request already exists.', 'Check the request status on this page instead of sending another one.');
      return;
    }

    state.requests.unshift({
      id: `REQ-${Math.floor(300 + Math.random() * 600)}`,
      subject,
      exam,
      requestedAt: '10 Sep 2026',
      status: 'Pending',
      note: 'The school will review this request. No action is needed right now.'
    });
    persist();
    renderRequestList();
    showRequestMessage('success', 'Request submitted.', 'Your request is now waiting for school approval.');
    event.target.reset();
  }

  function renderHistory() {
    const currentAttempt = state.submittedAt ? examRow({
      initials: 'MA', subject: 'Mathematics', detail: `First Term Examination · submitted ${formatDateTime(state.submittedAt)}`, schedule: '10 Sep 2026', secondaryLabel: 'Result', secondaryValue: 'Not released', status: 'Completed', action: 'View receipt', actionView: 'submitted', primary: false
    }) : '';

    pageRoot.innerHTML = `
      <div class="mx-auto max-w-7xl px-4 py-10 sm:px-6 sm:py-12 lg:px-8">
        ${pageHeader('Exam history', 'Your previous attempts.', 'Submission records and released results appear here.')}
        <div class="mb-8 flex flex-wrap gap-2"><span class="${BADGE} border-neutral-300 bg-white text-neutral-700">2026/2027 Session</span><span class="${BADGE} border-neutral-300 bg-white text-neutral-700">First Term</span></div>
        <div class="overflow-hidden rounded-xl border border-neutral-200 bg-white shadow-sm">
          ${currentAttempt}
          ${examRow({ initials: 'CH', subject: 'Chemistry', detail: 'Continuous Assessment · submitted 4 Sep 2026 · Ref FC-CH-2041', schedule: '4 Sep 2026', secondaryLabel: 'Score', secondaryValue: '24 / 30', status: 'Completed', action: 'Result released', actionView: 'history', primary: false, disabled: true })}
          ${examRow({ initials: 'EC', subject: 'Economics', detail: 'Mid-Term Test · submitted 28 Aug 2026 · Ref FC-EC-1968', schedule: '28 Aug 2026', secondaryLabel: 'Score', secondaryValue: '18 / 20', status: 'Completed', action: 'Result released', actionView: 'history', primary: false, disabled: true })}
        </div>
      </div>`;
  }

  function renderInstructions() {
    pageRoot.innerHTML = `
      <div class="mx-auto max-w-7xl px-4 py-10 sm:px-6 sm:py-12 lg:px-8">
        ${pageHeader('Before you begin', 'Mathematics · First Term Examination', 'Read the instructions carefully. Your timer begins only after you deliberately start the examination.')}
        <div class="grid grid-cols-1 gap-8 lg:grid-cols-12">
          <section class="lg:col-span-8">
            <h2 class="text-xl font-bold tracking-tight">Examination instructions</h2>
            <ol class="mt-5 divide-y divide-neutral-200 border-y border-neutral-200">
              ${[
                ['Answer every question you can.', 'You may move backward or forward and change any response before final submission.'],
                ['Follow each question instruction.', 'Some questions accept one answer, some accept more than one, and some require typed responses.'],
                ['Your responses are saved as you work.', 'A save indicator in the exam header shows when your latest response has been stored.'],
                ['Keep working if the connection is interrupted.', 'Festacol will tell you when your responses are stored on this device and when synchronization resumes.'],
                ['Time expiry ends the attempt.', 'When the countdown reaches zero, the examination is submitted automatically.']
              ].map((rule, index) => `<li class="grid grid-cols-12 gap-4 py-5"><span class="col-span-1 grid size-7 place-items-center rounded-full border border-neutral-400 text-xs font-bold">${index + 1}</span><div class="col-span-11"><strong class="text-sm font-bold text-black">${rule[0]}</strong><p class="mt-1 text-sm leading-6 text-neutral-600">${rule[1]}</p></div></li>`).join('')}
            </ol>

            <div class="mt-7 rounded-xl border border-neutral-400 bg-white p-5 sm:p-6">
              <label for="ready-check" class="flex cursor-pointer items-start gap-3">
                <input id="ready-check" type="checkbox" class="mt-0.5 size-5 rounded border-neutral-400 bg-white text-black focus:ring-2 focus:ring-black">
                <span><strong class="block text-sm font-bold">I have read the instructions and I am ready to begin.</strong><span class="mt-1 block text-sm leading-6 text-neutral-600">Starting begins the 60-minute countdown.</span></span>
              </label>
              <div class="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                <button type="button" data-view="home" class="${BTN_SECONDARY}">Back</button>
                <button id="start-exam-button" type="button" class="${BTN_PRIMARY}" disabled>Start examination</button>
              </div>
            </div>
          </section>

          <aside class="rounded-xl border border-neutral-200 bg-neutral-50 p-5 lg:col-span-4 lg:p-6" aria-label="Examination summary">
            <p class="text-xs font-bold uppercase tracking-widest text-neutral-500">Exam summary</p>
            <dl class="mt-4 divide-y divide-neutral-200 text-sm">
              ${[['Candidate', 'Maya Adeyemi'], ['Candidate ID', 'FC/26/1048'], ['Class', 'SS 2 Science'], ['Session', '2026/2027'], ['Term', 'First Term'], ['Date', '10 Sep 2026'], ['Questions', '20'], ['Duration', '60 minutes'], ['Total marks', '40'], ['Attempts', '1']].map((item) => `<div class="flex justify-between gap-4 py-3"><dt class="text-neutral-600">${item[0]}</dt><dd class="text-right font-semibold text-black">${item[1]}</dd></div>`).join('')}
            </dl>
            <div class="mt-5 flex items-start gap-3 rounded-lg border border-neutral-300 bg-white p-4 text-sm">
              ${ICONS.book}<div><strong class="font-bold">Question formats</strong><p class="mt-1 leading-6 text-neutral-600">Single choice, multiple selection, True/False, fill-in gaps, passages, diagrams and data interpretation.</p></div>
            </div>
          </aside>
        </div>
      </div>`;

    const ready = document.getElementById('ready-check');
    const start = document.getElementById('start-exam-button');
    ready.addEventListener('change', () => { start.disabled = !ready.checked; });
    start.addEventListener('click', startExam);
  }

  function startExam() {
    if (!state.startedAt || state.submittedAt) {
      state.startedAt = Date.now();
      state.endAt = state.startedAt + EXAM_DURATION_MS;
      state.submittedAt = null;
      state.submissionReference = null;
      state.activeQuestion = 0;
      state.responses = {};
      state.flagged = [];
      state.connection = 'online';
      state.navigatorFilter = 'all';
      persist();
    }
    navigate('exam');
  }

  function responseFor(question) {
    return state.responses[String(question.id)];
  }

  function questionStatus(question) {
    const response = responseFor(question);
    if (question.type === 'multi') {
      const count = Array.isArray(response) ? response.length : 0;
      if (count === 0) return 'unanswered';
      return count === question.requiredSelections ? 'answered' : 'incomplete';
    }
    if (question.type === 'fill' || question.type === 'fill-multi') {
      const blanks = question.fillTemplate.filter((part) => part.blank).map((part) => part.blank);
      const values = response && typeof response === 'object' ? response : {};
      const completed = blanks.filter((key) => String(values[key] || '').trim().length > 0).length;
      if (completed === 0) return 'unanswered';
      return completed === blanks.length ? 'answered' : 'incomplete';
    }
    return response === undefined || response === null || response === '' ? 'unanswered' : 'answered';
  }

  const answeredCount = () => questions.filter((q) => questionStatus(q) === 'answered').length;
  const incompleteCount = () => questions.filter((q) => questionStatus(q) === 'incomplete').length;
  const unansweredCount = () => questions.filter((q) => questionStatus(q) === 'unanswered').length;
  const currentQuestion = () => questions[state.activeQuestion];

  function renderQuestion() {
    const question = currentQuestion();
    const root = document.getElementById('question-root');
    if (!question || !root) return;

    root.innerHTML = `
      <div class="mb-7 flex flex-wrap items-center justify-between gap-3">
        <span class="text-xs font-bold uppercase tracking-widest text-neutral-500">Question ${question.id} of ${questions.length}</span>
        <span class="${BADGE} border-neutral-300 bg-white text-neutral-600">${escapeText(question.label)}</span>
      </div>
      ${question.passage ? `<section class="mb-6 max-w-4xl border-l-4 border-black bg-neutral-50 p-5"><h2 class="text-sm font-bold">Read the passage.</h2><p class="mt-2 text-sm leading-7 text-neutral-700">${escapeText(question.passage)}</p></section>` : ''}
      <h1 class="max-w-4xl text-xl font-semibold leading-8 tracking-tight text-black sm:text-2xl sm:leading-9">${escapeText(question.prompt)}</h1>
      ${question.instruction ? `<p class="mt-3 text-sm font-semibold text-neutral-600">${escapeText(question.instruction)}</p>` : ''}
      <div class="mt-7">${renderQuestionBody(question)}</div>`;

    bindQuestionInputs(question);
    updateExamChrome();
  }

  function renderQuestionBody(question) {
    if (question.diagram === 'triangle') return `${renderTriangleDiagram()}${renderOptions(question, 'radio')}`;
    if (question.table) return `${renderDataTable(question.table)}${renderOptions(question, 'radio')}`;
    if (question.type === 'single') return renderOptions(question, 'radio');
    if (question.type === 'multi') return renderOptions(question, 'checkbox');
    if (question.type === 'boolean') return renderBoolean(question);
    if (question.type === 'fill' || question.type === 'fill-multi') return renderFill(question);
    return '';
  }

  function renderOptions(question, inputType) {
    const response = responseFor(question);
    return `<fieldset class="max-w-4xl space-y-3"><legend class="sr-only">${inputType === 'checkbox' ? 'Select answers' : 'Select one answer'}</legend>${question.options.map((option, index) => {
      const value = String(index);
      const checked = inputType === 'checkbox' ? Array.isArray(response) && response.includes(value) : response === value;
      return `
        <label for="q${question.id}-o${index}" class="block cursor-pointer rounded-xl focus-within:ring-2 focus-within:ring-black focus-within:ring-offset-2">
          <input id="q${question.id}-o${index}" name="q${question.id}" type="${inputType}" value="${value}" class="peer sr-only" ${checked ? 'checked' : ''}>
          <span class="flex min-h-16 items-center gap-3 rounded-xl border border-neutral-400 bg-white p-3 text-black transition-colors motion-reduce:transition-none hover:border-black peer-checked:border-black peer-checked:bg-black peer-checked:text-white sm:p-4">
            <span class="grid size-9 shrink-0 place-items-center rounded-lg border border-current text-xs font-bold" aria-hidden="true">${String.fromCharCode(65 + index)}</span>
            <span class="text-sm font-medium leading-6 sm:text-base">${escapeText(option)}</span>
          </span>
        </label>`;
    }).join('')}</fieldset>`;
  }

  function renderBoolean(question) {
    const response = responseFor(question);
    return `<fieldset class="grid max-w-2xl grid-cols-1 gap-3 sm:grid-cols-2"><legend class="sr-only">Choose True or False</legend>${['True', 'False'].map((value) => `
      <label for="q${question.id}-${value.toLowerCase()}" class="block cursor-pointer rounded-xl focus-within:ring-2 focus-within:ring-black focus-within:ring-offset-2">
        <input id="q${question.id}-${value.toLowerCase()}" name="q${question.id}" type="radio" value="${value}" class="peer sr-only" ${response === value ? 'checked' : ''}>
        <span class="grid min-h-20 place-items-center rounded-xl border border-neutral-400 bg-white p-4 text-base font-bold text-black transition-colors motion-reduce:transition-none hover:border-black peer-checked:border-black peer-checked:bg-black peer-checked:text-white">${value}</span>
      </label>`).join('')}</fieldset>`;
  }

  function renderFill(question) {
    const response = responseFor(question) || {};
    return `<div class="max-w-3xl rounded-xl border border-neutral-200 bg-neutral-50 p-5 sm:p-6"><div class="flex flex-wrap items-end gap-x-2 gap-y-4 text-lg leading-9 text-black">${question.fillTemplate.map((part) => {
      if (part.text) return `<span>${escapeText(part.text)}</span>`;
      return `<span class="inline-block min-w-40"><label class="sr-only" for="q${question.id}-${part.blank}">Answer for blank</label><input id="q${question.id}-${part.blank}" type="text" autocomplete="off" spellcheck="false" data-blank="${part.blank}" value="${escapeText(response[part.blank] || '')}" placeholder="${escapeText(part.placeholder || 'answer')}" class="w-full border-0 border-b-2 border-black bg-transparent px-2 py-1 text-center text-base font-semibold text-black placeholder:text-neutral-400 focus:border-black focus:outline-none focus:ring-0"></span>`;
    }).join('')}</div><p class="mt-5 text-xs leading-5 text-neutral-500">You can edit your typed response until you submit the examination.</p></div>`;
  }

  function renderTriangleDiagram() {
    return `
      <figure class="mb-7 max-w-2xl rounded-xl border border-neutral-200 bg-neutral-50 p-5">
        <svg class="h-auto w-full" viewBox="0 0 560 280" role="img" aria-labelledby="triangle-title triangle-desc">
          <title id="triangle-title">Triangle ABC</title>
          <desc id="triangle-desc">A triangle with A at the left base, B at the right base, and C at the top. Angle A is 50 degrees and angle B is 65 degrees.</desc>
          <path d="M82 225 L476 225 L306 52 Z" fill="none" stroke="currentColor" stroke-width="4" stroke-linejoin="round"/>
          <path d="M115 225 A34 34 0 0 1 103 199" fill="none" stroke="currentColor" stroke-width="2"/>
          <path d="M442 225 A34 34 0 0 0 450 199" fill="none" stroke="currentColor" stroke-width="2"/>
          <text x="67" y="249" font-size="18" fill="currentColor">A</text><text x="484" y="249" font-size="18" fill="currentColor">B</text><text x="300" y="38" font-size="18" fill="currentColor">C</text>
          <text x="116" y="209" font-size="15" fill="currentColor">50°</text><text x="405" y="209" font-size="15" fill="currentColor">65°</text>
        </svg>
        <figcaption class="mt-3 text-center text-xs text-neutral-500">Figure 1 · Not drawn to scale</figcaption>
      </figure>`;
  }

  function renderDataTable(table) {
    return `<div class="mb-7 max-w-2xl overflow-x-auto rounded-xl border border-neutral-200" role="region" aria-label="Question data table" tabindex="0"><table class="w-full border-collapse text-sm"><thead><tr>${table.headers.map((header) => `<th scope="col" class="border-b border-r border-neutral-200 bg-neutral-100 p-3 text-left font-bold text-black last:border-r-0">${escapeText(header)}</th>`).join('')}</tr></thead><tbody>${table.rows.map((row) => `<tr>${row.map((cell) => `<td class="border-b border-r border-neutral-200 p-3 text-black last:border-r-0 last-of-type:border-r-0">${escapeText(cell)}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`;
  }

  function bindQuestionInputs(question) {
    const root = document.getElementById('question-root');
    if (question.type === 'single' || question.type === 'boolean' || question.diagram || question.table) {
      root.querySelectorAll('input[type="radio"]').forEach((input) => input.addEventListener('change', () => {
        state.responses[String(question.id)] = input.value;
        scheduleSave();
        updateExamChrome();
      }));
    }

    if (question.type === 'multi') {
      root.querySelectorAll('input[type="checkbox"]').forEach((input) => input.addEventListener('change', () => {
        const checked = [...root.querySelectorAll('input[type="checkbox"]:checked')].map((item) => item.value);
        if (checked.length > question.requiredSelections) {
          input.checked = false;
          announce(`You can select only ${question.requiredSelections} answers for this question.`);
          return;
        }
        state.responses[String(question.id)] = [...root.querySelectorAll('input[type="checkbox"]:checked')].map((item) => item.value);
        scheduleSave();
        updateExamChrome();
      }));
    }

    if (question.type === 'fill' || question.type === 'fill-multi') {
      root.querySelectorAll('[data-blank]').forEach((input) => input.addEventListener('input', () => {
        const existing = state.responses[String(question.id)] || {};
        state.responses[String(question.id)] = { ...existing, [input.dataset.blank]: input.value };
        scheduleSave();
        updateExamChrome();
      }));
    }
  }

  function scheduleSave() {
    window.clearTimeout(saveTimer);
    setSaveStatus('saving');
    persist();
    saveTimer = window.setTimeout(() => setSaveStatus(state.connection === 'online' ? 'saved' : 'local'), 400);
  }

  function setSaveStatus(mode) {
    const label = document.getElementById('save-status');
    const chip = document.getElementById('save-chip');
    const copy = { saving: 'Saving…', saved: 'Saved', local: 'Saved on device', reconnecting: 'Reconnecting…', syncing: 'Syncing…' };
    const text = copy[mode] || copy.saved;
    label.textContent = text;
    chip.setAttribute('aria-label', `Answer save status. ${text}. Click to preview connectivity states.`);
  }

  function renderProgressSegments() {
    const root = document.getElementById('header-progress-segments');
    const count = state.activeQuestion + 1;
    root.innerHTML = questions.map((_, index) => `<span class="h-1 flex-1 rounded-full ${index < count ? 'bg-black' : 'bg-neutral-200'}"></span>`).join('');
  }

  function updateExamChrome() {
    const question = currentQuestion();
    const count = answeredCount();
    document.getElementById('header-progress-label').textContent = `Question ${question.id} of ${questions.length}`;
    document.getElementById('header-answer-count').textContent = `${count} answered`;
    document.getElementById('navigator-summary').textContent = `${count} / ${questions.length} answered`;
    document.getElementById('mobile-navigator-summary').textContent = `${count} / ${questions.length} answered`;
    renderProgressSegments();

    const flagged = state.flagged.includes(question.id);
    const flagButton = document.getElementById('flag-button');
    flagButton.setAttribute('aria-pressed', String(flagged));
    flagButton.querySelector('span').textContent = flagged ? 'Flagged' : 'Flag';
    flagButton.className = flagged
      ? 'inline-flex min-h-11 flex-1 items-center justify-center gap-2 rounded-lg border border-black bg-black px-3 text-xs font-semibold text-white focus:outline-none focus:ring-2 focus:ring-black focus:ring-offset-2 sm:flex-none'
      : 'inline-flex min-h-11 flex-1 items-center justify-center gap-2 rounded-lg border border-neutral-300 bg-white px-3 text-xs font-semibold text-black hover:bg-neutral-100 focus:outline-none focus:ring-2 focus:ring-black focus:ring-offset-2 sm:flex-none';

    document.getElementById('clear-button').disabled = questionStatus(question) === 'unanswered';
    document.getElementById('previous-button').disabled = state.activeQuestion === 0;
    document.getElementById('next-button').querySelector('span').textContent = state.activeQuestion === questions.length - 1 ? 'Review answers' : 'Next';
    renderNavigator();
  }

  function navigatorButtonClass(status, current) {
    const base = 'relative aspect-square min-h-10 rounded-lg text-xs font-bold focus:outline-none focus:ring-2 focus:ring-black focus:ring-offset-2';
    const stateClass = status === 'answered'
      ? 'border border-black bg-black text-white'
      : status === 'incomplete'
        ? 'border-2 border-dashed border-neutral-500 bg-white text-black'
        : 'border border-neutral-400 bg-white text-black hover:border-black';
    return `${base} ${stateClass} ${current ? 'ring-2 ring-black ring-offset-2' : ''}`;
  }

  function renderNavigator() {
    renderNavigatorGrid(document.getElementById('desktop-question-grid'));
    renderNavigatorGrid(document.getElementById('mobile-question-grid'));
    syncFilterButtons();
  }

  function renderNavigatorGrid(root) {
    const filtered = questions.filter((question) => {
      if (state.navigatorFilter === 'flagged') return state.flagged.includes(question.id);
      if (state.navigatorFilter === 'unanswered') return questionStatus(question) !== 'answered';
      return true;
    });

    if (!filtered.length) {
      root.innerHTML = '<p class="col-span-5 py-4 text-center text-xs leading-5 text-neutral-500">No questions match this filter.</p>';
      return;
    }

    root.innerHTML = filtered.map((question) => {
      const status = questionStatus(question);
      const current = question.id === currentQuestion().id;
      const flagged = state.flagged.includes(question.id);
      return `<button type="button" data-question-id="${question.id}" class="${navigatorButtonClass(status, current)}" aria-label="Question ${question.id}, ${status}${flagged ? ', flagged' : ''}${current ? ', current question' : ''}" ${current ? 'aria-current="step"' : ''}>${question.id}${flagged ? `<span class="absolute right-0.5 top-0.5">${ICONS.flag}</span>` : ''}</button>`;
    }).join('');
  }

  function syncFilterButtons() {
    document.querySelectorAll('[data-filter]').forEach((button) => {
      const active = button.dataset.filter === state.navigatorFilter;
      button.className = active
        ? 'min-h-9 rounded-md bg-white px-2 text-xs font-semibold text-black shadow-sm focus:outline-none focus:ring-2 focus:ring-black'
        : 'min-h-9 rounded-md px-2 text-xs font-medium text-neutral-600 hover:bg-white hover:text-black focus:outline-none focus:ring-2 focus:ring-black';
    });
  }

  function setNavigatorFilter(filter) {
    state.navigatorFilter = filter;
    persist();
    renderNavigator();
  }

  function goToQuestion(id) {
    const index = questions.findIndex((question) => question.id === id);
    if (index < 0) return;
    state.activeQuestion = index;
    persist();
    renderQuestion();
    document.getElementById('question-root').scrollIntoView({ behavior: 'smooth', block: 'start' });
    const close = document.querySelector('[data-drawer-hide="question-drawer"]');
    if (close && window.innerWidth < 1024) close.click();
  }

  function toggleFlag() {
    const id = currentQuestion().id;
    state.flagged = state.flagged.includes(id) ? state.flagged.filter((item) => item !== id) : [...state.flagged, id];
    persist();
    updateExamChrome();
  }

  function clearResponse() {
    const id = currentQuestion().id;
    delete state.responses[String(id)];
    scheduleSave();
    renderQuestion();
    announce(`Response cleared for question ${id}.`);
  }

  function nextQuestion() {
    if (state.activeQuestion >= questions.length - 1) {
      navigate('review');
      return;
    }
    state.activeQuestion += 1;
    persist();
    renderQuestion();
  }

  function previousQuestion() {
    if (state.activeQuestion <= 0) return;
    state.activeQuestion -= 1;
    persist();
    renderQuestion();
  }

  function startClock() {
    stopClock();
    updateClock();
    clockTimer = window.setInterval(updateClock, 1000);
  }

  function stopClock() {
    if (clockTimer) window.clearInterval(clockTimer);
    clockTimer = null;
  }

  function updateClock() {
    if (!state.endAt || state.submittedAt) return;
    const remaining = Math.max(0, state.endAt - Date.now());
    const totalSeconds = Math.ceil(remaining / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    const timer = document.getElementById('timer-chip');
    const text = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;

    document.getElementById('timer-text').textContent = text;
    const reviewTimer = document.getElementById('review-timer-text');
    if (reviewTimer) {
      reviewTimer.textContent = text;
      reviewTimer.setAttribute('aria-label', `${minutes} minutes and ${seconds} seconds remaining`);
    }
    timer.setAttribute('aria-label', `${minutes} minutes and ${seconds} seconds remaining`);
    timer.className = remaining <= 5 * 60 * 1000
      ? 'inline-flex min-h-11 items-center gap-2 rounded-lg border-2 border-black bg-neutral-100 px-3 text-xs font-bold tabular-nums text-black'
      : remaining <= 10 * 60 * 1000
        ? 'inline-flex min-h-11 items-center gap-2 rounded-lg border-2 border-neutral-500 bg-white px-3 text-xs font-bold tabular-nums text-black'
        : 'inline-flex min-h-11 items-center gap-2 rounded-lg border border-neutral-300 bg-white px-3 text-xs font-bold tabular-nums text-black';

    if (remaining <= 0) {
      stopClock();
      completeSubmission(true);
    }
  }

  function cycleConnection() {
    const order = ['online', 'offline', 'reconnecting'];
    state.connection = order[(order.indexOf(state.connection) + 1) % order.length];
    persist();
    renderConnectionState();

    if (state.connection === 'online') setSaveStatus('saved');
    else if (state.connection === 'offline') setSaveStatus('local');
    else {
      setSaveStatus('reconnecting');
      window.setTimeout(() => {
        if (state.connection !== 'reconnecting') return;
        state.connection = 'online';
        persist();
        setSaveStatus('syncing');
        renderConnectionState();
        window.setTimeout(() => setSaveStatus('saved'), 600);
      }, 1600);
    }
  }

  function renderConnectionState() {
    const root = document.getElementById('connectivity-banner');
    if (state.connection === 'online') {
      root.classList.add('hidden');
      root.innerHTML = '';
      return;
    }
    root.classList.remove('hidden');
    root.innerHTML = `<div class="flex items-start gap-3 rounded-lg border border-neutral-500 bg-neutral-50 p-4 text-sm text-black">${ICONS.warn}<div><strong class="font-bold">${state.connection === 'offline' ? 'Connection lost.' : 'Reconnecting.'}</strong><span class="ml-1 leading-6 text-neutral-700">${state.connection === 'offline' ? 'You can continue answering. Your responses are saved on this device and will sync when the connection returns.' : 'Keep working while Festacol restores synchronization.'}</span></div></div>`;
  }

  function renderReview() {
    const counts = { answered: answeredCount(), unanswered: unansweredCount(), incomplete: incompleteCount(), flagged: state.flagged.length };

    pageRoot.innerHTML = `
      <div class="mx-auto max-w-5xl px-4 pb-10 sm:px-6 sm:pb-12 lg:px-8">
        <div class="sticky top-0 z-20 -mx-4 mb-8 border-b border-neutral-200 bg-white/95 px-4 py-3 backdrop-blur-sm sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8">
          <div class="mx-auto flex max-w-5xl items-center justify-between gap-4">
            <div class="min-w-0"><strong class="block truncate text-sm font-bold">Mathematics · First Term Examination</strong><span class="text-xs text-neutral-500">Review before submission</span></div>
            <div class="flex items-center gap-2"><span class="hidden text-xs font-semibold text-neutral-600 sm:inline">Responses saved</span><span id="review-timer-text" class="rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm font-bold tabular-nums text-black">60:00</span></div>
          </div>
        </div>
        ${pageHeader('Review answers', 'Check your work before submitting.', 'You can return to any question. Reaching the final question does not submit your examination.')}

        <div class="grid grid-cols-2 overflow-hidden rounded-xl border border-neutral-200 bg-white sm:grid-cols-5" aria-label="Examination response summary">
          ${[[questions.length, 'Total questions'], [counts.answered, 'Answered'], [counts.unanswered, 'Unanswered'], [counts.incomplete, 'Incomplete'], [counts.flagged, 'Flagged']].map((item) => `<div class="border-b border-r border-neutral-200 p-4 last:border-r-0 sm:border-b-0"><strong class="block text-2xl font-bold tabular-nums">${item[0]}</strong><span class="mt-1 block text-xs text-neutral-500">${item[1]}</span></div>`).join('')}
        </div>

        <div class="mt-6 flex items-start gap-3 rounded-lg border border-neutral-400 bg-neutral-50 p-4 text-sm" role="status">
          ${counts.unanswered || counts.incomplete ? ICONS.warn : ICONS.check}
          <div><strong class="font-bold">${counts.unanswered || counts.incomplete ? `You still have ${counts.unanswered + counts.incomplete} question${counts.unanswered + counts.incomplete === 1 ? '' : 's'} to check.` : 'Every question has a complete response.'}</strong><p class="mt-1 leading-6 text-neutral-600">${counts.unanswered || counts.incomplete ? 'You may return to unanswered or incomplete questions before submitting.' : 'You can still revisit flagged questions before submitting.'}</p></div>
        </div>

        <div class="mb-4 mt-8 flex flex-wrap items-end justify-between gap-3">
          <div><h2 class="text-xl font-bold tracking-tight">Your questions</h2><p class="mt-1 text-sm text-neutral-600">Open any question to review its response.</p></div>
          <div class="flex gap-2"><button id="review-all-button" type="button" class="${BTN_SECONDARY}">All questions</button><button id="review-flagged-button" type="button" class="${BTN_SECONDARY}">Flagged</button></div>
        </div>
        <div id="review-list" class="overflow-hidden rounded-xl border border-neutral-200 bg-white"></div>

        <section class="mt-8 rounded-xl border border-black bg-white p-5 sm:p-6" aria-labelledby="submit-heading">
          <h2 id="submit-heading" class="text-xl font-bold tracking-tight">Submit examination</h2>
          <p class="mt-2 text-sm leading-6 text-neutral-600">Once submitted, you cannot change your responses in this attempt.</p>
          <label for="submit-check" class="mt-5 flex cursor-pointer items-start gap-3">
            <input id="submit-check" type="checkbox" class="mt-0.5 size-5 rounded border-neutral-400 bg-white text-black focus:ring-2 focus:ring-black">
            <span class="text-sm font-medium text-black">I have reviewed my answers and I am ready to submit.</span>
          </label>
          <div class="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <button id="back-to-exam" type="button" class="${BTN_SECONDARY}">Return to examination</button>
            <button id="submit-exam" type="button" class="${BTN_PRIMARY}" disabled>Submit examination</button>
          </div>
        </section>
      </div>`;

    renderReviewList('all');
    document.getElementById('review-all-button').addEventListener('click', () => renderReviewList('all'));
    document.getElementById('review-flagged-button').addEventListener('click', () => renderReviewList('flagged'));
    document.getElementById('back-to-exam').addEventListener('click', () => navigate('exam'));
    const check = document.getElementById('submit-check');
    const submit = document.getElementById('submit-exam');
    check.addEventListener('change', () => { submit.disabled = !check.checked; });
    submit.addEventListener('click', () => completeSubmission(false));
  }

  function renderReviewList(filter) {
    const root = document.getElementById('review-list');
    const items = questions.filter((question) => filter !== 'flagged' || state.flagged.includes(question.id));
    if (!items.length) {
      root.innerHTML = '<div class="p-8 text-center"><h3 class="font-bold">No flagged questions</h3><p class="mt-2 text-sm text-neutral-600">You have not flagged any question for review.</p></div>';
      return;
    }
    root.innerHTML = items.map((question) => {
      const status = questionStatus(question);
      const flagged = state.flagged.includes(question.id);
      const copy = status === 'answered' ? 'Answered' : status === 'incomplete' ? 'Incomplete response' : 'Unanswered';
      const badgeClass = status === 'answered' ? `${BADGE} border-black bg-black text-white` : status === 'incomplete' ? `${BADGE} border-dashed border-neutral-500 bg-white text-black` : `${BADGE} border-neutral-400 bg-white text-neutral-700`;
      return `<article class="grid grid-cols-12 items-center gap-3 border-b border-neutral-200 p-4 last:border-b-0"><span class="col-span-2 grid size-9 place-items-center rounded-lg border border-neutral-400 text-xs font-bold sm:col-span-1">${question.id}</span><div class="col-span-7 min-w-0 sm:col-span-7"><h3 class="truncate text-sm font-semibold text-black">${escapeText(question.prompt)}</h3><p class="mt-1 text-xs text-neutral-500">${escapeText(question.label)}</p></div><div class="col-span-3 hidden sm:col-span-2 sm:block"><span class="${badgeClass}">${copy}${flagged ? ' · Flagged' : ''}</span></div><div class="col-span-3 text-right sm:col-span-2"><button type="button" data-review-question="${question.id}" class="${BTN_SECONDARY} min-h-10 px-3 py-2 text-xs">Open</button></div></article>`;
    }).join('');
  }

  function completeSubmission(auto) {
    if (!state.submittedAt) {
      state.submittedAt = Date.now();
      state.submissionReference = `FC-MA-${String(state.submittedAt).slice(-7)}`;
      state.currentView = 'submitted';
      persist();
    }
    stopClock();
    navigate('submitted');
    if (auto) window.setTimeout(() => announce('Time expired. Your examination was submitted automatically.'), 50);
  }

  function renderSubmitted() {
    const answered = answeredCount();
    pageRoot.innerHTML = `
      <div class="mx-auto max-w-3xl px-4 py-12 text-center sm:px-6 sm:py-16">
        <div class="mx-auto grid size-16 place-items-center rounded-full bg-black text-white" aria-hidden="true">${ICONS.check}</div>
        <p class="mt-6 text-xs font-bold uppercase tracking-widest text-neutral-500">Submission complete</p>
        <h1 class="mt-2 text-3xl font-bold tracking-tight sm:text-4xl">Your examination has been submitted.</h1>
        <p class="mx-auto mt-4 max-w-2xl text-base leading-7 text-neutral-600">Your result will be available when it is released by the school. You do not need to take any further action.</p>

        <div class="mx-auto mt-8 max-w-2xl rounded-xl border border-neutral-200 bg-neutral-50 p-5 text-left sm:p-6">
          <p class="text-xs font-bold uppercase tracking-widest text-neutral-500">Submission receipt</p>
          <dl class="mt-4 divide-y divide-neutral-200 text-sm">
            ${[['Candidate', 'Maya Adeyemi'], ['Candidate ID', 'FC/26/1048'], ['Subject', 'Mathematics'], ['Examination', 'First Term Examination'], ['Responses', `${answered} complete · ${incompleteCount()} incomplete`], ['Submitted', formatDateTime(state.submittedAt)], ['Reference', state.submissionReference || '—']].map((item) => `<div class="flex justify-between gap-4 py-3"><dt class="text-neutral-600">${escapeText(item[0])}</dt><dd class="text-right font-semibold text-black">${escapeText(item[1])}</dd></div>`).join('')}
          </dl>
        </div>

        <div class="mt-8 flex flex-col justify-center gap-2 sm:flex-row">
          <button type="button" data-view="home" class="${BTN_PRIMARY}">${ICONS.home}<span>Back to exams</span></button>
          <button type="button" data-view="history" class="${BTN_SECONDARY}">View exam history</button>
        </div>
      </div>`;
  }

  document.addEventListener('click', (event) => {
    const viewButton = event.target.closest('[data-view]');
    if (viewButton && !viewButton.disabled) {
      navigate(viewButton.dataset.view);
      return;
    }

    const filterButton = event.target.closest('[data-filter]');
    if (filterButton) {
      setNavigatorFilter(filterButton.dataset.filter);
      return;
    }

    const jumpButton = event.target.closest('[data-question-id]');
    if (jumpButton) {
      goToQuestion(Number(jumpButton.dataset.questionId));
      return;
    }

    const reviewButton = event.target.closest('[data-review-question]');
    if (reviewButton) {
      state.activeQuestion = questions.findIndex((question) => question.id === Number(reviewButton.dataset.reviewQuestion));
      persist();
      navigate('exam');
    }
  });

  document.getElementById('flag-button').addEventListener('click', toggleFlag);
  document.getElementById('clear-button').addEventListener('click', clearResponse);
  document.getElementById('next-button').addEventListener('click', nextQuestion);
  document.getElementById('previous-button').addEventListener('click', previousQuestion);
  document.getElementById('save-chip').addEventListener('click', cycleConnection);

  window.FestacolDemo = Object.freeze({
    reset() {
      try { localStorage.removeItem(STORAGE_KEY); } catch { /* no-op */ }
      location.reload();
    },
    setMinutesRemaining(minutes) {
      if (!state.startedAt || state.submittedAt) return false;
      state.endAt = Date.now() + Math.max(0, Number(minutes)) * 60 * 1000;
      persist();
      updateClock();
      return true;
    },
    connection(mode) {
      if (!['online', 'offline', 'reconnecting'].includes(mode)) return false;
      state.connection = mode;
      persist();
      renderConnectionState();
      setSaveStatus(mode === 'online' ? 'saved' : mode === 'offline' ? 'local' : 'reconnecting');
      return true;
    },
    snapshot() {
      return JSON.parse(JSON.stringify(state));
    }
  });

  if (state.startedAt && !state.submittedAt && state.endAt && state.endAt <= Date.now()) completeSubmission(true);
  else if (state.currentView === 'exam' && state.startedAt && !state.submittedAt) navigate('exam');
  else if (state.currentView === 'review' && state.startedAt && !state.submittedAt) navigate('review');
  else if (state.currentView === 'submitted' && state.submittedAt) navigate('submitted');
  else navigate(['home', 'requests', 'history', 'instructions'].includes(state.currentView) ? state.currentView : 'home');
})();
