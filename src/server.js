import express from 'express';
import cookieParser from 'cookie-parser';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;
const TARGET_ENV = process.env.TARGET_ENV || process.env.NODE_ENV || 'qa';

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
app.use('/assets', express.static(path.join(__dirname, 'public')));

// In-memory demo datastore
const products = [
  { id: 1, name: 'Cloud Laptop Pro 16', category: 'Laptops', price: 1299.99, rating: 4.8, description: 'High performance laptop for cloud developers & engineers.' },
  { id: 2, name: 'Wireless Noise-Cancelling Headphones', category: 'Audio', price: 249.99, rating: 4.7, description: 'Premium sound with 40-hour battery life.' },
  { id: 3, name: 'Smart 4K Ultra Monitor 32"', category: 'Monitors', price: 499.99, rating: 4.9, description: 'Crisp IPS display with USB-C 90W power delivery.' },
  { id: 4, name: 'Ergonomic Mechanical Keyboard', category: 'Accessories', price: 129.99, rating: 4.6, description: 'Customizable RGB switches and aluminum frame.' },
  { id: 5, name: 'Precision Wireless Mouse', category: 'Accessories', price: 79.99, rating: 4.5, description: 'Ultra-low latency dual-mode wireless connectivity.' }
];

let cart = [
  { productId: 1, name: 'Cloud Laptop Pro 16', price: 1299.99, quantity: 1 }
];

let orders = [
  { id: 'ORD-9021', date: '2026-10-14', itemsCount: 2, total: 1549.98, status: 'Delivered' },
  { id: 'ORD-8842', date: '2026-10-12', itemsCount: 1, total: 79.99, status: 'Processing' }
];

// Demo failure simulation flag (can be toggled for pipeline gate testing)
let simulationMode = process.env.SIMULATE_FAILURE || 'none'; // 'none' | 'critical' | 'noncritical'

// Middleware for demo auth check
const getAuthUser = (req) => {
  const token = req.cookies?.auth_token;
  if (token) {
    return { username: 'testuser', email: 'testuser@example.com', role: 'DevOps Engineer' };
  }
  return null;
};

// Common Layout Helper
function renderPage({ title, body, activeNav = '', user = null }) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title} | ShopNova QA</title>
  <link rel="stylesheet" href="/assets/css/styles.css">
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
</head>
<body>
  <header class="navbar">
    <div class="nav-container">
      <a href="/" class="brand-logo">
        <span class="logo-icon">⚡</span>
        <span class="logo-text">ShopNova <span class="badge-env">${TARGET_ENV.toUpperCase()}</span></span>
      </a>
      <nav class="nav-links">
        <a href="/" class="${activeNav === 'home' ? 'active' : ''}">Home</a>
        <a href="/products" class="${activeNav === 'products' ? 'active' : ''}">Products</a>
        <a href="/orders" class="${activeNav === 'orders' ? 'active' : ''}">Orders</a>
        <a href="/dashboard" class="${activeNav === 'dashboard' ? 'active' : ''}">Dashboard</a>
      </nav>
      <div class="nav-actions">
        <a href="/cart" class="cart-btn" aria-label="Cart">
          🛒 Cart <span class="cart-count" id="cart-counter">${cart.reduce((s, i) => s + i.quantity, 0)}</span>
        </a>
        ${user ? `
          <a href="/profile" class="user-pill ${activeNav === 'profile' ? 'active' : ''}">👤 ${user.username}</a>
          <a href="/api/logout" class="btn-outline-sm">Log out</a>
        ` : `
          <a href="/login" class="btn-primary-sm">Log in</a>
        `}
      </div>
    </div>
  </header>

  <main class="main-content">
    ${body}
  </main>

  <footer class="footer">
    <div class="footer-container">
      <p>© 2026 ShopNova Inc. Automated CI/CD Sanity &amp; QA Environment (${TARGET_ENV}).</p>
      <div class="footer-meta">
        <span>Health: <a href="/api/health" class="health-link">/api/health</a></span>
        <span>Build: sha-demo10</span>
        <span>Gate Mode: ${process.env.SANITY_GATE_MODE || 'critical'}</span>
      </div>
    </div>
  </footer>
  <script src="/assets/js/app.js"></script>
