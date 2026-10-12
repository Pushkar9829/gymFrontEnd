import { test, expect } from '@playwright/test';
import { loginStaff, watchErrors, shot, waitIdle, field, selectField } from './helpers.js';

// Reception desk: trial passes, renewing from the "no entry" screen, thermal receipts, shift handover.
// Uses its own seeded records: lead Tina Trial, member Esha Expired, receptionist Rina Desk.

const esc = (t) => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const toast = (page, text) => expect(page.locator('[data-sonner-toast]').getByText(typeof text === 'string' ? new RegExp(`^${esc(text)}`) : text).first()).toBeVisible();

const menu = async (page, name) => {
  const link = page.locator('aside nav').first().getByRole('link', { name, exact: true });
  await link.click();
  await expect(link).toHaveAttribute('aria-current', 'page');
  await waitIdle(page);
};

const newStaffPage = async (browser, login) => {
  const page = await browser.newPage();
  page.on('popup', (p) => p.close().catch(() => {})); // PDFs open in a blob: tab
  const watch = watchErrors(page);
  if (typeof login === 'string') await loginStaff(page, login);
  else {
    await page.goto('/login');
    await page.getByLabel('Email or phone').fill(login.email);
    await page.getByLabel('Password').fill(login.password);
    await page.getByRole('button', { name: 'Sign in' }).click();
    await expect(page).toHaveURL(/\/admin/, { timeout: 20_000 });
  }
  return { page, watch };
};

