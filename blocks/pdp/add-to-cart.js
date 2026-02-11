import { checkVariantOutOfStock } from '../../scripts/scripts.js';

/**
 * Checks if a variant is available for sale.
 * @param {Object} variant - The variant object
 * @returns {boolean} True if the variant is available for sale
 */
export function isVariantAvailableForSale(variant) {
  if (!variant) return false;
  return !checkVariantOutOfStock(variant.sku);
}

/**
 * Renders the add to cart section with quantity selector and button.
 * In this demo, the add-to-cart action logs to the console.
 * A real implementation would integrate with a commerce backend.
 * @param {Object} ph - Placeholders object
 * @param {Element} block - The PDP block element
 * @param {Object} parent - Parent product JSON-LD data
 * @returns {HTMLElement} Container with add to cart controls
 */
export default function renderAddToCart(ph, block, parent) {
  let selectedVariant = parent.offers?.[0] || parent;
  if (window.selectedVariant) {
    const { sku: selectedSku } = window.selectedVariant;
    const found = parent.offers.find((variant) => variant.sku === selectedSku);
    if (found) selectedVariant = found;
  }

  const isAvailable = isVariantAvailableForSale(selectedVariant);

  const addToCartContainer = document.createElement('div');
  addToCartContainer.classList.add('add-to-cart');

  if (!isAvailable) {
    addToCartContainer.classList.add('add-to-cart-unavailable');
    return addToCartContainer;
  }

  // quantity label
  const quantityLabel = document.createElement('label');
  quantityLabel.textContent = `${ph.quantity || 'Quantity'}:`;
  quantityLabel.classList.add('pdp-quantity-label');
  quantityLabel.htmlFor = 'pdp-quantity-select';
  addToCartContainer.appendChild(quantityLabel);

  // quantity selector
  const quantityContainer = document.createElement('div');
  quantityContainer.classList.add('quantity-container');
  const quantitySelect = document.createElement('select');
  quantitySelect.id = 'pdp-quantity-select';

  const maxQuantity = 10;
  for (let i = 1; i <= maxQuantity; i += 1) {
    const option = document.createElement('option');
    option.value = i;
    option.textContent = i;
    quantitySelect.appendChild(option);
  }
  quantityContainer.appendChild(quantitySelect);

  // add to cart button
  const addToCartButton = document.createElement('button');
  addToCartButton.textContent = ph.addToCart || 'Add to Cart';

  addToCartButton.addEventListener('click', () => {
    addToCartButton.textContent = ph.adding || 'Adding...';
    addToCartButton.setAttribute('aria-disabled', 'true');

    const quantity = quantitySelect.value;
    const sku = selectedVariant.sku || window.selectedVariant?.sku;

    // Demo: log to console. Replace with commerce backend integration.
    // eslint-disable-next-line no-console
    console.log('Add to cart:', { sku, quantity: +quantity });

    setTimeout(() => {
      addToCartButton.textContent = ph.addToCart || 'Add to Cart';
      addToCartButton.removeAttribute('aria-disabled');
    }, 1000);
  });

  quantityContainer.appendChild(addToCartButton);
  addToCartContainer.appendChild(quantityContainer);

  return addToCartContainer;
}
