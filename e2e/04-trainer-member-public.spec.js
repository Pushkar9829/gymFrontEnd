import { test, expect } from '@playwright/test';
import { loginStaff, loginMember, watchErrors, shot, waitIdle, field } from './helpers.js';

test.describe.serial('trainer', () => {
  let page;
  let watch;
  test.beforeAll(async ({ browser }) => {
    page = await browser.newPage();
    watch = watchErrors(page);
    await loginStaff(page, 'trainer');
  });
  test.afterAll(async () => {
    watch.assertClean();
    await page.close();
  });

  test('dashboard shows their own day, without front-desk buttons', async () => {
    await expect(page.getByText('My classes today')).toBeVisible();
    await expect(page.getByText('My PT clients')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Rahul Sharma' }).first()).toBeVisible();
    await expect(page.getByRole('button', { name: 'Check-in', exact: true })).toHaveCount(0);
    await shot(page, 'flow-trainer-dashboard');
  });

  test('sees only own clients', async () => {
    await page.getByRole('link', { name: 'Members', exact: true }).click();
    await expect(page.locator('tbody tr')).toHaveCount(1);
    await expect(page.getByText('Rahul Sharma')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Register member' })).toHaveCount(0);
  });

  test('logs a PT session from the Personal training screen', async () => {
    await page.getByRole('link', { name: 'Personal training', exact: true }).click();
    await page.locator('tr', { hasText: 'Rahul Sharma' }).first().getByRole('button', { name: 'Log session' }).click();
    await page.getByRole('dialog').getByLabel(/Notes/).fill('Squats 3x10, good form');
    await page.getByRole('dialog').getByRole('button', { name: 'Save' }).click();
    await expect(page.getByText(/Session logged\. \d+ left/)).toBeVisible();
    await shot(page, 'flow-trainer-pt');
  });

  test('records a body measurement for a client', async () => {
    await page.getByRole('link', { name: 'Members', exact: true }).click();
    await page.getByText('Rahul Sharma').click();
    await page.getByRole('button', { name: 'Fitness', exact: true }).click();
    await page.getByRole('button', { name: 'Add measurement' }).click();
    await field(page.getByRole('dialog'), 'Weight').fill('80');
    await page.getByRole('dialog').getByRole('button', { name: 'Save' }).click();
    await expect(page.getByText('80 kg')).toBeVisible();
  });
});

test.describe.serial('member app', () => {
  let page;
  let watch;
  test.beforeAll(async ({ browser }) => {
    page = await browser.newPage({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
    watch = watchErrors(page);
    await loginMember(page);
  });
  test.afterAll(async () => {
    watch.assertClean();
    await page.close();
  });

  test('home: membership status and QR card', async () => {
    await expect(page.getByText('Membership active')).toBeVisible();
    await expect(page.getByRole('img', { name: 'Membership QR code' })).toBeVisible();
    await expect(page.getByText('Personal training')).toBeVisible();
    await shot(page, 'member-home-mobile');
  });

  test('book a class and see it as booked', async () => {
    await page.getByRole('link', { name: 'Classes' }).click();
    await page.getByRole('button', { name: 'Book' }).first().click();
    await expect(page.getByText('Booked!')).toBeVisible();
    await expect(page.getByText('Booked', { exact: true }).first()).toBeVisible();
    await shot(page, 'member-classes-mobile');
  });

  test('my plan and history', async () => {
    await page.getByRole('link', { name: 'My plan' }).click();
    await expect(page.getByRole('heading', { name: 'My plan' })).toBeVisible();
    await page.getByRole('button', { name: 'Progress' }).click();
    await page.getByPlaceholder('kg').fill('79.5');
    await page.getByRole('button', { name: 'Save' }).click();
    await expect(page.getByText('Weight saved')).toBeVisible();
    await page.getByRole('link', { name: 'History' }).click();
    await expect(page.getByRole('heading', { name: 'History' })).toBeVisible();
    await page.getByRole('button', { name: 'Payments' }).click();
    await waitIdle(page);
    await shot(page, 'member-history-mobile');
  });

  test('log out', async () => {
    await page.getByRole('button', { name: 'Log out' }).click();
    await expect(page).toHaveURL(/\/portal\/login/);
  });
});

test('public join page: enquiry from a phone', async ({ browser }) => {
  const page = await browser.newPage({ viewport: { width: 390, height: 844 }, isMobile: true });
  const watch = watchErrors(page);
  await page.goto('/join');
  await expect(page.getByRole('heading', { name: 'E2E Fitness' })).toBeVisible();
  await expect(page.getByText('Membership plans')).toBeVisible();
  // Other specs may add a second branch; then the visitor must pick one.
  const branch = page.getByRole('combobox', { name: 'Branch' });
  if (await branch.count()) await branch.selectOption({ label: 'Main Branch' });
  await field(page, 'Name').fill('Website Visitor');
  await field(page, 'Phone').fill('9123400099');
  await page.getByRole('button', { name: 'Call me back' }).click();
  await expect(page.getByText(/Thank you, Website!/)).toBeVisible();
  await shot(page, 'public-join-mobile');
  watch.assertClean();
  await page.close();
});
