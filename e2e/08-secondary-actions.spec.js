import { test, expect } from '@playwright/test';
import { loginStaff, loginMember, watchErrors, shot, waitIdle, field, selectField } from './helpers.js';

// Secondary buttons the other specs do not click: edit / cancel / undo / export / PDF / small toggles.
// Uses its own seeded records (Ojas Edit, Deepa Due, Zara Remove, Tara Fit, Pat Password, HIIT Drill, Pilates Open, Spin Duo).

const esc = (t) => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const startsWith = (t) => (typeof t === 'string' ? new RegExp(`^${esc(t)}`) : t);
const toast = (page, text) => expect(page.locator('[data-sonner-toast]').getByText(startsWith(text)).first()).toBeVisible();

const nav = async (page, name) => {
  const link = page.locator('aside nav').first().getByRole('link', { name, exact: true });
  await link.click();
  await expect(link).toHaveAttribute('aria-current', 'page');
  await waitIdle(page);
};

const openMember = async (page, name) => {
  await nav(page, 'Members');
  await page.getByPlaceholder(/Search name/).fill(name);
  await page.getByPlaceholder(/Search name/).press('Enter');
  await page.locator('tbody').getByText(name).first().click();
  await expect(page.getByRole('heading', { level: 1, name: new RegExp(name) })).toBeVisible();
};

/**
 * Clicks a button that fetches a file through openFile(): PDFs open in a new tab, Excel files download.
 * Checks the API answered 200 with the right content type (and that the download really started).
 */
const expectFile = async (page, click, urlPart, kind) => {
  const waits = [page.waitForResponse((r) => r.url().includes('/api/') && r.url().includes(urlPart) && r.request().method() === 'GET')];
  if (kind === 'xlsx') waits.push(page.waitForEvent('download'));
  const [res, dl] = await Promise.all([...waits, click()]);
  expect(res.status(), `${urlPart} status`).toBe(200);
  expect(res.headers()['content-type']).toContain(kind === 'xlsx' ? 'spreadsheetml' : 'application/pdf');
  if (dl) expect(dl.suggestedFilename()).toMatch(/\.xlsx$/);
};

/** One logged-in page per describe block; window.confirm / prompt are accepted. */
const staffPage = (role, setup) => {
  const ctx = {};
  test.beforeAll(async ({ browser }) => {
    ctx.page = await browser.newPage();
    ctx.page.on('dialog', (d) => d.accept(d.type() === 'prompt' ? 'Test reason' : undefined));
    ctx.page.on('popup', (p) => p.close().catch(() => {})); // PDFs open in a blob: tab
    ctx.watch = watchErrors(ctx.page);
    await loginStaff(ctx.page, role);
    if (setup) await setup(ctx.page);
  });
  test.afterAll(async () => {
    ctx.watch.assertClean();
    await ctx.page.close();
  });
  return ctx;
};

