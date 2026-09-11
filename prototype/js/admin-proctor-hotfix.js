(() => {
  'use strict';

  const Store = window.FestacolSessionStore;
  const Policy = window.FestacolProctorPolicy;
  if (!Store || !Policy) throw new Error('Festacol proctoring dependencies are unavailable.');

  let pendingCameraRequired = null;
  let scheduled = false;

  const currentStep = () => Number(new URL(location.href).searchParams.get('step')) || 1;
  const wizard = () => window.FestacolAcademicAdmin?.wizard || null;

  const cameraRow = (checked) => {
    const label = document.createElement('label');
    label.className = 'control-row rounded-2xl border border-sky-200 bg-sky-50/70 px-4';
    label.dataset.proctorCameraRow = 'true';
    label.innerHTML = `<span class="min-w-0"><strong class="block text-sm text-slate-900">Require candidate camera</strong><small class="mt-1 block max-w-xl text-xs leading-5 text-slate-600">Off by default. When enabled, candidates must grant camera access before starting. The prototype shows a local live preview only; it does not record, transmit, or automatically analyse video.</small></span><input data-proctor-camera type="checkbox" class="h-5 w-5 rounded border-slate-300 text-blue-600 focus:ring-blue-500" ${checked ? 'checked' : ''} aria-label="Require candidate camera">`;
    return label;
  };

  const enhanceWizard = () => {
    const modal = document.getElementById('admin-modal-content');
    const w = wizard();
    if (!modal || !w) return;

    if (currentStep() === 4 && !modal.querySelector('[data-proctor-camera-row]')) {
      const grid = modal.querySelector('.mt-6 > .grid') || modal.querySelector('.grid.gap-4');
      if (grid) grid.insertBefore(cameraRow(Boolean(w.cameraRequired)), grid.lastElementChild || null);
    }

    if (currentStep() === 5 && !modal.querySelector('[data-proctor-review]')) {
      const summary = modal.querySelector('.surface-soft');
      if (summary) {
        const item = document.createElement('div');
        item.dataset.proctorReview = 'true';
        item.innerHTML = `<span class="eyebrow">Camera</span><strong class="mt-1 block">${w.cameraRequired ? 'Required' : 'Off'}</strong>`;
        const grid = summary.querySelector('.grid');
        if (grid) grid.append(item);
      }
    }
  };

  const decorateVisibleSessionLinks = () => {
    document.querySelectorAll('[data-session-link]').forEach((input) => {
      const raw = input.value;
      const sessionId = Policy.sessionIdFromLink(raw);
      if (!sessionId) return;

      if (pendingCameraRequired !== null) {
        Policy.setAdminPolicy(sessionId, { cameraRequired: pendingCameraRequired });
        pendingCameraRequired = null;
      }
      const required = Policy.getAdminPolicy(sessionId).cameraRequired;
      const decorated = Policy.decorateStudentLink(raw, required);
      if (input.value !== decorated) input.value = decorated;

      const drawer = input.closest('#admin-detail-content, #admin-modal-content') || document;
      drawer.querySelectorAll('a[href*="student.html"][href*="session="]').forEach((anchor) => {
        anchor.href = Policy.decorateStudentLink(anchor.href, required);
      });
      const qr = drawer.querySelector('#session-qr');
      if (qr && window.FestacolQR?.render) window.FestacolQR.render(qr, decorated);

      if (required && !drawer.querySelector('[data-camera-policy-note]')) {
        const note = document.createElement('div');
        note.dataset.cameraPolicyNote = 'true';
        note.className = 'alert alert-info mt-3';
        note.innerHTML = '<strong>Camera required</strong><span>Candidates must allow camera access to start or resume this exam. Video stays local in this prototype and is not recorded or analysed.</span>';
        input.parentElement?.insertAdjacentElement('afterend', note);
      }
    });
  };

  const scheduleEnhance = () => {
    if (scheduled) return;
    scheduled = true;
    queueMicrotask(() => {
      scheduled = false;
      enhanceWizard();
      decorateVisibleSessionLinks();
    });
  };

  document.addEventListener('change', (event) => {
    const camera = event.target.closest?.('[data-proctor-camera]');
    if (!camera) return;
    const w = wizard();
    pendingCameraRequired = camera.checked;
    if (w) w.cameraRequired = camera.checked;
  }, true);

  document.addEventListener('click', (event) => {
    const next = event.target.closest?.('[data-v3-next]');
    if (next && currentStep() === 5 && pendingCameraRequired === null) pendingCameraRequired = Boolean(wizard()?.cameraRequired);
    setTimeout(scheduleEnhance, 0);
  }, true);

  new MutationObserver(scheduleEnhance).observe(document.body, { childList: true, subtree: true });
  scheduleEnhance();
})();
