/**
 * Demo shop: the calibration target. Zero dependencies.
 *   node demo/shop/server.ts            -> http://localhost:4173
 *
 * It is deliberately small but realistic: a product list from an API, a cart
 * that changes server state, a search box, a newsletter form and footer links,
 * plus per-user profile pages and a note addressed by a cuid (view normalization),
 * an account endpoint that answers 401 to guests (already failing in baseline),
 * an avatar upload whose button reads "Processing..." while disabled (no phantom elements),
 * a help center whose old view lingers after a client-side route change (no route bleed),
 * a community page with generated post titles and a toast (repeated lists, no toast elements),
 * and a tip of the day whose test is flaky on its second run (a flaky catch is "unstable").
 * Tests in demo/tests/ cover some of it well, some of it badly, and some not at all,
 * so Proofline's numbers on this app are known in advance (demo/expected.json).
 */
import { createServer, type Server } from 'node:http';

const PRODUCTS = [
  { id: 1, name: 'Cotton kurta', price: 899 },
  { id: 2, name: 'Steel tiffin box', price: 499 },
  { id: 3, name: 'Clay water bottle', price: 349 },
];

const PAGE = `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><title>Demo Shop</title>
<style>body{font-family:system-ui;margin:24px;max-width:720px}li{margin:8px 0}footer{margin-top:40px}</style></head>
<body>
<header><h1>Demo Shop</h1><a href="/cart" data-testid="cart-link">Cart (<span id="count">0</span>)</a></header>
<label>Search <input id="search" placeholder="Search products"></label>
<ul id="products" aria-label="Products"></ul>
<p id="status" role="status"></p>
<p>Total: <strong id="total">₹0</strong></p>
<form id="newsletter"><label>Email <input type="email" name="email"></label><button type="submit">Subscribe</button></form>
<footer><a href="/about">About us</a> <a href="/returns">Returns policy</a></footer>
<script>
const fmt = (n) => '₹' + n.toLocaleString('en-IN');
async function loadCart() {
  const res = await fetch('/api/cart');
  if (!res.ok) { document.getElementById('status').textContent = 'Could not load cart'; return; }
  const cart = await res.json();
  document.getElementById('count').textContent = cart.items.length;
  document.getElementById('total').textContent = fmt(cart.total);
}
async function loadProducts() {
  const res = await fetch('/api/products');
  const list = document.getElementById('products');
  if (!res.ok) { document.getElementById('status').textContent = 'Something went wrong'; return; }
  const products = await res.json();
  list.innerHTML = '';
  for (const p of products) {
    const li = document.createElement('li');
    li.innerHTML = '<span class="name"></span> <span class="price"></span> <button>Add to cart</button>';
    li.querySelector('.name').textContent = p.name;
    li.querySelector('.price').textContent = fmt(p.price);
    li.querySelector('button').addEventListener('click', async () => {
      await fetch('/api/cart', { method: 'POST', headers: {'content-type':'application/json'}, body: JSON.stringify({ id: p.id }) });
      await loadCart();
    });
    list.appendChild(li);
  }
}
document.getElementById('search').addEventListener('input', (e) => {
  const q = e.target.value.toLowerCase();
  document.querySelectorAll('#products li').forEach((li) => { li.hidden = !li.textContent.toLowerCase().includes(q); });
});
document.getElementById('newsletter').addEventListener('submit', (e) => { e.preventDefault(); });
loadProducts().catch(() => { document.getElementById('status').textContent = 'Offline'; });
loadCart().catch(() => {});
// Greets a signed-in shopper. Demo visitors are guests, so this always answers 401 (already failing in baseline).
fetch('/api/account').then((res) => { if (res.ok) document.getElementById('status').textContent = 'Welcome back'; }).catch(() => {});
</script>
</body></html>`;

const simplePage = (title: string) =>
  `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>${title}</title></head><body><h1>${title}</h1><a href="/">Back to shop</a></body></html>`;

const escapeHtml = (s: string) => s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);

