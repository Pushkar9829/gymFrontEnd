import { test, expect } from '@playwright/test';
import { loginStaff, loginMember, watchErrors, shot, waitIdle, expectNoHorizontalScroll } from './helpers.js';

const ROUTES = [
  'admin', 'admin/check-in', 'admin/handover', 'admin/members', 'admin/trials', 'admin/attendance', 'admin/payments', 'admin/lockers', 'admin/feedback', 'admin/classes', 'admin/pt', 'admin/fitness',
  'admin/leads', 'admin/messages', 'admin/plans', 'admin/shop', 'admin/cash', 'admin/approvals', 'admin/expenses', 'admin/payroll', 'admin/reports', 'admin/equipment',
  'admin/devices', 'admin/settings',
];

test.use({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });

test('every staff screen fits a phone (no sideways scrolling)', async ({ page }) => {
  test.setTimeout(150_000); // 24 screens, each with a screenshot
  const watch = watchErrors(page);
  await loginStaff(page, 'owner');
  const problems = [];
  for (const r of ROUTES) {
    await page.goto(`/${r}`);
    await waitIdle(page);
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    const { scroll, width } = await page.evaluate(() => ({ scroll: document.documentElement.scrollWidth, width: window.innerWidth }));
    if (scroll > width + 1) problems.push(`${r}: ${scroll}px wide`);
    await shot(page, `mobile-${r.replace(/\W+/g, '-')}`);
  }
  // A member detail page too
  await page.goto('/admin/members');
  await page.getByText('Rahul Sharma').first().click();
  await waitIdle(page);
  await shot(page, 'mobile-member-detail');
  await expectNoHorizontalScroll(page);
  expect(problems, problems.join('\n')).toEqual([]);
  watch.assertClean();
});

test('member app pages fit a phone (no sideways scrolling)', async ({ page }) => {
  test.setTimeout(90_000);
  const watch = watchErrors(page);
  await loginMember(page);
  const problems = [];
  for (const r of ['portal', 'portal/fitness', 'portal/classes', 'portal/history', 'portal/feedback', 'portal/pt', 'portal/freeze', 'portal/waiver']) {
    await page.goto(`/${r}`);
    await waitIdle(page);
    const { scroll, width } = await page.evaluate(() => ({ scroll: document.documentElement.scrollWidth, width: window.innerWidth }));
    if (scroll > width + 1) problems.push(`${r}: ${scroll}px wide`);
    await shot(page, `mobile-${r.replace(/\W+/g, '-')}`);
  }
  expect(problems, problems.join('\n')).toEqual([]);
  watch.assertClean();
});

test('menu opens and closes on a phone', async ({ page }) => {
  await loginStaff(page, 'receptionist');
  await page.getByRole('button', { name: 'Open menu' }).click();
  await page.getByRole('link', { name: 'Members', exact: true }).last().click();
  await expect(page.getByRole('heading', { level: 1, name: 'Members' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Close menu' })).toHaveCount(0);
});