test.describe.serial('members: secondary actions', () => {
  const ctx = staffPage('owner');
  const dlg = () => ctx.page.getByRole('dialog');

  test('edit member details and save', async () => {
    const { page } = ctx;
    // A member saved from the form without an RFID card first: a second card-less save used to fail with "cardNo already exists".
    await nav(page, 'Members');
    await page.getByRole('button', { name: 'Register member' }).click();
    await field(dlg(), 'Full name').fill('No Card Member');
    await field(dlg(), 'Phone').fill('9123499010');
    await dlg().getByRole('button', { name: 'Register', exact: true }).click();
    await expect(page.getByRole('heading', { level: 1, name: /No Card Member/ })).toBeVisible();
    await openMember(page, 'Ojas Edit');
    await page.getByRole('button', { name: 'Edit', exact: true }).click();
    await expect(dlg().getByText('Edit member')).toBeVisible();
    await field(dlg(), 'Address').fill('Koramangala 5th Block');
    await field(dlg(), 'Health notes').fill('Old knee injury');
    await dlg().getByRole('button', { name: 'Save changes' }).click();
    await toast(page, 'Member updated');
    await expect(page.getByText('Koramangala 5th Block')).toBeVisible();
    await expect(page.getByText('Old knee injury')).toBeVisible();
  });

  test('change plan on a membership', async () => {
    const { page } = ctx;
    await page.getByRole('button', { name: 'Change plan' }).click();
    const plan = selectField(dlg(), 'New plan');
    const yearly = await plan.locator('option', { hasText: /^Yearly/ }).getAttribute('value');
    await plan.selectOption(yearly);
    await dlg().getByRole('button', { name: 'Change plan' }).click();
    await toast(page, 'Plan changed. Credit applied');
    await expect(page.getByText(/^Yearly/).first()).toBeVisible();
  });

  test('cancel a membership with a reason', async () => {
    const { page } = ctx;
    await page.getByRole('button', { name: 'Cancel', exact: true }).first().click();
    await expect(dlg().getByText('Cancel membership').first()).toBeVisible();
    await expect(dlg().getByRole('button', { name: 'Cancel membership' })).toBeDisabled(); // reason required
    await field(dlg(), 'Reason').fill('Moving to another city');
    await dlg().getByRole('button', { name: 'Cancel membership' }).click();
    await toast(page, 'Membership cancelled');
    await expect(page.getByText('Cancelled: Moving to another city')).toBeVisible();
  });

  test('invoice PDF, collect due, payment receipt PDF', async () => {
    const { page } = ctx;
    await openMember(page, 'Deepa Due');
    await expectFile(page, () => page.getByRole('button', { name: 'Invoice' }).first().click(), '/pdf', 'pdf');
    await page.getByRole('button', { name: 'Collect due' }).click();
    await dlg().getByRole('button', { name: /Full due/ }).click();
    await dlg().getByRole('button', { name: 'Save payment' }).click();
    await toast(page, 'Payment recorded');
    await expect(page.getByRole('button', { name: 'Collect due' })).toHaveCount(0);
    await page.getByRole('button', { name: 'Payments', exact: true }).click();
    await expect(page.locator('tbody tr')).toHaveCount(2);
    await expectFile(page, () => page.getByRole('button', { name: 'Receipt' }).first().click(), '/receipt.pdf', 'pdf');
  });

  test('import members from a CSV file', async () => {
    const { page } = ctx;
    await nav(page, 'Members');
    await page.getByRole('button', { name: 'Import CSV' }).click();
    const csv = 'name,phone,email\nCsv Import One,9123499001,csv1@example.com\nCsv Import Two,9123499002,\nNo Phone Row,,\n';
    await dlg().locator('input[type="file"]').setInputFiles({ name: 'members.csv', mimeType: 'text/csv', buffer: Buffer.from(csv) });
    await expect(dlg().getByText('members.csv')).toBeVisible();
    await dlg().getByRole('button', { name: 'Import 2 member(s)' }).click();
    await toast(page, '2 member(s) imported');
    await expect(dlg().getByText(/Imported\s*2\s*member/)).toBeVisible();
    await dlg().getByRole('button', { name: 'Close', exact: true }).first().click();
    await page.getByPlaceholder(/Search name/).fill('Csv Import');
    await page.getByPlaceholder(/Search name/).press('Enter');
    await expect(page.locator('tbody tr')).toHaveCount(2);
  });

  test('delete a member, then restore from the deleted list', async () => {
    const { page } = ctx;
    await openMember(page, 'Zara Remove');
    await page.getByRole('button', { name: 'Delete', exact: true }).click();
    await expect(dlg().getByText('Delete member?')).toBeVisible();
    await dlg().getByRole('button', { name: 'Delete', exact: true }).click();
    await toast(page, 'Member deleted');
    await expect(page).toHaveURL(/\/admin\/members$/);
    await page.locator('main select').first().selectOption('deleted');
    await waitIdle(page);
    const row = page.locator('tbody tr', { hasText: 'Zara Remove' });
    await row.getByRole('button', { name: 'Restore' }).click();
    await toast(page, 'Member restored');
    await expect(row).toHaveCount(0);
    await page.locator('main select').first().selectOption('');
    await expect(page).not.toHaveURL(/deleted=/);
    await waitIdle(page);
    await page.getByPlaceholder(/Search name/).fill('Zara');
    await page.getByPlaceholder(/Search name/).press('Enter');
    await expect(page.locator('tbody').getByText('Zara Remove')).toBeVisible();
  });

  test('members Excel export', async () => {
    const { page } = ctx;
    await expectFile(page, () => page.getByRole('button', { name: 'Export expiring / expired (Excel)' }).click(), '/reports/memberships?export=xlsx', 'xlsx');
  });
});

