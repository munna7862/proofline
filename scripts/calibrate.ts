/**
 * Engine calibration: runs the whole Proofline engine against the demo shop
 * WITHOUT the Playwright test runner, then checks the numbers against demo/expected.json.
 *
 *   node scripts/calibrate.ts            (exit 0 = engine agrees with ground truth)
 *
 * Why this exists: the runner adapter is thin; the engine is where bugs hide.
 * This script is the engine's own test. It runs in CI on every commit.
 * The "tests" below mirror demo/tests/shop.spec.ts and profiles.spec.ts step for step.
 */
import { chromium, type BrowserContext, type Page } from 'playwright-core';
import { attachCoverage, CoverageRecorder, flushCoverage } from '../src/coverage/collector.ts';
import { aggregateCoverage } from '../src/coverage/aggregate.ts';
import { injectMutant, NetworkRecorder } from '../src/proof/inject.ts';
import { judgeMutant, planMutants, summarizeProof } from '../src/proof/plan.ts';
import { renderReport } from '../src/report/html.ts';
import { renderMarkdown } from '../src/report/markdown.ts';
import { startShop } from '../demo/shop/server.ts';
import { ensureDir } from '../src/util/store.ts';
import { compareWithGroundTruth, loadGroundTruth } from './ground-truth.ts';
import { writeFileSync } from 'node:fs';
import type { MutantHitRecord, MutantResult, TestCoverageRecord, TestNetworkRecord, TestRef } from '../src/types.ts';

const BASE = 'http://localhost:4173';
const OUT = process.env.CALIBRATION_OUT ?? '.proofline-calibration';

// ---- tiny assertion helpers (the real suite uses Playwright's expect) ----
async function eventually(check: () => Promise<boolean>, what: string, timeout = 2000): Promise<void> {
  const end = Date.now() + timeout;
  while (Date.now() < end) {
    if (await check().catch(() => false)) return;
    await new Promise((r) => setTimeout(r, 50));
  }
  throw new Error(`Timed out waiting for: ${what}`);
}
const textOf = (page: Page, sel: string) => page.locator(sel).first().textContent({ timeout: 500 });

type DemoTest = TestRef & { start?: string; body: (page: Page) => Promise<void> };
const tests: DemoTest[] = [
  {
    testId: 't1', title: 'shows products with prices', file: 'demo/tests/shop.spec.ts', line: 15,
    body: async (page) => {
      await eventually(async () => (await page.locator('#products li').count()) === 3, '3 products');
      await eventually(async () => (await textOf(page, '#products'))!.includes('Cotton kurta ₹899'), 'kurta price');
      await eventually(async () => (await textOf(page, '#products'))!.includes('Steel tiffin box ₹499'), 'tiffin price');
    },
  },
  {
    testId: 't2', title: 'adds a product to the cart', file: 'demo/tests/shop.spec.ts', line: 22,
    body: async (page) => {
      await page.locator('#products li', { hasText: 'Steel tiffin box' }).getByRole('button', { name: 'Add to cart' }).click({ timeout: 2000 });
      await eventually(async () => (await textOf(page, '[data-testid=cart-link]')) === 'Cart (1)', 'cart count 1');
      await eventually(async () => (await textOf(page, '#total')) === '₹499', 'total 499');
    },
  },
  {
    testId: 't3', title: 'search box accepts input', file: 'demo/tests/shop.spec.ts', line: 28,
    body: async (page) => {
      if ((await page.title()) !== 'Demo Shop') throw new Error('title');
      await page.getByPlaceholder('Search products').fill('kurta', { timeout: 2000 });
    },
  },
  // demo/tests/profiles.spec.ts: per-user pages and a cuid URL (view normalization)
  {
    testId: 'p1', title: 'profile shows the username', file: 'demo/tests/profiles.spec.ts', line: 9, start: '/users/asha_rao',
    body: async (page) => {
      await eventually(async () => (await textOf(page, 'h1')) === 'asha_rao', 'username heading');
    },
  },
  {
    testId: 'p2', title: 'follow button toggles', file: 'demo/tests/profiles.spec.ts', line: 14, start: '/users/ben_okafor',
    body: async (page) => {
      await page.getByRole('button', { name: 'Follow' }).click({ timeout: 2000 });
      await eventually(async () => (await page.locator('#follow').getAttribute('aria-pressed')) === 'true', 'following');
    },
  },
  {
    testId: 'p3', title: 'profile and note open', file: 'demo/tests/profiles.spec.ts', line: 21, start: '/users/chen_li',
    body: async (page) => {
      if ((await page.title()) !== 'Profile') throw new Error('title');
      await page.goto(`${BASE}/notes/cmusge6wr0004pndce18dw4iq`);
      if ((await page.title()) !== 'Note') throw new Error('note title');
    },
  },
];

