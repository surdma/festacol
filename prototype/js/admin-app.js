'use strict';
  const directExamLink = (session) => {
    const link = new URL('./exam.html', location.href);
    link.search = '';
    link.hash = '';
    link.searchParams.set('session', Store.encodeSession(session));
    const Policy = window.FestacolProctorPolicy;
    return Policy?.decorateStudentLink
      ? Policy.decorateStudentLink(link.href, Policy.getAdminPolicy(session.id).cameraRequired)
      : link.href;
  };
  const sessionFromLinkInput = (input) => {
    try {
      const source = new URL(input.value, location.href);
      const decoded = Store.decodeSession(source.searchParams.get('session'));
      return Store.resolveSession(decoded);
    } catch {
      return null;
    }
  };
  const availableQuestionsFor = (session) => data?.questions?.filter((question) => {
    if (!question.levels?.includes(session.classLevel) || !question.examModes?.includes(session.mode)) return false;
    if (session.mode === 'qualifier') return !session.subjects?.length || session.subjects.includes(question.subjectCode);
    return session.subjects?.includes(question.subjectCode);
  }).length || session.questionCount || 1;
  const enhanceExamDistribution = () => {
    document.querySelectorAll('[data-session-link]').forEach((input) => {
      const session = sessionFromLinkInput(input);
      if (!session?.id) return;
      const link = directExamLink(session);
      if (input.value !== link) input.value = link;
      const host = input.closest('label')?.parentElement || input.parentElement;
      if (!host) return;
      const attempts = Store.attemptsForSession(session.id);
      let panel = host.querySelector('[data-exam-distribution]');
      if (!panel) {
        panel = document.createElement('section');
        panel.dataset.examDistribution = session.id;
        panel.className = 'mt-4 rounded-2xl border border-slate-200 bg-slate-50 p-4';
        panel.innerHTML = `<div class="grid gap-4 sm:grid-cols-[144px_minmax(0,1fr)]"><div><div data-exam-qr="${e(session.id)}" class="qr-frame mx-auto bg-white" aria-label="QR code for ${e(session.title)}"></div><p class="mt-2 text-center text-[10px] font-bold uppercase tracking-wider text-slate-500">Scan to open exam</p></div><div class="min-w-0"><p class="eyebrow">Candidate distribution</p><h3 class="mt-1 font-display text-base font-extrabold text-slate-950">Direct exam link + QR</h3><p class="mt-2 text-xs leading-5 text-slate-600">Candidates who are signed in go straight to instructions or their active attempt. Everyone else authenticates first, then continues into this exact exam.</p><div class="mt-4 grid gap-2 sm:grid-cols-2"><button class="btn btn-primary btn-sm" data-copy-exam-link="${e(session.id)}">Copy exam link</button><a class="btn btn-secondary btn-sm" data-open-exam-link href="${e(link)}" target="_blank" rel="noopener">Open exam link</a><button class="btn btn-secondary btn-sm sm:col-span-2" data-exam-edit="${e(session.id)}" ${attempts.length ? 'disabled title="Editing is locked after a candidate starts this exam"' : ''}>${attempts.length ? 'Editing locked · attempt exists' : 'Edit exam settings'}</button></div></div></div>`;
        host.append(panel);
      }
      if (panel.dataset.examLink !== link) {
        panel.dataset.examLink = link;
        const anchor = panel.querySelector('[data-open-exam-link]');
        if (anchor) anchor.href = link;
        window.FestacolQR?.render?.(panel.querySelector('[data-exam-qr]'), link);
      }
    });
  };
  const examEditModal = (id) => {
    const session = Store.listSessions().find((item) => item.id === id);
    if (!session) return toast('Exam not found.', 'danger');
    if (Store.attemptsForSession(id).length) return toast('Editing is locked after a candidate starts this exam. Duplicate it to make a revised version.', 'warning');
    const maximum = Math.max(1, availableQuestionsFor(session));
    openModal(`<div class="p-5 sm:p-6"><div class="flex items-start justify-between gap-4"><div><p class="eyebrow">Exam configuration</p><h2 id="admin-modal-title" class="mt-1 font-display text-2xl font-extrabold">Edit examination</h2><p class="mt-2 text-sm leading-6 text-slate-600">Update delivery and paper settings before any candidate starts. Mode, class and subject coverage remain intact so an edit cannot silently change the meaning of an issued exam.</p></div><button class="icon-btn" data-modal-close aria-label="Close">${ICON.close}</button></div><form id="exam-edit-form" data-exam-edit-id="${e(session.id)}" class="mt-6 grid gap-5"><label class="text-sm font-bold text-slate-800">Exam title<input id="exam-edit-title" class="field mt-2" maxlength="72" value="${e(session.title)}" required></label><div class="grid gap-4 sm:grid-cols-2"><label class="text-sm font-bold text-slate-800">Duration (seconds)<input id="exam-edit-duration" type="number" min="30" max="10800" step="30" class="field mt-2" value="${Number(session.durationSeconds)}" required></label><label class="text-sm font-bold text-slate-800">Question count<input id="exam-edit-count" type="number" min="1" max="${maximum}" class="field mt-2" value="${Math.min(Number(session.questionCount), maximum)}" required></label></div><label class="text-sm font-bold text-slate-800">Status<select id="exam-edit-status" class="field mt-2"><option value="open" ${session.status==='open'?'selected':''}>Open</option><option value="draft" ${session.status==='draft'?'selected':''}>Draft</option><option value="closed" ${session.status==='closed'?'selected':''}>Closed</option></select></label><label class="text-sm font-bold text-slate-800">Candidate instruction<textarea id="exam-edit-instructions" class="field mt-2 min-h-28" maxlength="140" placeholder="Optional instruction shown before the timer starts">${e(session.instructions || '')}</textarea></label><div class="surface-soft p-4"><p class="eyebrow">Locked scope</p><p class="mt-2 text-sm font-semibold text-slate-800">${e(Store.getModeLabel(session.mode))} · ${e(session.classLevel)} · ${e(session.classGroup)}</p><p class="mt-1 text-xs text-slate-500">${session.subjects.map((code)=>e(Data.subjectByCode(data,code)?.label||code)).join(' · ')}</p></div><div class="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end"><button type="button" class="btn btn-secondary" data-modal-close>Cancel</button><button type="submit" class="btn btn-primary">Save exam changes</button></div></form></div>`);
  };

  function renderModalFromUrl() {
    const type = p().get('modal');
    if (!type) return closeModal(true);
    if (type === 'user-create') userModal();
    if (type === 'class-create') classModal();
    if (type === 'exam-create') examWizard();
    if (type === 'question-create') questionModal();
    if (type === 'reset-all') confirmResetModal();
  }
  function renderDrawerFromUrl() {
    const type = p().get('detail'), id = p().get('id');
    if (!type || !id) return closeDrawer();
    if (type === 'user') userDrawer(id); if (type === 'class') classDrawer(id); if (type === 'exam') examDrawer(id); if (type === 'question') questionDrawer(id);
  }

  function render() {
    destroyCharts();
    const page = currentPage();
    chrome(page);
    alertHost.className = 'hidden';
    ({ overview, users: usersPage, exams: examsPage, classes: classesPage, questions: questionsPage, reports: reportsPage, settings: settingsPage }[page])();
    renderModalFromUrl();
    renderDrawerFromUrl();
    enhanceExamDistribution();
    root.focus({ preventScroll: true });
  }

  document.addEventListener('click', (event) => {
    const route = event.target.closest('[data-admin-route]'); if (route) { event.preventDefault(); navigate(route.dataset.adminRoute); return; }
    if (event.target.closest('[data-alert-close]')) { alertHost.className = 'hidden'; return; }
    const examEdit = event.target.closest('[data-exam-edit]'); if (examEdit) { examEditModal(examEdit.dataset.examEdit); return; }
    const copyExam = event.target.closest('[data-copy-exam-link]'); if (copyExam) { const session = Store.listSessions().find((item) => item.id === copyExam.dataset.copyExamLink); if (!session) return; const link = directExamLink(session); navigator.clipboard?.writeText(link).then(() => toast('Direct examination link copied.', 'success')).catch(() => toast('Copy was unavailable. Select the dynamic link manually.', 'info')); return; }
    const modalTrigger = event.target.closest('[data-modal]'); if (modalTrigger) { if (drawer.dataset.open === 'true') closeDrawer(); navigate(currentPage(), { modal: modalTrigger.dataset.modal, edit: modalTrigger.dataset.modalEdit || '' }); return; }
    if (event.target.closest('[data-open-exam-wizard]') || event.target.closest('#admin-quick-create')) { clearWizard(); navigate('exams', { modal: 'exam-create', step: 1 }); return; }
    if (event.target.closest('[data-modal-close]')) { closeModal(); return; }
    if (event.target.closest('[data-drawer-close]') || event.target === drawerScrim) { closeDrawer(); return; }
    const detail = event.target.closest('[data-detail]'); if (detail) { navigate(currentPage(), { detail: detail.dataset.detail, id: detail.dataset.id }); return; }
    const role = event.target.closest('[data-user-role]'); if (role) { navigate('users', { role: role.dataset.userRole, status: userFilters().status, q: p().get('q') || '' }); return; }
    const userStatus = event.target.closest('[data-user-status]'); if (userStatus) { navigate('users', { role: userFilters().role, status: userStatus.dataset.userStatus, q: p().get('q') || '' }); return; }
    const examStatus = event.target.closest('[data-exam-status]'); if (examStatus) { navigate('exams', { status: examStatus.dataset.examStatus }); return; }
    const qLevel = event.target.closest('[data-q-level]'); if (qLevel) { navigate('questions', { subject: qFilters().subject, level: qLevel.dataset.qLevel, type: qFilters().type }); return; }
    const qType = event.target.closest('[data-q-type]'); if (qType) { navigate('questions', { subject: qFilters().subject, level: qFilters().level, type: qType.dataset.qType }); return; }
    const userToggle = event.target.closest('[data-user-toggle]'); if (userToggle) { Store.updateUserStatus(userToggle.dataset.userToggle, userToggle.dataset.nextStatus); closeDrawer(); toast('User status updated.', 'success'); render(); return; }
    const userDelete = event.target.closest('[data-user-delete]'); if (userDelete) { Store.deleteUser(userDelete.dataset.userDelete); closeDrawer(); toast('User removed from the local directory.', 'success'); render(); return; }
    const classDelete = event.target.closest('[data-class-delete]'); if (classDelete) { Store.deleteClass(classDelete.dataset.classDelete); closeDrawer(); toast('Class removed.', 'success'); render(); return; }
    const examToggle = event.target.closest('[data-exam-toggle]'); if (examToggle) { Store.updateSessionStatus(examToggle.dataset.examToggle, examToggle.dataset.nextStatus); closeDrawer(); toast('Exam status updated.', 'success'); render(); return; }
    const examDelete = event.target.closest('[data-exam-delete]'); if (examDelete) { Store.deleteSession(examDelete.dataset.examDelete); closeDrawer(); toast('Exam deleted.', 'success'); render(); return; }
    const classArchive = event.target.closest('[data-class-archive]'); if (classArchive) { const cls = Store.listClasses().find((item) => item.id === classArchive.dataset.classArchive); if (cls) Store.saveClass({ ...cls, status: cls.status === 'archived' ? 'active' : 'archived' }); closeDrawer(); toast('Class status updated.', 'success'); render(); return; }
    const examDuplicate = event.target.closest('[data-exam-duplicate]'); if (examDuplicate) { const source = Store.listSessions().find((item) => item.id === examDuplicate.dataset.examDuplicate); if (source) { const copy = Store.saveSession({ ...source, id: undefined, title: `${source.title} copy`.slice(0, 40), status: 'draft', startsAt: null, endsAt: null, createdAt: Date.now() }); closeDrawer(); toast('Exam duplicated as a draft.', 'success'); history.pushState({}, '', href('exams', { detail: 'exam', id: copy.id })); render(); } return; }
    if (event.target.closest('[aria-label="Notifications"]')) { notificationsDrawer(); return; }
    if (event.target.closest('#admin-profile-button')) { profileDrawer(); return; }
    const qDelete = event.target.closest('[data-question-delete]'); if (qDelete) { Store.deleteCustomQuestion(Number(qDelete.dataset.questionDelete)); closeDrawer(); Data.load().then((payload) => { data = payload; toast('Custom question deleted.', 'success'); render(); }); return; }
    if (event.target.closest('[data-copy-link]')) { const input = drawer.querySelector('[data-session-link]'); if (!input) return; navigator.clipboard?.writeText(input.value).then(() => toast('Dynamic exam link copied.', 'success')).catch(() => { input.select(); document.execCommand?.('copy'); toast('Dynamic exam link selected for copying.', 'info'); }); return; }
    if (event.target.closest('[data-report-refresh]')) { toast('Report data refreshed from local attempts.', 'success'); render(); return; }
    const clear = event.target.closest('[data-clear-local]'); if (clear) { if (clear.dataset.clearLocal === 'sessions') Store.clearSessions(); if (clear.dataset.clearLocal === 'attempts') Store.clearAttempts(); if (clear.dataset.clearLocal === 'questions') Store.listCustomQuestions().forEach((q) => Store.deleteCustomQuestion(q.id)); toast('Selected local data cleared.', 'success'); Data.load().then((payload) => { data = payload; render(); }); }
    queueMicrotask(enhanceExamDistribution);
    setTimeout(enhanceExamDistribution, 0);
  });

  document.addEventListener('change', (event) => {
    if (event.target.id === 'question-subject-filter') navigate('questions', { subject: event.target.value, level: qFilters().level, type: qFilters().type });
  });
  let userSearchTimer = null;
  document.addEventListener('input', (event) => {
    if (event.target.id === 'user-search') { window.clearTimeout(userSearchTimer); userSearchTimer = window.setTimeout(() => navigate('users', { role: userFilters().role, status: userFilters().status, q: event.target.value }, true), 220); }
  });
  document.addEventListener('submit', (event) => {
    if (event.target.id !== 'exam-edit-form') return;
    event.preventDefault();
    const id = event.target.dataset.examEditId;
    const session = Store.listSessions().find((item) => item.id === id);
    if (!session) return toast('Exam not found.', 'danger');
    if (Store.attemptsForSession(id).length) return toast('Editing was blocked because a candidate has already started this exam.', 'warning');
    try {
      Store.saveSession({ ...session, title: document.getElementById('exam-edit-title').value, durationSeconds: Number(document.getElementById('exam-edit-duration').value), questionCount: Number(document.getElementById('exam-edit-count').value), status: document.getElementById('exam-edit-status').value, instructions: document.getElementById('exam-edit-instructions').value });
      closeModal(true);
      toast('Exam settings updated. The direct link and QR now encode the revised configuration.', 'success');
      render();
    } catch (failure) {
      announce(failure.message, 'danger');
    }
  });
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') { if (modal.dataset.open === 'true') closeModal(); else if (drawer.dataset.open === 'true') closeDrawer(); return; }
    if (event.key !== 'Tab') return;
    const host = modal.dataset.open === 'true' ? modal : drawer.dataset.open === 'true' ? drawer : null;
    if (!host) return;
    const focusable = [...host.querySelectorAll('button:not([disabled]),a[href],input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])')].filter((node) => !node.hidden && node.getClientRects().length);
    if (!focusable.length) return;
    const first = focusable[0], last = focusable[focusable.length - 1];
    if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
    else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
  });
  window.addEventListener('popstate', render);
  document.getElementById('admin-global-search')?.addEventListener('keydown', (event) => { if (event.key === 'Enter') navigate('users', { q: event.currentTarget.value }); });

  const loadProctorHotfix = () => {
    const hotfix = document.createElement('script');
    hotfix.src = './js/admin-proctor-hotfix.js';
    hotfix.async = false;
    hotfix.addEventListener('load', enhanceExamDistribution, { once: true });
    document.head.append(hotfix);
  };
  if (window.FestacolProctorPolicy) loadProctorHotfix();
  else {
    const policy = document.createElement('script');
    policy.src = './js/proctor-policy.js';
    policy.async = false;
    policy.addEventListener('load', loadProctorHotfix, { once: true });
    document.head.append(policy);
  }

  Data.load().then((payload) => { data = payload; render(); }).catch((failure) => { chrome('overview'); root.innerHTML = `<section class="surface-raised mx-auto max-w-2xl p-7"><span class="badge badge-danger">Unable to start</span><h2 class="page-title mt-4">Question data unavailable</h2><p class="mt-3 text-sm leading-6 text-slate-600">${e(failure.message)}</p></section>`; announce(failure.message, 'danger'); });
