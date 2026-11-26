import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseCoverageConfig } from '../src/config.ts';

test('coverage settings are optional and validate each supported field', () => {
  assert.deepEqual(parseCoverageConfig({}), {});
  assert.throws(() => parseCoverageConfig([]), /Expected a JSON object/);
  assert.throws(() => parseCoverageConfig({ ignoreViews: '/login' }), /ignoreViews must be an array/);
  assert.throws(() => parseCoverageConfig({ ignoreElements: [''] }), /ignoreElements must be an array/);
  assert.throws(() => parseCoverageConfig({ viewRules: {} }), /viewRules must be an array/);
  assert.throws(() => parseCoverageConfig({ viewRules: [{ pattern: '^/settings', name: '' }] }), /nonempty view name/);
  assert.throws(() => parseCoverageConfig({ ignores: [] }), /Unknown option "ignores"/);
});
