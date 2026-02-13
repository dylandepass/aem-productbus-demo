/**
 * Minicart slide-out drawer.
 * Renders cart items, handles quantity updates and removal.
 */

let commerceApi = null;

async function getCommerce() {
  if (!commerceApi) {
    const mod = await import('../../scripts/commerce/api.js');
    commerceApi = mod.commerce;
  }
  return commerceApi;
}

function formatPrice(value) {
  return `$${Number(value).toFixed(2)}`;
}

function buildItemEl(item) {
  const el = document.createElement('div');
  el.className = 'minicart-item';
  el.dataset.sku = item.sku;

  el.innerHTML = `
    <img class="minicart-item-image" src="${item.image || ''}" alt="${item.name || ''}" loading="lazy" width="64" height="64">
    <div class="minicart-item-details">
      <a class="minicart-item-name" href="${item.url || '#'}">${item.name || item.sku}</a>
      <span class="minicart-item-price">${formatPrice(item.price)}</span>
      <div class="minicart-item-actions">
        <div class="minicart-item-qty">
          <button class="minicart-qty-btn" data-delta="-1" aria-label="Decrease quantity">&minus;</button>
          <span class="minicart-qty-value">${item.quantity}</span>
          <button class="minicart-qty-btn" data-delta="1" aria-label="Increase quantity">&plus;</button>
        </div>
        <button class="minicart-item-remove" aria-label="Remove ${item.name || item.sku}">Remove</button>
      </div>
    </div>
  `;

  // quantity +/-
  el.querySelectorAll('.minicart-qty-btn').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const delta = Number(btn.dataset.delta);
      const newQty = item.quantity + delta;
      const commerce = await getCommerce();
      if (newQty <= 0) {
        await commerce.removeItem(item.sku);
      } else {
        await commerce.updateItemQuantity(item.sku, newQty);
      }
    });
  });

  // remove
  el.querySelector('.minicart-item-remove').addEventListener('click', async () => {
    const commerce = await getCommerce();
    await commerce.removeItem(item.sku);
  });

  return el;
}

function renderItems(container, cart) {
  container.innerHTML = '';
  if (!cart || cart.itemCount === 0) {
    const empty = document.createElement('div');
    empty.className = 'minicart-empty';
    empty.innerHTML = '<p>Your cart is empty</p>';
    container.append(empty);
    return;
  }
  cart.items.forEach((item) => container.append(buildItemEl(item)));
}

function renderFooter(footer, cart) {
  const subtotal = footer.querySelector('.minicart-subtotal-value');
  if (subtotal) subtotal.textContent = formatPrice(cart?.subtotal || 0);
  footer.style.display = cart && cart.itemCount > 0 ? '' : 'none';
}

/**
 * Creates and returns the minicart drawer with open/close/refresh methods.
 * @param {Element} parent - Element to append the drawer to (nav or body)
 * @returns {{ open: Function, close: Function, refresh: Function }}
 */
export default function createMinicart(parent) {
  // overlay
  const overlay = document.createElement('div');
  overlay.className = 'minicart-overlay';

  // drawer
  const drawer = document.createElement('div');
  drawer.className = 'minicart-drawer';
  drawer.innerHTML = `
    <div class="minicart-header">
      <h2>Your Cart</h2>
      <button class="minicart-close" aria-label="Close cart">&times;</button>
    </div>
    <div class="minicart-items"></div>
    <div class="minicart-footer">
      <div class="minicart-subtotal">
        <span>Subtotal</span>
        <span class="minicart-subtotal-value">$0.00</span>
      </div>
      <a href="/cart" class="minicart-view-cart">View Cart &amp; Checkout</a>
    </div>
  `;

  const itemsContainer = drawer.querySelector('.minicart-items');
  const footer = drawer.querySelector('.minicart-footer');
  let currentCart = null;

  function close() {
    drawer.classList.remove('minicart-open');
    overlay.classList.remove('minicart-overlay-visible');
    document.body.style.overflow = '';
  }

  function open() {
    drawer.classList.add('minicart-open');
    overlay.classList.add('minicart-overlay-visible');
    document.body.style.overflow = 'hidden';
  }

  function refresh(cart) {
    currentCart = cart;
    renderItems(itemsContainer, cart);
    renderFooter(footer, cart);
  }

  // close handlers
  overlay.addEventListener('click', close);
  drawer.querySelector('.minicart-close').addEventListener('click', close);
  window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && drawer.classList.contains('minicart-open')) {
      close();
    }
  });

  // navigate to cart closes drawer
  drawer.querySelector('.minicart-view-cart').addEventListener('click', close);

  document.body.append(overlay, drawer);

  // initial render with empty cart
  refresh(currentCart);

  return { open, close, refresh };
}
