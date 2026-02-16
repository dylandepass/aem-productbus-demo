/**
 * Commerce API — the single public interface for all commerce operations.
 *
 * UI blocks import { commerce } from this module. The active adapter
 * (mock, edge, shopify, etc.) is resolved at runtime and lazy-loaded
 * on first call.
 *
 * @module commerce/api
 */

import { EVENTS, dispatch, listen } from './events.js';

/**
 * Default adapter. Change this to switch backends site-wide.
 * Valid values: 'mock', 'edge'
 * @type {string}
 */
const ADAPTER = 'edge';

/** @type {Object|null} Cached adapter instance */
let adapter = null;

/** @type {Promise<Object>|null} In-flight adapter loading promise */
let loading = null;

/**
 * Resolves the adapter name from localStorage override or default constant.
 * @returns {string}
 */
function getAdapterName() {
  return localStorage.getItem('commerce-adapter') || ADAPTER;
}

/**
 * Lazy-loads and caches the configured adapter.
 * @returns {Promise<Object>} The adapter instance
 */
async function loadAdapter() {
  if (adapter) return adapter;
  if (loading) return loading;

  const name = getAdapterName();
  loading = import(`./adapters/${name}.js`).then((mod) => {
    adapter = mod.default();
    loading = null;
    return adapter;
  });

  return loading;
}

/**
 * Public commerce API.
 *
 * Every method lazy-loads the adapter on first call. Cart-mutating methods
 * dispatch standardized events after the adapter completes its work.
 */
/* eslint-disable import/prefer-default-export -- single named export is the public API */
export const commerce = {
  // --- Cart ---

  async addToCart(item) {
    const a = await loadAdapter();
    const cart = await a.addToCart(item);
    dispatch(EVENTS.CART_UPDATED, { cart, item, action: 'add' });
    return cart;
  },

  async getCart() {
    const a = await loadAdapter();
    return a.getCart();
  },

  async updateItemQuantity(sku, quantity) {
    const a = await loadAdapter();
    const cart = await a.updateItemQuantity(sku, quantity);
    dispatch(EVENTS.CART_UPDATED, {
      cart, sku, quantity, action: 'update',
    });
    return cart;
  },

  async removeItem(sku) {
    const a = await loadAdapter();
    const cart = await a.removeItem(sku);
    dispatch(EVENTS.CART_UPDATED, { cart, sku, action: 'remove' });
    return cart;
  },

  async clearCart() {
    const a = await loadAdapter();
    await a.clearCart();
    const empty = {
      items: [], itemCount: 0, subtotal: 0, shipping: 0,
    };
    dispatch(EVENTS.CART_UPDATED, { cart: empty, action: 'clear' });
  },

  // --- Orders ---

  async createOrder({ customer, shipping }) {
    const a = await loadAdapter();
    const order = await a.createOrder({ customer, shipping });
    dispatch(EVENTS.ORDER_CREATED, { order });
    return order;
  },

  async getOrder(orderId) {
    const a = await loadAdapter();
    return a.getOrder(orderId);
  },

  // --- Auth ---

  async login(email) {
    const a = await loadAdapter();
    return a.login(email);
  },

  async verifyCode(email, code, hash, exp) {
    const a = await loadAdapter();
    const result = await a.verifyCode(email, code, hash, exp);
    dispatch(EVENTS.AUTH_STATE_CHANGED, { loggedIn: true, email: result.email });
    return result;
  },

  async logout() {
    const a = await loadAdapter();
    await a.logout();
    dispatch(EVENTS.AUTH_STATE_CHANGED, { loggedIn: false, email: null });
  },

  async isLoggedIn() {
    const a = await loadAdapter();
    return a.isLoggedIn();
  },

  async getCustomer() {
    const a = await loadAdapter();
    return a.getCustomer();
  },

  async getCustomerProfile() {
    const a = await loadAdapter();
    return a.getCustomerProfile();
  },

  async getOrders() {
    const a = await loadAdapter();
    return a.getOrders();
  },

  // --- Events ---

  EVENTS,
  on: listen,
};
