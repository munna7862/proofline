import { test, expect } from 'proofline/playwright';

test('draft editor accepts text without using it as a control label', async ({ page }) => {
  await page.goto('/settings/drafts#/editor?draft=ProoflineRouteMarker');
  const editor = page.locator('#note');
  await editor.fill('ProoflineEditorMarker');
  await expect(editor).toHaveText('ProoflineEditorMarker');
  const plainEditor = page.locator('#plain-note');
  await plainEditor.fill('ProoflinePlainEditorMarker');
  await expect(plainEditor).toHaveText('ProoflinePlainEditorMarker');
});
