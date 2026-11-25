import { test, expect } from 'proofline/playwright';

test('completes a fast intermediate view', async ({ page }) => {
  await page.goto('/flow/start');
  await page.getByRole('button', { name: 'Start flow' }).click();
  await page.getByRole('button', { name: 'Continue flow' }).click();
  await expect(page.getByText('Flow complete')).toBeVisible();
  await expect(page).toHaveURL(/\/flow\/end$/);
});

test('waits for the app to finish bootstrapping', async ({ page }) => {
  await page.goto('/bootstrap/start');
  await expect(page).toHaveURL(/\/bootstrap\/ready$/);
  await expect(page.getByRole('button', { name: 'Working' })).toBeVisible();
});

test('starts an automatic transition as the test ends', async ({ page }) => {
  await page.goto('/flow/auto');
  await page.getByRole('button', { name: 'Start quick flow' }).click();
});
