import { test, expect } from '@playwright/test';
import { loginStaff, watchErrors, shot, waitIdle } from './helpers.js';

// The ease-of-use helpers: dd/mm/yyyy dates, "next step" buttons on empty lists, the setup checklist.

test('dates are typed and shown as dd/mm/yyyy; an empty list offers the next step', async ({ page }) => {
  const watch = watchErrors(page);
  await loginStaff(page, 'owner');
  await page.goto('/admin/expenses');
  await waitIdle(page);
  const boxes = page.locator('main input[placeholder="dd/mm/yyyy"]');
  await expect(boxes.first()).toHaveValue(/^01\/\d{2}\/\d{4}$/); // month start, Indian order
  await boxes.first().fill('01/01/2020');
  await boxes.nth(1).fill('31/01/2020');
  await expect(page.locator('main input[type="date"]').first()).toHaveValue('2020-01-01');
  await expect(page.getByText('No expenses in this period')).toBeVisible();
  await shot(page, 'ease-empty-expenses');
  // The empty list's own button opens the form.
  await page.locator('main').getByRole('button', { name: 'Add expense' }).last().click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await page.keyboard.press('Escape');
  // An impossible date is flagged and not used.
  await boxes.nth(1).fill('31/02/2020');
  await boxes.nth(1).blur();
  await expect(boxes.nth(1)).toHaveAttribute('aria-invalid', 'true');
  await expect(page.locator('main input[type="date"]').nth(1)).toHaveValue('2020-01-31');
  watch.assertClean();
});

test('setup checklist guides a new owner and can be hidden', async ({ page }) => {
  const watch = watchErrors(page);
  await loginStaff(page, 'owner');
  const emails = async (on) => {
    await page.goto('/admin/settings');
    const sw = page.getByRole('switch', { name: /Send emails/ });
    if ((await sw.getAttribute('aria-checked')) !== String(on)) await sw.click();
    await page.getByRole('button', { name: 'Save settings' }).click();
    await expect(page.locator('[data-sonner-toast]').getByText(/^Settings saved/).first()).toBeVisible();
  };
  // The seeded gym is fully set up, so the checklist is hidden. Switch all messages off to leave one step open.
  await expect(page.getByRole('heading', { level: 1, name: 'Dashboard' })).toBeVisible();
  await waitIdle(page);
  await expect(page.getByText('Get your gym ready')).toHaveCount(0);
  await emails(false);
  await page.goto('/admin');
  const card = page.getByText('Get your gym ready');
  await expect(card).toBeVisible();
  await expect(page.getByText(/5 of 6 done/)).toBeVisible();
  await expect(page.getByRole('link', { name: /Switch on SMS, WhatsApp or email reminders/ })).toBeVisible();
  await shot(page, 'ease-setup-checklist');
  await page.getByRole('button', { name: 'Hide setup checklist' }).click();
  await expect(card).toHaveCount(0);
  await page.reload();
  await waitIdle(page);
  await expect(page.getByRole('heading', { level: 1, name: 'Dashboard' })).toBeVisible();
  await expect(card).toHaveCount(0);
  await emails(true); // leave the gym as other specs expect it
  watch.assertClean();
});

test('reception does not see the owner checklist', async ({ page }) => {
  await loginStaff(page, 'receptionist');
  await expect(page.getByRole('heading', { level: 1, name: 'Dashboard' })).toBeVisible();
  await waitIdle(page);
  await expect(page.getByText('Get your gym ready')).toHaveCount(0);
});
