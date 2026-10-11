import { test, expect } from '@playwright/test';
import { loginStaff, watchErrors, shot, waitIdle } from './helpers.js';

// Every menu item each role can see, with the heading its screen must show.
const SCREENS = [
  { label: 'Dashboard', heading: 'Dashboard' },
  { label: 'Check-in', heading: 'Check-in' },
  { label: 'Members', heading: 'Members' },
  { label: 'Attendance', heading: 'Attendance' },
  { label: 'Payments', heading: 'Payments' },
  { label: 'Classes', heading: 'Classes' },
  { label: 'Personal training', heading: 'Personal training' },
  { label: 'Workouts & diet', heading: 'Workouts & diet' },
  { label: 'Leads', heading: 'Leads & enquiries' },
  { label: 'Messages', heading: 'Messages' },
  { label: 'Plans & coupons', heading: 'Membership plans' },
  { label: 'Shop', heading: 'Shop' },
  { label: 'Expenses', heading: 'Expenses' },
  { label: 'Payroll', heading: 'Payroll' },
  { label: 'Reports', heading: 'Reports' },
  { label: 'Equipment', heading: 'Equipment' },
  { label: 'Biometric devices', heading: 'Biometric devices' },
  { label: 'Settings', heading: 'Settings' },
  { label: 'My account', heading: 'My account' },
];

// What each role must (not) see in the menu.
const ROLE_MENU = {
  owner: SCREENS.map((s) => s.label).filter((l) => l !== 'My account'),
  manager: SCREENS.map((s) => s.label).filter((l) => l !== 'My account'),
  receptionist: ['Dashboard', 'Check-in', 'Members', 'Attendance', 'Payments', 'Classes', 'Personal training', 'Workouts & diet', 'Leads', 'Messages', 'Plans & coupons', 'Shop', 'Expenses', 'Equipment', 'Biometric devices', 'My account'],
  trainer: ['Dashboard', 'Members', 'Attendance', 'Classes', 'Personal training', 'Workouts & diet', 'Plans & coupons', 'Equipment', 'My account'],
};

for (const [role, allowed] of Object.entries(ROLE_MENU)) {
  test(`${role}: menu shows exactly the allowed screens and each one opens cleanly`, async ({ page }) => {
    test.setTimeout(180_000); // up to 19 screens, each with a screenshot
    const watch = watchErrors(page);
    await loginStaff(page, role);
    const nav = page.locator('aside nav').first();
    for (const s of SCREENS) {
      const link = nav.getByRole('link', { name: s.label, exact: true });
      if (!allowed.includes(s.label)) {
        await expect(link, `${role} must not see ${s.label}`).toHaveCount(0);
        continue;
      }
      await link.click();
      await expect(page.getByRole('heading', { level: 1, name: s.heading })).toBeVisible();
      await waitIdle(page);
      await expect(page.getByText('Something went wrong')).toHaveCount(0);
      await shot(page, `${role}-${s.label.replace(/\W+/g, '-').toLowerCase()}`);
    }
    watch.assertClean();
  });
}

test('direct URL to a forbidden screen does not leak data', async ({ page }) => {
  await loginStaff(page, 'trainer');
  const watch = watchErrors(page);
  await page.goto('/admin/payroll');
  await waitIdle(page);
  // Screen may render its shell, but the API must refuse (403) and no salaries appear.
  await expect(page.getByText('₹25,000')).toHaveCount(0);
  watch.assertClean();
});
