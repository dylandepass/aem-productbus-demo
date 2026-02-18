/**
 * Order confirmation block.
 * Shown after a successful Stripe Checkout redirect.
 * Fetches session details from the worker and displays payment status.
 */

import { commerce } from '../../scripts/commerce/api.js';

const API_ORIGIN = 'https://aem-productbus-demo-worker.adobeaem.workers.dev';

function formatPrice(amount, currency = 'usd') {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: currency.toUpperCase(),
  }).format(amount / 100);
}

function showSuccess(block, session) {
  const email = session.customer_email || '';
  const total = session.amount_total || 0;
  const currency = session.currency || 'usd';

  block.innerHTML = `
    <div class="order-confirmation-content">
      <div class="order-confirmation-icon">&#10003;</div>
      <h2>Payment successful</h2>
      <p class="order-confirmation-total">${formatPrice(total, currency)}</p>
      <p>We've sent a confirmation to <strong>${email}</strong>.</p>
      <p class="order-confirmation-note">Your order is being processed.</p>
      <a href="/" class="order-confirmation-continue">Continue Shopping</a>
    </div>
  `;
}

function showError(block, message) {
  block.innerHTML = `
    <div class="order-confirmation-content">
      <div class="order-confirmation-icon order-confirmation-icon-error">!</div>
      <h2>${message}</h2>
      <a href="/" class="order-confirmation-continue">Continue Shopping</a>
    </div>
  `;
}

export default async function decorate(block) {
  block.textContent = '';

  const params = new URLSearchParams(window.location.search);
  const sessionId = params.get('session_id');

  if (!sessionId) {
    showError(block, 'Order not found');
    return;
  }

  // Show loading state
  block.innerHTML = '<div class="order-confirmation-content"><p>Loading order details…</p></div>';

  try {
    const resp = await fetch(`${API_ORIGIN}/checkout/session?id=${encodeURIComponent(sessionId)}`);
    if (!resp.ok) throw new Error('Failed to fetch session');

    const session = await resp.json();

    if (session.payment_status === 'paid') {
      showSuccess(block, session);
      await commerce.clearCart();
    } else {
      showError(block, 'Payment not completed');
    }
  } catch {
    showError(block, 'Unable to verify payment');
  }
}
