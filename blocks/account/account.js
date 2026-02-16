/**
 * Account block — customer profile and order history.
 * Requires login; shows login prompt if not authenticated.
 */

import { commerce } from '../../scripts/commerce/api.js';

function formatPrice(value, currency = 'USD') {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(value);
}

function formatDate(iso) {
  return new Date(iso).toLocaleDateString('en-US', {
    year: 'numeric', month: 'short', day: 'numeric',
  });
}

function renderProfile(container, customer) {
  const name = [customer.firstName, customer.lastName].filter(Boolean).join(' ');
  container.innerHTML = `
    <div class="account-profile">
      <h2>My account</h2>
      <div class="account-details">
        ${name ? `<p class="account-name">${name}</p>` : ''}
        <p class="account-email">${customer.email}</p>
        ${customer.phone ? `<p class="account-phone">${customer.phone}</p>` : ''}
      </div>
      <button class="account-logout-btn" type="button">Sign out</button>
    </div>
  `;

  container.querySelector('.account-logout-btn').addEventListener('click', async () => {
    await commerce.logout();
    window.location.href = '/';
  });
}

function renderLineItem(item) {
  const image = item.custom?.image || '';
  const href = item.custom?.url || '';
  const unitPrice = parseFloat(item.price?.final || 0);
  const lineTotal = item.quantity * unitPrice;
  const currency = item.price?.currency || 'USD';

  const nameEl = href
    ? `<a class="order-item-name" href="${href}">${item.name || item.sku}</a>`
    : `<span class="order-item-name">${item.name || item.sku}</span>`;

  return `
    <div class="order-line-item">
      <img class="order-item-image" src="${image || '/icons/placeholder.png'}" alt="${item.name || item.sku}" loading="lazy" width="60" height="60">
      <div class="order-item-info">
        ${nameEl}
        <span class="order-item-sku">${item.sku}</span>
      </div>
      <div class="order-item-pricing">
        <span class="order-item-quantity">Qty: ${item.quantity}</span>
        <span class="order-item-total">${formatPrice(lineTotal, currency)}</span>
      </div>
    </div>
  `;
}

function renderOrders(container, orders) {
  if (!orders || orders.length === 0) {
    container.innerHTML = `
      <div class="account-orders">
        <h3>Order history</h3>
        <p class="account-empty">No orders yet.</p>
      </div>
    `;
    return;
  }

  const cards = orders.map((order) => {
    const orderId = order.id || order.orderId || 'N/A';
    const status = order.state || 'completed';
    const date = order.createdAt ? formatDate(order.createdAt) : '';
    const total = order.total != null ? formatPrice(order.total) : '';

    const lineItems = (order.items || []).map(renderLineItem).join('');

    return `
      <div class="order-card">
        <div class="order-header">
          <div class="order-header-left">
            <span class="order-id">#${orderId}</span>
            ${date ? `<span class="order-date">${date}</span>` : ''}
          </div>
          <div class="order-header-right">
            <span class="order-status order-status-${status}">${status}</span>
            ${total ? `<span class="order-total">${total}</span>` : ''}
          </div>
        </div>
        <div class="order-items">${lineItems}</div>
      </div>
    `;
  }).join('');

  container.innerHTML = `
    <div class="account-orders">
      <h3>Order history</h3>
      <div class="order-list">${cards}</div>
    </div>
  `;
}

function renderLoginPrompt(container) {
  container.innerHTML = `
    <div class="account-login-prompt">
      <h2>Sign in to view your account</h2>
      <p>Access your profile and order history.</p>
      <button class="account-signin-btn" type="button">Sign in</button>
    </div>
  `;

  container.querySelector('.account-signin-btn').addEventListener('click', () => {
    document.dispatchEvent(new CustomEvent('commerce:open-auth-panel'));
  });
}

export default async function decorate(block) {
  block.textContent = '';

  const wrapper = document.createElement('div');
  wrapper.className = 'account-wrapper';

  const profileSection = document.createElement('div');
  profileSection.className = 'account-profile-section';

  const ordersSection = document.createElement('div');
  ordersSection.className = 'account-orders-section';

  wrapper.append(profileSection, ordersSection);
  block.append(wrapper);

  async function loadAccount() {
    if (!(await commerce.isLoggedIn())) {
      renderLoginPrompt(profileSection);
      ordersSection.innerHTML = '';
      return;
    }

    profileSection.innerHTML = '<p class="account-loading">Loading...</p>';

    try {
      const customer = await commerce.getCustomerProfile();

      if (!customer) {
        // Customer record may not exist yet — show basic info from stored user
        const user = await commerce.getCustomer();
        renderProfile(profileSection, { email: user?.email || '' });
      } else {
        renderProfile(profileSection, customer);
      }

      const orders = await commerce.getOrders();
      const enriched = await Promise.all(orders.map(async (order) => {
        try {
          const full = await commerce.getOrder(order.id);
          const total = (full?.items || []).reduce(
            (sum, item) => sum + (item.quantity * parseFloat(item.price?.final || 0)),
            0,
          );
          return { ...full, total };
        } catch {
          return order;
        }
      }));
      renderOrders(ordersSection, enriched);
    } catch {
      const user = await commerce.getCustomer();
      renderProfile(profileSection, { email: user?.email || '' });
      renderOrders(ordersSection, []);
    }
  }

  await loadAccount();

  commerce.on(commerce.EVENTS.AUTH_STATE_CHANGED, () => loadAccount());
}