test.describe.serial('member page: biometric, app access, fitness', () => {
  const ctx = staffPage('owner', (page) => openMember(page, 'Tara Fit'));
  const dlg = () => ctx.page.getByRole('dialog');

  test('biometric: record consent and re-sync', async () => {
    const { page } = ctx;
    await page.getByRole('button', { name: 'Biometric', exact: true }).click();
    await page.getByRole('button', { name: 'Record consent' }).click();
    await toast(page, 'Saved');
    await expect(page.getByText(/Biometric consent recorded on/)).toBeVisible();
    await expect(page.getByRole('switch', { name: /Fingerprint enrolled/ })).toBeEnabled();
    await page.getByRole('button', { name: 'Re-sync' }).click();
    await toast(page, 'Re-sync queued to devices');
  });

  test('disable member app access', async () => {
    const { page } = ctx;
    await page.getByRole('button', { name: 'App access (on)' }).click();
    await dlg().getByRole('button', { name: 'Disable access' }).click();
    await toast(page, 'Portal access updated');
    await expect(page.getByRole('button', { name: 'App access', exact: true })).toBeVisible();
  });

  test('fitness: new diet plan, assign a diet template, delete a measurement', async () => {
    const { page } = ctx;
    await page.getByRole('button', { name: 'Fitness', exact: true }).click();
    await page.getByRole('button', { name: 'New', exact: true }).nth(1).click(); // workout card first, diet card second
    await expect(dlg().getByText('New diet plan')).toBeVisible();
    await field(dlg(), 'Plan name').fill('Tara Veg Plan');
    await dlg().getByPlaceholder('Food').first().fill('Oats with milk');
    await dlg().getByPlaceholder('kcal', { exact: true }).first().fill('350');
    await dlg().getByRole('button', { name: 'Save plan' }).click();
    await toast(page, 'Diet plan saved');
    await expect(page.locator('p', { hasText: 'Tara Veg Plan' })).toBeVisible();

    const tpl = page.locator('select').filter({ has: page.locator('option', { hasText: 'Veg 1800 template' }) });
    await tpl.selectOption({ label: 'Veg 1800 template' });
    await tpl.locator('xpath=..').getByRole('button', { name: 'Assign' }).click();
    await toast(page, 'Plan assigned');
    await expect(page.locator('p.font-semibold', { hasText: 'Veg 1800 template' })).toBeVisible();

    const row = page.locator('tbody tr', { hasText: '64.5 kg' });
    await expect(row).toHaveCount(1);
    await row.getByRole('button', { name: 'Delete' }).click();
    await toast(page, 'Removed');
    await expect(row).toHaveCount(0);
    await shot(page, 'secondary-member-fitness');
  });
});

test.describe.serial('classes: timetable and schedule', () => {
  const ctx = staffPage('owner', (page) => nav(page, 'Classes'));
  const dlg = () => ctx.page.getByRole('dialog');
  const sessionButton = (name) => ctx.page.locator('main button', { hasText: name }).first();

  test('week navigation', async () => {
    const { page } = ctx;
    const label = page.locator('main span', { hasText: / – / }).first();
    const thisWeek = await label.textContent();
    await page.getByRole('button', { name: 'Next week' }).click();
    await expect(label).not.toHaveText(thisWeek);
    await page.getByRole('button', { name: 'Previous week' }).click();
    await page.getByRole('button', { name: 'Previous week' }).click();
    await expect(label).not.toHaveText(thisWeek);
    await page.getByRole('button', { name: 'This week' }).click();
    await expect(label).toHaveText(thisWeek);
    await expect(sessionButton('Pilates Open')).toBeVisible();
  });

  test('book a member into a class, then cancel the booking', async () => {
    const { page } = ctx;
    await sessionButton('Pilates Open').click();
    await dlg().getByPlaceholder('Add member: name, phone or code').fill('Tara');
    await dlg().getByRole('button', { name: 'Book', exact: true }).first().click();
    await toast(page, 'Booked');
    const row = dlg().locator('li', { hasText: 'Tara Fit' });
    await expect(row.getByText('booked', { exact: true })).toBeVisible();
    await row.getByRole('button', { name: 'Cancel booking' }).click();
    await toast(page, 'Booking cancelled');
    await expect(row).toHaveCount(0);
    await page.keyboard.press('Escape');
  });

  test('mark attended, then no-show, on a class that has started', async () => {
    const { page } = ctx;
    await sessionButton('HIIT Drill').click();
    const row = dlg().locator('li', { hasText: 'Priya Verma' });
    await row.getByRole('button', { name: 'Attended' }).click();
    await expect(row.getByText('attended', { exact: true })).toBeVisible();
    await row.getByRole('button', { name: 'No-show' }).click();
    await expect(row.getByText('no-show', { exact: true })).toBeVisible();
    await page.keyboard.press('Escape');
  });

  test('cancel a class with a reason', async () => {
    const { page } = ctx;
    await sessionButton('Pilates Open').click();
    await dlg().getByRole('button', { name: 'Cancel this class' }).click();
    await toast(page, 'Class cancelled.');
    await expect(sessionButton('Pilates Open')).toHaveClass(/line-through/);
  });

  test('edit a weekly schedule', async () => {
    const { page } = ctx;
    await page.getByRole('button', { name: 'Weekly schedule' }).click();
    const row = page.locator('tbody tr', { hasText: 'Yoga' }).first();
    await row.getByRole('button', { name: 'Edit' }).click();
    await expect(dlg().getByText('Edit schedule')).toBeVisible();
    await field(dlg(), 'Capacity').fill('14');
    await field(dlg(), 'Room / area').fill('Studio 2');
    await dlg().getByRole('button', { name: 'Save' }).click();
    await toast(page, 'Schedule saved');
    await expect(row.locator('td').nth(4)).toHaveText('14');
  });
});

