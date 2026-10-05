import type { BrowserContext } from 'playwright-core';
import { DEVTOOLS_ROOTS, INTERACTIVE_SELECTOR, LIST_ITEMS, LIVE_REGIONS, proofAgent } from '../page/agent.ts';
import type { AgentMessage, ElementInfo, TestCoverageRecord } from '../types.ts';

export const BINDING_NAME = '__proofline_emit';

/**
 * Accumulates what one test saw and touched. Runner-agnostic: the Playwright
 * fixture, the calibration script, and future adapters (WebdriverIO via CDP)
 * all feed it the same AgentMessage stream.
 */
export class CoverageRecorder {
  private views = new Set<string>();
  private inventory = new Map<string, Map<string, ElementInfo>>();
  private interactions = new Map<string, Set<string>>();

  handle = (msg: AgentMessage): void => {
    if (!msg || typeof msg !== 'object') return;
    if (msg.type === 'view') {
      this.views.add(msg.view);
    } else if (msg.type === 'inventory') {
      const map = this.inventory.get(msg.view) ?? new Map<string, ElementInfo>();
      for (const el of msg.elements) {
        const prev = map.get(el.key);
        // An element seen enabled once is enabled for this test.
        if (!prev || (prev.disabled && !el.disabled)) map.set(el.key, el);
      }
      this.inventory.set(msg.view, map);
    } else if (msg.type === 'interaction') {
      const set = this.interactions.get(msg.view) ?? new Set<string>();
      set.add(msg.key);
      this.interactions.set(msg.view, set);
    }
  };

  toRecord(test: { testId: string; title: string; file: string; line: number; status?: string }): TestCoverageRecord {
    const inventory: Record<string, ElementInfo[]> = {};
    for (const [view, map] of this.inventory) inventory[view] = [...map.values()];
    const interactions: Record<string, string[]> = {};
    for (const [view, set] of this.interactions) interactions[view] = [...set];
    return { ...test, views: [...this.views], inventory, interactions };
  }
}

/** Install the page agent on a context. Safe to call once per context. */
export async function attachCoverage(context: BrowserContext, recorder: CoverageRecorder): Promise<void> {
  await context.exposeBinding(BINDING_NAME, (_source, msg: AgentMessage) => recorder.handle(msg));
  await context.addInitScript(proofAgent, {
    bindingName: BINDING_NAME,
    interactiveSelector: INTERACTIVE_SELECTOR,
    ignoreSelector: [DEVTOOLS_ROOTS, LIVE_REGIONS].join(','),
    listItemSelector: LIST_ITEMS,
  });
}

/** The agent's route-change hold (600 ms) plus margin. */
const FLUSH_TIMEOUT_MS = 1000;

/**
 * Before the context closes: ask the agent for a final scan (elements it was still holding
 * after a route change count if they are on the page now), then give it a moment to deliver.
 */
export async function flushCoverage(context: BrowserContext): Promise<void> {
  await Promise.all(
    context.pages().map(async (p) => {
      // Bounded: a busy page or an open dialog must never turn a passing test into a teardown timeout.
      await Promise.all(
        p.frames().map((f) =>
          Promise.race([
            f.evaluate(() => (window as any).__prooflineFlush?.()).catch(() => {}),
            new Promise((r) => setTimeout(r, FLUSH_TIMEOUT_MS).unref()),
          ]),
        ),
      );
      await p.waitForTimeout(300).catch(() => {});
    }),
  );
}
