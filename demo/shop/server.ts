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
<h1>Tip of the day</h1><p id="tip" data-state="loading"></p>
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
    res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
    if (url.pathname === '/') return res.end(PAGE);
    if (url.pathname === '/cart') return res.end(simplePage('Your cart'));
    if (url.pathname === '/about') return res.end(simplePage('About us'));
    if (url.pathname === '/returns') return res.end(simplePage('Returns policy'));
    if (url.pathname === '/settings/avatar') return res.end(AVATAR_PAGE);
    if (url.pathname === '/help' || url.pathname === '/help/faq') return res.end(HELP_PAGE);
    if (url.pathname === '/community') return res.end(communityPage(posts));
    if (url.pathname === '/help/tips') return res.end(TIPS_PAGE);
    const user = /^\/users\/([a-z_]+)$/.exec(url.pathname);
    if (user) return res.end(profilePage(user[1]!));
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
