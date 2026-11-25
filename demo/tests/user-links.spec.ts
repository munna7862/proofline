import { test, expect } from 'proofline/playwright';

for (const user of ['asha_rao', 'ben_okafor', 'chen_li']) {
  test(`shows links for ${user}`, async ({ page }) => {
    await page.goto(`/users/links?user=${user}`);
    const notes = page.getByRole('link', { name: `${user}'s notes` });
    await expect(notes).toBeVisible();
    await expect(page.getByRole('link', { name: 'Back to shop' })).toBeVisible();
    if (user === 'asha_rao') {
      await expect(page.getByRole('link', { name: 'Cart help' })).toBeVisible();
      await notes.click();
    }
  });
}
