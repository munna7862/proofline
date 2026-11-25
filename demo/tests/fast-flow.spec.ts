import { test, expect } from 'proofline/playwright';

test('completes a fast intermediate view', async ({ page }) => {
  await page.goto('/flow/start');
  await page.getByRole('button', { name: 'Start flow' }).click();
  await page.getByRole('button', { name: 'Continue flow' }).click();
  await expect(page.getByText('Flow complete')).toBeVisible();
});
