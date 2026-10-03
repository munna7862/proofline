import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CoverageRecorder } from '../src/coverage/collector.ts';

const ref = { testId: 't', title: 'T', file: 'f', line: 1 };
const btn = (disabled?: boolean) => ({ key: 'button|Save|', tag: 'button', role: 'button', name: 'Save', path: 'button', ...(disabled ? { disabled } : {}) });

test('an element seen disabled, then enabled, is recorded as enabled', () => {
  const r = new CoverageRecorder();
  r.handle({ type: 'inventory', view: '/', elements: [btn(true)] });
  r.handle({ type: 'inventory', view: '/', elements: [btn()] });
  assert.equal(r.toRecord(ref).inventory['/']![0]!.disabled, undefined);
});

test('an element seen enabled stays enabled when it later turns disabled', () => {
  const r = new CoverageRecorder();
  r.handle({ type: 'inventory', view: '/', elements: [btn()] });
  r.handle({ type: 'inventory', view: '/', elements: [btn(true)] });
  const els = r.toRecord(ref).inventory['/']!;
  assert.equal(els.length, 1);
  assert.equal(els[0]!.disabled, undefined);
});
