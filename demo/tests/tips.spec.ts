/**
 * A flaky catch. This test only checks that the tip loaded, so "Missing text" on GET /api/tips
 * would slip through. But it is flaky on purpose, deterministically: it fails on its second
 * invocation of a scan, which is the first fault run on /api/tips ("Missing text" sorts first).
 * Proofline re-runs a test that was the only one to catch a fault; here it passes on the re-run,
 * so the fault is "unstable: flaky test", outside the score, not "caught".
 * The invocation counter lives in demo/.proofline (test-results is cleared on every run). Any
 * run that is not a fault run (coverage, scan baseline) starts it again at 1.
 */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { test, expect } from 'proofline/playwright';

const counter = fileURLToPath(new URL('../.proofline/flaky-tips.count', import.meta.url));

function invocation(): number {
  mkdirSync(fileURLToPath(new URL('../.proofline/', import.meta.url)), { recursive: true });
  let n = 1;
  if (process.env.PROOFLINE_MODE === 'mutant') {
    try {
      n = Number(readFileSync(counter, 'utf8')) + 1;
    } catch {
      n = 1;
    }
  }
  writeFileSync(counter, String(n));
  return n;
}

test('tip of the day loads', async ({ page }) => {
  const n = invocation();
  await page.goto('/help/tips');
  await expect(page.locator('#tip')).toHaveAttribute('data-state', 'ok');
  if (n === 2) throw new Error('flaky: fails on its second invocation only (demo)');
});
