(() => {
  'use strict';

  const Store = window.FestacolSessionStore;
  const Questions = window.FestacolQuestionData;
  const QR = window.FestacolQR;
  const root = document.getElementById('admin-root');
  const alertRoot = document.getElementById('admin-alert');
  const breadcrumb = document.getElementById('admin-breadcrumb');
  const pageLabel = document.getElementById('admin-page-label');

  if (!Store || !Questions || !QR || !root) throw new Error('Festacol admin dependencies are unavailable.');

  const ROUTES = {
    overview: ['Overview', 'Administration / Overview'],
    sessions: ['Exam sessions', 'Administration / Exam sessions'],
    candidates: ['Candidates', 'Administration / Candidates'],
    create: ['Create session', 'Administration / Create session'],
    questions: ['Question bank', 'Administration / Question bank'],
    settings: ['Settings', 'Administration / Settings'],
  };
  const MODES = {
    qualifier: ['SS1 Placement Qualifier', 'Incoming SS1 placement across core aptitude domains.'],
    mixed: ['Mixed Subject Examination', 'One timed paper composed from two to six subjects.'],
    single: ['Single Subject Examination', 'A focused class-level examination containing one subject.'],
    waec: ['WAEC Subject Practice', 'SS3 subject-specific practice from one subject domain.'],
  };

  let bank = null;
  let chart = null;

  const esc = (value) => String(value ?? '').replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;').replaceAll("'", '&#039;');
  const query = () => new URL(location.href).searchParams;
  const currentPage = () => ROUTES[query().get('page')] ? query().get('page') : 'overview';
  const href = (page, values = {}) => {
    const url = new URL('./admin.html', location.href);
    url.search = '';
    url.searchParams.set('page', page);
    Object.entries(values).forEach(([key, value]) => { if (value !== '' && value != null) url.searchParams.set(key, value); });
    return `${url.pathname.split('/').pop()}${url.search}`;
  };
  const navigate = (page, values = {}, replace = false) => {
    history[replace ? 'replaceState' : 'pushState']({}, '', href(page, values));
    render();
  };
  const dateTime = (time) => time ? new Intl.DateTimeFormat('en-NG', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(time)) : 'Not scheduled';
  const effectiveStatus = (session) => session.status !== 'open' ? session.status : session.startsAt && session.startsAt > Date.now() ? 'scheduled' : session.endsAt && session.endsAt < Date.now() ? 'closed' : 'open';
  const statusBadge = (status) => `<span class="status-badge" data-status="${esc(status)}"><span class="status-dot" aria-hidden="true"></span>${esc(status)}</span>`;
  const subjectLabel = (code) => Questions.subjectByCode(bank, code)?.label || code;
  const coverage = (session) => session.mode === 'qualifier' ? 'Placement domains' : session.subjects.map(subjectLabel).join(', ');
  const pageHeader = (eyebrow, title, description, action = '') => `<div class="mb-7 flex flex-col gap-5 border-b border-neutral-300 pb-7 sm:flex-row sm:items-end sm:justify-between"><div class="max-w-3xl"><p class="eyebrow">${esc(eyebrow)}</p><h2 class="page-title mt-2">${esc(title)}</h2><p class="mt-3 max-w-2xl text-sm leading-6 text-neutral-600">${esc(description)}</p></div>${action ? `<div>${action}</div>` : ''}</div>`;
  const emptyState = (title, description, action = '') => `<div class="empty-state"><div class="max-w-sm"><span class="mx-auto grid size-11 place-items-center rounded-lg bg-black font-display text-sm font-extrabold text-white">F</span><h3 class="section-title mt-5">${esc(title)}</h3><p class="mt-2 text-sm leading-6 text-neutral-600">${esc(description)}</p>${action ? `<div class="mt-5">${action}</div>` : ''}</div></div>`;
  const notify = (message, inverse = false) => {
    alertRoot.className = 'mx-auto max-w-[1500px] px-4 pt-4 sm:px-6 lg:px-8';
    alertRoot.innerHTML = `<div class="flex items-start justify-between gap-4 rounded-xl border border-black ${inverse ? 'bg-black text-white' : 'bg-white text-black'} px-4 py-3 text-sm"><p class="leading-6">${esc(message)}</p><button data-dismiss-alert class="min-h-8 px-2 text-xs font-bold underline underline-offset-4">Dismiss</button></div>`;
  };
  const setChrome = (page) => {
    breadcrumb.textContent = ROUTES[page][1];
    pageLabel.textContent = ROUTES[page][0];
    document.querySelectorAll('[data-admin-route]').forEach((link) => link.dataset.adminRoute === page ? link.setAttribute('aria-current', 'page') : link.removeAttribute('aria-current'));
  };
  const destroyChart = () => { chart?.destroy?.(); chart = null; };

  function sessionsTable(sessions) {
    return `<div class="overflow-x-auto"><table class="admin-table"><thead><tr><th>Session</th><th>Class / type</th><th>Questions</th><th>Status</th><th><span class="sr-only">Action</span></th></tr></thead><tbody>${sessions.map((session) => `<tr><td><strong class="block text-black">${esc(session.title)}</strong><span class="text-xs text-neutral-500">${esc(coverage(session))}</span></td><td><strong>${esc(session.classLevel)}</strong><span class="block text-xs text-neutral-500">${esc(Store.getModeLabel(session.mode))}</span></td><td class="mono">${session.questionCount} / ${session.durationMinutes} min</td><td>${statusBadge(effectiveStatus(session))}</td><td class="text-right"><a data-session-detail="${esc(session.id)}" href="${href('sessions', { session: session.id })}" class="font-bold underline underline-offset-4">Manage</a></td></tr>`).join('')}</tbody></table></div>`;
  }

  function renderOverview() {
    const sessions = Store.listSessions();
    const attempts = Store.getAttempts();
    const open = sessions.filter((session) => effectiveStatus(session) === 'open').length;
    const unfinished = attempts.filter((attempt) => attempt.startedAt && !attempt.submittedAt).length;
    root.innerHTML = `<div class="page-enter">${pageHeader('Operations desk', 'Examination control centre', 'Monitor session readiness, candidate activity and question coverage from one operational view.', `<a data-admin-route="create" href="${href('create')}" class="inline-flex min-h-11 items-center rounded-lg bg-black px-4 text-sm font-bold text-white hover:bg-neutral-800">Create session</a>`)}<section class="metric-strip"><div><p class="eyebrow">Sessions</p><strong class="metric-value mt-2 block">${sessions.length}</strong><p class="mt-2 text-xs text-neutral-500">saved locally</p></div><div><p class="eyebrow">Open now</p><strong class="metric-value mt-2 block">${open}</strong><p class="mt-2 text-xs text-neutral-500">accepting candidates</p></div><div><p class="eyebrow">Candidates</p><strong class="metric-value mt-2 block">${attempts.length}</strong><p class="mt-2 text-xs text-neutral-500">attempt records</p></div><div><p class="eyebrow">Question bank</p><strong class="metric-value mt-2 block">${bank.questions.length}</strong><p class="mt-2 text-xs text-neutral-500">validated items</p></div></section><div class="mt-6 grid gap-6 xl:grid-cols-12"><section class="surface overflow-hidden xl:col-span-8"><div class="border-b border-neutral-200 px-5 py-4"><p class="eyebrow">Last 7 days</p><h3 class="section-title mt-1">Candidate activity</h3></div><div id="activity-chart" class="min-h-72 px-2 py-4" aria-label="Candidate activity over the last seven days"></div></section><aside class="ink-panel xl:col-span-4"><div class="border-b border-neutral-800 px-5 py-4"><p class="text-[10px] font-bold uppercase tracking-[.13em] text-neutral-500">Attention</p><h3 class="mt-1 font-display text-lg font-extrabold">Operations queue</h3></div><div class="attention-row"><span class="mt-1 size-2 rounded-full bg-white" aria-hidden="true"></span><div><strong class="text-sm">${sessions.filter((session) => session.status === 'draft').length} draft session(s)</strong><p class="mt-1 text-xs leading-5 text-neutral-400">Review before distribution.</p></div></div><div class="attention-row"><span class="mt-1 size-2 rounded-full border border-white" aria-hidden="true"></span><div><strong class="text-sm">${unfinished} unfinished attempt(s)</strong><p class="mt-1 text-xs leading-5 text-neutral-400">Browser-local prototype records.</p></div></div></aside></div><section class="surface mt-6 overflow-hidden"><div class="flex items-center justify-between border-b border-neutral-200 px-5 py-4"><div><p class="eyebrow">Recent</p><h3 class="section-title mt-1">Exam sessions</h3></div><a data-admin-route="sessions" href="${href('sessions')}" class="text-xs font-bold underline underline-offset-4">View all</a></div>${sessions.length ? sessionsTable(sessions.slice(0, 5)) : emptyState('No sessions yet', 'Create the first examination configuration.')}</section></div>`;
    const mount = document.getElementById('activity-chart');
    if (!window.ApexCharts) { mount.textContent = `${attempts.length} local attempt record(s)`; return; }
    const days = [...Array(7)].map((_, index) => { const day = new Date(); day.setHours(0, 0, 0, 0); day.setDate(day.getDate() - (6 - index)); return day; });
    const counts = days.map((day) => attempts.filter((attempt) => { const time = attempt.submittedAt || attempt.startedAt; return time && new Date(time).toDateString() === day.toDateString(); }).length);
    chart = new ApexCharts(mount, { chart: { type: 'area', height: 275, toolbar: { show: false }, fontFamily: 'DM Sans, sans-serif' }, series: [{ name: 'Attempts', data: counts }], colors: ['#111111'], stroke: { curve: 'smooth', width: 2 }, fill: { type: 'solid', opacity: .08 }, dataLabels: { enabled: false }, grid: { borderColor: '#e5e5e5', strokeDashArray: 3 }, xaxis: { categories: days.map((day) => day.toLocaleDateString('en-NG', { weekday: 'short' })) }, yaxis: { min: 0, labels: { formatter: (value) => Number.isInteger(value) ? value : '' } } });
    chart.render();
  }

  function sessionDetail(session) {
    const link = Store.getSessionLink(session, location.href);
    const attempts = Store.getAttempts().filter((attempt) => attempt.sessionId === session.id);
    return `<section class="mt-6 grid gap-6 xl:grid-cols-12"><div class="surface-strong overflow-hidden xl:col-span-8"><div class="bg-black px-5 py-5 text-white"><p class="text-[10px] font-bold uppercase tracking-[.13em] text-neutral-400">Session ${esc(session.id)}</p><h3 class="mt-2 font-display text-2xl font-extrabold tracking-[-.035em]">${esc(session.title)}</h3></div><div class="grid gap-px bg-neutral-200 sm:grid-cols-4">${[['Class', session.classLevel], ['Type', Store.getModeLabel(session.mode)], ['Questions', session.questionCount], ['Candidates', attempts.length]].map(([key, value]) => `<div class="bg-white p-4"><span class="eyebrow">${esc(key)}</span><strong class="mt-2 block text-sm">${esc(value)}</strong></div>`).join('')}</div><div class="p-5"><label class="text-xs font-bold" for="session-link">Dynamic student link</label><div class="mt-2 flex flex-col gap-2 sm:flex-row"><input id="session-link" class="control mono" readonly value="${esc(link)}"><button data-copy-link class="min-h-11 rounded-lg bg-black px-4 text-sm font-bold text-white">Copy link</button></div><div class="mt-5 grid gap-4 sm:grid-cols-2"><div><p class="eyebrow">Coverage</p><p class="mt-2 text-sm font-semibold">${esc(coverage(session))}</p></div><div><p class="eyebrow">Window</p><p class="mt-2 text-sm font-semibold">${esc(dateTime(session.startsAt))}<br>${esc(dateTime(session.endsAt))}</p></div></div></div></div><aside class="surface p-5 xl:col-span-4"><div id="session-qr" class="qr-frame" aria-label="QR code for ${esc(session.title)}"></div><p class="mt-3 text-center text-xs leading-5 text-neutral-500">Scan to open this exact session configuration.</p><div class="mt-5 grid grid-cols-3 gap-2"><button data-session-status="open" class="min-h-10 rounded-lg border border-neutral-300 text-xs font-bold">Open</button><button data-session-status="draft" class="min-h-10 rounded-lg border border-neutral-300 text-xs font-bold">Draft</button><button data-session-status="closed" class="min-h-10 rounded-lg border border-neutral-300 text-xs font-bold">Close</button></div><button data-delete-session class="mt-3 min-h-10 w-full text-xs font-bold underline underline-offset-4">Delete local session</button></aside></section>`;
  }

  function renderSessions() {
    const params = query();
    const allowed = ['all', 'open', 'scheduled', 'draft', 'closed'];
    const filter = allowed.includes(params.get('status')) ? params.get('status') : 'all';
    const all = Store.listSessions();
    const sessions = filter === 'all' ? all : all.filter((session) => effectiveStatus(session) === filter);
    const detail = all.find((session) => session.id === params.get('session'));
    root.innerHTML = `<div class="page-enter">${pageHeader('Configuration registry', 'Exam sessions', 'Create, inspect and distribute every locally configured examination session.', `<a data-admin-route="create" href="${href('create')}" class="inline-flex min-h-11 items-center rounded-lg bg-black px-4 text-sm font-bold text-white">New session</a>`)}<section class="surface overflow-hidden"><div class="flex flex-wrap gap-2 border-b border-neutral-200 p-4">${allowed.map((status) => `<a data-status-filter="${status}" href="${href('sessions', { status })}" class="inline-flex min-h-9 items-center rounded-lg border px-3 text-xs font-bold capitalize ${filter === status ? 'border-black bg-black text-white' : 'border-neutral-300 bg-white'}">${status}</a>`).join('')}</div>${sessions.length ? sessionsTable(sessions) : emptyState('No matching sessions', 'Change the filter or create a new session.')}</section>${detail ? sessionDetail(detail) : ''}</div>`;
    if (detail) {
      QR.render(document.getElementById('session-qr'), Store.getSessionLink(detail, location.href));
      document.querySelector('[data-copy-link]').onclick = async () => { try { await navigator.clipboard.writeText(Store.getSessionLink(detail, location.href)); notify('Dynamic session link copied.', true); } catch { notify('Copy was unavailable. Select the link manually.'); } };
      document.querySelectorAll('[data-session-status]').forEach((button) => { button.onclick = () => { Store.updateSessionStatus(detail.id, button.dataset.sessionStatus); notify(`Session marked ${button.dataset.sessionStatus}.`, true); renderSessions(); }; });
      document.querySelector('[data-delete-session]').onclick = () => { if (!confirm('Delete this local session configuration?')) return; Store.deleteSession(detail.id); notify('Local session deleted.'); navigate('sessions', { status: filter }, true); };
    }
  }

  function renderCandidates() {
    const allowed = ['all', 'submitted', 'in-progress'];
    const filter = allowed.includes(query().get('status')) ? query().get('status') : 'all';
    const all = Store.getAttempts();
    const attempts = filter === 'submitted' ? all.filter((attempt) => attempt.submittedAt) : filter === 'in-progress' ? all.filter((attempt) => attempt.startedAt && !attempt.submittedAt) : all;
    root.innerHTML = `<div class="page-enter">${pageHeader('Attempt ledger', 'Candidates', 'Identify candidates by the full name supplied at examination entry and review browser-local attempt status.')}<section class="metric-strip"><div><p class="eyebrow">All attempts</p><strong class="metric-value mt-2 block">${all.length}</strong></div><div><p class="eyebrow">Submitted</p><strong class="metric-value mt-2 block">${all.filter((attempt) => attempt.submittedAt).length}</strong></div><div><p class="eyebrow">In progress</p><strong class="metric-value mt-2 block">${all.filter((attempt) => attempt.startedAt && !attempt.submittedAt).length}</strong></div></section><section class="surface mt-6 overflow-hidden"><div class="flex flex-wrap gap-2 border-b border-neutral-200 p-4">${allowed.map((status) => `<a data-candidate-filter="${status}" href="${href('candidates', { status })}" class="inline-flex min-h-9 items-center rounded-lg border px-3 text-xs font-bold capitalize ${filter === status ? 'border-black bg-black text-white' : 'border-neutral-300 bg-white'}">${status.replace('-', ' ')}</a>`).join('')}</div>${attempts.length ? `<div class="overflow-x-auto"><table class="admin-table"><thead><tr><th>Candidate</th><th>Session</th><th>Class</th><th>Progress</th><th>Status</th></tr></thead><tbody>${attempts.map((attempt) => `<tr><td><strong class="text-black">${esc(attempt.studentName || 'Unnamed')}</strong><span class="block text-xs text-neutral-500 mono">${esc(attempt.id)}</span></td><td>${esc(attempt.sessionTitle)}</td><td>${esc(attempt.classLevel)}</td><td class="mono">${attempt.answered || 0}/${attempt.questionCount || 0}</td><td>${statusBadge(attempt.submittedAt ? 'submitted' : 'in progress')}</td></tr>`).join('')}</tbody></table></div>` : emptyState('No candidate attempts', 'Candidate records appear after a student starts a configured examination.')}</section></div>`;
  }

  function renderQuestions() {
    const params = query();
    const subject = params.get('subject') || 'all';
    const level = ['all', 'SS1', 'SS2', 'SS3'].includes(params.get('class')) ? params.get('class') || 'all' : 'all';
    const type = params.get('type') || 'all';
    const questions = bank.questions.filter((item) => (subject === 'all' || item.subjectCode === subject) && (level === 'all' || item.levels.includes(level)) && (type === 'all' || item.type === type));
    const subjects = bank.subjects || [];
    const types = [...new Set(bank.questions.map((item) => item.type))].sort();
    root.innerHTML = `<div class="page-enter">${pageHeader('Content inventory', 'Question bank', 'Inspect the JSON-backed examination inventory by subject, class and response type.')}<section class="surface p-4"><form id="question-filters" class="grid gap-3 md:grid-cols-3"><label class="text-xs font-bold">Subject<select name="subject" class="control mt-2"><option value="all">All subjects</option>${subjects.map((item) => `<option value="${esc(item.code)}" ${subject === item.code ? 'selected' : ''}>${esc(item.label)}</option>`).join('')}</select></label><label class="text-xs font-bold">Class<select name="class" class="control mt-2">${['all', 'SS1', 'SS2', 'SS3'].map((item) => `<option value="${item}" ${level === item ? 'selected' : ''}>${item === 'all' ? 'All classes' : item}</option>`).join('')}</select></label><label class="text-xs font-bold">Response type<select name="type" class="control mt-2"><option value="all">All types</option>${types.map((item) => `<option value="${esc(item)}" ${type === item ? 'selected' : ''}>${esc(item)}</option>`).join('')}</select></label></form></section><section class="surface mt-5 overflow-hidden"><div class="flex items-center justify-between border-b border-neutral-200 px-5 py-4"><h3 class="section-title">Matching questions</h3><span class="text-xs font-bold text-neutral-500">${questions.length} item(s)</span></div>${questions.length ? `<div class="divide-y divide-neutral-200">${questions.slice(0, 100).map((item) => `<article class="p-5"><div class="flex flex-wrap items-center gap-2"><span class="status-badge">${esc(subjectLabel(item.subjectCode))}</span><span class="status-badge">${esc(item.levels.join(' / '))}</span><span class="status-badge">${esc(item.type)}</span></div><h4 class="mt-4 font-display text-base font-extrabold">${esc(item.label)}</h4><p class="mt-2 max-w-4xl text-sm leading-6 text-neutral-700">${esc(item.prompt)}</p></article>`).join('')}</div>` : emptyState('No questions match', 'Change one or more filters.')}</section></div>`;
    document.getElementById('question-filters').onchange = (event) => { const form = new FormData(event.currentTarget); navigate('questions', { subject: form.get('subject'), class: form.get('class'), type: form.get('type') }, true); };
  }

  function renderCreate() {
    root.innerHTML = `<div class="page-enter">${pageHeader('Session builder', 'Create examination session', 'Define the exact examination contract. The generated link and QR carry this configuration to the candidate device.')}<form id="session-form" class="grid gap-6 xl:grid-cols-12" novalidate><div class="flex flex-col gap-6 xl:col-span-8"><section class="surface p-5 sm:p-6"><p class="eyebrow">01 / Architecture</p><h3 class="section-title mt-1">Who is this paper for?</h3><div class="mt-5 grid gap-4 sm:grid-cols-2"><label class="text-xs font-bold">Class<select id="class-level" class="control mt-2"><option>SS1</option><option selected>SS2</option><option>SS3</option></select></label><label class="text-xs font-bold">Initial status<select id="session-status" class="control mt-2"><option value="open">Open</option><option value="draft">Draft</option><option value="closed">Closed</option></select></label></div><div id="mode-options" class="mt-5 grid gap-3 md:grid-cols-2">${Object.entries(MODES).map(([key, value]) => `<button type="button" class="mode-card" data-mode="${key}" aria-pressed="${key === 'single'}"><span class="eyebrow">${esc(key)}</span><strong class="mt-2 block font-display text-sm font-extrabold">${esc(value[0])}</strong><span class="muted mt-2 block text-xs leading-5">${esc(value[1])}</span></button>`).join('')}</div><p id="mode-lock-note" class="mt-3 min-h-5 text-xs font-bold text-neutral-500"></p></section><section class="surface p-5 sm:p-6"><div class="flex items-end justify-between gap-4"><div><p class="eyebrow">02 / Coverage</p><h3 class="section-title mt-1">Subject selection</h3></div><span id="available-question-count" class="text-xs font-bold text-neutral-500"></span></div><p id="subject-help" class="mt-2 text-sm text-neutral-600"></p><fieldset id="subject-fieldset" class="mt-5"><legend class="sr-only">Subjects</legend><div id="subject-options" class="grid gap-2 sm:grid-cols-2"></div></fieldset><div id="qualifier-coverage" class="mt-5 hidden rounded-xl border border-black bg-neutral-50 p-4 text-sm leading-6"></div></section><section class="surface p-5 sm:p-6"><p class="eyebrow">03 / Candidate experience</p><h3 class="section-title mt-1">Paper details</h3><div class="mt-5 grid gap-5 sm:grid-cols-2"><label class="text-xs font-bold sm:col-span-2">Session title<input id="session-title" maxlength="40" class="control mt-2" value="Mathematics First Term Examination"></label><label class="text-xs font-bold">Duration in minutes<input id="duration" type="number" min="5" max="240" class="control mt-2" value="60"></label><label class="text-xs font-bold">Questions<input id="question-count" type="number" min="1" max="100" class="control mt-2" value="4"></label><label class="text-xs font-bold">Opens<input id="starts-at" type="datetime-local" class="control mt-2"></label><label class="text-xs font-bold">Closes<input id="ends-at" type="datetime-local" class="control mt-2"></label><label class="text-xs font-bold sm:col-span-2">Candidate instruction<textarea id="instructions" maxlength="80" class="control mt-2"></textarea></label></div></section></div><aside class="xl:col-span-4"><div class="sticky top-24 flex flex-col gap-4"><section class="ink-panel p-5"><p class="text-[10px] font-bold uppercase tracking-wider text-neutral-500">Live specification</p><div id="session-spec" class="mt-5"></div></section><section class="surface p-5"><div id="form-error" class="hidden rounded-lg border border-black bg-neutral-100 p-3 text-xs font-bold" role="alert"></div><button type="submit" class="min-h-12 w-full rounded-lg bg-black px-4 text-sm font-bold text-white hover:bg-neutral-800">Create session & QR</button></section></div></aside></form></div>`;
    bindCreate();
  }

  function bindCreate() {
    const form = document.getElementById('session-form');
    const classLevel = document.getElementById('class-level');
    const status = document.getElementById('session-status');
    const subjectOptions = document.getElementById('subject-options');
    const subjectFieldset = document.getElementById('subject-fieldset');
    const qualifierCoverage = document.getElementById('qualifier-coverage');
    const subjectHelp = document.getElementById('subject-help');
    const count = document.getElementById('question-count');
    const title = document.getElementById('session-title');
    const duration = document.getElementById('duration');
    const lockNote = document.getElementById('mode-lock-note');
    const spec = document.getElementById('session-spec');
    const availableCount = document.getElementById('available-question-count');
    const formError = document.getElementById('form-error');
    let mode = 'single';
    let selected = ['mat'];

    const update = () => {
      if (mode === 'qualifier') classLevel.value = 'SS1';
      if (mode === 'waec') classLevel.value = 'SS3';
      classLevel.disabled = ['qualifier', 'waec'].includes(mode);
      lockNote.textContent = mode === 'qualifier' ? 'Qualifier sessions are locked to SS1.' : mode === 'waec' ? 'WAEC practice is locked to SS3.' : '';
      document.querySelectorAll('[data-mode]').forEach((button) => button.setAttribute('aria-pressed', String(button.dataset.mode === mode)));
      const level = classLevel.value;
      const available = Questions.availableSubjects(bank, level, mode);
      const allowed = new Set(available.map((item) => item.code));
      selected = selected.filter((code) => allowed.has(code));
      if (['single', 'waec'].includes(mode) && selected.length > 1) selected = selected.slice(0, 1);
      if (!selected.length && mode !== 'qualifier' && available.length) selected = [available[0].code];
      if (mode === 'qualifier') {
        subjectFieldset.classList.add('hidden');
        qualifierCoverage.classList.remove('hidden');
        qualifierCoverage.textContent = 'Placement coverage: English Studies, Mathematics, Basic Science & Technology, Social & Citizenship Studies, Business Studies and Digital Technologies.';
      } else {
        subjectFieldset.classList.remove('hidden');
        qualifierCoverage.classList.add('hidden');
        subjectHelp.textContent = mode === 'mixed' ? 'Choose two to six subjects. Questions are interleaved deterministically.' : 'Choose exactly one subject.';
        subjectOptions.innerHTML = available.map((item) => `<label class="subject-option"><input type="checkbox" value="${esc(item.code)}" ${selected.includes(item.code) ? 'checked' : ''}><span class="flex-1 text-sm font-bold">${esc(item.label)}</span><span class="text-xs opacity-60">${level}</span></label>`).join('');
        subjectOptions.querySelectorAll('input').forEach((input) => { input.onchange = () => { if (mode === 'mixed') { if (input.checked && selected.length >= 6) { input.checked = false; notify('Mixed sessions support up to six subjects.'); return; } selected = input.checked ? [...new Set([...selected, input.value])] : selected.filter((code) => code !== input.value); } else selected = input.checked ? [input.value] : []; update(); }; });
      }
      const matching = bank.questions.filter((item) => item.levels.includes(level) && item.examModes.includes(mode) && (mode === 'qualifier' || selected.includes(item.subjectCode)));
      availableCount.textContent = `${matching.length} matching question(s)`;
      count.max = Math.max(matching.length, 1);
      if (matching.length && Number(count.value) > matching.length) count.value = matching.length;
      spec.innerHTML = `<p class="font-display text-2xl font-extrabold leading-tight tracking-[-.035em]">${esc(title.value || MODES[mode][0])}</p><div class="mt-5 grid grid-cols-2 gap-px overflow-hidden rounded-lg bg-neutral-800">${[['Class', level], ['Type', Store.getModeLabel(mode)], ['Questions', count.value], ['Duration', `${duration.value} min`]].map(([key, value]) => `<div class="bg-neutral-950 p-3"><span class="text-[10px] uppercase tracking-wider text-neutral-500">${key}</span><strong class="mt-1 block text-sm">${esc(value)}</strong></div>`).join('')}</div>`;
    };

    document.querySelectorAll('[data-mode]').forEach((button) => { button.onclick = () => { mode = button.dataset.mode; selected = []; title.value = MODES[mode][0]; update(); }; });
    classLevel.onchange = () => { selected = []; update(); };
    [status, count, title, duration].forEach((input) => { input.oninput = update; });
    update();

    form.onsubmit = (event) => {
      event.preventDefault();
      formError.classList.add('hidden');
      try {
        const startValue = document.getElementById('starts-at').value;
        const endValue = document.getElementById('ends-at').value;
        const startsAt = startValue ? new Date(startValue).getTime() : null;
        const endsAt = endValue ? new Date(endValue).getTime() : null;
        if (startsAt && endsAt && endsAt <= startsAt) throw new Error('Closing time must be after opening time.');
        const session = Store.normalizeSession({ mode, classLevel: classLevel.value, subjects: mode === 'qualifier' ? [] : selected, title: title.value, durationMinutes: Number(duration.value), questionCount: Number(count.value), status: status.value, instructions: document.getElementById('instructions').value, startsAt, endsAt });
        if (Questions.questionsForSession(bank, session).length !== session.questionCount) throw new Error('Not enough matching questions for this configuration.');
        const saved = Store.saveSession(session);
        navigate('sessions', { session: saved.id });
        notify('Session created. Review the link and QR before distribution.', true);
      } catch (error) {
        formError.textContent = error.message;
        formError.classList.remove('hidden');
      }
    };
  }

  function renderSettings() {
    const sessions = Store.listSessions();
    const attempts = Store.getAttempts();
    root.innerHTML = `<div class="page-enter">${pageHeader('Prototype controls', 'Settings', 'Review browser-local persistence boundaries and reset local data when required.')}<div class="grid gap-6 xl:grid-cols-12"><section class="surface overflow-hidden xl:col-span-8"><div class="border-b border-neutral-200 p-5"><h3 class="section-title">Browser data</h3><p class="mt-2 text-sm text-neutral-600">These controls affect only this origin and do not revoke already-shared links.</p></div><div class="px-5"><div class="control-row"><div><strong class="text-sm">Saved sessions</strong><p class="text-xs text-neutral-500">${sessions.length} configuration(s)</p></div><button data-clear="sessions" class="min-h-10 text-xs font-bold underline">Clear sessions</button></div><div class="control-row"><div><strong class="text-sm">Candidate attempts</strong><p class="text-xs text-neutral-500">${attempts.length} record(s)</p></div><button data-clear="attempts" class="min-h-10 text-xs font-bold underline">Clear attempts</button></div><div class="control-row"><div><strong class="text-sm">All local data</strong><p class="text-xs text-neutral-500">Sessions, attempts and student states</p></div><button data-clear="all" class="min-h-10 rounded-lg bg-black px-3 text-xs font-bold text-white">Reset prototype</button></div></div></section><aside class="ink-panel p-6 xl:col-span-4"><p class="text-[10px] font-bold uppercase tracking-wider text-neutral-500">Production boundary</p><h3 class="mt-2 font-display text-xl font-extrabold">Not an authorization system.</h3><p class="mt-4 text-sm leading-6 text-neutral-300">Production should replace portable payloads with signed or opaque server-issued tokens and centralized candidate records.</p></aside></div></div>`;
    document.querySelectorAll('[data-clear]').forEach((button) => { button.onclick = () => { if (!confirm('Clear the selected local prototype data?')) return; if (button.dataset.clear === 'sessions') Store.clearSessions(); else if (button.dataset.clear === 'attempts') Store.clearAttempts(); else Store.clearPrototypeData(); renderSettings(); notify('Local prototype data updated.', true); }; });
  }

  function render() {
    destroyChart();
    alertRoot.className = 'hidden';
    const page = currentPage();
    setChrome(page);
    ({ overview: renderOverview, sessions: renderSessions, candidates: renderCandidates, create: renderCreate, questions: renderQuestions, settings: renderSettings }[page])();
    root.focus({ preventScroll: true });
  }

  document.addEventListener('click', (event) => {
    const route = event.target.closest('[data-admin-route]');
    if (route) { event.preventDefault(); navigate(route.dataset.adminRoute); return; }
    const detail = event.target.closest('[data-session-detail]');
    if (detail) { event.preventDefault(); navigate('sessions', { session: detail.dataset.sessionDetail, status: query().get('status') || '' }); return; }
    const sessionFilter = event.target.closest('[data-status-filter]');
    if (sessionFilter) { event.preventDefault(); navigate('sessions', { status: sessionFilter.dataset.statusFilter }); return; }
    const candidateFilter = event.target.closest('[data-candidate-filter]');
    if (candidateFilter) { event.preventDefault(); navigate('candidates', { status: candidateFilter.dataset.candidateFilter }); return; }
    if (event.target.closest('[data-dismiss-alert]')) { alertRoot.className = 'hidden'; alertRoot.innerHTML = ''; }
  });
  addEventListener('popstate', render);

  Questions.load().then((data) => { bank = data; render(); }).catch((error) => {
    setChrome('overview');
    root.innerHTML = `<div class="surface-strong p-6"><p class="eyebrow">Unable to start</p><h2 class="page-title mt-2">Question data unavailable</h2><p class="mt-4 text-sm text-neutral-600">${esc(error.message)}</p></div>`;
  });
})();
