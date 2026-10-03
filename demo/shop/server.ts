/**
 * Demo shop: the calibration target. Zero dependencies.
 *   node demo/shop/server.ts            -> http://localhost:4173
 *
 * It is deliberately small but realistic: a product list from an API, a cart
 * that changes server state, a search box, a newsletter form and footer links,
 * plus per-user profile pages and a note addressed by a cuid (view normalization),
 * and an avatar upload whose button reads "Processing..." while disabled (no phantom elements).
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

/** How long the avatar upload takes: long enough for Proofline to see the busy button. */
const UPLOAD_DELAY_MS = 800;

export function startShop(port = Number(process.env.PORT ?? 4173)): Promise<Server> {
  let cart: number[] = [];
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