const EMBEDDED_CONTROLS = `<!doctype html><button onclick="document.querySelector('p').textContent = 'Saved'">Save panel</button>
<button>Reset panel</button><p>Unsaved</p>`;
const INLINE_CONTROLS = '<label>Panel note <input></label><button>Clear note</button>';
const BACKUP_CONTROLS = `${INLINE_CONTROLS}
<iframe title="Review panel" srcdoc="${escapeHtml('<button>Review note</button>')}"></iframe>`;
const embeddedPage = (port: number) => `<!doctype html><title>Embedded panels</title>
<style>#compact-toggle:not(:checked) + #compact-panel { visibility: hidden }</style>
<button>Close panels</button>
<button id="update-saved">Update saved panel</button>
<iframe title="Saved panel" src="/embedded/controls"></iframe>
<iframe title="Note panel" srcdoc="${escapeHtml(INLINE_CONTROLS)}"></iframe>
<iframe title="Backup panel" srcdoc="${escapeHtml(BACKUP_CONTROLS)}"></iframe>
<iframe title="Written panel"></iframe>
<iframe title="Hidden panel" hidden srcdoc="<button>Hidden action</button>"></iframe>
<iframe title="Other origin" src="http://127.0.0.1:${port}/embedded/foreign"></iframe>
<details id="status" style="display:inline-block"><summary role="button">Show status panel</summary>
<iframe title="Status panel" srcdoc="<button>Clear status</button>"></iframe></details>
<iframe title="Blob panel"></iframe>
<label for="compact-toggle">Compact mode</label><input type="checkbox" id="compact-toggle">
<iframe id="compact-panel" title="Compact panel" srcdoc="<button>Manage compact mode</button>"></iframe>
<script>
document.querySelector('#update-saved').addEventListener('click', () => {
  const saved = document.querySelector('[title="Saved panel"]').contentDocument;
  saved.open();
  saved.write(${JSON.stringify(`<button onclick="this.disabled = true">Close panels</button>
<iframe title="Saved options" srcdoc="${escapeHtml('<button>More saved options</button>')}"></iframe>`)});
  saved.close();
});
const panel = document.querySelector('[title="Written panel"]').contentDocument;
panel.open();
panel.write(${JSON.stringify(`<button onclick="this.disabled = true">Confirm note</button>
<iframe title="Written options" srcdoc="${escapeHtml('<button>Save preferences</button>')}"></iframe>`)});
panel.close();
const statusPanel = document.querySelector('#status');
statusPanel.addEventListener('toggle', () => {
  if (statusPanel.open) setTimeout(() => { statusPanel.open = false; }, 750);
});
const blobFrame = document.querySelector('[title="Blob panel"]');
const activity = URL.createObjectURL(new Blob(['Activity'], { type: 'text/plain' }));
blobFrame.src = URL.createObjectURL(new Blob([
  '<button>Open activity</button><a download="activity.txt" href="' + activity + '">Download activity</a>'
], { type: 'text/html' }));
blobFrame.addEventListener('load', () => URL.revokeObjectURL(blobFrame.src), { once: true });
window.addEventListener('pagehide', () => URL.revokeObjectURL(activity), { once: true });
const compactToggle = document.querySelector('#compact-toggle');
compactToggle.addEventListener('change', () => {
  if (compactToggle.checked) setTimeout(() => { compactToggle.checked = false; }, 750);
});
</script>`;

const SETTINGS_FRAME = '<iframe title="Frame settings" srcdoc="<button onclick=\'this.disabled = true\'>Save settings</button>"></iframe>';
const FRAME_PREVIEW = `
<button id="settings">Open settings</button>
<iframe title="Preview" srcdoc="<button>Close preview</button>"></iframe>`;
const FRAME_HISTORY_PAGE = `<!doctype html><title>Frame preview</title>${FRAME_PREVIEW}
<script>
const render = () => {
  if (!location.pathname.endsWith('/settings')) {
    document.body.innerHTML = ${JSON.stringify(FRAME_PREVIEW)};
    return;
  }
  const preview = document.querySelector('[title="Preview"]');
  document.querySelector('#settings')?.remove();
  document.body.insertAdjacentHTML('beforeend', ${JSON.stringify(SETTINGS_FRAME)});
  document.querySelector('[title="Frame settings"]').addEventListener('load', () => preview?.remove(), { once: true });
};
document.addEventListener('click', (event) => {
  if (event.target.id !== 'settings') return;
  history.pushState({}, '', '/embedded/settings');
  render();
});
window.addEventListener('popstate', render);
</script>`;

