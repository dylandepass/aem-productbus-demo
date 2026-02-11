import { formatPrice, getOfferPricing } from '../../scripts/scripts.js';

/**
 * Renders the pricing section of the PDP block.
 * @param {Object} ph - Placeholders object
 * @param {Element} block - The PDP block element
 * @param {Object} [variant] - Optional variant object with price data
 * @returns {Element|null} The pricing container element
 */
export default function renderPricing(ph, block, variant) {
  const pricingContainer = document.createElement('div');
  pricingContainer.classList.add('pricing');

  const pricing = variant
    ? variant.price
    : getOfferPricing(window.jsonLdData?.offers?.[0]);
  if (!pricing) {
    return pricingContainer;
  }

  // remove the pipeline-rendered pricing text from the DOM
  if (!variant) {
    const pricingElement = block.querySelector('p:nth-of-type(1)');
    if (pricingElement) pricingElement.remove();
  }

  if (pricing.regular && pricing.regular > pricing.final) {
    const nowLabel = document.createElement('div');
    nowLabel.className = 'pricing-now';
    nowLabel.textContent = ph.now || 'Now';
    pricingContainer.appendChild(nowLabel);
  }

  const finalPrice = document.createElement('div');
  finalPrice.className = 'pricing-final';
  finalPrice.textContent = formatPrice(pricing.final, ph);
  pricingContainer.appendChild(finalPrice);

  if (pricing.regular && pricing.regular > pricing.final) {
    const savingsContainer = document.createElement('div');
    savingsContainer.className = 'pricing-savings';

    const savingsAmount = pricing.regular - pricing.final;
    const saveText = document.createElement('span');
    saveText.className = 'pricing-save';
    saveText.textContent = `${ph.save || 'Save'} ${formatPrice(savingsAmount, ph)} | ${ph.was || 'Was'} `;

    const regularPrice = document.createElement('del');
    regularPrice.className = 'pricing-regular';
    regularPrice.textContent = formatPrice(pricing.regular, ph);

    savingsContainer.appendChild(saveText);
    savingsContainer.appendChild(regularPrice);
    pricingContainer.appendChild(savingsContainer);
  }

  return pricingContainer;
}
