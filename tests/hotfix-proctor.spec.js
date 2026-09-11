const { test, expect } = require('@playwright/test');

async function clearPrototypeStorage(page) {
  await page.goto('/prototype/admin.html?page=overview');
  await page.evaluate(() => { localStorage.clear(); sessionStorage.clear(); });
  await page.reload();
}

async function createMathExam(page, { camera = false, seconds = 180, count = 1 } = {}) {
  await page.goto('/prototype/admin.html?page=exams');
  await page.getByRole('button', { name: /Create exam/i }).first().click();
  await page.locator('[data-v3-mode="single"]').click();
  await page.locator('[data-v3-level="SS2"]').click();
  await page.locator('[data-v3-group="Science"]').click();
  await page.locator('[data-v3-next]').click();
  await page.locator('[data-v3-subject="mat"]').click();
  await page.locator('[data-v3-next]').click();
  await page.locator('#duration-range').evaluate((node, value) => {
    node.value = String(value);
    node.dispatchEvent(new Event('input', { bubbles: true }));
  }, seconds);
  await page.locator('#question-count-range').evaluate((node, value) => {
    node.value = String(value);
    node.dispatchEvent(new Event('input', { bubbles: true }));
  }, count);
  await page.locator('[data-v3-next]').click();
  const cameraToggle = page.locator('[data-proctor-camera]');
  await expect(cameraToggle).toBeVisible();
  await expect(cameraToggle).not.toBeChecked();
  if (camera) await cameraToggle.check();
  await page.locator('[data-v3-status="open"]').click();
  await page.locator('[data-v3-next]').click();
  await expect(page.locator('[data-proctor-review]')).toContainText(camera ? 'Required' : 'Off');
  await page.locator('[data-v3-next]').click();
  await expect(page.locator('[data-session-link]')).toBeVisible();
  const link = await page.locator('[data-session-link]').inputValue();
  const token = new URL(link).searchParams.get('session');
  const sessionId = await page.evaluate((value) => window.FestacolSessionStore.decodeSession(value).id, token);
  return { link, sessionId };
}

async function loginStudent(page, link, first = 'Amina', last = 'Bello') {
  await page.goto(link);
  await page.locator('#student-first-name').fill(first);
  await page.locator('#student-last-name').fill(last);
  await page.locator('#student-login-form button[type="submit"]').click();
}

test('camera proctoring is off by default and portable when admin enables it', async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'mediaDevices', {
      configurable: true,
      value: { getUserMedia: async () => new MediaStream() }
    });
  });
  await clearPrototypeStorage(page);
  const { link } = await createMathExam(page, { camera: true });
  expect(await page.evaluate((href) => window.FestacolProctorPolicy.policyFromUrl(href).cameraRequired, link)).toBe(true);
  expect(new URL(link).searchParams.has('camera')).toBe(false);

  await loginStudent(page, link);
  await expect(page.getByText(/Camera required for this exam/i)).toBeVisible();
  await page.locator('[data-enter-exam]').click();
  await page.getByRole('button', { name: 'Start examination' }).click();
  await expect(page.locator('.exam-card')).toBeVisible();
  await expect(page.locator('[data-camera-preview]')).toBeVisible();
  await expect(page.locator('[data-camera-preview]')).toContainText(/does not record, transmit, or automatically analyse/i);
});

test('background/minimize time is charged while intentional leave remains a resumable pause', async ({ page }) => {
  await clearPrototypeStorage(page);
  const { link, sessionId } = await createMathExam(page, { camera: false, seconds: 180 });
  expect(await page.evaluate((href) => window.FestacolProctorPolicy.policyFromUrl(href)?.cameraRequired || false, link)).toBe(false);
  expect(new URL(link).searchParams.has('camera')).toBe(false);
  await loginStudent(page, link);
  await page.locator('[data-enter-exam]').click();
  await page.getByRole('button', { name: 'Start examination' }).click();
  await expect(page.locator('.exam-card')).toBeVisible();

  const before = await page.evaluate((id) => {
    const S = window.FestacolSessionStore;
    const hash = S.getActiveCandidate(id);
    const state = S.getStudentState(id, hash);
    return { hash, startedAt: state.startedAt, remaining: state.remainingSeconds };
  }, sessionId);

  const cdp = await page.context().newCDPSession(page);
  await cdp.send('Page.setWebLifecycleState', { state: 'frozen' });
  await new Promise((resolve) => setTimeout(resolve, 2200));
  await cdp.send('Page.setWebLifecycleState', { state: 'active' });
  await page.waitForTimeout(1200);
  const afterFreeze = await page.evaluate(({ id, hash }) => window.FestacolSessionStore.getStudentState(id, hash).remainingSeconds, { id: sessionId, hash: before.hash });
  expect(afterFreeze).toBeLessThan(before.remaining - 2);

  const reconciled = await page.evaluate(({ id, hash, startedAt }) => {
    const S = window.FestacolSessionStore;
    const state = S.getStudentState(id, hash);
    const key = `festacol.exam.background-guard.v1:${id}:${hash}`;
    localStorage.setItem(key, JSON.stringify({ sessionId:id, candidateHash:hash, startedAt, hiddenAt:Date.now()-5000, intentionalExitAt:0, pagehideAt:0 }));
    const prior = state.remainingSeconds;
    const result = window.FestacolExamIntegrityHotfix.reconcilePersistedBackground();
    const next = S.getStudentState(id, hash);
    return { prior, next: next.remainingSeconds, result, lastEvent: next.integrityEvents.at(-1)?.type };
  }, { id: sessionId, hash: before.hash, startedAt: before.startedAt });
  expect(reconciled.result.reconciled).toBe(true);
  expect(reconciled.next).toBeLessThan(reconciled.prior - 4);
  expect(reconciled.lastEvent).toBe('background-resume-reconciled');
});

test('camera-required exam blocks start when camera permission is denied', async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'mediaDevices', {
      configurable: true,
      value: { getUserMedia: async () => { const error = new Error('Permission denied'); error.name = 'NotAllowedError'; throw error; } }
    });
  });
  await clearPrototypeStorage(page);
  const { link } = await createMathExam(page, { camera: true });
  await loginStudent(page, link);
  await page.locator('[data-enter-exam]').click();
  await page.getByRole('button', { name: 'Start examination' }).click();
  await expect(page.locator('[data-camera-gate]')).toBeVisible();
  await expect(page.getByText(/Camera permission was denied/i)).toBeVisible();
  await expect(page.locator('.exam-card')).toHaveCount(0);
  await expect(page.getByText(/does not record, upload, store, or automatically analyse/i)).toBeVisible();
});
