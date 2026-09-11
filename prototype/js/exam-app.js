(() => {
  'use strict';

  const Store = window.FestacolSessionStore;
  const Data = window.FestacolQuestionData;
  const Engine = window.FestacolAssessmentEngine;
  const Proctor = window.FestacolProctorPolicy;
  const root = document.getElementById('app');

  if (!Store || !Data || !Engine || !Proctor || !root) {
    throw new Error('Festacol examination dependencies are unavailable.');
  }

  const esc = (value) => String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');

  const icon = (path, cls = 'h-5 w-5 shrink-0') => `<svg class="${cls}" aria-hidden="true" viewBox="0 0 24 24" fill="none"><path stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="${path}"/></svg>`;
  const I = Object.freeze({
    arrowLeft: 'M19 12H5m0 0 6 6m-6-6 6-6',
    arrowRight: 'M5 12h14m0 0-6-6m6 6-6 6',
    camera: 'M14.5 10.5 18 8v8l-3.5-2.5m-8.5-7h7.5A1.5 1.5 0 0 1 15 8v8a1.5 1.5 0 0 1-1.5 1.5H6A1.5 1.5 0 0 1 4.5 16V8A1.5 1.5 0 0 1 6 6.5Z',
    check: 'm9 12 2 2 4-4M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Z',
    clock: 'M12 7v5l3 2m6-2a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z',
    close: 'M6 18 18 6M6 6l12 12',
    flag: 'M5 14v7M5 4.971v9.541c5.6-5.538 8.4 2.64 14-.086v-9.54C13.4 7.61 10.6-.568 5 4.97Z',
    fullscreen: 'M8 3H5a2 2 0 0 0-2 2v3m13-5h3a2 2 0 0 1 2 2v3M8 21H5a2 2 0 0 1-2-2v-3m13 5h3a2 2 0 0 0 2-2v-3',
    info: 'M12 17v-6m0-4h.01M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z',
    list: 'M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01',
    lock: 'M8 10V7a4 4 0 0 1 8 0v3m-9 0h10a2 2 0 0 1 2 2v7H5v-7a2 2 0 0 1 2-2Z',
    review: 'M15 4h3a1 1 0 0 1 1 1v15a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1h3m0 3h6m-6 7 2 2 4-4m-5-9v4h4V3h-4Z',
    shield: 'M9.5 11.5 11 13l4-3.5M12 20a16.405 16.405 0 0 1-5.092-5.804A16.694 16.694 0 0 1 5 6.666L12 4l7 2.667a16.695 16.695 0 0 1-1.908 7.529A16.406 16.406 0 0 1 12 20Z',
    warning: 'M12 9v4m0 4h.01M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0Z'
  });

  const C = Object.freeze({
    primary: 'inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-black px-5 py-2.5 text-sm font-semibold text-white transition-colors duration-150 hover:bg-neutral-800 focus:outline-none focus:ring-4 focus:ring-neutral-300 disabled:cursor-not-allowed disabled:opacity-40 motion-reduce:transition-none',
    secondary: 'inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border border-neutral-300 bg-white px-5 py-2.5 text-sm font-semibold text-neutral-950 transition-colors duration-150 hover:bg-neutral-100 focus:outline-none focus:ring-4 focus:ring-neutral-200 disabled:cursor-not-allowed disabled:opacity-40 motion-reduce:transition-none',
    quiet: 'inline-flex min-h-11 items-center justify-center gap-2 rounded-lg px-3 py-2.5 text-sm font-semibold text-neutral-700 transition-colors duration-150 hover:bg-neutral-100 hover:text-neutral-950 focus:outline-none focus:ring-4 focus:ring-neutral-200 motion-reduce:transition-none',
    field: 'block min-h-11 w-full rounded-lg border border-neutral-300 bg-white p-2.5 text-base text-neutral-950 placeholder:text-neutral-400 focus:border-black focus:ring-black',
    card: 'rounded-2xl border border-neutral-200 bg-white shadow-sm'
  });

  const params = new URL(location.href).searchParams;
  const token = params.get('session');
  let session = null;
  let data = null;
  let paper = [];
  let profile = null;
  let candidateHash = '';
  let state = null;
  let timer = null;
  let lastTick = Date.now();
  let cameraRequired = false;
  let cameraStream = null;
  let cameraReady = false;
  let cameraRequest = null;
  let timeoutSubmitting = false;
  let lastIntegrityEvent = { type: '', at: 0 };

  const portalHref = (page = 'home') => `./student.html?page=${encodeURIComponent(page)}`;
  const afterRender = () => queueMicrotask(() => window.initFlowbite?.());
  const resolveCurrentSession = () => {
    if (!session) return null;
    session = Store.resolveSession(session) || session;
    return session;
  };
  const effectiveStatus = () => {
    const current = resolveCurrentSession();
    if (!current) return 'missing';
    if (current.status !== 'open') return current.status;
    if (current.startsAt && Date.now() < Number(current.startsAt)) return 'scheduled';
    if (current.endsAt && Date.now() >= Number(current.endsAt)) return 'closed';
    return 'open';
  };
  const formatTime = (seconds) => {
    const n = Math.max(0, Math.ceil(Number(seconds) || 0));
    const h = Math.floor(n / 3600);
    const m = Math.floor((n % 3600) / 60);
    const s = n % 60;
    return h ? `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}` : `${m}:${String(s).padStart(2, '0')}`;
  };
  const formatDuration = (seconds) => Store.durationLabel?.(seconds) || `${Math.ceil(Number(seconds || 0) / 60)} minutes`;
  const pageBrand = (compact = false) => `<a href="${portalHref()}" class="inline-flex min-w-0 items-center gap-3 rounded-lg focus:outline-none focus:ring-4 focus:ring-neutral-200"><span class="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-black font-display text-sm font-extrabold text-white">F</span>${compact ? '' : '<span class="min-w-0"><strong class="block truncate text-sm font-semibold text-neutral-950">Festacol</strong><span class="block truncate text-xs text-neutral-500">Student examination</span></span>'}</a>`;

  const alertMarkup = (tone, title, detail, id = '') => {
    const toneClass = tone === 'danger'
      ? 'border-red-200 bg-red-50 text-red-900'
      : tone === 'warning'
        ? 'border-amber-200 bg-amber-50 text-amber-900'
        : tone === 'success'
          ? 'border-emerald-200 bg-emerald-50 text-emerald-900'
          : 'border-neutral-200 bg-neutral-50 text-neutral-800';
    const symbol = tone === 'danger' || tone === 'warning' ? I.warning : tone === 'success' ? I.check : I.info;
    return `<div ${id ? `id="${id}"` : ''} class="flex items-start gap-3 rounded-xl border p-4 text-sm ${toneClass}" role="${tone === 'danger' || tone === 'warning' ? 'alert' : 'status'}">${icon(symbol)}<div class="min-w-0"><strong class="font-semibold">${esc(title)}</strong><p class="mt-1 leading-6">${esc(detail)}</p></div></div>`;
  };

  const stopTimer = () => {
    if (timer) clearInterval(timer);
    timer = null;
  };

  const stopCamera = () => {
    cameraStream?.getTracks?.().forEach((track) => track.stop());
    cameraStream = null;
    cameraReady = false;
    document.querySelector('[data-camera-preview]')?.remove();
  };

  const fatal = (eyebrow, title, detail, action = '') => {
    stopTimer();
    stopCamera();
    root.innerHTML = `<main class="min-h-dvh bg-neutral-100 p-4 sm:p-7"><div class="mx-auto grid min-h-[calc(100dvh-2rem)] max-w-5xl overflow-hidden rounded-3xl border border-neutral-200 bg-white shadow-sm sm:min-h-[calc(100dvh-3.5rem)] lg:grid-cols-[.78fr_1.22fr]"><section class="flex flex-col justify-between border-b border-neutral-200 bg-black p-7 text-white sm:p-9 lg:border-b-0 lg:border-r"><div>${pageBrand(true)}</div><div class="mt-16"><p class="text-xs font-semibold uppercase tracking-[.16em] text-neutral-500">${esc(eyebrow)}</p><p class="mt-3 max-w-sm text-sm leading-6 text-neutral-400">Secure computer-based examination workspace.</p></div></section><section class="flex items-center p-7 sm:p-10"><div class="w-full max-w-xl"><h1 class="font-display text-3xl font-extrabold tracking-tight text-neutral-950">${esc(title)}</h1><p class="mt-4 text-sm leading-7 text-neutral-600">${esc(detail)}</p>${action ? `<div class="mt-7">${action}</div>` : ''}</div></section></div></main>`;
    afterRender();
  };

  const hydrateExistingAuth = async () => {
    profile = Store.getStudentProfile();
    if (!profile?.studentHash || Store.getStudentAuth() !== profile.studentHash) return false;
    const active = Store.getActiveCandidate(session.id);
    const resetAt = Store.getAttemptResetAt(session.id, active);
    if (resetAt && resetAt > Number(profile.updatedAt || 0)) {
      Store.clearStudentAuth();
      Store.clearActiveCandidate(session.id);
      return false;
    }
    candidateHash = active;
    if (!candidateHash && profile.firstName && profile.lastName) {
      candidateHash = await Engine.candidateHash(session.id, profile.firstName, profile.lastName);
      Store.setActiveCandidate(session.id, candidateHash);
    }
    return Boolean(candidateHash);
  };

  const authenticate = async (firstName, lastName) => {
    const credentials = Engine.candidateCredentials(firstName, lastName);
    const studentHash = await Engine.studentHash(credentials.firstName, credentials.lastName);
    candidateHash = await Engine.candidateHash(session.id, credentials.firstName, credentials.lastName);
    const existing = Store.getStudentState(session.id, candidateHash);
    profile = Store.saveStudentProfile({
      ...credentials,
      studentHash,
      candidateHash,
      currentClassId: existing?.classGroup || session.classGroup,
      academicSession: session.academicSession
    });
    Store.setStudentAuth(studentHash);
    Store.setActiveCandidate(session.id, candidateHash);
    return profile;
  };

  const authView = (message = '') => {
    root.innerHTML = `<main class="min-h-dvh bg-neutral-100 p-4 sm:p-7"><div class="mx-auto grid min-h-[calc(100dvh-2rem)] max-w-6xl overflow-hidden rounded-3xl border border-neutral-200 bg-white shadow-sm sm:min-h-[calc(100dvh-3.5rem)] lg:grid-cols-[minmax(0,1fr)_minmax(420px,.82fr)]"><section class="flex flex-col justify-between bg-black p-7 text-white sm:p-10"><div class="flex items-center gap-3"><span class="grid h-10 w-10 place-items-center rounded-xl bg-white text-sm font-black text-black">F</span><div><strong class="block font-display text-sm font-extrabold">Festacol</strong><span class="text-xs text-neutral-400">Student examination</span></div></div><div class="py-14"><span class="inline-flex rounded-full border border-neutral-700 px-3 py-1 text-xs font-semibold text-neutral-300">Direct examination access</span><h1 class="mt-5 max-w-xl font-display text-4xl font-extrabold leading-tight tracking-tight sm:text-5xl">${esc(session.title)}</h1><p class="mt-5 max-w-lg text-sm leading-7 text-neutral-400">Authenticate with the candidate credentials assigned by the school. Your exact paper, timer and attempt state are tied to this examination link.</p></div><span class="text-xs text-neutral-600">${esc(session.classLevel)} · ${esc(Store.getModeLabel(session.mode))}</span></section><section class="flex items-center p-7 sm:p-10"><form id="student-login-form" class="mx-auto w-full max-w-lg space-y-5" novalidate><div><p class="text-xs font-semibold uppercase tracking-[.14em] text-neutral-500">Candidate sign in</p><h2 class="mt-2 font-display text-2xl font-extrabold tracking-tight text-neutral-950">Enter your assigned details.</h2></div>${message ? alertMarkup('danger', 'Sign-in unsuccessful', message, 'login-error') : ''}<div><label for="student-first-name" class="mb-2 block text-sm font-semibold text-neutral-900">First name <span class="font-normal text-neutral-500">· username</span></label><input id="student-first-name" name="firstName" class="${C.field}" autocomplete="given-name" required></div><div><label for="student-last-name" class="mb-2 block text-sm font-semibold text-neutral-900">Last name <span class="font-normal text-neutral-500">· password</span></label><input id="student-last-name" name="lastName" type="password" class="${C.field}" autocomplete="current-password" required></div><button type="submit" class="${C.primary} w-full">Continue to examination${icon(I.arrowRight, 'h-4 w-4')}</button><p class="text-center text-xs leading-5 text-neutral-500">Use only the identity assigned to you. One submitted attempt is final.</p></form></section></div></main>`;
    const form = root.querySelector('#student-login-form');
    form?.addEventListener('submit', async (event) => {
      event.preventDefault();
      const button = form.querySelector('button[type="submit"]');
      button.disabled = true;
      button.setAttribute('aria-busy', 'true');
      try {
        const formData = new FormData(form);
        await authenticate(formData.get('firstName'), formData.get('lastName'));
        await enterAuthenticatedFlow();
      } catch (error) {
        authView(error?.message || 'Unable to sign in with those credentials.');
      }
    });
    afterRender();
  };

  const markerKey = (hash = candidateHash || Store.getActiveCandidate(session?.id)) => `festacol.exam.background-guard.v2:${session?.id || 'unknown'}:${hash || 'anonymous'}`;
  const readMarker = (hash = candidateHash) => {
    try { return JSON.parse(localStorage.getItem(markerKey(hash)) || 'null'); } catch { return null; }
  };
  const writeMarker = (value, hash = candidateHash) => {
    if (!hash || !session?.id) return;
    localStorage.setItem(markerKey(hash), JSON.stringify(value));
  };
  const clearMarker = (hash = candidateHash) => {
    if (hash && session?.id) localStorage.removeItem(markerKey(hash));
  };

  const seriousIntegrityCount = () => (state?.integrityEvents || []).filter((item) => ![
    'focus-return', 'fullscreen-enter', 'camera-restored', 'background-resume-reconciled'
  ].includes(item.type)).length;

  const updateChrome = () => {
    const timerText = document.getElementById('exam-timer');
    const timerBox = document.getElementById('exam-timer-box');
    const count = root.querySelector('[data-integrity-count]');
    const camera = root.querySelector('[data-camera-status]');
    if (timerText) timerText.textContent = formatTime(state?.remainingSeconds);
    if (timerBox) {
      const remaining = Number(state?.remainingSeconds) || 0;
      timerBox.className = remaining <= 60
        ? 'rounded-xl border border-red-300 bg-red-50 px-3 py-2 text-right text-red-900 motion-safe:animate-pulse'
        : remaining <= 300
          ? 'rounded-xl border border-amber-300 bg-amber-50 px-3 py-2 text-right text-amber-900'
          : 'rounded-xl border border-neutral-200 bg-neutral-50 px-3 py-2 text-right text-neutral-950';
    }
    if (count) count.textContent = `${seriousIntegrityCount()}`;
    if (camera) camera.textContent = cameraReady ? 'Camera on' : 'Camera required';
  };

  const showToast = (tone, title, detail, duration = 6500) => {
    document.querySelector('[data-exam-toast]')?.remove();
    const node = document.createElement('div');
    node.dataset.examToast = 'true';
    node.id = 'exam-toast';
    node.className = 'fixed left-1/2 top-4 z-[120] w-[min(92vw,38rem)] -translate-x-1/2 rounded-xl border bg-white p-4 shadow-xl';
    node.innerHTML = `${alertMarkup(tone, title, detail).replace('rounded-xl border', 'border-0')}<button type="button" class="absolute right-2 top-2 inline-flex h-9 w-9 items-center justify-center rounded-lg text-neutral-500 hover:bg-neutral-100 focus:outline-none focus:ring-4 focus:ring-neutral-200" aria-label="Dismiss notification" data-toast-close>${icon(I.close, 'h-4 w-4')}</button>`;
    document.body.append(node);
    node.querySelector('[data-toast-close]')?.addEventListener('click', () => node.remove());
    setTimeout(() => node.remove(), duration);
  };

  const persist = () => {
    if (!state || state.submittedAt) return false;
    if (Store.isAttemptInvalidated(session.id, candidateHash, state.startedAt)) {
      showReset();
      return false;
    }
    state.lastActiveAt = Date.now();
    return Store.saveStudentState(session.id, candidateHash, state);
  };

  const recordIntegrity = (type, detail = '', { notify = true } = {}) => {
    if (!state?.startedAt || state.submittedAt) return;
    const now = Date.now();
    if (lastIntegrityEvent.type === type && now - lastIntegrityEvent.at < 750) return;
    lastIntegrityEvent = { type, at: now };
    state.integrityEvents ||= [];
    state.integrityEvents.push({ type, detail, at: now });
    state.integrityEvents = state.integrityEvents.slice(-100);
    persist();
    updateChrome();
    const threshold = Math.max(1, Number(session?.integrityPolicy?.warnAfter) || 2);
    const count = seriousIntegrityCount();
    if (notify && count >= threshold && ['tab-hidden', 'window-blur', 'fullscreen-exit', 'clipboard-copy', 'clipboard-cut', 'clipboard-paste', 'camera-ended'].includes(type)) {
      showToast('warning', 'Integrity warning recorded', `This examination has recorded ${count} integrity event${count === 1 ? '' : 's'}. Stay on the exam screen and follow the school rules.`);
    }
  };

  const reconcilePersistedBackground = () => {
    if (!candidateHash || !session?.id) return { reconciled: false, elapsedSeconds: 0 };
    const marker = readMarker(candidateHash);
    const saved = Store.getStudentState(session.id, candidateHash);
    if (!marker?.hiddenAt || !saved?.startedAt || saved.submittedAt || Number(marker.startedAt) !== Number(saved.startedAt)) {
      clearMarker(candidateHash);
      return { reconciled: false, elapsedSeconds: 0 };
    }
    const elapsedSeconds = Math.max(0, (Date.now() - Number(marker.hiddenAt)) / 1000);
    if (elapsedSeconds < 0.5) {
      clearMarker(candidateHash);
      return { reconciled: false, elapsedSeconds: 0 };
    }
    saved.remainingSeconds = Math.max(0, (Number(saved.remainingSeconds) || 0) - elapsedSeconds);
    saved.elapsedActiveSeconds = (Number(saved.elapsedActiveSeconds) || 0) + elapsedSeconds;
    saved.integrityEvents = Array.isArray(saved.integrityEvents) ? saved.integrityEvents : [];
    saved.integrityEvents.push({ type: 'background-resume-reconciled', detail: `${Math.round(elapsedSeconds)}s counted while away`, at: Date.now() });
    saved.integrityEvents = saved.integrityEvents.slice(-100);
    Store.saveStudentState(session.id, candidateHash, saved);
    state = saved;
    clearMarker(candidateHash);
    return { reconciled: true, elapsedSeconds };
  };

  const ensureCameraPreview = () => {
    if (!cameraReady || !cameraStream || document.querySelector('[data-camera-preview]')) return;
    const panel = document.createElement('aside');
    panel.dataset.cameraPreview = 'true';
    panel.className = 'fixed bottom-24 right-3 z-[70] w-40 overflow-hidden rounded-xl border border-neutral-200 bg-white shadow-xl sm:bottom-5 sm:right-5 sm:w-56';
    panel.innerHTML = `<div class="relative aspect-video bg-black"><video data-camera-video class="h-full w-full object-cover" autoplay muted playsinline aria-label="Candidate camera preview"></video><span class="absolute left-2 top-2 inline-flex items-center gap-1 rounded-md bg-white/90 px-2 py-1 text-[11px] font-semibold text-neutral-900">${icon(I.camera, 'h-3.5 w-3.5')}Live</span></div><div class="hidden p-3 sm:block"><p class="text-xs font-semibold text-neutral-950">Local camera preview</p><p class="mt-1 text-[11px] leading-4 text-neutral-500">Not recorded, uploaded or analysed by this prototype.</p></div>`;
    document.body.append(panel);
    const video = panel.querySelector('[data-camera-video]');
    video.srcObject = cameraStream;
    video.play().catch(() => {});
  };

  const cameraGate = (message, activeExam = Boolean(state?.startedAt && !state?.submittedAt)) => {
    let overlay = document.querySelector('[data-camera-gate]');
    if (!overlay) {
      overlay = document.createElement('div');
      overlay.dataset.cameraGate = 'true';
      overlay.className = 'fixed inset-0 z-[130] grid place-items-center bg-black/60 p-4 backdrop-blur-sm';
      document.body.append(overlay);
    }
    overlay.innerHTML = `<section class="w-full max-w-lg overflow-hidden rounded-2xl border border-neutral-200 bg-white shadow-2xl" role="dialog" aria-modal="true" aria-labelledby="camera-gate-title" aria-describedby="camera-gate-description" tabindex="-1"><div class="border-b border-neutral-200 bg-neutral-50 p-5"><span class="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-black text-white">${icon(I.camera)}</span><p class="mt-4 text-xs font-semibold uppercase tracking-[.14em] text-neutral-500">Camera required</p><h2 id="camera-gate-title" class="mt-1 font-display text-2xl font-extrabold text-neutral-950">${activeExam ? 'Restore camera access to continue.' : 'Enable your camera before starting.'}</h2></div><div class="space-y-4 p-5"><p id="camera-gate-description" class="text-sm leading-6 text-neutral-600">${esc(message)}</p>${alertMarkup('info', 'Privacy in this prototype', 'The video is shown only as a live local preview. It is not recorded, uploaded, stored or automatically analysed.')}</div><div class="border-t border-neutral-200 p-5"><button class="${C.primary} w-full" data-camera-retry>${icon(I.camera, 'h-4 w-4')}Enable camera</button></div></section>`;
    const dialog = overlay.querySelector('[role="dialog"]');
    queueMicrotask(() => dialog?.focus({ preventScroll: true }));
    overlay.querySelector('[data-camera-retry]')?.addEventListener('click', () => requestCamera().catch(() => {}), { once: true });
  };

  const requestCamera = async () => {
    if (!cameraRequired || cameraReady) return true;
    if (cameraRequest) return cameraRequest;
    cameraRequest = (async () => {
      if (!navigator.mediaDevices?.getUserMedia) {
        cameraGate('This browser does not provide camera access. Use a supported browser or ask the administrator for a non-camera session.');
        return false;
      }
      try {
        cameraStream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' }, audio: false });
        cameraReady = true;
        for (const track of cameraStream.getVideoTracks()) {
          track.addEventListener('ended', () => {
            if (!state?.submittedAt) {
              cameraReady = false;
              recordIntegrity('camera-ended', 'Camera stream ended during the examination.');
              document.querySelector('[data-camera-preview]')?.remove();
              cameraGate('The camera stream stopped. Restore camera access to continue the monitored examination.', true);
            }
          }, { once: true });
        }
        document.querySelector('[data-camera-gate]')?.remove();
        ensureCameraPreview();
        if (state?.startedAt && !state.submittedAt) recordIntegrity('camera-restored', 'Camera access active.', { notify: false });
        updateChrome();
        return true;
      } catch (error) {
        cameraReady = false;
        const denied = error?.name === 'NotAllowedError' || error?.name === 'SecurityError';
        cameraGate(denied
          ? 'Camera permission was denied. This examination cannot start or continue until permission is granted.'
          : 'The camera could not be opened. Check that another app is not using it, then try again.');
        return false;
      } finally {
        cameraRequest = null;
      }
    })();
    return cameraRequest;
  };

  const briefingView = () => {
    const subjects = (session.subjects || []).map((code) => Data.subjectByCode(data, code)?.label || code).join(', ') || Store.getModeLabel(session.mode);
    root.innerHTML = `<main class="min-h-dvh bg-neutral-100"><header class="border-b border-neutral-200 bg-white"><div class="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-4 sm:px-6">${pageBrand()}<span class="rounded-full border border-neutral-200 bg-neutral-50 px-3 py-1 text-xs font-semibold text-neutral-600">Attempt 1 of 1</span></div></header><div class="mx-auto max-w-5xl p-4 sm:p-6 lg:p-8"><section class="overflow-hidden ${C.card}"><div class="grid lg:grid-cols-[minmax(0,1fr)_18rem]"><div class="p-6 sm:p-8 lg:p-10"><p class="text-xs font-semibold uppercase tracking-[.14em] text-neutral-500">Before you begin</p><h1 class="mt-3 font-display text-3xl font-extrabold tracking-tight text-neutral-950 sm:text-4xl">${esc(session.title)}</h1><p class="mt-4 max-w-2xl text-sm leading-7 text-neutral-600">Read the information below carefully. Your timer starts only after you select Start examination.</p><div class="mt-7 grid gap-3 sm:grid-cols-3"><div class="rounded-xl border border-neutral-200 bg-neutral-50 p-4"><span class="text-xs text-neutral-500">Duration</span><strong class="mt-1 block text-sm text-neutral-950">${esc(formatDuration(session.durationSeconds))}</strong></div><div class="rounded-xl border border-neutral-200 bg-neutral-50 p-4"><span class="text-xs text-neutral-500">Questions</span><strong class="mt-1 block text-sm text-neutral-950">${paper.length}</strong></div><div class="rounded-xl border border-neutral-200 bg-neutral-50 p-4"><span class="text-xs text-neutral-500">Coverage</span><strong class="mt-1 block truncate text-sm text-neutral-950" title="${esc(subjects)}">${esc(subjects)}</strong></div></div><div class="mt-7 space-y-4">${session.instructions ? alertMarkup('info', 'School instruction', session.instructions) : ''}${cameraRequired ? alertMarkup('warning', 'Camera required', 'Camera permission must remain active during this session. The local preview is not recorded by this prototype.') : ''}<div class="rounded-xl border border-neutral-200 p-5"><h2 class="text-sm font-semibold text-neutral-950">Examination rules</h2><ul class="mt-3 space-y-2 text-sm leading-6 text-neutral-600"><li>Stay on the examination screen. Leaving the tab, minimising the window or exiting required fullscreen is recorded.</li><li>Clipboard actions can be blocked and recorded when the school enables that policy.</li><li>Your remaining time continues to be accounted for while the exam is backgrounded or reloaded.</li><li>Use Flag for review and the question navigator before final submission. Submission cannot be undone.</li></ul></div></div><button type="button" class="${C.primary} mt-7 w-full sm:w-auto" data-start>${cameraRequired ? icon(I.camera, 'h-4 w-4') : ''}Start examination${icon(I.arrowRight, 'h-4 w-4')}</button></div><aside class="border-t border-neutral-200 bg-black p-6 text-white lg:border-l lg:border-t-0 lg:p-7"><div class="sticky top-6"><span class="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-white text-black">${icon(I.shield)}</span><h2 class="mt-5 font-display text-lg font-bold">Integrity-aware session</h2><p class="mt-2 text-sm leading-6 text-neutral-400">Focus changes, fullscreen exits and blocked clipboard actions can be recorded with the attempt so the school can review context.</p><div class="mt-6 rounded-xl border border-neutral-800 p-4 text-xs leading-5 text-neutral-400"><strong class="text-neutral-200">Important</strong><br>This browser prototype is not a tamper-proof production invigilation system.</div></div></aside></div></section></div></main>`;
    root.querySelector('[data-start]')?.addEventListener('click', startExam);
    afterRender();
  };

  const fillKeys = (question) => {
    let index = 0;
    return (Array.isArray(question.fillTemplate) ? question.fillTemplate : [])
      .filter((part) => part?.blank)
      .map((part) => String(part.blank === true ? `b${index++}` : part.blank));
  };

  const responseStatus = (question) => {
    const response = state?.responses?.[String(question.id)];
    if (question.type === 'multi') {
      const count = Array.isArray(response) ? response.length : 0;
      if (!count) return 'unanswered';
      return question.requiredSelections && count !== Number(question.requiredSelections) ? 'incomplete' : 'answered';
    }
    if (question.type === 'fill' || question.type === 'fill-multi') {
      const keys = fillKeys(question);
      const values = response && typeof response === 'object' ? response : {};
      const filled = keys.filter((key) => String(values[key] ?? '').trim()).length;
      if (!filled) return 'unanswered';
      return filled < keys.length ? 'incomplete' : 'answered';
    }
    if (question.type === 'boolean') return response === true || response === false ? 'answered' : 'unanswered';
    return response !== undefined && response !== null && String(response).trim() ? 'answered' : 'unanswered';
  };

  const counts = () => paper.reduce((acc, question) => {
    acc[responseStatus(question)] += 1;
    return acc;
  }, { answered: 0, incomplete: 0, unanswered: 0 });

  const statusMeta = (status) => status === 'answered'
    ? ['Answered', 'bg-emerald-100 text-emerald-800']
    : status === 'incomplete'
      ? ['Incomplete', 'bg-amber-100 text-amber-800']
      : ['Unanswered', 'bg-neutral-100 text-neutral-600'];

  const navigatorButton = (question, index, review = false) => {
    const status = responseStatus(question);
    const current = Number(state?.currentIndex || 0) === index;
    const flagged = state?.flagged?.includes(question.id);
    const stateClass = current
      ? 'border-black bg-black text-white'
      : status === 'answered'
        ? 'border-emerald-300 bg-emerald-50 text-emerald-800 hover:bg-emerald-100'
        : status === 'incomplete'
          ? 'border-amber-300 bg-amber-50 text-amber-800 hover:bg-amber-100'
          : 'border-neutral-200 bg-white text-neutral-700 hover:bg-neutral-100';
    return `<button type="button" class="relative grid min-h-10 min-w-10 place-items-center rounded-lg border text-xs font-bold transition-colors focus:outline-none focus:ring-4 focus:ring-neutral-200 ${stateClass}" ${review ? `data-go-review="${index}"` : `data-go="${index}"`} aria-label="Question ${index + 1}, ${status}${flagged ? ', flagged' : ''}" ${current ? 'aria-current="step"' : ''}>${index + 1}${flagged ? '<span class="absolute right-1 top-1 h-1.5 w-1.5 rounded-full bg-amber-500" aria-hidden="true"></span>' : ''}</button>`;
  };

  const progressMarkup = () => {
    const index = Number(state?.currentIndex || 0);
    const value = paper.length ? Math.round(((index + 1) / paper.length) * 100) : 0;
    return `<div class="mb-4"><div class="mb-2 flex items-center justify-between text-xs font-medium text-neutral-500"><span>Question ${index + 1} of ${paper.length}</span><span>${value}% through paper</span></div><progress class="block h-1.5 w-full overflow-hidden rounded-full bg-neutral-200 accent-black" value="${index + 1}" max="${paper.length}" aria-label="Examination progress">${value}%</progress></div>`;
  };

  const renderTriangle = () => `<figure class="mb-6 overflow-hidden rounded-xl border border-neutral-200 bg-neutral-50 p-4"><svg class="mx-auto h-52 w-full max-w-md" viewBox="0 0 400 220" role="img" aria-label="Triangle diagram with angles A 50 degrees and B 65 degrees"><path d="M65 185 205 35 340 185Z" fill="white" stroke="black" stroke-width="3"/><text x="52" y="204" font-size="16">A = 50°</text><text x="301" y="204" font-size="16">B = 65°</text><text x="192" y="28" font-size="16">C</text></svg><figcaption class="mt-2 text-center text-xs text-neutral-500">Diagram not drawn to scale.</figcaption></figure>`;

  const renderTable = (table) => {
    const headers = Array.isArray(table?.headers) ? table.headers : [];
    const rows = Array.isArray(table?.rows) ? table.rows : [];
    if (!headers.length && !rows.length) return '';
    return `<div class="mb-6 overflow-x-auto rounded-xl border border-neutral-200"><table class="w-full min-w-[30rem] text-left text-sm text-neutral-700"><thead class="bg-neutral-100 text-xs uppercase tracking-wide text-neutral-600"><tr>${headers.map((cell) => `<th scope="col" class="px-4 py-3 font-semibold">${esc(cell)}</th>`).join('')}</tr></thead><tbody>${rows.map((row) => `<tr class="border-t border-neutral-200 bg-white">${(Array.isArray(row) ? row : []).map((cell) => `<td class="px-4 py-3">${esc(cell)}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`;
  };

  const option = (question, value, label, index, checked, type = 'radio') => {
    const inputId = `q-${question.id}-${index}`;
    const marker = label || String.fromCharCode(65 + index);
    const markerShape = type === 'checkbox' ? 'rounded-md' : 'rounded-full';
    const selected = checked ? 'border-black bg-black text-white' : 'border-neutral-200 bg-white text-neutral-900 hover:border-neutral-400 hover:bg-neutral-50';
    const markerSelected = checked ? 'border-white/40 bg-white text-black' : 'border-neutral-300 bg-neutral-50 text-neutral-700';
    return `<label for="${inputId}" data-answer-option class="group relative block cursor-pointer"><input id="${inputId}" class="peer sr-only" type="${type}" name="q-${question.id}" value="${esc(value)}" ${checked ? 'checked' : ''}><span class="flex min-h-16 items-start gap-3 rounded-xl border p-4 text-sm font-medium transition-colors duration-150 peer-focus-visible:ring-4 peer-focus-visible:ring-neutral-200 motion-reduce:transition-none ${selected}"><span class="grid h-8 w-8 shrink-0 place-items-center ${markerShape} border text-xs font-bold ${markerSelected}">${esc(marker)}</span><span class="min-w-0 flex-1 pt-1 leading-6">${esc(value)}</span>${checked ? `<span class="mt-1 grid h-5 w-5 shrink-0 place-items-center rounded-full bg-white text-black">${icon('m7 12 3 3 7-7', 'h-3.5 w-3.5')}</span>` : ''}</span></label>`;
  };

  const renderControl = (question) => {
    const response = state.responses?.[String(question.id)];
    if (question.type === 'single') {
      return `<fieldset class="grid gap-3"><legend class="sr-only">Choose one answer</legend>${(question.options || []).map((value, index) => option(question, value, '', index, response === value)).join('')}</fieldset>`;
    }
    if (question.type === 'multi') {
      return `<fieldset class="grid gap-3"><legend class="sr-only">Choose the required answers</legend>${question.requiredSelections ? `<div class="flex items-center justify-between gap-3"><p class="text-sm font-semibold text-neutral-700">Select exactly ${question.requiredSelections} answer${Number(question.requiredSelections) === 1 ? '' : 's'}.</p><span data-selection-count class="rounded-full bg-neutral-100 px-2.5 py-1 text-xs font-semibold text-neutral-600">${Array.isArray(response) ? response.length : 0}/${question.requiredSelections}</span></div>` : ''}<div id="selection-limit" class="hidden">${alertMarkup('warning', 'Selection limit reached', `Choose no more than ${question.requiredSelections} answers.`)}</div>${(question.options || []).map((value, index) => option(question, value, '', index, Array.isArray(response) && response.includes(value), 'checkbox')).join('')}</fieldset>`;
    }
    if (question.type === 'boolean') {
      return `<fieldset class="grid gap-3 sm:grid-cols-2"><legend class="sr-only">Choose true or false</legend>${[[true, 'True'], [false, 'False']].map(([value, label], index) => option(question, String(value), label, index, response === value)).join('')}</fieldset>`;
    }
    if (question.type === 'fill' || question.type === 'fill-multi') {
      const values = response && typeof response === 'object' ? response : {};
      let index = 0;
      const parts = Array.isArray(question.fillTemplate) ? question.fillTemplate : [{ text: question.prompt }, { blank: true }];
      return `<div class="rounded-xl border border-neutral-200 bg-neutral-50 p-4 sm:p-5"><div class="flex flex-col gap-3 text-base leading-8 text-neutral-950 sm:flex-row sm:flex-wrap sm:items-baseline">${parts.map((part) => {
        if (!part?.blank) return `<span>${esc(part?.text || '')}</span>`;
        const key = String(part.blank === true ? `b${index}` : part.blank);
        index += 1;
        return `<span class="block w-full sm:w-auto sm:min-w-64"><label class="sr-only" for="fill-${question.id}-${esc(key)}">Answer blank ${index}</label><input id="fill-${question.id}-${esc(key)}" class="${C.field} !bg-white" data-fill-key="${esc(key)}" value="${esc(values[key] || '')}" autocomplete="off" spellcheck="false" placeholder="${esc(part.placeholder || 'Type your answer')}"></span>`;
      }).join('')}</div></div>`;
    }
    return alertMarkup('danger', 'Unsupported question', 'This response type cannot be displayed. Ask the administrator to review the question configuration.');
  };

  const cameraPill = () => cameraRequired ? `<span class="inline-flex min-h-9 items-center gap-1.5 rounded-lg border ${cameraReady ? 'border-emerald-200 bg-emerald-50 text-emerald-800' : 'border-amber-200 bg-amber-50 text-amber-800'} px-2.5 text-xs font-semibold">${icon(I.camera, 'h-4 w-4')}<span data-camera-status class="hidden sm:inline">${cameraReady ? 'Camera on' : 'Camera required'}</span></span>` : '';

  const examView = () => {
    const index = Number(state.currentIndex || 0);
    const question = paper[index];
    if (!question) {
      fatal('Paper error', 'This question could not be loaded.', 'The saved examination state points to a question that is no longer available. Ask the administrator for assistance.');
      return;
    }
    const summary = counts();
    const status = responseStatus(question);
    const meta = statusMeta(status);
    const flagged = state.flagged?.includes(question.id);
    root.innerHTML = `<div class="min-h-dvh bg-neutral-100 pb-24 text-neutral-950 md:pb-8"><header class="sticky top-0 z-40 border-b border-neutral-200 bg-white/95 backdrop-blur"><div class="mx-auto flex max-w-7xl items-center gap-3 px-3 py-3 sm:px-5 lg:px-7"><div class="min-w-0 flex-1">${pageBrand(true)}<div class="ml-3 inline-block max-w-[calc(100%-4rem)] align-middle"><strong class="block truncate text-sm font-semibold text-neutral-950">${esc(session.title)}</strong><span class="block truncate text-xs text-neutral-500">${esc(profile.fullName)} · ${esc(session.classLevel)}</span></div></div><div class="hidden items-center gap-2 xl:flex"><span class="rounded-lg bg-neutral-100 px-3 py-2 text-xs font-medium text-neutral-600">Q <strong class="text-neutral-950">${index + 1}/${paper.length}</strong></span><span class="rounded-lg bg-neutral-100 px-3 py-2 text-xs font-medium text-neutral-600">Answered <strong class="text-neutral-950">${summary.answered}</strong></span><span class="inline-flex min-h-9 items-center gap-1.5 rounded-lg border border-neutral-200 bg-white px-2.5 text-xs font-semibold text-neutral-700">${icon(I.shield, 'h-4 w-4')}<span>Integrity</span><strong data-integrity-count>${seriousIntegrityCount()}</strong></span></div>${cameraPill()}<div id="exam-timer-box" class="rounded-xl border border-neutral-200 bg-neutral-50 px-3 py-2 text-right text-neutral-950"><span class="hidden text-[10px] font-medium uppercase tracking-wide text-neutral-500 sm:block">Time left</span><strong id="exam-timer" class="font-display text-base font-extrabold tabular-nums sm:text-lg">${formatTime(state.remainingSeconds)}</strong></div></div></header><main class="mx-auto grid max-w-7xl gap-5 px-3 py-4 sm:px-5 sm:py-5 lg:px-7 xl:grid-cols-[minmax(0,1fr)_19rem]"><section class="min-w-0">${progressMarkup()}<article data-exam-workspace class="overflow-hidden ${C.card}"><div class="flex flex-wrap items-start justify-between gap-3 border-b border-neutral-200 bg-neutral-50 px-4 py-4 sm:px-6"><div class="flex min-w-0 items-center gap-3"><span class="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-black text-sm font-bold text-white">${index + 1}</span><div class="min-w-0"><p class="truncate text-xs font-semibold uppercase tracking-[.12em] text-neutral-500">${esc(question.subject)}</p><p class="mt-0.5 truncate text-sm font-medium text-neutral-700">${esc(question.label || question.domain || 'Examination question')}</p></div></div><div class="flex items-center gap-2"><span class="inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${meta[1]}">${meta[0]}</span><button type="button" class="${C.quiet} !min-h-9 !px-2.5 !py-1.5" data-flag="${question.id}" aria-pressed="${flagged ? 'true' : 'false'}">${icon(I.flag, 'h-4 w-4')}<span class="hidden sm:inline">${flagged ? 'Flagged' : 'Flag for review'}</span><span class="sr-only sm:hidden">${flagged ? 'Remove flag' : 'Flag question for review'}</span></button></div></div><div class="p-4 sm:p-6 lg:p-8">${question.passage ? `<aside class="mb-6 rounded-xl border border-neutral-200 bg-neutral-50 p-4 sm:p-5"><p class="text-xs font-semibold uppercase tracking-[.12em] text-neutral-500">Read the passage</p><p class="mt-2 whitespace-pre-line text-sm leading-7 text-neutral-700">${esc(question.passage)}</p></aside>` : ''}${question.diagram === 'triangle' ? renderTriangle() : ''}${question.table ? renderTable(question.table) : ''}<h1 class="max-w-4xl font-display text-xl font-extrabold leading-8 tracking-tight text-neutral-950 sm:text-2xl sm:leading-9">${esc(question.prompt)}</h1>${question.instruction ? `<p class="mt-2 text-sm font-semibold text-neutral-600">${esc(question.instruction)}</p>` : ''}<div class="mt-6">${renderControl(question)}</div></div><footer class="hidden items-center justify-between gap-3 border-t border-neutral-200 bg-white p-4 md:flex sm:p-5"><button type="button" class="${C.secondary} xl:hidden" data-drawer-target="question-drawer" data-drawer-show="question-drawer" data-drawer-placement="right" data-drawer-backdrop="true" aria-controls="question-drawer">${icon(I.list, 'h-4 w-4')}Questions</button><div class="ml-auto flex gap-2"><button type="button" class="${C.secondary}" data-previous ${index === 0 ? 'disabled' : ''}>${icon(I.arrowLeft, 'h-4 w-4')}Previous</button><button type="button" class="${C.primary}" data-next>${index >= paper.length - 1 ? 'Review examination' : 'Next'}${icon(index >= paper.length - 1 ? I.review : I.arrowRight, 'h-4 w-4')}</button></div></footer></article></section><aside id="question-map" class="hidden xl:block"><div class="sticky top-24 ${C.card} p-5"><div class="flex items-start justify-between gap-3"><div><p class="text-sm font-semibold text-neutral-950">Question navigator</p><p class="mt-1 text-xs text-neutral-500">${summary.answered} answered · ${summary.incomplete} incomplete</p></div><button type="button" class="${C.quiet} !min-h-9 !px-2.5 !py-1.5" data-review aria-label="Review examination">${icon(I.review, 'h-4 w-4')}</button></div><div class="mt-4 grid grid-cols-5 gap-2">${paper.map((item, itemIndex) => navigatorButton(item, itemIndex)).join('')}</div><div class="mt-4 grid grid-cols-2 gap-2 text-[11px] text-neutral-500"><span class="flex items-center gap-1.5"><i class="h-2.5 w-2.5 rounded-sm bg-emerald-100 ring-1 ring-emerald-300"></i>Answered</span><span class="flex items-center gap-1.5"><i class="h-2.5 w-2.5 rounded-sm bg-amber-100 ring-1 ring-amber-300"></i>Incomplete</span></div><button type="button" class="${C.secondary} mt-5 w-full" data-review>${icon(I.review, 'h-4 w-4')}Review examination</button></div></aside></main><div class="fixed inset-x-0 bottom-0 z-40 border-t border-neutral-200 bg-white/95 p-3 backdrop-blur md:hidden"><div class="mx-auto grid max-w-lg grid-cols-[auto_1fr_1fr] gap-2"><button type="button" class="${C.secondary} !px-3" data-drawer-target="question-drawer" data-drawer-show="question-drawer" data-drawer-placement="right" data-drawer-backdrop="true" aria-controls="question-drawer" aria-label="Open question navigator">${icon(I.list, 'h-5 w-5')}</button><button type="button" class="${C.secondary} !px-3" data-previous ${index === 0 ? 'disabled' : ''}>${icon(I.arrowLeft, 'h-4 w-4')}<span>Previous</span></button><button type="button" class="${C.primary} !px-3" data-next><span>${index >= paper.length - 1 ? 'Review' : 'Next'}</span>${icon(index >= paper.length - 1 ? I.review : I.arrowRight, 'h-4 w-4')}</button></div></div><div id="question-drawer" class="fixed right-0 top-0 z-[80] h-screen w-[min(88vw,22rem)] translate-x-full overflow-y-auto bg-white p-5 shadow-2xl transition-transform duration-300 motion-reduce:transition-none" tabindex="-1" aria-labelledby="question-drawer-label"><div class="flex items-center justify-between"><div><h2 id="question-drawer-label" class="font-display text-lg font-bold text-neutral-950">Question navigator</h2><p class="mt-1 text-xs text-neutral-500">${summary.answered} of ${paper.length} answered</p></div><button type="button" data-drawer-hide="question-drawer" aria-controls="question-drawer" class="inline-flex h-11 w-11 items-center justify-center rounded-lg text-neutral-500 hover:bg-neutral-100 focus:outline-none focus:ring-4 focus:ring-neutral-200">${icon(I.close)}<span class="sr-only">Close navigator</span></button></div><div class="mt-5 grid grid-cols-5 gap-2">${paper.map((item, itemIndex) => navigatorButton(item, itemIndex)).join('')}</div><button type="button" class="${C.primary} mt-6 w-full" data-review>${icon(I.review, 'h-4 w-4')}Review examination</button></div></div>`;
    bindExam();
    updateChrome();
    if (cameraReady) ensureCameraPreview();
    afterRender();
  };

  const reviewView = () => {
    recordElapsed(false);
    persist();
    const summary = counts();
    const issues = summary.unanswered + summary.incomplete;
    root.innerHTML = `<main class="min-h-dvh bg-neutral-100"><header class="border-b border-neutral-200 bg-white"><div class="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-4 sm:px-6">${pageBrand()}<div class="text-right"><strong class="block max-w-[13rem] truncate text-sm text-neutral-950 sm:max-w-sm">${esc(session.title)}</strong><span class="text-xs text-neutral-500">Review · timer continues</span></div></div></header><div class="mx-auto max-w-6xl p-4 sm:p-6 lg:p-8"><section class="overflow-hidden ${C.card}"><div class="border-b border-neutral-200 p-6 sm:p-8"><p class="text-xs font-semibold uppercase tracking-[.14em] text-neutral-500">Final review</p><h1 class="mt-3 font-display text-3xl font-extrabold tracking-tight text-neutral-950">Check your paper before submitting.</h1><p class="mt-3 max-w-2xl text-sm leading-7 text-neutral-600">Open any question to revise your response or review a flag. Submission is final.</p><div class="mt-5">${issues ? alertMarkup('warning', 'Paper not fully complete', `${summary.unanswered} unanswered · ${summary.incomplete} incomplete.`) : alertMarkup('success', 'All questions answered', 'You can still revisit any question before submitting.')}</div></div><div class="grid grid-cols-2 gap-3 border-b border-neutral-200 bg-neutral-50 p-5 sm:grid-cols-4">${[
      ['Answered', summary.answered, 'text-emerald-700'],
      ['Incomplete', summary.incomplete, 'text-amber-700'],
      ['Unanswered', summary.unanswered, 'text-neutral-950'],
      ['Flagged', state.flagged?.length || 0, 'text-neutral-950']
    ].map(([label, value, tone]) => `<div class="rounded-xl border border-neutral-200 bg-white p-4"><span class="text-xs font-semibold uppercase tracking-wide text-neutral-500">${label}</span><strong class="mt-1 block text-2xl font-extrabold ${tone}">${value}</strong></div>`).join('')}</div><div class="p-5 sm:p-7"><div class="grid grid-cols-5 gap-2 sm:grid-cols-8 md:grid-cols-10">${paper.map((question, index) => navigatorButton(question, index, true)).join('')}</div><div class="mt-7 flex flex-col-reverse gap-3 sm:flex-row sm:justify-between"><button type="button" class="${C.secondary}" data-back-exam>${icon(I.arrowLeft, 'h-4 w-4')}Back to questions</button><button type="button" class="${C.primary}" data-modal-target="submit-modal" data-modal-toggle="submit-modal">${icon(I.lock, 'h-4 w-4')}Submit examination</button></div></div></section></div><div id="submit-modal" tabindex="-1" aria-hidden="true" class="fixed left-0 right-0 top-0 z-[140] hidden h-[calc(100%-1rem)] max-h-full w-full items-center justify-center overflow-y-auto overflow-x-hidden p-4 md:inset-0"><div class="relative max-h-full w-full max-w-lg"><div class="relative rounded-2xl bg-white shadow-2xl"><div class="flex items-start justify-between border-b border-neutral-200 p-5"><div><p class="text-xs font-semibold uppercase tracking-[.14em] text-neutral-500">Final action</p><h2 class="mt-1 font-display text-2xl font-extrabold text-neutral-950">Submit this examination?</h2></div><button type="button" class="inline-flex h-11 w-11 items-center justify-center rounded-lg text-neutral-500 hover:bg-neutral-100 focus:outline-none focus:ring-4 focus:ring-neutral-200" data-modal-hide="submit-modal">${icon(I.close)}<span class="sr-only">Close submission dialog</span></button></div><div class="space-y-4 p-5">${issues ? alertMarkup('warning', 'Some questions need attention', `${summary.unanswered} unanswered · ${summary.incomplete} incomplete.`) : alertMarkup('success', 'Paper complete', 'All questions are answered.')}<p class="text-sm leading-6 text-neutral-600">Once submitted, Attempt 1 of 1 is locked and cannot be restarted.</p></div><div class="flex flex-col-reverse gap-3 border-t border-neutral-200 p-5 sm:flex-row sm:justify-end"><button type="button" class="${C.secondary}" data-modal-hide="submit-modal">Continue reviewing</button><button type="button" class="${C.primary}" data-confirm-submit data-modal-hide="submit-modal">Submit examination</button></div></div></div></div></main>`;
    bindReview();
    updateChrome();
    if (cameraReady) ensureCameraPreview();
    afterRender();
  };

  const recordElapsed = (autoSubmit = true) => {
    if (!state?.startedAt || state.submittedAt || timeoutSubmitting) return;
    const now = Date.now();
    const delta = Math.max(0, (now - lastTick) / 1000);
    lastTick = now;
    state.remainingSeconds = Math.max(0, (Number(state.remainingSeconds) || 0) - delta);
    state.elapsedActiveSeconds = (Number(state.elapsedActiveSeconds) || 0) + delta;
    const question = paper[state.currentIndex || 0];
    if (question) {
      state.questionTimings ||= {};
      state.questionTimings[String(question.id)] = (Number(state.questionTimings[String(question.id)]) || 0) + delta;
    }
    if (!autoSubmit) return;
    const status = effectiveStatus();
    if (status === 'closed') {
      timeoutSubmitting = true;
      state.remainingSeconds = Math.max(0, state.remainingSeconds);
      persist();
      submitExam({ automatic: true, reason: 'session-ended' });
      return;
    }
    if (state.remainingSeconds <= 0) {
      timeoutSubmitting = true;
      state.remainingSeconds = 0;
      persist();
      submitExam({ automatic: true, reason: 'time-expired' });
    }
  };

  const startTimer = () => {
    stopTimer();
    lastTick = Date.now();
    timer = setInterval(() => {
      recordElapsed(true);
      updateChrome();
      if (state && !state.submittedAt && !timeoutSubmitting) persist();
    }, 1000);
  };

  const lockedView = () => {
    const attempt = Store.findAttempt(session.id, candidateHash);
    fatal('Attempt complete', 'This examination has already been submitted.', 'Attempt 1 of 1 is locked and cannot be restarted.', `<div class="flex flex-wrap gap-3"><a class="${C.primary}" href="${portalHref('analytics')}">Open result & analytics</a><span class="inline-flex min-h-11 items-center rounded-lg border border-neutral-200 bg-neutral-50 px-4 text-sm font-semibold text-neutral-950">Score ${attempt?.score ?? 0}%</span></div>`);
  };

  const showReset = () => {
    stopTimer();
    stopCamera();
    Store.clearStudentAuth();
    Store.clearActiveCandidate(session.id);
    fatal('Attempt reset', 'This unfinished attempt was reset by an administrator.', 'Authenticate again with the same assigned credentials to start a fresh attempt.', `<a class="${C.primary}" href="${location.pathname}${location.search}">Authenticate again</a>`);
  };

  const startExam = async () => {
    if (effectiveStatus() !== 'open') {
      await enterAuthenticatedFlow();
      return;
    }
    if (cameraRequired && !cameraReady) {
      const granted = await requestCamera();
      if (!granted) return;
    }
    const existing = Store.getStudentState(session.id, candidateHash);
    if (existing?.startedAt && !existing.submittedAt) {
      state = existing;
      paper = Engine.paperForStudent(data, session, candidateHash);
      reconcilePersistedBackground();
      if (state.remainingSeconds <= 0) {
        timeoutSubmitting = true;
        submitExam({ automatic: true, reason: 'time-expired' });
        return;
      }
      startTimer();
      examView();
      return;
    }
    if (Store.hasSubmittedAttempt(session.id, candidateHash)) {
      lockedView();
      return;
    }
    const resetAt = Store.getAttemptResetAt(session.id, candidateHash);
    paper = Engine.paperForStudent(data, session, candidateHash);
    const fingerprint = await Engine.paperFingerprint(session.id, candidateHash, paper);
    const attemptHash = await Engine.attemptHash(session.id, candidateHash, fingerprint);
    const now = Date.now();
    state = {
      version: 4,
      candidateHash,
      studentHash: profile.studentHash,
      studentName: profile.fullName,
      firstName: profile.firstName,
      lastName: profile.lastName,
      startedAt: Math.max(now, resetAt + 1),
      submittedAt: null,
      attemptHash,
      paperFingerprint: fingerprint,
      questionIds: paper.map((question) => question.id),
      responses: {},
      flagged: [],
      questionTimings: {},
      currentIndex: 0,
      remainingSeconds: session.durationSeconds,
      elapsedActiveSeconds: 0,
      integrityEvents: []
    };
    Store.saveStudentState(session.id, candidateHash, state);
    Store.recordAttempt({
      id: attemptHash.slice(0, 12),
      attemptHash,
      candidateHash,
      studentHash: profile.studentHash,
      paperFingerprint: fingerprint,
      sessionId: session.id,
      sessionTitle: session.title,
      firstName: profile.firstName,
      lastName: profile.lastName,
      studentName: profile.fullName,
      classLevel: session.classLevel,
      classGroup: session.classGroup,
      academicSession: session.academicSession,
      mode: session.mode,
      subjects: session.subjects,
      startedAt: state.startedAt,
      remainingSeconds: state.remainingSeconds,
      questionCount: paper.length,
      questionIds: state.questionIds
    });
    try {
      if (session.integrityPolicy?.fullscreenPrompt && document.documentElement.requestFullscreen) {
        await document.documentElement.requestFullscreen();
        recordIntegrity('fullscreen-enter', 'Fullscreen mode entered.', { notify: false });
      }
    } catch {
      recordIntegrity('fullscreen-denied', 'Fullscreen permission was denied.');
    }
    startTimer();
    examView();
  };

  const submitExam = ({ automatic = false, reason = 'manual' } = {}) => {
    if (!state || state.submittedAt) return;
    if (!timeoutSubmitting) recordElapsed(false);
    stopTimer();
    state.submittedAt = Date.now();
    const result = Engine.scoreAttempt(paper, state, session);
    Object.assign(state, {
      score: result.accuracy,
      completion: result.completion,
      paceIndex: result.paceIndex,
      reasoningIndex: result.reasoningIndex,
      integrityScore: result.integrityScore,
      subjectStats: result.subjectStats,
      placement: result.placement || null,
      details: result.details,
      submissionReason: reason
    });
    Store.saveStudentState(session.id, candidateHash, state);
    Store.recordAttempt({
      id: state.attemptHash.slice(0, 12),
      attemptHash: state.attemptHash,
      candidateHash,
      studentHash: profile.studentHash,
      paperFingerprint: state.paperFingerprint,
      sessionId: session.id,
      sessionTitle: session.title,
      firstName: profile.firstName,
      lastName: profile.lastName,
      studentName: profile.fullName,
      classLevel: session.classLevel,
      classGroup: session.classGroup,
      academicSession: session.academicSession,
      mode: session.mode,
      sessionStatus: session.status,
      sessionEndsAt: session.endsAt,
      subjects: session.subjects,
      startedAt: state.startedAt,
      submittedAt: state.submittedAt,
      remainingSeconds: state.remainingSeconds,
      elapsedActiveSeconds: state.elapsedActiveSeconds,
      answered: counts().answered,
      questionCount: paper.length,
      score: result.accuracy,
      correctCount: result.correctCount,
      completion: result.completion,
      paceIndex: result.paceIndex,
      reasoningIndex: result.reasoningIndex,
      integrityScore: result.integrityScore,
      integrityEvents: state.integrityEvents,
      subjectStats: result.subjectStats,
      placement: result.placement || null,
      details: result.details,
      questionIds: state.questionIds
    });
    clearMarker(candidateHash);
    stopCamera();
    if (document.fullscreenElement) document.exitFullscreen?.().catch?.(() => {});
    if (automatic) {
      Store.clearStudentAuth();
      Store.clearActiveCandidate(session.id);
    }
    const timedOut = reason === 'time-expired';
    const closed = reason === 'session-ended';
    const heading = timedOut
      ? 'Time expired. Your examination was submitted automatically.'
      : closed
        ? 'The examination session ended. Your work was submitted automatically.'
        : 'Examination submitted successfully.';
    root.innerHTML = `<main class="grid min-h-dvh place-items-center bg-neutral-100 p-4 sm:p-6"><section class="w-full max-w-2xl overflow-hidden ${C.card}"><div class="border-b border-neutral-200 bg-black p-6 text-white sm:p-8"><span class="inline-flex items-center gap-1.5 rounded-full bg-white px-2.5 py-1 text-xs font-semibold text-black">${icon(I.lock, 'h-4 w-4')}Attempt locked</span><h1 class="mt-5 font-display text-3xl font-extrabold leading-tight tracking-tight">${heading}</h1><p class="mt-3 text-sm leading-6 text-neutral-400">Your first and only attempt is final.${automatic ? ' For security, this candidate session has also been signed out.' : ''}</p></div><div class="p-6 sm:p-8"><div class="flex flex-wrap items-end justify-between gap-5"><div><span class="text-xs font-semibold uppercase tracking-[.12em] text-neutral-500">Score</span><strong class="mt-1 block font-display text-5xl font-extrabold text-neutral-950">${result.accuracy}%</strong></div>${result.placement ? `<div class="max-w-xs text-right"><span class="text-xs font-semibold uppercase tracking-[.12em] text-neutral-500">Recommended stream</span><strong class="mt-1 block text-lg font-semibold text-neutral-950">${esc(result.placement.assignedTrack)}</strong><span class="text-xs text-neutral-500">${result.placement.confidence}% confidence</span></div>` : ''}</div><a href="${portalHref('analytics')}" class="${C.primary} mt-7 w-full">${automatic ? 'Sign in to view dashboard' : 'Open student dashboard'}${icon(I.arrowRight, 'h-4 w-4')}</a></div></section></main>`;
    timeoutSubmitting = false;
    afterRender();
  };

  const goTo = (index) => {
    recordElapsed(false);
    state.currentIndex = Math.max(0, Math.min(paper.length - 1, Number(index) || 0));
    persist();
    examView();
  };

  const bindExam = () => {
    const question = paper[state.currentIndex];
    root.querySelectorAll(`input[name="q-${question.id}"]`).forEach((input) => input.addEventListener('change', () => {
      if (question.type === 'multi') {
        const selected = [...root.querySelectorAll(`input[name="q-${question.id}"]:checked`)].map((node) => node.value);
        if (question.requiredSelections && selected.length > Number(question.requiredSelections)) {
          input.checked = false;
          root.querySelector('#selection-limit')?.classList.remove('hidden');
          showToast('warning', 'Selection limit reached', `Choose exactly ${question.requiredSelections} answers for this question.`, 3500);
          return;
        }
        state.responses[String(question.id)] = selected;
      } else if (question.type === 'boolean') {
        state.responses[String(question.id)] = input.value === 'true';
      } else {
        state.responses[String(question.id)] = input.value;
      }
      persist();
      examView();
    }));
    root.querySelectorAll('[data-fill-key]').forEach((input) => input.addEventListener('input', () => {
      state.responses[String(question.id)] ||= {};
      state.responses[String(question.id)][input.dataset.fillKey] = input.value;
      persist();
    }));
    root.querySelectorAll('[data-go]').forEach((button) => button.addEventListener('click', () => goTo(button.dataset.go)));
    root.querySelector('[data-flag]')?.addEventListener('click', (event) => {
      const id = Number(event.currentTarget.dataset.flag);
      state.flagged ||= [];
      state.flagged = state.flagged.includes(id) ? state.flagged.filter((value) => value !== id) : [...state.flagged, id];
      persist();
      examView();
    });
    root.querySelectorAll('[data-previous]').forEach((button) => button.addEventListener('click', () => goTo(state.currentIndex - 1)));
    root.querySelectorAll('[data-next]').forEach((button) => button.addEventListener('click', () => state.currentIndex >= paper.length - 1 ? reviewView() : goTo(state.currentIndex + 1)));
    root.querySelectorAll('[data-review]').forEach((button) => button.addEventListener('click', reviewView));
  };

  const bindReview = () => {
    root.querySelector('[data-back-exam]')?.addEventListener('click', examView);
    root.querySelectorAll('[data-go-review]').forEach((button) => button.addEventListener('click', () => goTo(button.dataset.goReview)));
    root.querySelector('[data-confirm-submit]')?.addEventListener('click', () => submitExam({ automatic: false, reason: 'manual' }));
  };

  const enterAuthenticatedFlow = async () => {
    const status = effectiveStatus();
    if (status !== 'open') {
      fatal('Session unavailable', 'This examination is not open.', status === 'scheduled'
        ? 'The session is scheduled but has not started yet.'
        : 'The school has closed or disabled this examination.', `<a class="${C.primary}" href="${portalHref()}">Return to student portal</a>`);
      return;
    }
    if (Store.hasSubmittedAttempt(session.id, candidateHash)) {
      lockedView();
      return;
    }
    state = Store.getStudentState(session.id, candidateHash);
    if (state?.startedAt && Store.isAttemptInvalidated(session.id, candidateHash, state.startedAt)) {
      showReset();
      return;
    }
    paper = Engine.paperForStudent(data, session, candidateHash);
    if (!paper.length) {
      fatal('Paper unavailable', 'No questions match this examination configuration.', 'Ask the administrator to review the class, mode, subjects and question count.');
      return;
    }
    if (state?.startedAt && !state.submittedAt) {
      const reconciliation = reconcilePersistedBackground();
      if (reconciliation.reconciled) {
        showToast('warning', 'Background time counted', `${Math.max(1, Math.round(reconciliation.elapsedSeconds))} seconds were deducted while the examination was away from the foreground.`);
      }
      if (state.remainingSeconds <= 0) {
        timeoutSubmitting = true;
        submitExam({ automatic: true, reason: 'time-expired' });
        return;
      }
      if (cameraRequired) await requestCamera();
      startTimer();
      examView();
      return;
    }
    briefingView();
  };

  window.addEventListener('blur', () => {
    if (document.hidden) return;
    recordIntegrity('window-blur', 'Examination window lost focus.');
  });

  document.addEventListener('visibilitychange', () => {
    if (!state?.startedAt || state.submittedAt) return;
    if (document.hidden) {
      recordElapsed(false);
      persist();
      writeMarker({ sessionId: session.id, candidateHash, startedAt: state.startedAt, hiddenAt: Date.now() });
      recordIntegrity('tab-hidden', 'Examination tab became hidden.');
      return;
    }
    recordElapsed(false);
    clearMarker(candidateHash);
    recordIntegrity('focus-return', 'Candidate returned to the examination.', { notify: false });
    persist();
    updateChrome();
  });

  document.addEventListener('fullscreenchange', () => {
    if (!state?.startedAt || state.submittedAt || !session?.integrityPolicy?.fullscreenPrompt) return;
    if (document.fullscreenElement) {
      recordIntegrity('fullscreen-enter', 'Fullscreen mode active.', { notify: false });
      return;
    }
    recordIntegrity('fullscreen-exit', 'Candidate exited fullscreen mode.');
    showToast('warning', 'Fullscreen exited', 'This event has been recorded. Return to fullscreen if your school requires it.');
  });

  ['copy', 'cut', 'paste'].forEach((type) => document.addEventListener(type, (event) => {
    if (!state?.startedAt || state.submittedAt || !session?.integrityPolicy?.clipboardGuard) return;
    event.preventDefault();
    recordIntegrity(`clipboard-${type}`, `${type} action blocked by examination policy.`);
  }));

  window.addEventListener('pagehide', () => {
    if (!state?.startedAt || state.submittedAt) {
      stopCamera();
      return;
    }
    recordElapsed(false);
    persist();
    const existing = readMarker(candidateHash);
    writeMarker(existing?.hiddenAt ? existing : { sessionId: session.id, candidateHash, startedAt: state.startedAt, hiddenAt: Date.now() });
    stopCamera();
  });

  window.addEventListener('pageshow', (event) => {
    if (event.persisted && state?.startedAt && !state.submittedAt) {
      const reconciliation = reconcilePersistedBackground();
      if (reconciliation.reconciled) {
        lastTick = Date.now();
        updateChrome();
      }
    }
  });

  try {
    session = Store.resolveSession(Store.decodeSession(token));
    cameraRequired = Boolean(Proctor.rememberFromUrl(session.id, location.href)?.cameraRequired);
  } catch (error) {
    fatal('Invalid exam link', 'This examination link cannot be opened.', error?.message || 'The session token is missing or invalid.');
    return;
  }

  Data.load().then(async (payload) => {
    data = payload;
    if (!(await hydrateExistingAuth())) {
      authView();
      return;
    }
    await enterAuthenticatedFlow();
  }).catch((error) => fatal('Exam unavailable', 'The examination could not be prepared.', error?.message || 'Question data could not be loaded.'));

  window.FestacolExamApp = Object.freeze({
    requestCamera,
    reconcilePersistedBackground,
    get cameraRequired() { return cameraRequired; },
    get cameraReady() { return cameraReady; }
  });
})();
