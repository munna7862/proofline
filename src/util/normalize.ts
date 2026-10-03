/**
 * Normalization helpers.
 *
 * Rule: everything Proofline groups by (views, endpoints, element names) must be
 * normalized the same way in the page agent and in Node. The page agent has its
 * own copy of normalizePath (it cannot import), so keep the two in sync:
 * test/normalize.test.ts locks the behaviour.
 */

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const NUMBER = /^\d+$/;
const HASHLIKE = /^[0-9a-f]{16,}$/i;

/**
 * Generated ids that are not numbers, uuids or hex: cuid, cuid2, nanoid, ulid.
 * Shape: 20+ chars of [A-Za-z0-9_-], at least one letter AND one digit.
 * Slugs like "how-to-test-in-2024-and-beyond" are kept: a segment with - or _
 * is never an id when one of its pieces is a plain lowercase word (3+ letters).
 */
export function isGeneratedId(seg: string): boolean {
  if (seg.length < 20 || !/^[A-Za-z0-9_-]+$/.test(seg)) return false;
  if (!/[A-Za-z]/.test(seg) || !/\d/.test(seg)) return false;
  return !seg.split(/[-_]/).some((part, _i, all) => all.length > 1 && /^[a-z]{3,}$/.test(part));
}

/** Turn /orders/123/items/9f1c...e2 into /orders/:id/items/:uuid; cuid/nanoid/ulid ids become :id */
export function normalizePath(pathname: string): string {
  const parts = pathname.split('/').map((seg) => {
    if (seg === '') return seg;
    if (NUMBER.test(seg)) return ':id';
    if (UUID.test(seg)) return ':uuid';
    if (HASHLIKE.test(seg)) return ':hash';
    if (isGeneratedId(seg)) return ':id';
    return seg;
  });
  const joined = parts.join('/');
  return joined.length > 1 && joined.endsWith('/') ? joined.slice(0, -1) : joined || '/';
}

/** View key for a page URL: normalized path plus hash-router path if present. */
export function viewKey(rawUrl: string): string {
  const url = new URL(rawUrl);
  let key = normalizePath(url.pathname);
  if (url.hash.startsWith('#/')) key += '#' + normalizePath(url.hash.slice(1));
  return key;
}

/** Endpoint key for an API request: METHOD origin+normalizedPath (query ignored). */
export function endpointKey(method: string, rawUrl: string): string {
  const url = new URL(rawUrl);
  return `${method.toUpperCase()} ${url.origin}${normalizePath(url.pathname)}`;
}

/** Collapse whitespace and replace digit runs so "Cart (3)" and "Cart (12)" group together. */
export function normalizeName(name: string): string {
  return name.replace(/\s+/g, ' ').trim().replace(/\d+/g, '#').slice(0, 80);
}

/** Small stable hash (FNV-1a, 32-bit) for ids. Deterministic across runs and machines. */
export function shortHash(input: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(36).padStart(7, '0');
}