test.describe.serial('reception desk', () => {
  let rec;
  let owner;
  let rina;

  test.beforeAll(async ({ browser }) => {
    rec = await newStaffPage(browser, 'receptionist');
    owner = await newStaffPage(browser, 'owner');
  });
  test.afterAll(async () => {
    for (const p of [rec, owner, rina].filter(Boolean)) {
      p.watch.assertClean();
      await p.page.close();
    }
  });

  test('issue a trial pass from a lead and check the visitor in at the desk', async () => {
    const page = rec.page;
    await menu(page, 'Leads');
    await page.locator('tbody').getByText('Tina Trial').click();
    await page.getByRole('dialog').getByRole('button', { name: 'Give trial pass' }).click();
    const dlg = page.getByRole('dialog');
    await expect(dlg.getByRole('heading', { name: 'Trial pass · Tina Trial' })).toBeVisible();
    await selectField(dlg, 'Days').selectOption('2');
    await dlg.getByRole('button', { name: 'Issue pass' }).click();
    await toast(page, 'Trial pass issued till');
    await expect(page.getByRole('dialog')).toHaveCount(0);
    await expect(page.locator('tbody tr', { hasText: 'Tina Trial' }).getByText(/^trial$/i)).toBeVisible(); // lead status

    await menu(page, 'Trials');
    const row = page.locator('tbody tr', { hasText: 'Tina Trial' });
    await expect(row).toBeVisible();
    await expect(row.getByText('Active', { exact: true })).toBeVisible();
    await shot(page, 'flow-trial-list');

    // Not a member: the members list does not show the visitor.
    await menu(page, 'Members');
    await page.getByPlaceholder(/Search name/).fill('Tina Trial');
    await page.getByPlaceholder(/Search name/).press('Enter');
    await expect(page.getByText('No members found')).toBeVisible();

    await menu(page, 'Check-in');
    await page.getByPlaceholder(/Name, phone, member code/).fill('Tina');
    const hit = page.locator('li', { hasText: 'Tina Trial' });
    await expect(hit.getByText('Trial pass')).toBeVisible();
    await hit.getByRole('button', { name: 'Check in' }).click();
    await expect(page.getByText('ENTRY ALLOWED')).toBeVisible();
    await expect(page.getByText(/^Trial pass valid till \d{2}-\d{2}-\d{4}$/)).toBeVisible();
    await shot(page, 'flow-trial-checkin');
  });

  test('expired member is refused, renewed from the same screen, then let in', async () => {
    const page = rec.page;
    await page.getByPlaceholder(/Name, phone, member code/).fill('Esha');
    await page.locator('li', { hasText: 'Esha Expired' }).getByRole('button', { name: 'Check in' }).click();
    await expect(page.getByText('NO ENTRY')).toBeVisible();
    await expect(page.getByText(/Membership expired on/)).toBeVisible();
    await page.locator('main').getByRole('button', { name: 'Renew', exact: true }).click();
    const dlg = page.getByRole('dialog');
    await dlg.getByRole('button', { name: /^Monthly/ }).click();
    await dlg.getByRole('button', { name: 'Received full amount' }).click();
    await dlg.getByRole('button', { name: 'Save membership' }).click();
    await toast(page, 'Membership added');
    await expect(page.getByText('ENTRY ALLOWED')).toBeVisible();
    await expect(page.getByText('Checked in after the fix')).toBeVisible();
    await shot(page, 'flow-checkin-renewed');
    // The retried entry is logged.
    await menu(page, 'Attendance');
    await page.locator('main').getByRole('button', { name: /^Entry log/ }).click();
    await waitIdle(page);
    await expect(page.locator('tbody tr', { hasText: 'Esha Expired' }).first()).toBeVisible();
  });

  test('with 80 mm receipt paper, a payment receipt opens as a narrow PDF', async () => {
    const page = owner.page;
    await menu(page, 'Settings');
    await selectField(page, 'Receipt paper').selectOption('80mm');
    await page.getByRole('button', { name: 'Save settings' }).click();
    await toast(page, 'Settings saved');

    await menu(page, 'Members');
    await page.getByPlaceholder(/Search name/).fill('Esha Expired');
    await page.getByPlaceholder(/Search name/).press('Enter');
    await page.locator('tbody').getByText('Esha Expired').first().click();
    await page.getByRole('button', { name: 'Payments', exact: true }).click();
    const [res] = await Promise.all([
      page.waitForResponse((r) => r.url().includes('/api/') && r.url().includes('/receipt.pdf')),
      page.getByRole('button', { name: 'Print receipt' }).first().click(),
    ]);
    expect(res.status()).toBe(200);
    expect(res.headers()['content-type']).toContain('application/pdf');
    const box = (await res.body()).toString('latin1').match(/\/MediaBox \[0 0 ([\d.]+) /);
    expect(Number(box?.[1])).toBeCloseTo(226.77, 1);

    // Back to A4 for anything that runs later.
    await menu(page, 'Settings');
    await selectField(page, 'Receipt paper').selectOption('a4');
    await page.getByRole('button', { name: 'Save settings' }).click();
    await toast(page, 'Settings saved');
  });

  test('a handover task for another receptionist shows on her dashboard and is marked done', async ({ browser }) => {
    const page = rec.page;
    await page.goto('/admin');
    await waitIdle(page);
    const card = page.getByRole('region', { name: 'Handover' });
    await card.getByRole('button', { name: 'Post', exact: true }).click();
    const dlg = page.getByRole('dialog');
    await field(dlg, 'Note').fill('Call Mr Shah about his renewal');
    await dlg.getByRole('switch', { name: 'This is a task' }).click();
    await selectField(dlg, 'Assign to').selectOption({ label: 'Rina Desk (receptionist)' });
    await dlg.getByRole('button', { name: 'Post', exact: true }).click();
    await toast(page, 'Task posted');
    await expect(card.getByText('Call Mr Shah about his renewal')).toBeVisible();

    rina = await newStaffPage(browser, { email: 'rina@gym.local', password: 'Staff@12345' });
    const p2 = rina.page;
    await waitIdle(p2);
    const board = p2.getByRole('region', { name: 'Handover' });
    const item = board.locator('li', { hasText: 'Call Mr Shah about his renewal' });
    await expect(item).toBeVisible();
    await expect(item.getByText('For you')).toBeVisible();
    await p2.getByRole('button', { name: 'Notifications' }).click();
    await expect(p2.getByRole('banner').getByText('Task for you from Riya Reception')).toBeVisible();
    await p2.mouse.click(700, 600); // click outside to close the list
    await expect(p2.getByRole('banner').getByText('Task for you from Riya Reception')).toHaveCount(0);
    await shot(p2, 'flow-handover-dashboard');
    await item.getByRole('button', { name: 'Mark done' }).click();
    await toast(p2, 'Task done');
    await expect(board.getByText('Call Mr Shah about his renewal')).toHaveCount(0);
    await expect(board.getByText('Nothing pending from the last shift.')).toBeVisible();

    await menu(page, 'Shift handover');
    await page.locator('main').getByRole('button', { name: /^Done\s*\d*$/ }).click();
    await waitIdle(page);
    await expect(page.locator('main li', { hasText: 'Call Mr Shah about his renewal' }).getByText(/Done by Rina Desk/)).toBeVisible();
    await shot(page, 'flow-handover-done');
  });
});
