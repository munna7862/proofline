import { test, expect } from 'proofline/playwright';

test('uses same-origin embedded controls', async ({ page }) => {
  await page.goto('/embedded');
  const saved = page.frameLocator('[title="Saved panel"]');
  await saved.getByRole('button', { name: 'Save panel' }).click();
  await expect(saved.getByText('Saved', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Update saved panel' }).click();
  const close = saved.getByRole('button', { name: 'Close panels' });
  await close.click();
  await expect(close).toBeDisabled();
  await expect(saved.frameLocator('[title="Saved options"]').getByRole('button')).toBeVisible();
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
  const compact = page.getByRole('checkbox', { name: 'Compact mode' });
  await compact.check();
  await expect(page.locator('#compact-panel')).toBeVisible();
  await expect(page.frameLocator('#compact-panel').getByRole('button')).toBeVisible();
  await expect(compact).not.toBeChecked();
});

test('saves settings inside an inline frame', async ({ page }) => {
  await page.goto('/embedded/settings');
  const save = page.frameLocator('[title="Frame settings"]').getByRole('button', { name: 'Save settings' });
  await save.click();
  await expect(save).toBeDisabled();
});

test('opens frame settings after visiting a preview', async ({ page }) => {
  await page.goto('/embedded/preview');
  await expect(page.frameLocator('[title="Preview"]').getByRole('button', { name: 'Close preview' })).toBeVisible();
  await page.getByRole('button', { name: 'Open settings' }).click();
  await expect(page).toHaveURL(/\/embedded\/settings$/);
  const save = page.frameLocator('[title="Frame settings"]').getByRole('button', { name: 'Save settings' });
  await expect(save).toBeVisible();
  await page.goBack();
  await page.getByRole('button', { name: 'Open settings' }).click();
  await expect(save).toBeVisible();
});
