import { test, expect } from '@playwright/test';
import { loginStaff, watchErrors, shot, waitIdle, field, selectField } from './helpers.js';

// Owner / manager work across every module.
test.describe.serial('owner', () => {
  let page;
  let watch;
  const nav = async (name) => {
    const link = page.locator('aside nav').first().getByRole('link', { name, exact: true });
    await link.click();
    await expect(link).toHaveAttribute('aria-current', 'page');
    await waitIdle(page);
  };
  const dlg = () => page.getByRole('dialog');
  // Toast messages: strings must match the start of the message, so an older toast can't satisfy a newer check.
  const startsWith = (t) => (typeof t === 'string' ? new RegExp(`^${t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`) : t);
  const toast = (text) => expect(page.locator('[data-sonner-toast]').getByText(startsWith(text)).first()).toBeVisible();
  const openMember = async (name) => {
    await nav('Members');
    await page.getByPlaceholder(/Search name/).fill(name);
    await page.getByPlaceholder(/Search name/).press('Enter');
    await page.locator('tbody').getByText(name).first().click();
    await expect(page.getByRole('heading', { level: 1, name: new RegExp(name) })).toBeVisible();
  };

  test.beforeAll(async ({ browser }) => {
    page = await browser.newPage();
    page.on('dialog', (d) => d.accept(d.type() === 'prompt' ? 'Test reason' : undefined));
    watch = watchErrors(page);
    await loginStaff(page, 'owner');
  });
  test.afterAll(async () => {
    watch.assertClean();
    await page.close();
  });

  test('plans: create a plan', async () => {
    await nav('Plans & coupons');
    await page.getByRole('button', { name: 'New plan' }).click();
    await field(dlg(), 'Plan name').fill('Student Monthly');
    await field(dlg(), 'Price').fill('1200');
    await dlg().getByRole('button', { name: 'Save' }).click();
    await toast('Plan saved');
    await expect(page.getByText('Student Monthly')).toBeVisible();
  });

  test('coupons and companies', async () => {
    await page.getByRole('button', { name: 'New coupon' }).click();
    await field(dlg(), 'Code').fill('WELCOME10');
    await dlg().getByRole('button', { name: 'Save' }).click();
    await toast('Coupon saved');
    await page.getByRole('button', { name: 'Company' }).click();
    await field(dlg(), 'Company name').fill('Globex Corp');
    await dlg().getByRole('button', { name: 'Save' }).click();
    await toast('Company saved');
    await shot(page, 'flow-owner-plans-coupons-companies');
  });

  test('member: freeze then end freeze', async () => {
    await openMember('Sneha Iyer');
    await page.getByRole('button', { name: 'Freeze', exact: true }).click();
    await field(dlg(), 'Days').fill('3');
    await dlg().getByRole('button', { name: 'Freeze', exact: true }).click();
    await toast('Membership frozen');
    await expect(page.getByText('No entry')).toBeVisible();
    await page.getByRole('button', { name: /End freeze now/ }).click();
    await toast('Freeze ended');
    await expect(page.getByText('Entry allowed')).toBeVisible();
  });

  test('member: block and unblock', async () => {
    await page.getByRole('button', { name: 'Block entry' }).click();
    await dlg().getByRole('textbox').fill('Damaged equipment');
    await dlg().getByRole('button', { name: 'Block' }).click();
    await toast('Member blocked');
    await expect(page.getByText(/Access blocked/)).toBeVisible();
    await page.getByRole('button', { name: 'Unblock' }).click();
    await toast('Member unblocked');
  });

  test('member: QR card, app access, refund', async () => {
    await page.getByRole('button', { name: 'QR card' }).click();
    await expect(dlg().getByRole('img', { name: 'QR code' })).toBeVisible();
    await page.keyboard.press('Escape');
    await page.getByRole('button', { name: /App access/ }).click();
    await field(dlg(), 'Password').fill('Sneha@1234');
    await dlg().getByRole('button', { name: 'Enable access' }).click();
    await toast('Portal access updated');
    await page.getByRole('button', { name: 'Payments', exact: true }).click();
    await page.getByRole('button', { name: 'Refund' }).first().click();
    await field(dlg(), 'Amount').fill('10');
    await field(dlg(), 'Reason').fill('Goodwill');
    await dlg().getByRole('button', { name: 'Record refund' }).click();
    await toast('Refund recorded');
  });

  test('personal training: sell a package and log a session', async () => {
    await openMember('Rahul Sharma');
    await page.getByRole('button', { name: 'Personal training', exact: true }).click();
    await page.getByRole('button', { name: 'Sell PT package' }).click();
    await selectField(dlg(), 'Package').selectOption({ index: 1 });
    await selectField(dlg(), 'Trainer').selectOption({ index: 1 });
    await dlg().getByRole('button', { name: 'Sell package' }).click();
    await toast('PT package sold');
    await page.getByRole('button', { name: 'Log session' }).first().click();
    await dlg().getByRole('button', { name: 'Save' }).click();
    await toast(/Session logged\. 11 left/);
    await shot(page, 'flow-owner-member-pt');
  });

  test('fitness: workout plan and measurement', async () => {
    await page.getByRole('button', { name: 'Fitness', exact: true }).click();
    await page.getByRole('button', { name: 'New', exact: true }).first().click();
    await field(dlg(), 'Plan name').fill('Push Pull Legs');
    await dlg().getByPlaceholder('Exercise').first().fill('Back Squat');
    await dlg().getByRole('button', { name: 'Save plan' }).click();
    await toast('Workout plan saved');
    await page.getByRole('button', { name: 'Add measurement' }).click();
    await field(dlg(), 'Weight').fill('78');
    await field(dlg(), 'Height').fill('175');
    await dlg().getByRole('button', { name: 'Save' }).click();
    await toast('Saved');
    await expect(page.getByText('78 kg')).toBeVisible();
    await shot(page, 'flow-owner-member-fitness');
  });

  test('classes: weekly schedule and class type', async () => {
    await nav('Classes');
    await page.getByRole('button', { name: 'Class types' }).click();
    await field(page.locator('main'), 'Name').fill('Zumba');
    await page.getByRole('button', { name: 'Add', exact: true }).click();
    await toast('Class type added');
    await page.getByRole('button', { name: 'Weekly schedule' }).click();
    await page.getByRole('button', { name: 'New weekly class' }).click();
    await selectField(dlg(), 'Class').selectOption({ label: 'Zumba' });
    await dlg().getByRole('button', { name: 'Save' }).click();
    await toast('Schedule saved');
  });

  test('messages: announcement to active members', async () => {
    await nav('Messages');
    await page.getByPlaceholder(/closed on Monday/).fill('Gym closed on Sunday for Diwali. Happy Diwali!');
    await expect(page.getByText(/member\(s\)/).first()).toBeVisible();
    await page.getByRole('button', { name: 'Send' }).click();
    await toast(/Sending to/);
  });

  test('shop: add product and stock in', async () => {
    await nav('Shop');
    await page.getByRole('button', { name: 'Products & stock' }).click();
    await page.getByRole('button', { name: 'Product', exact: true }).click();
    await field(dlg(), 'Name').fill('Shaker Bottle');
    await field(dlg(), 'Selling price').fill('300');
    await dlg().getByRole('button', { name: 'Save' }).click();
    await toast('Product saved');
    await page.locator('tr', { hasText: 'Shaker Bottle' }).getByRole('button', { name: 'Stock' }).click();
    await field(dlg(), 'Quantity').fill('20');
    await dlg().getByRole('button', { name: 'Save' }).click();
    await toast(/Stock updated: 20/);
  });

  test('equipment: add and log service', async () => {
    await nav('Equipment');
    await page.getByRole('button', { name: 'Add equipment' }).click();
    await field(dlg(), 'Name').fill('Leg Press');
    await dlg().getByRole('button', { name: 'Save' }).click();
    await toast('Saved');
    await page.locator('tr', { hasText: 'Treadmill #1' }).getByRole('button', { name: 'Log' }).click();
    await field(dlg(), 'Cost').fill('1500');
    await dlg().getByRole('button', { name: 'Save' }).click();
    await toast('Logged');
  });

  test('biometric devices: add a device', async () => {
    await nav('Biometric devices');
    await page.getByRole('button', { name: 'Add device' }).click();
    await field(dlg(), 'Name').fill('Exit gate');
    await field(dlg(), 'Serial number').fill('ZK0099887766');
    await dlg().getByRole('button', { name: 'Save' }).click();
    await toast(/Device added/);
    await expect(page.getByText('ZK0099887766')).toBeVisible();
  });

  test('payroll: generate this month', async () => {
    await nav('Payroll');
    const now = new Date();
    await page.locator('input[type="month"]').fill(`${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`);
    await page.getByRole('button', { name: /Generate payroll|Recalculate drafts/ }).click();
    await toast(/Payroll ready/);
    await expect(page.locator('tbody tr')).toHaveCount(3);
    await shot(page, 'flow-owner-payroll');
  });

  test('reports: every tab loads', async () => {
    await nav('Reports');
    for (const tab of ['Income & P&L', 'Dues', 'Expiring / expired', 'Attendance', 'Leads', 'Branches']) {
      await page.getByRole('button', { name: tab, exact: true }).click();
      await waitIdle(page);
    }
  });

  test('attendance: every tab loads', async () => {
    await nav('Attendance');
    for (const tab of ['In gym now', 'Visits', 'Entry log', 'Staff']) {
      await page.getByRole('button', { name: tab, exact: true }).click();
      await waitIdle(page);
    }
  });

  test('settings: staff, branch, gym details', async () => {
    await nav('Settings');
    await page.getByRole('button', { name: 'Staff', exact: true }).click();
    await page.getByRole('button', { name: 'Add staff' }).click();
    await field(dlg(), 'Name').fill('Neha Desk');
    await field(dlg(), 'Email').fill('neha.desk@gym.local');
    await field(dlg(), 'Password').fill('Staff@12345');
    await dlg().getByRole('button', { name: 'Save' }).click();
    await toast('Staff saved');
    await page.getByRole('button', { name: 'Branches', exact: true }).click();
    await page.getByRole('button', { name: 'Add branch' }).click();
    await field(dlg(), 'Name').fill('Indiranagar');
    await field(dlg(), 'Short code').fill('IND');
    await dlg().getByRole('button', { name: 'Save' }).click();
    await toast('Branch saved');
    await page.getByRole('button', { name: 'Gym & entry rules' }).click();
    await expect(page.getByText('All changes saved')).toBeVisible();
    await field(page.locator('main'), 'Phone').fill('9800000001');
    await expect(page.getByText('You have unsaved changes')).toBeVisible();
    await page.getByRole('button', { name: 'Save settings' }).click();
    await toast('Settings saved');
    await expect(page.getByText('All changes saved')).toBeVisible();
  });
});
