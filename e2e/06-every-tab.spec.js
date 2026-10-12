import { test, expect } from '@playwright/test';
import { loginStaff, loginMember, watchErrors, shot, waitIdle } from './helpers.js';

// Every inner tab of every screen gets clicked at least once: no crash, no server error, no error box.
const STAFF_TABS = [
  { url: '/admin/attendance', tabs: ['In gym now', 'Visits', 'Entry log', 'Staff'] },
  { url: '/admin/classes', tabs: ['Timetable', 'Weekly schedule', 'Class types'] },
  { url: '/admin/leads', tabs: ['All', 'New', 'Contacted', 'Trial', 'Follow-ups due', 'Converted', 'Lost'] },
  { url: '/admin/pt', tabs: ['Active packages', 'Packages', 'Session log', 'Trainer commission'] },
  { url: '/admin/fitness', tabs: ['Exercise library', 'Workout templates', 'Diet templates'] },
  { url: '/admin/shop', tabs: ['New sale', 'Products & stock', 'Sales'] },
  { url: '/admin/reports', tabs: ['Income & P&L', 'Dues', 'Expiring / expired', 'Attendance', 'Leads', 'Branches', 'Staff performance', 'Retention', 'GST & Tally'] },
  { url: '/admin/cash', tabs: ['Close day', 'History'] },
  { url: '/admin/approvals', tabs: ['Waiting', 'Approved', 'Used', 'Rejected', 'Expired', 'All'] },
  { url: '/admin/feedback', tabs: ['Open', 'In progress', 'Resolved', 'Closed', 'All'] },
  { url: '/admin/trials', tabs: ['Active', 'Upcoming', 'Ended', 'Joined', 'All'] },
  { url: '/admin/handover', tabs: ['Open tasks', 'Done', 'Notes', 'All'] },
  { url: '/admin/settings', tabs: ['Gym & entry rules', 'Branches', 'Staff', 'Audit log', 'My account'] },
];

const MEMBER_TABS = ['Memberships', 'Personal training', 'Fitness', 'Payments', 'Attendance & entry log', 'Biometric'];

async function clickTabs(page, tabs, prefix) {
  for (const name of tabs) {
    // A tab may carry a count badge ("New 3"), so allow an optional number after the label.
    const label = new RegExp(`^${name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*\\d*$`);
    await page.locator('main').getByRole('button', { name: label }).first().click();
    await waitIdle(page);
    await expect(page.getByText('Something went wrong')).toHaveCount(0);
    await shot(page, `tab-${prefix}-${name.replace(/\W+/g, '-').toLowerCase()}`);
  }
}

test('owner: every tab on every screen opens cleanly', async ({ page }) => {
  test.setTimeout(300_000);
  const watch = watchErrors(page);
  await loginStaff(page, 'owner');
  for (const { url, tabs } of STAFF_TABS) {
    await page.goto(url);
    await waitIdle(page);
    await clickTabs(page, tabs, url.split('/').pop());
  }
  // Member detail tabs
  await page.goto('/admin/members');
  await page.locator('tbody').getByText('Rahul Sharma').first().click();
  await expect(page.getByRole('heading', { level: 1, name: /Rahul Sharma/ })).toBeVisible();
  await clickTabs(page, MEMBER_TABS, 'member');
  // A class on the timetable opens its roster
  await page.goto('/admin/classes');
  await waitIdle(page);
  await page.locator('main').getByText('Yoga').first().click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await shot(page, 'tab-classes-session-popup');
  watch.assertClean();
});

test('member app: every tab and the renew page open cleanly', async ({ browser }) => {
  test.setTimeout(120_000);
  const page = await browser.newPage({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  const watch = watchErrors(page);
  await loginMember(page);
  await page.getByRole('link', { name: 'My plan' }).click();
  await clickTabs(page, ['Workout', 'Diet', 'Progress'], 'portal-plan');
  await page.getByRole('link', { name: 'History' }).click();
  await clickTabs(page, ['Visits', 'Payments'], 'portal-history');
  await page.goto('/portal/renew');
  await waitIdle(page);
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  await shot(page, 'tab-portal-renew');
  watch.assertClean();
  await page.close();
});
