import { test } from 'node:test';
import assert from 'node:assert/strict';
import { aggregateCoverage } from '../src/coverage/aggregate.ts';
import { renderMarkdown } from '../src/report/markdown.ts';
import { renderReport } from '../src/report/html.ts';
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
