const { test, expect } = require('@playwright/test');

async function clearPrototypeStorage(page) {
  await page.goto('/prototype/admin.html?page=overview');
  await page.evaluate(() => { localStorage.clear(); sessionStorage.clear(); });
  await page.reload();
}
async function expectNoHorizontalOverflow(page) {
  const widths = await page.evaluate(() => ({ scroll: document.documentElement.scrollWidth, client: document.documentElement.clientWidth }));
  expect(widths.scroll).toBeLessThanOrEqual(widths.client + 1);
}
async function createSingleMathExam(page, seconds = 1800, count = 4) {
  await page.goto('/prototype/admin.html?page=exams');
  await page.getByRole('button', { name: /Create exam/i }).first().click();
  await page.locator('[data-v3-mode="single"]').click();
  await page.locator('[data-v3-level="SS2"]').click();
  await page.locator('[data-v3-group="Science"]').click();
  await page.locator('[data-v3-next]').click();
  await page.locator('[data-v3-subject="mat"]').click();
  await page.locator('[data-v3-next]').click();
  await page.locator('#duration-range').evaluate((node, value) => { node.value = String(value); node.dispatchEvent(new Event('input', { bubbles: true })); }, seconds);
  await page.locator('#question-count-range').evaluate((node, value) => { node.value = String(value); node.dispatchEvent(new Event('input', { bubbles: true })); }, count);
  await page.locator('[data-v3-next]').click();
  await page.locator('[data-v3-status="open"]').click();
  await page.locator('[data-v3-next]').click();
  await page.locator('[data-v3-next]').click();
  await expect(page.locator('[data-session-link]')).toBeVisible();
  return { link: await page.locator('[data-session-link]').inputValue(), sessionId: await page.locator('[data-session-link]').evaluate((node) => {
    const token = new URL(node.value).searchParams.get('session');
    return window.FestacolSessionStore.decodeSession(token).id;
  }) };
}
async function loginStudent(page, link, first = 'Amina', last = 'Bello') {
  await page.goto(link);
  await expect(page.locator('#student-login-form')).toBeVisible();
  await page.locator('#student-first-name').fill(first);
  await page.locator('#student-last-name').fill(last);
  await page.locator('#student-login-form button[type="submit"]').click();
}

test('admin query routing is unambiguous and responsive', async ({ page }) => {
  await clearPrototypeStorage(page);
  for (const [route, label] of [['overview','Overview'],['users','Users'],['exams','Exams'],['classes','Classes'],['questions','Questions'],['reports','Reports'],['settings','Settings']]) {
    const link = page.locator(`aside nav [data-admin-route="${route}"]`).first();
    await link.click();
    await expect(page).toHaveURL(new RegExp(`page=${route}`));
    await expect(page.locator('#admin-page-label')).toHaveText(label);
    await expect(link).toHaveAttribute('aria-current', 'page');
    await expectNoHorizontalOverflow(page);
  }
});

test('classes are organized by SS level and academic stream groups', async ({ page }) => {
  await clearPrototypeStorage(page);
  await page.goto('/prototype/admin.html?page=classes');
  await expect(page.getByText('SS1 academic groups')).toBeVisible();
  await expect(page.getByText('SS2 academic groups')).toBeVisible();
  await expect(page.getByText('SS3 academic groups')).toBeVisible();
  await expect(page.getByText('SS1 Qualifier Pool', { exact: true })).toBeVisible();
  await expect(page.getByText('SS1 Science', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: /New class/i }).click();
  await page.locator('[data-class-v3-level="SS1"]').click();
  await expect(page.locator('[data-class-v3-stream="Qualifier"]')).toBeVisible();
});

test('qualifier wizard supports placement tracks, subject combinations and 30-second to 3-hour sliders', async ({ page }) => {
  await clearPrototypeStorage(page);
  await page.goto('/prototype/admin.html?page=exams');
  await page.getByRole('button', { name: /Create exam/i }).first().click();
  await page.locator('[data-v3-mode="qualifier"]').click();
  await expect(page.locator('[data-v3-level="SS1"]')).toHaveAttribute('aria-pressed', 'true');
  await page.locator('[data-v3-next]').click();
  await expect(page.locator('[data-v3-track="Science"]')).toBeVisible();
  await expect(page.locator('[data-v3-track="Arts"]')).toBeVisible();
  await expect(page.locator('[data-v3-track="Social Science"]')).toBeVisible();
  expect(await page.locator('[data-v3-subject][aria-pressed="true"]').count()).toBeGreaterThanOrEqual(2);
  await page.locator('[data-v3-next]').click();
  await expect(page.locator('#duration-range')).toHaveAttribute('min', '30');
  await expect(page.locator('#duration-range')).toHaveAttribute('max', '10800');
  await page.locator('#duration-range').evaluate((node) => { node.value = '30'; node.dispatchEvent(new Event('input', { bubbles: true })); });
  await expect(page.locator('#duration-value')).toContainText('30 sec');
  await page.locator('#duration-range').evaluate((node) => { node.value = '10800'; node.dispatchEvent(new Event('input', { bubbles: true })); });
  await expect(page.locator('#duration-value')).toContainText('3 hrs');
  await expect(page.locator('#question-count-range')).toHaveAttribute('min', '1');
});

