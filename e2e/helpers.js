import { expect } from '@playwright/test';
import fs from 'node:fs';

export const USERS = {
  owner: { login: 'owner@gym.local', password: 'Owner@12345' },
  manager: { login: 'manager@gym.local', password: 'Staff@12345' },
  receptionist: { login: 'reception@gym.local', password: 'Staff@12345' },
  trainer: { login: 'trainer@gym.local', password: 'Staff@12345' },
};

/**
 * Records browser console errors and failed API calls so every test can assert the screen is healthy.
 * 401 on refresh/first load is the normal token refresh, and 4xx we trigger on purpose can be allowed per test.
 */
export function watchErrors(page) {
  const errors = [];
  page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
  page.on('console', (m) => {
    if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) errors.push(`console: ${m.text()}`);
  });
  page.on('response', (r) => {
    const url = r.url();
    if (!url.includes('/api/')) return;
    if (r.status() === 401) return; // token refresh cycle
    if (r.status() >= 500) errors.push(`HTTP ${r.status()} ${r.request().method()} ${url}`);
  });
  return {
    errors,
    assertClean: () => expect(errors, errors.join('\n')).toEqual([]),
  };
}

export async function loginStaff(page, role) {
  const u = USERS[role];
  await page.goto('/login');
  await page.getByLabel('Email or phone').fill(u.login);
  await page.getByLabel('Password').fill(u.password);
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect(page).toHaveURL(/\/admin/, { timeout: 20_000 });
}

export async function loginMember(page, phone = '9876500001', password = 'Member@123') {
  await page.goto('/portal/login');
  await page.getByRole('button', { name: 'Password' }).click();
  await page.getByLabel('Phone').fill(phone);
  await page.getByLabel('Password').fill(password);
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect(page).toHaveURL(/\/portal$/, { timeout: 20_000 });
}

/** Saves a screenshot for the UX review. */
export async function shot(page, name) {
  fs.mkdirSync('e2e-screens', { recursive: true });
  await page.screenshot({ path: `e2e-screens/${name}.png`, fullPage: true });
}

/** Fails if the page is wider than the viewport (horizontal scrolling on phones). */
export async function expectNoHorizontalScroll(page) {
  const { scroll, width } = await page.evaluate(() => ({ scroll: document.documentElement.scrollWidth, width: window.innerWidth }));
  expect(scroll, `page is ${scroll}px wide on a ${width}px screen`).toBeLessThanOrEqual(width + 1);
}

export async function waitIdle(page) {
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(300);
}

/** Text box whose label starts with `name` (labels may end with ' *' for required fields). */
export function field(scope, name) {
  // Field renders <label><span>Name *</span><input/></label>: match the label whose first text starts with `name`.
  const startsWith = new RegExp(`^${name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`);
  const root = typeof scope.page === 'function' ? scope.page() : scope; // `has` must be a page-level locator
  return scope
    .locator('label')
    .filter({ has: root.locator('span', { hasText: startsWith }) })
    .locator('input, textarea')
    .first();
}

/** <select> whose label starts with `name`. */
export function selectField(scope, name) {
  const startsWith = new RegExp(`^${name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`);
  const root = typeof scope.page === 'function' ? scope.page() : scope;
  return scope.locator('label').filter({ has: root.locator('span', { hasText: startsWith }) }).locator('select').first();
}
