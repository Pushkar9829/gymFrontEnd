import { test, expect } from '@playwright/test';
import { loginStaff, loginMember, watchErrors, shot, waitIdle, field, expectNoHorizontalScroll } from './helpers.js';

// Member growth: workout log + streaks, refer a friend (app code, Join link, desk "Referred by" -> free days),
// installable app (manifest) and push opt-in. Uses its own seeded member Gita Growth.
// The E2E server has no Razorpay or VAPID keys: online joining and push are off here (covered by backend tests).

const esc = (t) => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const toast = (page, text) => expect(page.locator('[data-sonner-toast]').getByText(typeof text === 'string' ? new RegExp(`^${esc(text)}`) : text).first()).toBeVisible();
const GITA = '9876515001';

test.describe.serial('member growth', () => {
  let m;
  let watch;
  let code;
  test.beforeAll(async ({ browser }) => {
    m = await browser.newPage({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
    watch = watchErrors(m);
    // 12 may have switched on "ask members to sign the waiver": skip the one-time jump to the waiver page.
    await m.addInitScript(() => sessionStorage.setItem('gym.waiverPrompted', '1'));
    await loginMember(m, GITA);
  });
  test.afterAll(async () => {
    watch.assertClean();
    await m.close();
  });

  test('home shows the visit streak; no push button without VAPID keys', async () => {
    const streak = m.getByRole('link', { name: 'My progress' });
    await expect(streak).toContainText('2-week streak');
    await expect(streak).toContainText('0/3 visits this week');
    await expect(streak).toContainText('1 badge');
    await expect(m.getByRole('button', { name: 'Turn on notifications' })).toHaveCount(0);
    await expectNoHorizontalScroll(m);
    await shot(m, 'flow-growth-home');
  });

  test("logs today's workout and sees it in the history", async () => {
    await m.getByRole('link', { name: 'My plan' }).click();
    await expect(m.getByRole('heading', { name: "Today's workout" })).toBeVisible();
    await expect(m.getByRole('combobox', { name: /Plan day/ })).toHaveValue('0'); // Day 1 suggested first
    const finish = m.getByRole('button', { name: /^Finish workout/ });
    await expect(finish).toBeDisabled();
    await m.getByRole('checkbox', { name: /Bench press/ }).check();
    await m.getByLabel('Sets done: Bench press').fill('3');
    await m.getByLabel('Reps: Bench press').fill('10');
    await m.getByLabel('Weight: Bench press').fill('42.5 kg');
    await expectNoHorizontalScroll(m);
    await shot(m, 'flow-growth-workout');
    await finish.click();
    await toast(m, 'Workout saved');
    const main = m.locator('main');
    await expect(main.getByText(/^Done today: Day 1 - Push/)).toBeVisible();
    const past = main.getByRole('button', { name: /Day 1 - Push/ });
    await past.click();
    await expect(main.getByText('· 3 sets · 10 reps · 42.5 kg')).toBeVisible();
    // Next time the app suggests day 2.
    await expect(m.getByRole('combobox', { name: /Plan day/ })).toHaveValue('1');
    await shot(m, 'flow-growth-history');
  });

  test('home and My progress show the new badge', async () => {
    await m.getByRole('link', { name: 'Home' }).click();
    const streak = m.getByRole('link', { name: 'My progress' });
    await expect(streak).toContainText('1/3 visits this week');
    await expect(streak).toContainText('2 badges');
    await streak.click();
    await expect(m.getByRole('heading', { name: 'My progress' })).toBeVisible();
    await expect(m.locator('main').getByText('First workout logged')).toBeVisible();
    await expect(m.locator('main').getByText('10 gym visits')).toBeVisible();
    await shot(m, 'flow-growth-progress');
  });

  test('invite a friend shows the code and share options', async () => {
    await m.getByRole('link', { name: 'Home' }).click();
    await m.getByRole('link', { name: /Invite a friend/ }).click();
    await expect(m.getByRole('heading', { level: 1, name: 'Invite a friend' })).toBeVisible();
    code = (await m.getByTestId('referral-code').innerText()).trim();
    expect(code).toMatch(/^[A-Z0-9]{6}$/);
    await expect(m.getByText('15 free days')).toBeVisible();
    const wa = m.getByRole('link', { name: 'Send on WhatsApp' });
    await expect(wa).toHaveAttribute('href', new RegExp(`^https://wa\\.me/\\?text=.*${encodeURIComponent(`/join?ref=${code}`).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`));
    await expect(m.getByRole('button', { name: 'Share' })).toBeVisible();
    await expectNoHorizontalScroll(m);
    await shot(m, 'flow-growth-invite');
  });

  test('the shared Join link fills in the referral code (no online payments here: enquiry form only)', async ({ browser }) => {
    const p = await browser.newPage({ viewport: { width: 390, height: 844 }, isMobile: true });
    const w = watchErrors(p);
    await p.goto(`/join?ref=${code.toLowerCase()}`);
    await expect(p.getByText(/Invited by/)).toContainText('Gita G.');
    await expect(p.getByRole('tab', { name: 'Join online' })).toHaveCount(0);
    await expect(field(p, 'Referral code')).toHaveValue(code);
    await expect(p.getByRole('button', { name: 'Call me back' })).toBeVisible();
    await expectNoHorizontalScroll(p);
    await shot(p, 'flow-growth-join-ref');
    w.assertClean();
    await p.close();
  });
});

test('desk: "Referred by" at registration, first membership -> referrer gets 15 free days', async ({ page }) => {
  test.setTimeout(120_000);
  const watch = watchErrors(page);
  await loginStaff(page, 'receptionist');
  // Gita's end date before the friend joins.
  await page.getByRole('link', { name: 'Members', exact: true }).click();
  await page.getByPlaceholder(/Search name/).fill('Gita Growth');
  await page.getByPlaceholder(/Search name/).press('Enter');
  await page.locator('tbody').getByText('Gita Growth').first().click();
  await expect(page.getByRole('heading', { level: 1, name: /Gita Growth/ })).toBeVisible();
  const endBefore = (await page.locator('main').getByText(/→/).first().innerText()).split('→')[1].trim();

  await page.getByRole('link', { name: 'Members', exact: true }).click();
  await page.getByRole('button', { name: 'Register member' }).click();
  const dlg = page.getByRole('dialog');
  await field(dlg, 'Full name').fill('Rohan Referred');
  await field(dlg, 'Phone').fill('9876515002');
  await dlg.getByPlaceholder(/Search the member who referred them/).fill('Gita');
  await dlg.getByRole('button', { name: /Gita Growth/ }).click();
  await expect(dlg.getByText('Gita Growth')).toBeVisible();
  await shot(page, 'flow-growth-referred-by');
  await dlg.getByRole('button', { name: 'Register', exact: true }).click();
  await toast(page, 'Member registered');
  await expect(page.getByRole('heading', { level: 1, name: /Rohan Referred/ })).toBeVisible();
  await expect(page.locator('main').getByText('Waiting for first payment')).toBeVisible();

  await page.getByRole('button', { name: 'Add membership' }).click();
  const add = page.getByRole('dialog');
  await add.getByRole('button', { name: /^Monthly/ }).click();
  await add.getByRole('button', { name: 'Received full amount' }).click();
  await add.getByRole('button', { name: 'Save membership' }).click();
  await toast(page, 'Membership added');
  await expect(page.locator('main').getByText('Rewarded', { exact: true })).toBeVisible();

  // On Gita's page: the membership now ends 15 days later.
  await page.locator('main').getByRole('button', { name: /Gita Growth #/ }).click();
  await expect(page.getByRole('heading', { level: 1, name: /Gita Growth/ })).toBeVisible();
  const main = page.locator('main');
  await expect(main.getByText(/\+15 days · Referral reward: Rohan Referred joined/)).toBeVisible();
  await expect(main.getByText(`(was ${endBefore})`)).toBeVisible();
  await shot(page, 'flow-growth-referrer-extended');
  watch.assertClean();
});

test('owner sees the referral in Reports > Referrals', async ({ page }) => {
  const watch = watchErrors(page);
  await loginStaff(page, 'owner');
  await page.getByRole('link', { name: 'Reports', exact: true }).click();
  await page.locator('main').getByRole('button', { name: /^Referrals\s*\d*$/ }).click();
  const row = page.locator('main tbody tr', { hasText: 'Rohan Referred' });
  await expect(row).toContainText('Gita Growth');
  await expect(row).toContainText('Rewarded');
  await expect(row).toContainText('+15 days');
  await shot(page, 'flow-growth-report');
  watch.assertClean();
});

test('installable app: manifest served and linked, with icons', async ({ page, request }) => {
  await page.goto('/portal/login');
  await expect(page.locator('link[rel="manifest"]')).toHaveAttribute('href', '/manifest.webmanifest');
  const res = await request.get('/manifest.webmanifest');
  expect(res.ok()).toBeTruthy();
  const manifest = await res.json();
  expect(manifest.name).toBe('Gym Member');
  expect(manifest.start_url).toBe('/portal');
  expect(manifest.theme_color).toBe('#0f766e');
  const sizes = manifest.icons.map((i) => `${i.sizes}:${i.purpose}`);
  expect(sizes).toEqual(expect.arrayContaining(['192x192:any', '512x512:any', '512x512:maskable']));
  for (const icon of manifest.icons) {
    const r = await request.get(icon.src);
    expect(r.ok(), icon.src).toBeTruthy();
    expect(r.headers()['content-type']).toContain('image/png');
  }
  const sw = await request.get('/sw.js');
  expect(sw.ok()).toBeTruthy();
  expect(await sw.text()).toContain("addEventListener('push'");
});
