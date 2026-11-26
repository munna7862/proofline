/**
 * The page agent runs INSIDE the browser via context.addInitScript(proofAgent, options).
 *
 * Hard rules for this file:
 *  - It must be fully self-contained: no imports, no references to outer scope.
 *    Playwright serializes the function source and evaluates it in every frame.
 *  - It must never throw into the app and never change app behaviour.
 *  - It only reports TRUSTED events (dispatched by Playwright's input pipeline),
 *    so the app's own programmatic el.click() calls do not count as "tested".
 *    One exception: input/change on <input type=file>. Playwright's setInputFiles
 *    dispatches those untrusted, and apps rarely fire them on file inputs themselves.
 *  - Its only globals on the app's window are __prooflineInstalled and __prooflineFlush
 *    (the collector's end-of-test scan).
 */

export interface AgentOptions {
  bindingName: string;
  interactiveSelector: string;
  editableSelector: string;
  /** Elements inside a match are never inventoried or counted (dev-only overlays, toasts). */
  ignoreSelector: string;
  /** List item selector (LIST_ITEMS): elements inside one carry a `list` signature. */
  listItemSelector: string;
}

/**
 * Dev-only overlays that render inside the app's page but are not part of the app under test.
 * Markers read from each package's source:
 *  - TanStack Devtools (@tanstack/devtools 0.10): portal root data-testid="tanstack_devtools",
 *    main panel id="tanstack_devtools". react-router-devtools 6 renders inside it as a plugin.
 *  - react-router-devtools standalone: class "react-router-dev-tools",
 *    data-testid "react-router-devtools-main-panel" / "react-router-devtools-trigger".
 *  - TanStack Query devtools (@tanstack/query-devtools 5): classes "tsqd-open-btn-container"
 *    (floating button) and "tsqd-main-panel" (panel).
 *  - Focus guards, invisible tabindex=0 sentinels that trap focus in a dialog or menu and are
 *    not app elements: Radix (@radix-ui/react-focus-guards 1.1.3) sets data-radix-focus-guard;
 *    Headless UI (@headlessui/react 2.2) renders data-headlessui-focus-guard; data-focus-guard
 *    is the generic marker (react-focus-lock).
 */
export const DEVTOOLS_ROOTS = [
  '[data-testid="tanstack_devtools"]',
  '#tanstack_devtools',
  '.react-router-dev-tools',
  '[data-testid^="react-router-devtools"]',
  '.tsqd-open-btn-container',
  '.tsqd-main-panel',
  '[data-radix-focus-guard]',
  '[data-headlessui-focus-guard]',
  '[data-focus-guard]',
].join(',');

/**
 * Toasts and live regions: transient messages whose text is often data ("Connected your
 * <name> account"), so their buttons are never app elements. Sonner renders
 * <ol data-sonner-toaster class="toaster">.
 */
export const LIVE_REGIONS = [
  '[role=status]',
  '[role=alert]',
  '[aria-live]:not([aria-live="off"])',
  'ol[data-sonner-toaster]',
  '.toaster',
].join(',');

/** List items whose interactive children are siblings of each other (see ElementInfo.list). */
export const LIST_ITEMS = 'li,[role=listitem],tr,[role=row]';

export const EDITABLE_SELECTOR = '[contenteditable=""],[contenteditable="true" i],[contenteditable="plaintext-only" i]';

