const { test, expect } = require('@playwright/test');

async function clearPrototypeStorage(page) {
  await page.goto('/admin.html?page=overview');
  await page.evaluate(() => { localStorage.clear(); sessionStorage.clear(); });
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Administration overview' })).toBeVisible();
  const url = new URL(page.url());
  expect(url.pathname).toMatch(/\/index\.html$/);
  expect(url.searchParams.get('route')).toBe('admin');
  expect(url.searchParams.get('page')).toBe('overview');
}

async function expectNoHorizontalOverflow(page) {
  const widths = await page.evaluate(() => ({
    scroll: document.documentElement.scrollWidth,
    client: document.documentElement.clientWidth
  }));
  expect(widths.scroll).toBeLessThanOrEqual(widths.client + 1);
}

async function setRange(page, selector, value) {
  await page.locator(selector).evaluate((node, next) => {
    node.value = String(next);
    node.dispatchEvent(new Event('input', { bubbles: true }));
  }, value);
}

async function expectSafeExternalLink(locator, expectedPart) {
  await expect(locator).toHaveAttribute('target', '_blank');
  await expect(locator).toHaveAttribute('rel', /noopener/);
  await expect(locator).toHaveAttribute('rel', /noreferrer/);
  const href = await locator.getAttribute('href');
  expect(href).toContain(expectedPart);
}

async function createExam(page, { camera = false, seconds = 180, count = 5 } = {}) {
  await page.goto('/admin.html?page=exams');
  await page.getByRole('button', { name: /Create exam/i }).first().click();
  await page.locator('[data-wizard-mode="mixed"]').click();
  await page.locator('[data-wizard-level="SS2"]').click();
  await page.locator('[data-wizard-group="Science"]').click();
  await page.locator('[data-wizard-next]').click();
  await page.locator('[data-wizard-subject="eng"]').click();
  await page.locator('[data-wizard-subject="mat"]').click();
  await page.locator('[data-wizard-next]').click();
  await expect(page.locator('#question-count-range')).toHaveAttribute('min', '5');
  await expect(page.locator('#question-count-range')).toHaveAttribute('max', '150');
  await setRange(page, '#duration-range', seconds);
  await setRange(page, '#question-count-range', count);
  await page.locator('[data-wizard-next]').click();
  await expect(page.locator('[data-proctor-camera]')).toBeVisible();
  if (camera) await page.locator('[data-proctor-camera]').check();
  await page.locator('[data-wizard-status="open"]').click();
  await page.locator('[data-wizard-next]').click();
  await page.locator('[data-wizard-next]').click();
  await expect(page.getByRole('heading', { name: 'Distribution ready' })).toBeVisible();
  await expect(page.locator('#created-exam-qr svg')).toBeVisible();
  await expect(page.locator('[data-session-link]')).toHaveCount(0);
  await expectSafeExternalLink(page.locator('#admin-dialog-content [data-open-qr-link]').first(), 'route=exam');
  return page.evaluate(() => {
    const { store, proctor } = window.Festacol;
    const session = store.listSessions()[0];
    return {
      id: session.id,
      link: proctor.decorateStudentLink(
        store.getSessionLink(session, location.href),
        proctor.getAdminPolicy(session.id).cameraRequired
      )
    };
  });
}

async function loginExam(page, link, first = 'Amina', last = 'Bello') {
  await page.goto(link);
  await expect(page.locator('#student-login-form')).toBeVisible();
  await page.locator('#student-first-name').fill(first);
  await page.locator('#student-last-name').fill(last);
  await page.locator('#student-login-form button[type="submit"]').click();
  await expect(page.getByText('Before you begin', { exact: true })).toBeVisible();
}

async function startExam(page) {
  await page.getByRole('button', { name: /Start examination/i }).click();
  await expect(page.locator('[data-exam-workspace]')).toBeVisible();
}

async function submitExam(page) {
  await page.locator('[data-review]').first().click();
  await page.locator('[data-modal-target="submit-modal"]').click();
  await expect(page.locator('#submit-modal')).toBeVisible();
  await page.locator('[data-confirm-submit]').click();
  await expect(page.getByText(/Examination submitted successfully/i)).toBeVisible();
}

