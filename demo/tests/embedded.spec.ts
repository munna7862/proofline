import { test, expect } from 'proofline/playwright';

test('uses same-origin embedded controls', async ({ page }) => {
  await page.goto('/embedded');
  const saved = page.frameLocator('[title="Saved panel"]');
  await saved.getByRole('button', { name: 'Save panel' }).click();
  await expect(saved.getByText('Saved', { exact: true })).toBeVisible();
  const note = page.frameLocator('[title="Note panel"]').getByRole('textbox', { name: 'Panel note' });
  await note.fill('ProoflineFrameInputMarker');
  await expect(note).toHaveValue('ProoflineFrameInputMarker');
  await expect(page.frameLocator('[title="Backup panel"]').getByRole('textbox', { name: 'Panel note' })).toBeVisible();
  await expect(page.frameLocator('[title="Other origin"]').getByRole('button')).toBeVisible();
});
