import type { BrowserContext } from 'playwright-core';
import { DEVTOOLS_ROOTS, EDITABLE_SELECTOR, INTERACTIVE_SELECTOR, LIST_ITEMS, LIVE_REGIONS, proofAgent } from '../page/agent.ts';
import type { AgentMessage, ElementInfo, TestCoverageRecord } from '../types.ts';

export const BINDING_NAME = '__proofline_emit';
const identity = (key: string, nodeId?: string) => nodeId === undefined ? `key:${key}` : `node:${nodeId}`;

interface Observation {
  element: ElementInfo;
  order: number;
}

/**
 * Accumulates what one test saw and touched. Runner-agnostic: the Playwright
 * fixture, the calibration script, and future adapters (WebdriverIO via CDP)
 * all feed it the same AgentMessage stream.
 */
export class CoverageRecorder {
  private views = new Set<string>();
  private inventory = new Map<string, Map<string, Observation>>();
  private interactions = new Map<string, Set<string>>();
  private nextObservation = 0;

  handle = (msg: AgentMessage): void => {
    if (!msg || typeof msg !== 'object') return;
    if (msg.type === 'view') {
      this.views.add(msg.view);
    } else if (msg.type === 'inventory') {
      const map = this.inventory.get(msg.view) ?? new Map<string, Observation>();
      for (const { nodeId, ...el } of msg.elements) {
        const id = identity(el.key, nodeId);
        const prev = map.get(id);
        // An element seen enabled once is enabled for this test.
        if (!prev || (prev.element.disabled && !el.disabled)) {
          map.set(id, { element: el, order: this.nextObservation++ });
        }
      }
      this.inventory.set(msg.view, map);
    } else if (msg.type === 'rename') {
      const map = this.inventory.get(msg.view) ?? new Map<string, Observation>();
      const element = { ...msg.element };
      const id = identity(element.key, msg.nodeId);
      const prev = map.get(id);
      if (prev && !prev.element.disabled) delete element.disabled;
      map.set(id, { element, order: this.nextObservation++ });
      this.inventory.set(msg.view, map);
    } else if (msg.type === 'interaction') {
      const set = this.interactions.get(msg.view) ?? new Set<string>();
      set.add(identity(msg.key, msg.nodeId));
      this.interactions.set(msg.view, set);
    }
  };

  toRecord(test: { testId: string; title: string; file: string; line: number; status?: string }): TestCoverageRecord {
    const inventory: Record<string, ElementInfo[]> = {};
    for (const [view, map] of this.inventory) {
      const byKey = new Map<string, Observation>();
      for (const observation of map.values()) {
        const { element, order } = observation;
        const prev = byKey.get(element.key);
        if (!prev || (prev.element.disabled && !element.disabled) ||
            (!!prev.element.disabled === !!element.disabled && order < prev.order)) {
          byKey.set(element.key, observation);
        }
      }
      inventory[view] = [...byKey.values()].map(({ element }) => element);
    }
    const interactions: Record<string, string[]> = {};
    for (const [view, set] of this.interactions) {
      const map = this.inventory.get(view);
      const keys = new Set<string>();
      for (const id of set) {
        if (id.startsWith('key:')) keys.add(id.slice(4));
        else {
          const observation = map?.get(id);
          if (observation) keys.add(observation.element.key);
        }
      }
      interactions[view] = [...keys];
    }
    return { ...test, views: [...this.views], inventory, interactions };
  }
}

/** Install the page agent on a context. Safe to call once per context. */
export async function attachCoverage(context: BrowserContext, recorder: CoverageRecorder): Promise<void> {
  await context.exposeBinding(BINDING_NAME, (_source, msg: AgentMessage) => recorder.handle(msg));
  await context.addInitScript(proofAgent, {
    bindingName: BINDING_NAME,
    interactiveSelector: INTERACTIVE_SELECTOR,
    editableSelector: EDITABLE_SELECTOR,
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