test('admin canonical shell exposes eight routes and legacy users normalizes to students', async ({ page }) => {
  await clearPrototypeStorage(page);
  await expect(page.locator('[data-admin-dashboard]')).toBeVisible();
  await expect(page.locator('[data-admin-metric]')).toHaveCount(6);
  await expect(page.locator('[data-operations-queue]')).toBeVisible();
  await expect(page.locator('#desktop-nav [data-admin-route]')).toHaveCount(8);
  await expect(page.locator('#desktop-nav [data-admin-route="students"]')).toHaveCount(1);
  await expect(page.locator('#desktop-nav [data-admin-route="staff"]')).toHaveCount(1);
  await expect(page.locator('#desktop-nav [data-admin-route="reports"]')).toHaveCount(1);
  await expect(page.locator('#admin-detail-drawer')).toHaveCount(0);
  await expect(page.locator('link[href*="festacol.css"]')).toHaveCount(0);
  await expect(page.locator('link[href*="academic-v3.css"]')).toHaveCount(0);
  const sidebarWidth = await page.locator('aside.fixed.inset-y-0.left-0').first().evaluate((node) => getComputedStyle(node).width);
  expect(sidebarWidth).toBe('256px');

  for (const route of ['overview','students','staff','exams','classes','questions','reports','settings']) {
    await page.locator(`#desktop-nav [data-admin-route="${route}"]`).click();
    const url = new URL(page.url());
    expect(url.pathname).toMatch(/\/index\.html$/);
    expect(url.searchParams.get('route')).toBe('admin');
    expect(url.searchParams.get('page')).toBe(route);
    await expectNoHorizontalOverflow(page);
  }

  await page.goto('/admin.html?page=users&q=Amina');
  await expect(page.getByRole('heading', { name: 'Students' })).toBeVisible();
  const normalized = new URL(page.url());
  expect(normalized.pathname).toMatch(/\/index\.html$/);
  expect(normalized.searchParams.get('route')).toBe('admin');
  expect(normalized.searchParams.get('page')).toBe('students');
  expect(normalized.searchParams.get('q')).toBe('Amina');
});

test('admin compatibility alias preserves nested query state and back closes URL-backed record overlays', async ({ page }) => {
  await clearPrototypeStorage(page);
  await page.goto('/admin.html?page=students&q=Amina&tab=history');
  const routed = new URL(page.url());
  expect(routed.pathname).toMatch(/\/index\.html$/);
  expect(routed.searchParams.get('route')).toBe('admin');
  expect(routed.searchParams.get('page')).toBe('students');
  expect(routed.searchParams.get('q')).toBe('Amina');
  expect(routed.searchParams.get('tab')).toBe('history');

  await page.locator('[data-user-detail]').first().click();
  await expect(page.locator('#admin-dialog')).toBeVisible();
  const opened = new URL(page.url());
  expect(opened.searchParams.get('modal')).toBe('student');
  expect(opened.searchParams.get('student')).toBeTruthy();

  await page.goBack();
  await expect(page.locator('#admin-dialog')).toBeHidden();
  const restored = new URL(page.url());
  expect(restored.searchParams.get('page')).toBe('students');
  expect(restored.searchParams.get('q')).toBe('Amina');
  expect(restored.searchParams.get('modal')).toBeNull();
});

test('exam wizard exposes 5–150 question range, integrated proctoring and QR-only distribution', async ({ page }) => {
  await clearPrototypeStorage(page);
  const { id } = await createExam(page, { camera: true, count: 5 });
  expect(id).toMatch(/^[A-Z0-9-]+$/);
  await expect(page.getByText('Exam ID', { exact: true })).toBeVisible();
  await expect(page.locator('#admin-dialog-content').getByText(id, { exact: true })).toBeVisible();
  await expect(page.locator('input[readonly][value*="http"]')).toHaveCount(0);
  const policy = await page.evaluate((sessionId) => window.Festacol.proctor.getAdminPolicy(sessionId), id);
  expect(policy.cameraRequired).toBe(true);

  const created = new URL(page.url());
  expect(created.searchParams.get('modal')).toBe('exam-created');
  expect(created.searchParams.get('exam')).toBe(id);
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Distribution ready' })).toBeVisible();
  await expect(page.locator('#created-exam-qr svg')).toBeVisible();
  await page.getByRole('button', { name: 'Manage exam' }).click();
  await expect(page.locator('#exam-detail-qr svg')).toBeVisible();
  await expectSafeExternalLink(page.locator('#admin-dialog-content [data-open-qr-link]').first(), 'route=exam');
});

