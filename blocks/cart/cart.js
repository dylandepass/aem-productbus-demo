/**
 * Cart block — single-page cart + checkout form.
 * Items on the left, checkout form on the right.
 */

import { commerce } from '../../scripts/commerce/api.js';

function formatPrice(value) {
  return `$${Number(value).toFixed(2)}`;
}

// --- Cart items rendering ---

function buildLineItem(item) {
  const row = document.createElement('div');
  row.className = 'cart-line-item';
  row.dataset.sku = item.sku;

  row.innerHTML = `
    <img class="cart-item-image" src="${item.image || ''}" alt="${item.name || ''}" loading="lazy" width="80" height="80">
    <div class="cart-item-info">
      <a class="cart-item-name" href="${item.url || '#'}">${item.name || item.sku}</a>
      <span class="cart-item-sku">${item.sku}</span>
      <span class="cart-item-price">${formatPrice(item.price)}</span>
    </div>
    <div class="cart-item-actions">
      <div class="cart-item-qty">
        <button class="cart-qty-btn cart-qty-minus" aria-label="Decrease quantity">&minus;</button>
        <input class="cart-qty-input" type="number" min="1" max="99" value="${item.quantity}" aria-label="Quantity">
        <button class="cart-qty-btn cart-qty-plus" aria-label="Increase quantity">&plus;</button>
      </div>
      <span class="cart-item-total">${formatPrice(item.price * item.quantity)}</span>
    </div>
    <button class="cart-item-remove" aria-label="Remove ${item.name || item.sku}">&times;</button>
  `;

  const input = row.querySelector('.cart-qty-input');

  row.querySelector('.cart-qty-minus').addEventListener('click', () => {
    const newQty = item.quantity - 1;
    if (newQty <= 0) {
      commerce.removeItem(item.sku);
    } else {
      commerce.updateItemQuantity(item.sku, newQty);
    }
  });

  row.querySelector('.cart-qty-plus').addEventListener('click', () => {
    commerce.updateItemQuantity(item.sku, item.quantity + 1);
  });

  input.addEventListener('change', () => {
    const val = parseInt(input.value, 10);
    if (val <= 0 || Number.isNaN(val)) {
      commerce.removeItem(item.sku);
    } else {
      commerce.updateItemQuantity(item.sku, val);
    }
  });

  row.querySelector('.cart-item-remove').addEventListener('click', () => {
    commerce.removeItem(item.sku);
  });

  return row;
}

function renderCartItems(container, cart) {
  const list = container.querySelector('.cart-items-list');
  const empty = container.querySelector('.cart-empty');
  list.innerHTML = '';

  if (!cart || cart.itemCount === 0) {
    list.style.display = 'none';
    empty.style.display = '';
    return;
  }

  list.style.display = '';
  empty.style.display = 'none';
  cart.items.forEach((item) => list.append(buildLineItem(item)));
}

function updateSummary(container, cart) {
  const subtotalEl = container.querySelector('.cart-summary-subtotal');
  const shippingEl = container.querySelector('.cart-summary-shipping');
  const totalEl = container.querySelector('.cart-summary-total-value');

  const subtotal = cart?.subtotal || 0;
  const shipping = cart?.shipping || 0;
  const total = subtotal + shipping;

  if (subtotalEl) subtotalEl.textContent = formatPrice(subtotal);
  if (shippingEl) shippingEl.textContent = shipping === 0 ? 'Free' : formatPrice(shipping);
  if (totalEl) totalEl.textContent = formatPrice(total);
}

// --- Checkout form ---