test('student dashboard uses sidebar, candidate credentials and one-attempt lock', async ({ page }) => {
  await clearPrototypeStorage(page);
  const { link } = await createSingleMathExam(page, 1800, 1);
  await loginStudent(page, link);
  await expect(page.locator('#student-sidebar')).toBeVisible();
  await expect(page.getByText(/Attempt 1 of 1/i)).toBeVisible();
  await page.locator('[data-enter-exam]').click();
  await page.getByRole('button', { name: 'Start examination' }).click();
  await expect(page.locator('.exam-card')).toBeVisible();
  await page.locator('[data-review]').click();
  await page.locator('[data-submit]').click();
  await page.locator('[data-confirm-submit]').click();
  await expect(page.getByText(/Attempt locked/i)).toBeVisible();
  await page.goto(link);
  await expect(page.getByText(/Attempt locked/i)).toBeVisible();
  await expect(page.locator('[data-enter-exam]')).toHaveCount(0);
});

test('student credentials use first name as username and last name as password', async ({ page }) => {
  await clearPrototypeStorage(page);
  const { link } = await createSingleMathExam(page, 1800, 1);
  await page.goto(link);
  await expect(page.getByLabel('First name · username')).toBeVisible();
  const password = page.getByLabel('Last name · password');
  await expect(password).toBeVisible();
  await expect(password).toHaveAttribute('type', 'password');
});

