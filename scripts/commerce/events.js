/**
 * Standard commerce event names.
 * @enum {string}
 */
export const EVENTS = {
  CART_UPDATED: 'commerce:cart-updated',
  CART_EMPTY: 'commerce:cart-empty',
  ORDER_CREATED: 'commerce:order-created',
};

/**
 * Dispatches a commerce CustomEvent on document.
 * Automatically fires CART_EMPTY when cart item count reaches zero.
 * @param {string} name - Event name from EVENTS
 * @param {Object} detail - Event detail payload
 */
export function dispatch(name, detail) {
  document.dispatchEvent(new CustomEvent(name, { detail }));

  if (name === EVENTS.CART_UPDATED && detail.cart?.itemCount === 0) {
    document.dispatchEvent(new CustomEvent(EVENTS.CART_EMPTY, { detail }));
  }
}

/**
 * Registers a listener for a commerce event.
 * @param {string} name - Event name from EVENTS
 * @param {Function} callback - Handler receiving the CustomEvent
 * @returns {Function} Unsubscribe function
 */
export function listen(name, callback) {
  document.addEventListener(name, callback);
  return () => document.removeEventListener(name, callback);
}
