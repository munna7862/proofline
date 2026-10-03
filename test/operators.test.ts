import { test } from 'node:test';
import assert from 'node:assert/strict';
import { OPERATORS } from '../src/proof/operators.ts';

const body = { items: [{ id: 1, name: 'Kurta', price: 899 }], total: 899, ok: true };

test('empty-json empties arrays and reports change', () => {
  assert.deepEqual(OPERATORS['empty-json'].mutate!(body), { items: [], total: 899, ok: true });
  assert.equal(OPERATORS['empty-json'].mutate!({ ok: true }), undefined);
});

test('shift-numbers skips id-like keys', () => {
  assert.deepEqual(OPERATORS['shift-numbers'].mutate!(body), { items: [{ id: 1, name: 'Kurta', price: 900 }], total: 900, ok: true });
});

test('blank-strings blanks text but not ids', () => {
  const out = OPERATORS['blank-strings'].mutate!({ id: 'a1', name: 'x', nested: { slug: 's', label: 'y' } });
  assert.deepEqual(out, { id: 'a1', name: '', nested: { slug: 's', label: '' } });
});

test('body operators return undefined when nothing to change', () => {
  assert.equal(OPERATORS['shift-numbers'].mutate!({ a: 'x' }), undefined);
  assert.equal(OPERATORS['blank-strings'].mutate!({ a: 1 }), undefined);
});
