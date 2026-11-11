import assert from 'node:assert/strict';
import { chromium } from '@playwright/test';
import { mkdir } from 'node:fs/promises';

const base = 'https://misa-staging.gramsmorocco.workers.dev';
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
const errors = [];
page.on('pageerror', error => errors.push(error.message));
try {
  for (const route of ['/', '/gifts', '/cheese-charcuterie', '/events', '/contact?type=event']) {
    assert.equal((await page.goto(base + route)).status(), 200);
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
  }
  await page.goto(base + '/');
  const panels = page.locator('.panel');
  await panels.nth(0).hover();
  await page.waitForTimeout(650);
  const widths = await panels.evaluateAll(nodes => nodes.map(node => node.getBoundingClientRect().width));
  assert.ok(Math.abs(widths[0] / 1440 - .48) < .015);
  await panels.nth(1).focus();
  await page.waitForTimeout(650);
  await page.keyboard.press('Enter');
  await page.waitForURL('**/cheese-charcuterie');
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto(base + '/');
  assert.equal(await panels.nth(0).evaluate(node => getComputedStyle(node).transitionDuration), '0s');
  await mkdir('artifacts', { recursive: true });
  await page.screenshot({ path: 'artifacts/remote-staging-desktop.png', fullPage: true });
  await page.setViewportSize({ width: 390, height: 900 });
  await page.goto(base + '/');
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
  await page.screenshot({ path: 'artifacts/remote-staging-mobile.png', fullPage: true });
  await page.goto(base + '/contact?type=event');
  assert.ok(await page.getByRole('button', { name: 'Send inquiry' }).isDisabled());
  for (const route of ['/admin/inquiries', '/admin/assets', '/api/admin/inquiries', '/api/admin/assets', '/api/admin/attachments/test']) {
    assert.equal((await page.request.get(base + route)).status(), 503);
  }
  const result = await page.request.post(base + '/api/inquiries', {
    headers: { Origin: base, 'Idempotency-Key': crypto.randomUUID() },
    data: { type: 'general', name: 'Isolated smoke test', email: 'smoke@example.com', consent: true },
  });
  assert.equal(result.status(), 503);
  assert.equal((await result.json()).error, 'Inquiries are not enabled. No request was saved.');
  assert.deepEqual(errors, []);
  console.log('Remote staging passed: public routes, desktop hero, keyboard navigation, reduced motion, mobile layout, disabled collection and denied staff/private access. No browser errors.');
} finally {
  await browser.close();
}
