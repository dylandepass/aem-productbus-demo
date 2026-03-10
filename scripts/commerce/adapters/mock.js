/**
 * Mock commerce adapter.
 * Client-side cart persisted to localStorage, no network calls.
 * Useful for UI development and testing without a backend.
 */

const STORAGE_KEY = 'mock-cart';

let items = {};
let orderCounter = 0;
const orders = {};

function save() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(Object.values(items)));
}

function restore() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return;
    const parsed = JSON.parse(raw);
    items = (parsed || []).reduce((acc, item) => {
      acc[item.sku] = item;
      return acc;
    }, {});
  } catch {
    localStorage.removeItem(STORAGE_KEY);
  }
}

function buildCart() {
  const allItems = Object.values(items);
  const subtotal = allItems.reduce((sum, i) => sum + i.quantity * i.price, 0);
  return {
    items: allItems,
    itemCount: allItems.reduce((sum, i) => sum + i.quantity, 0),
    subtotal,
    shipping: 0,
  };
}

// restore on module load
restore();

export default function createMockAdapter() {
  return {
    async addToCart(item) {
      // eslint-disable-next-line no-console
      console.log('[mock] addToCart', item);
      const existing = items[item.sku];
      if (existing) {
        existing.quantity += item.quantity;
      } else {
        items[item.sku] = { ...item };
      }
      save();
      return buildCart();
    },

    async getCart() {
      return buildCart();
    },

    async updateItemQuantity(sku, quantity) {
      // eslint-disable-next-line no-console
      console.log('[mock] updateItemQuantity', sku, quantity);
      if (quantity <= 0) {
        delete items[sku];
      } else if (items[sku]) {
        items[sku].quantity = quantity;
      }
      save();
      return buildCart();
    },

    async removeItem(sku) {
      // eslint-disable-next-line no-console
      console.log('[mock] removeItem', sku);
      delete items[sku];
      save();
      return buildCart();
    },

    async clearCart() {
      // eslint-disable-next-line no-console
      console.log('[mock] clearCart');
      items = {};
      save();
    },

    async createPayPalOrder({ customer, shipping }) {
      // eslint-disable-next-line no-console
      console.log('[mock] createPayPalOrder', { customer, shipping });
      orderCounter += 1;
      return { id: `mock-paypal-${orderCounter}` };
    },

    async capturePayPalOrder(orderId, { customer, shipping }) {
      // eslint-disable-next-line no-console
      console.log('[mock] capturePayPalOrder', { orderId, customer, shipping });
      return {
        status: 'COMPLETED',
        paypal_order_id: orderId,
        customer_email: customer.email,
        amount_total: 0,
        currency: 'usd',
      };
    },

    async createStripePaymentIntent() {
      // eslint-disable-next-line no-console
      console.log('[mock] createStripePaymentIntent');
      orderCounter += 1;
      return { clientSecret: `mock_secret_${orderCounter}`, id: `mock_pi_${orderCounter}` };
    },

    async captureStripePaymentIntent(id, { customer, shipping }) {
      // eslint-disable-next-line no-console
      console.log('[mock] captureStripePaymentIntent', { id, customer, shipping });
      return {
        status: 'succeeded',
        payment_intent_id: id,
        customer_email: customer.email,
        amount_total: 0,
        currency: 'usd',
      };
    },

    async createOrder({ customer, shipping }) {
      // eslint-disable-next-line no-console
      console.log('[mock] createOrder', { customer, shipping, items: Object.values(items) });
      orderCounter += 1;

      const orderItems = Object.values(items).map((item) => {
        let image = '';
        if (item.image) {
          try { image = new URL(item.image).pathname; } catch { image = item.image; }
        }
        return {
          sku: item.sku,
          path: (item.url || '').split('/').pop() || '',
          name: item.name,
          quantity: item.quantity,
          price: {
            currency: item.currency || 'USD',
            final: String(item.price),
          },
          custom: { image, url: item.url || '' },
        };
      });

      const order = {
        id: `mock-${orderCounter}`,
        customer,
        shipping,
        items: orderItems,
        state: 'completed',
        createdAt: new Date().toISOString(),
      };
      orders[order.id] = order;
      return order;
    },

    async getOrder(orderId) {
      return orders[orderId] || null;
    },

    isLoggedIn() { return false; },
    getCustomer() { return null; },
  };
}
