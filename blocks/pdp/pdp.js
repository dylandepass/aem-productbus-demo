import { fetchPlaceholders } from '../../scripts/aem.js';
import renderAddToCart from './add-to-cart.js';
import renderGallery, { updateGalleryImages } from './gallery.js';
import renderPricing from './pricing.js';
import { renderOptions, onOptionChange } from './options.js';
import {
  getOfferPricing,
  checkVariantOutOfStock,
  isProductOutOfStock,
} from '../../scripts/scripts.js';
import renderRelatedProducts from './related-products.js';

/**
 * Creates a lightweight reactive state container.
 * @param {Object} initial - Initial state values
 * @returns {Object} State object with get, set, and onChange methods
 */
function createState(initial) {
  const data = { ...initial };
  const listeners = new Map();
  return {
    get(key) { return data[key]; },
    set(key, value) {
      data[key] = value;
      (listeners.get(key) || []).forEach((fn) => fn(value, data));
    },
    onChange(key, fn) {
      if (!listeners.has(key)) listeners.set(key, []);
      listeners.get(key).push(fn);
    },
  };
}

/**
 * Parses JSON-LD product data from the document head.
 * @returns {Object|null} Parsed JSON-LD data or null
 */
function parseJsonLd() {
  const el = document.head.querySelector('script[type="application/ld+json"]');
  return el ? JSON.parse(el.textContent) : null;
}

/**
 * Parses variant sections from stashed DOM elements, cross-referencing with JSON-LD.
 * @param {Array<Element>} sections - The variant section DOM elements
 * @param {Object} jsonLdData - Parsed JSON-LD product data
 * @returns {Array<Object>} Array of variant objects
 */
function parseVariants(sections, jsonLdData) {
  const { offers } = jsonLdData || {};
  if (!offers) return [];
  return sections.map((div) => {
    const name = div.querySelector('h2')?.textContent.trim();
    const { sku } = div.dataset;
    const imagesHTML = div.querySelectorAll('picture');
    const ldVariant = offers.find((offer) => offer.sku === sku);
    const price = getOfferPricing(ldVariant);
    const options = ldVariant?.options || [];
    return {
      sku, name, options, price, images: imagesHTML, availability: ldVariant?.availability,
    };
  });
}

/**
 * Renders the title section from the server-rendered h1.
 * @param {Element} block - The PDP block element
 * @returns {Element} The title container
 */
function renderTitle(block) {
  const container = document.createElement('div');
  container.classList.add('title');

  const h1 = block.querySelector('h1:first-of-type');
  if (h1) container.append(h1);

  return container;
}

/**
 * Assembles the buy-box: pricing, options, and add-to-cart.
 * @param {Object} state - The PDP state object
 * @param {Object} ph - Placeholders
 * @param {Element} block - The PDP block element
 * @param {boolean} isParentOutOfStock - Whether the parent product is OOS
 * @returns {Element} The buy-box element
 */
function buildBuyBox(state, ph, block, isParentOutOfStock) {
  const buyBox = document.createElement('div');
  buyBox.classList.add('pdp-buy-box');

  const pricing = renderPricing(ph, block, state);
  const options = renderOptions(ph, block, state, isParentOutOfStock);
  const addToCart = renderAddToCart(ph, block, state);

  buyBox.append(pricing, options || '', addToCart);

  return buyBox;
}

/**
 * Renders authored content sections below the buy-box.
 * @param {Element} block - The PDP block element
 * @param {Array<Element>} authoredContent - Authored content DOM sections
 * @returns {Element|null} The content container, or null if empty
 */
function renderAuthoredContent(block, authoredContent) {
  // Remove empty wrapper divs left over from block parsing
  block.querySelectorAll(':scope > div').forEach((div) => {
    if (div.classList.length === 0) div.remove();
  });

  if (!authoredContent?.length) return null;

  const container = document.createElement('div');
  container.classList.add('content');
  authoredContent.forEach((section) => {
    container.append(...section.children);
  });

  return container.children.length > 0 ? container : null;
}

/**
 * Applies URL-driven option pre-selection and sets initial buy-box state.
 * @param {Object} state - The PDP state object
 * @param {Object} ph - Placeholders
 * @param {Element} block - The PDP block element
 * @param {boolean} isParentOutOfStock - Whether the parent product is OOS
 * @param {Element} buyBox - The buy-box element
 */
function applyInitialSelection(state, ph, block, isParentOutOfStock, buyBox) {
  const variants = state.get('variants');
  const product = state.get('product');

  // Apply options from URL query params
  const params = new URLSearchParams(window.location.search);
  let hasUrlOptions = false;

  // Collect all known option IDs from variants
  const optionIds = new Set();
  variants.forEach((v) => (v.options || []).forEach((opt) => optionIds.add(opt.id)));

  optionIds.forEach((optionId) => {
    const urlVal = params.get(optionId);
    if (urlVal) {
      hasUrlOptions = true;
      onOptionChange(ph, block, state, optionId, urlVal, isParentOutOfStock);
    }
  });

  // Default to first variant when no URL options present
  if (!hasUrlOptions && variants.length > 0) {
    state.set('selectedVariant', variants[0]);
  }

  // Set buy-box SKU and OOS state
  const selectedVariant = state.get('selectedVariant');
  const activeSku = selectedVariant?.sku || product.offers[0].sku;
  buyBox.dataset.sku = activeSku;
  buyBox.dataset.oos = isParentOutOfStock
    || checkVariantOutOfStock(activeSku, product);

  // Flag sale pricing on the block for CSS hooks
  const initialPricing = getOfferPricing(product.offers[0]);
  if (initialPricing?.regular && initialPricing.regular > initialPricing.final) {
    block.dataset.onSale = true;
  }
}

/**
 * Decorates the PDP block.
 * @param {Element} block - The PDP block element
 */
export default async function decorate(block) {
  // Parse product data (moved from scripts.js buildPDPBlock)
  const jsonLdData = parseJsonLd();
  const variants = parseVariants(block.variantSections || [], jsonLdData);
  const authoredContent = block.authoredContent || [];
  delete block.variantSections;
  delete block.authoredContent;

  const ph = await fetchPlaceholders();
  const isParentOutOfStock = isProductOutOfStock(jsonLdData);

  const state = createState({
    product: jsonLdData,
    variants,
    selectedVariant: null,
    selectedOptions: {},
  });

  // Build components
  const title = renderTitle(block);
  const gallery = renderGallery(block, state);
  const buyBox = buildBuyBox(state, ph, block, isParentOutOfStock);
  const content = renderAuthoredContent(block, authoredContent);
  const related = renderRelatedProducts(ph, state);

  // Assemble layout
  if (content) block.append(content);
  block.append(title, gallery, buyBox, related);

  // Subscribe to variant changes — gallery, pricing, and add-to-cart update themselves
  state.onChange('selectedVariant', () => updateGalleryImages(block, state));
  state.onChange('selectedVariant', (variant) => {
    const el = renderPricing(ph, block, state, variant);
    if (el) block.querySelector('.pricing')?.replaceWith(el);
  });
  state.onChange('selectedVariant', () => {
    const el = renderAddToCart(ph, block, state);
    if (el) block.querySelector('.add-to-cart')?.replaceWith(el);
  });

  // Apply initial state
  applyInitialSelection(state, ph, block, isParentOutOfStock, buyBox);
}
