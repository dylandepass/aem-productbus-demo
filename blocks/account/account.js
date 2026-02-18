/**
 * Account block — customer profile, address book, and order history.
 * Requires login; shows login prompt if not authenticated.
 */

import { commerce } from '../../scripts/commerce/api.js';

const PLACES_API = 'https://aem-productbus-demo-worker.adobeaem.workers.dev/places';

function formatPrice(value, currency = 'USD') {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(value);
}

function formatDate(iso) {
  return new Date(iso).toLocaleDateString('en-US', {
    year: 'numeric', month: 'short', day: 'numeric',
  });
}

// --- Profile ---

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

// --- Addresses ---

function formatAddressLine(address) {
  const parts = [address.address1];
  if (address.address2) parts.push(address.address2);
  return parts.join(', ');
}

function formatCityLine(address) {
  return [address.city, address.state, address.zip].filter(Boolean).join(', ');
}

function renderAddressCard(address) {
  const card = document.createElement('div');
  card.className = 'address-card';
  card.dataset.addressId = address.id;

  const details = document.createElement('div');
  details.className = 'address-card-details';

  const nameLine = document.createElement('p');
  nameLine.className = 'address-card-name';
  nameLine.textContent = address.name;
  details.append(nameLine);

  if (address.company) {
    const companyLine = document.createElement('p');
    companyLine.className = 'address-card-company';
    companyLine.textContent = address.company;
    details.append(companyLine);
  }

  const streetLine = document.createElement('p');
  streetLine.textContent = formatAddressLine(address);
  details.append(streetLine);

  const cityLine = document.createElement('p');
  cityLine.textContent = formatCityLine(address);
  details.append(cityLine);

  const countryLine = document.createElement('p');
  countryLine.textContent = address.country;
  details.append(countryLine);

  if (address.phone) {
    const phoneLine = document.createElement('p');
    phoneLine.className = 'address-card-phone';
    phoneLine.textContent = address.phone;
    details.append(phoneLine);
  }

  const actions = document.createElement('div');
  actions.className = 'address-card-actions';

  const editBtn = document.createElement('button');
  editBtn.type = 'button';
  editBtn.className = 'address-edit-btn';
  editBtn.textContent = 'Edit';

  const deleteBtn = document.createElement('button');
  deleteBtn.type = 'button';
  deleteBtn.className = 'address-delete-btn';
  deleteBtn.textContent = 'Delete';

  actions.append(editBtn, deleteBtn);
  card.append(details, actions);
  return card;
}

function buildAddressForm(address, customerEmail) {
  const form = document.createElement('form');
  form.className = 'address-form';
  form.noValidate = true;

  form.innerHTML = `
    <div class="address-form-row">
      <input type="text" class="address-input" name="firstName" placeholder="First name" autocomplete="given-name" required value="${address?.name?.split(' ')[0] || ''}">
      <input type="text" class="address-input" name="lastName" placeholder="Last name" autocomplete="family-name" required value="${address?.name?.split(' ').slice(1).join(' ') || ''}">
    </div>
    <input type="text" class="address-input" name="company" placeholder="Company (optional)" value="${address?.company || ''}">
    <input type="text" class="address-input" name="address1" placeholder="Address" required autocomplete="off" value="${address?.address1 || ''}">
    <input type="text" class="address-input" name="address2" placeholder="Apartment, suite, etc. (optional)" value="${address?.address2 || ''}">
    <div class="address-form-row">
      <input type="text" class="address-input" name="city" placeholder="City" required value="${address?.city || ''}">
      <input type="text" class="address-input" name="state" placeholder="State / Province" required value="${address?.state || ''}">
    </div>
    <div class="address-form-row">
      <input type="text" class="address-input" name="zip" placeholder="ZIP / Postal code" required value="${address?.zip || ''}">
      <select class="address-input" name="country" required>
        <option value="">Country</option>
        <option value="US">United States</option>
        <option value="CA">Canada</option>
        <option value="GB">United Kingdom</option>
        <option value="AU">Australia</option>
        <option value="DE">Germany</option>
        <option value="FR">France</option>
        <option value="JP">Japan</option>
      </select>
    </div>
    <div class="address-form-row">
      <input type="tel" class="address-input" name="phone" placeholder="Phone (optional)" value="${address?.phone || ''}">
      <input type="email" class="address-input" name="email" placeholder="Email" required value="${address?.email || customerEmail || ''}">
    </div>
    <div class="address-form-actions">
      <button type="submit" class="address-save-btn">${address ? 'Update address' : 'Save address'}</button>
      <button type="button" class="address-cancel-btn">Cancel</button>
    </div>
  `;

  // Set country select value
  if (address?.country) {
    const countrySelect = form.querySelector('[name="country"]');
    const option = countrySelect.querySelector(`option[value="${address.country}"]`);
    if (option) countrySelect.value = address.country;
  } else {
    form.querySelector('[name="country"]').value = 'US';
  }

  return form;
}

