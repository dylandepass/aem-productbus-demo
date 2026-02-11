/**
 * Fetches all products from the product index, handling pagination.
 * @returns {Promise<Array>} All product entries
 */
async function fetchProductIndex() {
  const entries = [];
  let offset = 0;
  let total = Infinity;

  while (offset < total) {
    // eslint-disable-next-line no-await-in-loop
    const resp = await fetch(`/products/index.json?offset=${offset}&limit=256`);
    if (!resp.ok) break;
    // eslint-disable-next-line no-await-in-loop
    const json = await resp.json();
    const sheet = json.data || json;
    entries.push(...sheet);
    total = json.total ?? sheet.length;
    offset += json.limit ?? sheet.length;
    if (!json.limit) break;
  }

  return entries;
}

/**
 * Formats a price as a currency string.
 * @param {number|string} value
 * @param {string} currency
 * @returns {string}
 */
function formatPrice(value, currency = 'USD') {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(Number(value));
}

/**
 * Builds a product card element.
 * @param {Object} product
 * @returns {HTMLElement}
 */
function buildProductCard(product) {
  const card = document.createElement('a');
  card.className = 'new-arrivals-card';

  try {
    const urlObj = new URL(product.url);
    card.href = urlObj.pathname;
  } catch {
    card.href = product.url || '#';
  }

  const price = Number(product.price) || 0;
  const regularPrice = Number(product.regularPrice) || 0;
  const isOnSale = regularPrice > 0 && price < regularPrice;

  // Image
  const imageWrap = document.createElement('div');
  imageWrap.className = 'new-arrivals-image';

  if (isOnSale) {
    const badge = document.createElement('span');
    badge.className = 'new-arrivals-badge badge-sale';
    badge.textContent = 'SALE';
    imageWrap.append(badge);
  }

  const img = document.createElement('img');
  const imageSrc = product.image || '';
  img.src = imageSrc.startsWith('./') ? `/products/${imageSrc.slice(2)}` : imageSrc;
  img.alt = product.title || '';
  img.loading = 'lazy';
  img.width = 300;
  img.height = 300;
  imageWrap.append(img);

  // Info
  const info = document.createElement('div');
  info.className = 'new-arrivals-info';

  const name = document.createElement('p');
  name.className = 'new-arrivals-name';
  name.textContent = product.title || '';

  const priceEl = document.createElement('p');
  priceEl.className = 'new-arrivals-price';
  const currency = product.currency || 'USD';

  if (isOnSale) {
    const saleSpan = document.createElement('span');
    saleSpan.className = 'price-sale';
    saleSpan.textContent = formatPrice(price, currency);

    const regSpan = document.createElement('span');
    regSpan.className = 'price-regular';
    regSpan.textContent = formatPrice(regularPrice, currency);

    priceEl.append(saleSpan, ' ', regSpan);
  } else {
    priceEl.textContent = formatPrice(price, currency);
  }

  info.append(name, priceEl);
  card.append(imageWrap, info);

  return card;
}

/**
 * New arrivals block. Shows recent products from the product index.
 * Config row: size (number of products to display).
 * @param {HTMLElement} block
 */
export default async function decorate(block) {
  // Read config
  let size = 4;
  const configRow = block.querySelector(':scope > div > div');
  if (configRow) {
    const key = configRow.querySelector('div:first-child')?.textContent.trim().toLowerCase();
    const val = configRow.querySelector('div:last-child')?.textContent.trim();
    if (key === 'size' && val) size = parseInt(val, 10) || 4;
  }

  block.innerHTML = '';

  const allProducts = await fetchProductIndex();

  // Filter to parent products only (no variants)
  const parentProducts = allProducts.filter((p) => !p.parentSku && p.categories);

  // Take the first N products
  const products = parentProducts.slice(0, size);

  const grid = document.createElement('div');
  grid.className = 'new-arrivals-grid';

  products.forEach((product) => {
    grid.append(buildProductCard(product));
  });

  block.append(grid);
}
