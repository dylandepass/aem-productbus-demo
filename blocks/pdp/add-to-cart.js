import { checkVariantOutOfStock, getOfferPricing } from '../../scripts/scripts.js';

/**
 * Checks if a variant is available for sale.
 * @param {Object} variant - The variant object
 * @param {Object} jsonLdData - Parsed JSON-LD product data
 * @returns {boolean} True if the variant is available for sale
 */
export function isVariantAvailableForSale(variant, jsonLdData) {
  if (!variant) return false;
  return !checkVariantOutOfStock(variant.sku, jsonLdData);
}

/**
 * Renders the add to cart section with quantity selector and button.
 * @param {Object} ph - Placeholders object
 * @param {Element} block - The PDP block element
 * @param {Object} state - The PDP state object
 * @returns {HTMLElement} Container with add to cart controls
 */
export default function renderAddToCart(ph, block, state) {
  const product = state.get('product');
  let selectedVariant = product.offers?.[0] || product;
  const currentSelection = state.get('selectedVariant');
  if (currentSelection) {
    const found = product.offers.find((variant) => variant.sku === currentSelection.sku);
    if (found) selectedVariant = found;
  }

  const isAvailable = isVariantAvailableForSale(selectedVariant, product);

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

  addToCartButton.addEventListener('click', async () => {
    addToCartButton.textContent = ph.adding || 'Adding...';
    addToCartButton.setAttribute('aria-disabled', 'true');

    const quantity = +quantitySelect.value;
    const variant = selectedVariant || state.get('selectedVariant');
    const sku = variant?.sku;
    const pricing = getOfferPricing(variant);

    try {
      const { commerce } = await import('../../scripts/commerce/api.js');
      await commerce.addToCart({
        sku,
        name: product?.name || '',
        quantity,
        price: pricing?.final || 0,
        image: block.querySelector('.gallery img')?.src || variant?.image?.[0] || '',
        url: window.location.pathname,
      });
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error('Failed to add to cart', err);
    } finally {
      addToCartButton.textContent = ph.addToCart || 'Add to Cart';
      addToCartButton.removeAttribute('aria-disabled');
    }
  });

  quantityContainer.appendChild(addToCartButton);
  addToCartContainer.appendChild(quantityContainer);

  return addToCartContainer;
}
