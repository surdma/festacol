const { test, expect } = require('@playwright/test');

async function clearPrototypeStorage(page) {
  await page.goto('/prototype/admin.html?page=overview');
  await page.evaluate(() => { localStorage.clear(); sessionStorage.clear(); });
  await page.reload();
}

async function expectNoHorizontalOverflow(page) {
  const widths = await page.evaluate(() => ({
    scroll: document.documentElement.scrollWidth,
    client: document.documentElement.clientWidth
  }));
  expect(widths.scroll).toBeLessThanOrEqual(widths.client + 1);
}

async function createMathExam(page, { camera = false, seconds = 180, count = 2 } = {}) {
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
  if (camera) await cameraToggle.check();
  await page.locator('[data-v3-status="open"]').click();
  await page.locator('[data-v3-next]').click();
  await page.locator('[data-v3-next]').click();
  const linkInput = page.locator('[data-session-link]');
  await expect(linkInput).toBeVisible();
  const link = await linkInput.inputValue();
  expect(new URL(link).pathname).toContain('/prototype/exam.html');
  const token = new URL(link).searchParams.get('session');
  const sessionId = await page.evaluate((value) => window.FestacolSessionStore.decodeSession(value).id, token);
  return { link, sessionId };
}

async function loginPortal(page, first = 'Amina', last = 'Bello') {
  await page.goto('/prototype/student.html');
  await expect(page.locator('#student-sidebar')).toHaveCount(0);
  await page.locator('#student-first-name').fill(first);
  await page.locator('#student-last-name').fill(last);
  await page.locator('#student-login-form button[type="submit"]').click();
  await expect(page.locator('#student-sidebar')).toBeVisible();
}

async function loginStudent(page, link, first = 'Amina', last = 'Bello') {
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
  await expect(page.locator('#exam-timer')).toBeVisible();
}

async function submitFromReview(page) {
  await page.locator('[data-review]').first().click();
  await page.locator('[data-modal-target="submit-modal"]').click();
  await expect(page.locator('#submit-modal')).toBeVisible();
  await page.locator('[data-confirm-submit]').click();
}

test('direct exam link authenticates and renders the integrated exam workspace', async ({ page }) => {
  await clearPrototypeStorage(page);
  const { link } = await createMathExam(page, { count: 3 });
  await loginStudent(page, link);
  await expect(page.getByText(/Your timer starts only after/i)).toBeVisible();
  await startExam(page);
  await expect(page.locator('[data-answer-option]').first()).toBeVisible();
  await expect(page.locator('#question-map')).toBeVisible();
  await expect(page.locator('[data-previous]').first()).toBeDisabled();
  await expect(page.locator('[data-next]').first()).toBeVisible();
  const firstInput = page.locator('[data-answer-option] input').first();
  await firstInput.check({ force: true });
  await expect(page.getByText('Answered', { exact: true }).first()).toBeVisible();
  await expect(firstInput).toBeChecked();
  await expectNoHorizontalOverflow(page);
});

test('unfinished examination resumes the exact attempt and remaining time', async ({ page }) => {
  await clearPrototypeStorage(page);
  const { link, sessionId } = await createMathExam(page, { seconds: 180, count: 2 });
  await loginStudent(page, link);
  await startExam(page);
  await page.waitForTimeout(1100);
  const before = await page.evaluate((id) => {
    const S = window.FestacolSessionStore;
    const hash = S.getActiveCandidate(id);
    const state = S.getStudentState(id, hash);
    return { hash, startedAt: state.startedAt, attemptHash: state.attemptHash, remaining: state.remainingSeconds };
  }, sessionId);
  await page.reload();
  await expect(page.locator('#student-login-form')).toHaveCount(0);
  await expect(page.locator('[data-exam-workspace]')).toBeVisible();
  const resumed = await page.evaluate(({ id, hash }) => {
    const state = window.FestacolSessionStore.getStudentState(id, hash);
    return { startedAt: state.startedAt, attemptHash: state.attemptHash, remaining: state.remainingSeconds };
  }, { id: sessionId, hash: before.hash });
  expect(resumed.startedAt).toBe(before.startedAt);
  expect(resumed.attemptHash).toBe(before.attemptHash);
  expect(resumed.remaining).toBeLessThanOrEqual(before.remaining);
});

test('timeout auto-submits, locks the attempt and clears candidate authentication', async ({ page }) => {
  await clearPrototypeStorage(page);
  const { link, sessionId } = await createMathExam(page, { seconds: 180, count: 1 });
  await loginStudent(page, link);
  await startExam(page);
  await page.evaluate((id) => {
    const S = window.FestacolSessionStore;
    const hash = S.getActiveCandidate(id);
    const state = S.getStudentState(id, hash);
    state.remainingSeconds = 0.6;
    S.saveStudentState(id, hash, state);
  }, sessionId);
  await page.reload();
  await expect(page.locator('[data-exam-workspace]')).toBeVisible();
  await page.waitForTimeout(1700);
  await expect(page.getByText(/Time expired\. Your examination was submitted automatically/i)).toBeVisible();
  const locked = await page.evaluate((id) => {
    const S = window.FestacolSessionStore;
    return { auth: S.getStudentAuth(), active: S.getActiveCandidate(id), submitted: S.getAttempts().some((a) => a.sessionId === id && a.submittedAt) };
  }, sessionId);
  expect(locked.auth).toBe('');
  expect(locked.active).toBe('');
  expect(locked.submitted).toBe(true);
});

