import { test, expect } from 'proofline/playwright';

test('opens the user menu on pointerdown and selects an item', async ({ page }) => {
  await page.goto('/settings/menu');
  const trigger = page.getByRole('button', { name: 'User menu' });
  await trigger.locator('span').click();
  const item = page.getByRole('menuitem', { name: 'Settings' });
  await expect(item).toBeVisible();
  await expect(trigger).not.toHaveAttribute('data-clicked', 'true');
  await item.click();
  await expect(page.locator('#selection')).toHaveText('Settings selected');

  // Release outside each button so the only interaction on it is pointerdown.
  for (const name of ['Show details', 'Ordinary button', 'Disabled menu']) {
    await page.getByText(name, { exact: true }).hover();
    await page.mouse.down();
    await page.mouse.move(0, 0);
    await page.mouse.up();
  }
  await expect(page.locator('#details')).toBeVisible();
  await page.getByRole('button', { name: 'Synthetic trigger' }).dispatchEvent('pointerdown');
});
