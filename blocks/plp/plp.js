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
 * Filters products matching a given category path.
 * Excludes variant children (those with parentSku).
 * @param {Array} products - All product entries
 * @param {string} categoryPath - Category path to match (e.g., "office/tech")
 * @returns {Array} Matching parent products
 */
function getProductsByCategory(products, categoryPath) {
  return products.filter((p) => {
    if (p.parentSku) return false;
    const cats = p.categories || [];
    return Array.isArray(cats) && cats.includes(categoryPath);
  });
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
 * @param {string} sortKey - Sort key (price:ASC, price:DESC)
 * @returns {Array} Sorted products (new array)
 */
function sortProducts(products, sortKey) {
  if (!sortKey) return products;
  const sorted = [...products];
  const [attr, dir] = sortKey.split(':');
  if (attr === 'price') {
    sorted.sort((a, b) => {
      const pa = Number(a.price) || 0;
      const pb = Number(b.price) || 0;
      return dir === 'DESC' ? pb - pa : pa - pb;
    });
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
  card.className = 'plp-product-card';

  // Build local PDP link from the product URL
  try {
    const urlObj = new URL(product.url);
    card.href = urlObj.pathname;
  } catch {
    card.href = product.url || '#';
  }

  const price = Number(product.price) || 0;
  const regularPrice = Number(product.regularPrice) || 0;
  const isOnSale = regularPrice > 0 && price < regularPrice;

  // Image container with badge
  const imageWrap = document.createElement('div');
  imageWrap.className = 'plp-product-image';

  if (isOnSale) {
    const badge = document.createElement('span');
    badge.className = 'plp-badge plp-badge-sale';
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
  info.className = 'plp-product-info';

  const name = document.createElement('p');
  name.className = 'plp-product-name';
  name.textContent = product.title || '';

  const priceEl = document.createElement('p');
  priceEl.className = 'plp-product-price';
  const currency = product.currency || 'USD';

  if (isOnSale) {
    const saleSpan = document.createElement('span');
    saleSpan.className = 'plp-price-sale';
    saleSpan.textContent = formatPrice(price, currency);

    const regSpan = document.createElement('span');
    regSpan.className = 'plp-price-regular';
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
 * Scrolls to the element matching the current URL hash.
 */
function scrollToHash() {
  if (!window.location.hash) return;
  const target = document.querySelector(window.location.hash);
  if (target) {
    setTimeout(() => {
      target.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 100);
  }
}

/**
 * PLP block entry point.
 * @param {HTMLElement} block - The PLP block element
 */
export default async function decorate(block) {
  // Parse categories from authored block content
  const categories = [...block.querySelectorAll(':scope > div > div')].map((elem) => ({
    title: elem.querySelector('h1, h2, h3, h4')?.textContent.trim() || '',
    path: elem.querySelector('p')?.textContent.trim() || '',
  }));

  block.innerHTML = '';

  const sortParam = new URLSearchParams(window.location.search).get('sort') || '';

  // Fetch products first so we know which categories have results
  const allProducts = await fetchProductIndex();

  // Slug helper
  const toSlug = (text) => text.toLowerCase().replace(/[&,]+/g, '').replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');

  // Determine which categories have products
  const validCategories = categories.filter((cat) => {
    if (!cat.path || !cat.title) return false;
    return getProductsByCategory(allProducts, cat.path).length > 0;
  });

  // Anchoring sub-nav header (only categories with products)
  const anchorHeader = document.createElement('div');
  anchorHeader.className = 'plp-anchor-header';
  const anchorUl = document.createElement('ul');
  validCategories.forEach((cat) => {
    const li = document.createElement('li');
    const a = document.createElement('a');
    a.href = `#${toSlug(cat.title)}`;
    a.textContent = cat.title;
    li.append(a);
    anchorUl.append(li);
  });
  anchorHeader.append(anchorUl);
  block.append(anchorHeader);

  // Sort control
  const tools = document.createElement('div');
  tools.className = 'plp-tools';
  tools.innerHTML = `
    <div class="plp-sort-wrapper">
      <label for="plp-sort" class="visually-hidden">Sort products</label>
      <select id="plp-sort">
        <option value="">Sort by:</option>
        <option value="price:ASC"${sortParam === 'price:ASC' ? ' selected' : ''}>$ - $$$</option>
        <option value="price:DESC"${sortParam === 'price:DESC' ? ' selected' : ''}>$$$ - $</option>
      </select>
    </div>`;
  tools.querySelector('#plp-sort').addEventListener('change', (e) => {
    const url = new URL(window.location);
    if (e.target.value) {
      url.searchParams.set('sort', e.target.value);
    } else {
      url.searchParams.delete('sort');
    }
    window.location.href = url.toString();
  });
  block.append(tools);

  // Category content area
  const content = document.createElement('div');
  content.className = 'plp-categories';
  block.append(content);

  // Render each valid category section
  validCategories.forEach((cat) => {
    const slug = toSlug(cat.title);
    const section = document.createElement('div');
    section.className = 'plp-category-section';
    section.id = slug;

    const heading = document.createElement('h3');
    heading.textContent = cat.title;
    section.append(heading);

    const products = sortProducts(getProductsByCategory(allProducts, cat.path), sortParam);

    const grid = document.createElement('div');
    grid.className = 'plp-grid';

    products.forEach((product) => {
      grid.append(buildProductCard(product));
    });

    section.append(grid);
    content.append(section);
  });

  // Store breadcrumb category
  const pathCategory = window.location.pathname.split('/')[1];
  if (pathCategory) {
    sessionStorage.setItem('breadcrumbCategory', pathCategory);
  }

  scrollToHash();
}