test('unfinished exam resumes the same attempt and does not consume time while away', async ({ page }) => {
  await clearPrototypeStorage(page);
  const { link, sessionId } = await createSingleMathExam(page, 180, 1);
  await loginStudent(page, link);
  await page.locator('[data-enter-exam]').click();
  await page.getByRole('button', { name: 'Start examination' }).click();
  await expect(page.locator('.exam-card')).toBeVisible();
  await page.waitForTimeout(1200);
  const before = await page.evaluate((id) => {
    const S = window.FestacolSessionStore;
    const candidateHash = S.getActiveCandidate(id);
    const state = S.getStudentState(id, candidateHash);
    return { candidateHash, startedAt: state.startedAt, attemptHash: state.attemptHash, remainingSeconds: state.remainingSeconds };
  }, sessionId);
  await page.goto(link);
  await expect(page.locator('[data-enter-exam]')).toContainText('Resume examination');
  await page.waitForTimeout(2200);
  const paused = await page.evaluate(({ id, hash }) => window.FestacolSessionStore.getStudentState(id, hash).remainingSeconds, { id: sessionId, hash: before.candidateHash });
  expect(paused).toBeGreaterThan(before.remainingSeconds - 1.5);
  await page.locator('[data-enter-exam]').click();
  await expect(page.locator('.exam-card')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Start examination' })).toHaveCount(0);
  const resumed = await page.evaluate(({ id, hash }) => {
    const state = window.FestacolSessionStore.getStudentState(id, hash);
    return { startedAt: state.startedAt, attemptHash: state.attemptHash };
  }, { id: sessionId, hash: before.candidateHash });
  expect(resumed.startedAt).toBe(before.startedAt);
  expect(resumed.attemptHash).toBe(before.attemptHash);
});

test('admin can reset an unfinished attempt and candidate must authenticate before a fresh start', async ({ page }) => {
  await clearPrototypeStorage(page);
  const { link, sessionId } = await createSingleMathExam(page, 180, 1);
  await loginStudent(page, link);
  await page.locator('[data-enter-exam]').click();
  await page.getByRole('button', { name: 'Start examination' }).click();
  const original = await page.evaluate((id) => {
    const S = window.FestacolSessionStore;
    const candidateHash = S.getActiveCandidate(id);
    const state = S.getStudentState(id, candidateHash);
    return { candidateHash, startedAt: state.startedAt };
  }, sessionId);
  await page.goto('/prototype/admin.html?page=exams');
  await page.locator(`[data-detail="exam"][data-id="${sessionId}"]`).first().click();
  const reset = page.locator(`[data-reset-attempt][data-candidate-hash="${original.candidateHash}"]`);
  await expect(reset).toBeVisible();
  await reset.click();
  const resetState = await page.evaluate(({ id, hash }) => ({ attempt: window.FestacolSessionStore.findAttempt(id, hash), state: window.FestacolSessionStore.getStudentState(id, hash), resetAt: window.FestacolSessionStore.getAttemptResetAt(id, hash) }), { id: sessionId, hash: original.candidateHash });
  expect(resetState.attempt).toBeNull(); expect(resetState.state).toBeNull(); expect(resetState.resetAt).toBeGreaterThanOrEqual(original.startedAt);
  await page.goto(link); await expect(page.locator('#student-login-form')).toBeVisible();
  await loginStudent(page, link); await expect(page.locator('[data-enter-exam]')).toContainText('Review & start');
  await page.locator('[data-enter-exam]').click(); await page.getByRole('button', { name: 'Start examination' }).click();
  const freshStartedAt = await page.evaluate((id) => { const S=window.FestacolSessionStore;const hash=S.getActiveCandidate(id);return S.getStudentState(id,hash).startedAt; }, sessionId);
  expect(freshStartedAt).toBeGreaterThan(resetState.resetAt);
});

test('student-specific papers are deterministic but vary across candidate hashes', async ({ page }) => {
  await clearPrototypeStorage(page);
  const result = await page.evaluate(async () => {
    const payload = await window.FestacolQuestionData.load();
    const session = window.FestacolSessionStore.normalizeSession({ mode:'single', classLevel:'SS2', classGroup:'Science', subjects:['mat'], durationSeconds:1800, questionCount:4, status:'open' });
    const engine = window.FestacolAssessmentEngine;
    const aHash = await engine.candidateHash(session.id, 'Amina', 'Bello'); const bHash = await engine.candidateHash(session.id, 'David', 'Okafor');
    const a = engine.paperForStudent(payload, session, aHash).map((q) => `${q.id}:${(q.options||[]).join('|')}`); const aAgain = engine.paperForStudent(payload, session, aHash).map((q) => `${q.id}:${(q.options||[]).join('|')}`); const b = engine.paperForStudent(payload, session, bHash).map((q) => `${q.id}:${(q.options||[]).join('|')}`);
    return { a, aAgain, b };
  });
  expect(result.a).toEqual(result.aAgain); expect(result.b).not.toEqual(result.a);
});

test('answer details stay hidden while exam is open and unlock after admin closure', async ({ page }) => {
  await clearPrototypeStorage(page); const { link, sessionId } = await createSingleMathExam(page, 1800, 1); await loginStudent(page, link);
  await page.locator('[data-enter-exam]').click(); await page.getByRole('button', { name: 'Start examination' }).click(); await page.locator('[data-review]').click(); await page.locator('[data-submit]').click(); await page.locator('[data-confirm-submit]').click();
  await page.goto(new URL(link).pathname + new URL(link).search + '&page=analytics'); await expect(page.getByText(/Answers remain locked/i)).toBeVisible(); await expect(page.getByText(/Correct answer:/i)).toHaveCount(0);
  await page.evaluate((id) => window.FestacolSessionStore.updateSessionStatus(id, 'closed'), sessionId); await page.reload(); await expect(page.getByText(/Answer review unlocked/i)).toBeVisible();
});

test('reports expose exam, student, placement, promotion and integrity drill downs', async ({ page }) => {
  await clearPrototypeStorage(page); for (const view of ['overview','exams','students','placements','promotions','integrity']) { await page.goto(`/prototype/admin.html?page=reports&view=${view}`); await expect(page.locator('.report-tabs a[aria-current="page"]')).toBeVisible(); await expectNoHorizontalOverflow(page); }
});

test('tab/minimize integrity signal is recorded during an active exam', async ({ page }) => {
  await clearPrototypeStorage(page); const { link } = await createSingleMathExam(page, 1800, 1); await loginStudent(page, link); await page.locator('[data-enter-exam]').click(); await page.getByRole('button', { name: 'Start examination' }).click(); await page.evaluate(() => window.dispatchEvent(new Event('blur'))); await expect(page.locator('#integrity-pill')).toContainText('Integrity 1');
});

test('student sidebar collapses to mobile navigation without overflow', async ({ page }) => {
  await page.setViewportSize({ width:390, height:844 }); await clearPrototypeStorage(page); const { link } = await createSingleMathExam(page, 1800, 1); await page.goto(link); await expect(page.locator('#student-menu')).toBeVisible(); await expect(page.locator('#student-sidebar')).toBeHidden(); await page.locator('#student-menu').click(); await expect(page.locator('#student-sidebar')).toBeVisible(); await expectNoHorizontalOverflow(page);
});

test('core controls retain visible focus and official Flowbite illustration usage', async ({ page }) => {
  await page.goto('/prototype/admin.html?page=overview'); const create = page.getByRole('button', { name:/Create exam/i }).first(); await create.focus(); const metrics = await create.evaluate((node) => ({ height:node.getBoundingClientRect().height, outline:getComputedStyle(node).outlineStyle })); expect(metrics.height).toBeGreaterThanOrEqual(38); expect(metrics.height).toBeLessThanOrEqual(48); expect(metrics.outline).not.toBe('none'); await expect(page.locator('img[src*="flowbite-illustrations"]').first()).toBeAttached();
});
