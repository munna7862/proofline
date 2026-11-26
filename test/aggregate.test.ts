import { test } from 'node:test';
import assert from 'node:assert/strict';
import { aggregateCoverage, groupListItems, learnViewParams } from '../src/coverage/aggregate.ts';
import type { ElementInfo, TestCoverageRecord } from '../src/types.ts';
import { viewKey } from '../src/util/normalize.ts';

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

const visit = (testId: string, view: string, els: ElementInfo[] = [el('button', 'Follow')], clicked: string[] = []): TestCoverageRecord => ({
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

test('ordinary top-level pages keep their names even when each has a different visitor', () => {
  const records = [visit('a', '/community'), visit('b', '/help'), visit('c', '/tips')];
  assert.deepEqual(learnViewParams(records), new Map());
});

test('first-segment protection applies to URL-encoded pages and hash routes', () => {
  for (const paths of [
    ['/café', '/über', '/niño'],
    ['//about', '//help', '//tips'],
    ['/#/about', '/#/help', '/#/tips'],
    ['/app#/about', '/app#/help', '/app#/tips'],
  ]) {
    const records = paths.map((path, index) => visit(String(index), viewKey('https://example.test' + path)));
    assert.deepEqual(learnViewParams(records), new Map(), paths.join(', '));
  }
});

test('generated hash-route first segments can still propagate', () => {
  const records = [
    visit('a', '/app#/member1'),
    visit('b', '/app#/member2'),
    visit('c', '/app#/member3'),
    visit('a', '/app#/member1/settings'),
  ];
  assert.equal(learnViewParams(records).get('/app#/member1/settings'), '/app#/:param/settings');
});

test('a learned segment immediately before a hash route keeps its parameter', () => {
  const records = [
    visit('a', '/users/asha'),
    visit('b', '/users/ben'),
    visit('c', '/users/chen'),
    visit('a', '/users/asha#/notes'),
    visit('b', '/users/:id#/notes'),
  ];
  const learned = learnViewParams(records);
  assert.equal(learned.get('/users/asha#/notes'), '/users/:param#/notes');
  assert.equal(learned.has('/users/:id#/notes'), false);
});

test('generated-looking first segments learn and propagate while ordinary first segments stay literal', () => {
  const longName = 'abcdefghijklmnopqrst';
  const records = [
    visit('a', '/member1'),
    visit('b', '/member2'),
    visit('c', '/' + longName),
    visit('d', '/about'),
    visit('d', '/about/details'),
    visit('d', '/member3/details'),
  ];
  assert.deepEqual(learnViewParams(records), new Map([
    ['/' + longName, '/:param'],
    ['/member1', '/:param'],
    ['/member2', '/:param'],
    ['/member3/details', '/:param/details'],
  ]));
});

test('inline frame views keep their positions when the enclosing path learns a parameter', () => {
  const records = ['asha', 'ben', 'chen'].flatMap((user) => [
    visit(user, `/users/${user}#frame-1`),
    visit(user, `/users/${user}#frame-2`),
    visit(user, `/app#/users/${user}#frame-2.1`),
  ]);
  const summary = aggregateCoverage(records);
  assert.deepEqual(summary.views.map(({ view }) => view).sort(), [
    '/app#/users/:param#frame-2.1',
    '/users/:param#frame-1',
    '/users/:param#frame-2',
  ]);
  assert.equal(summary.total, 3);
});

test('learning from nested views reaches user home pages and descendants with sparse evidence', () => {
  const records = [
    visit('a', '/users/asha/notes/:id'),
    visit('b', '/users/ben/notes/:id'),
    visit('c', '/users/chen/notes/:id'),
    visit('a', '/users/asha/notes/new'),
    visit('b', '/users/ben/notes/new'),
    visit('d', '/users/dev'),
    visit('d', '/users/dev/settings'),
    visit('a', '/admin/asha/notes/new'),
    visit('a', '/users/:id/notes/new'),
  ];
  const expected = new Map([
    ['/users/asha/notes/:id', '/users/:param/notes/:id'],
    ['/users/asha/notes/new', '/users/:param/notes/new'],
    ['/users/ben/notes/:id', '/users/:param/notes/:id'],
    ['/users/ben/notes/new', '/users/:param/notes/new'],
    ['/users/chen/notes/:id', '/users/:param/notes/:id'],
    ['/users/dev', '/users/:param'],
    ['/users/dev/settings', '/users/:param/settings'],
  ]);
  assert.deepEqual(learnViewParams(records), expected);
  assert.deepEqual(learnViewParams([...records].reverse()), expected);
});

test('independently shared sibling branches remain literal under a learned parent', () => {
  const sharedNav = [el('link', 'Archive', '/users/archive')];
  const records = [
    visit('a', '/users/asha', sharedNav),
    visit('b', '/users/ben', sharedNav),
    visit('c', '/users/chen'),
    visit('a', '/users/links'),
    visit('b', '/users/links'),
    visit('c', '/users/links/settings'),
    visit('a', '/users/archive/settings'),
  ];
  assert.deepEqual(learnViewParams(records), new Map([
    ['/users/asha', '/users/:param'],
    ['/users/ben', '/users/:param'],
    ['/users/chen', '/users/:param'],
  ]));
});

test('a shared link to a fixed descendant keeps its own coverage row', () => {
  const settings = '/users/archive/settings';
  const sharedNav = [el('link', 'Archive settings', settings)];
  const save = el('button', 'Save');
  const records = [
    visit('a', '/users/asha', sharedNav),
    visit('b', '/users/ben', sharedNav),
    visit('c', '/users/chen', sharedNav),
    visit('a', '/users/asha/settings', [save], [save.key]),
    visit('d', settings, [save]),
  ];
  const summary = aggregateCoverage(records);
  const archive = summary.views.find((view) => view.view === settings);
  assert.deepEqual(archive?.elements.map((element) => [element.name, element.tested]), [['Save', false]]);
  assert.equal(summary.views.find((view) => view.view === '/users/:param/settings')?.tested, 1);
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

test('per-test names group in one view and keep a shared name at the same path', () => {
  const names = ['Asha', 'Ben', 'Chen'];
  const records = names.map((name, i) => visit(
    String(i), '/links', [el('link', name), el('link', 'Home')], i < 2 ? [`link|${name}|`] : [],
  ));
  const { elements } = aggregateCoverage(records).views[0]!;
  assert.deepEqual(elements.map((e) => e.key), ['link|Home|', 'link|per test|x']);
  assert.deepEqual(elements[1], {
    key: 'link|per test|x', name: 'per test (3 seen)', role: 'link', tag: 'x', path: 'x',
    seen: 3, tested: true, testedBy: ['0', '1'],
  });
  assert.deepEqual(aggregateCoverage([...records].reverse()).views[0]!.elements, elements);
});

test('per-test grouping requires three single-test names at the same path, tag and role', () => {
  const a = el('link', 'Asha');
  const b = el('link', 'Ben');
  const c = el('link', 'Chen');
  const two = [visit('a', '/', [a]), visit('b', '/', [b])];
  for (const records of [
    two,
    [...two, visit('c', '/', [{ ...c, path: 'other' }])],
    [...two, visit('c', '/', [{ ...c, tag: 'a' }])],
    [...two, visit('c', '/', [el('button', 'Chen')])],
    [...two, visit('c', '/', [c, a])],
    [visit('a', '/', [a]), visit('b', '/', [b]), visit('c', '/', [c, { ...a, key: 'link|Asha|other' }])],
  ]) {
    assert.ok(aggregateCoverage(records).views[0]!.elements.every((e) => e.seen === undefined));
  }
});

test('per-test grouping counts distinct names even if a test sees more than one', () => {
  const records = [
    visit('a', '/', [el('link', 'Asha'), el('link', 'Ben')]),
    visit('b', '/', [el('link', 'Chen')]),
  ];
  const { elements } = aggregateCoverage(records).views[0]!;
  assert.deepEqual(elements.map((e) => [e.key, e.seen]), [['link|per test|x', 3]]);
});

test('separate DOM positions remain separate when a test sees three siblings with one CSS path', () => {
  const records = [visit('a', '/', ['Catalog', 'Checkout', 'Cart'].map((name, index) => ({
    ...el('link', name), position: `0.1.${index}`,
  })))];
  const { elements } = aggregateCoverage(records).views[0]!;
  assert.deepEqual(elements.map((e) => e.name).sort(), ['Cart', 'Catalog', 'Checkout']);
});

test('different slots at the same reported path each get an independent per-test group', () => {
  const records = ['a', 'b', 'c'].map((testId) => visit(testId, '/', [
    { ...el('link', `Notes for ${testId}`), position: '0.1.0' },
    { ...el('link', `Profile for ${testId}`), position: '0.1.1' },
  ], [`link|Notes for ${testId}|`]));
  const { elements } = aggregateCoverage(records).views[0]!;
  assert.deepEqual(elements.map((el) => [el.key, el.seen, el.tested]), [
    ['link|per test|x|0.1.1', 3, false],
    ['link|per test|x|0.1.0', 3, true],
  ]);
});

test('moving controls stay separate from stable labels in a slot', () => {
  const moving = { ...el('link', 'Catalog'), position: null };
  const stable = ['Policy', 'Help'].map((name) => ({ ...el('link', name), position: 'a:0' }));
  const { elements } = aggregateCoverage([visit('a', '/', [moving, ...stable])]).views[0]!;
  assert.equal(elements.length, 3);
  assert.ok(elements.every((el) => !el.seen));
});

test('a mix of older and positioned observations does not guess old records\' DOM positions', () => {
  const records = [
    visit('a', '/', ['A', 'B', 'C'].map((name) => el('link', name))),
    visit('b', '/', [{ ...el('link', 'A'), position: 'a:0' }]),
  ];
  const { elements } = aggregateCoverage(records).views[0]!;
  assert.equal(elements.length, 3);
  assert.ok(elements.every((el) => !el.seen));
});

test('a label also seen on a disabled element stays separate', () => {
  const records = ['Asha', 'Ben', 'Chen'].map((name) => visit(name, '/', [el('link', name)]));
  records.push(visit('busy', '/', [{ ...off('link', 'Asha'), key: 'link|Asha|other' }]));
  const coverage = aggregateCoverage(records);
  assert.deepEqual(coverage.views[0]!.elements.map((e) => e.key), ['link|Asha|', 'link|Ben|', 'link|Chen|']);
  assert.equal(coverage.neverEnabled, 1);
});

test('per-test grouping leaves existing list groups in place', () => {
  const records = ['a', 'b', 'c'].map((testId) => visit(testId, '/', ['1', '2', '3'].map((n) =>
    item('link', testId + n, `ul.${testId} > li > a`),
  )));
  const { elements } = aggregateCoverage(records).views[0]!;
  assert.equal(elements.length, 3);
  assert.ok(elements.every((e) => e.name === 'in list (3 seen)'));
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
