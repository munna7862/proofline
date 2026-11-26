import { test, expect } from 'proofline/playwright';

test('uses preferences inside open shadow roots', async ({ page }) => {
  await page.goto('/components');
  const panel = page.locator('#preferences');
  const preference = panel.getByRole('textbox', { name: 'Preference name' });
  await preference.fill('ProoflineShadowInputMarker');
  await expect(preference).toHaveValue('ProoflineShadowInputMarker');
  await panel.getByRole('button', { name: 'Apply', exact: true }).click();
  await expect(panel.getByText('Preferences applied')).toBeVisible();

  await page.getByRole('button', { name: 'Open security' }).click();
  const security = panel.locator('#security');
  await security.getByLabel('Proof document').setInputFiles({
    name: 'ProoflineShadowFilenameMarker.txt',
    mimeType: 'text/plain',
    buffer: Buffer.from('synthetic proof'),
  });
  await expect(security.getByRole('button', { name: 'Apply' })).toBeVisible();

  const backup = page.locator('#backup');
  await backup.getByRole('textbox', { name: 'Backup note' }).fill('ProoflineShadowDraftMarker');
  await page.getByRole('button', { name: 'Preview backup' }).click();
  await expect(page.locator('#backup-preview #draft')).toHaveText('ProoflineShadowDraftMarker');
  await page.getByRole('button', { name: 'Lock backup' }).click();
  await expect(backup.locator('#draft')).toHaveAttribute('contenteditable', 'false');
  await expect(backup.getByRole('button', { name: 'Apply', exact: true })).toBeVisible();

  await page.getByRole('button', { name: 'Import component' }).click();
  const imported = page.getByRole('button', { name: 'Use imported component' });
  await imported.click();
  await expect(imported).toBeDisabled();

  const secondBoard = page.locator('[data-board="second"]');
  await secondBoard.getByRole('button', { name: 'Apply' }).click();
  await expect(secondBoard).toHaveClass('active');
  await page.getByRole('button', { name: 'Prepend board' }).click();
  await expect(page.getByRole('button', { name: 'Refresh', exact: true })).toBeVisible();
});

test('saves the idle board', async ({ page }) => {
  await page.goto('/components/styles');
  const save = page.getByRole('button', { name: 'Save board' });
  await save.click();
  await expect(save).toBeDisabled();
});

test('sees the same board with its active style', async ({ page }) => {
  await page.goto('/components/styles?active');
  await expect(page.locator('x-board')).toHaveClass('active');
  await expect(page.getByRole('button', { name: 'Save board' })).toBeVisible();
});