const SHADOW_PAGE = `<!doctype html><title>Preferences components</title>
<span id="setting-label">Light DOM label</span>
<button id="open-security">Open security</button>
<button id="preview-draft">Preview backup</button>
<button id="lock-draft">Lock backup</button>
<button id="import-component">Import component</button>
<button id="prepend-board">Prepend board</button>
<x-panel id="preferences"><span slot="apply-label">Apply</span>
  <button slot="private-action">ProoflineSlottedHiddenMarker</button>
</x-panel>
<x-panel id="backup"><template shadowrootmode="open" shadowrootclonable>
  <button>Apply</button>
  <div id="draft" role="textbox" contenteditable="true" aria-label="Backup note" style="min-height:1em"></div>
</template></x-panel>
<x-panel id="closed"></x-panel>
<x-panel id="notifications" aria-live="polite"></x-panel>
<iframe id="component-source" title="Component source" srcdoc="<p>Component staging area</p>"></iframe>
<div id="boards"><x-board data-board="first"></x-board><x-board data-board="second"></x-board></div>
<script>
const panel = document.querySelector('#preferences').attachShadow({ mode: 'open' });
panel.innerHTML = '<span id="setting-label">Preference name</span><input aria-labelledby="setting-label">' +
  '<button id="apply-main"><slot name="apply-label"></slot></button><button>Reset</button><p id="outcome"></p><div id="security"></div>' +
  '<div aria-hidden="true"><slot name="private-action"></slot></div>';
panel.querySelector('#apply-main').addEventListener('click', () => {
  panel.querySelector('#outcome').textContent = 'Preferences applied';
});
document.querySelector('#open-security').addEventListener('click', () => {
  const host = panel.querySelector('#security');
  if (!host.shadowRoot) host.attachShadow({ mode: 'open' }).innerHTML =
    '<label>Proof document <input type="file"></label><button>Apply</button>';
});
const backup = document.querySelector('#backup');
const lockDraft = (host) => {
  const draft = host.shadowRoot.querySelector('#draft');
  draft.contentEditable = 'false';
  draft.setAttribute('role', 'button');
  draft.removeAttribute('aria-label');
};
document.querySelector('#preview-draft').addEventListener('click', () => {
  const preview = backup.cloneNode(true);
  preview.id = 'backup-preview';
  backup.after(preview);
  preview.shadowRoot.querySelector('button').remove();
  lockDraft(preview);
});
document.querySelector('#lock-draft').addEventListener('click', () => lockDraft(backup));
document.querySelector('#import-component').addEventListener('click', () => {
  const source = document.querySelector('#component-source').contentDocument;
  const detached = source.createElement('x-panel').attachShadow({ mode: 'open' });
  detached.innerHTML = '<input type="file" aria-label="ProoflineDetachedShadowMarker">';
  detached.querySelector('input').dispatchEvent(new Event('change', { bubbles: true }));
  const imported = source.createElement('x-panel');
  imported.id = 'imported';
  imported.attachShadow({ mode: 'open' }).innerHTML = '<button onclick="this.disabled = true">Use imported component</button>';
  source.body.append(imported);
  document.body.append(imported);
});
const startBoard = (host, label) => {
  const root = host.attachShadow({ mode: 'open' });
  const button = document.createElement('button');
  button.textContent = label;
  root.append(button);
  button.addEventListener('click', () => host.classList.toggle('active'));
};
document.querySelectorAll('#boards x-board').forEach((host) => startBoard(host, 'Apply'));
document.querySelector('#prepend-board').addEventListener('click', () => {
  const host = document.createElement('x-board');
  document.querySelector('#boards').prepend(host);
  startBoard(host, 'Refresh');
});
document.querySelector('#closed').attachShadow({ mode: 'closed' }).innerHTML = '<button>ProoflineClosedShadowMarker</button>';
document.querySelector('#notifications').attachShadow({ mode: 'open' }).innerHTML = '<button>ProoflineIgnoredShadowMarker</button>';
</script>`;

