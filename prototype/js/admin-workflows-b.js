'use strict';
  function examWizard() {
    const step = Math.min(4, Math.max(1, Number(p().get('step')) || 1));
    const draft = { mode: 'single', classLevel: 'SS2', subjects: ['mat'], durationMinutes: 60, questionCount: 10, status: 'draft', startsAt: null, endsAt: null, ...wizardDraft() };
    if (draft.mode === 'qualifier') draft.classLevel = 'SS1'; if (draft.mode === 'waec') draft.classLevel = 'SS3';
    if (step >= 3) { const available = availableQuestionCount(draft); if (available && Number(draft.questionCount) > available) { draft.questionCount = available; saveWizard(draft); } }
    const steps = ['Audience', 'Coverage', 'Timing', 'Review'];
    const stepper = `<div class="stepper">${steps.map((name, index) => `<div class="step" ${index + 1 === step ? 'aria-current="step"' : ''} data-complete="${index + 1 < step}"><span class="step-index">${index + 1 < step ? '✓' : index + 1}</span><span class="hidden text-xs font-extrabold sm:inline">${name}</span></div>`).join('')}</div>`;
    let body = '';
    if (step === 1) body = wizardAudience(draft);
    if (step === 2) body = wizardCoverage(draft);
    if (step === 3) body = wizardTiming(draft);
    if (step === 4) body = wizardReview(draft);
    openModal(`${modalHeader('Exam builder', 'Create examination', 'A guided setup that favors choices and presets over repetitive typing.')}<div class="p-5 sm:p-6">${stepper}<div class="mt-6" id="wizard-step">${body}</div><div id="wizard-error" class="mt-4 hidden alert alert-danger" role="alert"></div><div class="mt-6 flex items-center justify-between gap-3"><button class="btn btn-secondary" type="button" data-wizard-back ${step === 1 ? 'disabled' : ''}>Back</button><div class="flex gap-2"><button class="btn btn-secondary" type="button" data-wizard-save>Save draft</button><button class="btn btn-primary" type="button" data-wizard-next>${step === 4 ? 'Publish exam' : `Continue ${ICON.arrow}`}</button></div></div></div>`);
    bindWizard(draft, step);
  }

  function wizardAudience(draft) {
    return `<div><h3 class="font-display text-lg font-extrabold text-slate-950">Who is this examination for?</h3><p class="mt-1 text-sm text-slate-500">Choose a mode and target class. Festacol handles the compatible rules.</p><div class="mt-5 grid gap-3 sm:grid-cols-2">${Object.entries(MODES).map(([key, [label, detail]]) => `<button type="button" class="mode-card" data-wizard-mode="${key}" aria-pressed="${draft.mode === key}"><span class="badge ${draft.mode === key ? 'badge-brand' : 'badge-neutral'}">${key === 'waec' ? 'SS3' : key === 'qualifier' ? 'SS1' : 'Flexible'}</span><strong class="mt-3 block font-display text-base text-slate-950">${label}</strong><span class="mt-1 block text-xs leading-5 text-slate-500">${detail}</span></button>`).join('')}</div><div class="mt-5"><span class="field-label">Target class</span><div class="mt-2 flex gap-2">${['SS1', 'SS2', 'SS3'].map((level) => `<button type="button" class="choice-chip" data-wizard-level="${level}" aria-pressed="${draft.classLevel === level}" ${draft.mode === 'qualifier' && level !== 'SS1' || draft.mode === 'waec' && level !== 'SS3' ? 'disabled' : ''}>${level}</button>`).join('')}</div></div></div>`;
  }
  function wizardCoverage(draft) {
    if (draft.mode === 'qualifier') return `<div><h3 class="font-display text-lg font-extrabold text-slate-950">Placement coverage is ready.</h3><p class="mt-2 text-sm leading-6 text-slate-600">Qualifier mode automatically draws across English, Mathematics, Basic Science, Social & Citizenship, Business and Digital aptitude domains.</p><div class="mt-5 flex flex-wrap gap-2">${['English', 'Mathematics', 'Science', 'Social aptitude', 'Business', 'Digital'].map((x) => `<span class="badge badge-brand">${x}</span>`).join('')}</div></div>`;
    const subjects = Data.availableSubjects(data, draft.classLevel, draft.mode);
    return `<div><h3 class="font-display text-lg font-extrabold text-slate-950">Choose subject coverage.</h3><p class="mt-1 text-sm text-slate-500">${draft.mode === 'mixed' ? 'Pick 2–6 subjects. The paper will interleave them.' : 'Pick one subject for this paper.'}</p><div class="mt-5 flex flex-wrap gap-2">${subjects.map((subject) => `<button type="button" class="choice-chip" data-wizard-subject="${e(subject.code)}" aria-pressed="${draft.subjects.includes(subject.code)}">${e(subject.label)}</button>`).join('')}</div></div>`;
  }
  function wizardTiming(draft) {
    const available = availableQuestionCount(draft);
    const counts = [1,2,3,4,5,10,20,30,40].filter((n) => n <= available);
    return `<div><h3 class="font-display text-lg font-extrabold text-slate-950">Set the paper shape.</h3><p class="mt-1 text-sm text-slate-500">Use quick presets; fine tune only if the exam needs it.</p><div class="mt-5 grid gap-5 sm:grid-cols-2"><div><span class="field-label">Duration</span><div class="mt-2 flex flex-wrap gap-2">${[30,45,60,90,120].map((n) => `<button type="button" class="choice-chip" data-wizard-duration="${n}" aria-pressed="${Number(draft.durationMinutes) === n}">${n} min</button>`).join('')}</div></div><div><div class="flex items-center justify-between gap-2"><span class="field-label">Question count</span><span class="text-xs font-bold text-slate-400">${available} available</span></div><div class="mt-2 flex flex-wrap gap-2">${counts.map((n) => `<button type="button" class="choice-chip" data-wizard-count="${n}" aria-pressed="${Number(draft.questionCount) === n}">${n}</button>`).join('')}</div></div><div class="sm:col-span-2"><span class="field-label">Availability</span><div class="mt-2 flex flex-wrap gap-2">${[['open','Open now'],['draft','Keep draft']].map(([value,label]) => `<button type="button" class="choice-chip" data-wizard-status="${value}" aria-pressed="${draft.status === value}">${label}</button>`).join('')}</div></div><label class="sm:col-span-2"><span class="field-label">Candidate note <span class="font-medium text-slate-400">optional</span></span><input id="wizard-note" class="field mt-2" maxlength="80" value="${e(draft.instructions || '')}" placeholder="Bring your calculator if allowed"></label></div></div>`;
  }
  function wizardReview(draft) {
    const autoTitle = draft.mode === 'qualifier' ? 'SS1 Placement Qualifier' : `${draft.classLevel} ${draft.mode === 'waec' ? 'WAEC Practice' : 'Examination'} · ${draft.subjects.map((code) => Data.subjectByCode(data, code)?.label || code).join(' + ')}`;
    draft.title = draft.title || autoTitle.slice(0, 40); saveWizard(draft);
    const previewSession = Store.normalizeSession(draft);
    const matchCount = Data.questionsForSession(data, previewSession).length;
    return `<div><h3 class="font-display text-lg font-extrabold text-slate-950">Review before publishing.</h3><div class="mt-5 grid gap-3 sm:grid-cols-2"><div class="mini-metric"><span>Title</span><strong>${e(draft.title)}</strong></div><div class="mini-metric"><span>Audience</span><strong>${e(draft.classLevel)} · ${e(Store.getModeLabel(draft.mode))}</strong></div><div class="mini-metric"><span>Paper</span><strong>${draft.questionCount} questions · ${draft.durationMinutes} min</strong></div><div class="mini-metric"><span>Question matches</span><strong>${matchCount} available</strong></div></div><div class="alert ${matchCount >= draft.questionCount ? 'alert-success' : 'alert-danger'} mt-4"><strong>${matchCount >= draft.questionCount ? 'Ready to publish.' : 'Not enough questions.'}</strong><span>${matchCount >= draft.questionCount ? 'The configured question bank can satisfy this paper.' : 'Reduce the question count or broaden subject coverage.'}</span></div></div>`;
  }
  function bindWizard(draft, step) {
    const error = document.getElementById('wizard-error');
    const save = () => { saveWizard(draft); return draft; };
    modal.querySelectorAll('[data-wizard-mode]').forEach((button) => button.addEventListener('click', () => { draft.mode = button.dataset.wizardMode; draft.subjects = []; if (draft.mode === 'qualifier') draft.classLevel = 'SS1'; if (draft.mode === 'waec') draft.classLevel = 'SS3'; save(); examWizard(); }));
    modal.querySelectorAll('[data-wizard-level]').forEach((button) => button.addEventListener('click', () => { draft.classLevel = button.dataset.wizardLevel; draft.subjects = []; save(); examWizard(); }));
    modal.querySelectorAll('[data-wizard-subject]').forEach((button) => button.addEventListener('click', () => { const code = button.dataset.wizardSubject; if (['single','waec'].includes(draft.mode)) draft.subjects = [code]; else if (draft.subjects.includes(code)) draft.subjects = draft.subjects.filter((x) => x !== code); else if (draft.subjects.length < 6) draft.subjects.push(code); save(); examWizard(); }));
    modal.querySelectorAll('[data-wizard-duration]').forEach((button) => button.addEventListener('click', () => { draft.durationMinutes = Number(button.dataset.wizardDuration); save(); examWizard(); }));
    modal.querySelectorAll('[data-wizard-count]').forEach((button) => button.addEventListener('click', () => { draft.questionCount = Number(button.dataset.wizardCount); save(); examWizard(); }));
    modal.querySelectorAll('[data-wizard-status]').forEach((button) => button.addEventListener('click', () => { draft.status = button.dataset.wizardStatus; save(); examWizard(); }));
    document.getElementById('wizard-note')?.addEventListener('input', (event) => { draft.instructions = event.target.value; save(); });
    modal.querySelector('[data-wizard-back]').addEventListener('click', () => { if (step > 1) navigate('exams', { modal: 'exam-create', step: step - 1 }); });
    modal.querySelector('[data-wizard-save]').addEventListener('click', () => { draft.status = 'draft'; try { const prepared = Store.normalizeSession(draft); Store.saveSession(prepared); clearWizard(); closeModal(); toast('Exam saved as a draft.', 'success'); render(); } catch (failure) { error.textContent = failure.message; error.classList.remove('hidden'); } });
    modal.querySelector('[data-wizard-next]').addEventListener('click', () => { error.classList.add('hidden'); try {
      if (step === 1) { if (draft.mode === 'qualifier') draft.classLevel = 'SS1'; if (draft.mode === 'waec') draft.classLevel = 'SS3'; }
      if (step === 2) { if (['single','waec'].includes(draft.mode) && draft.subjects.length !== 1) throw new Error('Choose one subject.'); if (draft.mode === 'mixed' && (draft.subjects.length < 2 || draft.subjects.length > 6)) throw new Error('Choose between two and six subjects.'); }
      if (step < 4) { save(); navigate('exams', { modal: 'exam-create', step: step + 1 }); return; }
      const prepared = Store.normalizeSession({ ...draft, status: draft.status === 'draft' ? 'draft' : 'open' }); const matches = Data.questionsForSession(data, prepared); if (matches.length !== prepared.questionCount) throw new Error(`Only ${matches.length} matching questions are available. Reduce the paper size.`); const saved = Store.saveSession(prepared); clearWizard(); closeModal(true); history.pushState({}, '', href('exams', { detail: 'exam', id: saved.id })); render(); toast('Exam created and ready to distribute.', 'success');
    } catch (failure) { error.textContent = failure.message; error.classList.remove('hidden'); } });
  }

