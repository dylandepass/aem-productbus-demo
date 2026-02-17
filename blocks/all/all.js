/**
 * Fetches all products from the product index, handling EDS pagination.
 * @returns {Promise<Array>} All product entries
 */
async function fetchProductIndex() {
  const entries = [];
  let offset = 0;
  let total = Infinity;

  while (offset < total) {
    const url = `/products/index.json?offset=${offset}&limit=256`;
    // eslint-disable-next-line no-await-in-loop
    const resp = await fetch(url);
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
 * @param {number|string} value - Price value
 * @param {string} currency - Currency code
 * @returns {string} Formatted price
 */
function formatPrice(value, currency = 'USD') {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(Number(value));
}

/**
 * Sorts products by the given sort key.
 * @param {Array} products - Products to sort
 * @param {string} sortKey - Sort key
 * @returns {Array} Sorted products (new array)
 */
function sortProducts(products, sortKey) {
  const sorted = [...products];
  switch (sortKey) {
    case 'cheapest':
      sorted.sort((a, b) => (Number(a.price) || 0) - (Number(b.price) || 0));
      break;
    case 'expensive':
      sorted.sort((a, b) => (Number(b.price) || 0) - (Number(a.price) || 0));
      break;
    default:
      // newest — default index order
      break;
  }
  return sorted;
}

/**
 * Builds a product card element.
 * @param {Object} product - Product data from the index
 * @returns {HTMLElement} Product card element
 */
function buildProductCard(product) {
  const card = document.createElement('a');
  card.className = 'all-product-card';

  try {
    const urlObj = new URL(product.url);
    card.href = urlObj.pathname;
  } catch {
    card.href = product.url || '#';
  }

  const price = Number(product.price) || 0;
  const regularPrice = Number(product.regularPrice) || 0;
  const isOnSale = regularPrice > 0 && price < regularPrice;

  // Image container with optional badge
  const imageWrap = document.createElement('div');
  imageWrap.className = 'all-product-image';

  if (isOnSale) {
    const badge = document.createElement('span');
    badge.className = 'all-badge all-badge-sale';
    badge.textContent = 'SALE';
    imageWrap.append(badge);
  }

  const img = document.createElement('img');
  const imageSrc = product.image || '';
  img.src = imageSrc.startsWith('./') ? `/products/${imageSrc.slice(2)}` : imageSrc;
  img.alt = product.title || '';
  img.loading = 'lazy';
  img.width = 400;
  img.height = 400;
  imageWrap.append(img);

  // Product info
  const info = document.createElement('div');
  info.className = 'all-product-info';

  const name = document.createElement('p');
  name.className = 'all-product-name';
  name.textContent = product.title || '';

  const priceEl = document.createElement('p');
  priceEl.className = 'all-product-price';
  const currency = product.currency || 'USD';

  if (isOnSale) {
    const saleSpan = document.createElement('span');
    saleSpan.className = 'all-price-sale';
    saleSpan.textContent = formatPrice(price, currency);

    const regSpan = document.createElement('span');
    regSpan.className = 'all-price-regular';
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
 * Renders the product grid.
 * @param {HTMLElement} grid - Grid container
 * @param {Array} products - Products to render
 */
function renderGrid(grid, products) {
  grid.innerHTML = '';
  products.forEach((product) => {
    grid.append(buildProductCard(product));
  });
}

/**
 * All products block. Shows all products with sort controls.
 * Use the "sale" variant to show only products on sale.
 * @param {HTMLElement} block - The block element
 */
export default async function decorate(block) {
  const isSaleVariant = block.classList.contains('sale');
  block.innerHTML = '';

  const allProducts = await fetchProductIndex();

  // Filter to parent products that are in stock (no variants, no fully OOS)
  let parentProducts = allProducts.filter((p) => !p.parentSku
    && p.availability !== 'https://schema.org/OutOfStock');

  // Sale variant: only show products on sale
  if (isSaleVariant) {
    parentProducts = parentProducts.filter((p) => {
      const price = Number(p.price) || 0;
      const regularPrice = Number(p.regularPrice) || 0;
      return regularPrice > 0 && price < regularPrice;
    });
  }

  // Toolbar: count + sort
  const toolbar = document.createElement('div');
  toolbar.className = 'all-toolbar';

  const count = document.createElement('p');
  count.className = 'all-count';
  count.innerHTML = `<strong>${parentProducts.length}</strong> Products found`;

  const sortWrapper = document.createElement('div');
  sortWrapper.className = 'all-sort-wrapper';
  sortWrapper.innerHTML = `
    <label for="all-sort" class="visually-hidden">Sort products</label>
    <select id="all-sort">
      <option value="newest">Sort by:</option>
      <option value="cheapest">$ - $$$$</option>
      <option value="expensive">$$$$ - $</option>
    </select>`;

  toolbar.append(count, sortWrapper);
  block.append(toolbar);

  // Product grid
  const grid = document.createElement('div');
  grid.className = 'all-grid';
  block.append(grid);

  // Initial render
  renderGrid(grid, parentProducts);

  // Sort handler
  toolbar.querySelector('#all-sort').addEventListener('change', (e) => {
    const sorted = sortProducts(parentProducts, e.target.value);
    renderGrid(grid, sorted);
  });
}
