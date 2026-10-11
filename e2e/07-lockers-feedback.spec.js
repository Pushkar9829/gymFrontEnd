import { test, expect } from '@playwright/test';
import { loginStaff, loginMember, watchErrors, shot, waitIdle, field, selectField } from './helpers.js';

const startsWith = (t) => new RegExp(`^${t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`);
const toast = (page, text) => expect(page.locator('[data-sonner-toast]').getByText(typeof text === 'string' ? startsWith(text) : text).first()).toBeVisible();

test.describe.serial('lockers at the front desk', () => {
  let page;
  let watch;
  test.beforeAll(async ({ browser }) => {
    page = await browser.newPage();
    watch = watchErrors(page);
    await loginStaff(page, 'receptionist');
  });
  test.afterAll(async () => {
    watch.assertClean();
    await page.close();
  });

  test('allot a free locker to a member with rent and deposit', async () => {
    await page.getByRole('link', { name: 'Lockers', exact: true }).click();
    await expect(page.getByRole('heading', { level: 1, name: 'Lockers' })).toBeVisible();
    await page.getByRole('button', { name: /^L1\s/ }).click();
    const dlg = page.getByRole('dialog');
    await dlg.getByPlaceholder(/Search member/).fill('Rahul');
    await dlg.getByRole('button', { name: /Rahul Sharma/ }).click();
    await selectField(dlg, 'Months').selectOption('3');
    await expect(field(dlg, 'Rent')).toHaveValue('900'); // 3 x ₹300
    await field(dlg, 'Deposit').fill('500');
    await dlg.getByRole('button', { name: /Allot locker · collect ₹1,400/ }).click();
    await toast(page, 'Locker L1 allotted');
    await expect(page.getByRole('button', { name: /^L1\s/ })).toContainText('Rahul Sharma');
    await shot(page, 'flow-lockers-grid');
  });

  test('the member page shows the locker', async () => {
    await page.getByRole('link', { name: 'Members', exact: true }).click();
    await page.locator('tbody').getByText('Rahul Sharma').first().click();
    await expect(page.getByText(/L1 · till/)).toBeVisible();
  });

  test('extend, then release with part of the deposit returned', async () => {
    await page.getByRole('link', { name: 'Lockers', exact: true }).click();
    await page.getByRole('button', { name: /^L1\s/ }).click();
    const dlg = page.getByRole('dialog');
    await dlg.getByRole('button', { name: 'Extend', exact: true }).click();
    await dlg.getByRole('button', { name: /Extend · collect ₹300/ }).click();
    await toast(page, 'Extended till');
    await page.getByRole('button', { name: /^L1\s/ }).click();
    await dlg.getByRole('button', { name: 'Release locker' }).click();
    await field(dlg, 'Deposit returned').fill('400');
    await field(dlg, 'Note').fill('Key lost, ₹100 kept');
    await dlg.getByRole('button', { name: 'Release locker' }).click();
    await toast(page, 'Locker L1 is free now');
    await expect(page.getByRole('button', { name: /^L1\s/ })).toContainText('Free');
  });
});

test('owner adds lockers in bulk and puts one under maintenance', async ({ page }) => {
  const watch = watchErrors(page);
  await loginStaff(page, 'owner');
  await page.goto('/admin/lockers');
  await page.getByRole('button', { name: 'Add lockers' }).click();
  const dlg = page.getByRole('dialog');
  await field(dlg, 'Prefix').fill('W');
  await field(dlg, 'To number').fill('5');
  await selectField(dlg, 'Section').selectOption('women');
  await dlg.getByRole('button', { name: 'Add 5 locker(s)' }).click();
  await toast(page, '5 locker(s) added');
  await page.getByRole('button', { name: /^W3\s/ }).click();
  await dlg.getByRole('button', { name: 'Mark for maintenance' }).click();
  await toast(page, 'Marked for maintenance');
  await expect(page.getByRole('button', { name: /^W3\s/ })).toContainText('Maintenance');
  watch.assertClean();
});

test.describe.serial('complaint: member app -> desk -> member', () => {
  test('member raises a complaint from the app', async ({ browser }) => {
    const page = await browser.newPage({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
    const watch = watchErrors(page);
    await loginMember(page);
    await page.getByRole('link', { name: /Complaint or suggestion/ }).click();
    await page.getByRole('button', { name: 'New' }).click();
    await selectField(page, 'About').selectOption('cleanliness');
    await field(page, 'Subject').fill('Shower drain blocked');
    await field(page, 'Details').fill('Men shower 2 has been blocked since morning');
    await page.getByRole('button', { name: '3 stars' }).click();
    await page.getByRole('button', { name: 'Send', exact: true }).click();
    await toast(page, /Thanks! Ticket FB-\d+/);
    await expect(page.getByText('Shower drain blocked')).toBeVisible();
    await shot(page, 'flow-member-feedback-list');
    watch.assertClean();
    await page.close();
  });

  test('reception sees it, replies and resolves', async ({ page }) => {
    const watch = watchErrors(page);
    await loginStaff(page, 'receptionist');
    await expect(page.locator('main').getByText('Open complaints', { exact: true }).first()).toBeVisible();
    await page.getByRole('link', { name: 'Complaints & feedback' }).click();
    await page.locator('tbody').getByText('Shower drain blocked').click();
    const dlg = page.getByRole('dialog');
    await expect(dlg.getByText('High priority')).toBeVisible(); // cleanliness complaints jump the queue
    await dlg.getByLabel('Reply').fill('Sorry! Plumber is fixing it now.');
    await dlg.getByRole('button', { name: 'Send reply' }).click();
    await toast(page, 'Reply sent to the member');
    await expect(dlg.getByText('Sorry! Plumber is fixing it now.')).toBeVisible();
    await selectField(dlg, 'Status').selectOption('resolved');
    await toast(page, 'Ticket updated');
    await shot(page, 'flow-staff-feedback-ticket');
    watch.assertClean();
  });

  test('member reads the reply and rates the handling', async ({ browser }) => {
    const page = await browser.newPage({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
    const watch = watchErrors(page);
    await loginMember(page);
    await page.goto('/portal/feedback');
    await page.getByText('Shower drain blocked').click();
    await expect(page.getByText('Sorry! Plumber is fixing it now.')).toBeVisible();
    await page.getByRole('button', { name: '5 stars' }).click();
    await page.getByRole('button', { name: 'Rate & close' }).click();
    await toast(page, 'Thanks for rating!');
    await expect(page.getByText('This ticket is closed')).toBeVisible();
    await shot(page, 'flow-member-feedback-closed');
    watch.assertClean();
    await page.close();
  });

  test('desk logs a suggestion for a walk-up member', async ({ page }) => {
    const watch = watchErrors(page);
    await loginStaff(page, 'receptionist');
    await page.goto('/admin/feedback');
    await waitIdle(page);
    await page.getByRole('button', { name: 'Log feedback' }).click();
    const dlg = page.getByRole('dialog');
    await dlg.getByPlaceholder(/Search member/).fill('Sneha');
    await dlg.getByRole('button', { name: /Sneha Iyer/ }).click();
    await selectField(dlg, 'Type').selectOption('suggestion');
    await field(dlg, 'Subject').fill('More evening yoga');
    await field(dlg, 'Details').fill('Asked at the desk');
    await dlg.getByRole('button', { name: 'Create ticket' }).click();
    await toast(page, /Ticket FB-\d+ created/);
    await expect(page.getByText('More evening yoga')).toBeVisible();
    watch.assertClean();
  });
});