test.describe.serial('personal training', () => {
  const ctx = staffPage('owner', (page) => nav(page, 'Personal training'));
  const dlg = () => ctx.page.getByRole('dialog');

  test('create a PT package and edit it', async () => {
    const { page } = ctx;
    await page.getByRole('button', { name: 'Packages', exact: true }).click();
    await page.getByRole('button', { name: 'New package' }).first().click();
    await field(dlg(), 'Name').fill('Starter 6');
    await field(dlg(), 'Sessions').fill('6');
    await field(dlg(), 'Price').fill('4800');
    await dlg().getByRole('button', { name: 'Save' }).click();
    await toast(page, 'Package saved');
    const row = page.locator('tbody tr', { hasText: 'Starter 6' });
    await expect(row).toContainText('₹4,800');
    await row.getByRole('button', { name: 'Edit package' }).click();
    await expect(dlg().getByText('Edit PT package')).toBeVisible();
    await field(dlg(), 'Price').fill('5400');
    await dlg().getByRole('button', { name: 'Save' }).click();
    await toast(page, 'Package saved');
    await expect(row).toContainText('₹5,400');
    await expect(row).toContainText('₹900'); // per session
  });

  test('log a no-show, then undo it from the session log', async () => {
    const { page } = ctx;
    await page.getByRole('button', { name: 'Active packages' }).click();
    await page.locator('tbody tr', { hasText: 'Rahul Sharma' }).first().getByRole('button', { name: 'Log session' }).click();
    await dlg().getByRole('button', { name: 'No-show' }).click();
    await dlg().getByLabel(/Notes/).fill('Did not turn up');
    await dlg().getByRole('button', { name: 'Save' }).click();
    await toast(page, 'Session logged.');
    await page.getByRole('button', { name: 'Session log' }).click();
    const row = page.locator('tbody tr', { hasText: 'Did not turn up' });
    await expect(row).toContainText('no-show');
    await row.getByRole('button', { name: 'Undo' }).click();
    await toast(page, 'Session removed and given back');
    await expect(row).toHaveCount(0);
  });
});

test.describe.serial('workouts & diet library', () => {
  const ctx = staffPage('owner', (page) => nav(page, 'Workouts & diet'));
  const dlg = () => ctx.page.getByRole('dialog');

  test('load starter library and add an exercise', async () => {
    const { page } = ctx;
    await page.getByRole('button', { name: 'Exercise library' }).click();
    await page.getByRole('button', { name: 'Load starter library' }).first().click();
    await toast(page, /^\d+ exercises added/);
    await page.getByRole('button', { name: 'Exercise', exact: true }).click();
    await field(dlg(), 'Name').fill('Cable Woodchop');
    await selectField(dlg(), 'Muscle group').selectOption('core');
    await field(dlg(), 'Equipment').fill('cable');
    await dlg().getByRole('button', { name: 'Save' }).click();
    await toast(page, 'Exercise added');
    await expect(page.locator('tbody tr', { hasText: 'Cable Woodchop' })).toContainText('core');
  });

  test('build a two-day workout template', async () => {
    const { page } = ctx;
    await page.getByRole('button', { name: 'Workout templates' }).click();
    await page.getByRole('button', { name: 'New template' }).first().click();
    await expect(dlg().getByText('New workout template')).toBeVisible();
    await field(dlg(), 'Plan name').fill('E2E Full Body');
    await dlg().getByPlaceholder('Exercise').nth(0).fill('Plank');
    await dlg().getByRole('button', { name: 'Exercise', exact: true }).click();
    await dlg().getByPlaceholder('Exercise').nth(1).fill('Burpee');
    await dlg().getByRole('button', { name: 'Add day' }).click();
    await dlg().getByPlaceholder('Exercise').nth(2).fill('Walking Lunge');
    await dlg().getByRole('button', { name: 'Save plan' }).click();
    await toast(page, 'Workout plan saved');
    await expect(page.locator('tbody tr', { hasText: 'E2E Full Body' })).toContainText('2 day(s)');
  });

  test('edit then remove the template', async () => {
    const { page } = ctx;
    await page.locator('tbody tr', { hasText: 'E2E Full Body' }).getByRole('button', { name: 'Edit' }).click();
    await expect(dlg().getByText('Edit workout plan')).toBeVisible();
    await field(dlg(), 'Plan name').fill('E2E Full Body v2');
    await selectField(dlg(), 'Level').selectOption('intermediate');
    await dlg().getByRole('button', { name: 'Save plan' }).click();
    await toast(page, 'Workout plan saved');
    const row = page.locator('tbody tr', { hasText: 'E2E Full Body v2' });
    await expect(row).toContainText('intermediate');
    await row.getByRole('button', { name: 'Remove' }).click();
    await toast(page, 'Template removed');
    await expect(row).toHaveCount(0);
  });
});

