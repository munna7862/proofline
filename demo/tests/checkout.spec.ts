import { test, expect } from 'proofline/playwright';

test('uses nested checkout controls and the renamed password field', async ({ page }) => {
  await page.goto('/checkout/form');
  await page.getByRole('button', { name: 'Proceed to checkout' }).click();
  await expect(page.locator('#selection')).toHaveText('Checkout selected');
  await page.getByRole('button', { name: 'Edit', exact: true }).click();
  await expect(page.locator('#selection')).toHaveText('Editing options');
  await page.getByLabel('Password').fill('ProoflineCheckoutValueMarker');
});
