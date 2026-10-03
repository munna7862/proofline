/**
 * Demo shop: the calibration target. Zero dependencies.
 *   node demo/shop/server.ts            -> http://localhost:4173
 *
 * It is deliberately small but realistic: a product list from an API, a cart
 * that changes server state, a search box, a newsletter form and footer links.
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
    if (url.pathname === '/api/reset' && req.method === 'POST') {
      cart = [];
      return json(200, { ok: true });
    }
    res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
    if (url.pathname === '/') return res.end(PAGE);
    if (url.pathname === '/cart') return res.end(simplePage('Your cart'));
    if (url.pathname === '/about') return res.end(simplePage('About us'));
    if (url.pathname === '/returns') return res.end(simplePage('Returns policy'));
    res.writeHead(404);
    res.end('Not found');
  });
  return new Promise((resolve) => server.listen(port, () => resolve(server)));
}

if (import.meta.url === `file://${process.argv[1]}` || process.argv[1]?.endsWith('server.ts')) {
  startShop().then(() => console.log('Demo shop on http://localhost:4173'));
}
