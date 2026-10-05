import { test } from 'node:test';
import assert from 'node:assert/strict';
import { aggregateCoverage, groupListItems, learnViewParams } from '../src/coverage/aggregate.ts';
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

const off = (role: string, name: string) => ({ ...el(role, name), disabled: true });

test('an element never seen enabled is not applicable and outside the score', () => {
  const recs: TestCoverageRecord[] = [
    { testId: 'a', title: 'A', file: 'f', line: 1, views: ['/'], inventory: { '/': [el('button', 'Upload'), off('button', 'Processing...')] }, interactions: { '/': ['button|Upload|'] } },
  ];
  const s = aggregateCoverage(recs);
  assert.equal(s.tested, 1);
  assert.equal(s.total, 1, 'the busy label is not in the denominator');
  assert.equal(s.neverEnabled, 1);
  assert.deepEqual(s.views[0]!.neverEnabled.map((e) => e.key), ['button|Processing...|']);
  assert.equal(s.views[0]!.elements.some((e) => e.key === 'button|Processing...|'), false);
});

test('an element seen enabled in any test, or interacted with, is scored', () => {
  const recs: TestCoverageRecord[] = [
    { testId: 'a', title: 'A', file: 'f', line: 1, views: ['/'], inventory: { '/': [off('button', 'Save'), off('button', 'Send')] }, interactions: { '/': ['button|Send|'] } },
    { testId: 'b', title: 'B', file: 'f', line: 2, views: ['/'], inventory: { '/': [el('button', 'Save')] }, interactions: {} },
  ];
  const s = aggregateCoverage(recs);
  assert.equal(s.total, 2);
  assert.equal(s.tested, 1);
  assert.equal(s.neverEnabled, 0);
  assert.equal(s.views[0]!.elements.some((e) => e.disabled), false);
});

const item = (role: string, name: string, list: string, tested = false, by: string[] = []) => ({
  key: `${role}|${name}|`, tag: role === 'link' ? 'a' : 'button', role, name, path: 'ul > li > a', list, tested, testedBy: by,
});

test('3+ siblings in one list become one element, tested when any item was', () => {
  const out = groupListItems([
    item('link', 'Note by Jayde', 'ul.notes > li > a', false),
    item('link', 'Note by Ola', 'ul.notes > li > a', true, ['T2']),
    item('link', 'Note by Kim', 'ul.notes > li > a', true, ['T1']),
    item('button', 'Buy', '', false),
  ]);
  assert.equal(out.length, 2);
  const list = out.find((e) => e.seen)!;
  assert.equal(list.key, 'link|in list|ul.notes > li > a');
  assert.equal(list.name, 'in list (3 seen)');
  assert.equal(list.tested, true);
  assert.deepEqual(list.testedBy, ['T1', 'T2']);
});

test('2 siblings stay separate; different roles or lists stay separate', () => {
  const two = groupListItems([item('link', 'A', 'ul > li > a'), item('link', 'B', 'ul > li > a')]);
  assert.equal(two.length, 2);
  assert.ok(two.every((e) => !e.seen));
  const mixed = groupListItems([
    item('link', 'A', 'ul > li > a'), item('link', 'B', 'ul > li > a'),
    item('button', 'C', 'ul > li > a'), item('link', 'D', 'ol > li > a'),
  ]);
  assert.equal(mixed.length, 4);
  assert.ok(mixed.every((e) => !e.seen));
});

test('list grouping is independent of input order and keeps the denominator stable', () => {
  const items = ['A', 'B', 'C', 'D'].map((n) => item('link', n, 'ul > li > a'));
  assert.deepEqual(groupListItems(items), groupListItems([...items].reverse()));
  // Different generated names in two runs give the same single element.
  const run2 = ['W', 'X', 'Y', 'Z', 'Q'].map((n) => item('link', n, 'ul > li > a'));
  assert.equal(groupListItems(run2)[0]!.key, groupListItems(items)[0]!.key);
});

test('only passing tests count; a record with no status still counts', () => {
  const rec = (testId: string, view: string, status?: string): TestCoverageRecord => ({
    testId, title: testId, file: 'f', line: 1, ...(status ? { status } : {}), views: [view],
    inventory: { [view]: [el('button', `Go ${view}`)] }, interactions: { [view]: [`button|Go ${view}|`] },
  });
  const s = aggregateCoverage([rec('a', '/a', 'passed'), rec('b', '/b', 'timedOut'), rec('c', '/c', 'failed'), rec('d', '/d')]);
  assert.deepEqual(s.views.map((v) => v.view).sort(), ['/a', '/d'], 'failed and timed-out views are absent');
  assert.equal(s.total, 2);
  assert.equal(s.tests, 2);
  assert.equal(s.testsExcluded, 2);
});
