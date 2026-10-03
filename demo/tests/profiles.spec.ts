/**
 * Per-user pages, like suites that create a fresh user in every test.
 * Proofline should merge /users/asha_rao, /users/ben_okafor and /users/chen_li into
 * one view, /users/:param, and the cuid note URL into /notes/:id (demo/expected.json "views").
 * No API calls here, so these tests never enter the fault check.
 */
import { test, expect } from 'proofline/playwright';

test('profile shows the username', async ({ page }) => {
  await page.goto('/users/asha_rao');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('asha_rao');
});

test('follow button toggles', async ({ page }) => {
  await page.goto('/users/ben_okafor');
  const follow = page.getByRole('button', { name: 'Follow' });
  await follow.click();
  await expect(follow).toHaveAttribute('aria-pressed', 'true');
});

test('profile and note open', async ({ page }) => {
  await page.goto('/users/chen_li');
  await expect(page).toHaveTitle('Profile');
  await page.goto('/notes/cmusge6wr0004pndce18dw4iq');
  await expect(page).toHaveTitle('Note');
});