test('student can enter Exam ID and reach the same candidate login session without scanning QR', async ({ page }) => {
  await clearPrototypeStorage(page);
  const { id } = await createExam(page, { camera: false });
  await page.goto('/student.html');
  await page.getByRole('button', { name: 'Enter exam ID' }).click();
  await expect(page.getByRole('heading', { name: 'Enter the Exam ID.' })).toBeVisible();
  await page.locator('#exam-id-input').fill(id.toLowerCase());
  await page.locator('#exam-id-form button[type="submit"]').click();
  const url = new URL(page.url());
  expect(url.pathname).toMatch(/\/index\.html$/);
  expect(url.searchParams.get('route')).toBe('exam');
  expect(url.searchParams.get('session')).toBeTruthy();
  await expect(page.locator('#student-login-form')).toBeVisible();
});

test('exam compatibility alias preserves session state and forwards to the canonical exam route', async ({ page }) => {
  await clearPrototypeStorage(page);
  const { link } = await createExam(page, { camera: false });
  const canonical = new URL(link);
  const alias = new URL('/exam.html', canonical.origin);
  alias.search = canonical.search;
  alias.searchParams.set('candidate', 'compatibility-check');
  await page.goto(alias.href);
  const routed = new URL(page.url());
  expect(routed.pathname).toMatch(/\/index\.html$/);
  expect(routed.searchParams.get('route')).toBe('exam');
  expect(routed.searchParams.get('session')).toBeTruthy();
  expect(routed.searchParams.get('candidate')).toBe('compatibility-check');
  await expect(page.locator('#student-login-form')).toBeVisible();
});

test('camera requirement blocks exam start until permission is granted', async ({ page }) => {
  await page.addInitScript(() => {
    window.__cameraAllowed = false;
    Object.defineProperty(navigator, 'mediaDevices', {
      configurable: true,
      value: {
        getUserMedia: async () => {
          if (!window.__cameraAllowed) {
            const error = new Error('Permission denied');
            error.name = 'NotAllowedError';
            throw error;
          }
          return new MediaStream();
        }
      }
    });
  });
  await clearPrototypeStorage(page);
  const { link } = await createExam(page, { camera: true });
  await loginExam(page, link);
  await page.getByRole('button', { name: /Start examination/i }).click();
  await expect(page.locator('[data-camera-gate]')).toBeVisible();
  await expect(page.locator('[data-exam-workspace]')).toHaveCount(0);
  await page.evaluate(() => { window.__cameraAllowed = true; });
  await page.locator('[data-camera-retry]').click();
  await page.getByRole('button', { name: /Start examination/i }).click();
  await expect(page.locator('[data-exam-workspace]')).toBeVisible();
  await expect(page.locator('[data-camera-preview]')).toBeVisible();
});

test('timeout auto-submits and clears active candidate authentication', async ({ page }) => {
  await clearPrototypeStorage(page);
  const { link, id } = await createExam(page, { seconds: 180 });
  await loginExam(page, link);
  await startExam(page);
  const backgroundMarkerKey = await page.evaluate((sessionId) => {
    const S = window.Festacol.store;
    const hash = S.getActiveCandidate(sessionId);
    return `festacol.exam.background-guard.v2:${sessionId}:${hash}`;
  }, id);
  await page.goto('/index.html');
  await page.evaluate((key) => {
    const marker = JSON.parse(localStorage.getItem(key) || 'null');
    if (!marker?.hiddenAt) throw new Error('Exam page did not persist a background marker on leave.');
    marker.hiddenAt = Date.now() - 181000;
    localStorage.setItem(key, JSON.stringify(marker));
  }, backgroundMarkerKey);
  await page.goto(link);
  await page.waitForTimeout(1200);
  await expect(page.getByText(/Time expired\. Your examination was submitted automatically/i)).toBeVisible();
  const locked = await page.evaluate((sessionId) => {
    const S = window.Festacol.store;
    return {
      auth: S.getStudentAuth(),
      active: S.getActiveCandidate(sessionId),
      submitted: S.attemptsForSession(sessionId).some((a) => a.submittedAt)
    };
  }, id);
  expect(locked.auth).toBe('');
  expect(locked.active).toBe('');
  expect(locked.submitted).toBe(true);
});

