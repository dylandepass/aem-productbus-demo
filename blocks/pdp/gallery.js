import { buildCarousel, rebuildIndices } from '../../scripts/scripts.js';

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
 * Updates gallery images when the selected variant changes.
 * @param {Element} block - The PDP block element
 * @param {Object} state - The PDP state object
 */
export function updateGalleryImages(block, state) {
  const variant = state.get('selectedVariant');
  if (!variant) return;

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

  const lcpSibling = slides.querySelector('[data-source="lcp"]')?.nextElementSibling;
  variantImages.slice(1).forEach((pic) => {
    const slide = buildSlide(pic, 'variant');
    if (slide) slides.insertBefore(slide, lcpSibling);
  });

  rebuildIndices(gallery);
  buildThumbnails(gallery);
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
