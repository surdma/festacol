(() => {
  'use strict';

  const root = document.getElementById('app');
  if (!root) return;

  const primary = 'inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-blue-700 px-4 py-2.5 text-sm font-semibold text-white transition-colors duration-200 hover:bg-blue-800 focus:outline-none focus:ring-4 focus:ring-blue-300 disabled:cursor-not-allowed disabled:opacity-50 motion-reduce:transition-none';
  const secondary = 'inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-sm font-semibold text-gray-900 transition-colors duration-200 hover:bg-gray-100 focus:outline-none focus:ring-4 focus:ring-gray-200 disabled:cursor-not-allowed disabled:opacity-50 motion-reduce:transition-none';
  const quiet = 'inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-transparent px-4 py-2.5 text-sm font-semibold text-gray-700 transition-colors duration-200 hover:bg-gray-100 focus:outline-none focus:ring-4 focus:ring-gray-200 motion-reduce:transition-none';
  const field = 'block min-h-11 w-full rounded-lg border border-gray-300 bg-gray-50 p-2.5 text-base text-gray-900 placeholder:text-gray-400 focus:border-blue-500 focus:ring-blue-500';
  const card = 'rounded-xl border border-gray-200 bg-white shadow-sm';
  const badge = 'inline-flex items-center gap-1.5 rounded-md bg-blue-100 px-2.5 py-1 text-xs font-medium text-blue-800';

  const icon = (path) => `<svg class="h-4 w-4 shrink-0" aria-hidden="true" viewBox="0 0 24 24" fill="none"><path stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="${path}"/></svg>`;
  const icons = {
    info: 'M12 17v-6m0-4h.01M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z',
    next: 'm9 18 6-6-6-6',
    shield: 'm9 12 2 2 4-4M12 22s8-3 8-10V5l-8-3-8 3v7c0 7 8 10 8 10Z'
  };

  const cls = (node, value, keepHidden = false) => {
    if (!node) return;
    const next = `${value}${keepHidden && node.classList.contains('hidden') ? ' hidden' : ''}`;
    if (node.className !== next) node.className = next;
  };

  const common = () => {
    cls(document.body, 'min-h-dvh bg-gray-50 font-sans text-gray-900 antialiased');
    root.querySelectorAll('.surface-raised,.exam-card,.modal-card').forEach((el) => cls(el, card));
    root.querySelectorAll('.surface-soft').forEach((el) => cls(el, 'rounded-xl border border-gray-200 bg-gray-50'));
    root.querySelectorAll('input.field,select.field,textarea.field,input.exam-field').forEach((el) => cls(el, `${field}${el.tagName === 'TEXTAREA' ? ' min-h-28 resize-y' : ''}`));
    root.querySelectorAll('button.btn,a.btn').forEach((el) => {
      if (!el.dataset.flowbiteVariant) el.dataset.flowbiteVariant = el.className.includes('primary') || el.className.includes('!bg-black') ? 'primary' : el.className.includes('quiet') || el.className.includes('ghost') ? 'quiet' : 'secondary';
      cls(el, el.dataset.flowbiteVariant === 'primary' ? primary : el.dataset.flowbiteVariant === 'quiet' ? quiet : secondary, true);
    });
    root.querySelectorAll('[role="alert"],.alert').forEach((el) => {
      cls(el, 'flex items-start gap-3 rounded-lg border border-blue-200 bg-blue-50 p-4 text-sm text-blue-800', true);
      if (!el.dataset.flowbiteIcon) { el.insertAdjacentHTML('afterbegin', icon(icons.info)); el.dataset.flowbiteIcon = 'true'; }
    });
    root.querySelectorAll('.brand-mark').forEach((el) => cls(el, 'grid h-10 w-10 place-items-center rounded-lg bg-blue-700 font-display text-sm font-extrabold text-white shadow-sm'));
  };

  const auth = () => {
    const form = root.querySelector('#student-login-form');
    if (!form) return;
    const main = form.closest('main');
    cls(main, 'min-h-dvh bg-gray-50 px-4 py-8 sm:px-6 lg:px-8');
    const frame = main?.firstElementChild;
    cls(frame, 'mx-auto grid min-h-[calc(100dvh-4rem)] max-w-6xl overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm lg:grid-cols-[minmax(0,1fr)_minmax(420px,.85fr)]');
    const panels = frame ? [...frame.children] : [];
    cls(panels[0], 'flex flex-col justify-between border-b border-gray-200 bg-blue-50 p-6 sm:p-8 lg:border-b-0 lg:border-r lg:p-10');
    cls(panels[1], 'flex items-center p-6 sm:p-8 lg:p-10');
    form.querySelectorAll('label').forEach((el) => cls(el, 'block text-sm font-medium text-gray-900'));
    cls(form.querySelector('button[type="submit"]'), `${primary} sm:col-span-2`);
  };

  const briefing = () => {
    const start = root.querySelector('[data-start]');
    if (!start) return;
    const main = start.closest('main');
    cls(main, 'min-h-dvh bg-gray-50');
    cls(main?.querySelector('header'), 'border-b border-gray-200 bg-white');
    cls(main?.querySelector('section'), 'overflow-hidden rounded-xl border border-blue-200 bg-blue-50 shadow-sm');
    cls(start, primary);
    if (!start.dataset.flowbiteIcon) { start.insertAdjacentHTML('beforeend', icon(icons.next)); start.dataset.flowbiteIcon = 'true'; }
  };

  const choices = () => {
    root.querySelectorAll('label').forEach((label) => {
      const input = label.querySelector('input[name^="q-"]');
      if (!input) return;
      cls(label, `flex min-h-14 cursor-pointer items-center gap-3 rounded-lg border p-4 text-sm font-medium transition-colors duration-200 focus-within:ring-4 focus-within:ring-blue-100 motion-reduce:transition-none ${input.checked ? 'border-blue-600 bg-blue-50 text-blue-900' : 'border-gray-200 bg-white text-gray-900 hover:bg-gray-50'}`);
    });
  };

  const questionMap = () => root.querySelectorAll('[data-go]').forEach((button) => {
    const current = button.getAttribute('aria-current') === 'step';
    const state = current ? 'border-blue-700 bg-blue-700 text-white' : button.dataset.status === 'answered' ? 'border-emerald-200 bg-emerald-50 text-emerald-800' : button.dataset.status === 'incomplete' ? 'border-amber-200 bg-amber-50 text-amber-800' : 'border-gray-200 bg-white text-gray-700';
    cls(button, `grid h-11 min-w-11 place-items-center rounded-lg border text-sm font-semibold transition-colors duration-200 focus:outline-none focus:ring-4 focus:ring-blue-100 motion-reduce:transition-none ${state}`);
  });

  const exam = () => {
    if (!root.querySelector('[data-next]')) return;
    cls(root.firstElementChild, 'min-h-dvh bg-gray-50 text-gray-900');
    const header = root.querySelector('#app > div > header');
    cls(header, 'sticky top-0 z-40 border-b border-gray-200 bg-white/95 shadow-sm backdrop-blur');
    cls(header?.firstElementChild, 'mx-auto grid max-w-7xl grid-cols-[minmax(0,1fr)_auto] items-center gap-4 px-4 py-3 sm:px-6 lg:grid-cols-[minmax(0,1fr)_auto_auto] lg:px-8');
    cls(root.querySelector('#app > div > main'), 'mx-auto grid max-w-7xl gap-6 px-4 py-6 sm:px-6 lg:grid-cols-[minmax(0,1fr)_19rem] lg:px-8');
    const article = root.querySelector('article');
    cls(article, `overflow-hidden ${card}`);
    cls(article?.firstElementChild, 'flex flex-wrap items-center justify-between gap-3 border-b border-gray-200 bg-gray-50 px-5 py-4 sm:px-6');
    cls(article?.children?.[1], 'p-5 sm:p-6 lg:p-8');
    cls(article?.querySelector('footer'), 'flex flex-col gap-3 border-t border-gray-200 bg-white p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5');
    cls(root.querySelector('#exam-timer-box'), 'rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-right text-gray-900');
    const integrity = root.querySelector('#integrity-pill');
    cls(integrity, badge);
    if (integrity && !integrity.dataset.flowbiteIcon) { integrity.insertAdjacentHTML('afterbegin', icon(icons.shield)); integrity.dataset.flowbiteIcon = 'true'; }
    cls(root.querySelector('#question-map > div'), `sticky top-24 p-5 ${card}`);
    const drawer = root.querySelector('#question-map-drawer');
    cls(drawer, 'fixed inset-0 z-50 bg-gray-900/50 p-4 backdrop-blur-sm lg:hidden', true);
    cls(drawer?.firstElementChild, 'ml-auto flex h-full w-full max-w-sm flex-col rounded-xl bg-white p-5 text-gray-900 shadow-xl');
    choices();
    questionMap();
  };

  const overlays = () => {
    root.querySelectorAll('.modal-shell').forEach((el) => cls(el, 'fixed inset-0 z-[100] grid place-items-center bg-gray-900/50 p-4 backdrop-blur-sm', true));
    const gate = root.querySelector('#camera-gate');
    cls(gate, 'rounded-xl border border-blue-200 bg-blue-50 p-5');
    cls(gate?.querySelector('[data-start]'), primary);
  };

  let observer;
  const observe = () => observer?.observe(root, { childList:true, subtree:true, attributes:true, attributeFilter:['class','aria-current','checked','data-urgent'] });
  const enhance = () => {
    observer?.disconnect();
    try { common(); auth(); briefing(); exam(); overlays(); window.initFlowbite?.(); }
    finally { observe(); }
  };
  let pending = false;
  const schedule = () => { if (pending) return; pending = true; requestAnimationFrame(() => { pending = false; enhance(); }); };

  observer = new MutationObserver(schedule);
  observe();
  root.addEventListener('change', schedule, true);
  root.addEventListener('click', schedule, true);
  schedule();
})();