test('submitted exam rewrite preserves original score and proctor log then allows a fresh attempt', async ({ page }) => {
  await clearPrototypeStorage(page);
  const { link, id } = await createExam(page);
  await loginExam(page, link);
  await startExam(page);
  await page.evaluate(() => window.dispatchEvent(new Event('blur')));
  await submitExam(page);
  const before = await page.evaluate((sessionId) => window.Festacol.store.attemptsForSession(sessionId).find((a) => a.submittedAt), id);
  expect(before.integrityEvents.some((event) => event.type === 'window-blur')).toBe(true);

  await page.goto('/admin.html?page=exams');
  await page.locator(`[data-exam-detail="${id}"]`).first().click();
  await page.locator(`[data-attempt-detail="${before.attemptHash}"]`).click();
  await expect(page.getByText('Integrity / proctor log')).toBeVisible();
  await page.getByRole('button', { name: 'Authorize rewrite' }).click();
  await page.getByRole('button', { name: 'Authorize rewrite' }).last().click();
  const archived = await page.evaluate((sessionId) => window.Festacol.store.attemptsForSession(sessionId).find((a) => a.rewriteArchivedAt), id);
  expect(archived.score).toBe(before.score);
  expect(archived.integrityEvents.some((event) => event.type === 'window-blur')).toBe(true);

  await page.goto(link);
  await expect(page.locator('#student-login-form')).toBeVisible();
  await page.locator('#student-first-name').fill('Amina');
  await page.locator('#student-last-name').fill('Bello');
  await page.locator('#student-login-form button[type="submit"]').click();
  await startExam(page);
  const attempts = await page.evaluate((sessionId) => window.Festacol.store.attemptsForSession(sessionId), id);
  expect(attempts.some((a) => a.rewriteArchivedAt)).toBe(true);
  expect(attempts.some((a) => !a.rewriteArchivedAt && !a.submittedAt)).toBe(true);
});

test('exam settings remain editable while structural paper fields lock after a candidate starts', async ({ page }) => {
  await clearPrototypeStorage(page);
  const { link, id } = await createExam(page);
  await loginExam(page, link);
  await startExam(page);
  await page.goto('/admin.html?page=exams');
  await page.locator(`[data-exam-detail="${id}"]`).first().click();
  await page.getByRole('button', { name: /Edit settings/i }).click();
  await expect(page.locator('#exam-edit-count')).toBeDisabled();
  await expect(page.locator('#exam-edit-duration')).toBeDisabled();
  await page.locator('#exam-edit-title').fill('Updated SS2 Integrated Assessment');
  await page.locator('#exam-edit-camera').check();
  await page.locator('#exam-edit-form button[type="submit"]').click();
  const saved = await page.evaluate((sessionId) => ({
    session: window.Festacol.store.findSessionById(sessionId),
    policy: window.Festacol.proctor.getAdminPolicy(sessionId)
  }), id);
  expect(saved.session.title).toBe('Updated SS2 Integrated Assessment');
  expect(saved.policy.cameraRequired).toBe(true);
});

test('WhatsApp group board associates one validated group with its intended class and renders QR', async ({ page }) => {
  await clearPrototypeStorage(page);
  await page.goto('/admin.html?page=classes');
  await page.getByRole('button', { name: /Add WhatsApp group/i }).first().click();
  const classId = await page.locator('#whatsapp-class option').nth(1).getAttribute('value');
  await page.locator('#whatsapp-class').selectOption(classId);
  await page.locator('#whatsapp-name').fill('SS1 Parents');
  await page.locator('#whatsapp-link').fill('https://chat.whatsapp.com/ABCDEFGHIJKLMNOPQRSTUV');
  await page.locator('#whatsapp-form button[type="submit"]').click();
  await expect(page.locator('#whatsapp-qr svg')).toBeVisible();
  await expectSafeExternalLink(page.locator('#whatsapp-form [data-open-qr-link]'), 'chat.whatsapp.com');
  const group = await page.evaluate((id) => window.Festacol.store.whatsAppGroupForClass(id), classId);
  expect(group.name).toBe('SS1 Parents');
  expect(group.inviteUrl).toContain('chat.whatsapp.com');
});

