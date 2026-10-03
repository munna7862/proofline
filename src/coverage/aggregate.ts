import type { CoverageSummary, ElementCoverage, TestCoverageRecord, ViewCoverage } from '../types.ts';

/** Minimum number of distinct per-test values before a path segment becomes :param. */
const LEARNED_PARAM_MIN_VALUES = 3;

/**
 * Learns per-test path segments in view keys (faker usernames, slugs a test creates)
 * and maps each such view to one with the segment replaced by `:param`.
 *
 * A segment position collapses when, for the same surrounding path, at least 3 values
 * qualify, coming from at least 3 different tests. A value qualifies when:
 *  - exactly one test visited that view, and
 *  - it is not a fixed link: no link to that view appears in the inventory of 2+ tests
 *    (a nav menu listing /docs/intro, /docs/api, /docs/faq keeps those pages apart).
 * Values that do not qualify keep their own view. Already-normalized segments (:id,
 * :uuid, :hash) and the hash-router marker segment are never touched.
 * Pure and deterministic: the result depends only on the records, not their order.
 */
export function learnViewParams(records: TestCoverageRecord[]): Map<string, string> {
  const visitors = new Map<string, Set<string>>();
  const linkedBy = new Map<string, Set<string>>();
  for (const rec of records) {
    for (const view of [...rec.views, ...Object.keys(rec.inventory)]) {
      if (!visitors.has(view)) visitors.set(view, new Set());
    }
    for (const view of rec.views) visitors.get(view)!.add(rec.testId);
    for (const els of Object.values(rec.inventory)) {
      for (const el of els) {
        if (el.role !== 'link' || !el.href) continue;
        const by = linkedBy.get(el.href) ?? new Set<string>();
        by.add(rec.testId);
        linkedBy.set(el.href, by);
      }
    }
  }

  // pattern (segments with one position blanked) -> qualifying views at that position
  const groups = new Map<string, { index: number; views: string[] }>();
  for (const view of [...visitors.keys()].sort()) {
    const tests = visitors.get(view)!;
    if (tests.size !== 1 || (linkedBy.get(view)?.size ?? 0) >= 2) continue;
    const segs = view.split('/');
    segs.forEach((seg, i) => {
      if (seg === '' || seg.startsWith(':') || seg.includes('#')) return;
      const pattern = segs.map((s, j) => (j === i ? '\0' : s)).join('/');
      const g = groups.get(pattern) ?? { index: i, views: [] };
      g.views.push(view);
      groups.set(pattern, g);
    });
  }

  const collapse = new Map<string, Set<number>>();
  for (const g of groups.values()) {
    const tests = new Set(g.views.map((v) => [...visitors.get(v)!][0]));
    if (g.views.length < LEARNED_PARAM_MIN_VALUES || tests.size < LEARNED_PARAM_MIN_VALUES) continue;
    for (const v of g.views) {
      const at = collapse.get(v) ?? new Set<number>();
      at.add(g.index);
      collapse.set(v, at);
    }
  }

  const out = new Map<string, string>();
  for (const [view, at] of collapse) {
    out.set(view, view.split('/').map((s, i) => (at.has(i) ? ':param' : s)).join('/'));
  }
  return out;
}

/** Rewrites every view key (visited views, inventory, interactions, link hrefs) through the map. */
function remapViews(rec: TestCoverageRecord, map: Map<string, string>): TestCoverageRecord {
  if (map.size === 0) return rec;
  const to = (v: string) => map.get(v) ?? v;
  const inventory: TestCoverageRecord['inventory'] = {};
  for (const [view, els] of Object.entries(rec.inventory)) {
    const mapped = els.map((el) => (el.href && map.has(el.href) ? { ...el, href: to(el.href) } : el));
    inventory[to(view)] = [...(inventory[to(view)] ?? []), ...mapped];
  }
  const interactions: TestCoverageRecord['interactions'] = {};
  for (const [view, keys] of Object.entries(rec.interactions)) {
    interactions[to(view)] = [...new Set([...(interactions[to(view)] ?? []), ...keys])];
  }
  return { ...rec, views: [...new Set(rec.views.map(to))], inventory, interactions };
}

