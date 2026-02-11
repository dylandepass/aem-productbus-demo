import { fetchPlaceholders } from '../../scripts/aem.js';
import renderAddToCart from './add-to-cart.js';
import renderGallery from './gallery.js';
import renderPricing from './pricing.js';
import { renderOptions, onOptionChange } from './options.js';
import {
  getOfferPricing,
  checkVariantOutOfStock,
  isProductOutOfStock,
} from '../../scripts/scripts.js';

/**
 * Gathers all product state needed by the PDP into a single context object.
 * @param {Element} block - The PDP block element
 * @returns {Promise<Object>} Context object with product data and placeholders
 */
async function initContext(block) {
  const { jsonLdData, variants } = window;
  const { offers } = jsonLdData;
  const ph = await fetchPlaceholders();
  const isParentOutOfStock = isProductOutOfStock();

  return {
    block, ph, jsonLdData, variants, offers, isParentOutOfStock,
  };
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
 * @param {Object} ctx - The PDP context
 * @returns {Element} The buy-box element
 */
function buildBuyBox(ctx) {
  const {
    ph, block, variants, jsonLdData, isParentOutOfStock,
  } = ctx;

  const buyBox = document.createElement('div');
  buyBox.classList.add('pdp-buy-box');

  const pricing = renderPricing(ph, block);
  const options = renderOptions(ph, block, variants, isParentOutOfStock);
  const addToCart = renderAddToCart(ph, block, jsonLdData);

  buyBox.append(pricing, options || '', addToCart);

  return buyBox;
}

/**
 * Renders authored content sections below the buy-box.
 * @param {Element} block - The PDP block element
 * @returns {Element|null} The content container, or null if empty
 */
function renderAuthoredContent(block) {
  // Remove empty wrapper divs left over from block parsing
  block.querySelectorAll(':scope > div').forEach((div) => {
    if (div.classList.length === 0) div.remove();
  });

  const { authoredContent } = window;
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
 * @param {Object} ctx - The PDP context
 * @param {Element} buyBox - The buy-box element
 */
function applyInitialSelection(ctx, buyBox) {
  const {
    ph,
    block,
    variants,
    offers,
    isParentOutOfStock,
  } = ctx;

  // Apply options from URL query params
  const params = new URLSearchParams(window.location.search);
  let hasUrlOptions = false;

  if (window.selectedOptions) {
    Object.keys(window.selectedOptions).forEach((optionId) => {
      const urlVal = params.get(optionId);
      if (urlVal) {
        hasUrlOptions = true;
        onOptionChange(ph, block, variants, optionId, urlVal, isParentOutOfStock);
      }
    });
  }

  // Default to first variant when no URL options present
  if (!hasUrlOptions && variants.length > 0) {
    [window.selectedVariant] = variants;
  }

  // Set buy-box SKU and OOS state
  const activeSku = window.selectedVariant?.sku || offers[0].sku;
  buyBox.dataset.sku = activeSku;
  buyBox.dataset.oos = isParentOutOfStock || checkVariantOutOfStock(activeSku);

  // Flag sale pricing on the block for CSS hooks
  const initialPricing = getOfferPricing(offers[0]);
  if (initialPricing?.regular && initialPricing.regular > initialPricing.final) {
    block.dataset.onSale = true;
  }
}

/**
 * Decorates the PDP block.
 * @param {Element} block - The PDP block element
 */
export default async function decorate(block) {
  const ctx = await initContext(block);

  // Build components
  const title = renderTitle(block);
  const gallery = renderGallery(block, ctx.variants);
  const buyBox = buildBuyBox(ctx);
  const content = renderAuthoredContent(block);

  // Assemble layout
  if (content) block.append(content);
  block.append(title, gallery, buyBox);

  // Apply initial state
  applyInitialSelection(ctx, buyBox);
}
