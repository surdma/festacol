(() => {
  'use strict';

  const Store = window.FestacolSessionStore;
  const Policy = window.FestacolProctorPolicy;
  if (!Store || !Policy) throw new Error('Festacol examination integrity dependencies are unavailable.');

  const params = new URL(location.href).searchParams;
  const token = params.get('session');
  let session = null;
  try { session = Store.decodeSession(token); } catch { session = null; }
  if (!session?.id) return;

  const icon = (path, className = 'h-5 w-5 shrink-0') => `<svg class="${className}" aria-hidden="true" viewBox="0 0 24 24" fill="none"><path stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="${path}"/></svg>`;
  const icons = Object.freeze({
    camera: 'M14.5 10.5 18 8v8l-3.5-2.5m-8.5-7h7.5A1.5 1.5 0 0 1 15 8v8a1.5 1.5 0 0 1-1.5 1.5H6A1.5 1.5 0 0 1 4.5 16V8A1.5 1.5 0 0 1 6 6.5Z',
    close: 'M6 18 17.94 6M18 18 6.06 6',
    info: 'M12 17v-6m0-4h.01M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z',
    warning: 'M12 9v4m0 4h.01M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0Z'
  });
  const primary = 'inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-lg bg-gray-900 px-5 py-2.5 text-sm font-semibold text-white transition-colors duration-200 hover:bg-gray-800 focus:outline-none focus:ring-4 focus:ring-gray-300 disabled:cursor-not-allowed disabled:opacity-50 motion-reduce:transition-none';

  const candidateHash = () => Store.getActiveCandidate(session.id);
  const markerKey = (hash = candidateHash()) => `festacol.exam.background-guard.v1:${session.id}:${hash || 'anonymous'}`;
  const cameraRequired = Policy.rememberFromUrl(session.id, location.href).cameraRequired;
  let cameraStream = null;
  let cameraReady = false;
  let cameraRequest = null;
  let unloadingAt = 0;
  let scheduled = false;

  const readMarker = (hash = candidateHash()) => {
    try { return JSON.parse(localStorage.getItem(markerKey(hash)) || 'null'); } catch { return null; }
  };
  const writeMarker = (value, hash = candidateHash()) => {
    if (!hash) return;
    localStorage.setItem(markerKey(hash), JSON.stringify(value));
  };
  const clearMarker = (hash = candidateHash()) => { if (hash) localStorage.removeItem(markerKey(hash)); };

  const reconcilePersistedBackground = () => {
    const hash = candidateHash();
    if (!hash) return { reconciled: false, elapsedSeconds: 0 };
    const marker = readMarker(hash);
    const state = Store.getStudentState(session.id, hash);
    if (!marker?.hiddenAt || !state?.startedAt || state.submittedAt || Number(marker.startedAt) !== Number(state.startedAt)) {
      clearMarker(hash);
      return { reconciled: false, elapsedSeconds: 0 };
    }
    if (marker.intentionalExitAt && Math.abs(Number(marker.intentionalExitAt) - Number(marker.pagehideAt || marker.intentionalExitAt)) < 3000) {
      clearMarker(hash);
      return { reconciled: false, elapsedSeconds: 0 };
    }
    const chargeFromAt = Number(marker.pagehideAt) || Number(marker.hiddenAt);
    const elapsedSeconds = Math.max(0, (Date.now() - chargeFromAt) / 1000);
    state.remainingSeconds = Math.max(0, (Number(state.remainingSeconds) || 0) - elapsedSeconds);
    state.elapsedActiveSeconds = (Number(state.elapsedActiveSeconds) || 0) + elapsedSeconds;
    state.integrityEvents = Array.isArray(state.integrityEvents) ? state.integrityEvents : [];
    state.integrityEvents.push({ type: 'background-resume-reconciled', detail: `${Math.round(elapsedSeconds)}s counted while backgrounded`, at: Date.now() });
    state.integrityEvents = state.integrityEvents.slice(-100);
    Store.saveStudentState(session.id, hash, state);
    clearMarker(hash);
    return { reconciled: true, elapsedSeconds };
  };

  const startupReconciliation = reconcilePersistedBackground();

  const showBackgroundNotice = () => {
    if (!startupReconciliation.reconciled || document.querySelector('[data-background-time-note]')) return;
    const note = document.createElement('div');
    note.dataset.backgroundTimeNote = 'true';
    note.id = 'background-time-note';
    note.setAttribute('role', 'alert');
    note.className = 'fixed left-1/2 top-4 z-[90] flex w-[min(92vw,36rem)] -translate-x-1/2 items-start gap-3 rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800 shadow-lg transition-opacity duration-200 motion-reduce:transition-none';
    note.innerHTML = `${icon(icons.warning)}<div class="min-w-0 flex-1"><span class="font-semibold">Background time counted</span><p class="mt-1 leading-6">${Math.max(1, Math.round(startupReconciliation.elapsedSeconds))} seconds were deducted because the examination was backgrounded or minimised rather than intentionally exited.</p></div><button type="button" class="-mx-1.5 -my-1.5 inline-flex h-8 w-8 items-center justify-center rounded-lg p-1.5 hover:bg-amber-100 focus:outline-none focus:ring-2 focus:ring-amber-400" data-dismiss-target="#background-time-note" aria-label="Dismiss background-time notice">${icon(icons.close, 'h-4 w-4')}<span class="sr-only">Dismiss</span></button>`;
    document.body.append(note);
    window.initFlowbite?.();
    setTimeout(() => {
      if (!note.isConnected) return;
      note.classList.add('opacity-0');
      setTimeout(() => note.remove(), 200);
    }, 7000);
  };

  const stopCamera = () => {
    cameraStream?.getTracks?.().forEach((track) => track.stop());
    cameraStream = null;
    cameraReady = false;
    document.querySelector('[data-camera-preview]')?.remove();
  };

  const ensurePreview = () => {
    if (!cameraStream || document.querySelector('[data-camera-preview]')) return;
    const panel = document.createElement('aside');
    panel.dataset.cameraPreview = 'true';
    panel.className = 'fixed bottom-4 right-4 z-[85] w-52 overflow-hidden rounded-xl border border-gray-200 bg-white shadow-lg sm:w-60';
    panel.innerHTML = `<div class="relative aspect-video bg-gray-950"><video data-camera-video class="h-full w-full object-cover" autoplay muted playsinline aria-label="Candidate camera preview"></video><span class="absolute left-2 top-2 inline-flex items-center gap-1 rounded-md bg-emerald-100 px-2 py-1 text-xs font-medium text-emerald-800">${icon(icons.camera, 'h-3.5 w-3.5')}Camera active</span></div><div class="p-3"><p class="text-xs font-semibold text-gray-900">Local proctoring preview</p><p class="mt-1 text-xs leading-5 text-gray-600">This prototype does not record, transmit, store, or automatically analyse your video.</p></div>`;
    document.body.append(panel);
    const video = panel.querySelector('[data-camera-video]');
    video.srcObject = cameraStream;
    video.play().catch(() => {});
  };

  const cameraErrorOverlay = (message) => {
    let overlay = document.querySelector('[data-camera-gate]');
    if (!overlay) {
      overlay = document.createElement('div');
      overlay.dataset.cameraGate = 'true';
      overlay.className = 'fixed inset-0 z-[110] grid place-items-center bg-gray-900/50 p-4 backdrop-blur-sm';
      document.body.append(overlay);
    }
    overlay.innerHTML = `<section class="w-full max-w-lg rounded-xl border border-gray-200 bg-white shadow-xl" role="dialog" aria-modal="true" aria-labelledby="camera-gate-title" aria-describedby="camera-gate-description" tabindex="-1"><div class="flex items-start gap-3 border-b border-gray-200 p-5"><span class="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-amber-100 text-amber-800">${icon(icons.camera)}</span><div><p class="text-sm font-medium text-amber-700">Camera required</p><h2 id="camera-gate-title" class="mt-1 font-display text-xl font-bold text-gray-950">Enable your camera to continue</h2></div></div><div class="space-y-4 p-5"><p id="camera-gate-description" class="text-sm leading-6 text-gray-600">${String(message || '')}</p><div class="flex items-start gap-3 rounded-lg border border-gray-200 bg-gray-50 p-4 text-sm text-gray-700" role="note">${icon(icons.info)}<div><span class="font-semibold text-gray-900">Privacy in this prototype</span><p class="mt-1 leading-6">The camera is displayed only as a live local preview. Festacol does not record, upload, store, or automatically analyse the video.</p></div></div></div><div class="border-t border-gray-200 p-5"><button class="${primary}" data-camera-retry>${icon(icons.camera, 'h-4 w-4')}Enable camera</button></div></section>`;
    const dialog = overlay.querySelector('[role="dialog"]');
    queueMicrotask(() => dialog?.focus({ preventScroll: true }));
    overlay.querySelector('[data-camera-retry]')?.addEventListener('click', () => requestCamera().catch(() => {}), { once: true });
  };

  const requestCamera = async () => {
    if (!cameraRequired || cameraReady) return true;
    if (cameraRequest) return cameraRequest;
    cameraRequest = (async () => {
      if (!navigator.mediaDevices?.getUserMedia) {
        cameraErrorOverlay('This browser does not expose camera access. Use a supported browser or ask the administrator for a non-camera examination session.');
        return false;
      }
      try {
        cameraStream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' }, audio: false });
        cameraReady = true;
        document.querySelector('[data-camera-gate]')?.remove();
        ensurePreview();
        return true;
      } catch (error) {
        cameraReady = false;
        cameraErrorOverlay(error?.name === 'NotAllowedError'
          ? 'Camera permission was denied. This examination cannot start or resume until permission is granted.'
          : 'The camera could not be opened. Check the device camera and try again.');
        return false;
      } finally {
        cameraRequest = null;
      }
    })();
    return cameraRequest;
  };

  const guardStartedExam = () => {
    if (!cameraRequired || cameraReady || !document.querySelector('#exam-timer')) return;
    cameraErrorOverlay('This examination requires an active camera. The examination timer continues while this prompt is open.');
  };

  document.addEventListener('click', async (event) => {
    const start = event.target.closest?.('[data-start]');
    if (!start || !cameraRequired || cameraReady) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    const granted = await requestCamera();
    if (granted) start.click();
  }, true);

  document.addEventListener('visibilitychange', () => {
    const hash = candidateHash();
    const state = hash ? Store.getStudentState(session.id, hash) : null;
    if (!state?.startedAt || state.submittedAt) return;
    if (document.hidden) {
      writeMarker({ sessionId: session.id, candidateHash: hash, startedAt: state.startedAt, hiddenAt: Date.now(), intentionalExitAt: 0, pagehideAt: 0 }, hash);
    } else {
      clearMarker(hash);
    }
  }, true);

  window.addEventListener('beforeunload', () => {
    unloadingAt = Date.now();
    const hash = candidateHash();
    const marker = readMarker(hash);
    if (marker) writeMarker({ ...marker, intentionalExitAt: unloadingAt }, hash);
  }, true);

  window.addEventListener('pagehide', (event) => {
    const hash = candidateHash();
    const marker = readMarker(hash);
    if (!marker) { stopCamera(); return; }
    const pagehideAt = Date.now();
    if (event.persisted || (unloadingAt && pagehideAt - unloadingAt < 3000)) clearMarker(hash);
    else writeMarker({ ...marker, pagehideAt }, hash);
    stopCamera();
  }, true);

  window.addEventListener('pageshow', (event) => {
    if (event.persisted) clearMarker(candidateHash());
  }, true);

  const schedule = () => {
    if (scheduled) return;
    scheduled = true;
    queueMicrotask(() => {
      scheduled = false;
      showBackgroundNotice();
      guardStartedExam();
      if (cameraReady) ensurePreview();
      const app = document.getElementById('app');
      if (cameraReady && app && /Examination submitted|Attempt locked/i.test(app.textContent || '')) stopCamera();
    });
  };

  new MutationObserver(schedule).observe(document.body, { childList: true, subtree: true });
  schedule();

  window.FestacolExamIntegrityHotfix = Object.freeze({
    cameraRequired,
    requestCamera,
    reconcilePersistedBackground,
    getMarker: () => readMarker(candidateHash())
  });
})();
