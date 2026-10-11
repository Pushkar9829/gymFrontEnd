import { test, expect } from '@playwright/test';
import { loginStaff, watchErrors, shot, waitIdle, field } from './helpers.js';

// A receptionist's day: new member, membership + payment, check-in, dues, enquiry, shop, class, expense, broken machine.
test.describe.serial('reception', () => {
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

  test('register a new member', async () => {
    await page.getByRole('link', { name: 'Members', exact: true }).click();
    await page.getByRole('button', { name: 'Register member' }).click();
    await field(page, 'Full name').fill('Kiran Rao');
    await field(page, 'Phone').fill('9123400001');
    await page.getByRole('button', { name: 'Register', exact: true }).click();
    await expect(page.getByRole('heading', { level: 1, name: /Kiran Rao/ })).toBeVisible();
    await expect(page.getByText('No entry')).toBeVisible(); // no membership yet
    await shot(page, 'flow-reception-new-member');
  });

  test('add membership with full payment -> entry allowed', async () => {
    await page.getByRole('button', { name: 'Add membership' }).click();
    await page.getByRole('dialog').getByRole('button', { name: /Monthly/ }).first().click();
    await page.getByRole('button', { name: 'Received full amount' }).click();
    await shot(page, 'flow-reception-membership-modal');
    await page.getByRole('button', { name: 'Save membership' }).click();
    await expect(page.getByText('Membership added')).toBeVisible();
    await expect(page.getByText('Entry allowed')).toBeVisible();
  });

  test('check in at reception by phone search', async () => {
    await page.getByRole('link', { name: 'Check-in', exact: true }).click();
    await page.getByPlaceholder(/Name, phone, member code/).fill('9123400001');
    await page.locator('li', { hasText: 'Kiran Rao' }).getByRole('button', { name: 'Check in' }).click();
    await expect(page.getByText('ENTRY ALLOWED')).toBeVisible();
    await shot(page, 'flow-reception-checkin-allowed');
  });

  test('expired member is refused at check-in', async () => {
    await page.getByPlaceholder(/Name, phone, member code/).fill('Amit');
    await page.locator('li', { hasText: 'Amit Patel' }).getByRole('button', { name: 'Check in' }).click();
    await expect(page.getByText('NO ENTRY')).toBeVisible();
    await expect(page.getByText(/Membership expired on/)).toBeVisible();
    await shot(page, 'flow-reception-checkin-denied');
  });

  test('RFID card tap checks in', async () => {
    const box = page.getByPlaceholder(/Name, phone, member code/);
    await box.fill('0011223344');
    await box.press('Enter');
    await expect(page.getByText('ENTRY ALLOWED')).toBeVisible();
    await expect(page.getByText('Rahul Sharma').last()).toBeVisible();
  });

  test('collect a pending due', async () => {
    await page.getByRole('link', { name: 'Members', exact: true }).click();
    await page.getByPlaceholder(/Search name/).fill('Vikram');
    await page.getByPlaceholder(/Search name/).press('Enter');
    await page.getByText('Vikram Singh').click();
    await page.getByRole('button', { name: 'Collect due' }).click();
    await page.getByRole('button', { name: /Full due/ }).click();
    await page.getByRole('button', { name: 'Save payment' }).click();
    await expect(page.getByText('Payment recorded')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Collect due' })).toHaveCount(0);
  });

  test('new enquiry, follow-up, convert to member', async () => {
    await page.getByRole('link', { name: 'Leads', exact: true }).click();
    await page.getByRole('button', { name: 'New enquiry' }).click();
    const dlg = page.getByRole('dialog');
    await field(dlg, 'Name').fill('Walk In Lead');
    await field(dlg, 'Phone').fill('9123400002');
    await dlg.getByRole('button', { name: 'Save' }).click();
    await expect(page.getByText('Lead added')).toBeVisible();
    await page.getByText('Walk In Lead').click();
    await page.getByLabel('Follow-up note').fill('Called, coming tomorrow 7am');
    await page.getByRole('button', { name: 'Save follow-up' }).click();
    await expect(page.getByText('Follow-up saved')).toBeVisible();
    await page.getByRole('button', { name: 'Convert to member' }).click();
    await expect(page.getByRole('heading', { level: 1, name: /Walk In Lead/ })).toBeVisible();
  });

  test('shop sale', async () => {
    await page.getByRole('link', { name: 'Shop', exact: true }).click();
    await page.getByRole('button', { name: /Protein Bar/ }).click();
    await page.getByRole('button', { name: /Collect ₹112/ }).click();
    await expect(page.getByRole('button', { name: /Print receipt POS/ })).toBeVisible();
  });

  test('book a member into a class', async () => {
    await page.getByRole('link', { name: 'Classes', exact: true }).click();
    await waitIdle(page);
    const firstClass = page.locator('main button', { hasText: 'Yoga' }).first();
    await firstClass.click();
    await page.getByPlaceholder('Add member: name, phone or code').fill('Rahul');
    await page.getByRole('dialog').getByRole('button', { name: 'Book', exact: true }).first().click();
    await expect(page.getByText('Booked', { exact: true }).first()).toBeVisible();
    await shot(page, 'flow-reception-class-roster');
    await page.keyboard.press('Escape');
  });

  test('add an expense', async () => {
    await page.getByRole('link', { name: 'Expenses', exact: true }).click();
    await page.getByRole('button', { name: 'Add expense' }).click();
    await field(page.getByRole('dialog'), 'Amount').fill('750');
    await field(page.getByRole('dialog'), 'Note').fill('Cleaning supplies');
    await page.getByRole('dialog').getByRole('button', { name: 'Save' }).click();
    await expect(page.getByText('Expense added')).toBeVisible();
    await expect(page.getByText('Cleaning supplies')).toBeVisible();
  });

  test('report a broken machine', async () => {
    await page.getByRole('link', { name: 'Equipment', exact: true }).click();
    await page.getByRole('button', { name: 'Report problem' }).first().click();
    await page.getByLabel('What is wrong?').fill('Belt slipping at high speed');
    await page.getByRole('dialog').getByRole('button', { name: 'Save' }).click();
    await expect(page.getByText(/Problem reported/)).toBeVisible();
    await expect(page.locator('td', { hasText: 'Belt slipping' })).toBeVisible();
  });

  test('clock in / out', async () => {
    await page.getByRole('button', { name: 'Clock in' }).click();
    await expect(page.getByText('Clocked in')).toBeVisible();
  });
});