export const INTERACTIVE_SELECTOR = [
  'a[href]',
  'button',
  'input:not([type=hidden])',
  'select',
  'textarea',
  'summary',
  EDITABLE_SELECTOR,
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
  // Access to frameElement requires the embedding document to share this frame's origin.
  // Check the entire chain, including sandboxed frames and nested cross-origin boundaries.
  const frameChain: Element[] = [];
  try {
    for (let embed: Window = window; embed !== embed.parent; embed = embed.parent) {
      const frame = embed.frameElement;
      if (!frame) return;
      frameChain.push(frame);
    }
  } catch {
    return;
  }

  const w = window as any;
  if (w.__prooflineInstalled) return;
  w.__prooflineInstalled = true;

  // Create the document namespace before app code can replace browser methods.
  // It stays inside the collector and never appears in coverage artifacts.
  const documentId = (() => {
    try {
      return crypto.getRandomValues(new Uint32Array(4)).join('-');
    } catch {
      return `${performance.timeOrigin}-${Math.random()}`;
    }
  })();

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
        if (
          s.length >= 20 &&
          /^[A-Za-z0-9_-]+$/.test(s) &&
          /[A-Za-z]/.test(s) &&
          /\d/.test(s) &&
          !s.split(/[-_]/).some((part, _i, all) => all.length > 1 && /^[a-z]{3,}$/.test(part))
        )
          return ':id';
        return s;
      })
      .join('/');
    return out.length > 1 && out.endsWith('/') ? out.slice(0, -1) : out || '/';
  };
  const viewOf = (href: string) => {
    try {
      const u = new URL(href, location.href);
      let key = normalizePath(u.pathname);
      if (u.hash.startsWith('#/')) key += '#' + normalizePath(u.hash.slice(1).split(/[?#]/, 1)[0]!);
      return key;
    } catch {
      return '/';
    }
  };
  const frameStateKey = Symbol.for('proofline.frameState');
  type FrameSlots = { numbers: WeakMap<Element, number>; holders: Map<number, WeakRef<Element>> };
  type FrameState = {
    byView: Map<string, FrameSlots>;
    embeddingViews: WeakMap<Element, string>;
    inlineView?: string;
    rewrittenRoute?: { href: string; view: string };
  };
  const frameState = (doc: Document): FrameState => {
    const owner = doc as Document & { [frameStateKey]?: FrameState };
    return owner[frameStateKey] ??= { byView: new Map(), embeddingViews: new WeakMap() };
  };
  const slotOf = (frame: Element, owner: FrameState, view: string, slots: FrameSlots) => {
    const doc = frame.ownerDocument;
    const numberOf = (node: Element) => {
      const number = slots.numbers.get(node);
      return number !== undefined && slots.holders.get(number)?.deref() === node ? number : undefined;
    };
    let next = 1;
    const reserve = (node: Element) => {
      // An exiting frame can stay mounted while the next view renders.
      const loadedUnder = owner.embeddingViews.get(node);
      if (loadedUnder !== undefined && loadedUnder !== view) return;
      owner.embeddingViews.set(node, view);
      if (numberOf(node) !== undefined) return;
      while (true) {
        const holder = slots.holders.get(next)?.deref();
        if (!holder?.isConnected || holder.ownerDocument !== doc || owner.embeddingViews.get(holder) !== view) break;
        next++;
      }
      slots.numbers.set(node, next);
      slots.holders.set(next++, new WeakRef(node));
    };
    if (numberOf(frame) === undefined) {
      // Keep connected siblings in their existing slots. Visiting a route again
      // can reuse vacated positions, while live siblings keep distinct views.
      doc.querySelectorAll('iframe,frame').forEach(reserve);
      const root = frame.getRootNode() as Document | ShadowRoot;
      if (root !== doc) root.querySelectorAll('iframe,frame').forEach(reserve);
      reserve(frame);
    }
    return slots.numbers.get(frame)!;
  };
  // Blank, srcdoc and blob documents have no application route of their own.
  const isInlineFrameUrl = (href: string) => /^(?:blob:|about:(?:blank|srcdoc)(?:[?#]|$))/.test(href);
  const inlineFrameView = (() => {
    const frame = frameChain[0];
    if (!frame) return;
    const doc = frame.ownerDocument;
    const owner = frameState(doc);
    const rewrite = owner.rewrittenRoute;
    const parentView = owner.inlineView ?? (rewrite?.href === doc.URL ? rewrite.view : viewOf(doc.URL));
    owner.embeddingViews.set(frame, parentView);
    if (!isInlineFrameUrl(location.href)) return;
    let slots = owner.byView.get(parentView);
    if (!slots) {
      slots = { numbers: new WeakMap(), holders: new Map() };
      owner.byView.set(parentView, slots);
    }
    const slot = slotOf(frame, owner, parentView, slots);
    const view = owner.inlineView ? `${parentView}.${slot}` : `${parentView}#frame-${slot}`;
    frameState(document).inlineView = view;
    return view;
  })();
  const currentViewOf = () => inlineFrameView ?? viewOf(location.href);
  const routedFrameState = frameChain.length && !inlineFrameView ? frameState(document) : undefined;
  let lastFrameView = routedFrameState ? currentViewOf() : undefined;
  const observedView = () => {
    if (!routedFrameState) return currentViewOf();
    const rewrite = routedFrameState.rewrittenRoute;
    if (rewrite?.href === location.href) return rewrite.view;
    if (rewrite) delete routedFrameState.rewrittenRoute;
    lastFrameView = currentViewOf();
    return lastFrameView;
  };
  const visitedFrameViews = new Set<string>();
  const visitFrameView = (view: string) => {
    if (!frameChain.length || visitedFrameViews.has(view)) return;
    visitedFrameViews.add(view);
    emit({ type: 'view', view });
  };
  const clean = (s: string | null | undefined) =>
    (s || '').replace(/\s+/g, ' ').trim().replace(/\d+/g, '#').slice(0, 80);

  const shadowRootOf = (el: Element) => {
    const root = el.getRootNode() as Document | ShadowRoot;
    // An adopted component keeps its original JavaScript realm.
    return root.nodeType === Node.DOCUMENT_FRAGMENT_NODE && 'host' in root ? root : null;
  };
  const insideClosedRoot = (el: Element) => {
    for (let root = shadowRootOf(el); root; root = shadowRootOf(root.host)) {
      if (root.mode === 'closed') return true;
    }
    return false;
  };
  const composedParent = (el: Element) =>
    el.assignedSlot ?? el.parentElement ?? (el.getRootNode() as ShadowRoot).host ?? null;
  const usesShadowTree = (el: Element) => {
    if (shadowRootOf(el)) return true;
    for (let node: Element | null = el; node; node = node.parentElement) {
      if (node.assignedSlot) return true;
    }
    return false;
  };
  const closestInTree = (el: Element | null, selector: string) => {
    for (let cur = el; cur; cur = composedParent(cur)) {
      if (cur.matches(selector)) return cur;
    }
    return null;
  };
  const openRoots = new Set<ShadowRoot>();
  const queryControls = (selector: string) => {
    const matches = Array.from(document.querySelectorAll(selector));
    for (const root of openRoots) {
      if (!root.host.isConnected || root.host.ownerDocument !== document) openRoots.delete(root);
      else if (!insideClosedRoot(root.host)) root.querySelectorAll(selector).forEach((el) => matches.push(el));
    }
    return matches;
  };

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

  // A component can be moved or copied between same-origin frames. Preserve
  // private field classifications across that frame tree without storing values.
  const fieldPrivacyKey = Symbol.for('proofline.fieldPrivacy');
  type FieldPrivacy = {
    editingHosts: WeakSet<Element>;
    textboxes: WeakSet<Element>;
    valueFields: WeakSet<Element>;
  };
  const fieldPrivacyOwner = (frameChain.at(-1)?.ownerDocument ?? document) as Document & { [fieldPrivacyKey]?: FieldPrivacy };
  const { editingHosts, textboxes, valueFields } = fieldPrivacyOwner[fieldPrivacyKey] ??= {
    editingHosts: new WeakSet(),
    textboxes: new WeakSet(),
    valueFields: new WeakSet(),
  };
  const isEditingHost = (el: Element) => {
    if (el.matches(opts.editableSelector)) editingHosts.add(el);
    return editingHosts.has(el);
  };

  const isDraftContent = (el: Element) => {
    for (let cur: Element | null = el; cur; cur = composedParent(cur)) {
      if (isEditingHost(cur)) return true;
      if (cur.getAttribute('contenteditable')?.toLowerCase() === 'false') return false;
    }
    return false;
  };

  const isTextbox = (el: Element) => {
    if (el.getAttribute('role') === 'textbox') textboxes.add(el);
    return textboxes.has(el);
  };

  const hasValueText = (el: Element) => {
    if (isDraftContent(el)) return true;
    for (let cur: Element | null = el; cur; cur = composedParent(cur)) {
      if (isTextbox(cur)) return true;
    }
    return false;
  };

  // User-entered values are not labels. Contenteditable stores its value in DOM text.
  const isFieldInputType = (type: string) =>
    type !== 'submit' && type !== 'button' && type !== 'reset' && type !== 'image';
  const isField = (el: Element) => {
    if (isDraftContent(el) || isTextbox(el)) return true;
    const tag = el.tagName;
    if (tag === 'TEXTAREA' || tag === 'SELECT') valueFields.add(el);
    if (tag === 'INPUT') {
      const type = (el as HTMLInputElement).type;
      if (isFieldInputType(type)) valueFields.add(el);
    }
    return valueFields.has(el);
  };

  const isSlot = (el: Element): el is HTMLSlotElement =>
    el.localName === 'slot' && typeof (el as HTMLSlotElement).assignedNodes === 'function';
  const labelText = (el: Element, rendered = false): string => {
    if (hasValueText(el)) return '';
    const slot = isSlot(el) ? el : undefined;
    if (!slot && !Array.from(el.getElementsByTagName('*')).some(
      (child) => isSlot(child) || isEditingHost(child) || isTextbox(child),
    )) {
      return (rendered && (el as HTMLElement).innerText) || el.textContent || '';
    }
    // Follow projected labels, dropping value subtrees even when the value is slotted.
    const assigned = slot?.assignedNodes({ flatten: true });
    return Array.from(assigned?.length ? assigned : el.childNodes, (node) =>
      node.nodeType === Node.ELEMENT_NODE ? labelText(node as Element, rendered) : node.nodeType === Node.TEXT_NODE ? node.textContent : '',
    ).join('');
  };

  const nameOf = (el: Element) => {
    const aria = el.getAttribute('aria-label');
    if (aria) return clean(aria);
    const labelledBy = el.getAttribute('aria-labelledby');
    if (labelledBy) {
      const root = shadowRootOf(el) ?? document;
      const t = labelledBy
        .split(/\s+/)
        .map((id) => {
          const label = root.getElementById(id);
          return label ? labelText(label) : '';
        })
        .join(' ');
      if (t.trim()) return clean(t);
    }
    const labels = (el as HTMLInputElement).labels;
    if (labels && labels.length) {
      const label = clean(Array.from(labels, (l) => labelText(l)).join(' '));
      if (label) return label;
    }
    if (isField(el)) {
      return clean(
        el.getAttribute('name') || el.getAttribute('id') || el.getAttribute('placeholder') || el.getAttribute('title') || '',
      );
    }
    const ph = el.getAttribute('placeholder');
    if (ph) return clean(ph);
    const title = el.getAttribute('title') || el.getAttribute('alt');
    if (title) return clean(title);
    const text = labelText(el, true);
    if (text && text.trim()) return clean(text);
    // Button-like inputs (submit, button, reset) are labelled by their value.
    const val = (el as HTMLInputElement).value;
    if (typeof val === 'string' && el.tagName === 'INPUT') return clean(val);
    return clean(el.getAttribute('name') || el.id || '');
  };

  const testIdOf = (el: Element) =>
    el.getAttribute('data-testid') || el.getAttribute('data-test') || el.getAttribute('data-cy') || undefined;

  const cssPath = (el: Element, includeClasses = true) => {
    const parts: string[] = [];
    let cur: Element | null = el;
    while (cur && cur.nodeType === 1 && parts.length < 4) {
      let part = cur.tagName.toLowerCase();
      // getAttribute, not .id: a form with <input name="id"> makes form.id that input.
      const id = cur.getAttribute('id');
      if (id) {
        parts.unshift(part + '#' + id);
        break;
      }
      const cls = includeClasses ? (cur.getAttribute('class') || '').trim().split(/\s+/).filter(Boolean)[0] : undefined;
      if (cls) part += '.' + cls;
      parts.unshift(part);
      cur = cur.parentElement;
    }
    return parts.join(' > ');
  };

  // Inside a list item: "<list path> > <path from item to element>" (tags and first class, no
  // ids: item ids are usually generated). Elements with the same value are siblings in one list.
  const listOf = (el: Element) => {
    try {
      const item = el.closest(opts.listItemSelector);
      if (!item || !item.parentElement) return undefined;
      const inner: string[] = [];
      let cur: Element | null = el;
      while (cur && inner.length < 6) {
        const cls = (cur.getAttribute('class') || '').trim().split(/\s+/).filter(Boolean)[0];
        inner.unshift(cur.tagName.toLowerCase() + (cls ? '.' + cls : ''));
        if (cur === item) break;
        cur = cur.parentElement;
      }
      return cssPath(item.parentElement) + ' > ' + inner.join(' > ');
    } catch {
      return undefined;
    }
  };

  // Disabled, or inside a region marked aria-busy="true": a transient state such as
  // "Processing..." that no test can interact with.
  const isDisabled = (el: Element) => {
    try {
      return el.matches(':disabled') || !!closestInTree(el, '[aria-busy="true"]');
    } catch {
      return false;
    }
  };

  // The display path deliberately omits sibling positions. Record them separately
  // so distinct controls with identical markup do not look like renamed versions
  // of each other. Cache within one scan or interaction, while the DOM is unchanged.
  const positionsInSnapshot = () => {
    const positions = new WeakMap<Element, string>();
    const indexes = new WeakMap<Element, number>();
    const idsByRoot = new Map<Document | ShadowRoot, Map<string, number>>();
    const hasUniqueId = (el: Element, id: string): boolean => {
      const root = shadowRootOf(el) ?? document;
      let idCounts = idsByRoot.get(root);
      if (!idCounts) {
        idCounts = new Map();
        for (const node of root.querySelectorAll('[id]')) {
          const value = node.getAttribute('id')!;
          idCounts.set(value, (idCounts.get(value) ?? 0) + 1);
        }
        idsByRoot.set(root, idCounts);
      }
      return idCounts.get(id) === 1;
    };
    const part = (node: Element): string => {
      const parent = node.parentElement ?? shadowRootOf(node);
      if (parent && !indexes.has(node)) {
        const counts = new Map<string, number>();
        for (const child of parent.children) {
          const index = counts.get(child.localName) ?? 0;
          indexes.set(child, index);
          counts.set(child.localName, index + 1);
        }
      }
      return `${node.localName}:${indexes.get(node) ?? 0}`;
    };
    return (el: Element): string => {
      const relative: string[] = [];
      for (let node: Element | null = el; node && relative.length < 4; node = node.parentElement) {
        // The same ID already anchors the display path, so unrelated changes above it are irrelevant.
        const id = node.getAttribute('id');
        if (id) {
          if (hasUniqueId(node, id)) return relative.reverse().join('/') || 'self';
          break;
        }
        relative.push(part(node));
      }
      let ancestor: Element | null = el;
      const unvisited: Element[] = [];
      while (ancestor && !positions.has(ancestor)) {
        unvisited.push(ancestor);
        ancestor = ancestor.parentElement;
      }
      let prefix = ancestor ? `${positions.get(ancestor)}/` : '';
      while (unvisited.length) {
        const node = unvisited.pop()!;
        const position = `${prefix}${part(node)}`;
        positions.set(node, position);
        prefix = `${position}/`;
      }
      return positions.get(el)!;
    };
  };

  const describe = (el: Element) => {
    const role = roleOf(el);
    const name = nameOf(el);
    const testId = testIdOf(el);
    const destination = el.tagName === 'A' && !isDraftContent(el) ? (el as HTMLAnchorElement).href : undefined;
    const href = destination === undefined || destination.startsWith('blob:') ? undefined : viewOf(destination);
    const list = listOf(el);
    return {
      key: [role, name, testId || ''].join('|'),
      tag: el.tagName.toLowerCase(),
      role,
      name,
      testId,
      href,
      path: cssPath(el),
      ...(list ? { list } : {}),
      ...(isDisabled(el) ? { disabled: true } : {}),
    };
  };

  const isVisible = (el: Element) => {
    const anyEl = el as any;
    if (typeof anyEl.checkVisibility === 'function') return anyEl.checkVisibility();
    return el.getClientRects().length > 0;
  };

  // Inside a dev-only overlay (DEVTOOLS_ROOTS) or a toast / live region (LIVE_REGIONS): not the app under test.
  const isIgnored = (el: Element) => {
    try {
      return (opts.ignoreSelector && !!closestInTree(el, opts.ignoreSelector)) ||
        (usesShadowTree(el) && !!closestInTree(el, '[hidden],[aria-hidden="true"]'));
    } catch {
      return false;
    }
  };

  const inVisibleFrame = () => frameChain.every((frame) => {
    if (!frame.isConnected || !frame.clientWidth || !frame.clientHeight) return false;
    for (let ancestor: Element | null = frame; ancestor; ancestor = composedParent(ancestor)) {
      if (ancestor.matches('[hidden],[aria-hidden="true"]') || isIgnored(ancestor)) return false;
    }
    if (typeof frame.checkVisibility === 'function') {
      return frame.checkVisibility({ opacityProperty: true, visibilityProperty: true });
    }
    return isVisible(frame) && frame.ownerDocument.defaultView?.getComputedStyle(frame).visibility === 'visible';
  });

  type Seen = { enabled: boolean; location: string | null };
  const seenPerView: Record<string, Record<string, Seen>> = {};
  type FieldState = Seen & { key: string };
  const fields = new WeakMap<Element, { id: string; views: Map<string, FieldState> }>();
  let nextField = 0;

  type ObservedElement = ReturnType<typeof describe> & { position: string | null };
  const assignedScopes = new WeakMap<Element, Map<string, string>>();
  const hostsByView = new Map<string, Map<string, WeakRef<Element>>>();
  const scopeOf = (host: Element, view: string, preferred: string) => {
    const holders = hostsByView.get(view) ?? new Map<string, WeakRef<Element>>();
    hostsByView.set(view, holders);
    const scopes = assignedScopes.get(host) ?? new Map<string, string>();
    assignedScopes.set(host, scopes);
    const previous = scopes.get(view);
    if (previous && holders.get(previous)?.deref() === host) return previous;
    // A live component keeps its original scope when its classes or position
    // change. New components cannot take the scope of a live sibling.
    let scope = preferred;
    for (let suffix = 2; ; suffix++) {
      const holder = holders.get(scope)?.deref();
      if (!holder?.isConnected || holder.ownerDocument !== document) break;
      scope = `${preferred}~${suffix}`;
    }
    holders.set(scope, new WeakRef(host));
    scopes.set(view, scope);
    return scope;
  };
  const measure = (el: Element, positionOf: (el: Element) => string, view: string): ObservedElement => {
    const element = describe(el);
    const position = positionOf(el);
    const hosts: Element[] = [];
    for (let root = shadowRootOf(el); root; root = shadowRootOf(root.host)) {
      hosts.unshift(root.host);
    }
    if (!hosts.length) return { ...element, position };
    const paths: string[] = [];
    let scope = '';
    for (const host of hosts) {
      const path = cssPath(host);
      const location = `${cssPath(host, false)}@${positionOf(host)}`;
      scope = scopeOf(host, view, scope ? `${scope} / ${location}` : location);
      paths.push(path);
    }
    return {
      ...element,
      key: `${element.key}|shadow:${scope}`,
      path: [...paths, element.path].join(' > #shadow-root > '),
      position: `${scope}/${position}`,
      ...(element.list ? { list: `${scope} > ${element.list}` } : {}),
    };
  };

  const observe = (el: Element, view: string, measured: ObservedElement) => {
    const element = { ...measured };
    const currentPosition = element.position;
    const location = [element.path, element.role, element.tag, currentPosition].join('\0');
    const enabled = !element.disabled;
    const update = (previous: Seen | undefined) => {
      const locationChanged = previous != null && previous.location !== null && previous.location !== location;
      if (locationChanged || previous?.location === null) element.position = null;
      const state = { enabled: enabled || !!previous?.enabled, location: element.position === null ? null : location };
      return { state, fresh: !previous || locationChanged || (!previous.enabled && enabled) };
    };
    const nativeField = (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.tagName === 'SELECT') && isField(el);
    if (fields.has(el) || nativeField || isEditingHost(el) || isTextbox(el)) {
      let field = fields.get(el);
      if (!field) {
        // A frame can navigate or another frame can observe the same view. Keep IDs
        // distinct across documents, and strip them before writing the coverage record.
        field = { id: `${documentId}:${++nextField}`, views: new Map() };
        fields.set(el, field);
      }
      const previous = field.views.get(view);
      const { state, fresh } = update(previous);
      field.views.set(view, { key: element.key, ...state });
      if (previous && previous.key !== element.key) {
        emit({ type: 'rename', view, nodeId: field.id, element });
        return { element, nodeId: field.id, fresh: false };
      }
      return { element, nodeId: field.id, fresh };
    }
    const seen = (seenPerView[view] = seenPerView[view] || {});
    const { state, fresh } = update(seen[element.key]);
    seen[element.key] = state;
    return { element, nodeId: undefined, fresh };
  };

  // Route-transition bleed: after a client-side route change, the old view often stays mounted
  // for a moment (exit animations, late route swaps). Elements already on the page when the view
  // changed are recorded under the new view only once they are still there HOLD_MS later (the
  // end-of-test flush waits for that too). Shared layout (nav, header) survives; leftovers do not.
  const HOLD_MS = 600;
  const SHELL_SELECTOR = 'header,nav,[role=banner],[role=navigation]';
  type Departure = {
    view: string;
    controls: { node: Element; landmark: Element; element: ObservedElement }[];
  };
  let currentView = '';
  let carried: WeakSet<Element> = new WeakSet();
  let changedAt = 0;
  let awaitingSettleScan = false;
  let pendingDeparture: Departure | undefined;
  let started = false;
  let settleTimer: ReturnType<typeof setTimeout> | undefined;

  const onDomChanges = (changes: MutationRecord[]) => {
    // document.open() can replace a frame's content and clear its event listeners.
    if (frameChain.length && changes.some(({ target }) => target === document)) {
      const href = location.href;
      // An ancestor opening this document can copy its own URL into the frame
      // without navigation. Preserve the frame's route while that URL persists.
      if (routedFrameState && lastFrameView && frameChain.some((frame) => frame.ownerDocument.URL === href)) {
        routedFrameState.rewrittenRoute = { href, view: lastFrameView };
      }
      listenForInteractions();
    }
    const examined = new WeakSet<Element>();
    for (const change of changes) {
      const target = change.target as Element;
      // A control can briefly hold a value before a scan sees its new role or type.
      // Before startup the document observer discovers roots; only the newly
      // observed shadow controls need their own pre-start field history.
      if (change.type === 'attributes' && target.ownerDocument === document && (started || shadowRootOf(target))) {
        const previous = change.oldValue?.toLowerCase();
        if (change.attributeName === 'contenteditable') {
          if (previous === '' || previous === 'true' || previous === 'plaintext-only') editingHosts.add(target);
          isEditingHost(target);
        } else if (change.attributeName === 'role' && previous === 'textbox') {
          textboxes.add(target);
        } else if (change.attributeName === 'type' && target.tagName === 'INPUT' && isFieldInputType(previous ?? 'text')) {
          valueFields.add(target);
        }
      }
      for (const node of change.addedNodes) {
        if (node.nodeType === Node.ELEMENT_NODE) discoverRoots(node as Element, examined);
      }
    }
    if (started) scheduleScan();
  };

  const visibleShell = (node: Element) => {
    if (!node.isConnected || isIgnored(node) || closestInTree(node, '[hidden],[aria-hidden="true"]') || !inVisibleFrame()) return null;
    const landmark = closestInTree(node, SHELL_SELECTOR);
    if (!landmark) return null;
    if (typeof node.checkVisibility === 'function') {
      return node.checkVisibility({ opacityProperty: true, visibilityProperty: true }) ? landmark : null;
    }
    const visibility = getComputedStyle(node).visibility;
    if (visibility === 'hidden' || visibility === 'collapse' || !isVisible(node)) return null;
    for (let ancestor: Element | null = node; ancestor; ancestor = composedParent(ancestor)) {
      if (getComputedStyle(ancestor).opacity === '0') return null;
    }
    return landmark;
  };

  const confirmDeparture = (settled = Date.now() - changedAt >= HOLD_MS) => {
    if (!pendingDeparture || !settled) return;
    const { view: departed, controls } = pendingDeparture;
    pendingDeparture = undefined;
    const restored = controls.flatMap(({ node, landmark, element }) => {
      if (!node.matches(opts.interactiveSelector) || visibleShell(node) !== landmark) return [];
      const entry = observe(node, departed, element);
      return entry.fresh ? [{ ...entry.element, nodeId: entry.nodeId }] : [];
    });
    if (restored.length) emit({ type: 'inventory', view: departed, elements: restored });
  };

  const captureDeparture = (): Departure | undefined => {
    if (!awaitingSettleScan || !started) return;
    // History calls can occur before the observer delivers edits from this same JS task.
    const queuedChanges = documentObserver.takeRecords();
    if (queuedChanges.length) onDomChanges(queuedChanges);
    // The hold may have elapsed while a debounced scan is still waiting to run.
    confirmDeparture();
    const controls: Departure['controls'] = [];
    const positionOf = positionsInSnapshot();
    for (const node of queryControls(opts.interactiveSelector)) {
      if (!carried.has(node)) continue;
      const landmark = visibleShell(node);
      if (landmark) controls.push({ node, landmark, element: measure(node, positionOf, currentView) });
    }
    if (controls.length) return { view: currentView, controls };
  };

  const onUrlChange = (departure?: Departure) => {
    if (routedFrameState) delete routedFrameState.rewrittenRoute;
    const view = currentViewOf();
    if (routedFrameState) lastFrameView = view;
    if (!frameChain.length) emit({ type: 'view', view });
    else if (inVisibleFrame()) visitFrameView(view);
    if (view !== currentView) {
      pendingDeparture = departure;
      currentView = view;
      carried = new WeakSet();
      try {
        queryControls(opts.interactiveSelector).forEach((el) => carried.add(el));
      } catch {
        /* never break the app */
      }
      changedAt = Date.now();
      awaitingSettleScan = true;
      clearTimeout(settleTimer);
      settleTimer = setTimeout(() => {
        try {
          confirmDeparture(true);
        } catch {
          /* never break the app */
        }
        scheduleScan();
      }, HOLD_MS);
    }
    scheduleScan();
  };

  const scan = (final = false) => {
    // Track hosts even when they are hidden or later lose the contenteditable attribute.
    queryControls(opts.editableSelector).forEach((el) => editingHosts.add(el));
    if (!inVisibleFrame()) return;
    const view = observedView();
    visitFrameView(view);
    const positionOf = positionsInSnapshot();
    const fresh: any[] = [];
    const settled = Date.now() - changedAt >= HOLD_MS;
    if (settled) awaitingSettleScan = false;
    confirmDeparture();
    const holding = !final && !settled;
    queryControls(opts.interactiveSelector).forEach((el) => {
      if (holding && carried.has(el)) return;
      if (isIgnored(el)) return;
      if (!isVisible(el)) return;
      const entry = observe(el, view, measure(el, positionOf, view));
      if (entry.fresh) fresh.push({ ...entry.element, nodeId: entry.nodeId });
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

  // A frame can become visible due to embedding attributes or CSS layout.
  // Observe the frame and its ancestors until its document navigates away.
  const embeddingObserver = frameChain.length ? new MutationObserver(scheduleScan) : undefined;
  const frameResize = frameChain.length && typeof ResizeObserver === 'function' ? new ResizeObserver(scheduleScan) : undefined;
  const embeddingDocuments = new Set(frameChain.map((frame) => frame.ownerDocument));
  const watchEmbedding = () => {
    if (!embeddingObserver) return;
    for (const doc of embeddingDocuments) {
      // CSS can reveal a frame after a form change without altering its size.
      doc.addEventListener('change', scheduleScan, true);
      doc.defaultView?.addEventListener('resize', scheduleScan);
    }
    for (const frame of frameChain) {
      frameResize?.observe(frame);
      for (let ancestor: Element | null = frame; ancestor; ancestor = composedParent(ancestor)) {
        embeddingObserver.observe(ancestor, {
          attributes: true,
          attributeFilter: ['class', 'style', 'hidden', 'aria-hidden', 'height', 'width', 'open'],
        });
      }
    }
    scheduleScan();
  };
  const unwatchEmbedding = () => {
    embeddingObserver?.disconnect();
    frameResize?.disconnect();
    for (const doc of embeddingDocuments) {
      doc.removeEventListener('change', scheduleScan, true);
      doc.defaultView?.removeEventListener('resize', scheduleScan);
    }
  };

  const isFileFill = (ev: Event, target: Element) =>
    (ev.type === 'input' || ev.type === 'change') &&
    target.tagName === 'INPUT' &&
    ((target as HTMLInputElement).type || '').toLowerCase() === 'file';

  const containsInTree = (ancestor: Element, el: Element) => {
    for (let cur = composedParent(el); cur; cur = composedParent(cur)) {
      if (cur === ancestor) return true;
    }
    return false;
  };

  const credit = (el: Element, view: string, event: string, positionOf: (el: Element) => string) => {
    // The element the test just used is live in this view (even one held after a route change):
    // record it now, before the test can navigate away ahead of the next scan, so every
    // interaction has an inventory entry.
    carried.delete(el);
    const { element, nodeId, fresh } = observe(el, view, measure(el, positionOf, view));
    if (fresh) emit({ type: 'inventory', view, elements: [{ ...element, nodeId }] });
    emit({ type: 'interaction', view, key: element.key, nodeId, event });
  };

  const isPointerTrigger = (el: Element) =>
    el.matches('[aria-haspopup],[aria-expanded]') && !el.matches(':disabled');

  const onEvent = (ev: Event) => {
    // Composed events cross the shadow boundary and are handled once at the document.
    if (ev.composed && ev.currentTarget !== document) return;
    const target = ev.composedPath()[0] as Element | undefined;
    if (!target?.isConnected || target.ownerDocument !== document || typeof target.closest !== 'function') return;
    if ((!ev.isTrusted && !isFileFill(ev, target)) || !inVisibleFrame() || insideClosedRoot(target)) return;
    const el = closestInTree(target, opts.interactiveSelector);
    if (!el || isIgnored(el)) return;
    // Browsers deliver pointerdown to some children of disabled buttons even when clicks are suppressed.
    if (ev.type === 'pointerdown' && !isPointerTrigger(el)) return;
    const view = observedView();
    visitFrameView(view);
    const positionOf = positionsInSnapshot();
    credit(el, view, ev.type, positionOf);
    if (ev.isTrusted) {
      const wrapper = closestInTree(composedParent(el), opts.interactiveSelector);
      if (wrapper && (roleOf(wrapper) === 'link' || roleOf(wrapper) === 'button') &&
          !wrapper.matches(':disabled') && (ev.type !== 'pointerdown' || isPointerTrigger(wrapper)) &&
          !queryControls(opts.interactiveSelector).some(
            (descendant) => descendant !== el && containsInTree(wrapper, descendant) &&
              !isIgnored(descendant) && isVisible(descendant),
          )) {
        credit(wrapper, view, ev.type, positionOf);
      }
    }
    scheduleScan();
  };

  const onPopState = () => onUrlChange();
  const listenOn = (target: Document | ShadowRoot) => {
    for (const type of ['click', 'dblclick', 'contextmenu', 'input', 'change', 'pointerdown']) {
      target.addEventListener(type, onEvent, true);
    }
  };
  const listenForInteractions = () => {
    listenOn(document);
    window.addEventListener('popstate', onPopState);
    if (embeddingObserver) {
      window.addEventListener('pagehide', unwatchEmbedding);
      window.addEventListener('pageshow', watchEmbedding);
    }
  };
  listenForInteractions();

  const observationOptions: MutationObserverInit = {
    subtree: true,
    childList: true,
    characterData: true,
    attributes: true,
    attributeOldValue: true,
    attributeFilter: ['class', 'style', 'hidden', 'aria-hidden', 'disabled', 'aria-busy', 'contenteditable',
      'id', 'name', 'type', 'for', 'role', 'aria-label', 'aria-labelledby', 'placeholder', 'title',
      'data-testid', 'data-test', 'data-cy', 'slot'],
  };
  const documentObserver = new MutationObserver(onDomChanges);
  documentObserver.observe(document, observationOptions);
  const registeredRoots = new WeakSet<ShadowRoot>();
  let hasRegisteredRoot = false;
  const registerRoot = (root: ShadowRoot) => {
    if (root.mode !== 'open' || root.host.ownerDocument !== document || insideClosedRoot(root.host)) return;
    if (!registeredRoots.has(root)) {
      registeredRoots.add(root);
      documentObserver.observe(root, observationOptions);
    }
    hasRegisteredRoot = true;
    listenOn(root);
    openRoots.add(root);
  };
  const discoverRoots = (element: Element, examined: WeakSet<Element>) => {
    const pending = [element];
    while (pending.length) {
      const node = pending.pop()!;
      if (examined.has(node)) continue;
      examined.add(node);
      const root = node.shadowRoot;
      if (root) {
        registerRoot(root);
        for (const child of root.children) pending.push(child);
      }
      for (const child of node.children) pending.push(child);
    }
  };

  // Opening a root on an existing host emits no DOM mutation on the host.
  const originalAttachShadow = Element.prototype.attachShadow;
  Element.prototype.attachShadow = function attachShadow(this: Element, options: ShadowRootInit) {
    const root = originalAttachShadow.call(this, options);
    try {
      registerRoot(root);
      if (started && root.mode === 'open') scheduleScan();
    } catch {
      /* never change the result of attaching a root */
    }
    return root;
  };

  // Clonable roots are created by the browser without calling attachShadow.
  // Observe the copy before app code can turn its draft content into button text.
  const protectClonedTree = (source: Node, copy: Node) => {
    if (!hasRegisteredRoot && source.ownerDocument === copy.ownerDocument) return;
    try {
      const records = documentObserver.takeRecords();
      if (records.length) onDomChanges(records);
      const pending: [Node | null, Node][] = [[source, copy]];
      while (pending.length) {
        const [from, to] = pending.pop()!;
        if (to.nodeType === Node.ELEMENT_NODE) {
          const element = to as Element;
          const original = from?.nodeType === Node.ELEMENT_NODE ? from as Element : null;
          if (original?.localName === element.localName) {
            // Only copy field classifications. Values stay in the page.
            if (editingHosts.has(original)) editingHosts.add(element);
            if (textboxes.has(original)) textboxes.add(element);
            if (valueFields.has(original)) valueFields.add(element);
          }
          if (element.shadowRoot) {
            registerRoot(element.shadowRoot);
            pending.push([original?.shadowRoot ?? null, element.shadowRoot]);
          }
        }
        let originalChild = from?.firstChild ?? null;
        for (const child of to.childNodes) {
          pending.push([originalChild, child]);
          originalChild = originalChild?.nextSibling ?? null;
        }
      }
    } catch {
      /* never change the result of cloning a node */
    }
  };
  const originalCloneNode = Node.prototype.cloneNode;
  Node.prototype.cloneNode = function cloneNode(this: Node, deep?: boolean) {
    const copy = originalCloneNode.call(this, deep);
    protectClonedTree(this, copy);
    return copy;
  };
  const originalImportNode = Document.prototype.importNode;
  Document.prototype.importNode = function importNode<T extends Node>(this: Document, node: T, deep?: boolean): T {
    const copy = originalImportNode.call(this, node, deep) as T;
    protectClonedTree(node, copy);
    return copy;
  };

  // Called by the collector when the test ends. If a route change is still on hold, wait it
  // out first (at most HOLD_MS) so the old view's leftovers can unmount; whatever is still on
  // the page then belongs to the current view.
  w.__prooflineFlush = () =>
    new Promise<void>((resolve) => {
      const wait = Math.max(0, Math.min(HOLD_MS, changedAt + HOLD_MS - Date.now()));
      setTimeout(() => {
        try {
          scan(true);
        } catch {
          /* never break the app */
        }
        resolve();
      }, wait);
    });

  const start = () => {
    if (started) return;
    const queued = documentObserver.takeRecords();
    if (queued.length) onDomChanges(queued);
    if (document.documentElement) discoverRoots(document.documentElement, new WeakSet());
    started = true;
    currentView = currentViewOf();
    if (!frameChain.length) emit({ type: 'view', view: currentView });
    scan();
    if (embeddingObserver) watchEmbedding();
  };

  // SPA navigations: report the new view and rescan.
  const wrapHistory = (method: 'pushState' | 'replaceState') => {
    const original = history[method];
    history[method] = function (this: History, ...args: any[]) {
      let departure: Departure | undefined;
      try {
        departure = captureDeparture();
      } catch {
        /* never break navigation */
      }
      const result = (original as any).apply(this, args);
      onUrlChange(departure);
      return result;
    } as any;
  };
  wrapHistory('pushState');
  wrapHistory('replaceState');

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, { once: true });
  else start();
}