export interface AggregateOptions {
  /** Views to drop entirely, e.g. ['/admin/debug'] */
  ignoreViews?: string[];
  /** Element keys (role|name|testid) or substrings to ignore, e.g. ['link|Privacy policy|'] */
  ignoreElements?: string[];
}

/**
 * Semantics (documented in docs/ARCHITECTURE.md, keep in sync):
 *  - An element is "tested" if any test interacted with it on that view.
 *  - Links follow the same rule: only a click counts. A link whose destination view
 *    was visited some other way stays untested and carries reachedByUrl: true.
 *  - score = tested / total over all non-ignored elements in all visited views.
 *  - Per-test path segments are merged into one view first (see learnViewParams).
 */
export function aggregateCoverage(input: TestCoverageRecord[], opts: AggregateOptions = {}): CoverageSummary {
  const learned = learnViewParams(input);
  const records = input.map((rec) => remapViews(rec, learned));
  const ignoreViews = new Set(opts.ignoreViews ?? []);
  const ignored = (key: string) => (opts.ignoreElements ?? []).some((p) => key.includes(p));

  const visitedViews = new Map<string, Set<string>>();
  const elements = new Map<string, Map<string, ElementCoverage>>();

  for (const rec of records) {
    for (const view of rec.views) {
      if (ignoreViews.has(view)) continue;
      const by = visitedViews.get(view) ?? new Set<string>();
      by.add(rec.title);
      visitedViews.set(view, by);
    }
    for (const [view, els] of Object.entries(rec.inventory)) {
      if (ignoreViews.has(view)) continue;
      const map = elements.get(view) ?? new Map<string, ElementCoverage>();
      for (const el of els) {
        if (ignored(el.key)) continue;
        if (!map.has(el.key)) map.set(el.key, { ...el, tested: false, testedBy: [] });
      }
      elements.set(view, map);
    }
  }

  for (const rec of records) {
    for (const [view, keys] of Object.entries(rec.interactions)) {
      const map = elements.get(view);
      if (!map) continue;
      for (const key of keys) {
        const el = map.get(key);
        if (!el) continue;
        el.tested = true;
        if (!el.testedBy.includes(rec.title)) el.testedBy.push(rec.title);
      }
    }
  }

  // Untested links: note when the destination was reached by URL; otherwise list it as a page no test visits.
  const untestedLinks = new Map<string, Set<string>>();
  for (const [view, map] of elements) {
    for (const el of map.values()) {
      if (el.role !== 'link' || !el.href || el.tested) continue;
      if ((visitedViews.get(el.href)?.size ?? 0) > 0) {
        el.reachedByUrl = true;
      } else {
        const from = untestedLinks.get(el.href) ?? new Set<string>();
        from.add(view);
        untestedLinks.set(el.href, from);
      }
    }
  }

  const views: ViewCoverage[] = [...elements.entries()]
    .map(([view, map]) => {
      const els = [...map.values()].sort((a, b) => Number(a.tested) - Number(b.tested) || a.key.localeCompare(b.key));
      const tested = els.filter((e) => e.tested).length;
      return { view, visitedBy: [...(visitedViews.get(view) ?? [])], elements: els, tested, total: els.length };
    })
    .sort((a, b) => a.tested / Math.max(a.total, 1) - b.tested / Math.max(b.total, 1));

  const tested = views.reduce((n, v) => n + v.tested, 0);
  const total = views.reduce((n, v) => n + v.total, 0);

  return {
    generatedAt: new Date().toISOString(),
    tests: records.length,
    score: total ? Math.round((tested / total) * 1000) / 10 : 0,
    tested,
    total,
    views,
    untestedLinks: [...untestedLinks.entries()].map(([href, from]) => ({ href, from: [...from] })),
  };
}