test('closing an active session auto-submits and signs the candidate out', async ({ page }) => {
  await clearPrototypeStorage(page);
  const { link, sessionId } = await createMathExam(page, { count: 1 });
  await loginStudent(page, link);
  await startExam(page);
  await page.evaluate((id) => window.FestacolSessionStore.updateSessionStatus(id, 'closed'), sessionId);
  await page.waitForTimeout(1300);
  await expect(page.getByText(/session ended\. Your work was submitted automatically/i)).toBeVisible();
  expect(await page.evaluate(() => window.FestacolSessionStore.getStudentAuth())).toBe('');
});

test('camera-required exam blocks start on denial and shows local preview when granted', async ({ page }) => {
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
  const { link } = await createMathExam(page, { camera: true, count: 1 });
  await loginStudent(page, link);
  await page.getByRole('button', { name: /Start examination/i }).click();
  await expect(page.locator('[data-camera-gate]')).toBeVisible();
  await expect(page.locator('[data-exam-workspace]')).toHaveCount(0);
  await page.evaluate(() => { window.__cameraAllowed = true; });
  await page.locator('[data-camera-retry]').click();
  await expect(page.locator('[data-camera-gate]')).toHaveCount(0);
  await page.getByRole('button', { name: /Start examination/i }).click();
  await expect(page.locator('[data-exam-workspace]')).toBeVisible();
  await expect(page.locator('[data-camera-preview]')).toBeVisible();
});

test('background reconciliation deducts away time without a second integrity owner', async ({ page }) => {
  await clearPrototypeStorage(page);
  const { link, sessionId } = await createMathExam(page, { seconds: 180, count: 1 });
  await loginStudent(page, link);
  await startExam(page);
  const result = await page.evaluate((id) => {
    const S = window.FestacolSessionStore;
    const hash = S.getActiveCandidate(id);
    const state = S.getStudentState(id, hash);
    const prior = state.remainingSeconds;
    const key = `festacol.exam.background-guard.v2:${id}:${hash}`;
    localStorage.setItem(key, JSON.stringify({ sessionId: id, candidateHash: hash, startedAt: state.startedAt, hiddenAt: Date.now() - 5000 }));
    const reconciliation = window.FestacolExamApp.reconcilePersistedBackground();
    const next = S.getStudentState(id, hash);
    return { prior, next: next.remainingSeconds, reconciliation, type: next.integrityEvents.at(-1)?.type };
  }, sessionId);
  expect(result.reconciliation.reconciled).toBe(true);
  expect(result.next).toBeLessThan(result.prior - 4);
  expect(result.type).toBe('background-resume-reconciled');
});

test('integrity events record focus and clipboard policy signals', async ({ page }) => {
  await clearPrototypeStorage(page);
  const { link, sessionId } = await createMathExam(page, { count: 1 });
  await loginStudent(page, link);
  await startExam(page);
  await page.evaluate(() => window.dispatchEvent(new Event('blur')));
  await page.evaluate(() => document.dispatchEvent(new ClipboardEvent('copy', { bubbles: true, cancelable: true })));
  const types = await page.evaluate((id) => {
    const S = window.FestacolSessionStore;
    const hash = S.getActiveCandidate(id);
    return S.getStudentState(id, hash).integrityEvents.map((event) => event.type);
  }, sessionId);
  expect(types).toContain('window-blur');
  expect(types).toContain('clipboard-copy');
});

test('manual submission stays authenticated while reopening the exam remains locked', async ({ page }) => {
  await clearPrototypeStorage(page);
  const { link } = await createMathExam(page, { count: 1 });
  await loginStudent(page, link);
  await startExam(page);
  await submitFromReview(page);
  await expect(page.getByText(/Examination submitted successfully/i)).toBeVisible();
  expect(await page.evaluate(() => window.FestacolSessionStore.getStudentAuth())).not.toBe('');
  await page.goto(link);
  await expect(page.getByText(/already been submitted/i)).toBeVisible();
});

