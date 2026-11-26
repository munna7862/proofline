import type { CoverageSummary, ElementCoverage, ElementInfo, TestCoverageRecord, ViewCoverage } from '../types.ts';

/** Minimum number of distinct per-test values before a path segment becomes :param. */
const LEARNED_PARAM_MIN_VALUES = 3;

function firstPathSegments(segments: string[]): Set<number> {
  const first = new Set([segments.findIndex(Boolean)]);
  const hash = segments.indexOf('#');
  if (hash !== -1) first.add(segments.findIndex((segment, index) => index > hash && !!segment));
  return first;
}

// Keep hash routes and inline frame suffixes separate from learnable path segments.
const splitViewPath = (view: string) => view.replace('#/', '/#/').replace(/(#frame-[\d.]+)$/, '/$1').split('/');
const restoreViewBoundaries = (path: string) => path.replace('/#/', '#/').replace(/\/(#frame-[\d.]+)$/, '$1');

function canLearnSegment(segment: string, first: boolean): boolean {
  if (!segment || segment.startsWith(':') || segment.includes('#')) return false;
  if (!first) return true;
  try {
    // URL.pathname encodes characters such as é as percent escapes that contain digits.
    const decoded = decodeURIComponent(segment);
    return /\d/.test(decoded) || Array.from(decoded).length >= 20;
  } catch {
    return false;
  }
}

/**
 * Learns per-test path segments from views with the same parent and suffix.
 *
 * Three distinct values from three single-test visits establish the position.
 * Shared links do not provide evidence. The learned position applies across suffixes,
 * including user home pages, while shared sibling branches with no qualifying
 * evidence keep their literal names.
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

  const paths = [...visitors.keys()].sort().map((view) => {
    const segments = splitViewPath(view);
    return { view, segments, first: firstPathSegments(segments) };
  });
  const groups = new Map<string, { parent: string; examples: Map<string, string> }>();
  const isSharedLink = (view: string) => (linkedBy.get(view)?.size ?? 0) >= 2;
  for (const { view, segments, first } of paths) {
    const tests = visitors.get(view)!;
    if (tests.size !== 1 || isSharedLink(view)) continue;
    segments.forEach((segment, index) => {
      if (!canLearnSegment(segment, first.has(index))) return;
      const parent = segments.slice(0, index).join('/');
      if (isSharedLink(restoreViewBoundaries(`${parent}/${segment}`))) return;
      const pattern = JSON.stringify([parent, segments.slice(index + 1)]);
      const group = groups.get(pattern) ?? { parent, examples: new Map<string, string>() };
      group.examples.set(segment, [...tests][0]!);
      groups.set(pattern, group);
    });
  }

  const learnedParents = new Map<string, Set<string>>();
  for (const { parent, examples } of groups.values()) {
    if (new Set(examples.values()).size < LEARNED_PARAM_MIN_VALUES) continue;
    const values = learnedParents.get(parent) ?? new Set<string>();
    for (const segment of examples.keys()) values.add(segment);
    learnedParents.set(parent, values);
  }

  const out = new Map<string, string>();
  for (const { view, segments, first } of paths) {
    if (isSharedLink(view)) continue;
    const mapped = segments.map((segment, index) => {
      if (!canLearnSegment(segment, first.has(index))) return segment;
      const parent = segments.slice(0, index).join('/');
      const learnedValues = learnedParents.get(parent);
      if (!learnedValues) return segment;
      const branch = restoreViewBoundaries(`${parent}/${segment}`);
      const sharedBranch = isSharedLink(branch) || (visitors.get(branch)?.size ?? 0) >= 2;
      return sharedBranch && !learnedValues.has(segment) ? segment : ':param';
    }).join('/');
    const mappedView = restoreViewBoundaries(mapped);
    if (mappedView !== view) out.set(view, mappedView);
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

/** Minimum number of distinct items before siblings in one list become one element. */
const LIST_MIN_ITEMS = 3;

/**
 * Collapses repeated list items in one view into one element (founder rule S3-T3).
 * Elements with the same `list` signature, tag and role whose keys differ (one per item:
 * a note title, a faker name) become `<role> in list (N seen)` when there are 3 or more.
 * It is tested when any item was, by the union of their tests. Fewer than 3 items, a
 * different role or tag, no `list`, or seen only while disabled: left as they are.
 * Pure and deterministic: sorted output, independent of input order.
 */
export function groupListItems(els: ElementCoverage[]): ElementCoverage[] {
  const groups = new Map<string, ElementCoverage[]>();
  const rest: ElementCoverage[] = [];
  for (const el of els) {
    if (!el.list || el.disabled) {
      rest.push(el);
      continue;
    }
    const sig = [el.role, el.tag, el.list].join('\0');
    groups.set(sig, [...(groups.get(sig) ?? []), el]);
  }
  for (const members of groups.values()) {
    const keys = new Set(members.map((m) => m.key));
    if (keys.size < LIST_MIN_ITEMS) {
      rest.push(...members);
      continue;
    }
    const sorted = [...members].sort((a, b) => a.key.localeCompare(b.key));
    const first = sorted[0]!;
    const testedBy = [...new Set(sorted.flatMap((m) => m.testedBy))].sort();
    rest.push({
      key: `${first.role}|in list|${first.list}`,
      tag: first.tag,
      role: first.role,
      name: `in list (${keys.size} seen)`,
      path: first.path,
      list: first.list,
      seen: keys.size,
      tested: sorted.some((m) => m.tested),
      testedBy,
    });
  }
  return rest.sort((a, b) => a.key.localeCompare(b.key));
}

const displayLocation = (el: ElementInfo) => [el.role, el.tag, el.path].join('\0');
const elementLocation = (el: ElementInfo) => `${displayLocation(el)}\0${el.position === null ? 'unknown' : el.position ?? ''}`;
const PER_TEST_MIN_NAMES = 3;

interface NameObservations {
  locationsByKey: Map<string, Set<string>>;
  testsByLocation: Map<string, Map<string, Set<string>>>;
  pathsWithPositions: Set<string>;
}

/** Collapse per-test names at the same location, preserving names shared by multiple tests. */
function groupPerTestNames(
  elements: ElementCoverage[],
  observed: NameObservations,
): ElementCoverage[] {
  const groups = new Map<string, ElementCoverage[]>();
  const rest: ElementCoverage[] = [];
  const grouped: ElementCoverage[] = [];
  const groupCounts = new Map<string, number>();
  for (const el of elements) {
    if (el.seen || !el.name || !el.path || el.position === null ||
        (el.position === undefined && observed.pathsWithPositions.has(displayLocation(el))) ||
        observed.locationsByKey.get(el.key)?.size !== 1) {
      rest.push(el);
      continue;
    }
    const location = elementLocation(el);
    const group = groups.get(location) ?? [];
    group.push(el);
    groups.set(location, group);
  }
  for (const [location, members] of groups) {
    const testsByName = observed.testsByLocation.get(location)!;
    const singleTest = (el: ElementCoverage) => testsByName.get(el.name)?.size === 1;
    const variants = members.filter(singleTest);
    const singleTestNames = new Set(variants.map((el) => el.name)).size;
    if (singleTestNames < PER_TEST_MIN_NAMES) {
      rest.push(...members);
      continue;
    }
    const { role, tag, path, position, href } = variants[0]!;
    const sharedHref = href && variants.every((el) => el.href === href);
    const key = `${role}|per test|${path}`;
    groupCounts.set(key, (groupCounts.get(key) ?? 0) + 1);
    rest.push(...members.filter((el) => !singleTest(el)));
    grouped.push({
      key,
      role,
      tag,
      path,
      ...(position ? { position } : {}),
      name: `per test (${singleTestNames} seen)`,
      seen: singleTestNames,
      ...(sharedHref ? { href } : {}),
      ...(sharedHref && variants.every((el) => el.reachedByUrl) ? { reachedByUrl: true } : {}),
      tested: variants.some((el) => el.tested),
      testedBy: [...new Set(variants.flatMap((el) => el.testedBy))].sort(),
    });
  }
  return [...rest, ...grouped.map((el) => (groupCounts.get(el.key) ?? 0) > 1 && el.position
    ? { ...el, key: `${el.key}|${el.position}` }
    : el)];
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
 *  - Visiting a link's destination alone leaves the link untested and sets reachedByUrl: true.
 *  - score = tested / total over all non-ignored elements in all visited views.
 *  - An element no test ever saw enabled (only `disabled` or inside `aria-busy="true"`,
 *    e.g. a "Processing..." label) is not applicable: listed in neverEnabled, outside the score.
 *    Seen enabled once, or interacted with, it is scored like any other element.
 *  - Per-test path segments are merged into one view first (see learnViewParams).
 *  - 3+ sibling items of one list count as one element, "N seen" (see groupListItems).
 *  - Names unique to individual tests can count as one element at a shared location.
 */
/** A record with no status (written by an older Proofline) still counts. */
export const countsTowardCoverage = (rec: TestCoverageRecord) => rec.status === undefined || rec.status === 'passed';

export function aggregateCoverage(all: TestCoverageRecord[], opts: AggregateOptions = {}): CoverageSummary {
  // Only passing tests count: a failed or timed-out test stops at a different step each run,
  // so its partial coverage is not a stable fact about the suite (same rule as the fault check).
  const input = all.filter(countsTowardCoverage);
  const learned = learnViewParams(input);
  const records = input.map((rec) => remapViews(rec, learned));
  const ignoreViews = new Set(opts.ignoreViews ?? []);
  const ignored = (key: string) => (opts.ignoreElements ?? []).some((p) => key.includes(p));

  const visitedViews = new Map<string, Set<string>>();
  const elements = new Map<string, Map<string, ElementCoverage>>();
  const observedByView = new Map<string, NameObservations>();

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
      const observed = observedByView.get(view) ?? {
        locationsByKey: new Map(), testsByLocation: new Map(), pathsWithPositions: new Set<string>(),
      };
      for (const el of els) {
        if (ignored(el.key)) continue;
        if (el.position !== undefined) observed.pathsWithPositions.add(displayLocation(el));
        const location = elementLocation(el);
        const locations = observed.locationsByKey.get(el.key) ?? new Set<string>();
        locations.add(location);
        observed.locationsByKey.set(el.key, locations);
        const testsByName = observed.testsByLocation.get(location) ?? new Map<string, Set<string>>();
        const tests = testsByName.get(el.name) ?? new Set<string>();
        tests.add(rec.testId);
        testsByName.set(el.name, tests);
        observed.testsByLocation.set(location, testsByName);
        const prev = map.get(el.key);
        if (!prev || (prev.disabled && !el.disabled)) map.set(el.key, { ...el, tested: false, testedBy: [] });
      }
      elements.set(view, map);
      observedByView.set(view, observed);
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
        delete el.disabled; // a test interacted with it, so it was enabled
        if (!el.testedBy.includes(rec.title)) el.testedBy.push(rec.title);
      }
    }
  }

  // Untested links: note when the destination was reached by URL; otherwise list it as a page no test visits.
  const untestedLinks = new Map<string, Set<string>>();
  for (const [view, map] of elements) {
    for (const el of map.values()) {
      if (el.role !== 'link' || !el.href || el.tested || el.disabled) continue;
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
      const all = [...map.values()];
      const els = groupPerTestNames(groupListItems(all.filter((e) => !e.disabled)), observedByView.get(view)!)
        .sort((a, b) => Number(a.tested) - Number(b.tested) || a.key.localeCompare(b.key));
      const neverEnabled: ElementInfo[] = all
        .filter((e) => e.disabled)
        .map(({ tested: _t, testedBy: _b, reachedByUrl: _r, ...info }) => info)
        .sort((a, b) => a.key.localeCompare(b.key));
      const tested = els.filter((e) => e.tested).length;
      return { view, visitedBy: [...(visitedViews.get(view) ?? [])], elements: els, tested, total: els.length, neverEnabled };
    })
    .sort((a, b) => a.tested / Math.max(a.total, 1) - b.tested / Math.max(b.total, 1));

  const tested = views.reduce((n, v) => n + v.tested, 0);
  const total = views.reduce((n, v) => n + v.total, 0);

  return {
    generatedAt: new Date().toISOString(),
    tests: records.length,
    testsExcluded: all.length - input.length,
    score: total ? Math.round((tested / total) * 1000) / 10 : 0,
    tested,
    total,
    neverEnabled: views.reduce((n, v) => n + v.neverEnabled.length, 0),
    views,
    untestedLinks: [...untestedLinks.entries()].map(([href, from]) => ({ href, from: [...from] })),
  };
}