test.describe.serial('leads, shop, expenses', () => {
  const ctx = staffPage('owner');
  const dlg = () => ctx.page.getByRole('dialog');

  test('new enquiry, then mark it lost', async () => {
    const { page } = ctx;
    await nav(page, 'Leads');
    await page.getByRole('button', { name: 'New enquiry' }).first().click();
    await field(dlg(), 'Name').fill('Lost Lead');
    await field(dlg(), 'Phone').fill('9123488001');
    await dlg().getByRole('button', { name: 'Save' }).click();
    await toast(page, 'Lead added');
    await page.locator('tbody').getByText('Lost Lead').click();
    await dlg().getByRole('button', { name: 'Mark lost' }).click();
    await toast(page, 'Marked as lost');
    await page.getByRole('button', { name: /^Lost/ }).click();
    await expect(page.locator('tbody tr', { hasText: 'Lost Lead' })).toBeVisible();
  });

  test('shop: sale with receipt PDF, sales Excel, refund', async () => {
    const { page } = ctx;
    await nav(page, 'Shop');
    // With more than one branch (03 adds one) the owner picks the branch the sale is taken from.
    const from = page.getByRole('combobox', { name: 'Sell from branch' });
    if (await from.count()) await from.selectOption({ label: 'Sell from: Main Branch' });
    await expect(page.getByRole('button', { name: /Protein Bar/ })).toContainText('in stock');
    await page.getByRole('button', { name: /Protein Bar/ }).click();
    await page.getByRole('button', { name: /^Collect ₹/ }).click();
    await toast(page, /^Sale .+ done/);
    await expectFile(page, () => page.getByRole('button', { name: /^Print receipt/ }).click(), '/receipt.pdf', 'pdf');
    await page.getByRole('button', { name: 'Sales', exact: true }).click();
    await waitIdle(page);
    await expectFile(page, () => page.getByRole('button', { name: 'Excel' }).click(), '/shop/sales?', 'xlsx');
    const row = page.locator('tbody tr').filter({ has: page.getByRole('button', { name: 'Refund' }) }).first();
    await expectFile(page, () => row.getByRole('button', { name: 'Receipt' }).click(), '/receipt.pdf', 'pdf');
    await row.getByRole('button', { name: 'Refund' }).click();
    await toast(page, 'Refunded and stock returned');
    await expect(page.locator('tbody').getByText('refunded').first()).toBeVisible();
  });

  test('shop: edit a product', async () => {
    const { page } = ctx;
    await page.getByRole('button', { name: 'Products & stock' }).click();
    const row = page.locator('tbody tr', { hasText: 'Protein Bar' });
    await row.getByRole('button', { name: 'Edit' }).click();
    await expect(dlg().getByText('Edit product')).toBeVisible();
    await field(dlg(), 'Selling price').fill('120');
    await dlg().getByRole('button', { name: 'Save' }).click();
    await toast(page, 'Product saved');
    await expect(row).toContainText('₹120');
  });

  test('expenses: add, delete, Excel', async () => {
    const { page } = ctx;
    await nav(page, 'Expenses');
    await page.getByRole('button', { name: 'Add expense' }).first().click();
    await field(dlg(), 'Amount').fill('321');
    await field(dlg(), 'Note').fill('E2E delete me');
    await dlg().getByRole('button', { name: 'Save' }).click();
    await toast(page, 'Expense added');
    const row = page.locator('tbody tr', { hasText: 'E2E delete me' });
    await row.getByRole('button', { name: 'Delete' }).click();
    await toast(page, 'Deleted');
    await expect(row).toHaveCount(0);
    await expectFile(page, () => page.getByRole('button', { name: 'Excel' }).click(), '/expenses?', 'xlsx');
  });
});