</body>
</html>`;
}

// 1. Health check endpoint (Used by Sanity, Smoke, and Regression suites)
app.get('/api/health', (req, res) => {
  if (simulationMode === 'critical' || req.query.fail === 'critical') {
    return res.status(500).json({
      status: 'DOWN',
      error: 'Simulated Critical Outage on QA Health Service',
      environment: TARGET_ENV,
      timestamp: new Date().toISOString()
    });
  }

  res.status(200).json({
    status: 'UP',
    environment: TARGET_ENV,
    uptimeSeconds: Math.floor(process.uptime()),
    timestamp: new Date().toISOString(),
    services: {
      database: 'connected',
      redisCache: 'ready',
      paymentGateway: 'operational'
    }
  });
});

// 2. Home Page
app.get('/', (req, res) => {
  const user = getAuthUser(req);
  const q = req.query.q ? String(req.query.q).toLowerCase() : '';
  const filteredProducts = q
    ? products.filter(p => p.name.toLowerCase().includes(q) || p.category.toLowerCase().includes(q))
    : products;

  const body = `
    <section class="hero-banner" id="hero-banner">
      <div class="hero-badge">🚀 QA Automated Pipeline Live Demo</div>
      <h1 class="hero-title">Continuous Quality Verification Platform</h1>
      <p class="hero-subtitle">High performance microservices deployed with automated post-deploy Playwright sanity gates.</p>
      
      <form action="/" method="GET" class="search-bar-form" role="search">
        <input type="search" name="q" value="${q ? express.response.req.query.q : ''}" placeholder="Search products, hardware, devices..." aria-label="Search products" class="search-input" />
        <button type="submit" class="search-button">Search</button>
      </form>
    </section>

    <section class="products-section">
      <div class="section-header">
        <h2>${q ? `Search Results for "${express.response.req.query.q}" (${filteredProducts.length})` : 'Featured Hardware & Cloud Gear'}</h2>
        <span class="catalog-badge">${filteredProducts.length} items available</span>
      </div>

      <div class="product-grid" id="product-catalog">
        ${filteredProducts.map(p => `
          <div class="product-card" data-product-id="${p.id}">
            <div class="product-tag">${p.category}</div>
            <h3 class="product-title">${p.name}</h3>
            <p class="product-desc">${p.description}</p>
            <div class="product-footer">
              <span class="product-price">$${p.price.toFixed(2)}</span>
              <button class="btn-add-cart" onclick="addToCart(${p.id}, '${p.name}', ${p.price})" aria-label="Add ${p.name} to cart">Add to Cart</button>
            </div>
          </div>
        `).join('')}
      </div>
    </section>
  `;

  res.send(renderPage({ title: 'Home', body, activeNav: 'home', user }));
});

// 3. Products Page
app.get('/products', (req, res) => {
  const user = getAuthUser(req);
  const q = req.query.q ? String(req.query.q).toLowerCase() : '';
  const filtered = q
    ? products.filter(p => p.name.toLowerCase().includes(q) || p.category.toLowerCase().includes(q))
    : products;

  const body = `
    <section class="products-section" style="margin-top: 24px;">
      <div class="section-header">
        <h2>Product Catalog</h2>
        <form action="/products" method="GET" class="search-bar-form-sm">
          <input type="search" name="q" value="${q ? express.response.req.query.q : ''}" placeholder="Filter products..." aria-label="Search products" class="search-input-sm" />
          <button type="submit" class="search-button-sm">Filter</button>
        </form>
      </div>

      <div class="product-grid">
        ${filtered.map(p => `
          <div class="product-card" data-product-id="${p.id}">
            <div class="product-tag">${p.category}</div>
            <h3 class="product-title">${p.name}</h3>
            <p class="product-desc">${p.description}</p>
            <div class="product-footer">
              <span class="product-price">$${p.price.toFixed(2)}</span>
              <button class="btn-add-cart" onclick="addToCart(${p.id}, '${p.name}', ${p.price})">Add to Cart</button>
            </div>
          </div>
        `).join('')}
      </div>
    </section>
  `;

  res.send(renderPage({ title: 'Products', body, activeNav: 'products', user }));
});

// Search API
app.get('/api/search', (req, res) => {
  const q = (req.query.q || '').toString().toLowerCase();
  const results = products.filter(p => p.name.toLowerCase().includes(q) || p.category.toLowerCase().includes(q));
  res.json({ query: q, count: results.length, results });
});

// 4. Cart API & Page
app.get('/api/cart', (req, res) => {
  const total = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
  res.json({ items: cart, total, count: cart.reduce((s, i) => s + i.quantity, 0) });
});

app.post('/api/cart', (req, res) => {
  const { productId, name, price, quantity = 1 } = req.body;
  const existing = cart.find(i => i.productId === Number(productId));
  if (existing) {
    existing.quantity += Number(quantity);
  } else {
    cart.push({
      productId: Number(productId),
      name: name || 'Demo Product',
      price: Number(price) || 99.99,
      quantity: Number(quantity)
    });
  }
  const total = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
  res.json({ success: true, count: cart.reduce((s, i) => s + i.quantity, 0), total, items: cart });
});

app.get('/cart', (req, res) => {
  const user = getAuthUser(req);
  const total = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);

  const body = `
    <div class="cart-container">
      <h2>Shopping Cart</h2>
      ${cart.length === 0 ? `
        <div class="empty-state">
          <p>Your cart is empty.</p>
          <a href="/products" class="btn-primary">Browse Products</a>
        </div>
      ` : `
        <table class="data-table">
          <thead>
            <tr><th>Item</th><th>Price</th><th>Qty</th><th>Subtotal</th></tr>
          </thead>
          <tbody>
            ${cart.map(i => `
              <tr>
                <td><strong>${i.name}</strong></td>
                <td>$${i.price.toFixed(2)}</td>
                <td>${i.quantity}</td>
                <td>$${(i.price * i.quantity).toFixed(2)}</td>
              </tr>
            `).join('')}
          </tbody>
          <tfoot>
            <tr>
              <th colspan="3" style="text-align: right;">Total:</th>
              <th>$${total.toFixed(2)}</th>
            </tr>
          </tfoot>
        </table>
        <div class="cart-actions">
          <a href="/products" class="btn-outline">Continue Shopping</a>
          <a href="/checkout" class="btn-primary" id="btn-proceed-checkout">Proceed to Checkout</a>
        </div>
      `}
    </div>
  `;

  res.send(renderPage({ title: 'Shopping Cart', body, activeNav: 'cart', user }));
});

// 5. Checkout Page & API
app.get('/checkout', (req, res) => {
  if (simulationMode === 'critical_checkout') {
    return res.status(500).send('Critical checkout microservice outage');
  }

  const user = getAuthUser(req);
  const total = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);

  const body = `
    <div class="checkout-container">
      <h1>Checkout</h1>
      <div class="checkout-grid">
        <form action="/api/checkout" method="POST" class="checkout-form" id="checkout-form">
          <h3>Shipping &amp; Billing</h3>
          <div class="form-group">
            <label for="fullName">Full Name</label>
            <input type="text" id="fullName" name="fullName" value="Deepak Engineer" required class="form-control" />
          </div>
          <div class="form-group">
            <label for="address">Address</label>
            <input type="text" id="address" name="address" value="100 Tech Blvd, Suite 400" required class="form-control" />
          </div>
          <div class="form-group">
            <label for="cardNumber">Card Number</label>
            <input type="text" id="cardNumber" name="cardNumber" value="4111 2222 3333 4444" required class="form-control" />
          </div>
          <button type="submit" class="btn-primary btn-block" id="btn-place-order">Place Order ($${total.toFixed(2)})</button>
        </form>

        <div class="order-summary-box">
          <h3>Order Summary</h3>
          <div class="summary-items">
            ${cart.map(i => `<div class="summary-row"><span>${i.name} (x${i.quantity})</span><span>$${(i.price * i.quantity).toFixed(2)}</span></div>`).join('')}
          </div>
          <hr />
          <div class="summary-total"><strong>Total:</strong> <strong>$${total.toFixed(2)}</strong></div>
        </div>
      </div>
    </div>
  `;

  res.send(renderPage({ title: 'Checkout', body, activeNav: 'cart', user }));
});

app.post('/api/checkout', (req, res) => {
  const total = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
  const orderId = 'ORD-' + Math.floor(1000 + Math.random() * 9000);
  orders.unshift({
    id: orderId,
    date: new Date().toISOString().slice(0, 10),
    itemsCount: cart.length,
    total,
    status: 'Processing'
  });
  cart = []; // empty cart
  res.redirect('/orders?placed=' + orderId);
});

// 6. Orders Page
app.get('/orders', (req, res) => {
  const user = getAuthUser(req);
  const placed = req.query.placed;

  const body = `
    <div class="orders-container">
      <h2>Order History</h2>
      ${placed ? `<div class="alert alert-success">Order <strong>${placed}</strong> placed successfully!</div>` : ''}
      <table class="data-table">
        <thead>
          <tr><th>Order ID</th><th>Date</th><th>Items</th><th>Total</th><th>Status</th></tr>
        </thead>
        <tbody>
          ${orders.map(o => `
            <tr>
              <td><strong>${o.id}</strong></td>
              <td>${o.date}</td>
              <td>${o.itemsCount} items</td>
              <td>$${o.total.toFixed(2)}</td>
              <td><span class="badge ${o.status === 'Delivered' ? 'badge-success' : 'badge-warning'}">${o.status}</span></td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>
  `;

  res.send(renderPage({ title: 'Order History', body, activeNav: 'orders', user }));
});

