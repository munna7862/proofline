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

const field = (name: string, disabled?: boolean) => ({
  key: `textbox|${name}|`, tag: 'input', role: 'textbox', name, path: 'input',
  ...(disabled ? { disabled } : {}),
});

test('renaming a field moves prior interactions and keeps its enabled history', () => {
  const r = new CoverageRecorder();
  r.handle({ type: 'inventory', view: '/', elements: [{ ...field('Initial'), nodeId: 'doc:1' }] });
  r.handle({ type: 'interaction', view: '/', key: 'textbox|Initial|', nodeId: 'doc:1', event: 'input' });
  r.handle({ type: 'rename', view: '/', nodeId: 'doc:1', element: field('Intermediate') });
  r.handle({ type: 'rename', view: '/', nodeId: 'doc:1', element: field('Password', true) });
  const record = r.toRecord(ref);
  assert.deepEqual(record.inventory['/'], [field('Password')]);
  assert.deepEqual(record.interactions['/'], ['textbox|Password|']);
});

test('renaming one field retains another field and its independent interaction', () => {
  const r = new CoverageRecorder();
  r.handle({ type: 'inventory', view: '/', elements: [
    { ...field('Initial'), nodeId: 'doc1:1' }, { ...field('Initial'), nodeId: 'doc2:1' },
  ] });
  r.handle({ type: 'interaction', view: '/', key: 'textbox|Initial|', nodeId: 'doc2:1', event: 'input' });
  r.handle({ type: 'rename', view: '/', nodeId: 'doc1:1', element: field('Password') });
  const record = r.toRecord(ref);
  assert.deepEqual(record.inventory['/'], [field('Password'), field('Initial')]);
  assert.deepEqual(record.interactions['/'], ['textbox|Initial|']);
});

test('a field name change stays scoped to the view where it was observed', () => {
  const r = new CoverageRecorder();
  for (const view of ['/early', '/later']) {
    r.handle({ type: 'inventory', view, elements: [{ ...field('Initial'), nodeId: 'doc:1' }] });
  }
  r.handle({ type: 'rename', view: '/later', nodeId: 'doc:1', element: field('Password') });
  assert.deepEqual(r.toRecord(ref).inventory, { '/early': [field('Initial')], '/later': [field('Password')] });
});

test('same-key fields keep the metadata of the first field seen enabled', () => {
  const r = new CoverageRecorder();
  const first = { ...field('Initial'), nodeId: 'doc:1', path: 'input#first', list: 'li > input' };
  const second = { ...field('Initial'), nodeId: 'doc:2', path: 'input#second' };
  for (const el of [{ ...first, disabled: true }, second, first]) {
    r.handle({ type: 'inventory', view: '/', elements: [el] });
  }
  assert.deepEqual(r.toRecord(ref).inventory['/'], [{ ...field('Initial'), path: 'input#second' }]);
});

test('position changes remain ambiguous when an element is observed again', () => {
  const r = new CoverageRecorder();
  for (const position of ['a:0', 'a:1', 'a:0']) {
    r.handle({ type: 'inventory', view: '/', elements: [{ ...btn(), position }] });
  }
  assert.deepEqual(r.toRecord(ref).inventory['/'], [{ ...btn(), position: null }]);
});

test('renamed fields retain position ambiguity and prior interactions', () => {
  const r = new CoverageRecorder();
  r.handle({ type: 'inventory', view: '/', elements: [{ ...field('Initial'), nodeId: 'doc:1', position: 'input:0' }] });
  r.handle({ type: 'interaction', view: '/', key: 'textbox|Initial|', nodeId: 'doc:1', event: 'input' });
  r.handle({ type: 'rename', view: '/', nodeId: 'doc:1', element: { ...field('Password'), position: 'input:1' } });
  const record = r.toRecord(ref);
  assert.deepEqual(record.inventory['/'], [{ ...field('Password'), position: null }]);
  assert.deepEqual(record.interactions['/'], ['textbox|Password|']);
});
