/**
 * Per-user pages, like suites that create a fresh user in every test.
 * Proofline should merge /users/asha_rao, /users/ben_okafor and /users/chen_li into
 * one view, /users/:param, and reuse that parameter on their notes and new-note pages.
 * The cuid note URL becomes /notes/:id (demo/expected.json "views").
 * No API calls here, so these tests never enter the fault check.
 * Nobody clicks "Back to shop": its destination (/) is opened by page.goto in shop.spec.ts,
 * so it is untested with "Destination visited by URL, link never clicked".
 */
import { test, expect } from 'proofline/playwright';

test('profile shows the username', async ({ page }) => {
  await page.goto('/users/asha_rao');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('asha_rao');
  await page.goto('/users/asha_rao/notes');
  await expect(page).toHaveTitle('User notes');
  await page.goto('/users/asha_rao/notes/new');
  await expect(page).toHaveTitle('New note');
});

test('follow button toggles', async ({ page }) => {
  await page.goto('/users/ben_okafor');
  const follow = page.getByRole('button', { name: 'Follow' });
  await follow.click();
  await expect(follow).toHaveAttribute('aria-pressed', 'true');
  await page.goto('/users/ben_okafor/notes');
  await expect(page).toHaveTitle('User notes');
});

test('profile and note open', async ({ page }) => {
  await page.goto('/users/chen_li');
  await expect(page).toHaveTitle('Profile');
  await page.goto('/users/chen_li/notes');
  await expect(page).toHaveTitle('User notes');
  await page.goto('/notes/cmusge6wr0004pndce18dw4iq');
  await expect(page).toHaveTitle('Note');
});