const styledBoardPage = (active: boolean) => `<!doctype html><title>Styled board</title>
<main id="styled-board"><x-board class="${active ? 'active' : 'idle'}"></x-board></main>
<script>
const root = document.querySelector('x-board').attachShadow({ mode: 'open' });
root.innerHTML = '<button onclick="this.disabled = true">Save board</button>';
</script>`;

// Per-user page: each test visits its own user, like suites that create a fresh user per test.
const profilePage = (username: string) =>
  `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>Profile</title></head><body>
<h1>${escapeHtml(username)}</h1><button id="follow" aria-pressed="false">Follow</button> <a href="/">Back to shop</a>
<script>document.getElementById('follow').addEventListener('click', (e) => { e.target.setAttribute('aria-pressed', 'true'); });</script>
</body></html>`;

// Avatar upload: the file input has no label (named by its name attribute, never by the picked
// file), and the button is disabled with a busy label while the request runs.
const AVATAR_PAGE = `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>Avatar</title></head><body>
<h1>Avatar</h1>
<form id="avatar-form"><input type="file" name="avatar" accept="image/*"> <button type="submit" id="upload">Upload</button></form>
<p id="status" role="status"></p>
<script>
const form = document.getElementById('avatar-form');
const btn = document.getElementById('upload');
const status = document.getElementById('status');
form.addEventListener('submit', async (e) => {
  e.preventDefault();
  btn.disabled = true;
  btn.textContent = 'Processing...';
  try {
    const res = await fetch('/api/avatar', { method: 'POST', body: new FormData(form) });
    status.textContent = res.ok ? 'Avatar saved' : 'Upload failed';
  } catch {
    status.textContent = 'Upload failed';
  } finally {
    btn.disabled = false;
    btn.textContent = 'Upload';
  }
});
</script>
</body></html>`;

// A page only the deliberately failing outage test visits. Its "Retry" button must stay out of coverage.
const OUTAGE_PAGE = `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>Outage</title></head><body>
<h1>Outage</h1><button id="retry">Retry</button>
</body></html>`;

const DRAFTS_PAGE = `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>Drafts</title></head><body>
<h1>Drafts</h1>
<div id="draft-label"><div id="note" contenteditable="true"></div></div>
<div id="plain-note" contenteditable="plaintext-only" aria-label="Plain note"></div>
<div id="rich-note" contenteditable="true">
  <a href="/documents/ProoflineDraftLinkPathMarker">ProoflineDraftLinkTextMarker</a>
  <div contenteditable="false"><button>Accept</button><button>Reject</button></div>
</div>
<button id="lock" onclick="document.getElementById('note').contentEditable = 'false'">Lock draft</button>
<button id="preview" aria-labelledby="draft-label">Preview</button>
<a href="#/editor?draft=ProoflineLinkMarker">Draft view</a>
</body></html>`;

/** How long the old help view stays mounted after the route change: longer than the agent's 250 ms scan debounce. */
const LEAVE_MS = 400;

// Help center: a client-side route change (pushState) where the old view's button stays
// mounted for a moment after the URL changed, like an exit animation or a framework that
// swaps routes late. "Open FAQ" must belong to /help only; "Help home" is shared by both views.
// It also carries dev-only overlays (fake TanStack, React Router and React Query devtools roots,
// with the real packages' root markers): their 3 buttons are never app elements.
// A Radix focus-guard span (invisible, tabindex=0) is not one either. The feedback form
// has <input name="id">, which makes form.id that input: element paths must still read form#feedback.
const HELP_PAGE = `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>Help</title></head><body>
<nav><a href="/help" id="help-home">Help home</a></nav>
<main id="help"></main>
<div><div data-testid="tanstack_devtools"><button aria-label="Open TanStack Devtools"></button></div></div>
<div class="react-router-dev-tools"><button>Routes</button></div>
<div class="tsqd-open-btn-container"><button aria-label="Open Tanstack query devtools"></button></div>
<span data-radix-focus-guard tabindex="0" style="outline:none;opacity:0;position:fixed;pointer-events:none"></span>
<script>
const main = document.getElementById('help');
function render() {
  if (location.pathname === '/help/faq') {
    const faq = document.createElement('section');
    faq.innerHTML = '<h1>FAQ</h1><form id="feedback"><input type="hidden" name="id" value="faq"><button type="button" class="helpful">Was this helpful?</button></form> <span id="thanks"></span>';
    faq.querySelector('.helpful').addEventListener('click', () => { document.getElementById('thanks').textContent = 'Thanks'; });
    const old = main.firstElementChild;
    main.appendChild(faq);
    if (old) setTimeout(() => old.remove(), ${LEAVE_MS});
    return;
  }
  main.innerHTML = '<section><h1>Help</h1><button id="open-faq">Open FAQ</button></section>';
  main.querySelector('#open-faq').addEventListener('click', () => { history.pushState(null, '', '/help/faq'); render(); });
}
render();
</script>
</body></html>`;

