/**
 * Route-transition bleed. "Open FAQ" changes the URL with pushState, but the old view
 * stays mounted for 400 ms (longer than the agent's scan debounce), like an exit animation.
 * Proofline must record "Open FAQ" under /help only, never under /help/faq.
 * "Help home" is a nav link on both views and belongs to both. The test clicks it on /help/faq
 * right after the route change, while the agent still holds it: the click must still count there.
 * No API calls here, so this test never enters the fault check.
 */
import { test, expect } from 'proofline/playwright';

test('faq feedback is thanked', async ({ page }) => {
  await page.goto('/help');
  await page.getByRole('button', { name: 'Open FAQ' }).click();
  await page.getByRole('button', { name: 'Was this helpful?' }).click();
  await expect(page.locator('#thanks')).toHaveText('Thanks');
  // Still inside the agent's 600 ms hold after the route change: the click counts on /help/faq.
  await page.getByRole('link', { name: 'Help home' }).click();
  await expect(page).toHaveURL(/\/help$/);
});
