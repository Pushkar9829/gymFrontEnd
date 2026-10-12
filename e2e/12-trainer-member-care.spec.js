import { test, expect } from '@playwright/test';
import { createRequire } from 'node:module';
import zlib from 'node:zlib';
import { loginStaff, watchErrors, shot, waitIdle, field, expectNoHorizontalScroll } from './helpers.js';


// Trainer and member care: PT slot booking, progress notes with private photos, freeze request from the app,
// digital waiver signed on a phone. Uses its own seeded records: trainer Tej Trainer and member Kavya Care.

const esc = (t) => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const toast = (page, text) => expect(page.locator('[data-sonner-toast]').getByText(typeof text === 'string' ? new RegExp(`^${esc(text)}`) : text).first()).toBeVisible();
const TEJ = { email: 'tej@gym.local', password: 'Staff@12345' };
const KAVYA = { phone: '9876514001', password: 'Member@123' };
const E2E_DB = 'mongodb://127.0.0.1:27017/gym_mgmt_e2e';

const require = createRequire(import.meta.url);
/** Moves Kavya's upcoming PT booking to "started 5 minutes ago", so it can be marked done now. */
async function startBookingNow() {
  const { MongoClient } = require('../../server/node_modules/mongodb');
  const client = await MongoClient.connect(E2E_DB);
  try {
    const db = client.db();
    const kavya = await db.collection('members').findOne({ phone: KAVYA.phone });
    const r = await db.collection('ptbookings').updateOne({ memberId: kavya._id, status: 'booked' }, { $set: { startsAt: new Date(Date.now() - 5 * 60000), endsAt: new Date(Date.now() + 55 * 60000) } });
    expect(r.modifiedCount).toBe(1);
  } finally {
    await client.close();
  }
}

/** A real PNG with random pixels (a "progress photo"). */
function makePng(w = 40, h = 40) {
  const chunk = (type, data) => {
    const len = Buffer.alloc(4);
    len.writeUInt32BE(data.length);
    const td = Buffer.concat([Buffer.from(type), data]);
    const crc = Buffer.alloc(4);
    crc.writeUInt32BE(zlib.crc32(td) >>> 0);
    return Buffer.concat([len, td, crc]);
  };
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0);
  ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8;
  ihdr[9] = 2;
  const raw = Buffer.alloc((w * 3 + 1) * h);
  for (let i = 0; i < raw.length; i += 1) raw[i] = i % (w * 3 + 1) === 0 ? 0 : (i * 37) % 256;
  return Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), chunk('IHDR', ihdr), chunk('IDAT', zlib.deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]);
}

async function staffPage(browser, who) {
  const page = await browser.newPage();
  page.on('dialog', (d) => d.accept());
  const watch = watchErrors(page);
  if (typeof who === 'string') await loginStaff(page, who);
  else {
    await page.goto('/login');
    await page.getByLabel('Email or phone').fill(who.email);
    await page.getByLabel('Password').fill(who.password);
    await page.getByRole('button', { name: 'Sign in' }).click();
    await expect(page).toHaveURL(/\/admin/, { timeout: 20_000 });
  }
  return { page, watch };
}

const menu = async (page, name) => {
  const link = page.locator('aside nav').first().getByRole('link', { name, exact: true });
  await link.click();
  await expect(link).toHaveAttribute('aria-current', 'page');
  await waitIdle(page);
};
const tab = async (page, name) => {
  await page.locator('main').getByRole('button', { name: new RegExp(`^${esc(name)}\\s*\\d*$`) }).first().click();
  await waitIdle(page);
};
const openMember = async (page, name) => {
  await menu(page, 'Members');
  await page.getByPlaceholder(/Search name/).fill(name);
  await page.getByPlaceholder(/Search name/).press('Enter');
  await page.locator('tbody').getByText(name).first().click();
  await expect(page.getByRole('heading', { level: 1, name: new RegExp(name) })).toBeVisible();
  await waitIdle(page);
};

