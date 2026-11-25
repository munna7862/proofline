import { test, expect } from 'proofline/playwright';

test('uses nested checkout controls and the renamed password field', async ({ page }) => {
  await page.goto('/checkout/form');
  await page.getByRole('button', { name: 'Proceed to checkout' }).click();
  await expect(page.locator('#selection')).toHaveText('Checkout selected');
  await page.getByRole('button', { name: 'Edit', exact: true }).click();
  await expect(page.locator('#selection')).toHaveText('Editing options');
  await page.getByLabel('Password').fill('ProoflineCheckoutValueMarker');
  const password = page.locator('#checkout-password');
  await password.evaluate(async (input: HTMLInputElement) => {
    input.type = 'submit';
    await new Promise((resolve) => setTimeout(resolve, 350));
    input.type = 'password';
  });
  await page.getByRole('textbox', { name: 'Draft note' }).fill('ProoflineCheckoutNoteMarker');
  await expect(page.getByRole('textbox', { name: 'Order note' })).toBeVisible();
});
