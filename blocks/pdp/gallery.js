import { buildCarousel } from '../../scripts/scripts.js';

/**
 * Accepts an element and returns clean <li> > <picture> structure.
 * @param {HTMLElement} el - Wrapper element
 * @param {string} source - Source of slide
 * @returns {HTMLLIElement|null}
 */
export function buildSlide(el, source) {
  const picture = el.tagName === 'PICTURE' ? el : el.querySelector('picture');
  if (!picture) return null;

  const li = document.createElement('li');
  if (source) li.dataset.source = source;
  li.append(picture);
  return li;
}

/**
 * Builds thumbnail images for the carousel nav buttons.
 * @param {Element} carousel - Carousel container element.
 */
export function buildThumbnails(carousel) {
  const imgs = carousel.querySelectorAll('li img');
  const indices = carousel.querySelectorAll('nav [role="radiogroup"] button');

  const observer = new MutationObserver(() => {
    const selected = carousel.querySelector('nav [role="radiogroup"] button[aria-checked="true"]');
    if (selected) selected.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
  });

  indices.forEach((btn, i) => {
    const img = imgs[i];
    if (!img) return;

    const imgLi = img.closest('li');
    const { source } = imgLi.dataset;

    const thumb = img.cloneNode(true);
    if (source) btn.dataset.source = source;
    btn.replaceChildren(thumb);

    observer.observe(btn, { attributes: true, attributeFilter: ['aria-checked'] });
  });
}

/**
 * Renders the gallery section of the PDP block.
 * @param {Element} block - The PDP block element
 * @param {Object} state - The PDP state object
 * @returns {Element} The gallery container element
 */
export default function renderGallery(block, state) {
  const variants = state.get('variants');
  const gallery = document.createElement('div');
  gallery.className = 'gallery';
  const wrapper = document.createElement('ul');
  gallery.append(wrapper);

  // prioritize LCP image in gallery
  const lcp = block.querySelector('.lcp-image');
  let lcpSrc;
  if (lcp) {
    const lcpSlide = buildSlide(lcp, 'lcp');
    if (lcpSlide) {
      wrapper.prepend(lcpSlide);
      lcpSrc = new URL(lcpSlide.querySelector('img').src).pathname;
    }
  }

  if (variants && variants.length === 0) {
    const fallbackImages = block.querySelectorAll('.img-wrapper');
    [...fallbackImages].forEach((el) => {
      const slide = buildSlide(el, 'lcp');
      if (slide) wrapper.append(slide);
    });
  }

  if (variants && variants.length > 0) {
    const defaultVariant = variants[0];

    let variantImages = defaultVariant.images || [];
    variantImages = [...variantImages].map((v, i) => {
      const clone = v.cloneNode(true);
      clone.dataset.source = i ? 'variant' : 'lcp';
      return clone;
    });

    // grab fallback images
    const fallbackImages = block.querySelectorAll('.img-wrapper');

    // store clones for reset functionality
    state.set('defaultProductImages', Array.from(fallbackImages).map((img) => img.cloneNode(true)));

    // append slides from images
    [...variantImages, ...fallbackImages].forEach((el) => {
      const { source } = el.dataset;
      const slide = buildSlide(el, source);
      if (slide) {
        const img = slide.querySelector('img');
        if (img) {
          const src = new URL(img.src).pathname;
          if (src !== lcpSrc) wrapper.append(slide);
        }
      }
    });
  }

  const carousel = buildCarousel(gallery);
  buildThumbnails(carousel);

  return carousel;
}
