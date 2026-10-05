import { test } from 'node:test';
import assert from 'node:assert/strict';
import { aggregateCoverage } from '../src/coverage/aggregate.ts';
import { renderMarkdown } from '../src/report/markdown.ts';
import { renderReport } from '../src/report/html.ts';
import { upgradeCoverage } from '../src/report/write.ts';
import type { TestCoverageRecord } from '../src/types.ts';

const el = (role: string, name: string, href?: string) => ({ key: `${role}|${name}|`, tag: 'x', role, name, href, path: 'x' });
const recs: TestCoverageRecord[] = [
  { testId: 'a', title: 'A', file: 'f', line: 1, views: ['/'], inventory: { '/': [el('link', 'About', '/about'), el('button', 'Buy')] }, interactions: {} },
  { testId: 'b', title: 'B', file: 'f', line: 2, views: ['/about'], inventory: {}, interactions: {} },
];

test('reports say when a link was reached by URL but never clicked', () => {
  const c = aggregateCoverage(recs);
  const md = renderMarkdown(c);
  assert.match(md, /About †/);
  assert.match(md, /† Destination visited by URL, link never clicked\./);
  assert.doesNotMatch(md, /Buy †/);
  assert.match(renderReport({ project: 'p', coverage: c }), /Destination visited by URL, link never clicked/);
});

test('reports list never-enabled elements as not applicable, outside the score', () => {
  const c = aggregateCoverage([
    { testId: 'a', title: 'A', file: 'f', line: 1, views: ['/'], inventory: { '/': [el('button', 'Buy'), { ...el('button', 'Processing...'), disabled: true }] }, interactions: {} },
  ]);
  const html = renderReport({ project: 'p', coverage: c });
  assert.match(html, /Not applicable: never enabled/);
  assert.match(html, /0 of 1 interactive elements touched by 1 tests, 1 not applicable \(never enabled\)/);
  assert.match(renderMarkdown(c), /0 of 1 interactive elements touched by 1 tests, 1 not applicable \(never enabled\)/);
});

test('a coverage summary written before never-enabled existed still renders after an upgrade', () => {
  const c = aggregateCoverage(recs);
  const old = JSON.parse(JSON.stringify(c));
  delete old.neverEnabled;
  for (const v of old.views) delete v.neverEnabled;
  assert.throws(() => renderReport({ project: 'p', coverage: old }));
  const up = upgradeCoverage(old);
  assert.deepEqual(up, JSON.parse(JSON.stringify(c)));
  assert.match(renderReport({ project: 'p', coverage: up }), /About/);
  assert.doesNotThrow(() => renderMarkdown(up));
});

test('reports show repeated list items as one element with how many were seen', () => {
  const item = (name: string) => ({ ...el('link', name, '/post'), list: 'ul#posts > li > a' });
  const c = aggregateCoverage([
    { testId: 'a', title: 'A', file: 'f', line: 1, views: ['/'], inventory: { '/': [item('Jayde post'), item('Ola post'), item('Kim post'), el('button', 'Join')] }, interactions: { '/': ['button|Join|'] } },
  ]);
  assert.equal(c.total, 2);
  assert.match(renderMarkdown(c), /link in list \(3 seen\)/);
  assert.match(renderReport({ project: 'p', coverage: c }), /<span class="role">link<\/span> in list \(3 seen\)/);
});
