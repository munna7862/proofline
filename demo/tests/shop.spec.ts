/**
 * Demo suite with KNOWN quality, used to calibrate Proofline.
 *  - "shows products with prices"  strong: asserts the data the API returns
 *  - "adds a product to the cart"  strong: asserts count and total after a server write
 *  - "search box accepts input"    hollow on purpose: does things, checks almost nothing
 * Expected results live in demo/expected.json. If Proofline's numbers drift, a rule broke.
 */
import { test, expect } from 'proofline/playwright';

test.beforeEach(async ({ request, page }) => {
  await request.post('/api/reset');
  await page.goto('/');
});

test('shows products with prices', async ({ page }) => {
  const products = page.getByRole('list', { name: 'Products' });
  await expect(products.getByRole('listitem')).toHaveCount(3);
  await expect(products).toContainText('Cotton kurta ₹899');
  await expect(products).toContainText('Steel tiffin box ₹499');
});

test('adds a product to the cart', async ({ page }) => {
  await page.getByRole('listitem').filter({ hasText: 'Steel tiffin box' }).getByRole('button', { name: 'Add to cart' }).click();
  await expect(page.getByTestId('cart-link')).toHaveText('Cart (1)');
  await expect(page.locator('#total')).toHaveText('₹499');
});

test('search box accepts input', async ({ page }) => {
  await expect(page).toHaveTitle('Demo Shop');
  await page.getByPlaceholder('Search products').fill('kurta');
});
