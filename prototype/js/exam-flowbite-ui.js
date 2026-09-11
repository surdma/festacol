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

  const icon = (path, className = 'h-4 w-4 shrink-0') => `<svg class="${className}" aria-hidden="true" viewBox="0 0 24 24" fill="none"><path stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="${path}"/></svg>`;
  const icons = {
    previous: 'M5 12h14M5 12l4-4m-4 4 4 4',
    next: 'M5 12h14m-4 4 4-4-4-4',
    flag: 'M5 14v7M5 4.971v9.541c5.6-5.538 8.4 2.64 14-.086v-9.54C13.4 7.61 10.6-.568 5 4.97Z',
    review: 'M15 4h3a1 1 0 0 1 1 1v15a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1h3m0 3h6m-6 7 2 2 4-4m-5-9v4h4V3h-4Z',
    shield: 'M9.5 11.5 11 13l4-3.5M12 20a16.405 16.405 0 0 1-5.092-5.804A16.694 16.694 0 0 1 5 6.666L12 4l7 2.667a16.695 16.695 0 0 1-1.908 7.529A16.406 16.406 0 0 1 12 20Z',
    info: 'M12 17v-6m0-4h.01M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z'
  };

  const cls = (node, value, keepHidden = false) => {
    if (!node) return;
    const next = `${value}${keepHidden && node.classList.contains('hidden') ? ' hidden' : ''}`;
    if (node.className !== next) node.className = next;
  };

  const setControl = (node, label, path, iconAfter = false) => {
    if (!node) return;
    const markup = `${iconAfter ? '' : icon(path)}<span>${label}</span>${iconAfter ? icon(path) : ''}`;
    if (node.dataset.flowbiteLabel !== label) {
      node.innerHTML = markup;
      node.dataset.flowbiteLabel = label;
    }
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
      if (!el.dataset.flowbiteIcon) {
        el.insertAdjacentHTML('afterbegin', icon(icons.info));
        el.dataset.flowbiteIcon = 'true';
      }
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
    setControl(start, 'Start examination', icons.next, true);
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
    cls(button, `relative grid h-11 min-w-11 place-items-center rounded-lg border text-sm font-semibold transition-colors duration-200 focus:outline-none focus:ring-4 focus:ring-blue-100 motion-reduce:transition-none ${state}`);
  });

  const navigation = () => {
    root.querySelector('[data-clear-answer]')?.remove();
    const previous = root.querySelector('[data-previous]');
    const next = root.querySelector('[data-next]');
    const flag = root.querySelector('[data-flag]');
    if (previous) {
      cls(previous, secondary);
      setControl(previous, 'Previous', icons.previous);
    }
    if (next) {
      cls(next, primary);
      setControl(next, 'Next', icons.next, true);
    }
    if (flag) {
      const flagged = flag.getAttribute('aria-pressed') === 'true';
      cls(flag, quiet);
      setControl(flag, flagged ? 'Flagged' : 'Flag for review', icons.flag);
    }
    root.querySelectorAll('[data-review]').forEach((button) => {
      cls(button, `${secondary} w-full`);
      setControl(button, 'Review examination', icons.review);
    });
    const mapToggle = root.querySelector('[data-toggle-map]');
    if (mapToggle) {
      cls(mapToggle, secondary);
      mapToggle.textContent = 'Question navigator';
    }
  };

  const progress = () => {
    const article = root.querySelector('article');
    const mapButtons = [...root.querySelectorAll('#question-map [data-go]')];
    if (!article || !mapButtons.length) return;
    const total = mapButtons.length;
    const answered = mapButtons.filter((button) => button.dataset.status === 'answered').length;
    const incomplete = mapButtons.filter((button) => button.dataset.status === 'incomplete').length;
    const existing = root.querySelector('[data-exam-progress]');
    const segments = mapButtons.map((button) => `<span class="h-full flex-1 ${button.dataset.status === 'answered' ? 'bg-blue-700' : button.dataset.status === 'incomplete' ? 'bg-amber-400' : 'bg-gray-200'}" aria-hidden="true"></span>`).join('');
    const markup = `<section data-exam-progress class="mb-4 rounded-xl border border-gray-200 bg-white p-4 shadow-sm" aria-label="Examination progress"><div class="mb-2 flex items-center justify-between gap-4"><div><p class="text-sm font-semibold text-gray-900">Paper progress</p><p class="text-xs text-gray-500">${answered} of ${total} answered${incomplete ? ` · ${incomplete} incomplete` : ''}</p></div><span class="text-sm font-semibold text-blue-700">${Math.round((answered / total) * 100)}%</span></div><div role="progressbar" aria-valuemin="0" aria-valuemax="${total}" aria-valuenow="${answered}" aria-label="${answered} of ${total} questions answered" class="flex h-2 w-full overflow-hidden rounded-full bg-gray-200">${segments}</div></section>`;
    if (existing) existing.outerHTML = markup;
    else article.parentElement?.insertAdjacentHTML('afterbegin', markup);
  };

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
    const prompt = article?.querySelector('h1');
    if (prompt) cls(prompt, 'max-w-4xl font-display text-xl font-bold leading-8 text-gray-950 sm:text-2xl sm:leading-9');
    cls(root.querySelector('#exam-timer-box'), 'rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-right text-gray-900');
    const integrity = root.querySelector('#integrity-pill');
    cls(integrity, badge);
    if (integrity && !integrity.dataset.flowbiteIcon) {
      integrity.insertAdjacentHTML('afterbegin', icon(icons.shield));
      integrity.dataset.flowbiteIcon = 'true';
    }
    cls(root.querySelector('#question-map > div'), `sticky top-24 p-5 ${card}`);
    const drawer = root.querySelector('#question-map-drawer');
    cls(drawer, 'fixed inset-0 z-50 bg-gray-900/50 p-4 backdrop-blur-sm lg:hidden', true);
    cls(drawer?.firstElementChild, 'ml-auto flex h-full w-full max-w-sm flex-col rounded-xl bg-white p-5 text-gray-900 shadow-xl');
    choices();
    questionMap();
    navigation();
    progress();
  };

  const review = () => {
    const submit = root.querySelector('[data-submit]');
    if (!submit) return;
    const main = submit.closest('main');
    cls(main, 'min-h-dvh bg-gray-50');
    cls(main?.querySelector('header'), 'border-b border-gray-200 bg-white');
    const section = main?.querySelector('section');
    cls(section, `overflow-hidden ${card}`);
    const heading = section?.querySelector('h1');
    if (heading) cls(heading, 'mt-3 max-w-3xl font-display text-2xl font-bold leading-9 text-gray-950 sm:text-3xl');
    root.querySelectorAll('[data-go-review]').forEach((button) => cls(button, 'relative min-h-11 rounded-lg border border-gray-200 bg-white px-2 text-sm font-semibold text-gray-700 transition-colors duration-200 hover:bg-gray-50 focus:outline-none focus:ring-4 focus:ring-blue-100 motion-reduce:transition-none'));
    const back = root.querySelector('[data-back-exam]');
    if (back) {
      cls(back, secondary);
      setControl(back, 'Back to questions', icons.previous);
    }
    cls(submit, primary);
    setControl(submit, 'Submit examination', icons.review);
  };

  const overlays = () => {
    root.querySelectorAll('.modal-shell').forEach((el) => cls(el, 'fixed inset-0 z-[100] grid place-items-center bg-gray-900/50 p-4 backdrop-blur-sm', true));
    const gate = root.querySelector('#camera-gate');
    cls(gate, 'rounded-xl border border-blue-200 bg-blue-50 p-5');
    cls(gate?.querySelector('[data-start]'), primary);
  };

  let observer;
  const observe = () => observer?.observe(root, { childList: true, subtree: true, attributes: true, attributeFilter: ['class', 'aria-current', 'checked', 'data-urgent', 'aria-pressed'] });
  const enhance = () => {
    observer?.disconnect();
    try {
      common();
      auth();
      briefing();
      exam();
      review();
      overlays();
      window.initFlowbite?.();
    } finally {
      observe();
    }
  };
  let pending = false;
  const schedule = () => {
    if (pending) return;
    pending = true;
    requestAnimationFrame(() => {
      pending = false;
      enhance();
    });
  };

  observer = new MutationObserver(schedule);
  observe();
  root.addEventListener('change', schedule, true);
  root.addEventListener('click', schedule, true);
  schedule();
})();
