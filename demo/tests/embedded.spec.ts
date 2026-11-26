import { test, expect } from 'proofline/playwright';

test('uses same-origin embedded controls', async ({ page }) => {
  await page.goto('/embedded');
  const saved = page.frameLocator('[title="Saved panel"]');
  await saved.getByRole('button', { name: 'Save panel' }).click();
  await expect(saved.getByText('Saved', { exact: true })).toBeVisible();
  const note = page.frameLocator('[title="Note panel"]').getByRole('textbox', { name: 'Panel note' });
  await note.fill('ProoflineFrameInputMarker');
  await expect(note).toHaveValue('ProoflineFrameInputMarker');
  const backup = page.frameLocator('[title="Backup panel"]');
  await expect(backup.getByRole('textbox', { name: 'Panel note' })).toBeVisible();
  await expect(backup.frameLocator('[title="Review panel"]').getByRole('button', { name: 'Review note' })).toBeVisible();
  const written = page.frameLocator('[title="Written panel"]');
  const confirm = written.getByRole('button', { name: 'Confirm note' });
  await confirm.click();
  await expect(confirm).toBeDisabled();
  await expect(written.frameLocator('[title="Written options"]').getByRole('button')).toBeVisible();
  await expect(page.frameLocator('[title="Blob panel"]').getByRole('button')).toBeVisible();
  await expect(page.frameLocator('[title="Other origin"]').getByRole('button')).toBeVisible();
  await page.getByRole('button', { name: 'Show status panel' }).click();
  const clearStatus = page.frameLocator('[title="Status panel"]').getByRole('button', { name: 'Clear status' });
  await expect(clearStatus).toBeVisible();
  await expect(page.locator('#status')).toHaveJSProperty('open', false);
});
