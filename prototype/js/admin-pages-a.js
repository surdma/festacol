'use strict';
  function overview() {
    const users = Store.listUsers();
    const classes = Store.listClasses();
    const sessions = Store.listSessions();
    const attempts = Store.getAttempts();
    const open = sessions.filter((item) => sessionState(item) === 'open');
    const submitted = attempts.filter((item) => item.submittedAt);
    root.innerHTML = `<div class="page-enter">
      ${pageHead('Academic operations', 'Good evening, Admin.', 'A dense operating view of students, classes, examinations and candidate activity.', `<button class="btn btn-primary" data-open-exam-wizard>${ICON.plus} Create exam</button>`)}
      <section class="kpi-grid stagger">${kpi('Students', users.filter((u) => u.role === 'student').length, `${users.filter((u) => u.status === 'active').length} active users`, 'brand', ICON.users)}${kpi('Classes', classes.filter((c) => c.status === 'active').length, 'SS1–SS3 groups', 'teal', ICON.users)}${kpi('Live exams', open.length, `${sessions.length} configured sessions`, 'amber', ICON.calendar)}${kpi('Submissions', submitted.length, `${attempts.length} total attempts`, 'violet', ICON.book)}</section>
      <div class="mt-5 grid gap-5 xl:grid-cols-12">
        <section class="surface-brand relative overflow-hidden p-6 sm:p-7 xl:col-span-8">
          <div class="relative z-10 max-w-xl"><span class="badge badge-brand">Control centre</span><h3 class="mt-4 font-display text-2xl font-extrabold tracking-tight text-slate-950 sm:text-3xl">Set up exams in minutes, then monitor every local attempt.</h3><p class="mt-3 max-w-lg text-sm leading-6 text-slate-600">Use class and subject presets, a guided four-step exam builder, reusable question domains and portable QR access.</p><div class="mt-5 flex flex-wrap gap-2"><button class="btn btn-primary" data-open-exam-wizard>${ICON.plus} New exam</button><a class="btn btn-secondary" href="${href('classes')}">Manage classes</a><a class="btn btn-secondary" href="${href('questions')}">Question bank</a></div></div>
          <img src="${ART.analytics}" alt="Team reviewing academic charts and dashboards" class="pointer-events-none absolute -bottom-8 right-0 hidden h-72 w-80 object-contain opacity-95 lg:block" loading="eager">
        </section>
        <aside class="surface overflow-hidden xl:col-span-4"><div class="border-b border-slate-200 px-5 py-4"><p class="eyebrow">Attention</p><h3 class="section-title mt-1">Operations queue</h3></div><div class="divide-y divide-slate-100">${[
          [`${sessions.filter((s) => s.status === 'draft').length} draft exams`, 'Finish configuration before sharing access.', 'warning'],
          [`${attempts.filter((a) => a.startedAt && !a.submittedAt).length} attempts in progress`, 'Student browsers still hold unfinished sessions.', 'brand'],
          [`${Store.listCustomQuestions().length} custom questions`, 'Locally authored items extend the JSON bank.', 'success']
        ].map(([title, detail, tone]) => `<div class="flex gap-3 p-4"><span class="mt-1 size-2.5 rounded-full bg-${tone === 'warning' ? 'amber' : tone === 'success' ? 'teal' : 'blue'}-500"></span><div><strong class="text-sm text-slate-900">${e(title)}</strong><p class="mt-1 text-xs leading-5 text-slate-500">${e(detail)}</p></div></div>`).join('')}</div></aside>
      </div>
      <div class="mt-5 grid gap-5 xl:grid-cols-12"><section class="surface overflow-hidden xl:col-span-8"><div class="flex items-center justify-between border-b border-slate-200 px-5 py-4"><div><p class="eyebrow">Recent activity</p><h3 class="section-title mt-1">Candidate attempts</h3></div><span class="badge badge-neutral">7-day view</span></div><div id="activity-chart" class="min-h-72 p-3"></div></section><section class="surface overflow-hidden xl:col-span-4"><div class="flex items-center justify-between border-b border-slate-200 px-5 py-4"><div><p class="eyebrow">Coming up</p><h3 class="section-title mt-1">Exam schedule</h3></div><a href="${href('exams')}" class="btn btn-quiet btn-sm">All exams</a></div><div class="divide-y divide-slate-100">${sessions.slice(0, 4).map((s) => `<button class="w-full p-4 text-left hover:bg-slate-50" data-detail="exam" data-id="${e(s.id)}"><div class="flex items-start justify-between gap-3"><div><strong class="text-sm text-slate-900">${e(s.title)}</strong><p class="mt-1 text-xs text-slate-500">${e(s.classLevel)} · ${e(coverage(s))}</p></div>${statusBadge(sessionState(s))}</div></button>`).join('') || `<div class="p-5 text-sm text-slate-500">No exam sessions yet.</div>`}</div></section></div>
    </div>`;
    renderActivityChart(attempts);
  }

  function renderActivityChart(attempts) {
    const host = document.getElementById('activity-chart');
    if (!host) return;
    if (!window.ApexCharts) { host.innerHTML = `<div class="grid min-h-64 place-items-center text-sm text-slate-500">${attempts.length} attempt record(s)</div>`; return; }
    const days = [...Array(7)].map((_, index) => { const day = new Date(); day.setHours(0, 0, 0, 0); day.setDate(day.getDate() - (6 - index)); return day; });
    const counts = days.map((day) => attempts.filter((attempt) => { const time = attempt.submittedAt || attempt.startedAt; return time && new Date(time).toDateString() === day.toDateString(); }).length);
    const chart = new ApexCharts(host, { chart: { type: 'area', height: 272, toolbar: { show: false }, fontFamily: 'DM Sans, sans-serif' }, series: [{ name: 'Attempts', data: counts }], colors: ['#315efb'], stroke: { curve: 'smooth', width: 3 }, fill: { type: 'gradient', gradient: { opacityFrom: .25, opacityTo: .03 } }, dataLabels: { enabled: false }, grid: { borderColor: '#e5ecf5', strokeDashArray: 4 }, xaxis: { categories: days.map((day) => day.toLocaleDateString('en-NG', { weekday: 'short' })), axisBorder: { show: false }, axisTicks: { show: false } }, yaxis: { min: 0, labels: { formatter: (value) => Number.isInteger(value) ? value : '' } }, tooltip: { theme: 'light' } });
    chart.render(); charts.push(chart);
  }

