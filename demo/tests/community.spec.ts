/**
 * Repeated list items and toasts. The 5 post titles are generated at server start, so their
 * names change every run, as in suites seeded with faker data. Proofline counts them as one
 * element, "in list (5 seen)", tested because the test opens one post.
 * Joining shows a toast (Sonner markup) with a Dismiss button: never an app element.
 * No API calls here, so this test never enters the fault check.
 */
import { test, expect } from 'proofline/playwright';

test('joining greets and a post opens', async ({ page }) => {
  await page.goto('/community');
  await page.getByRole('button', { name: 'Join community' }).click();
  await expect(page.locator('#toasts')).toContainText('Welcome');
  await page.locator('#posts a').nth(2).click();
  await expect(page.locator('#reading')).toContainText('Reading');
});
