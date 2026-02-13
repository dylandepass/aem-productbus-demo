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
        items: cart.items.map((item) => ({
          sku: item.sku,
          urlKey: (item.url || '').split('/').pop() || '',
          name: item.name,
          quantity: item.quantity,
          price: {
            currency: item.currency || 'USD',
            final: String(item.price),
          },
        })),
      };

      const resp = await fetch(`${API_ORIGIN}/orders`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (!resp.ok) {
        throw new Error(`Order creation failed: ${resp.status}`);
      }

      const data = await resp.json();
      return data.order;
    },

    async getOrder(orderId, email) {
      const resp = await fetch(
        `${API_ORIGIN}/orders/${encodeURIComponent(orderId)}?email=${encodeURIComponent(email)}`,
      );
      if (!resp.ok) {
        throw new Error(`Order fetch failed: ${resp.status}`);
      }
      const data = await resp.json();
      return data.order;
    },

    // Auth (edge mode has no auth)

    isLoggedIn() { return false; },
    getCustomer() { return null; },
  };
}