const FLOW_PAGE = `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>Fast flow</title></head><body>
<header><nav><a href="/">Back to shop</a><button id="retired">Old navigation</button><div id="flow-draft" role="button">Temporary notes</div><span id="fade"><button>More options</button></span></nav></header>
<header><input id="flow-input" type="button" value="Native action"><div id="flow-custom" role="button">Custom action</div></header>
<main><button id="start">Start flow</button></main>
<script>
const main = document.querySelector('main');
document.getElementById('start').addEventListener('click', () => {
  history.pushState(null, '', '/flow/intermediate');
  document.getElementById('fade').style.opacity = '0';
  main.innerHTML = '<button id="continue">Continue flow</button>';
  document.getElementById('continue').addEventListener('click', () => {
    const draft = document.getElementById('flow-draft');
    draft.contentEditable = 'true';
    draft.textContent = 'ProoflineFastViewDraftMarker';
    draft.contentEditable = 'false';
    const input = document.getElementById('flow-input');
    input.type = 'text';
    input.value = 'ProoflineFastViewInputMarker';
    input.type = 'button';
    const custom = document.getElementById('flow-custom');
    custom.setAttribute('role', 'textbox');
    custom.textContent = 'ProoflineFastViewRoleMarker';
    custom.setAttribute('role', 'button');
    history.pushState(null, '', '/flow/done');
    input.value = 'Native action';
    custom.textContent = 'Custom action';
    document.getElementById('retired').remove();
    document.getElementById('fade').style.opacity = '1';
    main.textContent = 'Flow complete';
    // Leave after the route hold, before its debounced scan.
    setTimeout(() => history.pushState(null, '', '/flow/end'), 700);
  });
});
</script>
</body></html>`;

// A form view the app leaves on the first keystroke, before the agent's debounced scan.
// The footer control is plain layout (no header or nav) and persists across every view;
// the old step lingers into the form view and unmounts before the form view's hold ends,
// so it stays out of every later view however fast the test is.
const QUICK_PAGE = `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>Quick form</title></head><body>
<main><button id="begin">Begin quick form</button></main>
<div id="old-step"><button>Old step</button></div>
<div class="footer"><button id="theme">Theme</button></div>
<script>
const main = document.querySelector('main');
document.getElementById('begin').addEventListener('click', () => {
  history.pushState(null, '', '/quick/form');
  setTimeout(() => document.getElementById('old-step').remove(), 500);
  main.innerHTML = '<label>Code <input id="code"></label><button id="cancel">Cancel code</button>';
  document.getElementById('code').addEventListener('input', () => {
    // Removing the focused field fires its change event, so finish the form view first.
    main.textContent = 'Checking code';
    history.pushState(null, '', '/quick/check');
    // A second fast view, left before its own hold ends.
    setTimeout(() => {
      main.textContent = 'Quick form done';
      history.pushState(null, '', '/quick/done');
    }, 100);
  });
});
</script>
</body></html>`;

const BOOTSTRAP_PAGE = `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>Bootstrap</title></head><body>
<header><div id="draft" role="button">Working</div></header>
<script>
const draft = document.getElementById('draft');
history.pushState(null, '', '/bootstrap/transient');
draft.contentEditable = 'true';
draft.textContent = 'ProoflineBootstrapDraftMarker';
draft.contentEditable = 'false';
history.replaceState(null, '', '/bootstrap/ready');
draft.textContent = 'Working';
</script>
</body></html>`;

