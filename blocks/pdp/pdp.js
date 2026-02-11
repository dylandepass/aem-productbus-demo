import { fetchPlaceholders } from '../../scripts/aem.js';
import renderAddToCart from './add-to-cart.js';
import renderGallery from './gallery.js';
import renderPricing from './pricing.js';
import {
  renderOptions, onOptionChange,
} from './options.js';
import {
  getOfferPricing,
  checkVariantOutOfStock,
  isProductOutOfStock,
} from '../../scripts/scripts.js';

/**
 * Renders the title section of the PDP block.
 * @param {Element} block - The PDP block element
 * @returns {Element} The title container element
 */
function renderTitle(block) {
  const titleContainer = document.createElement('div');
  titleContainer.classList.add('title');

  const h1 = block.querySelector('h1:first-of-type');
  if (h1) titleContainer.append(h1);

  return titleContainer;
}

/**
 * Renders authored content sections below the buy box.
 * @param {Element} block - The PDP block element
 */
function renderContent(block) {
  block.querySelectorAll(':scope > div').forEach((div) => {
    if (div.classList.length === 0) {
      div.remove();
    }
  });

  const { authoredContent } = window;
  if (authoredContent && authoredContent.length > 0) {
    const contentContainer = document.createElement('div');
    contentContainer.classList.add('content');
    authoredContent.forEach((section) => {
      contentContainer.append(...section.children);
    });
    if (contentContainer.children.length > 0) {
      block.append(contentContainer);
    }
  }
}

/**
 * Decorates the PDP block.
 * @param {Element} block - The PDP block element
 */
export default async function decorate(block) {
  const { jsonLdData, variants } = window;
  const { offers } = jsonLdData;
  const ph = await fetchPlaceholders();

  const galleryContainer = renderGallery(block, variants);
  const titleContainer = renderTitle(block);

  const buyBox = document.createElement('div');
  buyBox.classList.add('pdp-buy-box');

  const isParentOutOfStock = isProductOutOfStock();

  const pricingContainer = renderPricing(ph, block);
  const optionsContainer = renderOptions(ph, block, variants, isParentOutOfStock);
  const addToCartContainer = renderAddToCart(ph, block, jsonLdData);

  buyBox.append(
    pricingContainer,
    optionsContainer || '',
    addToCartContainer,
  );

  renderContent(block);

  block.append(
    titleContainer,
    galleryContainer,
    buyBox,
  );

  const queryParams = new URLSearchParams(window.location.search);
  const color = queryParams.get('color');

  if (color) {
    onOptionChange(ph, block, variants, color, isParentOutOfStock);
  } else if (variants.length > 0) {
    [window.selectedVariant] = variants;
  }

  buyBox.dataset.sku = window.selectedVariant?.sku || offers[0].sku;
  const variantOos = checkVariantOutOfStock(
    window.selectedVariant
      ? offers.find((offer) => offer.sku === window.selectedVariant.sku).sku
      : offers[0].sku,
  );
  buyBox.dataset.oos = isParentOutOfStock || variantOos;

  // Get initial offer pricing for simple product sale detection
  const initialPricing = getOfferPricing(offers[0]);
  if (initialPricing && initialPricing.regular && initialPricing.regular > initialPricing.final) {
    block.dataset.onSale = true;
  }
}