function getFormData(form) {
  const data = {};
  const firstName = form.querySelector('[name="firstName"]')?.value?.trim() || '';
  const lastName = form.querySelector('[name="lastName"]')?.value?.trim() || '';
  data.name = [firstName, lastName].filter(Boolean).join(' ');
  const fields = ['company', 'address1', 'address2', 'city', 'state', 'zip', 'country', 'phone', 'email'];
  fields.forEach((field) => {
    const val = form.querySelector(`[name="${field}"]`)?.value?.trim();
    if (val) data[field] = val;
  });
  return data;
}

function validateForm(form) {
  const required = ['firstName', 'lastName', 'address1', 'city', 'state', 'zip', 'country', 'email'];
  let valid = true;

  required.forEach((field) => {
    const input = form.querySelector(`[name="${field}"]`);
    if (!input) return;
    const val = input.value.trim();
    if (!val) {
      input.classList.add('address-input-error');
      valid = false;
    } else {
      input.classList.remove('address-input-error');
    }
  });

  return valid;
}

function fillAddressFields(form, addressInput, placeResult) {
  const components = {};
  (placeResult.address_components || []).forEach((c) => {
    c.types.forEach((type) => { components[type] = c; });
  });

  const streetNumber = components.street_number?.long_name || '';
  const route = components.route?.long_name || '';
  addressInput.value = `${streetNumber} ${route}`.trim();

  const address2Input = form.querySelector('[name="address2"]');
  if (address2Input && components.subpremise) {
    address2Input.value = components.subpremise.long_name;
  }

  const cityInput = form.querySelector('[name="city"]');
  if (cityInput) {
    cityInput.value = (components.locality || components.sublocality || components.postal_town)?.long_name || '';
  }

  const stateInput = form.querySelector('[name="state"]');
  if (stateInput) {
    stateInput.value = components.administrative_area_level_1?.short_name || '';
  }

  const zipInput = form.querySelector('[name="zip"]');
  if (zipInput) {
    zipInput.value = components.postal_code?.long_name || '';
  }

  const countrySelect = form.querySelector('[name="country"]');
  if (countrySelect && components.country) {
    const code = components.country.short_name;
    const option = countrySelect.querySelector(`option[value="${code}"]`);
    if (option) countrySelect.value = code;
  }
}

function initFormAutocomplete(form) {
  const addressInput = form.querySelector('[name="address1"]');
  if (!addressInput) return;

  const wrapper = document.createElement('div');
  wrapper.classList.add('places-autocomplete-wrapper');
  addressInput.parentElement.insertBefore(wrapper, addressInput);
  wrapper.append(addressInput);

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
            fillAddressFields(form, addressInput, data.result);
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

function showAddressForm(container, address, customerEmail, reloadAddresses) {
  container.innerHTML = '';

  const section = document.createElement('div');
  section.className = 'account-addresses';

  const h3 = document.createElement('h3');
  h3.textContent = address ? 'Edit address' : 'Add address';
  section.append(h3);

  const form = buildAddressForm(address, customerEmail);
  section.append(form);
  container.append(section);

  initFormAutocomplete(form);

  form.querySelector('.address-cancel-btn').addEventListener('click', () => {
    reloadAddresses();
  });

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!validateForm(form)) return;

    const saveBtn = form.querySelector('.address-save-btn');
    saveBtn.disabled = true;
    saveBtn.textContent = 'Saving...';

    try {
      const data = getFormData(form);

      // Edit = delete old + create new
      if (address?.id) {
        await commerce.deleteAddress(address.id);
      }

      await commerce.createAddress(data);
      await reloadAddresses();
    } catch {
      // eslint-disable-next-line no-alert
      alert('Failed to save address. Please try again.');
      saveBtn.disabled = false;
      saveBtn.textContent = address ? 'Update address' : 'Save address';
    }
  });
}

