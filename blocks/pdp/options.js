import { buildSlide, buildThumbnails } from './gallery.js';
import { rebuildIndices, checkVariantOutOfStock } from '../../scripts/scripts.js';
import { toClassName } from '../../scripts/aem.js';
import renderPricing from './pricing.js';
import renderAddToCart from './add-to-cart.js';

/**
 * Gets the value of a specific option from a variant's options array.
 * @param {Object} variant - The variant object
 * @param {string} optionId - The option ID (e.g., "color", "size")
 * @returns {string|undefined} The option value
 */
function getOptionValue(variant, optionId) {
  const opt = variant.options.find((o) => o.id === optionId);
  return opt?.value;
}

/**
 * Extracts distinct option types and their unique values from all variants.
 * @param {Array} variants - All product variants
 * @returns {Array<{id: string, values: string[]}>} Option types with unique values
 */
function getOptionTypes(variants) {
  const optionMap = new Map();

  variants.forEach((variant) => {
    (variant.options || []).forEach((opt) => {
      if (!optionMap.has(opt.id)) {
        optionMap.set(opt.id, new Set());
      }
      optionMap.get(opt.id).add(opt.value);
    });
  });

  return [...optionMap.entries()].map(([id, values]) => ({
    id,
    values: isSizeOption(id)
      ? [...values].sort((a, b) => sizeOrder(a) - sizeOrder(b))
      : [...values],
  }));
}

/**
 * Finds the variant matching all currently selected options.
 * @param {Array} variants - All product variants
 * @param {Object} selectedOptions - Map of optionId -> selected value (className form)
 * @returns {Object|null} The matching variant
 */
function findVariant(variants, selectedOptions) {
  if (Object.keys(selectedOptions).length === 0) return null;
  return variants.find((v) => {
    const relevant = v.options.filter((opt) => opt.id in selectedOptions);
    return relevant.length > 0
      && relevant.every((opt) => selectedOptions[opt.id] === toClassName(opt.value));
  });
}

/**
 * Updates a single key in the selectedOptions state.
 * @param {Object} state - The PDP state object
 * @param {string} key - The option ID
 * @param {string} value - The selected value
 */
function setSelectedOption(state, key, value) {
  const opts = { ...state.get('selectedOptions'), [key]: value };
  state.set('selectedOptions', opts);
}

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
    oosMessage.textContent = ph.optionOutOfStock || 'This selection is temporarily out of stock.';
  }
}

/**
 * Updates the selected state of option swatches in a group.
 * @param {Element} container - The options container for this group
 * @param {string} selectedValue - The selected value (className form)
 */
function updateSelectionState(container, selectedValue) {
  container.querySelectorAll('[data-option-value]').forEach((el) => {
    el.classList.toggle('selected', el.dataset.optionValue === selectedValue);
  });
}

/**
 * Handles the change of a variant option.
 * @param {Object} ph - Placeholders object
 * @param {Element} block - The PDP block element
 * @param {Object} state - The PDP state object
 * @param {string} optionId - The option ID that changed (e.g., "color", "size")
 * @param {string} value - The new value (className form)
 * @param {boolean} isParentOutOfStock - Whether the parent product is out of stock
 */
