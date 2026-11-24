import assert from 'node:assert/strict';
import test from 'node:test';
import { compareWithGroundTruth, type GroundTruth } from '../scripts/ground-truth.ts';
import { aggregateCoverage } from '../src/coverage/aggregate.ts';
import { summarizeProof } from '../src/proof/plan.ts';
import type { MutantResult, TestRef } from '../src/types.ts';

const ref: TestRef = { testId: 'demo', title: 'checks cart', file: 'cart.spec.ts', line: 1 };
const button = { key: 'button|Add|', tag: 'button', role: 'button', name: 'Add', path: 'button' };
const expected: GroundTruth = {
  coverage: { counts: { tests: 1, tested: 1, total: 1, neverEnabled: 0, score: 100 }, untested: [], tested: [button.key] },
  testsExcluded: 0,
  views: ['/'],
  elements: { '/': [button.key] },
  testedIn: { '/': [button.key] },
  proof: { 'GET /api/cart': { 'http-500': 'killed', 'blank-strings': 'survived' } },
  weakestTest: ref.title,
};
const coverage = aggregateCoverage([{
  ...ref, status: 'passed', views: ['/'], inventory: { '/': [button] }, interactions: { '/': [button.key] },
}]);

const caught: MutantResult = {
  mutant: { id: 'cart-500', method: 'GET', pattern: 'http://localhost:4173/api/cart', operator: 'http-500', tests: [ref] },
  outcome: 'killed', killers: [ref], survivors: [], durationMs: 1,
};
const slipped: MutantResult = {
  mutant: { ...caught.mutant, id: 'cart-text', operator: 'blank-strings' },
  outcome: 'survived', killers: [], survivors: [ref], durationMs: 1,
};

test('ground truth accepts exact demo results in any fault order', () => {
  assert.deepEqual(compareWithGroundTruth(expected, coverage, summarizeProof([slipped, caught])), []);
});

test('ground truth rejects extra and duplicate scored controls despite clean summary counts', () => {
  const [view] = coverage.views;
  assert.ok(view);
  const [element] = view.elements;
  assert.ok(element);
  for (const extra of [element, { ...element, key: 'button|Extra|', name: 'Extra', tested: false }]) {
    const changed = { ...coverage, views: [{ ...view, elements: [...view.elements, extra] }] };
    assert.ok(compareWithGroundTruth(expected, changed, undefined).some((message) =>
      message.startsWith('coverage: / elements expected'),
    ));
  }
});

test('ground truth requires exact control expectations for every view', () => {
  const incomplete = { ...expected, elements: {}, testedIn: {} };
  assert.deepEqual(compareWithGroundTruth(incomplete, coverage, undefined), [
    'coverage: no expected inventory for /',
    'coverage: no expected tested controls for /',
  ]);
});

test('ground truth rejects unexpected and duplicate faults even when the counts match', () => {
  const unknown = { ...slipped, mutant: { ...slipped.mutant, pattern: 'http://localhost:4173/api/other' } };
  const proof = summarizeProof([caught, slipped]);
  const unexpected = compareWithGroundTruth(expected, undefined, { ...proof, results: [caught, unknown] });
  assert.ok(unexpected.includes('proof: unexpected mutant for GET /api/other blank-strings'));
  assert.ok(unexpected.includes('proof: no mutant for GET /api/cart blank-strings'));

  const duplicate = compareWithGroundTruth(expected, undefined, { ...proof, results: [caught, slipped, caught] });
  assert.deepEqual(duplicate, ['proof: duplicate mutant for GET /api/cart http-500']);
});

test('ground truth checks reported coverage totals and fault scores', () => {
  const changedCoverage = { ...coverage, total: 2, views: coverage.views.map((view) => ({ ...view, tested: 0 })) };
  const proof = { ...summarizeProof([caught, slipped]), killed: 2, score: 100 };

  assert.deepEqual(compareWithGroundTruth(expected, changedCoverage, proof), [
    'coverage: total expected 1, got 2',
    'coverage /: tested expected 1, got 0',
    'proof: killed expected 1, got 2',
    'proof: score expected 50, got 100',
  ]);
});