test('invalid WhatsApp URL is rejected inline and not stored', async ({ page }) => {
  await clearPrototypeStorage(page);
  await page.goto('/admin.html?page=classes');
  await page.getByRole('button', { name: /Add WhatsApp group/i }).first().click();
  await page.locator('#whatsapp-class').selectOption({ index: 1 });
  await page.locator('#whatsapp-name').fill('Wrong group');
  await page.locator('#whatsapp-link').fill('https://example.com/not-whatsapp');
  await page.locator('#whatsapp-form button[type="submit"]').click();
  await expect(page.locator('#whatsapp-error')).toBeVisible();
  expect(await page.evaluate(() => window.Festacol.store.listWhatsAppGroups().length)).toBe(0);
});

test('admin exam/student relationships expose exact per-attempt integrity records', async ({ page }) => {
  await clearPrototypeStorage(page);
  const { link, id } = await createExam(page);
  await loginExam(page, link, 'Amina', 'Bello');
  await startExam(page);
  await page.evaluate(() => {
    window.dispatchEvent(new Event('blur'));
    document.dispatchEvent(new ClipboardEvent('copy', { bubbles: true, cancelable: true }));
  });
  await submitExam(page);
  const relation = await page.evaluate((sessionId) => {
    const S = window.Festacol.store;
    const a = S.attemptsForSession(sessionId).find((x) => x.submittedAt);
    return {
      studentHash: a.studentHash,
      events: a.integrityEvents.map((e) => e.type),
      count: S.attemptsForStudent(a.studentHash).length
    };
  }, id);
  expect(relation.studentHash).toBeTruthy();
  expect(relation.events).toContain('window-blur');
  expect(relation.events).toContain('clipboard-copy');
  expect(relation.count).toBeGreaterThan(0);
  await page.goto('/admin.html?page=reports&view=integrity');
  await expect(page.getByText(/Amina Bello · window-blur/i)).toBeVisible();
});

test('admin dialogs remain within mobile, tablet and desktop viewport bounds', async ({ page }) => {
  await clearPrototypeStorage(page);
  for (const viewport of [{ width: 390, height: 844 }, { width: 820, height: 1000 }, { width: 1440, height: 1000 }]) {
    await page.setViewportSize(viewport);
    await page.goto('/admin.html?page=exams');
    await page.getByRole('button', { name: /Create exam/i }).first().click();
    const box = await page.locator('#admin-dialog-panel').boundingBox();
    expect(box.x).toBeGreaterThanOrEqual(0);
    expect(box.y).toBeGreaterThanOrEqual(0);
    expect(box.x + box.width).toBeLessThanOrEqual(viewport.width + 1);
    expect(box.y + box.height).toBeLessThanOrEqual(viewport.height + 1);
    await expectNoHorizontalOverflow(page);
    await page.locator('[data-close-dialog]').click();
  }
});

test('mobile navigation exposes eight destinations and student tables collapse into touch-friendly cards', async ({ page }) => {
  await clearPrototypeStorage(page);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.locator('#mobile-nav-button').click();
  await expect(page.locator('#mobile-nav-dialog')).toBeVisible();
  await expect(page.locator('#mobile-nav [data-admin-route]')).toHaveCount(8);
  await page.locator('#mobile-nav [data-admin-route="students"]').click();
  const url = new URL(page.url());
  expect(url.searchParams.get('page')).toBe('students');
  await expect(page.locator('table')).toBeHidden();
  await expect(page.locator('div.md\\:hidden [data-user-detail]').first()).toBeVisible();
  await expectNoHorizontalOverflow(page);
});
