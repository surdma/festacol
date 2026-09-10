'use strict';
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
    root.focus({ preventScroll: true });
  }

  document.addEventListener('click', (event) => {
    const route = event.target.closest('[data-admin-route]'); if (route) { event.preventDefault(); navigate(route.dataset.adminRoute); return; }
    if (event.target.closest('[data-alert-close]')) { alertHost.className = 'hidden'; return; }
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
    if (event.target.closest('[data-copy-link]')) { const input = drawer.querySelector('[data-session-link]'); navigator.clipboard?.writeText(input.value).then(() => toast('Dynamic exam link copied.', 'success')).catch(() => { input.select(); document.execCommand?.('copy'); toast('Dynamic exam link selected for copying.', 'info'); }); return; }
    if (event.target.closest('[data-report-refresh]')) { toast('Report data refreshed from local attempts.', 'success'); render(); return; }
    const clear = event.target.closest('[data-clear-local]'); if (clear) { if (clear.dataset.clearLocal === 'sessions') Store.clearSessions(); if (clear.dataset.clearLocal === 'attempts') Store.clearAttempts(); if (clear.dataset.clearLocal === 'questions') Store.listCustomQuestions().forEach((q) => Store.deleteCustomQuestion(q.id)); toast('Selected local data cleared.', 'success'); Data.load().then((payload) => { data = payload; render(); }); }
  });

  document.addEventListener('change', (event) => {
    if (event.target.id === 'question-subject-filter') navigate('questions', { subject: event.target.value, level: qFilters().level, type: qFilters().type });
  });
  let userSearchTimer = null;
  document.addEventListener('input', (event) => {
    if (event.target.id === 'user-search') { window.clearTimeout(userSearchTimer); userSearchTimer = window.setTimeout(() => navigate('users', { role: userFilters().role, status: userFilters().status, q: event.target.value }, true), 220); }
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

  Data.load().then((payload) => { data = payload; render(); }).catch((failure) => { chrome('overview'); root.innerHTML = `<section class="surface-raised mx-auto max-w-2xl p-7"><span class="badge badge-danger">Unable to start</span><h2 class="page-title mt-4">Question data unavailable</h2><p class="mt-3 text-sm leading-6 text-slate-600">${e(failure.message)}</p></section>`; announce(failure.message, 'danger'); });
