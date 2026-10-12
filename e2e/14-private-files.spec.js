import { test, expect } from '@playwright/test';
import { loginStaff, watchErrors, expectNoHorizontalScroll } from './helpers.js';

// Member documents (ID proofs) and profile photos are private files: no public link, opened with the login token.
// Uses the seeded member Pia Private (private photo with a thumbnail).

const esc = (t) => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const toast = (page, text) => expect(page.locator('[data-sonner-toast]').getByText(new RegExp(`^${esc(text)}`)).first()).toBeVisible();
const PDF = Buffer.from('%PDF-1.4\n1 0 obj << /Type /Catalog /Pages 2 0 R >> endobj\n2 0 obj << /Type /Pages /Kids [] /Count 0 >> endobj\ntrailer << /Root 1 0 R >>\n%%EOF\n');
const isThumb = (r) => /\/api\/v1\/uploads\/private\/[0-9a-f]{24}\?thumb=1$/.test(r.url()) && r.request().method() === 'GET';

test.describe.configure({ mode: 'serial' });

let thumbUrl;
let docUrl;

test('the members list shows the private thumbnail, not a public link', async ({ page }) => {
  const watch = watchErrors(page);
  await loginStaff(page, 'receptionist');
  await page.goto('/admin/members');
  const thumb = page.waitForResponse((r) => isThumb(r) && r.status() === 200);
  await page.getByPlaceholder(/Search name/).fill('Pia Private');
  await page.getByPlaceholder(/Search name/).press('Enter');
  const res = await thumb;
  thumbUrl = res.url();
  expect(res.headers()['content-type']).toBe('image/png');
  expect(res.headers()['cache-control']).toContain('no-store');
  expect((await res.body()).length).toBeLessThan(80 * 1024); // the small version, not the full photo

  const img = page.locator('main tbody tr', { hasText: 'Pia Private' }).getByRole('img', { name: 'Pia Private', exact: true });
  await expect(img).toBeVisible();
  await expect(img).toHaveAttribute('src', /^blob:/);
  expect(await img.evaluate((el) => el.naturalWidth)).toBe(128);
  watch.assertClean();
});

test('reception uploads an ID proof on the member page and opens it', async ({ page }) => {
  const watch = watchErrors(page);
  page.on('dialog', (d) => d.accept());
  await loginStaff(page, 'receptionist');
  await page.goto('/admin/members');
  await page.getByPlaceholder(/Search name/).fill('Pia Private');
  await page.getByPlaceholder(/Search name/).press('Enter');
  await page.locator('main tbody tr', { hasText: 'Pia Private' }).click();
  await expect(page.getByRole('heading', { name: /Pia Private/ })).toBeVisible();
  const main = page.locator('main');
  // The member page avatar is the private photo too.
  await expect(main.getByRole('img', { name: 'Pia Private', exact: true }).first()).toHaveAttribute('src', /^blob:/);

  await expect(main.getByText('No documents uploaded.')).toBeVisible();
  await main.getByLabel('Document type').selectOption('id-proof');
  const upload = page.waitForResponse((r) => /\/members\/[0-9a-f]{24}\/documents\?/.test(r.url()) && r.request().method() === 'POST');
  await main.getByLabel('Upload document').setInputFiles({ name: 'pia-aadhaar.pdf', mimeType: 'application/pdf', buffer: PDF });
  expect((await upload).status()).toBe(201);
  await toast(page, 'Document uploaded');
  const open = main.getByRole('button', { name: 'pia-aadhaar.pdf' });
  await expect(open).toBeVisible();
  // No public link anywhere for it.
  await expect(main.getByRole('link', { name: 'pia-aadhaar.pdf' })).toHaveCount(0);

  const file = page.waitForResponse((r) => /\/api\/v1\/uploads\/private\/[0-9a-f]{24}$/.test(r.url()) && r.request().method() === 'GET');
  const popup = page.waitForEvent('popup');
  await open.click();
  const res = await file;
  docUrl = res.url();
  expect(res.status()).toBe(200);
  expect(res.headers()['content-type']).toBe('application/pdf');
  expect(res.headers()['cache-control']).toContain('no-store');
  const tab = await popup;
  await expect.poll(() => tab.url()).toMatch(/^blob:/);
  // The new tab shows the uploaded PDF (read it back from the tab's in-memory link).
  const head = await page.evaluate(async (u) => {
    const r = await fetch(u);
    return { type: r.headers.get('content-type'), start: new TextDecoder().decode((await r.arrayBuffer()).slice(0, 8)) };
  }, tab.url());
  expect(head.type).toBe('application/pdf');
  expect(head.start).toBe('%PDF-1.4');
  await tab.close();

  // Fits a phone screen.
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(open).toBeVisible();
  await expectNoHorizontalScroll(page);
  watch.assertClean();
});