// 7. Login Page & API
app.get('/login', (req, res) => {
  const user = getAuthUser(req);
  if (user) return res.redirect('/dashboard');

  const body = `
    <div class="auth-card">
      <h2>Sign In to ShopNova</h2>
      <p class="auth-sub">Enter credentials to authenticate in ${TARGET_ENV.toUpperCase()}</p>
      <form action="/api/login" method="POST" class="auth-form" id="login-form">
        <div class="form-group">
          <label for="username">Email or Username</label>
          <input type="text" id="username" name="username" class="form-control" placeholder="testuser" required autofocus />
        </div>
        <div class="form-group">
          <label for="password">Password</label>
          <input type="password" id="password" name="password" class="form-control" placeholder="••••••••" required />
        </div>
        <button type="submit" class="btn-primary btn-block" id="btn-submit-login">Log In</button>
      </form>
      <div class="auth-hint">
        <small>Demo default: <code>testuser</code> / <code>Password123!</code></small>
      </div>
    </div>
  `;

  res.send(renderPage({ title: 'Login', body, activeNav: 'login', user }));
});

app.post('/api/login', (req, res) => {
  const { username, password } = req.body;
  const expectedUser = process.env.SANITY_USER || 'testuser';
  const expectedPass = process.env.SANITY_PASSWORD || 'Password123!';

  if (username === expectedUser && password === expectedPass) {
    res.cookie('auth_token', 'demo-session-token-valid', { httpOnly: true, maxAge: 3600000 });
    return res.redirect('/dashboard');
  }

  res.status(401).send(renderPage({
    title: 'Login Failed',
    body: `
      <div class="auth-card">
        <div class="alert alert-danger">Invalid credentials provided.</div>
        <a href="/login" class="btn-primary">Try Again</a>
      </div>
    `,
    user: null
  }));
});

