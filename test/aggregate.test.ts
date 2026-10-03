import { test } from 'node:test';
import assert from 'node:assert/strict';
import { aggregateCoverage } from '../src/coverage/aggregate.ts';
import type { TestCoverageRecord } from '../src/types.ts';

const el = (role: string, name: string, href?: string) => ({ key: `${role}|${name}|`, tag: 'x', role, name, href, path: 'x' });

test('links count as tested when their destination is visited', () => {
  const recs: TestCoverageRecord[] = [
    { testId: 'a', title: 'A', file: 'f', line: 1, views: ['/'], inventory: { '/': [el('link', 'About', '/about'), el('button', 'Buy')] }, interactions: { '/': ['button|Buy|'] } },
    { testId: 'b', title: 'B', file: 'f', line: 2, views: ['/about'], inventory: {}, interactions: {} },
  ];
  const s = aggregateCoverage(recs);
  assert.equal(s.tested, 2);
  assert.equal(s.total, 2);
  assert.equal(s.untestedLinks.length, 0);
});

test('ignoreElements removes noise from the denominator', () => {
  const recs: TestCoverageRecord[] = [
    { testId: 'a', title: 'A', file: 'f', line: 1, views: ['/'], inventory: { '/': [el('link', 'Privacy'), el('button', 'Buy')] }, interactions: {} },
  ];
  assert.equal(aggregateCoverage(recs, { ignoreElements: ['Privacy'] }).total, 1);
});