test('without a login the file links return 401', async ({ request }) => {
  expect(thumbUrl).toBeTruthy();
  expect(docUrl).toBeTruthy();
  expect((await request.get(thumbUrl)).status()).toBe(401);
  expect((await request.get(docUrl)).status()).toBe(401);
});

test('a new profile photo is uploaded privately with a thumbnail', async ({ page }) => {
  const watch = watchErrors(page);
  await loginStaff(page, 'receptionist');
  await page.goto('/admin/members');
  await page.getByPlaceholder(/Search name/).fill('Pia Private');
  await page.getByPlaceholder(/Search name/).press('Enter');
  await page.locator('main tbody tr', { hasText: 'Pia Private' }).click();
  await page.locator('main').getByRole('button', { name: 'Edit', exact: true }).click();
  const dlg = page.getByRole('dialog');
  // A 300x200 PNG made in the page (the browser crops and shrinks it before sending).
  const png = await page.evaluate(async () => {
    const c = document.createElement('canvas');
    c.width = 300;
    c.height = 200;
    const g = c.getContext('2d');
    g.fillStyle = '#0a7';
    g.fillRect(0, 0, 300, 200);
    const b = await new Promise((r) => c.toBlob(r, 'image/png'));
    return [...new Uint8Array(await b.arrayBuffer())];
  });
  await dlg.getByLabel('Member photo').setInputFiles({ name: 'face.png', mimeType: 'image/png', buffer: Buffer.from(png) });
  await expect(dlg.getByAltText('New photo')).toBeVisible();
  const photo = page.waitForResponse((r) => /\/members\/[0-9a-f]{24}\/photo$/.test(r.url()) && r.request().method() === 'POST');
  const thumb = page.waitForResponse((r) => /\/members\/[0-9a-f]{24}\/photo\/thumb$/.test(r.url()) && r.request().method() === 'PUT');
  await dlg.getByRole('button', { name: 'Save changes' }).click();
  expect((await photo).status()).toBe(201);
  expect((await thumb).status()).toBe(200);
  await toast(page, 'Member updated');
  const img = page.locator('main').getByRole('img', { name: 'Pia Private', exact: true }).first();
  await expect(img).toHaveAttribute('src', /^blob:/);
  await expect.poll(() => img.evaluate((el) => el.naturalWidth)).toBe(128);
  watch.assertClean();
});

test('trainers do not see member documents', async ({ page }) => {
  const watch = watchErrors(page);
  await loginStaff(page, 'trainer');
  await page.goto('/admin/members');
  await page.locator('main tbody tr', { hasText: 'Rahul' }).first().click();
  await expect(page.getByRole('heading', { name: /Rahul/ })).toBeVisible();
  await expect(page.locator('main').getByRole('heading', { name: 'Details', exact: true })).toBeVisible();
  await expect(page.locator('main').getByRole('heading', { name: 'Documents', exact: true })).toHaveCount(0);
  watch.assertClean();
});
