'use strict';
  const toast = (message, kind = 'info') => {
    const stack = document.getElementById('toast-stack');
    const item = document.createElement('div');
    item.className = 'toast';
    item.innerHTML = `<span class="toast-icon">${kind === 'success' ? '✓' : kind === 'danger' ? '!' : 'i'}</span><div class="min-w-0 flex-1"><strong class="block text-sm text-slate-900">${kind === 'danger' ? 'Action needed' : kind === 'success' ? 'Updated' : 'Festacol'}</strong><p class="mt-1 text-xs leading-5 text-slate-600">${e(message)}</p></div><button class="icon-btn size-8 border-0" data-toast-close aria-label="Dismiss notification">${ICON.close}</button>`;
    stack.append(item);
    window.setTimeout(() => item.remove(), 4300);
  };
  const announce = (message, kind = 'info') => {
    alertHost.className = 'mx-auto max-w-[1540px] px-4 pt-4 sm:px-6 lg:px-7';
    alertHost.innerHTML = `<div class="alert alert-${kind}"><strong>${kind === 'danger' ? 'Check this:' : 'Update:'}</strong><span>${e(message)}</span><button class="ml-auto font-bold underline underline-offset-4" data-alert-close>Dismiss</button></div>`;
  };

  const openModal = (content) => {
    lastFocus = document.activeElement;
    modalContent.innerHTML = content;
    modal.dataset.open = 'true';
    modal.setAttribute('aria-hidden', 'false');
    window.setTimeout(() => modal.querySelector('button, input, select, textarea, [href]')?.focus(), 20);
  };
  const closeModal = (preserveUrl = false) => {
    modal.dataset.open = 'false';
    modal.setAttribute('aria-hidden', 'true');
    modalContent.innerHTML = '';
    if (!preserveUrl && p().get('modal')) {
      const extras = Object.fromEntries([...p().entries()].filter(([key]) => key !== 'page' && key !== 'modal' && key !== 'step' && key !== 'edit'));
      history.pushState({}, '', href(currentPage(), extras));
    }
    lastFocus?.focus?.();
  };
  const openDrawer = (content) => {
    lastFocus = document.activeElement;
    drawerContent.innerHTML = content;
    drawer.dataset.open = 'true';
    drawer.setAttribute('aria-hidden', 'false');
    drawerScrim.dataset.open = 'true';
    window.setTimeout(() => drawer.querySelector('button, [href], input')?.focus(), 20);
  };
  const closeDrawer = () => {
    drawer.dataset.open = 'false';
    drawer.setAttribute('aria-hidden', 'true');
    drawerScrim.dataset.open = 'false';
    drawerContent.innerHTML = '';
    const extras = Object.fromEntries([...p().entries()].filter(([key]) => !['page', 'detail', 'id'].includes(key)));
    if (p().get('detail')) history.pushState({}, '', href(currentPage(), extras));
    lastFocus?.focus?.();
  };

  const chrome = (page) => {
    breadcrumb.textContent = ROUTES[page][1];
    pageLabel.textContent = ROUTES[page][0];
    document.querySelectorAll('[data-admin-route]').forEach((link) => link.dataset.adminRoute === page ? link.setAttribute('aria-current', 'page') : link.removeAttribute('aria-current'));
  };

  const kpi = (label, value, detail, tone = 'brand', icon = ICON.book) => `<article class="kpi-card" style="--kpi-soft:var(--fc-${tone === 'brand' ? 'brand' : tone}-soft);--kpi-color:var(--fc-${tone === 'brand' ? 'brand' : tone})"><div class="flex items-start justify-between gap-3"><div><p class="eyebrow">${e(label)}</p><strong class="metric mt-3 block text-slate-950">${e(value)}</strong></div><span class="kpi-icon">${icon}</span></div><p class="mt-3 text-xs font-semibold text-slate-500">${e(detail)}</p></article>`;