const AUTO_FLOW_PAGE = `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>Automatic flow</title></head><body>
<header><nav><a href="/">Back to shop</a></nav></header>
<button id="launch">Start quick flow</button>
<script>
document.getElementById('launch').addEventListener('click', (event) => {
  history.pushState(null, '', '/flow/auto-preview');
  event.currentTarget.remove();
  setTimeout(() => history.replaceState(null, '', '/flow/auto-complete'), 210);
});
</script>
</body></html>`;

const CHECKOUT_PAGE = `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>Checkout</title></head><body>
<h1>Checkout</h1>
<a href="/cart" id="checkout-link" aria-label="Checkout link"><button type="button" id="checkout">Proceed to checkout</button><span data-focus-guard tabindex="0"></span><button hidden>Hidden option</button></a>
<a href="/about" id="options-link" aria-labelledby="order-reference-label"><button type="button" id="edit">Edit</button><button type="button" id="cancel" aria-labelledby="reference-value">Cancel</button></a>
<label for="checkout-password">Password</label>
<input name="initial_password" type="password">
<div id="checkout-note" contenteditable="true" role="textbox" aria-label="Draft note"></div>
<div id="order-reference-label">Options link<div id="order-reference" role="textbox" tabindex="0"><span id="reference-value">ProoflineCustomFieldMarker</span></div></div>
<p id="selection"></p>
<script>
for (const link of document.querySelectorAll('a')) {
  link.addEventListener('click', (event) => { event.preventDefault(); });
}
document.getElementById('checkout').addEventListener('click', () => {
  document.getElementById('selection').textContent = 'Checkout selected';
});
document.getElementById('edit').addEventListener('click', () => {
  document.getElementById('selection').textContent = 'Editing options';
});
document.getElementById('checkout-note').addEventListener('input', (event) => {
  event.target.setAttribute('aria-label', 'Order note');
}, { once: true });
setTimeout(() => { document.querySelector('input').id = 'checkout-password'; }, 300);
</script>
</body></html>`;

// The menu opens on pointerdown and makes the rest of the page pointer-inert
// before pointerup, so a click never reaches the trigger.
const MENU_PAGE = `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>Menu</title></head><body>
<h1>Menu settings</h1>
<button id="user-menu" aria-haspopup="menu"><span>User menu</span></button>
<div id="menu" role="menu" hidden style="pointer-events:auto"><button type="button" role="menuitem" id="settings-item">Settings</button></div>
<button type="button" id="disclosure" aria-expanded="false">Show details</button>
<p id="details" hidden>Menu details</p>
<button type="button" id="ordinary">Ordinary button</button>
<button type="button" id="synthetic" aria-haspopup="menu">Synthetic trigger</button>
<button type="button" id="disabled-menu" aria-haspopup="menu" disabled><span>Disabled menu</span></button>
<p id="selection"></p>
<script>
const trigger = document.getElementById('user-menu');
const menu = document.getElementById('menu');
trigger.addEventListener('pointerdown', () => {
  menu.hidden = false;
  document.body.style.pointerEvents = 'none';
});
trigger.addEventListener('click', () => { trigger.dataset.clicked = 'true'; });
document.getElementById('settings-item').addEventListener('click', () => {
  menu.hidden = true;
  document.body.style.pointerEvents = '';
  document.getElementById('selection').textContent = 'Settings selected';
});
const disclosure = document.getElementById('disclosure');
disclosure.addEventListener('pointerdown', () => {
  disclosure.setAttribute('aria-expanded', 'true');
  document.getElementById('details').hidden = false;
});
</script>
</body></html>`;

// Community: 5 post links whose titles are generated at server start (new every run, like faker
// data in seeded suites) and a toast after joining (Sonner markup, a greeting with a name and a
// Dismiss button). The 5 links must count as one "in list (5 seen)" element; the toast is not an element.
const communityPage = (posts: string[]) => `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>Community</title></head><body>
<h1>Community</h1>
<button id="join">Join community</button>
<ul id="posts">${posts.map((p, i) => `<li><a href="/community?post=${i + 1}">${escapeHtml(p)}</a></li>`).join('')}</ul>
<p id="reading"></p>
<section aria-label="Notifications"><ol data-sonner-toaster class="toaster" id="toasts"></ol></section>
<script>
document.getElementById('join').addEventListener('click', () => {
  const li = document.createElement('li');
  li.innerHTML = '<span>Welcome, ${escapeHtml(posts[0]!.split(' ')[0]!)}!</span> <button>Dismiss</button>';
  li.querySelector('button').addEventListener('click', () => li.remove());
  document.getElementById('toasts').appendChild(li);
});
document.querySelectorAll('#posts a').forEach((a) => a.addEventListener('click', (e) => {
  e.preventDefault();
  document.getElementById('reading').textContent = 'Reading ' + a.textContent;
}));
</script>
</body></html>`;