app.get('/api/logout', (req, res) => {
  res.clearCookie('auth_token');
  res.redirect('/');
});

// 8. Dashboard Page
app.get('/dashboard', (req, res) => {
  const user = getAuthUser(req) || { username: 'testuser', email: 'testuser@example.com', role: 'DevOps QA Lead' };

  const body = `
    <div class="dashboard-container">
      <div class="dashboard-header">
        <div>
          <h2>DevOps &amp; QA Environment Dashboard</h2>
          <p>Active Target: <span class="badge-env">${TARGET_ENV.toUpperCase()}</span> | Host: localhost:${PORT}</p>
        </div>
        <span class="badge badge-success">● System Operational</span>
      </div>

      <div class="metrics-grid">
        <div class="metric-card">
          <div class="metric-num">100%</div>
          <div class="metric-label">Sanity Pass Rate</div>
        </div>
        <div class="metric-card">
          <div class="metric-num">&lt; 30s</div>
          <div class="metric-label">Gate Evaluation Time</div>
        </div>
        <div class="metric-card">
          <div class="metric-num">14 Days</div>
          <div class="metric-label">Artifact Retention</div>
        </div>
        <div class="metric-card">
          <div class="metric-num">Enabled</div>
          <div class="metric-label">Auto Blocking Gate</div>
        </div>
      </div>

      <div class="dashboard-table-card">
        <h3>Connected Pipeline Services</h3>
        <table class="data-table">
          <thead><tr><th>Service</th><th>Target Route</th><th>Gate Status</th><th>Health</th></tr></thead>
          <tbody>
            <tr><td>Auth Service</td><td>/api/login</td><td>Critical</td><td><span class="badge badge-success">OK</span></td></tr>
            <tr><td>Health API</td><td>/api/health</td><td>Critical</td><td><span class="badge badge-success">OK</span></td></tr>
            <tr><td>Catalog API</td><td>/api/products</td><td>Standard</td><td><span class="badge badge-success">OK</span></td></tr>
            <tr><td>Checkout Gateway</td><td>/checkout</td><td>Critical</td><td><span class="badge badge-success">OK</span></td></tr>
          </tbody>
        </table>
      </div>
    </div>
  `;

  res.send(renderPage({ title: 'Dashboard', body, activeNav: 'dashboard', user }));
});

// 9. Profile Page
app.get('/profile', (req, res) => {
  const user = getAuthUser(req) || { username: 'testuser', email: 'testuser@example.com', role: 'DevOps Engineer' };

  const body = `
    <div class="profile-card">
      <h2>User Profile</h2>
      <div class="profile-row"><label>Username:</label><span>${user.username}</span></div>
      <div class="profile-row"><label>Email:</label><span>${user.email}</span></div>
      <div class="profile-row"><label>Role:</label><span>${user.role}</span></div>
      <div class="profile-row"><label>Environment:</label><span class="badge-env">${TARGET_ENV.toUpperCase()}</span></div>
    </div>
  `;

  res.send(renderPage({ title: 'Profile', body, activeNav: 'profile', user }));
});

// 10. Toggle Demo Failure Mode (For testing the Promotion Gate)
app.get('/api/toggle-failure', (req, res) => {
  const mode = req.query.mode || 'none';
  simulationMode = mode;
  res.json({ success: true, currentSimulationMode: simulationMode });
});

// Server bootstrap
const server = app.listen(PORT, () => {
  console.log(`[ShopNova QA App] Running on http://localhost:${PORT} (ENV: ${TARGET_ENV})`);
});

export default app;