async function runTest(ctx: BrowserContext, t: DemoTest): Promise<string> {
  await fetch(`${BASE}/api/reset`, { method: 'POST' });
  const page = await ctx.newPage();
  try {
    await page.goto(BASE + (t.start ?? ''));
    await t.body(page);
    return 'passed';
  } catch {
    return 'failed';
  }
}

async function main() {
  const server = await startShop(4173);
  const browser = await chromium.launch();
  const failures: string[] = [];
  try {
    // ---- Phase A: normal run -> UI coverage + network baseline ----
    const coverageRecords: TestCoverageRecord[] = [];
    const baseline: TestNetworkRecord[] = [];
    for (const t of tests) {
      const ctx = await browser.newContext();
      const cov = new CoverageRecorder();
      const net = new NetworkRecorder();
      await attachCoverage(ctx, cov);
      net.attach(ctx);
      const status = await runTest(ctx, t);
      await flushCoverage(ctx);
      await ctx.close();
      const { body, ...ref } = t;
      coverageRecords.push(cov.toRecord({ ...ref, status }));
      baseline.push({ ...ref, status, endpoints: net.endpoints() });
      if (status !== 'passed') failures.push(`baseline: "${t.title}" should pass but ${status}`);
    }
    const coverage = aggregateCoverage(coverageRecords);

    // ---- Phase B: fault check ----
    const mutants = planMutants(baseline);
    const results: MutantResult[] = [];
    for (const m of mutants) {
      const started = Date.now();
      const hits: MutantHitRecord[] = [];
      for (const ref of m.tests) {
        const t = tests.find((x) => x.testId === ref.testId)!;
        const ctx = await browser.newContext();
        const state = await injectMutant(ctx, m);
        const status = await runTest(ctx, t);
        await ctx.close();
        hits.push({ ...ref, mutantId: m.id, hit: state.hit, changed: state.changed, status });
      }
      results.push(judgeMutant(m, hits, Date.now() - started));
    }
    const proof = summarizeProof(results);

    // ---- Write the report exactly as users will see it ----
    ensureDir(`${OUT}/report`);
    writeFileSync(`${OUT}/report/index.html`, renderReport({ project: 'demo-shop', coverage, proof }));
    writeFileSync(`${OUT}/report/summary.md`, renderMarkdown(coverage, proof));
    writeFileSync(`${OUT}/report/coverage-summary.json`, JSON.stringify(coverage, null, 2));
    writeFileSync(`${OUT}/report/proof-summary.json`, JSON.stringify(proof, null, 2));

    // ---- Compare with ground truth ----
    failures.push(...compareWithGroundTruth(loadGroundTruth(), coverage, proof));

    console.log(`UI coverage ${coverage.score}% (${coverage.tested}/${coverage.total}) | Fault check ${proof.score}% (${proof.killed} caught, ${proof.survived} slipped, ${proof.notApplicable} n/a)`);
    console.log(`Report: ${OUT}/report/index.html`);
  } finally {
    await browser.close();
    server.close();
  }

  if (failures.length) {
    console.error('\nCALIBRATION FAILED\n- ' + failures.join('\n- '));
    process.exit(1);
  }
  console.log('Calibration passed: engine matches demo/expected.json');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
