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
  const linkInput = page.locator('[data-session-link]');
  await expect(linkInput).toBeVisible();
  await expect(page.locator('[data-exam-qr] svg')).toBeVisible();
  const link = await linkInput.inputValue();
  expect(new URL(link).pathname).toContain('/prototype/exam.html');
  const sessionId = await linkInput.evaluate((node) => {
    const token = new URL(node.value).searchParams.get('session');
    return window.FestacolSessionStore.decodeSession(token).id;
  });
  return { link, sessionId };
}

async function loginStudent(page, link, first = 'Amina', last = 'Bello') {
  await page.goto(link);
  await expect(page.locator('#student-login-form')).toBeVisible();
  await page.locator('#student-first-name').fill(first);
  await page.locator('#student-last-name').fill(last);
  await page.locator('#student-login-form button[type="submit"]').click();
  await expect(page.getByText('Before you begin', { exact: true })).toBeVisible();
}

async function loginPortal(page, first = 'Amina', last = 'Bello') {
  await page.goto('/prototype/student.html');
  await expect(page.locator('#student-sidebar')).toHaveCount(0);
  await page.locator('#student-first-name').fill(first);
  await page.locator('#student-last-name').fill(last);
  await page.locator('#student-login-form button[type="submit"]').click();
  await expect(page.locator('#student-sidebar')).toBeVisible();
}

test('admin routing remains unambiguous and responsive', async ({ page }) => {
  await clearPrototypeStorage(page);
  for (const route of ['overview', 'users', 'exams', 'classes', 'questions', 'reports', 'settings']) {
    const link = page.locator(`aside nav [data-admin-route="${route}"]`).first();
    await link.click();
    await expect(page).toHaveURL(new RegExp(`page=${route}`));
    await expect(link).toHaveAttribute('aria-current', 'page');
    await expectNoHorizontalOverflow(page);
  }
});

test('exam creation restores direct QR distribution and safe pre-attempt editing', async ({ page }) => {
  await clearPrototypeStorage(page);
  const { link, sessionId } = await createSingleMathExam(page, 1800, 3);
  expect(new URL(link).pathname).toContain('/prototype/exam.html');
  await expect(page.locator('[data-exam-qr] svg')).toHaveAttribute('aria-label', /QR code for the dynamic examination link/i);
  await page.locator(`[data-exam-edit="${sessionId}"]`).click();
  await expect(page.getByRole('heading', { name: 'Edit examination' })).toBeVisible();
  await page.locator('#exam-edit-title').fill('SS2 Mathematics Midterm');
  await page.locator('#exam-edit-duration').fill('2100');
  await page.locator('#exam-edit-instructions').fill('Answer every question and review before submission.');
  await page.locator('#exam-edit-form button[type="submit"]').click();
  const saved = await page.evaluate((id) => window.FestacolSessionStore.listSessions().find((item) => item.id === id), sessionId);
  expect(saved.title).toBe('SS2 Mathematics Midterm');
  expect(saved.durationSeconds).toBe(2100);
  expect(saved.instructions).toContain('review before submission');
});

test('student portal is credential-gated before any dashboard chrome is exposed', async ({ page }) => {
  await clearPrototypeStorage(page);
  await page.goto('/prototype/student.html');
  await expect(page.locator('#student-login-form')).toBeVisible();
  await expect(page.locator('#student-sidebar')).toHaveCount(0);
  await expect(page.getByText(/Private student workspace/i)).toBeVisible();
  await loginPortal(page);
  await expect(page.getByText(/Use the examination link or QR code issued by your school/i)).toBeVisible();
});

