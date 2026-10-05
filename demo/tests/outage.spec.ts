/**
 * A test that fails after visiting a page no other test visits (Proofline's "only passing tests
 * count" rule). `test.fail()` keeps `npm run demo` green while Playwright still reports the test's
 * status as "failed" to Proofline. /outage and its Retry button must stay out of the coverage.
 * No API calls here, so this test never enters the fault check.
 */
import { test, expect } from 'proofline/playwright';

test('outage page shows recovery', async ({ page }) => {
  test.fail();
  await page.goto('/outage');
  await expect(page.getByRole('heading', { name: 'Recovered' })).toBeVisible({ timeout: 500 });
});