function buildCheckoutForm() {
  const section = document.createElement('div');
  section.className = 'cart-checkout-section';

  section.innerHTML = `
    <div class="cart-contact">
      <h3>Contact</h3>
      <input type="email" class="cart-input" placeholder="Email address" autocomplete="email">
      <label class="cart-create-account-label">
        <input type="checkbox" class="cart-create-account-check">
        <span>Create an account</span>
      </label>
    </div>

    <div class="cart-shipping">
      <h3>Shipping address</h3>
      <div class="cart-form-row">
        <input type="text" class="cart-input" placeholder="First name" autocomplete="given-name">
        <input type="text" class="cart-input" placeholder="Last name" autocomplete="family-name">
      </div>
      <input type="text" class="cart-input" placeholder="Address" autocomplete="address-line1">
      <input type="text" class="cart-input" placeholder="Apartment, suite, etc. (optional)" autocomplete="address-line2">
      <div class="cart-form-row">
        <input type="text" class="cart-input" placeholder="City" autocomplete="address-level2">
        <input type="text" class="cart-input" placeholder="State / Province" autocomplete="address-level1">
      </div>
      <div class="cart-form-row">
        <input type="text" class="cart-input" placeholder="ZIP / Postal code" autocomplete="postal-code">
        <select class="cart-input" autocomplete="country">
          <option value="">Country</option>
          <option value="US" selected>United States</option>
          <option value="CA">Canada</option>
          <option value="GB">United Kingdom</option>
          <option value="AU">Australia</option>
          <option value="DE">Germany</option>
          <option value="FR">France</option>
          <option value="JP">Japan</option>
        </select>
      </div>
    </div>

    <div class="cart-summary">
      <h3>Order summary</h3>
      <div class="cart-summary-row">
        <span>Subtotal</span>
        <span class="cart-summary-subtotal">$0.00</span>
      </div>
      <div class="cart-summary-row">
        <span>Shipping</span>
        <span class="cart-summary-shipping">Free</span>
      </div>
      <div class="cart-summary-row cart-summary-total">
        <span>Total</span>
        <span class="cart-summary-total-value">$0.00</span>
      </div>
      <button class="cart-checkout-btn" type="button">Place Order</button>
      <p class="cart-checkout-note"></p>
    </div>
  `;

  // place order
  const placeBtn = section.querySelector('.cart-checkout-btn');
  placeBtn.addEventListener('click', async () => {
    // basic validation
    const email = section.querySelector('[autocomplete="email"]').value.trim();
    const firstName = section.querySelector('[autocomplete="given-name"]').value.trim();
    const lastName = section.querySelector('[autocomplete="family-name"]').value.trim();
    const address = section.querySelector('[autocomplete="address-line1"]').value.trim();
    const address2 = section.querySelector('[autocomplete="address-line2"]').value.trim();
    const city = section.querySelector('[autocomplete="address-level2"]').value.trim();
    const state = section.querySelector('[autocomplete="address-level1"]').value.trim();
    const zip = section.querySelector('[autocomplete="postal-code"]').value.trim();
    const country = section.querySelector('[autocomplete="country"]').value;

    if (!email || !firstName || !lastName || !address || !city || !state || !zip || !country) {
      // highlight empty required fields
      section.querySelectorAll('.cart-input').forEach((input) => {
        if (input.matches('[autocomplete="address-line2"]')) return; // optional
        if (!input.value.trim()) {
          input.classList.add('cart-input-error');
          input.addEventListener('input', () => input.classList.remove('cart-input-error'), { once: true });
        }
      });
      return;
    }

    placeBtn.disabled = true;
    placeBtn.textContent = 'Placing order…';

    try {
      const order = await commerce.createOrder({
        customer: { email, firstName, lastName },
        shipping: {
          name: `${firstName} ${lastName}`,
          email,
          address1: address,
          address2,
          city,
          state,
          zip,
          country,
        },
      });

      await commerce.clearCart();
      showOrderConfirmation(section.closest('.cart-layout'), order, email);
    } catch (err) {
      placeBtn.disabled = false;
      placeBtn.textContent = 'Place Order';
      const note = section.querySelector('.cart-checkout-note');
      note.textContent = `Order failed: ${err.message}`;
      note.classList.add('cart-checkout-error');
    }
  });

  return section;
}

// --- Order confirmation ---

function showOrderConfirmation(wrapper, order, email) {
  wrapper.innerHTML = '';
  wrapper.style.gridTemplateColumns = '1fr';

  const confirmation = document.createElement('div');
  confirmation.className = 'cart-confirmation';

  const orderId = order?.id || order?.orderId || 'N/A';

  confirmation.innerHTML = `
    <div class="cart-confirmation-icon">&#10003;</div>
    <h2>Order confirmed</h2>
    <p class="cart-confirmation-id">Order #${orderId}</p>
    <p>We've sent a confirmation to <strong>${email}</strong>.</p>
    <a href="/" class="cart-continue-shopping">Continue Shopping</a>
  `;

  wrapper.append(confirmation);
}

// --- Block entry point ---

export default async function decorate(block) {
  block.textContent = '';

  const wrapper = document.createElement('div');
  wrapper.className = 'cart-layout';

  // items section
  const itemsSection = document.createElement('div');
  itemsSection.className = 'cart-items-section';
  itemsSection.innerHTML = `
    <h2>Shopping Cart</h2>
    <div class="cart-items-list"></div>
    <div class="cart-empty">
      <p>Your cart is empty</p>
      <a href="/" class="cart-continue-shopping">Continue Shopping</a>
    </div>
  `;

  // checkout section
  const checkoutSection = buildCheckoutForm();

  wrapper.append(itemsSection, checkoutSection);
  block.append(wrapper);

  // initial render
  const cart = await commerce.getCart();
  renderCartItems(itemsSection, cart);
  updateSummary(checkoutSection, cart);

  // listen for updates
  commerce.on(commerce.EVENTS.CART_UPDATED, (e) => {
    const updatedCart = e.detail.cart;
    renderCartItems(itemsSection, updatedCart);
    updateSummary(checkoutSection, updatedCart);
  });
}