// Tip of the day from GET /api/tips. The page marks data-state="ok" on any successful response,
// even an empty tip, so a test that only checks the state lets "Missing text" through.
const TIPS_PAGE = `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>Tips</title></head><body>
<h1>Tip of the day</h1><p id="tip" data-state="loading"></p><a href="/">Back to shop</a>
<script>
const tip = document.getElementById('tip');
fetch('/api/tips').then((res) => res.ok ? res.json() : Promise.reject(new Error('status ' + res.status)))
  .then((data) => { tip.textContent = data.tip; tip.dataset.state = 'ok'; })
  .catch(() => { tip.textContent = 'No tip today'; tip.dataset.state = 'error'; });
</script>
</body></html>`;

const AUTHORS = ['Jayde', 'Ola', 'Kim', 'Ravi', 'Mei', 'Tomas', 'Ines', 'Kofi'];
/** Five post titles that differ on every server start, five different authors (digits in names are masked). */
const generatePosts = () => {
  const offset = Math.floor(Math.random() * AUTHORS.length);
  return Array.from({ length: 5 }, (_, i) => `${AUTHORS[(offset + i) % AUTHORS.length]} post ${Math.floor(Math.random() * 9000) + 1000}`);
};

/** How long the avatar upload takes: long enough for Proofline to see the busy button. */
const UPLOAD_DELAY_MS = 800;