test('direct exam link authenticates then opens a dense instruction and examination workflow', async ({ page }) => {
  await clearPrototypeStorage(page);
  const { link } = await createSingleMathExam(page, 1800, 4);
  await loginStudent(page, link);
  await expect(page.getByText(/Read these instructions carefully/i)).toBeVisible();
  await expect(page.getByText(/Attempt 1 of 1/i)).toBeVisible();
  await page.getByRole('button', { name: 'Start examination' }).click();
  await expect(page.locator('.exam-card')).toBeVisible();
  await expect(page.locator('#question-map')).toBeVisible();
  await expect(page.locator('[data-clear-answer]')).toBeVisible();
  await expect(page.locator('[data-previous]')).toBeVisible();
  await expect(page.locator('[data-next]')).toBeVisible();
  await expect(page.locator('[data-review]').first()).toBeVisible();
  await expect(page.locator('#exam-timer')).toBeVisible();
  const response = page.locator('.exam-card input[type="radio"], .exam-card input[type="checkbox"]').first();
  await response.check({ force: true });
  await expect(page.getByText('answered', { exact: true }).first()).toBeVisible();
  await page.locator('[data-clear-answer]').click();
  await expect(page.getByText('unanswered', { exact: true }).first()).toBeVisible();
});

test('an already authenticated student opening an exam link skips login and reaches instructions', async ({ page }) => {
  await clearPrototypeStorage(page);
  await loginPortal(page, 'Amina', 'Bello');
  const { link } = await createSingleMathExam(page, 1800, 2);
  await page.goto(link);
  await expect(page.locator('#student-login-form')).toHaveCount(0);
  await expect(page.getByText('Before you begin', { exact: true })).toBeVisible();
});

