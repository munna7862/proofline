/**
 * Busy states and file inputs must not create phantom elements.
 * While the upload runs, the button is disabled and reads "Processing...": Proofline lists it
 * as "Not applicable: never enabled", outside the score. The file input has no label, so it is
 * named by its name attribute ("avatar"), never by the picked file (C:\fakepath\avatar.png).
 * Both faults on POST /api/avatar are caught: the test asserts the saved message.
 */
import { test, expect } from 'proofline/playwright';

test('avatar upload saves', async ({ page }) => {
  await page.goto('/settings/avatar');
  await page.locator('input[type=file]').setInputFiles({ name: 'avatar.png', mimeType: 'image/png', buffer: Buffer.from('png') });
  await page.getByRole('button', { name: 'Upload' }).click();
  await expect(page.getByRole('status')).toHaveText('Avatar saved');
  await expect(page.getByRole('button', { name: 'Upload' })).toBeEnabled();
});