export function startShop(port = Number(process.env.PORT ?? 4173)): Promise<Server> {
  let cart: number[] = [];
  const posts = generatePosts();
  const server = createServer((req, res) => {
    const url = new URL(req.url ?? '/', `http://localhost:${port}`);
    const json = (status: number, body: unknown) => {
      res.writeHead(status, { 'content-type': 'application/json' });
      res.end(JSON.stringify(body));
    };
    if (url.pathname === '/api/products' && req.method === 'GET') return json(200, PRODUCTS);
    if (url.pathname === '/api/cart' && req.method === 'GET') {
      const items = cart.map((id) => PRODUCTS.find((p) => p.id === id)!);
      return json(200, { items, total: items.reduce((n, p) => n + p.price, 0) });
    }
    if (url.pathname === '/api/cart' && req.method === 'POST') {
      let body = '';
      req.on('data', (c) => (body += c));
      req.on('end', () => {
        const { id } = JSON.parse(body || '{}');
        if (PRODUCTS.some((p) => p.id === id)) cart.push(id);
        json(201, { ok: true });
      });
      return;
    }
    if (url.pathname === '/api/avatar' && req.method === 'POST') {
      req.resume();
      req.on('end', () => {
        setTimeout(() => {
          res.writeHead(204);
          res.end();
        }, UPLOAD_DELAY_MS);
      });
      return;
    }
    // Nobody signs in on the demo shop, so the account endpoint always answers 401.
    if (url.pathname === '/api/account' && req.method === 'GET') return json(401, { user: null });
    if (url.pathname === '/api/tips' && req.method === 'GET') return json(200, { tip: 'Pack a reusable bag' });
    if (url.pathname === '/api/reset' && req.method === 'POST') {
      cart = [];
      return json(200, { ok: true });
    }
    res.setHeader('content-type', 'text/html; charset=utf-8');
    if (url.pathname === '/') return res.end(PAGE);
    if (url.pathname === '/cart') return res.end(simplePage('Your cart'));
    if (url.pathname === '/about') return res.end(simplePage('About us'));
    if (url.pathname === '/returns') return res.end(simplePage('Returns policy'));
    if (url.pathname === '/settings/avatar') return res.end(AVATAR_PAGE);
    if (url.pathname === '/settings/drafts') return res.end(DRAFTS_PAGE);
    if (url.pathname === '/settings/menu') return res.end(MENU_PAGE);
    if (url.pathname === '/checkout/form') return res.end(CHECKOUT_PAGE);
    if (url.pathname === '/flow/start') return res.end(FLOW_PAGE);
    if (url.pathname === '/flow/auto') return res.end(AUTO_FLOW_PAGE);
    if (url.pathname === '/quick/start') return res.end(QUICK_PAGE);
    if (url.pathname === '/bootstrap/start') return res.end(BOOTSTRAP_PAGE);
    if (url.pathname === '/embedded') return res.end(embeddedPage(port));
    if (url.pathname === '/embedded/settings') return res.end(`<!doctype html><title>Frame settings</title>${SETTINGS_FRAME}`);
    if (url.pathname === '/embedded/preview') return res.end(FRAME_HISTORY_PAGE);
    if (url.pathname === '/embedded/controls') return res.end(EMBEDDED_CONTROLS);
    if (url.pathname === '/embedded/foreign') return res.end('<!doctype html><button>ProoflineForeignFrameMarker</button>');
    if (url.pathname === '/components') return res.end(SHADOW_PAGE);
    if (url.pathname === '/components/styles') return res.end(styledBoardPage(url.searchParams.has('active')));
    if (url.pathname === '/help' || url.pathname === '/help/faq') return res.end(HELP_PAGE);
    if (url.pathname === '/community') return res.end(communityPage(posts));
    if (url.pathname === '/users/links') {
      const username = escapeHtml(url.searchParams.get('user') ?? 'guest');
      const shopNav = username === 'asha_rao' ? `
<nav id="shop-links"><a href="/about">Catalog archive</a></nav>
<nav id="moving-links"><a href="/about">Store hours</a></nav>
<nav id="archived-links"></nav>
<nav><a id="duplicate-shop-link" href="/about">About the shop</a><a id="duplicate-shop-link" href="/returns">Return terms</a><a id="duplicate-shop-link" href="/cart">Cart guide</a></nav>
<script>
const shopLinks = document.getElementById('shop-links');
const movingLinks = document.getElementById('moving-links');
const archivedLinks = document.getElementById('archived-links');
function linkTo(href, name) {
  const link = document.createElement('a');
  link.href = href;
  link.textContent = name;
  return link;
}
function rotateLink(href, name) {
  archivedLinks.append(movingLinks.firstElementChild);
  movingLinks.append(linkTo(href, name));
}
setTimeout(() => {
  shopLinks.prepend(linkTo('/returns', 'Store policies'));
  rotateLink('/returns', 'Return help');
}, 320);
setTimeout(() => {
  shopLinks.prepend(linkTo('/cart', 'Cart help'));
  rotateLink('/cart', 'Cart details');
}, 640);
</script>` : '';
      return res.end(`<!doctype html><html lang="en"><head><meta charset="utf-8"><title>User links</title></head><body>
${username === 'ben_okafor' ? '<div hidden></div>' : ''}
<nav id="user-links"><a href="/about" onclick="event.preventDefault()">${username}'s notes</a><a href="/">Back to shop</a></nav>
${shopNav}
</body></html>`);
    }
    if (url.pathname === '/tips') return res.end(TIPS_PAGE);
    if (url.pathname === '/outage') return res.end(OUTAGE_PAGE);
    const user = /^\/users\/([a-z_]+)$/.exec(url.pathname);
    if (user) return res.end(profilePage(user[1]!));
    if (/^\/users\/[a-z_]+\/notes$/.test(url.pathname)) return res.end(simplePage('User notes'));
    if (/^\/users\/[a-z_]+\/notes\/new$/.test(url.pathname)) return res.end(simplePage('New note'));
    // Notes are addressed by a cuid, as in Prisma-backed apps.
    if (/^\/notes\/c[a-z0-9]{24}$/.test(url.pathname)) return res.end(simplePage('Note'));
    res.writeHead(404);
    res.end('Not found');
  });
  return new Promise((resolve) => server.listen(port, () => resolve(server)));
}

if (import.meta.url === `file://${process.argv[1]}` || process.argv[1]?.endsWith('server.ts')) {
  startShop().then(() => console.log('Demo shop on http://localhost:4173'));
}
