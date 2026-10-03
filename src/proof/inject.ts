import type { BrowserContext, Request, Response } from 'playwright-core';
import { endpointKey, normalizePath } from '../util/normalize.ts';
import { OPERATORS } from './operators.ts';
import type { EndpointUse, Mutant } from '../types.ts';

const API_TYPES = new Set(['fetch', 'xhr']);

function patternOf(rawUrl: string): string {
  const u = new URL(rawUrl);
  return `${u.origin}${normalizePath(u.pathname)}`;
}

/** Baseline mode: remember which API endpoints the test depends on. */
export class NetworkRecorder {
  private uses = new Map<string, EndpointUse>();

  attach(context: BrowserContext): void {
    context.on('response', (resp: Response) => this.onResponse(resp));
  }

  private onResponse(resp: Response): void {
    const req: Request = resp.request();
    if (!API_TYPES.has(req.resourceType())) return;
    const key = endpointKey(req.method(), req.url());
    const json = (resp.headers()['content-type'] ?? '').includes('json');
    const prev = this.uses.get(key);
    this.uses.set(key, {
      key,
      method: req.method().toUpperCase(),
      pattern: patternOf(req.url()),
      json: Boolean(prev?.json || json),
    });
  }

  endpoints(): EndpointUse[] {
    return [...this.uses.values()].sort((a, b) => a.key.localeCompare(b.key));
  }
}

export interface InjectionState {
  hit: boolean;
  changed: boolean;
}

/**
 * Mutant mode: rewrite matching responses at runtime. The app's source code is never
 * touched, which is what makes this usable on any web app without a build step.
 */
export async function injectMutant(context: BrowserContext, mutant: Mutant): Promise<InjectionState> {
  const state: InjectionState = { hit: false, changed: false };
  const op = OPERATORS[mutant.operator];

  await context.route(
    (url) => {
      try {
        return patternOf(url.toString()) === mutant.pattern;
      } catch {
        return false;
      }
    },
    async (route) => {
      const req = route.request();
      if (req.method().toUpperCase() !== mutant.method || !API_TYPES.has(req.resourceType())) {
        return route.fallback();
      }
      state.hit = true;

      if (op.id === 'http-500') {
        state.changed = true;
        return route.fulfill({
          status: 500,
          contentType: 'application/json',
          body: JSON.stringify({ error: 'Injected by Proofline (http-500)' }),
        });
      }
      if (op.id === 'network-fail') {
        state.changed = true;
        return route.abort('failed');
      }

      const response = await route.fetch();
      const text = await response.text();
      let parsed: unknown;
      try {
        parsed = JSON.parse(text);
      } catch {
        return route.fulfill({ response, body: text });
      }
      const mutated = op.mutate?.(parsed);
      if (mutated === undefined) return route.fulfill({ response, body: text });
      state.changed = true;
      return route.fulfill({ response, body: JSON.stringify(mutated) });
    },
  );

  return state;
}