test.describe.serial('payroll', () => {
  const ctx = staffPage('owner', (page) => nav(page, 'Payroll'));
  const row = () => ctx.page.locator('tbody tr', { hasText: 'Riya Reception' });
  const dlg = () => ctx.page.getByRole('dialog');

  test('generate last month and edit a payslip line', async () => {
    const { page } = ctx;
    await page.getByRole('button', { name: /Generate payroll|Recalculate drafts/ }).click();
    await toast(page, 'Payroll ready');
    await row().getByRole('button', { name: 'Edit' }).click();
    await dlg().getByRole('button', { name: 'Add' }).first().click();
    await dlg().getByPlaceholder('Description').first().fill('Festival bonus');
    await dlg().getByPlaceholder('₹').first().fill('500');
    await dlg().getByRole('button', { name: 'Save' }).click();
    await toast(page, 'Payslip updated');
    await row().getByRole('button', { name: 'Edit' }).click();
    await expect(dlg().getByPlaceholder('Description').first()).toHaveValue('Festival bonus');
    await page.keyboard.press('Escape');
  });

  test('finalize, reopen, finalize, mark as paid, payslip PDF', async () => {
    const { page } = ctx;
    await row().getByRole('button', { name: 'Finalize' }).click();
    await toast(page, 'Finalized');
    await row().getByRole('button', { name: 'Reopen' }).click();
    await toast(page, 'Back to draft');
    await expect(row()).toContainText('draft');
    await row().getByRole('button', { name: 'Finalize' }).click();
    await expect(row()).toContainText('finalized');
    await row().getByRole('button', { name: 'Pay', exact: true }).click();
    await dlg().getByRole('button', { name: 'Mark as paid' }).click();
    await toast(page, 'Marked as paid');
    await expect(row()).toContainText('paid');
    await expectFile(page, () => row().getByRole('button', { name: 'Payslip PDF' }).click(), '/pdf', 'pdf');
  });
});

test.describe.serial('equipment and devices', () => {
  const ctx = staffPage('owner');
  const dlg = () => ctx.page.getByRole('dialog');

  test('equipment: edit and open history', async () => {
    const { page } = ctx;
    await nav(page, 'Equipment');
    const row = page.locator('tbody tr', { hasText: 'Treadmill #1' });
    await row.getByRole('button', { name: 'Edit' }).click();
    await expect(dlg().getByText('Edit equipment')).toBeVisible();
    await field(dlg(), 'Location').fill('Cardio zone');
    await dlg().getByRole('button', { name: 'Save' }).click();
    await toast(page, 'Saved');
    await expect(row).toContainText('Cardio zone');
    await row.getByRole('button', { name: 'History' }).click();
    await expect(dlg().getByText('History · Treadmill #1')).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(dlg()).toHaveCount(0);
  });

  test('devices: edit, queue, full re-sync, reboot', async () => {
    const { page } = ctx;
    await nav(page, 'Biometric devices');
    const card = page.locator('div', { has: page.getByText('SN DEMO0000001') }).filter({ has: page.getByRole('button', { name: 'Queue' }) }).last();
    await card.getByRole('button', { name: 'Edit' }).click();
    await expect(dlg().getByText('Edit device')).toBeVisible();
    await field(dlg(), 'Name').fill('Main Entrance gate');
    await dlg().getByRole('button', { name: 'Save' }).click();
    await toast(page, 'Device updated');
    await expect(card).toContainText('Main Entrance gate');
    await card.getByRole('button', { name: 'Queue' }).click();
    await expect(dlg().getByText(/^Command queue · Main Entrance gate/)).toBeVisible();
    await page.keyboard.press('Escape');
    await card.getByRole('button', { name: 'Full re-sync' }).click();
    await toast(page, 'Full re-sync queued for');
    await card.getByRole('button', { name: 'Reboot' }).click();
    await toast(page, 'Reboot command queued');
  });
});