test.describe.serial('trainer and member care', () => {
  test.setTimeout(120_000);
  let tej;
  let rec;
  let owner;
  let member;

  test.beforeAll(async ({ browser }) => {
    tej = await staffPage(browser, TEJ);
    rec = await staffPage(browser, 'receptionist');
    owner = await staffPage(browser, 'owner');
    const page = await browser.newPage({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
    page.on('dialog', (d) => d.accept());
    member = { page, watch: watchErrors(page) };
    await page.goto('/portal/login');
    await page.getByRole('button', { name: 'Password' }).click();
    await page.getByLabel('Phone').fill(KAVYA.phone);
    await page.getByLabel('Password').fill(KAVYA.password);
    await page.getByRole('button', { name: 'Sign in' }).click();
    await expect(page).toHaveURL(/\/portal$/, { timeout: 20_000 });
  });
  test.afterAll(async () => {
    for (const p of [tej, rec, owner, member].filter(Boolean)) {
      p.watch.assertClean();
      await p.page.close();
    }
  });

  test('trainer sets weekly PT hours', async () => {
    const page = tej.page;
    await menu(page, 'Personal training');
    await tab(page, 'Availability');
    const main = page.locator('main');
    await expect(main.getByText('Weekly PT hours')).toBeVisible();
    await main.getByRole('button', { name: 'Add hours on Monday' }).click();
    await main.getByLabel('Monday from').fill('06:00');
    await main.getByLabel('Monday to').fill('22:00');
    await main.getByRole('button', { name: /Copy Monday/ }).click();
    await main.getByRole('button', { name: 'Add hours on Sunday' }).click();
    await main.getByLabel('Sunday from').fill('06:00');
    await main.getByLabel('Sunday to').fill('22:00');
    await expect(main.getByLabel('Saturday from')).toHaveValue('06:00');
    await main.getByRole('button', { name: 'Save hours' }).click();
    await toast(page, 'PT hours saved');
    await shot(page, 'flow-pt-availability');
  });

  test('member books a PT slot in the app', async () => {
    const page = member.page;
    await page.reload();
    await waitIdle(page);
    const ptCard = page.locator('main').getByText('Personal training').first();
    await expect(ptCard).toBeVisible();
    await page.getByRole('link', { name: 'Book PT session' }).click();
    await expect(page.getByRole('heading', { level: 1, name: 'Personal training' })).toBeVisible();
    await waitIdle(page);
    await expect(page.getByText('With Tej Trainer')).toBeVisible();
    // First day with free slots is chosen; take its first time.
    const slots = page.locator('main .grid button:not([disabled])');
    await slots.first().click();
    await page.getByRole('button', { name: /^Book / }).click();
    await toast(page, 'Booked:');
    await expect(page.locator('main').getByText('Booked', { exact: true }).first()).toBeVisible();
    await expectNoHorizontalScroll(page);
    await shot(page, 'flow-portal-pt-booked');
  });

  test('trainer sees the booking in the PT schedule and marks it done: sessions left goes down', async () => {
    const page = tej.page;
    // The slot is in the future: move it to "now" so it can be marked (marking opens 30 minutes before).
    await startBookingNow();
    await menu(page, 'Personal training');
    await tab(page, 'PT schedule');
    const row = page.locator('main li', { hasText: 'Kavya Care' });
    await expect(row).toBeVisible();
    await expect(row.getByText('Booked', { exact: true })).toBeVisible();
    await shot(page, 'flow-pt-schedule');
    await row.getByRole('button', { name: 'Mark done' }).click();
    const dlg = page.getByRole('dialog');
    await dlg.getByLabel('Notes (optional)').fill('Upper body, good form');
    await dlg.getByRole('button', { name: 'Mark done' }).click();
    await toast(page, 'Session done. 9 session(s) left.');
    await expect(row.getByText('Done', { exact: true })).toBeVisible();
    await tab(page, 'Active packages');
    const pkg = page.locator('tbody tr', { hasText: 'Kavya Care' });
    await expect(pkg).toContainText('9');
    await expect(pkg).toContainText('/ 10');
    // Member app shows it too
    await member.page.goto('/portal');
    await waitIdle(member.page);
    await expect(member.page.locator('main li', { hasText: '10 sessions' })).toContainText(/9\s*sessions left/);
  });

  test('trainer adds a progress note with a photo; the member sees it in the app', async () => {
    const page = tej.page;
    await openMember(page, 'Kavya Care');
    await page.locator('main').getByRole('button', { name: /^Fitness$/ }).click();
    await waitIdle(page);
    await expect(page.getByRole('heading', { name: 'Progress notes' })).toBeVisible();
    await page.getByRole('button', { name: 'Add note' }).first().click();
    const dlg = page.getByRole('dialog');
    await field(dlg, 'Note').fill('Lost 1.5 kg this month. Posture better.');
    await dlg.getByLabel('Add photos').setInputFiles({ name: 'front.png', mimeType: 'image/png', buffer: makePng() });
    await expect(dlg.getByAltText('New progress photo')).toBeVisible();
    await dlg.getByRole('button', { name: 'Save note' }).click();
    await toast(page, 'Progress note added');
    await expect(page.getByText('Lost 1.5 kg this month. Posture better.')).toBeVisible();
    const img = page.getByRole('button', { name: 'Progress photo' }).first().locator('img');
    await expect(img).toBeVisible();
    expect(await img.evaluate((el) => el.naturalWidth)).toBeGreaterThan(0);
    await shot(page, 'flow-progress-note');

    const m = member.page;
    await m.getByRole('link', { name: 'My plan' }).click();
    await m.locator('main').getByRole('button', { name: /^Progress/ }).click();
    await expect(m.getByText('Lost 1.5 kg this month. Posture better.')).toBeVisible();
    const photo = m.getByRole('button', { name: 'Progress photo' }).first().locator('img');
    await expect(photo).toBeVisible();
    expect(await photo.evaluate((el) => el.naturalWidth)).toBeGreaterThan(0);
    await expectNoHorizontalScroll(m);
    await shot(m, 'flow-portal-progress');
  });

  test('member requests a freeze; reception approves; member sees it approved', async () => {
    const m = member.page;
    await m.getByRole('link', { name: 'Home' }).click();
    await m.getByRole('link', { name: /Request a freeze/ }).click();
    await expect(m.getByRole('heading', { level: 1, name: 'Freeze membership' })).toBeVisible();
    await expect(m.getByText(/20.*of 20 freeze day\(s\) left/)).toBeVisible();
    await field(m.locator('main'), 'Days').fill('5');
    await field(m.locator('main'), 'Reason').fill('Family wedding out of town');
    await m.getByRole('button', { name: 'Send request' }).click();
    await toast(m, 'Freeze request sent');
    await expect(m.getByText('Request waiting')).toBeVisible();
    await expectNoHorizontalScroll(m);

    const page = rec.page;
    await menu(page, 'Approvals');
    await expect(page.getByRole('heading', { level: 1, name: 'Approvals' })).toBeVisible();
    const row = page.locator('main li', { hasText: 'Kavya Care' });
    await expect(row).toContainText('Family wedding out of town');
    await row.getByRole('button', { name: 'Approve' }).click();
    const dlg = page.getByRole('dialog');
    await expect(dlg.getByText(/20 of 20 freeze day/)).toBeVisible();
    await dlg.getByRole('button', { name: 'Approve' }).click();
    await toast(page, 'Freeze approved');
    await expect(page.getByText('No freeze requests waiting')).toBeVisible();
    await shot(page, 'flow-freeze-approved');

    await m.reload();
    await waitIdle(m);
    await expect(m.locator('main li').getByText('Approved')).toBeVisible();
    await shot(m, 'flow-portal-freeze');
  });

  test('member signs the waiver on the phone; member page shows it signed and the PDF downloads', async () => {
    const page = owner.page;
    await menu(page, 'Settings');
    await tab(page, 'Waiver');
    await page.getByRole('button', { name: 'Start from an example' }).click();
    await page.getByRole('switch', { name: /Ask members to sign/ }).click();
    await page.getByRole('button', { name: 'Save waiver' }).click();
    await toast(page, 'Waiver version 1 saved');
    await expect(page.getByText('Version 1').first()).toBeVisible();
    // The entry switch warns how many members have not signed yet
    await page.getByRole('switch', { name: /Require a signed waiver for entry/ }).click();
    await expect(page.getByRole('alert')).toContainText(/\d+ active member\(s\)/);
    await page.getByRole('switch', { name: /Require a signed waiver for entry/ }).click();
    await shot(page, 'flow-waiver-settings');

    const m = member.page;
    await m.goto('/portal');
    await expect(m).toHaveURL(/\/portal\/waiver$/); // asked straight away on the first visit
    await expect(m.getByRole('heading', { level: 1, name: 'Gym waiver' })).toBeVisible();
    await m.getByRole('checkbox').check();
    const box = await m.getByLabel('Signature box').boundingBox();
    await m.mouse.move(box.x + 30, box.y + 120);
    await m.mouse.down();
    for (let i = 1; i <= 12; i += 1) await m.mouse.move(box.x + 30 + i * 20, box.y + 120 - (i % 2 ? 40 : 0), { steps: 3 });
    await m.mouse.up();
    await expectNoHorizontalScroll(m);
    await m.getByRole('button', { name: 'Sign waiver' }).click();
    await toast(m, 'Thank you. Waiver signed.');
    await expect(m).toHaveURL(/\/portal$/);
    await expect(m.locator('main').getByText('Waiver signed', { exact: true })).toBeVisible();
    await shot(m, 'flow-portal-waiver-signed');

    const desk = rec.page;
    await openMember(desk, 'Kavya Care');
    await expect(desk.getByText(/^Waiver signed v1 on/)).toBeVisible();
    const [res, dl] = await Promise.all([
      desk.waitForResponse((r) => r.url().includes('/waiver/pdf')),
      desk.waitForEvent('download'),
      desk.getByRole('button', { name: 'Waiver PDF' }).click(),
    ]);
    expect(res.status()).toBe(200);
    expect(res.headers()['content-type']).toContain('application/pdf');
    expect(dl.suggestedFilename()).toMatch(/\.pdf$/);
    await shot(desk, 'flow-member-waiver-signed');
  });
});