function renderAddresses(container, addresses, customerEmail, reload) {
  container.innerHTML = '';

  const section = document.createElement('div');
  section.className = 'account-addresses';

  const header = document.createElement('div');
  header.className = 'account-addresses-header';

  const h3 = document.createElement('h3');
  h3.textContent = 'Addresses';

  const addBtn = document.createElement('button');
  addBtn.type = 'button';
  addBtn.className = 'address-add-btn';
  addBtn.textContent = 'Add address';

  header.append(h3, addBtn);
  section.append(header);

  if (!addresses || addresses.length === 0) {
    const empty = document.createElement('p');
    empty.className = 'account-empty';
    empty.textContent = 'No saved addresses.';
    section.append(empty);
  } else {
    const list = document.createElement('div');
    list.className = 'address-list';

    addresses.forEach((address) => {
      const card = renderAddressCard(address);

      card.querySelector('.address-edit-btn').addEventListener('click', () => {
        showAddressForm(container, address, customerEmail, reload);
      });

      card.querySelector('.address-delete-btn').addEventListener('click', async () => {
        // eslint-disable-next-line no-restricted-globals, no-alert
        if (!confirm('Delete this address?')) return;
        try {
          await commerce.deleteAddress(address.id);
          await reload();
        } catch {
          // eslint-disable-next-line no-alert
          alert('Failed to delete address. Please try again.');
        }
      });

      list.append(card);
    });

    section.append(list);
  }

  container.append(section);

  addBtn.addEventListener('click', () => {
    showAddressForm(container, null, customerEmail, reload);
  });
}

// --- Orders ---

function renderLineItem(item) {
  let image = item.custom?.image || '';
  if (image && !image.startsWith('/') && !image.startsWith('http')) {
    image = `./products/${image}`;
  }
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

// --- Login prompt ---

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

// --- Main ---

export default async function decorate(block) {
  block.textContent = '';

  const wrapper = document.createElement('div');
  wrapper.className = 'account-wrapper';

  const profileSection = document.createElement('div');
  profileSection.className = 'account-profile-section';

  const addressesSection = document.createElement('div');
  addressesSection.className = 'account-addresses-section';

  const ordersSection = document.createElement('div');
  ordersSection.className = 'account-orders-section';

  wrapper.append(profileSection, addressesSection, ordersSection);
  block.append(wrapper);

  async function loadAddresses(customerEmail) {
    const reload = () => loadAddresses(customerEmail);
    try {
      const addresses = await commerce.getAddresses();
      renderAddresses(addressesSection, addresses, customerEmail, reload);
    } catch {
      renderAddresses(addressesSection, [], customerEmail, reload);
    }
  }

  async function loadAccount() {
    if (!(await commerce.isLoggedIn())) {
      renderLoginPrompt(profileSection);
      addressesSection.innerHTML = '';
      ordersSection.innerHTML = '';
      return;
    }

    profileSection.innerHTML = '<p class="account-loading">Loading...</p>';

    let customerEmail = '';

    try {
      const customer = await commerce.getCustomerProfile();

      if (!customer) {
        const user = await commerce.getCustomer();
        customerEmail = user?.email || '';
        renderProfile(profileSection, { email: customerEmail });
      } else {
        customerEmail = customer.email || '';
        renderProfile(profileSection, customer);
      }

      await loadAddresses(customerEmail);

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
      customerEmail = user?.email || '';
      renderProfile(profileSection, { email: customerEmail });
      await loadAddresses(customerEmail);
      renderOrders(ordersSection, []);
    }
  }

  await loadAccount();

  commerce.on(commerce.EVENTS.AUTH_STATE_CHANGED, () => loadAccount());
}
