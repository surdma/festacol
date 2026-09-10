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

async function createSingleMathExam(page) {
  await page.goto('/prototype/admin.html?page=exams');
  await page.getByRole('button', { name: /Create exam/i }).first().click();
  await expect(page).toHaveURL(/page=exams&modal=exam-create&step=1/);
  await expect(page.getByRole('dialog')).toBeVisible();
  await page.locator('[data-wizard-mode="single"]').click();
  await page.locator('[data-wizard-level="SS2"]').click();
  await page.locator('[data-wizard-next]').click();
  await expect(page).toHaveURL(/step=2/);
  await page.locator('[data-wizard-subject="mat"]').click();
  await page.locator('[data-wizard-next]').click();
  await expect(page).toHaveURL(/step=3/);
  await page.locator('[data-wizard-count="4"]').click();
  await page.locator('[data-wizard-duration="30"]').click();
  await page.locator('[data-wizard-status="open"]').click();
  await page.locator('[data-wizard-next]').click();
  await expect(page).toHaveURL(/step=4/);
  await page.locator('[data-wizard-next]').click();
  await expect(page.locator('#session-qr svg')).toBeVisible();
  return page.locator('[data-session-link]').inputValue();
}

test('admin query routing exposes the full operations information architecture', async ({ page }) => {
  await clearPrototypeStorage(page);
  const routes = [
    ['overview', 'Overview'],
    ['users', 'Users'],
    ['exams', 'Exams'],
    ['classes', 'Classes'],
    ['questions', 'Questions'],
    ['reports', 'Reports'],
    ['settings', 'Settings']
  ];
  for (const [route, label] of routes) {
    await page.locator(`aside [data-admin-route="${route}"]`).click();
    await expect(page).toHaveURL(new RegExp(`page=${route}`));
    await expect(page.locator('#admin-page-label')).toHaveText(label);
    await expect(page.locator(`aside [data-admin-route="${route}"]`)).toHaveAttribute('aria-current', 'page');
    await expectNoHorizontalOverflow(page);
  }
});

test('admin manages users and classes through modal workflows', async ({ page }) => {
  await clearPrototypeStorage(page);
  await page.goto('/prototype/admin.html?page=users');
  await page.getByRole('button', { name: 'Add user' }).first().click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await page.locator('#new-user-name').fill('Kemi Adebayo Martins');
  await page.locator('[data-class-choice="ss2-science"]').click();
  await page.locator('#user-create-form button[type="submit"]').click();
  await expect(page.getByText('Kemi Adebayo Martins', { exact: true })).toBeVisible();

  await page.goto('/prototype/admin.html?page=classes');
  await page.getByRole('button', { name: 'New class' }).click();
  await page.locator('[data-level-choice="SS3"]').click();
  await page.locator('[data-stream-choice="General"]').click();
  await page.locator('[data-capacity-choice="60"]').click();
  await page.locator('#class-create-form button[type="submit"]').click();
  await expect(page.getByText('SS3 General', { exact: true })).toBeVisible();
});

test('exam wizard creates a dynamic session and student completes the dashboard-to-exam handoff', async ({ page, context }) => {
  await clearPrototypeStorage(page);
  const studentLink = await createSingleMathExam(page);
  expect(studentLink).toContain('/prototype/student.html?session=');

  const student = await context.newPage();
  await student.goto(studentLink);
  await expect(student.getByText(/SS2 Examination/i).first()).toBeVisible();
  await expect(student.locator('#student-full-name')).toBeVisible();
  await student.locator('#student-full-name').fill('Amina Yusuf Bello');
  await student.locator('#student-identity-form button[type="submit"]').click();
  await expect(student.getByText(/Welcome, Amina/i)).toBeVisible();
  await student.getByRole('button', { name: /Review & enter exam/i }).click();
  await expect(student).toHaveURL(/exam\.html\?session=/);
  await expect(student.getByRole('button', { name: 'Start examination' })).toBeVisible();
  await student.getByRole('button', { name: 'Start examination' }).click();
  await expect(student.locator('#timer-text')).toBeVisible();
  await expect(student.locator('.exam-card')).toBeVisible();
  await expect(student.locator('input[name^="question-"]').first()).toBeAttached();
  await expectNoHorizontalOverflow(student);
});

test('question authoring extends the local question bank without editing JSON', async ({ page }) => {
  await clearPrototypeStorage(page);
  await page.goto('/prototype/admin.html?page=questions');
  await page.getByRole('button', { name: 'Add question' }).click();
  await page.locator('[data-new-q-type="boolean"]').click();
  await page.locator('#new-question-prompt').fill('A balanced diet supports healthy growth.');
  await page.locator('#question-create-form button[type="submit"]').click();
  await expect(page.getByText('A balanced diet supports healthy growth.', { exact: true })).toBeVisible();
});

test('student dashboard never invents an exam when no dynamic token exists', async ({ page }) => {
  await page.goto('/prototype/student.html');
  await expect(page.getByText('Your examination opens from the exact school link.')).toBeVisible();
  await expect(page.getByText(/does not guess your class/i)).toBeVisible();
  await expectNoHorizontalOverflow(page);
});

test('admin, student and exam layouts remain usable at phone width', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await clearPrototypeStorage(page);
  await expect(page.locator('[data-drawer-target="admin-mobile-drawer"]')).toBeVisible();
  await expect(page.locator('aside.nav-rail').first()).toBeHidden();
  await expectNoHorizontalOverflow(page);

  const studentLink = await createSingleMathExam(page);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(studentLink);
  await expectNoHorizontalOverflow(page);
  await page.locator('#student-full-name').fill('Amina Yusuf Bello');
  await page.locator('#student-identity-form button[type="submit"]').click();
  await page.getByRole('button', { name: /Review & enter exam/i }).click();
  await page.getByRole('button', { name: 'Start examination' }).click();
  await expect(page.locator('#mobile-nav')).toBeVisible();
  await expectNoHorizontalOverflow(page);
});

test('core interactive controls expose visible focus and consistent control sizing', async ({ page }) => {
  await page.goto('/prototype/admin.html?page=users');
  const add = page.getByRole('button', { name: 'Add user' }).first();
  await add.focus();
  const metrics = await add.evaluate((node) => ({ height: node.getBoundingClientRect().height, outline: getComputedStyle(node).outlineStyle }));
  expect(metrics.height).toBeGreaterThanOrEqual(38);
  expect(metrics.height).toBeLessThanOrEqual(48);
  expect(metrics.outline).not.toBe('none');
  await expect(page.locator('img[src*="flowbite-illustrations"]').first()).toBeAttached();
});
