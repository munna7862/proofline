/**
 * The page agent runs INSIDE the browser via context.addInitScript(proofAgent, options).
 *
 * Hard rules for this file:
 *  - It must be fully self-contained: no imports, no references to outer scope.
 *    Playwright serializes the function source and evaluates it in every frame.
 *  - It must never throw into the app and never change app behaviour.
 *  - It only reports TRUSTED events (dispatched by Playwright's input pipeline),
 *    so the app's own programmatic el.click() calls do not count as "tested".
 */

export interface AgentOptions {
  bindingName: string;
  interactiveSelector: string;
}

export const INTERACTIVE_SELECTOR = [
  'a[href]',
  'button',
  'input:not([type=hidden])',
  'select',
  'textarea',
  'summary',
  '[contenteditable=""]',
  '[contenteditable="true"]',
  '[role=button]',
  '[role=link]',
  '[role=checkbox]',
  '[role=radio]',
  '[role=switch]',
  '[role=tab]',
  '[role=menuitem]',
  '[role=option]',
  '[role=combobox]',
  '[role=textbox]',
  '[tabindex]:not([tabindex="-1"])',
].join(',');

export function proofAgent(opts: AgentOptions): void {
  const w = window as any;
  if (w.__prooflineInstalled) return;
  w.__prooflineInstalled = true;

  const emit = (msg: unknown) => {
    try {
      const fn = w[opts.bindingName];
      if (typeof fn === 'function') fn(msg).catch(() => {});
    } catch {
      /* never break the app */
    }
  };

  // Keep in sync with src/util/normalize.ts
  const normalizePath = (p: string) => {
    const out = p
      .split('/')
      .map((s) => {
        if (s === '') return s;
        if (/^\d+$/.test(s)) return ':id';
        if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s)) return ':uuid';
        if (/^[0-9a-f]{16,}$/i.test(s)) return ':hash';
        return s;
      })
      .join('/');
    return out.length > 1 && out.endsWith('/') ? out.slice(0, -1) : out || '/';
  };
  const viewOf = (href: string) => {
    try {
      const u = new URL(href, location.href);
      let key = normalizePath(u.pathname);
      if (u.hash.startsWith('#/')) key += '#' + normalizePath(u.hash.slice(1));
      return key;
    } catch {
      return '/';
    }
  };
  const clean = (s: string | null | undefined) =>
    (s || '').replace(/\s+/g, ' ').trim().replace(/\d+/g, '#').slice(0, 80);

  const roleOf = (el: Element) => {
    const explicit = el.getAttribute('role');
    if (explicit) return explicit;
    const tag = el.tagName.toLowerCase();
    if (tag === 'a') return 'link';
    if (tag === 'button' || tag === 'summary') return 'button';
    if (tag === 'select') return 'combobox';
    if (tag === 'textarea') return 'textbox';
    if (tag === 'input') {
      const t = ((el as HTMLInputElement).type || 'text').toLowerCase();
      if (t === 'checkbox') return 'checkbox';
      if (t === 'radio') return 'radio';
      if (t === 'submit' || t === 'button' || t === 'reset') return 'button';
      if (t === 'range') return 'slider';
      return 'textbox';
    }
    return 'generic';
  };

  const nameOf = (el: Element) => {
    const aria = el.getAttribute('aria-label');
    if (aria) return clean(aria);
    const labelledBy = el.getAttribute('aria-labelledby');
    if (labelledBy) {
      const t = labelledBy
        .split(/\s+/)
        .map((id) => document.getElementById(id)?.textContent || '')
        .join(' ');
      if (t.trim()) return clean(t);
    }
    const labels = (el as HTMLInputElement).labels;
    if (labels && labels.length) return clean(Array.from(labels).map((l) => l.textContent).join(' '));
    const ph = el.getAttribute('placeholder');
    if (ph) return clean(ph);
    const title = el.getAttribute('title') || el.getAttribute('alt');
    if (title) return clean(title);
    const text = (el as HTMLElement).innerText || el.textContent;
    if (text && text.trim()) return clean(text);
    const val = (el as HTMLInputElement).value;
    if (typeof val === 'string' && el.tagName === 'INPUT') return clean(val);
    return clean(el.getAttribute('name') || el.id || '');
  };

  const testIdOf = (el: Element) =>
    el.getAttribute('data-testid') || el.getAttribute('data-test') || el.getAttribute('data-cy') || undefined;

  const cssPath = (el: Element) => {
    const parts: string[] = [];
    let cur: Element | null = el;
    while (cur && cur.nodeType === 1 && parts.length < 4) {
      let part = cur.tagName.toLowerCase();
      if (cur.id) {
        parts.unshift(part + '#' + cur.id);
        break;
      }
      const cls = (cur.getAttribute('class') || '').trim().split(/\s+/).filter(Boolean)[0];
      if (cls) part += '.' + cls;
      parts.unshift(part);
      cur = cur.parentElement;
    }
    return parts.join(' > ');
  };

  const describe = (el: Element) => {
    const role = roleOf(el);
    const name = nameOf(el);
    const testId = testIdOf(el);
    const href = el.tagName === 'A' ? viewOf((el as HTMLAnchorElement).href) : undefined;
    return {
      key: [role, name, testId || ''].join('|'),
      tag: el.tagName.toLowerCase(),
      role,
      name,
      testId,
      href,
      path: cssPath(el),
    };
  };

  const isVisible = (el: Element) => {
    const anyEl = el as any;
    if (typeof anyEl.checkVisibility === 'function') return anyEl.checkVisibility();
    return el.getClientRects().length > 0;
  };

  const seenPerView: Record<string, Record<string, true>> = {};

  const scan = () => {
    const view = viewOf(location.href);
    const seen = (seenPerView[view] = seenPerView[view] || {});
    const fresh: any[] = [];
    document.querySelectorAll(opts.interactiveSelector).forEach((el) => {
      if (!isVisible(el)) return;
      const d = describe(el);
      if (seen[d.key]) return; // grouping: same role+name+testid counts once per view
      seen[d.key] = true;
      fresh.push(d);
    });
    if (fresh.length) emit({ type: 'inventory', view, elements: fresh });
  };

  let timer: any = null;
  const scheduleScan = () => {
    if (timer) return;
    timer = setTimeout(() => {
      timer = null;
      scan();
    }, 250);
  };

  const onEvent = (ev: Event) => {
    if (!ev.isTrusted) return;
    const target = ev.target as Element | null;
    if (!target || typeof (target as any).closest !== 'function') return;
    const el = target.closest(opts.interactiveSelector);
    if (!el) return;
    const d = describe(el);
    emit({ type: 'interaction', view: viewOf(location.href), key: d.key, event: ev.type });
    scheduleScan();
  };

  ['click', 'dblclick', 'contextmenu', 'input', 'change'].forEach((t) =>
    document.addEventListener(t, onEvent, true),
  );

  const start = () => {
    emit({ type: 'view', view: viewOf(location.href), url: location.href });
    scan();
    new MutationObserver(scheduleScan).observe(document.documentElement, {
      subtree: true,
      childList: true,
      attributes: true,
      attributeFilter: ['class', 'style', 'hidden', 'aria-hidden', 'disabled'],
    });
  };

  // SPA navigations: report the new view and rescan.
  const wrapHistory = (method: 'pushState' | 'replaceState') => {
    const original = history[method];
    history[method] = function (this: History, ...args: any[]) {
      const result = (original as any).apply(this, args);
      emit({ type: 'view', view: viewOf(location.href), url: location.href });
      scheduleScan();
      return result;
    } as any;
  };
  wrapHistory('pushState');
  wrapHistory('replaceState');
  window.addEventListener('popstate', () => {
    emit({ type: 'view', view: viewOf(location.href), url: location.href });
    scheduleScan();
  });

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, { once: true });
  else start();
}
