import type { OperatorId } from '../types.ts';

/**
 * Fault operators. Each one models a bug class real apps ship:
 *  - http-500       backend crashed / unhandled exception
 *  - network-fail   request never completed (DNS, CORS, offline)
 *  - empty-json     query returned nothing (wrong filter, empty table)
 *  - shift-numbers  off-by-one / wrong calculation (price, count, total)
 *  - blank-strings  missing data in a field (null name, empty label)
 *
 * A good E2E suite should fail under each of these for every endpoint it relies on.
 */

export interface OperatorDef {
  id: OperatorId;
  label: string;
  /** Needs a JSON response body to apply */
  needsJson: boolean;
  /** For body operators: return the mutated value, or undefined if nothing changed. */
  mutate?: (body: unknown) => unknown | undefined;
}

const MAX_DEPTH = 12;

function mapLeaves(value: unknown, fn: (leaf: unknown, key: string | number | null) => unknown, depth = 0, key: string | number | null = null): unknown {
  if (depth > MAX_DEPTH) return value;
  if (Array.isArray(value)) return value.map((v, i) => mapLeaves(v, fn, depth + 1, i));
  if (value && typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) out[k] = mapLeaves(v, fn, depth + 1, k);
    return out;
  }
  return fn(value, key);
}

/** Keys that look like identifiers are left alone: changing them only proves routing breaks. */
const ID_KEY = /(^id$|Id$|_id$|^uuid$|^key$|^slug$|^href$|^url$)/;

export const OPERATORS: Record<OperatorId, OperatorDef> = {
  'http-500': { id: 'http-500', label: 'Server error (500)', needsJson: false },
  'network-fail': { id: 'network-fail', label: 'Network failure', needsJson: false },
  'empty-json': {
    id: 'empty-json',
    label: 'Empty result',
    needsJson: true,
    mutate(body) {
      let changed = false;
      const out = (function empty(v: unknown, depth: number): unknown {
        if (Array.isArray(v)) {
          if (v.length) changed = true;
          return [];
        }
        if (v && typeof v === 'object' && depth < 2) {
          const o: Record<string, unknown> = {};
          for (const [k, val] of Object.entries(v as Record<string, unknown>)) o[k] = empty(val, depth + 1);
          return o;
        }
        return v;
      })(body, 0);
      return changed ? out : undefined;
    },
  },
  'shift-numbers': {
    id: 'shift-numbers',
    label: 'Wrong numbers (+1)',
    needsJson: true,
    mutate(body) {
      let changed = false;
      const out = mapLeaves(body, (leaf, key) => {
        if (typeof leaf === 'number' && !(typeof key === 'string' && ID_KEY.test(key))) {
          changed = true;
          return leaf + 1;
        }
        return leaf;
      });
      return changed ? out : undefined;
    },
  },
  'blank-strings': {
    id: 'blank-strings',
    label: 'Missing text',
    needsJson: true,
    mutate(body) {
      let changed = false;
      const out = mapLeaves(body, (leaf, key) => {
        if (typeof leaf === 'string' && leaf.length > 0 && !(typeof key === 'string' && ID_KEY.test(key))) {
          changed = true;
          return '';
        }
        return leaf;
      });
      return changed ? out : undefined;
    },
  },
};

export const DEFAULT_OPERATORS: OperatorId[] = ['http-500', 'network-fail', 'empty-json', 'shift-numbers', 'blank-strings'];