export function onOptionChange(ph, block, state, optionId, value, isParentOutOfStock = false) {
  const variants = state.get('variants');
  const product = state.get('product');

  // Update selected options state
  setSelectedOption(state, optionId, value);
  const selectedOptions = state.get('selectedOptions');

  // Update URL with all selected options
  const params = new URLSearchParams();
  const optionTypes = getOptionTypes(variants);
  const firstVariant = variants[0];
  optionTypes.forEach((type) => {
    const selected = selectedOptions[type.id];
    const defaultVal = toClassName(getOptionValue(firstVariant, type.id));
    if (selected && selected !== defaultVal) {
      params.set(type.id, selected);
    }
  });
  const search = params.toString();
  // eslint-disable-next-line no-restricted-globals
  history.replaceState(null, '', search ? `?${search}` : window.location.pathname);

  // Find the variant matching all selected options
  const variant = findVariant(variants, selectedOptions);
  if (!variant) return;

  const { sku } = variant;
  const oos = checkVariantOutOfStock(sku, product);
  const buyBox = block.querySelector('.pdp-buy-box');
  buyBox.dataset.oos = isParentOutOfStock || oos;
  buyBox.dataset.sku = sku;

  // Update the OOS message
  const oosMessage = block.querySelector('.pdp-oos-message');
  updateOOSMessage(ph, oosMessage, isParentOutOfStock);

  // Update pricing
  const pricingContainer = renderPricing(ph, block, state, variant);
  if (pricingContainer) {
    block.querySelector('.pricing').replaceWith(pricingContainer);
  }

  // Update all option labels and selection states
  optionTypes.forEach((type) => {
    const label = block.querySelector(`.selected-option-label[data-option-id="${type.id}"]`);
    if (label) {
      const selectedVal = selectedOptions[type.id];
      const typeLabel = type.id.charAt(0).toUpperCase() + type.id.slice(1);
      if (selectedVal) {
        const rawVal = type.values.find((v) => toClassName(v) === selectedVal) || selectedVal;
        label.textContent = `${typeLabel}: ${formatOptionLabel(type.id, rawVal)}`;
      } else {
        // Single-value option with no selection — show the only value
        label.textContent = type.values.length === 1
          ? `${typeLabel}: ${formatOptionLabel(type.id, type.values[0])}`
          : typeLabel;
      }
    }
    const optGroup = block.querySelector(`.pdp-option-group[data-option-id="${type.id}"]`);
    if (optGroup) {
      updateSelectionState(optGroup, selectedOptions[type.id]);
    }
  });

  // Update gallery images
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

  slides.scrollTo({ left: 0, behavior: 'smooth' });

  [slides, nav].forEach((wrapper) => {
    wrapper.querySelectorAll('[data-source="variant"]').forEach((v) => v.remove());
  });

  const lcpSibling = lcpSlide.nextElementSibling;
  variantImages.slice(1).forEach((pic) => {
    const slide = buildSlide(pic, 'variant');
    if (slide) slides.insertBefore(slide, lcpSibling);
  });

  rebuildIndices(gallery);
  buildThumbnails(gallery);

  state.set('selectedVariant', variant);

  // update add to cart
  const addToCartContainer = renderAddToCart(ph, block, state);
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
 * Determines if an option type represents a color.
 * @param {string} optionId - The option ID
 * @returns {boolean}
 */
function isColorOption(optionId) {
  return optionId.toLowerCase() === 'color';
}

/**
 * Abbreviates a size value for display in compact swatches.
 * @param {string} value - The full size value (e.g., "X-Small", "Medium", "XX-Large")
 * @returns {string} The abbreviated size (e.g., "XS", "M", "XXL")
 */
function abbreviateSize(value) {
  const sizeMap = {
    'x-small': 'XS',
    'extra small': 'XS',
    'extra-small': 'XS',
    small: 'S',
    medium: 'M',
    large: 'L',
    'x-large': 'XL',
    'extra large': 'XL',
    'extra-large': 'XL',
    'xx-large': 'XXL',
    '2x-large': 'XXL',
    'xxx-large': 'XXXL',
    '3x-large': 'XXXL',
  };
  return sizeMap[value.toLowerCase()] || value;
}

/**
 * Determines if an option type represents a size.
 * @param {string} optionId - The option ID
 * @returns {boolean}
 */
function isSizeOption(optionId) {
  return optionId.toLowerCase() === 'size';
}

/**
 * Returns a numeric sort rank for a size value (smallest first).
 * @param {string} value - The size value
 * @returns {number} Sort rank
 */
function sizeOrder(value) {
  const order = [
    'x-small', 'extra-small', 'extra small', 'xs',
    'small', 's',
    'medium', 'm',
    'large', 'l',
    'x-large', 'extra-large', 'extra large', 'xl',
    'xx-large', '2x-large', 'xxl',
    'xxx-large', '3x-large', 'xxxl',
  ];
  const idx = order.indexOf(value.toLowerCase());
  return idx >= 0 ? idx : order.length;
}

/**
 * Formats an option value for display in the label.
 * @param {string} optionId - The option ID
 * @param {string} value - The raw option value
 * @returns {string} The display value
 */
function formatOptionLabel(optionId, value) {
  return value;
}

/**
 * Renders a color swatch option.
 * @param {string} value - The option value
 * @param {string} className - The className form of the value
 * @param {boolean} isOos - Whether this variant is out of stock
 * @returns {Element}
 */
function renderColorSwatch(value, className, isOos) {
  const swatch = document.createElement('div');
  swatch.classList.add('pdp-option-swatch', 'pdp-color-swatch');
  swatch.dataset.optionValue = className;
  swatch.title = value;

  const inner = document.createElement('div');
  inner.classList.add('pdp-color-inner');
  inner.style.background = `var(--color-${className})`;
  if (className === 'white' || className === 'cream') {
    inner.classList.add('pdp-color-light');
  }
  if (isOos) inner.classList.add('pdp-color-swatch-oos');
  swatch.append(inner);

  return swatch;
}

/**
 * Renders a size/text option button.
 * @param {string} value - The option value (e.g., "S", "M", "L", "XL")
 * @param {string} className - The className form of the value
 * @param {boolean} isOos - Whether this variant is out of stock
 * @returns {Element}
 */
function renderSizeOption(value, className, isOos) {
  const swatch = document.createElement('div');
  swatch.classList.add('pdp-option-swatch', 'pdp-size-swatch');
  swatch.dataset.optionValue = className;
  swatch.title = value;

  const label = document.createElement('span');
  label.textContent = abbreviateSize(value);
  if (isOos) swatch.classList.add('pdp-size-swatch-oos');
  swatch.append(label);

  return swatch;
}

/**
 * Renders the options section of the PDP block.
 * @param {Object} ph - Placeholders object
 * @param {Element} block - The PDP block element
 * @param {Object} state - The PDP state object
 * @param {boolean} isParentOutOfStock - Whether the parent product is out of stock
 * @returns {Element} The options container element
 */
export function renderOptions(ph, block, state, isParentOutOfStock) {
  const variants = state.get('variants');
  const product = state.get('product');
  const optionsContainer = document.createElement('div');
  optionsContainer.classList.add('options');

  // If out of stock with no variants, just show OOS message
  if (isParentOutOfStock && (!variants || variants.length === 0)) {
    renderOOSMessage(ph, optionsContainer, isParentOutOfStock);
    return optionsContainer;
  }

  // if there are no variants, don't render anything
  if (!variants?.length) {
    return null;
  }

  // Extract distinct option types from all variants
  const optionTypes = getOptionTypes(variants);
  if (optionTypes.length === 0) {
    return null;
  }

  // Initialize selected options from first variant
  const initialOptions = {};
  const defaultVariant = variants[0];
  optionTypes.forEach((type) => {
    const defaultVal = getOptionValue(defaultVariant, type.id);
    if (defaultVal) initialOptions[type.id] = toClassName(defaultVal);
  });
  state.set('selectedOptions', initialOptions);

  // Render each option type group
  optionTypes.forEach((type) => {
    const defaultVal = getOptionValue(defaultVariant, type.id);

    const selectionContainer = document.createElement('div');
    selectionContainer.classList.add('selection');

    const selectedOptionLabel = document.createElement('div');
    selectedOptionLabel.classList.add('selected-option-label');
    selectedOptionLabel.dataset.optionId = type.id;
    const typeLabel = type.id.charAt(0).toUpperCase() + type.id.slice(1);
    const displayVal = defaultVal || (type.values.length === 1 ? type.values[0] : null);
    selectedOptionLabel.textContent = displayVal
      ? `${typeLabel}: ${formatOptionLabel(type.id, displayVal)}`
      : typeLabel;
    selectionContainer.append(selectedOptionLabel);

    // Only render swatches if there are multiple values to choose from
    if (type.values.length > 1) {
      const optionGroup = document.createElement('div');
      optionGroup.classList.add('pdp-option-group');
      optionGroup.dataset.optionId = type.id;

      type.values.forEach((value) => {
        const className = toClassName(value);

        // Check if all variants with this option value are OOS
        const variantsWithValue = variants.filter(
          (v) => getOptionValue(v, type.id)
            && toClassName(getOptionValue(v, type.id)) === className,
        );
        const isOos = variantsWithValue.length === 0
          || variantsWithValue.every((v) => checkVariantOutOfStock(v.sku, product));

        let swatch;
        if (isColorOption(type.id)) {
          swatch = renderColorSwatch(value, className, isOos);
        } else if (isSizeOption(type.id)) {
          swatch = renderSizeOption(value, className, isOos);
        } else {
          swatch = renderSizeOption(value, className, isOos);
        }

        // Mark default as selected
        if (className === toClassName(defaultVal)) {
          swatch.classList.add('selected');
        }

        swatch.addEventListener('click', () => {
          onOptionChange(ph, block, state, type.id, className, isParentOutOfStock);
        });

        optionGroup.append(swatch);
      });

      selectionContainer.append(optionGroup);
    }

    optionsContainer.append(selectionContainer);
  });

  renderOOSMessage(ph, optionsContainer, isParentOutOfStock);

  return optionsContainer;
}
