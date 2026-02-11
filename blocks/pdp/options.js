import { buildSlide, buildThumbnails } from './gallery.js';
import { rebuildIndices, checkVariantOutOfStock } from '../../scripts/scripts.js';
import { toClassName } from '../../scripts/aem.js';
import renderPricing from './pricing.js';
import renderAddToCart from './add-to-cart.js';

/**
 * Updates the OOS message text based on whether parent or variant is out of stock.
 * @param {Object} ph - Placeholders object
 * @param {Element} oosMessage - The OOS message element
 * @param {boolean} isParentOutOfStock - Whether the parent product is out of stock
 */
function updateOOSMessage(ph, oosMessage, isParentOutOfStock) {
  if (!oosMessage) return;

  if (isParentOutOfStock) {
    oosMessage.textContent = ph.itemOutOfStock || 'This item is temporarily out of stock.';
  } else {
    oosMessage.textContent = ph.colorOutOfStock || 'This color is temporarily out of stock.';
  }
}

/**
 * Handles the change of a variant option.
 * @param {Object} ph - Placeholders object
 * @param {Element} block - The PDP block element
 * @param {Array} variants - The variants of the product
 * @param {string} color - The color of the selected option
 * @param {boolean} isParentOutOfStock - Whether the parent product is out of stock
 */
export function onOptionChange(ph, block, variants, color, isParentOutOfStock = false) {
  if (variants[0].options.color.replace(/\s+/g, '-').toLowerCase() !== color) {
    // eslint-disable-next-line no-restricted-globals
    history.replaceState(null, '', `?color=${color}`);
  } else {
    // eslint-disable-next-line no-restricted-globals
    history.replaceState(null, '', window.location.pathname);
  }

  const selectedOptionLabel = block.querySelector('.selected-option-label');
  const variant = variants.find(
    (v) => v.options.color.replace(/\s+/g, '-').toLowerCase() === color,
  );

  const { sku } = variant;
  const oos = checkVariantOutOfStock(sku);
  const buyBox = block.querySelector('.pdp-buy-box');
  buyBox.dataset.oos = isParentOutOfStock || oos;
  buyBox.dataset.sku = sku;

  // Update the OOS message
  const oosMessage = block.querySelector('.pdp-oos-message');
  updateOOSMessage(ph, oosMessage, isParentOutOfStock);

  // update pricing
  const pricingContainer = renderPricing(ph, block, variant);
  if (pricingContainer) {
    block.querySelector('.pricing').replaceWith(pricingContainer);
  }

  const variantColor = variant.options.color;
  selectedOptionLabel.textContent = `${ph.color || 'Color'}: ${variantColor}`;

  let variantImages = variant.images || [];
  variantImages = [...variantImages].map((v, i) => {
    const clone = v.cloneNode(true);
    clone.dataset.source = i ? 'variant' : 'lcp';
    return clone;
  });

  const gallery = block.querySelector('.gallery');
  const slides = gallery.querySelector('ul');
  const nav = gallery.querySelector('[role="radiogroup"]');

  // update LCP image(s)
  const lcpSlide = slides.querySelector('[data-source="lcp"]');
  const lcpButton = nav.querySelector('[data-source="lcp"]');
  if (lcpSlide && lcpButton) {
    const oldPic = lcpSlide.querySelector('picture');
    const { offsetHeight, offsetWidth } = oldPic;
    const newPic = variantImages[0];
    if (newPic) {
      newPic.style.height = `${offsetHeight}px`;
      newPic.style.width = `${offsetWidth}px`;
      lcpSlide.replaceChildren(newPic);
      const newImg = newPic.querySelector('img');
      newImg.addEventListener('load', () => newPic.removeAttribute('style'));
    }
  }

  // reset scroll position to the first slide
  slides.scrollTo({ left: 0, behavior: 'smooth' });

  // remove old variant slides and indices
  [slides, nav].forEach((wrapper) => {
    wrapper.querySelectorAll('[data-source="variant"]').forEach((v) => v.remove());
  });

  // rebuild variant slides and insert after LCP
  const lcpSibling = lcpSlide.nextElementSibling;
  variantImages.slice(1).forEach((pic) => {
    const slide = buildSlide(pic, 'variant');
    if (slide) slides.insertBefore(slide, lcpSibling);
  });

  // rebuild all indices
  rebuildIndices(gallery);
  buildThumbnails(gallery);

  window.selectedVariant = variant;

  // update add to cart
  const addToCartContainer = renderAddToCart(ph, block, window.jsonLdData);
  if (addToCartContainer) {
    block.querySelector('.add-to-cart').replaceWith(addToCartContainer);
  }
}

/**
 * Renders the OOS message element.
 * @param {Object} ph - Placeholders object
 * @param {Element} element - Parent element to append OOS message to
 * @param {boolean} isParentOutOfStock - Whether the parent product is out of stock
 */
function renderOOSMessage(ph, element, isParentOutOfStock) {
  const oosMessage = document.createElement('div');
  oosMessage.classList.add('pdp-oos-message');
  updateOOSMessage(ph, oosMessage, isParentOutOfStock);
  element.append(oosMessage);
}

/**
 * Renders the options section of the PDP block.
 * @param {Object} ph - Placeholders object
 * @param {Element} block - The PDP block element
 * @param {Array} variants - The variants of the product
 * @param {boolean} isParentOutOfStock - Whether the parent product is out of stock
 * @returns {Element} The options container element
 */
export function renderOptions(ph, block, variants, isParentOutOfStock) {
  const optionsContainer = document.createElement('div');
  optionsContainer.classList.add('options');

  // If out of stock with no variants, just show OOS message
  if (isParentOutOfStock && (!variants || variants.length === 0)) {
    renderOOSMessage(ph, optionsContainer, isParentOutOfStock);
    return optionsContainer;
  }

  // if there are no variants, don't render anything
  if (!variants?.length) {
    return optionsContainer;
  }

  const selectionContainer = document.createElement('div');
  selectionContainer.classList.add('selection');

  const selectedOptionLabel = document.createElement('div');
  selectedOptionLabel.classList.add('selected-option-label');
  selectedOptionLabel.textContent = `${ph.color || 'Color'}: ${variants[0].options.color}`;
  selectionContainer.append(selectedOptionLabel);

  const colors = variants.map((variant) => toClassName(variant.options.color));

  const colorOptions = colors.map((color, index) => {
    const { sku } = variants[index];
    const colorOption = document.createElement('div');
    colorOption.classList.add('pdp-color-swatch');

    const colorSwatch = document.createElement('div');
    colorSwatch.classList.add('pdp-color-inner');
    colorSwatch.style.backgroundColor = `var(--color-${color})`;
    if (checkVariantOutOfStock(sku)) {
      colorSwatch.classList.add('pdp-color-swatch-oos');
    }
    colorOption.append(colorSwatch);

    colorOption.addEventListener('click', () => {
      onOptionChange(ph, block, variants, color, isParentOutOfStock);
    });

    return colorOption;
  });

  const colorOptionsContainer = document.createElement('div');
  colorOptionsContainer.classList.add('pdp-color-options');
  colorOptionsContainer.append(...colorOptions);
  selectionContainer.append(colorOptionsContainer);

  optionsContainer.append(selectionContainer);
  renderOOSMessage(ph, optionsContainer, isParentOutOfStock);

  return optionsContainer;
}