test('unfinished exam resumes the same attempt without returning through dashboard', async ({ page }) => {
  await clearPrototypeStorage(page);
  const { link, sessionId } = await createSingleMathExam(page, 180, 2);
  await loginStudent(page, link);
  await page.getByRole('button', { name: 'Start examination' }).click();
  await page.waitForTimeout(1200);
  const before = await page.evaluate((id) => {
    const S = window.FestacolSessionStore;
    const hash = S.getActiveCandidate(id);
    const state = S.getStudentState(id, hash);
    return { hash, startedAt: state.startedAt, attemptHash: state.attemptHash, remainingSeconds: state.remainingSeconds };
  }, sessionId);
  await page.goto(link);
  await expect(page.locator('#student-login-form')).toHaveCount(0);
  await expect(page.locator('.exam-card')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Start examination' })).toHaveCount(0);
  const resumed = await page.evaluate(({ id, hash }) => {
    const state = window.FestacolSessionStore.getStudentState(id, hash);
    return { startedAt: state.startedAt, attemptHash: state.attemptHash, remainingSeconds: state.remainingSeconds };
  }, { id: sessionId, hash: before.hash });
  expect(resumed.startedAt).toBe(before.startedAt);
  expect(resumed.attemptHash).toBe(before.attemptHash);
  expect(resumed.remainingSeconds).toBeGreaterThan(before.remainingSeconds - 2);
});

test('submitted attempt remains locked when the QR or link is reopened', async ({ page }) => {
  await clearPrototypeStorage(page);
  const { link } = await createSingleMathExam(page, 1800, 1);
  await loginStudent(page, link);
  await page.getByRole('button', { name: 'Start examination' }).click();
  await page.locator('[data-review]').first().click();
  await page.locator('[data-submit]').click();
  await page.locator('[data-confirm-submit]').click();
  await expect(page.getByText(/Examination submitted successfully/i)).toBeVisible();
  await page.goto(link);
  await expect(page.getByText(/already been submitted/i)).toBeVisible();
  await expect(page.getByText(/Attempt complete/i)).toBeVisible();
});

test('admin reset invalidates unfinished state and forces fresh authentication', async ({ page }) => {
  await clearPrototypeStorage(page);
  const { link, sessionId } = await createSingleMathExam(page, 180, 1);
  await loginStudent(page, link);
  await page.getByRole('button', { name: 'Start examination' }).click();
  const original = await page.evaluate((id) => {
    const S = window.FestacolSessionStore;
    const hash = S.getActiveCandidate(id);
    const state = S.getStudentState(id, hash);
    return { hash, startedAt: state.startedAt };
  }, sessionId);
  await page.goto('/prototype/admin.html?page=exams');
  await page.locator(`[data-detail="exam"][data-id="${sessionId}"]`).first().click();
  const reset = page.locator(`[data-reset-attempt][data-candidate-hash="${original.hash}"]`);
  await expect(reset).toBeVisible();
  await reset.click();
  await page.goto(link);
  await expect(page.locator('#student-login-form')).toBeVisible();
  await loginStudent(page, link);
  await page.getByRole('button', { name: 'Start examination' }).click();
  const fresh = await page.evaluate((id) => {
    const S = window.FestacolSessionStore;
    const hash = S.getActiveCandidate(id);
    return S.getStudentState(id, hash).startedAt;
  }, sessionId);
  expect(fresh).toBeGreaterThan(original.startedAt);
});

test('student-specific papers remain deterministic and vary across candidate identities', async ({ page }) => {
  await clearPrototypeStorage(page);
  const result = await page.evaluate(async () => {
    const payload = await window.FestacolQuestionData.load();
    const S = window.FestacolSessionStore;
    const E = window.FestacolAssessmentEngine;
    const session = S.normalizeSession({ mode:'single', classLevel:'SS2', classGroup:'Science', subjects:['mat'], durationSeconds:1800, questionCount:4, status:'open' });
    const aHash = await E.candidateHash(session.id, 'Amina', 'Bello');
    const bHash = await E.candidateHash(session.id, 'David', 'Okafor');
    const paper = (hash) => E.paperForStudent(payload, session, hash).map((q) => `${q.id}:${(q.options||[]).join('|')}`);
    return { a: paper(aHash), again: paper(aHash), b: paper(bHash) };
  });
  expect(result.a).toEqual(result.again);
  expect(result.b).not.toEqual(result.a);
});

test('answer details stay hidden while an exam is open and unlock after closure', async ({ page }) => {
  await clearPrototypeStorage(page);
  const { link, sessionId } = await createSingleMathExam(page, 1800, 1);
  await loginStudent(page, link);
  await page.getByRole('button', { name: 'Start examination' }).click();
  await page.locator('[data-review]').first().click();
  await page.locator('[data-submit]').click();
  await page.locator('[data-confirm-submit]').click();
  await page.goto('/prototype/student.html?page=analytics');
  await expect(page.getByText(/Answers remain locked/i)).toBeVisible();
  await expect(page.getByText(/Correct answer:/i)).toHaveCount(0);
  await page.evaluate((id) => window.FestacolSessionStore.updateSessionStatus(id, 'closed'), sessionId);
  await page.reload();
  await expect(page.getByText(/Answer review unlocked/i)).toBeVisible();
});

test('reports still expose all academic drill-down views', async ({ page }) => {
  await clearPrototypeStorage(page);
  for (const view of ['overview','exams','students','placements','promotions','integrity']) {
    await page.goto(`/prototype/admin.html?page=reports&view=${view}`);
    await expect(page.locator('.report-tabs a[aria-current="page"]')).toBeVisible();
    await expectNoHorizontalOverflow(page);
  }
});

test('integrity signals continue to be recorded in the restored exam workspace', async ({ page }) => {
  await clearPrototypeStorage(page);
  const { link } = await createSingleMathExam(page, 1800, 1);
  await loginStudent(page, link);
  await page.getByRole('button', { name: 'Start examination' }).click();
  await page.evaluate(() => window.dispatchEvent(new Event('blur')));
  await expect(page.locator('#integrity-pill')).toContainText('Integrity 1');
});

test('mobile portal and exam surfaces avoid horizontal overflow', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await clearPrototypeStorage(page);
  await loginPortal(page);
  await expect(page.locator('#student-menu')).toBeVisible();
  await expect(page.locator('#student-sidebar')).toBeHidden();
  await page.locator('#student-menu').click();
  await expect(page.locator('#student-sidebar')).toBeVisible();
  await expectNoHorizontalOverflow(page);
  const { link } = await createSingleMathExam(page, 1800, 2);
  await page.goto(link);
  await expect(page.getByText('Before you begin', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Start examination' }).click();
  await expect(page.locator('[data-toggle-map]')).toBeVisible();
  await expectNoHorizontalOverflow(page);
});
