import { formatPrice, buildCarousel } from '../../scripts/scripts.js';

/**
 * Fetches raw product bus JSON for a given product path.
 * @param {string} path - Relative product path (e.g. /us/en_us/products/product-urlkey)
 * @returns {Promise<Object|null>} Product data or null on failure
 */
async function fetchProduct(path) {
  try {
    const resp = await fetch(`${path}.json`);
    if (!resp.ok) return null;
    return await resp.json();
  } catch {
    return null;
  }
}

/**
 * Resolves a product bus image URL (relative ./media_* paths) against the product path.
 * @param {string} imageUrl - Image URL from product bus (may be relative)
 * @param {string} productPath - The product's path
 * @returns {string} Absolute image URL
 */
function resolveImageUrl(imageUrl, productPath) {
  if (imageUrl.startsWith('http')) return imageUrl;
  const base = new URL(productPath, window.location.origin);
  return new URL(imageUrl, base).href;
}

/**
 * Builds a single product card as a list item for the carousel.
 * @param {Object} product - Product bus JSON data
 * @param {string} path - Product path for linking and image resolution
 * @param {Object} ph - Placeholders for price formatting
 * @returns {HTMLLIElement} The card list item
 */
function buildProductCard(product, path, ph) {
  const li = document.createElement('li');

  const card = document.createElement('a');
  card.classList.add('related-product-card');
  card.href = path;

  // Image
  const imageContainer = document.createElement('div');
  imageContainer.classList.add('related-product-image');

  const firstImage = product.images?.[0];
  if (firstImage) {
    const img = document.createElement('img');
    img.src = resolveImageUrl(firstImage.url, path);
    img.alt = firstImage.alt || product.name || '';
    img.loading = 'lazy';
    imageContainer.append(img);
  }

  // Body
  const body = document.createElement('div');
  body.classList.add('related-product-body');

  const name = document.createElement('h3');
  name.textContent = product.name || '';
  body.append(name);

  if (product.price?.final) {
    const price = document.createElement('div');
    price.classList.add('related-product-price');
    price.textContent = formatPrice(parseFloat(product.price.final), ph);
    body.append(price);
  }

  card.append(imageContainer, body);
  li.append(card);
  return li;
}

/**
 * Creates the related products section with lazy loading via IntersectionObserver.
 * Uses the shared carousel for horizontal scrolling with nav arrows.
 * @param {Object} ph - Placeholders for price formatting and labels
 * @returns {HTMLElement} The related products container (content loads when visible)
 */
export default function renderRelatedProducts(ph) {
  const relatedPaths = window.jsonLdData?.custom?.related;

  const container = document.createElement('div');
  container.classList.add('related-products');

  // Bail early if no related products
  if (!relatedPaths?.length) {
    container.style.display = 'none';
    return container;
  }

  // Heading
  const heading = document.createElement('h2');
  heading.textContent = ph.relatedProducts || 'Related products';
  container.append(heading);

  // Defer fetching until the section scrolls into view
  const observer = new IntersectionObserver((entries) => {
    entries.forEach(async (entry) => {
      if (!entry.isIntersecting) return;
      observer.disconnect();

      const products = await Promise.all(
        relatedPaths.map((path) => fetchProduct(path).then((data) => (data ? { data, path } : null))),
      );

      const valid = products.filter(Boolean);
      if (!valid.length) {
        container.style.display = 'none';
        return;
      }

      const list = document.createElement('ul');
      valid.forEach(({ data, path }) => {
        list.append(buildProductCard(data, path, ph));
      });

      container.append(list);
      buildCarousel(container, false);
    });
  }, { threshold: 0, rootMargin: '200px' });

  observer.observe(container);
  return container;
}
