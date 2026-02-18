/**
 * Cart block — single-page cart + checkout form.
 * Items on the left, checkout form on the right.
 */

import { commerce } from '../../scripts/commerce/api.js';

const PLACES_API = 'https://aem-productbus-demo-worker.adobeaem.workers.dev/places';

function formatPrice(value) {
  return `$${Number(value).toFixed(2)}`;
}

// --- Form validation ---

function clearFieldError(input) {
  input.classList.remove('cart-input-error');
  const existing = input.parentElement.querySelector('.cart-field-error');
  if (existing) existing.remove();
}

function showFieldError(input, message) {
  input.classList.add('cart-input-error');
  const existing = input.parentElement.querySelector('.cart-field-error');
  if (existing) existing.remove();
  const span = document.createElement('span');
  span.className = 'cart-field-error';
  span.textContent = message;
  input.insertAdjacentElement('afterend', span);
  input.addEventListener('input', () => clearFieldError(input), { once: true });
  input.addEventListener('change', () => clearFieldError(input), { once: true });
}

function validateForm(section) {
  const requiredInputs = section.querySelectorAll('.cart-input[required]');
  let firstInvalid = null;

  requiredInputs.forEach((input) => {
    clearFieldError(input);
    if (!input.checkValidity()) {
      const msg = input.validationMessage || 'This field is required';
      showFieldError(input, msg);
      if (!firstInvalid) firstInvalid = input;
    }
  });

  if (firstInvalid) {
    firstInvalid.scrollIntoView({ behavior: 'smooth', block: 'center' });
    firstInvalid.focus();
    return false;
  }
  return true;
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

// --- Address Autocomplete (via worker proxy) ---

function fillAddressFields(section, addressInput, result) {
  const components = {};
  result.address_components.forEach((c) => {
    c.types.forEach((type) => { components[type] = c; });
  });

  // Street address
  const streetNumber = components.street_number?.long_name || '';
  const route = components.route?.long_name || '';
  addressInput.value = `${streetNumber} ${route}`.trim();

  // Subpremise → address2
  const address2Input = section.querySelector('[autocomplete="address-line2"]');
  if (address2Input && components.subpremise) {
    address2Input.value = components.subpremise.long_name;
  }

  // City
  const cityInput = section.querySelector('[autocomplete="address-level2"]');
  if (cityInput) {
    cityInput.value = (components.locality || components.sublocality || components.postal_town)?.long_name || '';
  }

  // State
  const stateInput = section.querySelector('[autocomplete="address-level1"]');
  if (stateInput) {
    stateInput.value = components.administrative_area_level_1?.short_name || '';
  }

  // ZIP
  const zipInput = section.querySelector('[autocomplete="postal-code"]');
  if (zipInput) {
    zipInput.value = components.postal_code?.long_name || '';
  }

  // Country
  const countrySelect = section.querySelector('[autocomplete="country"]');
  if (countrySelect && components.country) {
    const code = components.country.short_name;
    const option = countrySelect.querySelector(`option[value="${code}"]`);
    if (option) countrySelect.value = code;
  }

  // Clear validation errors on auto-filled fields
  section.querySelectorAll('.cart-input').forEach((input) => {
    if (input.value && input !== addressInput) {
      clearFieldError(input);
    }
  });
  clearFieldError(addressInput);
}

function initAddressAutocomplete(section) {
  const addressInput = section.querySelector('[autocomplete="address-line1"]');
  if (!addressInput) return;

  // Wrap input in a relative container for dropdown positioning
  const wrapper = document.createElement('div');
  wrapper.classList.add('places-autocomplete-wrapper');
  addressInput.parentElement.insertBefore(wrapper, addressInput);
  wrapper.append(addressInput);

  // Disable browser autocomplete to avoid duplicate popups
  addressInput.setAttribute('autocomplete', 'off');

  const sessiontoken = crypto.randomUUID();
  let debounceTimer;
  let dropdown;

  function removeDropdown() {
    if (dropdown) { dropdown.remove(); dropdown = null; }
  }

  function showDropdown(predictions) {
    removeDropdown();
    if (!predictions.length) return;

    dropdown = document.createElement('ul');
    dropdown.classList.add('places-autocomplete-dropdown');

    predictions.forEach((p) => {
      const li = document.createElement('li');
      li.textContent = p.description;
      li.addEventListener('mousedown', async (e) => {
        e.preventDefault();
        addressInput.value = p.description;
        removeDropdown();

        try {
          const params = new URLSearchParams({
            place_id: p.place_id,
            sessiontoken,
          });
          const resp = await fetch(`${PLACES_API}/details?${params}`);
          if (!resp.ok) return;
          const data = await resp.json();
          if (data.result?.address_components) {
            fillAddressFields(section, addressInput, data.result);
          }
        } catch { /* silent */ }
      });
      dropdown.append(li);
    });

    wrapper.append(dropdown);
  }

  addressInput.addEventListener('input', () => {
    clearTimeout(debounceTimer);
    const { value } = addressInput;
    if (value.length < 3) { removeDropdown(); return; }

    debounceTimer = setTimeout(async () => {
      try {
        const params = new URLSearchParams({ input: value, sessiontoken });
        const resp = await fetch(`${PLACES_API}/autocomplete?${params}`);
        if (!resp.ok) return;
        const data = await resp.json();
        showDropdown(data.predictions || []);
      } catch { /* silent */ }
    }, 300);
  });

  addressInput.addEventListener('blur', () => {
    setTimeout(removeDropdown, 200);
  });
}

// --- Address picker ---

function fillShippingForm(section, addr) {
  const [first, ...rest] = (addr.name || '').split(' ');
  const fields = {
    firstName: first || '',
    lastName: rest.join(' ') || '',
    address1: addr.address1 || '',
    address2: addr.address2 || '',
    city: addr.city || '',
    state: addr.state || '',
    zip: addr.zip || '',
    country: addr.country || '',
    email: addr.email || '',
  };
  Object.entries(fields).forEach(([name, value]) => {
    const el = section.querySelector(`[name="${name}"]`);
    if (el) {
      el.value = value;
      clearFieldError(el);
    }
  });
}

function showAddressPicker(section, addresses) {
  const overlay = document.createElement('div');
  overlay.className = 'cart-address-overlay';

  const modal = document.createElement('div');
  modal.className = 'cart-address-modal';

  const header = document.createElement('div');
  header.className = 'cart-address-modal-header';
  header.innerHTML = '<h3>Select address</h3><button class="cart-address-modal-close" aria-label="Close">&times;</button>';

  const list = document.createElement('div');
  list.className = 'cart-address-modal-list';

  function close() {
    overlay.remove();
    modal.remove();
    document.body.style.overflow = '';
  }

  addresses.forEach((addr) => {
    const card = document.createElement('button');
    card.type = 'button';
    card.className = 'cart-address-option';

    const parts = [addr.address1];
    if (addr.address2) parts.push(addr.address2);
    const cityLine = [addr.city, addr.state, addr.zip]
      .filter(Boolean).join(', ');

    card.innerHTML = `
      <p class="cart-address-option-name">${addr.name || ''}</p>
      <p>${parts.join(', ')}</p>
      <p>${cityLine}</p>
      <p>${addr.country || ''}</p>
    `;

    card.addEventListener('click', () => {
      fillShippingForm(section, addr);
      close();
    });
    list.append(card);
  });

  modal.append(header, list);
  document.body.append(overlay, modal);
  document.body.style.overflow = 'hidden';

  overlay.addEventListener('click', close);
  header.querySelector('.cart-address-modal-close')
    .addEventListener('click', close);
  window.addEventListener('keydown', function onKey(e) {
    if (e.key === 'Escape') {
      close();
      window.removeEventListener('keydown', onKey);
    }
  });
}

// --- Checkout form ---

function buildCheckoutForm() {
  const section = document.createElement('div');
  section.className = 'cart-checkout-section';

  section.innerHTML = `
    <div class="cart-contact">
      <h3>Contact</h3>
      <input type="email" class="cart-input" name="email" placeholder="Email address" autocomplete="email" required>
      <p class="cart-signin-prompt">Already have an account? <a href="#" class="cart-signin-link">Sign in</a></p>
    </div>

    <div class="cart-shipping">
      <div class="cart-shipping-header">
        <h3>Shipping address</h3>
        <button type="button" class="cart-change-address-btn" style="display:none">Change</button>
      </div>
      <div class="cart-form-row">
        <input type="text" class="cart-input" name="firstName" placeholder="First name" autocomplete="given-name" required minlength="2">
        <input type="text" class="cart-input" name="lastName" placeholder="Last name" autocomplete="family-name" required minlength="2">
      </div>
      <input type="text" class="cart-input" name="address1" placeholder="Address" autocomplete="address-line1" required>
      <input type="text" class="cart-input" name="address2" placeholder="Apartment, suite, etc. (optional)" autocomplete="address-line2">
      <div class="cart-form-row">
        <input type="text" class="cart-input" name="city" placeholder="City" autocomplete="address-level2" required>
        <input type="text" class="cart-input" name="state" placeholder="State / Province" autocomplete="address-level1" required>
      </div>
      <div class="cart-form-row">
        <input type="text" class="cart-input" name="zip" placeholder="ZIP / Postal code" autocomplete="postal-code" required pattern="[0-9a-zA-Z\\x20\\x2d]{3,10}" title="Enter a valid postal code">
        <select class="cart-input" name="country" autocomplete="country" required>
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
      <button class="cart-checkout-btn" type="button">Pay Now</button>
      <p class="cart-checkout-note"></p>
    </div>
  `;

  // place order
  const placeBtn = section.querySelector('.cart-checkout-btn');
  placeBtn.addEventListener('click', async () => {
    if (!validateForm(section)) return;

    const email = section.querySelector('[name="email"]').value.trim();
    const firstName = section.querySelector('[name="firstName"]').value.trim();
    const lastName = section.querySelector('[name="lastName"]').value.trim();
    const address = section.querySelector('[name="address1"]').value.trim();
    const address2 = section.querySelector('[name="address2"]').value.trim();
    const city = section.querySelector('[name="city"]').value.trim();
    const state = section.querySelector('[name="state"]').value.trim();
    const zip = section.querySelector('[name="zip"]').value.trim();
    const country = section.querySelector('[name="country"]').value;

    placeBtn.disabled = true;
    placeBtn.textContent = 'Redirecting to payment…';

    try {
      const { url } = await commerce.createCheckoutSession({
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

      window.location.href = url;
    } catch (err) {
      placeBtn.disabled = false;
      placeBtn.textContent = 'Pay Now';
      const note = section.querySelector('.cart-checkout-note');
      note.textContent = `Checkout failed: ${err.message}`;
      note.classList.add('cart-checkout-error');
    }
  });

  // --- Address Autocomplete (via worker proxy) ---
  initAddressAutocomplete(section);

  // --- Sign-in link ---
  const signinLink = section.querySelector('.cart-signin-link');
  signinLink.addEventListener('click', (e) => {
    e.preventDefault();
    document.dispatchEvent(new CustomEvent('commerce:open-auth-panel'));
  });

  // --- Auto-fill from logged-in customer profile and saved addresses ---
  async function applyLoggedInState() {
    section.querySelector('.cart-signin-prompt').style.display = 'none';
    const customer = await commerce.getCustomerProfile();
    const user = await commerce.getCustomer();
    const addresses = await commerce.getAddresses();
    const addr = addresses?.[0];

    // Pre-fill email from profile
    const emailEl = section.querySelector('[name="email"]');
    const email = customer?.email || user?.email;
    if (emailEl && email) {
      emailEl.value = email;
      clearFieldError(emailEl);
    }

    // Pre-fill from first address or customer profile
    if (addr) {
      fillShippingForm(section, addr);
    } else {
      const fields = {
        firstName: customer?.firstName,
        lastName: customer?.lastName,
      };
      Object.entries(fields).forEach(([name, value]) => {
        if (!value) return;
        const el = section.querySelector(`[name="${name}"]`);
        if (el && !el.value) {
          el.value = value;
          clearFieldError(el);
        }
      });
    }

    // Show "Change" button if user has multiple addresses
    if (addresses.length > 1) {
      const changeBtn = section.querySelector('.cart-change-address-btn');
      changeBtn.style.display = '';
      changeBtn.addEventListener('click', () => {
        showAddressPicker(section, addresses);
      });
    }
  }

  (async () => {
    try {
      if (await commerce.isLoggedIn()) await applyLoggedInState();
    } catch { /* silent — form works without pre-fill */ }
  })();

  // Update form when user signs in from the cart page
  document.addEventListener('commerce:auth-state-changed', async (e) => {
    if (e.detail?.loggedIn) {
      try { await applyLoggedInState(); } catch { /* silent */ }
    }
  });

  return section;
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

  function updateLayout(c) {
    const empty = !c || c.itemCount === 0;
    checkoutSection.style.display = empty ? 'none' : '';
    wrapper.classList.toggle('cart-layout-empty', empty);
  }

  // initial render
  const cart = await commerce.getCart();
  renderCartItems(itemsSection, cart);
  updateSummary(checkoutSection, cart);
  updateLayout(cart);

  // listen for updates
  commerce.on(commerce.EVENTS.CART_UPDATED, (e) => {
    const updatedCart = e.detail.cart;
    renderCartItems(itemsSection, updatedCart);
    updateSummary(checkoutSection, updatedCart);
    updateLayout(updatedCart);
  });
}
