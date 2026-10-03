import { test } from 'node:test';
import assert from 'node:assert/strict';
import { endpointKey, normalizeName, normalizePath, shortHash, viewKey } from '../src/util/normalize.ts';

test('normalizePath replaces ids, uuids and hashes', () => {
  assert.equal(normalizePath('/orders/123/items/9f1c2a3b-1111-2222-3333-444455556666'), '/orders/:id/items/:uuid');
  assert.equal(normalizePath('/blob/0123456789abcdef0123'), '/blob/:hash');
  assert.equal(normalizePath('/'), '/');
  assert.equal(normalizePath('/cart/'), '/cart');
});

test('viewKey includes hash-router paths', () => {
  assert.equal(viewKey('http://x.test/app#/users/42'), '/app#/users/:id');
  assert.equal(viewKey('http://x.test/a?q=1'), '/a');
});

test('endpointKey ignores query and normalizes method', () => {
  assert.equal(endpointKey('get', 'http://x.test/api/p/7?page=2'), 'GET http://x.test/api/p/:id');
});

test('normalizeName groups dynamic counters', () => {
  assert.equal(normalizeName('  Cart (12)  '), 'Cart (#)');
});

test('shortHash is stable', () => {
  assert.equal(shortHash('abc'), shortHash('abc'));
  assert.notEqual(shortHash('abc'), shortHash('abd'));
});

test('normalizePath maps cuid, cuid2, nanoid and ulid shapes to :id', () => {
  assert.equal(normalizePath('/notes/cmusge6wr0004pndce18dw4iq'), '/notes/:id');
  assert.equal(normalizePath('/notes/fdf6qsvrkvfnw2ctkcjhdsog'), '/notes/:id');
  assert.equal(normalizePath('/s/V1StGXR8_Z5jdHi6B-myT'), '/s/:id');
  assert.equal(normalizePath('/e/01ARZ3NDEKTSV4RRFFQ69G5FAV'), '/e/:id');
  assert.equal(endpointKey('GET', 'http://x.test/api/notes/cmusge6wr0004pndce18dw4iq'), 'GET http://x.test/api/notes/:id');
});

test('normalizePath keeps words, usernames and slugs', () => {
  assert.equal(normalizePath('/users/ag_theodora_conroy'), '/users/ag_theodora_conroy');
  assert.equal(normalizePath('/settings/notifications'), '/settings/notifications');
  assert.equal(normalizePath('/settings/notificationspreferences'), '/settings/notificationspreferences');
  assert.equal(normalizePath('/blog/how-to-test-in-2024-and-beyond'), '/blog/how-to-test-in-2024-and-beyond');
  assert.equal(normalizePath('/v/abc123'), '/v/abc123');
});
