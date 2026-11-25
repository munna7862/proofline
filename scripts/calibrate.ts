/**
 * Engine calibration: runs the whole Proofline engine against the demo shop
 * WITHOUT the Playwright test runner, then checks the numbers against demo/expected.json.
 *
 *   node scripts/calibrate.ts            (exit 0 = engine agrees with ground truth)
 *
 * Why this exists: the runner adapter is thin; the engine is where bugs hide.
 * This script is the engine's own test. It runs in CI on every commit.
 * The "tests" below mirror the Playwright suite in demo/tests/.
 */
import { chromium, type BrowserContext, type Page } from 'playwright-core';
import { attachCoverage, CoverageRecorder, flushCoverage } from '../src/coverage/collector.ts';
import { aggregateCoverage } from '../src/coverage/aggregate.ts';
import { injectMutant, NetworkRecorder } from '../src/proof/inject.ts';
import { applyRecheck, judgeMutant, plannedResult, planMutants, recheckTargets, summarizeProof } from '../src/proof/plan.ts';
import { renderReport } from '../src/report/html.ts';
import { renderMarkdown } from '../src/report/markdown.ts';
import { startShop } from '../demo/shop/server.ts';
import { ensureDir } from '../src/util/store.ts';
import { checkArtifactPrivacy, compareWithGroundTruth, loadGroundTruth } from './ground-truth.ts';
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

