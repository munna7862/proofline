import { test } from 'node:test';
import assert from 'node:assert/strict';
import { join } from 'node:path';
import { displayPath } from '../src/util/store.ts';

test('displayPath is relative and uses forward slashes on every OS', () => {
  const cwd = process.cwd();
  assert.equal(displayPath(join(cwd, '.proofline', 'report', 'index.html'), cwd), '.proofline/report/index.html');
});