test.describe.serial('plans, coupons, companies', () => {
  const ctx = staffPage('owner', (page) => nav(page, 'Plans & coupons'));
  const dlg = () => ctx.page.getByRole('dialog');

  test('edit a plan', async () => {
    const { page } = ctx;
    const card = page.locator('div', { has: page.getByText('Day Pass', { exact: true }) }).filter({ has: page.getByRole('button', { name: 'Edit', exact: true }) }).last();
    await card.getByRole('button', { name: 'Edit', exact: true }).click();
    await expect(dlg().getByText('Edit plan')).toBeVisible();
    await field(dlg(), 'Price').fill('250');
    await dlg().getByRole('button', { name: 'Save' }).click();
    await toast(page, 'Plan saved');
    await expect(card).toContainText('₹250');
  });

  test('edit a coupon', async () => {
    const { page } = ctx;
    await page.getByRole('button', { name: 'New coupon' }).first().click();
    await field(dlg(), 'Code').fill('E2EEDIT');
    await dlg().getByRole('button', { name: 'Save' }).click();
    await toast(page, 'Coupon saved');
    const row = page.locator('tbody tr', { hasText: 'E2EEDIT' });
    await row.getByRole('button', { name: 'Edit coupon' }).click();
    await expect(dlg().getByText('Edit coupon')).toBeVisible();
    await field(dlg(), 'Max uses').fill('50');
    await dlg().getByRole('button', { name: 'Save' }).click();
    await toast(page, 'Coupon saved');
    await expect(row).toContainText('0 / 50');
  });

  test('company statement and its Excel', async () => {
    const { page } = ctx;
    await page.locator('tbody tr', { hasText: 'Acme Tech' }).getByRole('button', { name: 'Statement' }).click();
    await expect(dlg().getByText('Acme Tech · statement')).toBeVisible();
    await expect(dlg().getByText('Billed to company')).toBeVisible();
    await expectFile(page, () => dlg().getByRole('button', { name: 'Excel' }).click(), '/statement?export=xlsx', 'xlsx');
    await page.keyboard.press('Escape');
  });
});

test.describe.serial('reports, attendance, audit log', () => {
  const ctx = staffPage('owner');

  test('reports: date presets, window buttons and Excel exports', async () => {
    const { page } = ctx;
    await nav(page, 'Reports');
    const from = page.locator('main input[type="date"]').first();
    const thisMonth = await from.inputValue();
    await page.getByRole('button', { name: 'Last month' }).click();
    await expect(from).not.toHaveValue(thisMonth);
    await page.getByRole('button', { name: 'Last 90 days' }).click();
    await page.getByRole('button', { name: 'This month' }).click();
    await expect(from).toHaveValue(thisMonth);
    await waitIdle(page);
    await expectFile(page, () => page.getByRole('button', { name: 'Excel' }).click(), '/reports/collections?export=xlsx', 'xlsx');
    await page.getByRole('button', { name: 'Dues', exact: true }).click();
    await waitIdle(page);
    await expectFile(page, () => page.getByRole('button', { name: 'Excel' }).click(), '/reports/dues?export=xlsx', 'xlsx');
    await page.getByRole('button', { name: 'Expiring / expired' }).click();
    for (const d of [15, 30, 7]) {
      await page.getByRole('button', { name: `${d} days`, exact: true }).click();
      await expect(page.getByText(`Expiring in the next ${d} days`)).toBeVisible();
    }
  });

  test('attendance: visits Excel', async () => {
    const { page } = ctx;
    await nav(page, 'Attendance');
    await page.getByRole('button', { name: 'Visits', exact: true }).click();
    await waitIdle(page);
    await expectFile(page, () => page.getByRole('button', { name: 'Excel' }).click(), '/attendance?export=xlsx', 'xlsx');
  });

  test('settings: audit log pages', async () => {
    const { page } = ctx;
    await nav(page, 'Settings');
    await page.getByRole('button', { name: 'Audit log' }).click();
    await waitIdle(page);
    const next = page.getByRole('button', { name: 'Next', exact: true });
    await expect(next).toBeEnabled(); // the earlier tests in this file wrote well over 20 audit entries
    await expect(page.getByRole('button', { name: 'Prev', exact: true })).toBeDisabled();
    const first = await page.locator('tbody tr').first().textContent();
    await next.click();
    await expect(page.locator('tbody tr').first()).not.toHaveText(first);
    await page.getByRole('button', { name: 'Prev', exact: true }).click();
    await expect(page.locator('tbody tr').first()).toHaveText(first);
  });
});

test('leads: dismissing the "Mark lost" prompt keeps the lead open', async ({ page }) => {
  const watch = watchErrors(page);
  page.on('dialog', (d) => d.dismiss());
  await loginStaff(page, 'receptionist');
  await nav(page, 'Leads');
  await page.getByRole('button', { name: 'New enquiry' }).first().click();
  const dlg = page.getByRole('dialog');
  await field(dlg, 'Name').fill('Kept Lead');
  await field(dlg, 'Phone').fill('9123488002');
  await dlg.getByRole('button', { name: 'Save' }).click();
  await toast(page, 'Lead added');
  await page.locator('tbody').getByText('Kept Lead').click();
  await dlg.getByRole('button', { name: 'Mark lost' }).click();
  await page.waitForTimeout(500);
  await expect(dlg.getByRole('button', { name: 'Mark lost' })).toBeVisible(); // still open, nothing changed
  await page.keyboard.press('Escape');
  await expect(page.locator('tbody tr', { hasText: 'Kept Lead' })).toContainText(/new/i);
  watch.assertClean();
});

