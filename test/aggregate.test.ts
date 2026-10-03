import { test } from 'node:test';
import assert from 'node:assert/strict';
import { aggregateCoverage, learnViewParams } from '../src/coverage/aggregate.ts';
import type { TestCoverageRecord } from '../src/types.ts';

const el = (role: string, name: string, href?: string) => ({ key: `${role}|${name}|`, tag: 'x', role, name, href, path: 'x' });

test('a link whose destination was visited but never clicked is untested, reached by URL', () => {
  const recs: TestCoverageRecord[] = [
    { testId: 'a', title: 'A', file: 'f', line: 1, views: ['/'], inventory: { '/': [el('link', 'About', '/about'), el('button', 'Buy')] }, interactions: { '/': ['button|Buy|'] } },
    { testId: 'b', title: 'B', file: 'f', line: 2, views: ['/about'], inventory: {}, interactions: {} },
  ];
  const s = aggregateCoverage(recs);
  assert.equal(s.tested, 1);
  assert.equal(s.total, 2, 'denominator unchanged');
  const about = s.views[0]!.elements.find((e) => e.key === 'link|About|')!;
  assert.equal(about.tested, false);
  assert.equal(about.reachedByUrl, true);
  assert.equal(s.untestedLinks.length, 0, 'the page was visited, so it is not a page no test visits');
});

test('a clicked link is tested and not marked reached by URL', () => {
  const recs: TestCoverageRecord[] = [
    { testId: 'a', title: 'A', file: 'f', line: 1, views: ['/', '/about'], inventory: { '/': [el('link', 'About', '/about'), el('link', 'Help', '/help')] }, interactions: { '/': ['link|About|'] } },
  ];
  const s = aggregateCoverage(recs);
  const els = s.views[0]!.elements;
  assert.equal(els.find((e) => e.key === 'link|About|')!.tested, true);
  assert.equal(els.find((e) => e.key === 'link|About|')!.reachedByUrl, undefined);
  assert.equal(els.find((e) => e.key === 'link|Help|')!.reachedByUrl, undefined);
  assert.deepEqual(s.untestedLinks, [{ href: '/help', from: ['/'] }]);
});

test('ignoreElements removes noise from the denominator', () => {
  const recs: TestCoverageRecord[] = [
    { testId: 'a', title: 'A', file: 'f', line: 1, views: ['/'], inventory: { '/': [el('link', 'Privacy'), el('button', 'Buy')] }, interactions: {} },
  ];
  assert.equal(aggregateCoverage(recs, { ignoreElements: ['Privacy'] }).total, 1);
});

const visit = (testId: string, view: string, els = [el('button', 'Follow')], clicked: string[] = []): TestCoverageRecord => ({
  testId, title: testId.toUpperCase(), file: 'f', line: 1, views: [view], inventory: { [view]: els }, interactions: clicked.length ? { [view]: clicked } : {},
});

test('per-test segments seen in 3+ tests collapse into one :param view', () => {
  const recs = [visit('a', '/users/asha_rao'), visit('b', '/users/ben_okafor', undefined, ['button|Follow|']), visit('c', '/users/chen_li')];
  const s = aggregateCoverage(recs);
  assert.deepEqual(s.views.map((v) => v.view), ['/users/:param']);
  assert.equal(s.total, 1);
  assert.equal(s.tested, 1);
  assert.deepEqual(s.views[0]!.visitedBy.sort(), ['A', 'B', 'C']);
});

test('two values are not enough to learn a :param', () => {
  const s = aggregateCoverage([visit('a', '/users/asha_rao'), visit('b', '/users/ben_okafor')]);
  assert.deepEqual(s.views.map((v) => v.view).sort(), ['/users/asha_rao', '/users/ben_okafor']);
});

test('pages linked from a shared menu keep their own views', () => {
  const nav = [el('link', 'Intro', '/docs/intro'), el('link', 'API', '/docs/api'), el('link', 'FAQ', '/docs/faq')];
  const s = aggregateCoverage([visit('a', '/docs/intro', nav), visit('b', '/docs/api', nav), visit('c', '/docs/faq', nav)]);
  assert.deepEqual(s.views.map((v) => v.view).sort(), ['/docs/api', '/docs/faq', '/docs/intro']);
});

test('values from one test, or visited by several tests, do not collapse', () => {
  const one = { ...visit('a', '/p/x'), views: ['/p/x', '/p/y', '/p/z'] };
  assert.equal(learnViewParams([one]).size, 0);
  const shared = [visit('a', '/p/x'), visit('b', '/p/y'), visit('c', '/p/z'), visit('d', '/p/x')];
  const map = learnViewParams(shared);
  assert.equal(map.has('/p/x'), false);
  assert.equal(map.size, 0, 'only 2 qualifying values remain');
});

test('learnViewParams ignores record order', () => {
  const recs = [visit('a', '/u/aa'), visit('b', '/u/bb'), visit('c', '/u/cc')];
  assert.deepEqual([...learnViewParams(recs)].sort(), [...learnViewParams([...recs].reverse())].sort());
});
