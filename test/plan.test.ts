import { test } from 'node:test';
import assert from 'node:assert/strict';
import { judgeMutant, planMutants, summarizeProof } from '../src/proof/plan.ts';
import type { MutantHitRecord, TestNetworkRecord } from '../src/types.ts';

const ref = (id: string) => ({ testId: id, title: id, file: 'a.spec.ts', line: 1 });
const baseline: TestNetworkRecord[] = [
  { ...ref('t1'), status: 'passed', endpoints: [{ key: 'GET http://h/api/p', method: 'GET', pattern: 'http://h/api/p', json: true }] },
  { ...ref('t2'), status: 'failed', endpoints: [{ key: 'GET http://h/api/q', method: 'GET', pattern: 'http://h/api/q', json: true }] },
];

test('planMutants skips tests that failed the baseline', () => {
  const m = planMutants(baseline);
  assert.equal(m.length, 5);
  assert.ok(m.every((x) => x.pattern === 'http://h/api/p'));
});

test('planMutants skips body operators for non-JSON endpoints and respects the cap', () => {
  const m = planMutants([{ ...baseline[0], endpoints: [{ ...baseline[0].endpoints[0], json: false }] }], { maxMutants: 1 });
  assert.equal(m.length, 1);
  assert.ok(['http-500', 'network-fail'].includes(m[0].operator));
});

test('judgeMutant outcomes', () => {
  const m = planMutants(baseline)[0];
  const hit = (status: string, h = true, c = true): MutantHitRecord => ({ ...ref('t1'), mutantId: m.id, hit: h, changed: c, status });
  assert.equal(judgeMutant(m, [hit('failed')], 0).outcome, 'killed');
  assert.equal(judgeMutant(m, [hit('passed')], 0).outcome, 'survived');
  assert.equal(judgeMutant(m, [hit('passed', false)], 0).outcome, 'not-reached');
  assert.equal(judgeMutant(m, [hit('passed', true, false)], 0).outcome, 'not-applicable');
  assert.equal(judgeMutant(m, [], 0).outcome, 'error');
});

test('summarizeProof scores only killed and survived', () => {
  const m = planMutants(baseline)[0];
  const r1 = judgeMutant(m, [{ ...ref('t1'), mutantId: m.id, hit: true, changed: true, status: 'failed' }], 0);
  const r2 = judgeMutant(m, [{ ...ref('t1'), mutantId: m.id, hit: false, changed: false, status: 'passed' }], 0);
  const s = summarizeProof([r1, r2]);
  assert.equal(s.score, 100);
  assert.equal(s.notReached, 1);
});