type DemoTest = TestRef & { start?: string; expectFail?: boolean; body: (page: Page) => Promise<void> };
/** Invocations of the flaky tips test; reset before the normal run, like tips.spec.ts's counter file. */
let tipRuns = 0;
const tests: DemoTest[] = [
  {
    testId: 'd1', title: 'draft editor accepts text without using it as a control label',
    file: 'demo/tests/drafts.spec.ts', line: 3, start: '/settings/drafts#/editor?draft=ProoflineRouteMarker',
    body: async (page) => {
      await page.locator('#note').fill('ProoflineEditorMarker', { timeout: 2000 });
      await page.locator('#plain-note').fill('ProoflinePlainEditorMarker', { timeout: 2000 });
      await page.getByRole('button', { name: 'Reject' }).click({ timeout: 2000 });
      await page.getByRole('button', { name: 'Lock draft' }).click({ timeout: 2000 });
      if ((await page.locator('#note').getAttribute('contenteditable')) !== 'false') throw new Error('draft unlocked');
      await page.locator('#preview').click({ timeout: 2000 });
    },
  },
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
    testId: 'p1', title: 'profile shows the username', file: 'demo/tests/profiles.spec.ts', line: 12, start: '/users/asha_rao',
    body: async (page) => {
      await eventually(async () => (await textOf(page, 'h1')) === 'asha_rao', 'username heading');
      await page.goto(`${BASE}/users/asha_rao/notes`);
      if ((await page.title()) !== 'User notes') throw new Error('user notes title');
      await page.goto(`${BASE}/users/asha_rao/notes/new`);
      if ((await page.title()) !== 'New note') throw new Error('new note title');
    },
  },
  {
    testId: 'p2', title: 'follow button toggles', file: 'demo/tests/profiles.spec.ts', line: 21, start: '/users/ben_okafor',
    body: async (page) => {
      await page.getByRole('button', { name: 'Follow' }).click({ timeout: 2000 });
      await eventually(async () => (await page.locator('#follow').getAttribute('aria-pressed')) === 'true', 'following');
      await page.goto(`${BASE}/users/ben_okafor/notes`);
      if ((await page.title()) !== 'User notes') throw new Error('user notes title');
    },
  },
  {
    testId: 'p3', title: 'profile and note open', file: 'demo/tests/profiles.spec.ts', line: 30, start: '/users/chen_li',
    body: async (page) => {
      if ((await page.title()) !== 'Profile') throw new Error('title');
      await page.goto(`${BASE}/users/chen_li/notes`);
      if ((await page.title()) !== 'User notes') throw new Error('user notes title');
      await page.goto(`${BASE}/notes/cmusge6wr0004pndce18dw4iq`);
      if ((await page.title()) !== 'Note') throw new Error('note title');
    },
  },
  // demo/tests/user-links.spec.ts: three per-test labels and a shared label at the same path
  ...['asha_rao', 'ben_okafor', 'chen_li'].map((user): DemoTest => ({
    testId: `links-${user}`, title: `shows links for ${user}`, file: 'demo/tests/user-links.spec.ts', line: 4,
    start: `/users/links?user=${user}`,
    body: async (page) => {
      const notes = page.getByRole('link', { name: `${user}'s notes` });
      await notes.waitFor({ timeout: 2000 });
      await page.getByRole('link', { name: 'Back to shop' }).waitFor({ timeout: 2000 });
      if (user === 'asha_rao') {
        await page.getByRole('link', { name: 'Cart help' }).waitFor({ timeout: 2000 });
        await notes.click({ timeout: 2000 });
      }
    },
  })),
  // demo/tests/avatar.spec.ts: busy-state button and an unlabelled file input (no phantom elements)
  {
    testId: 'a1', title: 'avatar upload saves', file: 'demo/tests/avatar.spec.ts', line: 10, start: '/settings/avatar',
    body: async (page) => {
      await page.locator('input[type=file]').setInputFiles({ name: 'avatar.png', mimeType: 'image/png', buffer: Buffer.from('png') }, { timeout: 2000 });
      await page.getByRole('button', { name: 'Upload' }).click({ timeout: 2000 });
      await eventually(async () => (await textOf(page, '#status')) === 'Avatar saved', 'avatar saved');
      await eventually(async () => page.getByRole('button', { name: 'Upload' }).isEnabled(), 'upload enabled again');
    },
  },
  // demo/tests/help.spec.ts: the old view lingers after a client-side route change (no route bleed)
  {
    testId: 'h1', title: 'faq feedback is thanked', file: 'demo/tests/help.spec.ts', line: 11, start: '/help',
    body: async (page) => {
      await page.getByRole('button', { name: 'Open FAQ' }).click({ timeout: 2000 });
      await page.getByRole('button', { name: 'Was this helpful?' }).click({ timeout: 2000 });
      await eventually(async () => (await textOf(page, '#thanks')) === 'Thanks', 'thanks');
      // Still inside the agent's 600 ms hold: the click must count on /help/faq.
      await page.getByRole('link', { name: 'Help home' }).click({ timeout: 2000 });
      await eventually(async () => new URL(page.url()).pathname === '/help', 'back on help home');
    },
  },
  // demo/tests/checkout.spec.ts: nested controls and a field whose label arrives after load
  {
    testId: 'checkout', title: 'uses nested checkout controls and the renamed password field',
    file: 'demo/tests/checkout.spec.ts', line: 3, start: '/checkout/form',
    body: async (page) => {
      await page.getByRole('button', { name: 'Proceed to checkout' }).click({ timeout: 2000 });
      await eventually(async () => (await textOf(page, '#selection')) === 'Checkout selected', 'checkout selected');
      await page.getByRole('button', { name: 'Edit', exact: true }).click({ timeout: 2000 });
      await eventually(async () => (await textOf(page, '#selection')) === 'Editing options', 'editing options');
      await page.getByLabel('Password').fill('ProoflineCheckoutValueMarker', { timeout: 2000 });
      await page.locator('#checkout-password').evaluate(async (input: HTMLInputElement) => {
        input.type = 'submit';
        await new Promise((resolve) => setTimeout(resolve, 350));
        input.type = 'password';
      });
      await page.getByRole('textbox', { name: 'Draft note' }).fill('ProoflineCheckoutNoteMarker', { timeout: 2000 });
      await page.getByRole('textbox', { name: 'Order note' }).waitFor({ timeout: 2000 });
    },
  },
  // demo/tests/menu.spec.ts: modal menu and disclosure triggers receive pointerdown without a click
  {
    testId: 'm1', title: 'opens the user menu on pointerdown and selects an item',
    file: 'demo/tests/menu.spec.ts', line: 3, start: '/settings/menu',
    body: async (page) => {
      const trigger = page.getByRole('button', { name: 'User menu' });
      await trigger.locator('span').click({ timeout: 2000 });
      const item = page.getByRole('menuitem', { name: 'Settings' });
      await item.waitFor({ timeout: 2000 });
      if ((await trigger.getAttribute('data-clicked')) === 'true') throw new Error('menu trigger received click');
      await item.click({ timeout: 2000 });
      await eventually(async () => (await textOf(page, '#selection')) === 'Settings selected', 'settings selected');
      for (const name of ['Show details', 'Ordinary button', 'Disabled menu']) {
        await page.getByText(name, { exact: true }).hover({ timeout: 2000 });
        await page.mouse.down();
        await page.mouse.move(0, 0);
        await page.mouse.up();
      }
      await page.locator('#details').waitFor({ timeout: 2000 });
      await page.getByRole('button', { name: 'Synthetic trigger' }).dispatchEvent('pointerdown', {}, { timeout: 2000 });
    },
  },
  // demo/tests/community.spec.ts: generated list items count once; toasts are not elements
  {
    testId: 'c1', title: 'joining greets and a post opens', file: 'demo/tests/community.spec.ts', line: 11, start: '/community',
    body: async (page) => {
      await page.getByRole('button', { name: 'Join community' }).click({ timeout: 2000 });
      await eventually(async () => (await textOf(page, '#toasts'))!.startsWith('Welcome'), 'welcome toast');
      await page.locator('#posts a').nth(2).click({ timeout: 2000 });
      await eventually(async () => (await textOf(page, '#reading'))!.startsWith('Reading'), 'reading a post');
    },
  },
  // demo/tests/tips.spec.ts: fails on its second invocation only (the first fault run on /api/tips)
  {
    testId: 'f1', title: 'tip of the day loads', file: 'demo/tests/tips.spec.ts', line: 30, start: '/tips',
    body: async (page) => {
      const n = ++tipRuns;
      await eventually(async () => (await page.locator('#tip').getAttribute('data-state')) === 'ok', 'tip loaded');
      if (n === 2) throw new Error('flaky: fails on its second invocation only (demo)');
    },
  },
  // demo/tests/outage.spec.ts: fails after visiting a page nobody else visits (its coverage is not counted)
  {
    testId: 'o1', title: 'outage page shows recovery', file: 'demo/tests/outage.spec.ts', line: 10, start: '/outage', expectFail: true,
    body: async (page) => {
      await eventually(async () => (await textOf(page, 'h1')) === 'Recovered', 'recovery heading', 500);
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
    tipRuns = 0;
    for (const t of tests) {
      const ctx = await browser.newContext();
      const cov = new CoverageRecorder();
      const net = new NetworkRecorder();
      await attachCoverage(ctx, cov);
      net.attach(ctx);
      const status = await runTest(ctx, t);
      await flushCoverage(ctx);
      await ctx.close();
      const { testId, title, file, line } = t;
      const ref = { testId, title, file, line };
      coverageRecords.push(cov.toRecord({ ...ref, status }));
      baseline.push({ ...ref, status, endpoints: net.endpoints() });
      if (status !== 'passed' && !t.expectFail) failures.push(`baseline: "${t.title}" should pass but ${status}`);
    }
    const coverage = aggregateCoverage(coverageRecords);

    // ---- Phase B: fault check ----
    const mutants = planMutants(baseline);
    const results: MutantResult[] = [];
    for (const m of mutants) {
      const planned = plannedResult(m);
      if (planned) {
        results.push(planned);
        continue;
      }
      const started = Date.now();
      const runFault = async (refs: TestRef[]) => {
        const hits: MutantHitRecord[] = [];
        for (const ref of refs) {
          const t = tests.find((x) => x.testId === ref.testId)!;
          const ctx = await browser.newContext();
          const state = await injectMutant(ctx, m);
          const status = await runTest(ctx, t);
          await ctx.close();
          hits.push({ ...ref, mutantId: m.id, hit: state.hit, changed: state.changed, status });
        }
        return hits;
      };
      let result = judgeMutant(m, await runFault(m.tests), 0);
      const recheck = recheckTargets(result);
      if (recheck.length) result = applyRecheck(result, await runFault(recheck));
      results.push({ ...result, durationMs: Date.now() - started });
    }
    const proof = summarizeProof(results);

    // ---- Write the report exactly as users will see it ----
    ensureDir(`${OUT}/report`);
    const artifacts = {
      'index.html': renderReport({ project: 'demo-shop', coverage, proof }),
      'summary.md': renderMarkdown(coverage, proof),
      'coverage-summary.json': JSON.stringify(coverage, null, 2),
      'proof-summary.json': JSON.stringify(proof, null, 2),
    };
    for (const [name, content] of Object.entries(artifacts)) {
      writeFileSync(`${OUT}/report/${name}`, content);
    }

    // ---- Compare with ground truth ----
    const expected = loadGroundTruth();
    failures.push(...compareWithGroundTruth(expected, coverage, proof));
    failures.push(...checkArtifactPrivacy(expected, {
      ...artifacts,
      'raw coverage records': JSON.stringify(coverageRecords),
    }));

    console.log(`UI coverage ${coverage.score}% (${coverage.tested}/${coverage.total}) | Fault check ${proof.score}% (${proof.killed} caught, ${proof.survived} slipped, ${proof.unstable ? `${proof.unstable} unstable, ` : ''}${proof.notApplicable} n/a)`);
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
