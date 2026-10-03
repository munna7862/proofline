import type { CoverageSummary, ElementCoverage, TestCoverageRecord, ViewCoverage } from '../types.ts';

export interface AggregateOptions {
  /** Views to drop entirely, e.g. ['/admin/debug'] */
  ignoreViews?: string[];
  /** Element keys (role|name|testid) or substrings to ignore, e.g. ['link|Privacy policy|'] */
  ignoreElements?: string[];
}

/**
 * Semantics (documented in docs/ARCHITECTURE.md, keep in sync):
 *  - An element is "tested" if any test interacted with it on that view.
 *  - A link is also "tested" if any test visited its destination view.
 *  - score = tested / total over all non-ignored elements in all visited views.
 */
export function aggregateCoverage(records: TestCoverageRecord[], opts: AggregateOptions = {}): CoverageSummary {
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

  // Links count as tested when their destination view was visited by any test.
  const untestedLinks = new Map<string, Set<string>>();
  for (const [view, map] of elements) {
    for (const el of map.values()) {
      if (el.role !== 'link' || !el.href) continue;
      const visitors = visitedViews.get(el.href);
      if (!el.tested && visitors && visitors.size > 0) {
        el.tested = true;
        el.testedBy.push(...visitors);
      }
      if (!el.tested) {
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