test('staff clock in, then clock out', async ({ page }) => {
  const watch = watchErrors(page);
  await loginStaff(page, 'manager');
  await page.getByRole('button', { name: 'Clock in' }).click();
  await toast(page, 'Clocked in');
  await page.getByRole('button', { name: /Clock out/ }).click();
  await toast(page, 'Clocked out');
  await expect(page.getByText(/Shift done/)).toBeVisible();
  await expect(page.getByRole('button', { name: /Clock out/ })).toHaveCount(0);
  watch.assertClean();
});

test('staff: log out other devices, change password, sign in with the new one', async ({ browser }) => {
  const login = async (page, password) => {
    await page.goto('/login');
    await page.getByLabel('Email or phone').fill('pwd.test@gym.local');
    await page.getByLabel('Password').fill(password);
    await page.getByRole('button', { name: 'Sign in' }).click();
    await expect(page).toHaveURL(/\/admin/);
  };
  const other = await browser.newPage();
  await login(other, 'Staff@12345');
  const page = await browser.newPage();
  const watch = watchErrors(page);
  await login(page, 'Staff@12345');
  await nav(page, 'My account');
  await expect(page.getByText('This device')).toBeVisible();
  await page.getByRole('button', { name: 'Log out other devices' }).click();
  await toast(page, 'Logged out everywhere else');
  await expect(page.getByRole('button', { name: 'Log out other devices' })).toHaveCount(0);
  await other.reload();
  await expect(other).toHaveURL(/\/login/); // the other browser's session is gone
  await other.close();

  await field(page.locator('main'), 'Current password').fill('Staff@12345');
  await field(page.locator('main'), 'New password').fill('Changed@2468');
  await page.getByRole('button', { name: 'Change password' }).click();
  await toast(page, 'Password changed');
  await expect(page).toHaveURL(/\/login/);
  await page.getByLabel('Email or phone').fill('pwd.test@gym.local');
  await page.getByLabel('Password').fill('Staff@12345');
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect(page.getByText(/Invalid|incorrect|wrong/i).first()).toBeVisible(); // old password no longer works
  await login(page, 'Changed@2468');
  watch.assertClean();
  await page.close();
});

test.describe('auth pages', () => {
  test('forgot password: sends a code with a generic message', async ({ page }) => {
    const watch = watchErrors(page);
    await page.goto('/forgot-password');
    await expect(page.getByText('Reset password')).toBeVisible();
    await field(page, 'Email').fill('owner@gym.local');
    await page.getByRole('button', { name: 'Send code' }).click();
    await toast(page, 'If the email is registered');
    await expect(field(page, '6-digit code')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Update password' })).toBeVisible();
    watch.assertClean();
  });

  test('member OTP login: code screen shows and a wrong code is refused', async ({ page }) => {
    const watch = watchErrors(page);
    await page.goto('/portal/login');
    await field(page, 'Phone').fill('9876500001');
    await page.getByRole('button', { name: 'Send code' }).click();
    await expect(page.getByText(/If 9876500001 is registered/)).toBeVisible();
    await field(page, '6-digit code').fill('000000');
    await page.getByRole('button', { name: 'Sign in' }).click();
    await expect(page.locator('p.bg-rose-50')).toBeVisible();
    await expect(page).toHaveURL(/\/portal\/login/);
    await page.getByRole('button', { name: 'Change number / resend code' }).click();
    await expect(page.getByRole('button', { name: 'Send code' })).toBeVisible();
    watch.assertClean();
  });
});

test.describe.serial('member app: coupon and waitlist', () => {
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

  test('renew: an invalid coupon shows an error', async () => {
    await page.goto('/portal/renew');
    await page.getByRole('button', { name: /^Monthly/ }).click();
    await page.getByPlaceholder('Coupon code').fill('nope99');
    await expect(page.getByPlaceholder('Coupon code')).toHaveValue('NOPE99');
    await page.getByRole('button', { name: 'Apply' }).click();
    await expect(page.getByText('Invalid coupon code')).toBeVisible();
  });

  test('classes: join the waitlist of a full class, then leave it', async () => {
    await page.goto('/portal/classes');
    const item = page.locator('li', { hasText: 'Spin Duo' });
    await expect(item).toContainText('Full');
    await item.getByRole('button', { name: 'Join waitlist' }).click();
    await toast(page, 'Added to the waitlist');
    await expect(item.getByText('On waitlist')).toBeVisible();
    await item.getByRole('button', { name: 'Cancel' }).click();
    await toast(page, 'Booking cancelled');
    await expect(item.getByRole('button', { name: 'Join waitlist' })).toBeVisible();
    await shot(page, 'secondary-member-waitlist');
  });
});
