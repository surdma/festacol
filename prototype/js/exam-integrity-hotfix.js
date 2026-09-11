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

  // If a mobile browser discarded a backgrounded page without a normal unload, charge that
  // background interval to the same attempt before student-app restores it.
  const startupReconciliation = reconcilePersistedBackground();

  const showBackgroundNotice = () => {
    if (!startupReconciliation.reconciled || document.querySelector('[data-background-time-note]')) return;
    const note = document.createElement('div');
    note.dataset.backgroundTimeNote = 'true';
    note.className = 'fixed left-1/2 top-4 z-[90] w-[min(92vw,560px)] -translate-x-1/2 rounded-2xl border border-amber-200 bg-amber-50 p-4 shadow-xl';
    note.innerHTML = `<strong class="block text-sm text-amber-950">Background time counted</strong><span class="mt-1 block text-xs leading-5 text-amber-800">${Math.max(1, Math.round(startupReconciliation.elapsedSeconds))} seconds were deducted because this exam was backgrounded/minimized rather than intentionally exited.</span>`;
    document.body.append(note);
    setTimeout(() => note.remove(), 5000);
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
    panel.className = 'fixed bottom-4 right-4 z-[85] w-52 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl sm:w-60';
    panel.innerHTML = '<div class="relative aspect-video bg-slate-950"><video data-camera-video class="h-full w-full object-cover" autoplay muted playsinline aria-label="Candidate camera preview"></video><span class="absolute left-2 top-2 rounded-full bg-emerald-500 px-2 py-1 text-[10px] font-extrabold uppercase tracking-wide text-white">Camera active</span></div><p class="p-3 text-[11px] leading-4 text-slate-600"><strong class="text-slate-900">Local proctoring preview.</strong> This prototype does not record, transmit, or automatically analyse your video.</p>';
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
      overlay.className = 'fixed inset-0 z-[100] grid place-items-center bg-slate-950/60 p-4 backdrop-blur-sm';
      document.body.append(overlay);
    }
    overlay.innerHTML = `<section class="w-full max-w-lg rounded-3xl bg-white p-6 shadow-2xl" role="dialog" aria-modal="true" aria-labelledby="camera-gate-title"><span class="badge badge-warning">Camera required</span><h2 id="camera-gate-title" class="mt-3 font-display text-2xl font-extrabold text-slate-950">Enable your camera to continue</h2><p class="mt-2 text-sm leading-6 text-slate-600">${message}</p><div class="alert alert-info mt-4"><strong>Privacy in this prototype</strong><span>The camera is displayed only as a live local preview. Festacol does not record, upload, store, or automatically analyse the video in this prototype.</span></div><button class="btn btn-primary mt-5 w-full" data-camera-retry>Enable camera</button></section>`;
    overlay.querySelector('[data-camera-retry]')?.addEventListener('click', () => requestCamera().catch(() => {}), { once: true });
  };

  const requestCamera = async () => {
    if (!cameraRequired || cameraReady) return true;
    if (cameraRequest) return cameraRequest;
    cameraRequest = (async () => {
      if (!navigator.mediaDevices?.getUserMedia) {
        cameraErrorOverlay('This browser does not expose camera access. Use a supported browser or ask the administrator for a non-camera exam session.');
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
        cameraErrorOverlay(error?.name === 'NotAllowedError' ? 'Camera permission was denied. This exam cannot start or resume until permission is granted.' : 'The camera could not be opened. Check the device camera and try again.');
        return false;
      } finally {
        cameraRequest = null;
      }
    })();
    return cameraRequest;
  };

  const guardStartedExam = () => {
    if (!cameraRequired || cameraReady || !document.querySelector('#exam-timer')) return;
    cameraErrorOverlay('This exam requires an active camera. The examination timer continues while this prompt is open.');
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
      // Same-document tab/minimize resumes are already charged by student-app's Date.now delta.
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