test('exam controls adapt across mobile, tablet and desktop without horizontal overflow', async ({ page }) => {
  await clearPrototypeStorage(page);
  const { link } = await createMathExam(page, { count: 2 });
  await loginStudent(page, link);
  await startExam(page);
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(page.locator('#question-map')).toBeHidden();
  await expect(page.locator('[data-drawer-target="question-drawer"]').last()).toBeVisible();
  await expect(page.locator('article[data-exam-workspace] footer')).toBeHidden();
  await expectNoHorizontalOverflow(page);
  await page.setViewportSize({ width: 820, height: 1000 });
  await expect(page.locator('#question-map')).toBeHidden();
  await expect(page.locator('article[data-exam-workspace] footer')).toBeVisible();
  await expect(page.locator('[data-drawer-target="question-drawer"]').first()).toBeVisible();
  await expectNoHorizontalOverflow(page);
  await page.setViewportSize({ width: 1440, height: 1000 });
  await expect(page.locator('#question-map')).toBeVisible();
  await expect(page.locator('article[data-exam-workspace] footer [data-drawer-target="question-drawer"]')).toBeHidden();
  await expectNoHorizontalOverflow(page);
});

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

test('exam creation keeps direct QR distribution and safe pre-attempt editing', async ({ page }) => {
  await clearPrototypeStorage(page);
  const { link, sessionId } = await createMathExam(page, { seconds: 1800, count: 3 });
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

test('student portal remains credential-gated before dashboard chrome is exposed', async ({ page }) => {
  await clearPrototypeStorage(page);
  await page.goto('/prototype/student.html');
  await expect(page.locator('#student-login-form')).toBeVisible();
  await expect(page.locator('#student-sidebar')).toHaveCount(0);
  await loginPortal(page);
  await expect(page.getByText(/Use the examination link or QR code issued by your school/i)).toBeVisible();
});

test('an authenticated portal student opening an exam link skips duplicate login', async ({ page }) => {
  await clearPrototypeStorage(page);
  await loginPortal(page, 'Amina', 'Bello');
  const { link } = await createMathExam(page, { seconds: 1800, count: 2 });
  await page.goto(link);
  await expect(page.locator('#student-login-form')).toHaveCount(0);
  await expect(page.getByText('Before you begin', { exact: true })).toBeVisible();
});

test('admin reset invalidates unfinished state and forces fresh authentication', async ({ page }) => {
  await clearPrototypeStorage(page);
  const { link, sessionId } = await createMathExam(page, { seconds: 180, count: 1 });
  await loginStudent(page, link);
  await startExam(page);
  const original = await page.evaluate((id) => {
    const S = window.FestacolSessionStore;
    const hash = S.getActiveCandidate(id);
    const attempt = S.getStudentState(id, hash);
    return { hash, startedAt: attempt.startedAt };
  }, sessionId);
  await page.goto('/prototype/admin.html?page=exams');
  await page.locator(`[data-detail="exam"][data-id="${sessionId}"]`).first().click();
  const reset = page.locator(`[data-reset-attempt][data-candidate-hash="${original.hash}"]`);
  await expect(reset).toBeVisible();
  await reset.click();
  await page.goto(link);
  await expect(page.locator('#student-login-form')).toBeVisible();
  await loginStudent(page, link);
  await startExam(page);
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
    const session = S.normalizeSession({ mode: 'single', classLevel: 'SS2', classGroup: 'Science', subjects: ['mat'], durationSeconds: 1800, questionCount: 4, status: 'open' });
    const aHash = await E.candidateHash(session.id, 'Amina', 'Bello');
    const bHash = await E.candidateHash(session.id, 'David', 'Okafor');
    const paper = (hash) => E.paperForStudent(payload, session, hash).map((q) => `${q.id}:${(q.options || []).join('|')}`);
    return { a: paper(aHash), again: paper(aHash), b: paper(bHash) };
  });
  expect(result.a).toEqual(result.again);
  expect(result.b).not.toEqual(result.a);
});

test('answer details stay hidden while an exam is open and unlock after closure', async ({ page }) => {
  await clearPrototypeStorage(page);
  const { link, sessionId } = await createMathExam(page, { seconds: 1800, count: 1 });
  await loginStudent(page, link);
  await startExam(page);
  await submitFromReview(page);
  await page.goto('/prototype/student.html?page=analytics');
  await expect(page.getByText(/Answers remain locked/i)).toBeVisible();
  await expect(page.getByText(/Correct answer:/i)).toHaveCount(0);
  await page.evaluate((id) => window.FestacolSessionStore.updateSessionStatus(id, 'closed'), sessionId);
  await page.reload();
  await expect(page.getByText(/Answer review unlocked/i)).toBeVisible();
});

test('reports still expose all academic drill-down views', async ({ page }) => {
  await clearPrototypeStorage(page);
  for (const view of ['overview', 'exams', 'students', 'placements', 'promotions', 'integrity']) {
    await page.goto(`/prototype/admin.html?page=reports&view=${view}`);
    await expect(page.locator('.report-tabs a[aria-current="page"]')).toBeVisible();
    await expectNoHorizontalOverflow(page);
  }
});

test('mobile portal navigation remains usable before entering the responsive exam', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await clearPrototypeStorage(page);
  await loginPortal(page);
  await expect(page.locator('#student-menu')).toBeVisible();
  await expect(page.locator('#student-sidebar')).toBeHidden();
  await page.locator('#student-menu').click();
  await expect(page.locator('#student-sidebar')).toBeVisible();
  await expectNoHorizontalOverflow(page);
});
