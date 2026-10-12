import { test, expect } from '@playwright/test';
import { loginStaff, watchErrors, shot, waitIdle, field } from './helpers.js';

const startsWith = (t) => new RegExp(`^${t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`);
const toast = (page, text) => expect(page.locator('[data-sonner-toast]').getByText(typeof text === 'string' ? startsWith(text) : text).first()).toBeVisible();

/** Clicks a button that downloads an Excel file and checks the API answered with a workbook. */
const expectXlsx = async (page, click, urlPart) => {
  const [res, dl] = await Promise.all([
    page.waitForResponse((r) => r.url().includes('/api/') && r.url().includes(urlPart) && r.url().includes('export=xlsx')),
    page.waitForEvent('download'),
    click(),
  ]);
  expect(res.status(), `${urlPart} status`).toBe(200);
  expect(res.headers()['content-type']).toContain('spreadsheetml');
  expect(dl.suggestedFilename()).toMatch(/\.xlsx$/);
};

// Owner / manager control: day closing, discount approvals, staff and retention reports, GST exports.
test.describe.serial('owner control', () => {
  let rec;
  let owner;
  let recWatch;
  let ownerWatch;
  const menu = async (page, name) => {
    await page.locator('aside nav').first().getByRole('link', { name, exact: true }).click();
    await waitIdle(page);
  };
  const tab = async (page, name) => {
    await page.locator('main').getByRole('button', { name: new RegExp(`^${name.replace(/[&]/g, '\\$&')}\\s*\\d*$`) }).first().click();
    await waitIdle(page);
  };

  test.beforeAll(async ({ browser }) => {
    rec = await browser.newPage();
    recWatch = watchErrors(rec);
    await loginStaff(rec, 'receptionist');
    owner = await browser.newPage();
    ownerWatch = watchErrors(owner);
    await loginStaff(owner, 'owner');
  });
  test.afterAll(async () => {
    recWatch.assertClean();
    ownerWatch.assertClean();
    await rec.close();
    await owner.close();
  });

  test('reception closes the day with a shortfall and a note', async () => {
    await menu(rec, 'Day closing');
    await expect(rec.getByRole('heading', { level: 1, name: 'Day closing' })).toBeVisible();
    await expect(rec.getByText('Expected in drawer')).toBeVisible();
    await field(rec, 'Opening float').fill('5000');
    await field(rec, 'Cash counted').fill('0');
    await expect(rec.locator('main').getByText(/^Short ₹/).first()).toBeVisible();
    const close = rec.getByRole('button', { name: 'Close day' });
    await expect(close).toBeDisabled(); // a note is required when cash does not match
    await field(rec, 'Note').fill('Owner took cash for the plumber');
    await close.click();
    await toast(rec, 'Day closed. Cash short by');
    await expect(rec.getByText('Day closed', { exact: true })).toBeVisible();
    await expect(rec.getByRole('button', { name: 'Reopen' })).toHaveCount(0); // reception cannot reopen
    await shot(rec, 'flow-cash-closed');
  });

  test('owner sees the alert and the closed day, then reopens it with a reason', async () => {
    await owner.goto('/admin');
    await waitIdle(owner);
    await expect(owner.locator('main').getByText(/^Cash short by Rs\./).first()).toBeVisible();
    // One branch: "Closed · short ₹..."; with the branch added in 03: "1 of 2 branches closed".
    await expect(owner.locator('main').getByRole('button', { name: /^(Closed · short ₹|1 of 2 branches closed)/ })).toBeVisible();
    await menu(owner, 'Day closing');
    const branch = owner.getByRole('combobox', { name: 'Branch', exact: true });
    if (await branch.count()) await branch.selectOption({ label: 'Main Branch' });
    await expect(owner.getByText('Day closed', { exact: true })).toBeVisible();
    await expect(owner.getByText(/Owner took cash for the plumber/)).toBeVisible();
    await owner.getByRole('button', { name: 'Reopen' }).click();
    const dlg = owner.getByRole('dialog');
    await field(dlg, 'Reason').fill('Plumber bill found, recount');
    await dlg.getByRole('button', { name: 'Reopen day' }).click();
    await toast(owner, 'Day reopened');
    await expect(owner.getByRole('heading', { name: 'Count again and close' })).toBeVisible();
    await expect(owner.getByText(/Reopened by Gym Owner: Plumber bill found/)).toBeVisible();
    await tab(owner, 'History');
    await expect(owner.locator('tbody').getByText('Reopened')).toBeVisible();
    await expectXlsx(owner, () => owner.locator('main').getByRole('button', { name: 'Excel' }).click(), '/cash/closings');
    await shot(owner, 'flow-cash-history');
  });

  test('reception asks for a discount above the limit', async () => {
    await menu(rec, 'Members');
    await rec.getByPlaceholder(/Search name/).fill('Dev Discount');
    await rec.getByPlaceholder(/Search name/).press('Enter');
    await rec.locator('tbody').getByText('Dev Discount').first().click();
    await expect(rec.getByRole('heading', { level: 1, name: /Dev Discount/ })).toBeVisible();
    await rec.getByRole('button', { name: 'Add membership' }).click();
    const dlg = rec.getByRole('dialog');
    await dlg.getByRole('button', { name: /^Monthly/ }).click();
    await field(dlg, 'Discount').fill('500');
    await dlg.getByRole('button', { name: 'Save membership' }).click();
    await toast(rec, 'Discounts above 10% need owner or manager approval');
    await field(dlg, 'Reason for the discount').fill('Referred by Rahul, pays for a year next time');
    await dlg.getByRole('button', { name: 'Request approval' }).click();
    await toast(rec, 'Approval requested');
    await expect(dlg.getByText(/Waiting for approval/)).toBeVisible();
    await shot(rec, 'flow-discount-waiting');
  });

  test('owner approves it from the dashboard', async () => {
    await owner.goto('/admin');
    await waitIdle(owner);
    await expect(owner.getByText('Discount approvals waiting (1)')).toBeVisible();
    await owner.locator('main').getByRole('button', { name: 'Approve', exact: true }).first().click();
    const dlg = owner.getByRole('dialog');
    await expect(dlg.getByText('Referred by Rahul', { exact: false })).toBeVisible();
    await dlg.getByRole('button', { name: 'Approve', exact: true }).click();
    await toast(owner, 'Discount approved');
    await expect(owner.getByText('Discount approvals waiting')).toHaveCount(0);
  });

  test('reception completes the sale with the approval', async () => {
    const dlg = rec.getByRole('dialog');
    await expect(dlg.getByText(/Approved by Gym Owner/)).toBeVisible({ timeout: 30_000 });
    await shot(rec, 'flow-discount-approved');
    await dlg.getByRole('button', { name: 'Complete sale' }).click();
    await toast(rec, 'Membership added');
    await menu(owner, 'Approvals');
    await tab(owner, 'Used');
    await expect(owner.locator('tbody').getByText(/Dev Discount/)).toBeVisible();
  });

  test('staff performance and retention reports show numbers', async () => {
    await menu(owner, 'Reports');
    await tab(owner, 'Staff performance');
    const main = owner.locator('main');
    await expect(main.locator('tbody').getByText('Riya Reception')).toBeVisible();
    await expect(main.locator('tbody').getByText('Arjun Trainer')).toBeVisible();
    await expect(main.locator('tbody tr', { hasText: 'Gym Owner' }).first()).toContainText('₹');
    await expectXlsx(owner, () => main.getByRole('button', { name: 'Excel' }).first().click(), '/reports/staff');
    await shot(owner, 'flow-report-staff');

    await tab(owner, 'Retention');
    await expect(main.getByText('Renewals by month')).toBeVisible();
    await expect(main.getByText(/^\d+(\.\d)?%$/).first()).toBeVisible();
    const ravi = main.locator('tr', { hasText: 'Ravi Away' }).first();
    await expect(ravi).toBeVisible();
    await ravi.getByRole('button', { name: 'Send reminder' }).click();
    await toast(owner, 'SMS and WhatsApp are switched off');
    await expectXlsx(owner, () => main.getByRole('button', { name: 'Excel' }).first().click(), '/reports/retention');
    await shot(owner, 'flow-report-retention');
  });

  test('with SMS switched on, the reminder is sent', async () => {
    await menu(owner, 'Settings');
    await owner.getByRole('switch', { name: /Send SMS/ }).click();
    await owner.getByRole('button', { name: 'Save settings' }).click();
    await toast(owner, 'Settings saved');
    await menu(owner, 'Reports');
    await tab(owner, 'Retention');
    await owner.locator('main tr', { hasText: 'Ravi Away' }).first().getByRole('button', { name: 'Send reminder' }).click();
    await toast(owner, 'Reminder sent to Ravi Away');
  });

  test('GSTR-1 and Tally exports download as Excel', async () => {
    await tab(owner, 'GST & Tally');
    const main = owner.locator('main');
    await expect(main.getByText('HSN / SAC summary')).toBeVisible();
    await expect(main.getByText('999723').first()).toBeVisible();
    await expectXlsx(owner, () => main.getByRole('button', { name: 'GSTR-1 (Excel)' }).click(), '/reports/gstr1');
    await expectXlsx(owner, () => main.getByRole('button', { name: 'Tally (Excel)' }).click(), '/reports/tally');
    await shot(owner, 'flow-report-gst');
  });
});
