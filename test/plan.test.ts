import { test } from 'node:test';
import assert from 'node:assert/strict';
import { alreadyFailing, judgeMutant, plannedResult, planMutants, proofHeadline, summarizeProof } from '../src/proof/plan.ts';
import { renderReport } from '../src/report/html.ts';
import { renderMarkdown } from '../src/report/markdown.ts';
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

const withStatuses = (id: string, statuses: number[] | undefined): TestNetworkRecord => ({
  ...ref(id),
  status: 'passed',
  endpoints: [{ key: 'POST http://h/api/refresh', method: 'POST', pattern: 'http://h/api/refresh', json: true, statuses }],
});

test('alreadyFailing: only when every baseline status is an error', () => {
  assert.equal(alreadyFailing([401]), 'already failing in baseline (401)');
  assert.equal(alreadyFailing([500, 401, 401]), 'already failing in baseline (401, 500)');
  assert.equal(alreadyFailing([200, 401]), undefined);
  assert.equal(alreadyFailing([304]), undefined);
  assert.equal(alreadyFailing([]), undefined);
});

test('planMutants marks 500 and network failure n/a on an endpoint that already fails, body faults still run', () => {
  const m = planMutants([withStatuses('t1', [401]), withStatuses('t2', [403])]);
  const na = m.filter((x) => x.notApplicable).map((x) => x.operator).sort();
  assert.deepEqual(na, ['http-500', 'network-fail']);
  assert.equal(m.find((x) => x.operator === 'http-500')!.notApplicable, 'already failing in baseline (401, 403)');
  assert.equal(m.length, 5);
});

test('planMutants still faults mixed or unknown endpoints', () => {
  assert.ok(planMutants([withStatuses('t1', [401]), withStatuses('t2', [200])]).every((x) => !x.notApplicable));
  assert.ok(planMutants([withStatuses('t1', [401]), withStatuses('t2', undefined)]).every((x) => !x.notApplicable));
  // A failing test's 200 does not count: only passing tests are used.
  const failedOk = { ...withStatuses('t2', [200]), status: 'failed' };
  assert.equal(planMutants([withStatuses('t1', [401]), failedOk]).filter((x) => x.notApplicable).length, 2);
});

test('plannedResult: ruled-out faults are n/a with a reason, out of the score and off the weakest-test list', () => {
  const [m] = planMutants([withStatuses('t1', [401])], { operators: ['http-500'] });
  const r = plannedResult(m)!;
  assert.equal(r.outcome, 'not-applicable');
  assert.equal(r.reason, 'already failing in baseline (401)');
  assert.equal(plannedResult(planMutants(baseline)[0]), undefined);
  const s = summarizeProof([r]);
  assert.equal(s.notApplicable, 1);
  assert.deepEqual(s.weakestTests, []);
  assert.equal(proofHeadline(s), 'Fault check n/a (0 judged), 1 not applicable.');
});

test('proofHeadline shows the score once something was judged', () => {
  const m = planMutants(baseline)[0];
  const killed = judgeMutant(m, [{ ...ref('t1'), mutantId: m.id, hit: true, changed: true, status: 'failed' }], 0);
  assert.equal(proofHeadline(summarizeProof([killed])), 'Fault check 100%: 1 caught, 0 slipped through.');
});

test('report and Markdown show the reason next to the n/a fault and n/a instead of 0%', () => {
  const [m] = planMutants([withStatuses('t1', [401])], { operators: ['network-fail'] });
  const proof = summarizeProof([plannedResult(m)!]);
  const html = renderReport({ project: 'x', proof });
  assert.match(html, /<code>POST \/api\/refresh<\/code> Network failure: <span class="muted">already failing in baseline \(401\)<\/span>/);
  assert.match(html, /<p class="score-value">n\/a<\/p>/);
  const md = renderMarkdown(undefined, proof);
  assert.match(md, /\*\*Fault check n\/a\*\* · 0 of 0 injected faults caught, 1 not applicable/);
  assert.match(md, /- `POST \/api\/refresh` Network failure: already failing in baseline \(401\)/);
});
