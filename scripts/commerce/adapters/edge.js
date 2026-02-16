/**
 * Edge commerce adapter.
 * Client-side cart persisted to localStorage, orders via proxy worker.
 */

// --- Internal configuration ---
const API_ORIGIN = 'https://aem-productbus-demo-worker.adobeaem.workers.dev';
const STORAGE_KEY = 'cart';
const STORAGE_VERSION = 1;
const SHIPPING_THRESHOLD = 150;
const SHIPPING_COST = 10;
const COOKIE_EXPIRY_DAYS = 30;
const AUTH_TOKEN_KEY = 'auth_token';
const AUTH_USER_KEY = 'auth_user';

// --- Cart storage ---

let items = {};
let persistTimer = null;

function restore() {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return;
  try {
    const parsed = JSON.parse(raw);
    if (parsed.version !== STORAGE_VERSION) {
      localStorage.removeItem(STORAGE_KEY);
      return;
    }
    items = (parsed.items || []).reduce((acc, item) => {
      acc[item.sku] = item;
      return acc;
    }, {});
  } catch {
    localStorage.removeItem(STORAGE_KEY);
  }
}

function persistNow() {
  const count = Object.values(items).reduce((sum, i) => sum + i.quantity, 0);
  const expires = new Date(Date.now() + COOKIE_EXPIRY_DAYS * 864e5).toUTCString();
  document.cookie = `cart_items_count=${count}; expires=${expires}; path=/`;
  localStorage.setItem(STORAGE_KEY, JSON.stringify({
    version: STORAGE_VERSION,
    items: Object.values(items),
  }));
}

function persist() {
  clearTimeout(persistTimer);
  persistTimer = setTimeout(persistNow, 300);
}

function buildCart() {
  const allItems = Object.values(items);
  const subtotal = allItems.reduce((sum, i) => sum + i.quantity * i.price, 0);
  return {
    items: allItems,
    itemCount: allItems.reduce((sum, i) => sum + i.quantity, 0),
    subtotal,
    shipping: subtotal >= SHIPPING_THRESHOLD ? 0 : SHIPPING_COST,
  };
}

// Restore cart from localStorage on module load
restore();

// --- Auth helpers ---

function authFetch(url, options = {}) {
  const token = sessionStorage.getItem(AUTH_TOKEN_KEY);
  if (!token) throw new Error('Not authenticated');

  const headers = new Headers(options.headers || {});
  headers.set('Authorization', `Bearer ${token}`);

  return fetch(url, { ...options, headers }).then((resp) => {
    if (resp.status === 401) {
      sessionStorage.removeItem(AUTH_TOKEN_KEY);
      localStorage.removeItem(AUTH_USER_KEY);
      document.dispatchEvent(new CustomEvent('commerce:auth-state-changed', {
        detail: { loggedIn: false, email: null, reason: 'token_expired' },
      }));
    }
    return resp;
  });
}

// --- Adapter factory ---

export default function createEdgeAdapter() {
  return {
    // Cart

    async addToCart(item) {
      const existing = items[item.sku];
      if (existing) {
        existing.quantity += item.quantity;
      } else {
        items[item.sku] = { ...item };
      }
      persist();
      return buildCart();
    },

    async getCart() {
      return buildCart();
    },

    async updateItemQuantity(sku, quantity) {
      if (!items[sku]) throw new Error(`Item ${sku} not in cart`);
      if (quantity <= 0) {
        delete items[sku];
      } else {
        items[sku].quantity = quantity;
      }
      persist();
      return buildCart();
    },

    async removeItem(sku) {
      delete items[sku];
      persist();
      return buildCart();
    },

    async clearCart() {
      items = {};
      persistNow();
    },

    // Orders

    async createOrder({ customer, shipping }) {
      const cart = buildCart();
      const body = {
        customer,
        shipping,
        items: cart.items.map((item) => {
          let image = '';
          if (item.image) {
            try { image = new URL(item.image).pathname; } catch { image = item.image; }
          }
          return {
            sku: item.sku,
            urlKey: (item.url || '').split('/').pop() || '',
            name: item.name,
            quantity: item.quantity,
            price: {
              currency: item.currency || 'USD',
              final: String(item.price),
            },
            custom: { image, url: item.url || '' },
          };
        }),
      };

      const headers = { 'Content-Type': 'application/json' };
      const token = sessionStorage.getItem(AUTH_TOKEN_KEY);
      if (token) headers.Authorization = `Bearer ${token}`;

      const resp = await fetch(`${API_ORIGIN}/orders`, {
        method: 'POST',
        headers,
        body: JSON.stringify(body),
      });

      if (!resp.ok) {
        throw new Error(`Order creation failed: ${resp.status}`);
      }

      const data = await resp.json();
      return data.order;
    },

    async getOrder(orderId) {
      const token = sessionStorage.getItem(AUTH_TOKEN_KEY);
      const headers = {};
      if (token) headers.Authorization = `Bearer ${token}`;

      const resp = await fetch(
        `${API_ORIGIN}/orders/${encodeURIComponent(orderId)}`,
        { headers },
      );
      if (!resp.ok) {
        throw new Error(`Order fetch failed: ${resp.status}`);
      }
      const data = await resp.json();
      return data.order;
    },

    // Auth

    async login(email) {
      const resp = await fetch(`${API_ORIGIN}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      if (!resp.ok) {
        const err = await resp.json().catch(() => ({}));
        throw new Error(err.message || `Login failed: ${resp.status}`);
      }
      return resp.json();
    },

    async verifyCode(email, code, hash, exp) {
      const resp = await fetch(`${API_ORIGIN}/auth/callback`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email, code, hash, exp,
        }),
      });
      if (!resp.ok) {
        const err = await resp.json().catch(() => ({}));
        throw new Error(err.message || `Verification failed: ${resp.status}`);
      }
      const data = await resp.json();
      if (data.token) {
        sessionStorage.setItem(AUTH_TOKEN_KEY, data.token);
      }
      localStorage.setItem(AUTH_USER_KEY, JSON.stringify({
        email: data.email,
        roles: data.roles,
      }));
      return data;
    },

    async logout() {
      const token = sessionStorage.getItem(AUTH_TOKEN_KEY);
      try {
        await fetch(`${API_ORIGIN}/auth/logout`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
        });
      } catch { /* best-effort */ }
      sessionStorage.removeItem(AUTH_TOKEN_KEY);
      localStorage.removeItem(AUTH_USER_KEY);
    },

    isLoggedIn() {
      return !!sessionStorage.getItem(AUTH_TOKEN_KEY);
    },

    getCustomer() {
      const raw = localStorage.getItem(AUTH_USER_KEY);
      if (!raw) return null;
      try { return JSON.parse(raw); } catch { return null; }
    },

    async getCustomerProfile() {
      const user = this.getCustomer();
      if (!user?.email) return null;
      const resp = await authFetch(
        `${API_ORIGIN}/customers/${encodeURIComponent(user.email)}`,
      );
      if (!resp.ok) return null;
      const data = await resp.json();
      return data.customer || data;
    },

    async getOrders() {
      const user = this.getCustomer();
      if (!user?.email) return [];
      const resp = await authFetch(
        `${API_ORIGIN}/customers/${encodeURIComponent(user.email)}/orders`,
      );
      if (!resp.ok) return [];
      const data = await resp.json();
      return data.orders || [];
    },
  };
}
