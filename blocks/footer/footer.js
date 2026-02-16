import { getMetadata } from '../../scripts/aem.js';
import { loadFragment } from '../fragment/fragment.js';

/**
 * loads and decorates the footer
 * @param {Element} block The footer block element
 */
function wrapImageWithLink(img, link) {
  const imageWrapperLink = document.createElement('a');
  imageWrapperLink.href = link;

  // Ensure image link has accessible text
  const altText = img.getAttribute('alt');
  if (!altText || altText.trim() === '') {
    img.setAttribute('alt', 'Brandvia, powered by Halo');
  }

  // Add aria-label for the brandvia link to ensure accessibility
  imageWrapperLink.setAttribute('aria-label', 'Brandvia, powered by Halo');

  imageWrapperLink.appendChild(img);
  return imageWrapperLink;
}

export default async function decorate(block) {
  // load footer as fragment
  const footerMeta = getMetadata('footer');
  const footerPath = footerMeta
    ? new URL(footerMeta, window.location).pathname
    : '/footer';
  const fragment = await loadFragment(footerPath);

  // decorate footer DOM
  block.textContent = '';
  const footer = document.createElement('div');
  while (fragment.firstElementChild) footer.append(fragment.firstElementChild);
  const copyrightSection = footer.querySelector('.copyright');
  const brandviaIcon = copyrightSection?.querySelector('img');
  const brandviaLink = copyrightSection?.querySelector('a');
  if (brandviaIcon && brandviaLink) {
    const imageWrapperLink = wrapImageWithLink(brandviaIcon, brandviaLink);
    copyrightSection
      .querySelector('.default-content-wrapper')
      .prepend(imageWrapperLink);
    brandviaLink?.parentElement?.remove();
  }
  const rediretLinksSection = footer.querySelector('.redirect-links');
  const redirectLinks = rediretLinksSection?.querySelectorAll('a');
  if (redirectLinks && redirectLinks.length > 0) {
    [...redirectLinks].forEach((a) => {
      // Ensure all links have discernible text
      const linkText = a.textContent.trim();
      if (!linkText) {
        // eslint-disable-next-line no-console -- accessibility warning for authors
        console.warn('Footer link missing text content:', a.href);
      }

      if (a.href.includes('adobe.com')) {
        a.classList.add('brand-link');
        a.setAttribute('target', '_blank');

        // Add accessibility attributes for external links
        a.setAttribute('rel', 'noopener noreferrer');

        // Enhance link text for screen readers if it opens in new window
        if (!a.getAttribute('aria-label') && linkText) {
          a.setAttribute('aria-label', `${linkText} (opens in new window)`);
        }
      }
    });
  }
  block.append(footer);
}
