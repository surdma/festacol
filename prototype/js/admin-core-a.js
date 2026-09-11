'use strict';
  'use strict';

  const Store = window.FestacolSessionStore;
  const Data = window.FestacolQuestionData;
  const QR = window.FestacolQR;
  const root = document.getElementById('admin-root');
  const modal = document.getElementById('admin-modal');
  const modalContent = document.getElementById('admin-modal-content');
  const drawer = document.getElementById('admin-detail-drawer');
  const drawerContent = document.getElementById('admin-detail-content');
  const drawerScrim = document.getElementById('admin-drawer-scrim');
  const alertHost = document.getElementById('admin-alert');
  const breadcrumb = document.getElementById('admin-breadcrumb');
  const pageLabel = document.getElementById('admin-page-label');
  if (!Store || !Data || !QR || !root || !modal || !drawer) throw new Error('Festacol admin dependencies are unavailable.');

  const ART = Object.freeze({
    analytics: 'https://raw.githubusercontent.com/themesberg/flowbite-illustrations/main/src/3d/light/employees-working-charts.svg',
    collaboration: 'https://raw.githubusercontent.com/themesberg/flowbite-illustrations/main/src/3d/light/group-brainstorming.svg',
    question: 'https://raw.githubusercontent.com/themesberg/flowbite-illustrations/main/src/3d/light/man-question-marks.svg',
    student: 'https://raw.githubusercontent.com/themesberg/flowbite-illustrations/main/src/3d/light/woman-laptop-chart.svg',
    people: 'https://raw.githubusercontent.com/themesberg/flowbite-illustrations/main/src/3d/light/people-connecting.svg',
    auth: 'https://raw.githubusercontent.com/themesberg/flowbite-illustrations/main/src/3d/light/authentication-form-fields.svg'
  });

  const ICON = Object.freeze({
    plus: '<svg class="fb-icon fb-icon-sm" aria-hidden="true" viewBox="0 0 24 24" fill="none"><path stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 12h14m-7 7V5"/></svg>',
    users: '<svg class="fb-icon" aria-hidden="true" viewBox="0 0 24 24" fill="none"><path stroke="currentColor" stroke-linecap="round" stroke-width="2" d="M4.5 17H4a1 1 0 0 1-1-1 3 3 0 0 1 3-3h1m0-3.05A2.5 2.5 0 1 1 9 5.5M19.5 17h.5a1 1 0 0 0 1-1 3 3 0 0 0-3-3h-1m0-3.05a2.5 2.5 0 1 0-2-4.45m.5 13.5h-7a1 1 0 0 1-1-1 3 3 0 0 1 3-3h3a3 3 0 0 1 3 3 1 1 0 0 1-1 1Zm-1-9.5a2.5 2.5 0 1 1-5 0 2.5 2.5 0 0 1 5 0Z"/></svg>',
    book: '<svg class="fb-icon" aria-hidden="true" viewBox="0 0 24 24" fill="none"><path stroke="currentColor" stroke-linejoin="round" stroke-width="2" d="M12.1429 11v9m0-9c-2.50543-.7107-3.19099-1.39543-6.13657-1.34968-.48057.00746-.86348.38718-.86348.84968v7.2884c0 .4824.41455.8682.91584.8617 2.77491-.0362 3.45995.6561 6.08421 1.3499m0-9c2.5053-.7107 3.1067-1.39542 6.0523-1.34968.4806.00746.9477.38718.9477.84968v7.2884c0 .4824-.4988.8682-1 .8617-2.775-.0362-3.3758.6561-6 1.3499m2-14c0 1.10457-.8955 2-2 2-1.1046 0-2-.89543-2-2s.8954-2 2-2c1.1045 0 2 .89543 2 2Z"/></svg>',
    calendar: '<svg class="fb-icon" aria-hidden="true" viewBox="0 0 24 24" fill="none"><path stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 10h16m-8-3V4M7 7V4m10 3V4M5 20h14a1 1 0 0 0 1-1V7a1 1 0 0 0-1-1H5a1 1 0 0 0-1 1v12a1 1 0 0 0 1 1Z"/></svg>',
    close: '<svg class="fb-icon" aria-hidden="true" viewBox="0 0 24 24" fill="none"><path stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18 17.94 6M18 18 6.06 6"/></svg>',
    arrow: '<svg class="fb-icon" aria-hidden="true" viewBox="0 0 24 24" fill="none"><path stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="m9 5 7 7-7 7"/></svg>',
    more: '<svg class="fb-icon" aria-hidden="true" viewBox="0 0 24 24" fill="none"><path stroke="currentColor" stroke-linecap="round" stroke-width="2" d="M5 12h.01M12 12h.01M19 12h.01"/></svg>'
  });

  const ROUTES = Object.freeze({
    overview: ['Overview', 'Administration / Overview'],
    users: ['Users', 'Administration / Users'],
    exams: ['Exams', 'Administration / Exams'],
    classes: ['Classes', 'Administration / Classes'],
    questions: ['Questions', 'Administration / Questions'],
    reports: ['Reports', 'Administration / Reports'],
    settings: ['Settings', 'Administration / Settings']
  });

  const MODES = Object.freeze({
    qualifier: ['Placement qualifier', 'SS1 placement across foundational domains.'],
    mixed: ['Mixed subject', 'One timed paper interleaving 2–6 subjects.'],
    single: ['Single subject', 'Focused class examination in one subject.'],
    waec: ['WAEC practice', 'SS3 subject-specific practice session.']
  });

  let data = null;
  let charts = [];
  let lastFocus = null;
  const e = (value) => String(value ?? '').replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;').replaceAll("'", '&#039;');
  const p = () => new URL(location.href).searchParams;
  const currentPage = () => ROUTES[p().get('page')] ? p().get('page') : 'overview';
  const href = (page, extra = {}) => {
    const target = new URL('./admin.html', location.href);
    target.search = '';
    target.searchParams.set('page', page);
    Object.entries(extra).forEach(([key, value]) => { if (value !== '' && value !== null && value !== undefined) target.searchParams.set(key, String(value)); });
    return target.pathname.split('/').pop() + target.search;
  };
  const navigate = (page, extra = {}, replace = false) => {
    history[replace ? 'replaceState' : 'pushState']({}, '', href(page, extra));
    render();
  };
  const formatDate = (timestamp) => timestamp ? new Intl.DateTimeFormat('en-NG', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(timestamp)) : 'Not scheduled';
  const classFor = (classId) => Store.listClasses().find((item) => item.id === classId);
  const sessionState = (session) => {
    const now = Date.now();
    if (session.status !== 'open') return session.status;
    if (session.startsAt && now < session.startsAt) return 'scheduled';
    if (session.endsAt && now > session.endsAt) return 'closed';
    return 'open';
  };
  const statusBadge = (status) => `<span class="badge ${status === 'open' || status === 'active' || status === 'submitted' ? 'badge-success' : status === 'scheduled' ? 'badge-brand' : status === 'draft' ? 'badge-warning' : 'badge-danger'}">${e(status)}</span>`;
  const coverage = (session) => session.mode === 'qualifier' ? 'Placement domains' : session.subjects.map((code) => Data.subjectByCode(data, code)?.label || code).join(', ');
  const pageHead = (eyebrow, title, detail, action = '') => `<div class="mb-5 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between"><div class="max-w-3xl"><p class="eyebrow">${e(eyebrow)}</p><h2 class="page-title mt-1.5">${e(title)}</h2><p class="mt-2 max-w-2xl text-sm leading-6 text-slate-600">${e(detail)}</p></div>${action ? `<div class="flex shrink-0 items-center gap-2">${action}</div>` : ''}</div>`;
  const empty = (title, detail, illustration = ART.question, action = '') => `<div class="grid min-h-64 place-items-center p-7 text-center"><div class="max-w-sm"><img src="${illustration}" alt="" class="empty-illustration h-32 object-contain" loading="lazy"><h3 class="mt-4 font-display text-lg font-extrabold text-slate-900">${e(title)}</h3><p class="mt-2 text-sm leading-6 text-slate-500">${e(detail)}</p>${action ? `<div class="mt-4">${action}</div>` : ''}</div></div>`;
  const destroyCharts = () => { charts.forEach((chart) => chart?.destroy?.()); charts = []; };
