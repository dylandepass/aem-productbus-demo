import { checkVariantOutOfStock, getOfferPricing } from '../../scripts/scripts.js';

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

  addToCartButton.addEventListener('click', async () => {
    addToCartButton.textContent = ph.adding || 'Adding...';
    addToCartButton.setAttribute('aria-disabled', 'true');

    const quantity = +quantitySelect.value;
    const variant = selectedVariant || window.selectedVariant;
    const sku = variant?.sku;
    const pricing = getOfferPricing(variant);

    try {
      const { commerce } = await import('../../scripts/commerce/api.js');
      await commerce.addToCart({
        sku,
        name: window.jsonLdData?.name || '',
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
