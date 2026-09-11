(() => {
  'use strict';

  const Store = window.FestacolSessionStore;
  const Data = window.FestacolQuestionData;
  const Engine = window.FestacolAssessmentEngine;
  const Proctor = window.FestacolProctorPolicy;
  const root = document.getElementById('app');
  if (!Store || !Data || !Engine || !root) throw new Error('Festacol examination dependencies are unavailable.');

  const e = (value) => String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');

  const params = new URL(location.href).searchParams;
  const token = params.get('session');
  let session = null;
  let data = null;
  let paper = [];
  let candidateHash = '';
  let profile = null;
  let state = null;
  let timer = null;
  let lastTick = Date.now();

  const portalHref = (page = 'home') => `./student.html?page=${encodeURIComponent(page)}`;
  const modeLabel = () => Store.getModeLabel(session.mode);
  const cameraRequired = () => Boolean(Proctor?.rememberFromUrl?.(session.id, location.href)?.cameraRequired);
  const subjectLabel = (code) => Data.subjectByCode(data, code)?.label || code;
  const effectiveStatus = () => {
    const now = Date.now();
    if (session.status !== 'open') return session.status;
    if (session.startsAt && now < session.startsAt) return 'scheduled';
    if (session.endsAt && now > session.endsAt) return 'closed';
    return 'open';
  };
  const formatTime = (seconds) => {
    const total = Math.max(0, Math.ceil(Number(seconds) || 0));
    const hours = Math.floor(total / 3600);
    const minutes = Math.floor((total % 3600) / 60);
    const rest = total % 60;
    return hours ? `${hours}:${String(minutes).padStart(2, '0')}:${String(rest).padStart(2, '0')}` : `${minutes}:${String(rest).padStart(2, '0')}`;
  };
  const statusTone = (status) => status === 'answered' ? 'border-emerald-300 bg-emerald-50 text-emerald-900' : status === 'incomplete' ? 'border-amber-300 bg-amber-50 text-amber-900' : 'border-neutral-300 bg-white text-neutral-600';

  const fillKeys = (question) => {
    let index = 0;
    return (Array.isArray(question.fillTemplate) ? question.fillTemplate : [{ text: question.prompt }, { blank: true }])
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
      const count = keys.filter((key) => String(values[key] ?? '').trim()).length;
      if (!count) return 'unanswered';
      return count === keys.length ? 'answered' : 'incomplete';
    }
    if (question.type === 'boolean') return response === true || response === false ? 'answered' : 'unanswered';
    return response !== undefined && response !== null && String(response).trim() ? 'answered' : 'unanswered';
  };
  const counts = () => paper.reduce((acc, question) => {
    acc[responseStatus(question)] += 1;
    return acc;
  }, { answered: 0, incomplete: 0, unanswered: 0 });

  const stopTimer = () => {
    if (timer) clearInterval(timer);
    timer = null;
  };
  const recordElapsed = () => {
    if (!state?.startedAt || state.submittedAt) return;
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
    if (state.remainingSeconds <= 0) {
      state.remainingSeconds = 0;
      persist();
      submit(true);
    }
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
  const startTimer = () => {
    stopTimer();
    lastTick = Date.now();
    timer = setInterval(() => {
      recordElapsed();
      persist();
      updateChrome();
      if (Store.isAttemptInvalidated(session.id, candidateHash, state.startedAt)) showReset();
    }, 1000);
  };
  const integrity = (type, detail = '') => {
    if (!state?.startedAt || state.submittedAt) return;
    state.integrityEvents ||= [];
    state.integrityEvents.push({ type, detail, at: Date.now() });
    state.integrityEvents = state.integrityEvents.slice(-100);
    persist();
    updateChrome();
  };
  const integrityCount = () => (state?.integrityEvents || []).filter((item) => !['focus-return', 'fullscreen-enter'].includes(item.type)).length;

  const pageBrand = () => `<div class="flex items-center gap-3"><span class="grid size-10 place-items-center rounded-xl bg-black text-sm font-black text-white">F</span><div><strong class="block font-display text-sm font-extrabold text-neutral-950">Festacol</strong><span class="block text-[11px] font-semibold text-neutral-500">Student examination</span></div></div>`;

  const fatal = (eyebrow, title, detail, action = '') => {
    stopTimer();
    root.innerHTML = `<main class="min-h-dvh bg-neutral-100 p-4 sm:p-8"><div class="mx-auto grid min-h-[calc(100dvh-2rem)] max-w-6xl overflow-hidden rounded-[2rem] border border-neutral-200 bg-white shadow-xl sm:min-h-[calc(100dvh-4rem)] lg:grid-cols-[.82fr_1.18fr]">
      <section class="flex flex-col justify-between bg-black p-7 text-white sm:p-10"><div>${pageBrand().replaceAll('text-neutral-950','text-white').replaceAll('text-neutral-500','text-neutral-400').replace('bg-black text-sm font-black text-white','bg-white text-sm font-black text-black')}</div><div class="py-12"><p class="text-xs font-extrabold uppercase tracking-[.18em] text-neutral-500">${e(eyebrow)}</p><h1 class="mt-4 max-w-md font-display text-4xl font-extrabold leading-tight sm:text-5xl">Exact exam access, without guesswork.</h1><p class="mt-5 max-w-sm text-sm leading-7 text-neutral-400">The link or QR code identifies the exact examination session issued by the school.</p></div><span class="text-xs text-neutral-600">Festacol CBT</span></section>
      <section class="flex items-center p-7 sm:p-12"><div class="max-w-xl"><span class="inline-flex rounded-full border border-neutral-300 bg-neutral-50 px-3 py-1 text-xs font-extrabold text-neutral-600">${e(eyebrow)}</span><h2 class="mt-5 font-display text-3xl font-extrabold tracking-tight text-neutral-950 sm:text-4xl">${e(title)}</h2><p class="mt-4 text-sm leading-7 text-neutral-600">${e(detail)}</p>${action ? `<div class="mt-7">${action}</div>` : ''}</div></section>
    </div></main>`;
  };

  const authenticate = async (firstName, lastName) => {
    const credentials = Engine.candidateCredentials(firstName, lastName);
    const studentHash = await Engine.studentHash(firstName, lastName);
    const hash = await Engine.candidateHash(session.id, firstName, lastName);
    Store.setStudentAuth(studentHash);
    Store.setActiveCandidate(session.id, hash);
    const existing = Store.getStudentState(session.id, hash);
    Store.saveStudentProfile({
      firstName: credentials.firstName,
      lastName: credentials.lastName,
      fullName: credentials.fullName,
      candidateHash: hash,
      studentHash,
      currentClassId: existing?.classGroup || session.classGroup,
      academicSession: session.academicSession
    });
    profile = Store.getStudentProfile();
    candidateHash = hash;
  };

  const hydrateExistingAuth = async () => {
    profile = Store.getStudentProfile();
    if (!profile?.studentHash || Store.getStudentAuth() !== profile.studentHash) return false;
    const resetAt = Store.getAttemptResetAt(session.id, Store.getActiveCandidate(session.id));
    if (resetAt && resetAt > Number(profile.updatedAt || 0)) {
      Store.clearStudentAuth();
      Store.clearActiveCandidate(session.id);
      return false;
    }
    candidateHash = Store.getActiveCandidate(session.id);
    if (!candidateHash && profile.firstName && profile.lastName) {
      candidateHash = await Engine.candidateHash(session.id, profile.firstName, profile.lastName);
      Store.setActiveCandidate(session.id, candidateHash);
    }
    return Boolean(candidateHash);
  };

  const authView = () => {
    const subjects = session.subjects.map(subjectLabel);
    root.innerHTML = `<main class="min-h-dvh bg-neutral-100 p-4 sm:p-7"><div class="mx-auto grid min-h-[calc(100dvh-2rem)] max-w-7xl overflow-hidden rounded-[2rem] border border-neutral-200 bg-white shadow-2xl shadow-neutral-300/40 sm:min-h-[calc(100dvh-3.5rem)] lg:grid-cols-[.9fr_1.1fr]">
      <section class="relative flex flex-col justify-between overflow-hidden bg-black p-7 text-white sm:p-10 lg:p-12"><div>${pageBrand().replaceAll('text-neutral-950','text-white').replaceAll('text-neutral-500','text-neutral-400').replace('bg-black text-sm font-black text-white','bg-white text-sm font-black text-black')}</div><div class="relative z-10 py-10"><div class="flex flex-wrap gap-2"><span class="rounded-full border border-neutral-700 px-3 py-1 text-xs font-extrabold">${e(session.classLevel)}</span><span class="rounded-full border border-neutral-700 px-3 py-1 text-xs font-extrabold">${e(modeLabel())}</span></div><p class="mt-9 text-xs font-bold uppercase tracking-[.18em] text-neutral-500">Exam ${e(session.id)}</p><h1 class="mt-4 max-w-xl font-display text-4xl font-extrabold leading-[1.06] tracking-tight sm:text-5xl lg:text-6xl">${e(session.title)}</h1><p class="mt-6 max-w-lg text-sm leading-7 text-neutral-400">${e(subjects.join(' · ') || 'School assessment')}</p></div><div class="grid grid-cols-3 border-t border-neutral-800 pt-6"><div><strong class="block text-xl font-extrabold">${e(Store.durationLabel(session.durationSeconds))}</strong><span class="text-[11px] text-neutral-500">duration</span></div><div><strong class="block text-xl font-extrabold">${session.questionCount}</strong><span class="text-[11px] text-neutral-500">questions</span></div><div><strong class="block text-xl font-extrabold">1</strong><span class="text-[11px] text-neutral-500">attempt</span></div></div></section>
      <section class="flex items-center p-7 sm:p-10 lg:p-14"><div class="mx-auto w-full max-w-xl"><p class="text-xs font-extrabold uppercase tracking-[.16em] text-neutral-500">Candidate sign in</p><h2 class="mt-3 font-display text-3xl font-extrabold tracking-tight text-neutral-950 sm:text-4xl">Authenticate before opening the paper.</h2><p class="mt-4 text-sm leading-7 text-neutral-600">Use the credentials assigned for this candidate. Your first name is the username and your last name is the password.</p>
        <form id="student-login-form" class="mt-8 grid gap-5 sm:grid-cols-2" novalidate>
          <label class="text-sm font-extrabold text-neutral-800">First name · username<input id="student-first-name" class="field mt-2" autocomplete="given-name" required></label>
          <label class="text-sm font-extrabold text-neutral-800">Last name · password<input id="student-last-name" type="password" class="field mt-2" autocomplete="current-password" required></label>
          <p id="student-login-error" class="hidden text-sm font-bold text-rose-700 sm:col-span-2" role="alert"></p>
          <button class="btn btn-primary !border-black !bg-black !text-white hover:!border-neutral-800 hover:!bg-neutral-800 btn-lg sm:col-span-2" type="submit">Continue to exam instructions</button>
        </form>
        <div class="mt-7 grid gap-3 rounded-2xl border border-neutral-200 bg-neutral-50 p-4 text-xs leading-5 text-neutral-600 sm:grid-cols-2"><p><strong class="block text-neutral-950">Exact session</strong>The QR/link opens this exam only.</p><p><strong class="block text-neutral-950">One candidate</strong>Your paper and attempt are tied to your credentials.</p></div>
      </div></section>
    </div></main>`;

    document.getElementById('student-login-form')?.addEventListener('submit', async (event) => {
      event.preventDefault();
      const error = document.getElementById('student-login-error');
      try {
        await authenticate(document.getElementById('student-first-name').value, document.getElementById('student-last-name').value);
        await enterAuthenticatedFlow();
      } catch (failure) {
        error.textContent = failure.message;
        error.classList.remove('hidden');
      }
    });
  };

  const briefing = () => {
    const subjectBadges = session.subjects.map((code) => `<span class="rounded-full border border-neutral-300 bg-white px-3 py-1.5 text-xs font-bold text-neutral-700">${e(subjectLabel(code))}</span>`).join('');
    root.innerHTML = `<main class="min-h-dvh bg-neutral-100"><header class="border-b border-neutral-200 bg-white"><div class="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-4 sm:px-6 lg:px-8">${pageBrand()}<div class="text-right"><strong class="block text-sm text-neutral-950">${e(profile.fullName)}</strong><span class="text-xs text-neutral-500">${e(session.classLevel)} · Candidate authenticated</span></div></div></header>
      <div class="mx-auto max-w-7xl px-4 py-6 sm:px-6 sm:py-9 lg:px-8"><div class="grid gap-6 lg:grid-cols-[minmax(0,1.45fr)_minmax(320px,.55fr)]">
        <section class="overflow-hidden rounded-[2rem] bg-black text-white shadow-xl"><div class="p-7 sm:p-10 lg:p-12"><div class="flex flex-wrap gap-2"><span class="rounded-full border border-neutral-700 px-3 py-1 text-xs font-extrabold">${e(session.classLevel)}</span><span class="rounded-full border border-neutral-700 px-3 py-1 text-xs font-extrabold">${e(modeLabel())}</span><span class="rounded-full border border-neutral-700 px-3 py-1 text-xs font-extrabold">Attempt 1 of 1</span></div><p class="mt-10 text-xs font-bold uppercase tracking-[.18em] text-neutral-500">Ready to begin</p><h1 class="mt-3 max-w-3xl font-display text-4xl font-extrabold leading-tight tracking-tight sm:text-5xl">${e(session.title)}</h1><div class="mt-6 flex flex-wrap gap-2">${subjectBadges}</div></div><div class="grid grid-cols-2 border-t border-neutral-800 sm:grid-cols-4">${[['Duration',Store.durationLabel(session.durationSeconds)],['Questions',paper.length],['Class',session.classLevel],['Session',session.id]].map(([label,value])=>`<div class="border-b border-neutral-800 p-5 sm:border-b-0 sm:border-r sm:last:border-r-0"><span class="block text-[10px] font-extrabold uppercase tracking-[.14em] text-neutral-500">${e(label)}</span><strong class="mt-2 block truncate text-sm text-white">${e(value)}</strong></div>`).join('')}</div></section>
        <aside class="rounded-[2rem] border border-neutral-200 bg-white p-6 shadow-lg sm:p-7"><p class="text-xs font-extrabold uppercase tracking-[.16em] text-neutral-500">Before you begin</p><h2 class="mt-2 font-display text-2xl font-extrabold text-neutral-950">Read these instructions carefully.</h2><ol class="mt-6 space-y-5 text-sm leading-6 text-neutral-700">${[
          'The examination timer starts only when you press Start examination.',
          'Use Previous, Next and the question map to move through the paper. You may flag questions for review.',
          'Responses are saved to this attempt. Closing intentionally lets you resume, while minimising or backgrounding the exam may still count against your time and integrity record.',
          'Submission is final. This session permits only one submitted attempt.'
        ].map((text,index)=>`<li class="flex gap-3"><span class="grid size-7 shrink-0 place-items-center rounded-full bg-black text-xs font-extrabold text-white">${index+1}</span><span>${e(text)}</span></li>`).join('')}</ol>
          ${session.instructions ? `<div class="mt-6 border-l-4 border-black bg-neutral-100 p-4 text-sm leading-6 text-neutral-700"><strong class="block text-neutral-950">School instruction</strong><span class="mt-1 block">${e(session.instructions)}</span></div>` : ''}
          ${cameraRequired() ? `<div class="mt-6 rounded-2xl border border-sky-200 bg-sky-50 p-4 text-sm leading-6 text-sky-950"><strong class="block">Camera required for this exam</strong><span class="mt-1 block text-sky-800">You must allow camera access before the paper starts. The prototype shows a local live preview only and does not record, upload, store or automatically analyse video.</span></div>` : ''}
          <div class="mt-7 grid gap-3"><button class="btn btn-primary !border-black !bg-black !text-white hover:!border-neutral-800 hover:!bg-neutral-800 btn-lg w-full" data-start>Start examination</button><a class="btn btn-secondary w-full" href="${portalHref('home')}">Return to student portal</a></div>
        </aside>
      </div></div></main>`;
    document.querySelector('[data-start]')?.addEventListener('click', start);
  };

  const renderTriangle = () => `<figure class="mb-7 overflow-hidden rounded-2xl border border-neutral-300 bg-neutral-50 p-5"><svg class="mx-auto h-auto w-full max-w-xl text-neutral-950" viewBox="0 0 560 280" role="img" aria-labelledby="triangle-title triangle-desc"><title id="triangle-title">Triangle ABC</title><desc id="triangle-desc">Triangle ABC with angle A equal to 50 degrees and angle B equal to 65 degrees.</desc><path d="M80 230 L480 230 L300 45 Z" fill="none" stroke="currentColor" stroke-width="4" stroke-linejoin="round"/><text x="62" y="255" font-size="22" fill="currentColor">A</text><text x="488" y="255" font-size="22" fill="currentColor">B</text><text x="292" y="32" font-size="22" fill="currentColor">C</text><text x="120" y="215" font-size="20" fill="currentColor">50°</text><text x="410" y="215" font-size="20" fill="currentColor">65°</text></svg><figcaption class="mt-3 text-center text-xs font-bold text-neutral-500">Diagram for this question</figcaption></figure>`;
  const renderTable = (table) => {
    if (!table?.headers || !Array.isArray(table.rows)) return '';
    return `<div class="mb-7 overflow-x-auto rounded-2xl border border-neutral-300"><table class="w-full min-w-[420px] text-left text-sm"><thead class="bg-neutral-950 text-white"><tr>${table.headers.map((header)=>`<th class="px-4 py-3 font-extrabold">${e(header)}</th>`).join('')}</tr></thead><tbody class="divide-y divide-neutral-200 bg-white">${table.rows.map((row)=>`<tr>${row.map((cell)=>`<td class="px-4 py-3 text-neutral-700">${e(cell)}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`;
  };
  const answerOption = (question, option, index, checked, type) => `<label class="group flex min-h-16 cursor-pointer items-center gap-4 rounded-2xl border-2 px-5 py-4 transition ${checked ? 'border-black bg-black text-white shadow-lg' : 'border-neutral-300 bg-white text-neutral-950 hover:border-black hover:bg-neutral-50'} focus-within:ring-4 focus-within:ring-neutral-200"><input class="sr-only" type="${type}" name="q-${question.id}" value="${e(option)}" ${checked ? 'checked' : ''}><span class="grid size-9 shrink-0 place-items-center rounded-full border-2 ${checked ? 'border-white bg-white text-black' : 'border-neutral-400 bg-white text-neutral-700'} text-xs font-extrabold">${String.fromCharCode(65 + index)}</span><span class="text-[15px] font-semibold leading-6">${e(option)}</span></label>`;
  const renderQuestionControl = (question) => {
    const response = state.responses?.[String(question.id)];
    if (question.type === 'single') return `<fieldset class="grid gap-3"><legend class="sr-only">Choose one answer</legend>${(question.options || []).map((option,index)=>answerOption(question,option,index,response===option,'radio')).join('')}</fieldset>`;
    if (question.type === 'multi') return `<fieldset class="grid gap-3"><legend class="sr-only">Choose all required answers</legend>${question.requiredSelections ? `<p class="mb-1 text-xs font-bold text-neutral-500">Select ${question.requiredSelections} answer${Number(question.requiredSelections)===1?'':'s'}.</p>` : ''}${(question.options || []).map((option,index)=>answerOption(question,option,index,Array.isArray(response)&&response.includes(option),'checkbox')).join('')}</fieldset>`;
    if (question.type === 'boolean') return `<fieldset class="grid gap-3 sm:grid-cols-2"><legend class="sr-only">True or false</legend>${[[true,'True'],[false,'False']].map(([value,label])=>`<label class="flex min-h-20 cursor-pointer items-center justify-center rounded-2xl border-2 px-6 text-lg font-extrabold transition ${response===value?'border-black bg-black text-white':'border-neutral-300 bg-white text-neutral-950 hover:border-black'} focus-within:ring-4 focus-within:ring-neutral-200"><input class="sr-only" type="radio" name="q-${question.id}" value="${value}" ${response===value?'checked':''}>${label}</label>`).join('')}</fieldset>`;
    if (question.type === 'fill' || question.type === 'fill-multi') {
      const values = response && typeof response === 'object' ? response : {};
      let index = 0;
      const parts = Array.isArray(question.fillTemplate) ? question.fillTemplate : [{ text: question.prompt }, { blank: true }];
      return `<div class="rounded-2xl border-2 border-neutral-300 bg-neutral-50 p-5"><div class="flex flex-wrap items-baseline gap-2 text-base font-semibold leading-10">${parts.map((part)=>{
        if (!part?.blank) return `<span>${e(part?.text || '')}</span>`;
        const key = String(part.blank === true ? `b${index}` : part.blank); index += 1;
        return `<span class="inline-block min-w-48"><label class="sr-only" for="fill-${question.id}-${e(key)}">Answer blank ${index}</label><input id="fill-${question.id}-${e(key)}" class="exam-field border-0 border-b-2 border-black bg-transparent text-center font-bold" data-fill-key="${e(key)}" data-question-id="${question.id}" autocomplete="off" value="${e(values[key] || '')}" placeholder="${e(part.placeholder || 'answer')}"></span>`;
      }).join('')}</div></div>`;
    }
    return `<p class="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm font-bold text-rose-800">This question type is not supported by the current paper.</p>`;
  };

  const navigatorButton = (question, index) => {
    const status = responseStatus(question);
    const current = index === Number(state.currentIndex || 0);
    const flagged = state.flagged?.includes(question.id);
    return `<button type="button" data-go="${index}" data-status="${status}" aria-current="${current ? 'step' : 'false'}" aria-label="Question ${index + 1}, ${status}${flagged ? ', flagged' : ''}" class="relative grid size-10 place-items-center rounded-xl border text-xs font-extrabold transition ${current ? 'border-black bg-black text-white shadow-md' : statusTone(status)}">${index + 1}${flagged ? '<span class="absolute -right-1 -top-1 size-2.5 rounded-full border-2 border-white bg-amber-500"></span>' : ''}</button>`;
  };

  const updateChrome = () => {
    const timerElement = document.getElementById('exam-timer');
    if (timerElement) timerElement.textContent = formatTime(state?.remainingSeconds);
    const timerBox = document.getElementById('exam-timer-box');
    if (timerBox) {
      const remaining = Number(state?.remainingSeconds) || 0;
      timerBox.dataset.urgent = remaining <= 300 ? 'true' : 'false';
      timerBox.className = `rounded-xl border px-3 py-2 text-right ${remaining <= 300 ? 'border-amber-300 bg-amber-50' : 'border-neutral-700 bg-neutral-900'}`;
    }
    const integrityPill = document.getElementById('integrity-pill');
    if (integrityPill) integrityPill.textContent = `Integrity ${integrityCount()}`;
  };

  const examView = () => {
    const index = Number(state.currentIndex || 0);
    const question = paper[index];
    const summary = counts();
    const status = responseStatus(question);
    root.innerHTML = `<div class="min-h-dvh bg-neutral-100 text-neutral-950">
      <header class="sticky top-0 z-40 border-b border-neutral-800 bg-black text-white shadow-lg"><div class="mx-auto grid max-w-[1500px] grid-cols-[minmax(0,1fr)_auto] items-center gap-3 px-4 py-3 sm:px-6 lg:grid-cols-[minmax(0,1fr)_auto_auto] lg:px-8"><div class="flex min-w-0 items-center gap-3"><span class="grid size-10 shrink-0 place-items-center rounded-xl bg-white text-sm font-black text-black">F</span><div class="min-w-0"><strong class="block truncate text-sm font-extrabold">${e(session.title)}</strong><span class="block truncate text-xs text-neutral-400">${e(profile.fullName)} · ${e(session.classLevel)} · Attempt 1 of 1</span></div></div><div class="hidden items-center gap-5 lg:flex"><div class="text-center"><span class="block text-[10px] font-extrabold uppercase tracking-[.14em] text-neutral-500">Question</span><strong class="text-sm">${index + 1} / ${paper.length}</strong></div><div class="text-center"><span class="block text-[10px] font-extrabold uppercase tracking-[.14em] text-neutral-500">Answered</span><strong class="text-sm">${summary.answered}</strong></div><span id="integrity-pill" class="rounded-full border border-neutral-700 px-3 py-1.5 text-xs font-bold text-neutral-300">Integrity ${integrityCount()}</span></div><div id="exam-timer-box" class="rounded-xl border border-neutral-700 bg-neutral-900 px-3 py-2 text-right"><span class="block text-[9px] font-extrabold uppercase tracking-[.14em] text-neutral-500">Time left</span><strong id="exam-timer" class="font-display text-lg font-extrabold tabular-nums">${formatTime(state.remainingSeconds)}</strong></div></div></header>

      <main class="mx-auto grid max-w-[1500px] gap-5 p-4 sm:p-6 lg:grid-cols-[minmax(0,1fr)_320px] lg:p-8">
        <section class="min-w-0"><article class="exam-card overflow-hidden !rounded-[1.65rem] !border-2 !border-neutral-950 !shadow-xl">
          <div class="flex flex-wrap items-center justify-between gap-3 border-b-2 border-neutral-950 bg-neutral-50 px-5 py-4 sm:px-7"><div class="flex items-center gap-3"><span class="grid size-10 place-items-center rounded-xl bg-black text-sm font-extrabold text-white">${index + 1}</span><div><p class="text-[10px] font-extrabold uppercase tracking-[.14em] text-neutral-500">${e(question.subject)}</p><p class="text-xs font-semibold text-neutral-600">${e(question.label || question.domain || 'Examination question')}</p></div></div><div class="flex items-center gap-2"><span class="rounded-full border px-3 py-1 text-xs font-extrabold ${statusTone(status)}">${e(status)}</span><button class="btn btn-secondary btn-sm" data-flag="${question.id}" aria-pressed="${state.flagged?.includes(question.id) ? 'true' : 'false'}">${state.flagged?.includes(question.id) ? 'Flagged for review' : 'Flag question'}</button></div></div>
          <div class="p-5 sm:p-7 lg:p-9">${question.passage ? `<aside class="mb-7 border-l-4 border-black bg-neutral-100 p-5"><p class="text-[10px] font-extrabold uppercase tracking-[.14em] text-neutral-500">Read the passage</p><p class="mt-3 max-w-4xl text-[15px] leading-8 text-neutral-700">${e(question.passage)}</p></aside>` : ''}${question.diagram === 'triangle' ? renderTriangle() : ''}${question.table ? renderTable(question.table) : ''}<h1 class="max-w-5xl font-display text-2xl font-extrabold leading-[1.35] tracking-tight text-neutral-950 sm:text-3xl">${e(question.prompt)}</h1>${question.instruction ? `<p class="mt-3 text-sm font-bold text-neutral-600">${e(question.instruction)}</p>` : ''}<div class="mt-7">${renderQuestionControl(question)}</div></div>
          <footer class="exam-footer flex flex-col gap-3 border-t-2 border-neutral-950 bg-white p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5"><div class="flex gap-2"><button class="btn btn-quiet flex-1 sm:flex-none" data-clear-answer>Clear response</button><button class="btn btn-secondary flex-1 sm:flex-none lg:hidden" data-toggle-map>Question map</button></div><div class="grid grid-cols-2 gap-2 sm:flex"><button class="btn btn-secondary" data-previous ${index === 0 ? 'disabled' : ''}>Previous</button><button class="btn btn-primary !border-black !bg-black !text-white hover:!border-neutral-800 hover:!bg-neutral-800" data-next>${index === paper.length - 1 ? 'Review answers' : 'Save & next'}</button></div></footer>
        </article></section>

        <aside id="question-map" class="hidden lg:block"><div class="sticky top-24 overflow-hidden rounded-[1.65rem] bg-black p-5 text-white shadow-xl"><div class="border-b border-neutral-800 pb-5"><p class="text-[10px] font-extrabold uppercase tracking-[.15em] text-neutral-500">Question map</p><div class="mt-2 flex items-end justify-between gap-4"><strong class="font-display text-3xl font-extrabold">${paper.length}</strong><span class="text-xs text-neutral-400">${summary.answered} answered</span></div></div><div class="mt-4 grid grid-cols-3 gap-2 text-center text-[10px]"><div class="rounded-xl bg-neutral-900 p-2"><strong class="block text-sm text-emerald-300">${summary.answered}</strong><span class="text-neutral-500">Answered</span></div><div class="rounded-xl bg-neutral-900 p-2"><strong class="block text-sm text-amber-300">${summary.incomplete}</strong><span class="text-neutral-500">Partial</span></div><div class="rounded-xl bg-neutral-900 p-2"><strong class="block text-sm text-neutral-200">${summary.unanswered}</strong><span class="text-neutral-500">Unanswered</span></div></div><div class="mt-5 grid grid-cols-5 gap-2">${paper.map(navigatorButton).join('')}</div><div class="mt-5 border-t border-neutral-800 pt-4 text-[11px] leading-5 text-neutral-400"><p><span class="mr-2 inline-block size-2 rounded-full bg-amber-500"></span>Dot = flagged for review</p><p>Black = current question</p></div><button class="btn mt-5 w-full !bg-white !text-black hover:!bg-neutral-200" data-review>Review & submit</button></div></aside>
      </main>

      <div id="question-map-drawer" class="fixed inset-0 z-50 hidden bg-black/60 p-4 backdrop-blur-sm lg:hidden"><div class="ml-auto flex h-full w-full max-w-sm flex-col rounded-[1.75rem] bg-black p-5 text-white shadow-2xl"><div class="flex items-center justify-between border-b border-neutral-800 pb-4"><div><p class="text-[10px] font-extrabold uppercase tracking-[.15em] text-neutral-500">Question map</p><strong class="font-display text-xl font-extrabold">${summary.answered} of ${paper.length} answered</strong></div><button class="btn !border-neutral-700 !bg-neutral-900 !text-white" data-close-map>Close</button></div><div class="mt-5 grid grid-cols-5 gap-2">${paper.map(navigatorButton).join('')}</div><button class="btn mt-auto w-full !bg-white !text-black" data-review>Review & submit</button></div></div>
    </div>`;
    bindExam();
    updateChrome();
  };

  const reviewView = () => {
    recordElapsed();
    persist();
    const summary = counts();
    root.innerHTML = `<main class="min-h-dvh bg-neutral-100"><header class="border-b border-neutral-200 bg-white"><div class="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-4 sm:px-6 lg:px-8">${pageBrand()}<div class="text-right"><strong class="block text-sm">${e(session.title)}</strong><span class="text-xs text-neutral-500">Final review · timer continues</span></div></div></header><div class="mx-auto max-w-6xl p-4 sm:p-7"><section class="overflow-hidden rounded-[1.75rem] border border-neutral-200 bg-white shadow-xl"><div class="border-b border-neutral-200 p-6 sm:p-8"><span class="rounded-full border border-amber-300 bg-amber-50 px-3 py-1 text-xs font-extrabold text-amber-900">Final review</span><h1 class="mt-4 font-display text-3xl font-extrabold tracking-tight text-neutral-950 sm:text-4xl">Check the whole paper before submitting.</h1><p class="mt-3 max-w-3xl text-sm leading-7 text-neutral-600">Submission is permanent. You can return to any question, complete missing answers, or remove flags before the final action.</p></div><div class="grid gap-4 border-b border-neutral-200 bg-neutral-50 p-5 sm:grid-cols-4 sm:p-6">${[['Answered',summary.answered,'text-emerald-700'],['Incomplete',summary.incomplete,'text-amber-700'],['Unanswered',summary.unanswered,'text-neutral-700'],['Flagged',state.flagged?.length || 0,'text-neutral-950']].map(([label,value,tone])=>`<div class="rounded-2xl border border-neutral-200 bg-white p-4"><span class="text-[10px] font-extrabold uppercase tracking-[.14em] text-neutral-500">${label}</span><strong class="mt-1 block font-display text-3xl font-extrabold ${tone}">${value}</strong></div>`).join('')}</div><div class="p-5 sm:p-7"><div class="grid grid-cols-5 gap-2 sm:grid-cols-8 md:grid-cols-10">${paper.map((question,index)=>`<button class="relative min-h-12 rounded-xl border px-2 text-xs font-extrabold ${statusTone(responseStatus(question))}" data-go-review="${index}">${index+1}${state.flagged?.includes(question.id)?'<span class="absolute right-1.5 top-1.5 size-2 rounded-full bg-amber-500"></span>':''}</button>`).join('')}</div><div class="mt-7 flex flex-col-reverse gap-3 sm:flex-row sm:justify-between"><button class="btn btn-secondary" data-back-exam>Return to examination</button><button class="btn btn-primary !border-black !bg-black !text-white hover:!border-neutral-800 hover:!bg-neutral-800 btn-lg" data-submit>Submit examination</button></div></div></section></div></main>`;
    bindReview();
  };

  const locked = () => {
    stopTimer();
    const attempt = Store.findAttempt(session.id, candidateHash);
    fatal('Attempt complete', 'This examination has already been submitted.', 'Attempt 1 of 1 is locked and cannot be restarted.', `<div class="flex flex-wrap gap-3"><a class="btn btn-primary !border-black !bg-black !text-white hover:!border-neutral-800 hover:!bg-neutral-800" href="${portalHref('analytics')}">Open result & analytics</a><span class="rounded-xl border border-neutral-200 bg-neutral-50 px-4 py-2 text-sm font-extrabold">Score ${attempt?.score ?? 0}%</span></div>`);
  };

  const showReset = () => {
    stopTimer();
    Store.clearStudentAuth();
    Store.clearActiveCandidate(session.id);
    fatal('Attempt reset', 'This unfinished attempt was reset by an administrator.', 'Authenticate again with the same assigned credentials to start a fresh attempt.', `<a class="btn btn-primary !border-black !bg-black !text-white hover:!border-neutral-800 hover:!bg-neutral-800" href="${location.pathname}${location.search}">Authenticate again</a>`);
  };

  const start = async () => {
    if (effectiveStatus() !== 'open') return;
    const existing = Store.getStudentState(session.id, candidateHash);
    if (existing?.startedAt && !existing.submittedAt) {
      state = existing;
      paper = Engine.paperForStudent(data, session, candidateHash);
      startTimer();
      examView();
      return;
    }
    if (Store.hasSubmittedAttempt(session.id, candidateHash)) {
      locked();
      return;
    }
    const resetAt = Store.getAttemptResetAt(session.id, candidateHash);
    paper = Engine.paperForStudent(data, session, candidateHash);
    const fingerprint = await Engine.paperFingerprint(session.id, candidateHash, paper);
    const attemptHash = await Engine.attemptHash(session.id, candidateHash, fingerprint);
    const now = Date.now();
    state = {
      version: 3,
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
    Store.recordAttempt({ id: attemptHash.slice(0, 12), attemptHash, candidateHash, studentHash: profile.studentHash, paperFingerprint: fingerprint, sessionId: session.id, sessionTitle: session.title, firstName: profile.firstName, lastName: profile.lastName, studentName: profile.fullName, classLevel: session.classLevel, classGroup: session.classGroup, academicSession: session.academicSession, mode: session.mode, subjects: session.subjects, startedAt: state.startedAt, remainingSeconds: state.remainingSeconds, questionCount: paper.length, questionIds: state.questionIds });
    try {
      if (session.integrityPolicy.fullscreenPrompt && document.documentElement.requestFullscreen) {
        await document.documentElement.requestFullscreen();
        integrity('fullscreen-enter');
      }
    } catch {
      integrity('fullscreen-denied');
    }
    startTimer();
    examView();
  };

  const submit = (automatic = false) => {
    if (state?.submittedAt) return;
    recordElapsed();
    state.submittedAt = Date.now();
    stopTimer();
    const result = Engine.scoreAttempt(paper, state, session);
    Object.assign(state, { score: result.accuracy, completion: result.completion, paceIndex: result.paceIndex, reasoningIndex: result.reasoningIndex, integrityScore: result.integrityScore, subjectStats: result.subjectStats, placement: result.placement || null, details: result.details });
    Store.saveStudentState(session.id, candidateHash, state);
    Store.recordAttempt({ id: state.attemptHash.slice(0, 12), attemptHash: state.attemptHash, candidateHash, studentHash: profile.studentHash, paperFingerprint: state.paperFingerprint, sessionId: session.id, sessionTitle: session.title, firstName: profile.firstName, lastName: profile.lastName, studentName: profile.fullName, classLevel: session.classLevel, classGroup: session.classGroup, academicSession: session.academicSession, mode: session.mode, sessionStatus: session.status, sessionEndsAt: session.endsAt, subjects: session.subjects, startedAt: state.startedAt, submittedAt: state.submittedAt, remainingSeconds: state.remainingSeconds, elapsedActiveSeconds: state.elapsedActiveSeconds, answered: counts().answered, questionCount: paper.length, score: result.accuracy, correctCount: result.correctCount, completion: result.completion, paceIndex: result.paceIndex, reasoningIndex: result.reasoningIndex, integrityScore: result.integrityScore, integrityEvents: state.integrityEvents, subjectStats: result.subjectStats, placement: result.placement || null, details: result.details, questionIds: state.questionIds });
    root.innerHTML = `<main class="grid min-h-dvh place-items-center bg-neutral-100 p-5"><section class="w-full max-w-2xl overflow-hidden rounded-[2rem] border border-neutral-200 bg-white shadow-2xl"><div class="bg-black p-7 text-white sm:p-9"><span class="rounded-full border border-neutral-700 px-3 py-1 text-xs font-extrabold">Attempt locked</span><h1 class="mt-4 font-display text-3xl font-extrabold sm:text-4xl">${automatic ? 'Time expired. Your examination was submitted automatically.' : 'Examination submitted successfully.'}</h1><p class="mt-3 text-sm leading-6 text-neutral-400">Your first and only attempt is now final.</p></div><div class="p-7 sm:p-9"><div class="flex flex-wrap items-end justify-between gap-5"><div><span class="text-xs font-extrabold uppercase tracking-[.14em] text-neutral-500">Score</span><strong class="mt-1 block font-display text-6xl font-extrabold text-neutral-950">${result.accuracy}%</strong></div>${result.placement ? `<div class="max-w-xs text-right"><span class="text-xs font-extrabold uppercase tracking-[.14em] text-neutral-500">Recommended stream</span><strong class="mt-1 block text-xl font-extrabold">${e(result.placement.assignedTrack)}</strong><span class="text-xs text-neutral-500">${result.placement.confidence}% confidence</span></div>` : ''}</div><a href="${portalHref('analytics')}" class="btn btn-primary !border-black !bg-black !text-white hover:!border-neutral-800 hover:!bg-neutral-800 btn-lg mt-7 w-full">Open student dashboard</a></div></section></main>`;
  };

  const goTo = (index) => {
    recordElapsed();
    state.currentIndex = Math.max(0, Math.min(paper.length - 1, Number(index) || 0));
    persist();
    examView();
  };

  const clearCurrentResponse = () => {
    const question = paper[state.currentIndex];
    delete state.responses[String(question.id)];
    persist();
    examView();
  };

  const bindExam = () => {
    const question = paper[state.currentIndex];
    root.querySelectorAll(`input[name="q-${question.id}"]`).forEach((input) => input.addEventListener('change', () => {
      if (question.type === 'multi') {
        const selected = [...root.querySelectorAll(`input[name="q-${question.id}"]:checked`)].map((item) => item.value);
        if (question.requiredSelections && selected.length > Number(question.requiredSelections)) {
          input.checked = false;
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
      const key = input.dataset.fillKey;
      state.responses[String(question.id)] ||= {};
      state.responses[String(question.id)][key] = input.value;
      persist();
    }));
    root.querySelectorAll('[data-go]').forEach((button) => button.addEventListener('click', () => goTo(button.dataset.go)));
    root.querySelector('[data-flag]')?.addEventListener('click', (event) => {
      const id = Number(event.currentTarget.dataset.flag);
      state.flagged ||= [];
      state.flagged = state.flagged.includes(id) ? state.flagged.filter((item) => item !== id) : [...state.flagged, id];
      persist();
      examView();
    });
    root.querySelector('[data-clear-answer]')?.addEventListener('click', clearCurrentResponse);
    root.querySelector('[data-previous]')?.addEventListener('click', () => goTo(state.currentIndex - 1));
    root.querySelector('[data-next]')?.addEventListener('click', () => state.currentIndex >= paper.length - 1 ? reviewView() : goTo(state.currentIndex + 1));
    root.querySelectorAll('[data-review]').forEach((button) => button.addEventListener('click', reviewView));
    const drawer = document.getElementById('question-map-drawer');
    root.querySelector('[data-toggle-map]')?.addEventListener('click', () => drawer?.classList.remove('hidden'));
    root.querySelector('[data-close-map]')?.addEventListener('click', () => drawer?.classList.add('hidden'));
  };

  const bindReview = () => {
    root.querySelector('[data-back-exam]')?.addEventListener('click', examView);
    root.querySelectorAll('[data-go-review]').forEach((button) => button.addEventListener('click', () => goTo(button.dataset.goReview)));
    root.querySelector('[data-submit]')?.addEventListener('click', () => {
      const summary = counts();
      const dialog = document.createElement('div');
      dialog.className = 'modal-shell';
      dialog.dataset.open = 'true';
      dialog.innerHTML = `<div class="modal-backdrop"></div><section class="modal-card" role="dialog" aria-modal="true" aria-labelledby="final-submit-title"><div class="p-6"><span class="badge badge-warning">Final action</span><h2 id="final-submit-title" class="mt-3 font-display text-2xl font-extrabold">Submit this examination?</h2><p class="mt-2 text-sm leading-6 text-slate-600">You have ${summary.unanswered} unanswered and ${summary.incomplete} incomplete question${summary.unanswered + summary.incomplete === 1 ? '' : 's'}. Submission cannot be undone.</p><div class="mt-5 flex flex-col gap-3 sm:flex-row"><button class="btn btn-primary !border-black !bg-black !text-white hover:!border-neutral-800 hover:!bg-neutral-800" data-confirm-submit>Submit permanently</button><button class="btn btn-secondary" data-cancel-submit>Keep reviewing</button></div></div></section>`;
      document.body.append(dialog);
      dialog.querySelector('[data-confirm-submit]')?.addEventListener('click', () => { dialog.remove(); submit(false); });
      dialog.querySelector('[data-cancel-submit]')?.addEventListener('click', () => dialog.remove());
    });
  };

  const enterAuthenticatedFlow = async () => {
    if (effectiveStatus() !== 'open') {
      fatal('Session unavailable', 'This examination is not open.', effectiveStatus() === 'scheduled' ? 'The session is scheduled but has not started yet.' : 'The school has closed or disabled this examination.', `<a class="btn btn-primary !border-black !bg-black !text-white hover:!border-neutral-800 hover:!bg-neutral-800" href="${portalHref('home')}">Return to student portal</a>`);
      return;
    }
    if (Store.hasSubmittedAttempt(session.id, candidateHash)) {
      locked();
      return;
    }
    state = Store.getStudentState(session.id, candidateHash);
    if (state?.startedAt && Store.isAttemptInvalidated(session.id, candidateHash, state.startedAt)) {
      showReset();
      return;
    }
    paper = Engine.paperForStudent(data, session, candidateHash);
    if (!paper.length) {
      fatal('Paper unavailable', 'No questions match this exam configuration.', 'Ask the administrator to review the class, mode and subject coverage for this session.');
      return;
    }
    if (state?.startedAt && !state.submittedAt) {
      startTimer();
      examView();
      return;
    }
    briefing();
  };

  window.addEventListener('blur', () => integrity('window-blur'));
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) integrity('tab-hidden');
    else integrity('focus-return');
  });
  document.addEventListener('fullscreenchange', () => {
    if (state?.startedAt && !state.submittedAt && !document.fullscreenElement) integrity('fullscreen-exit');
  });
  ['copy', 'cut', 'paste'].forEach((type) => document.addEventListener(type, (event) => {
    if (state?.startedAt && !state.submittedAt && session?.integrityPolicy?.clipboardGuard) {
      event.preventDefault();
      integrity(`clipboard-${type}`);
    }
  }));
  window.addEventListener('pagehide', () => {
    if (state?.startedAt && !state.submittedAt) {
      recordElapsed();
      persist();
    }
  });

  try {
    session = Store.resolveSession(Store.decodeSession(token));
  } catch (failure) {
    fatal('Invalid exam link', 'This examination link cannot be opened.', failure.message);
    return;
  }

  Data.load().then(async (payload) => {
    data = payload;
    const authenticated = await hydrateExistingAuth();
    if (!authenticated) {
      authView();
      return;
    }
    await enterAuthenticatedFlow();
  }).catch((failure) => fatal('Exam unavailable', 'The examination could not be prepared.', failure.message));
})();
