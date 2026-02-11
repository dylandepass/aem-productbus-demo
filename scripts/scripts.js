import {
  buildBlock,
  loadHeader,
  loadFooter,
  decorateButtons,
  decorateIcons,
  decorateSections,
  decorateBlocks,
  decorateTemplateAndTheme,
  waitForFirstImage,
  loadSection,
  loadSections,
  loadCSS,
} from './aem.js';

/**
 * Extracts pricing from a JSON-LD offer object.
 * @param {Object} offer - A schema.org Offer from the JSON-LD data
 * @returns {Object|null} An object containing the final and regular price.
 */
export function getOfferPricing(offer) {
  if (!offer) return null;
  return {
    final: parseFloat(offer.price),
    regular: offer.priceSpecification?.price || null,
  };
}

/**
 * Formats a price using the locale and currency from placeholders.
 * Uses Intl.NumberFormat for locale-aware currency formatting.
 * @param {number} value - The price value to format
 * @param {Object} ph - Placeholders object containing languageCode and currencyCode
 * @returns {string} The formatted price string (e.g., "$399.95" or "399,95 $")
 */
export function formatPrice(value, ph) {
  const locale = (ph.languageCode || 'en_US').replace('_', '-');
  const currency = ph.currencyCode || 'USD';
  return new Intl.NumberFormat(locale, { style: 'currency', currency }).format(value);
}

/**
 * Get horizontal gap between carousel items.
 * @param {HTMLElement} carousel - Carousel element
 * @returns {number} Gap size in pixels
 */
function getGapSize(carousel) {
  const styles = getComputedStyle(carousel);
  const gap = styles.gap || styles.columnGap;
  return parseFloat(gap) || 0;
}

/**
 * Calculates total width of single slide (including gap to next slide).
 * @param {HTMLElement} carousel - Carousel element
 * @returns {number} Slide width, including the gap, in pixels
 */
function getSlideWidth(carousel) {
  const slide = carousel.querySelector('li');
  return slide ? slide.offsetWidth + getGapSize(carousel) : 0;
}

/**
 * Determines how many slides are currently visible in carousel viewport.
 * @param {HTMLElement} container - Container element
 * @returns {number} Number of fully visible slides
 */
function getVisibleSlides(container) {
  const carousel = container.querySelector('ul');
  const slide = carousel.querySelector('li');
  if (!carousel || !slide) return 1;

  const slideWidthWithGap = slide.offsetWidth + getGapSize(carousel);
  return Math.max(1, Math.round(carousel.clientWidth / slideWidthWithGap));
}

/**
 * Builds a single index element for carousel navigation.
 * @param {number} i - Index of the slide
 * @param {HTMLElement} carousel - Carousel element
 * @param {HTMLElement} indices - Container element for index buttons
 * @returns {HTMLButtonElement} Constructed carousel index button
 */
function buildCarouselIndex(i, carousel, indices) {
  const index = document.createElement('button');
  index.type = 'button';
  index.setAttribute('aria-label', `Go to slide ${i + 1}`);
  index.setAttribute('aria-checked', !i);
  index.setAttribute('role', 'radio');
  index.addEventListener('click', () => {
    indices.querySelectorAll('button').forEach((b) => {
      b.setAttribute('aria-checked', b === index);
    });
    carousel.scrollTo({
      left: i * getSlideWidth(carousel),
      behavior: 'smooth',
    });
  });
  return index;
}

/**
 * Builds and appends carousel index buttons for navigation.
 * @param {HTMLElement} carousel - Carousel element
 * @param {HTMLElement} indices - Container element where index buttons will be appended
 */
function buildCarouselIndices(carousel, indices) {
  indices.innerHTML = '';
  const slides = [...carousel.children];
  slides.forEach((s, i) => {
    const index = buildCarouselIndex(i, carousel, indices);
    indices.append(index);
  });
}

/**
 * Rebuilds carousel index buttons.
 * @param {HTMLElement} carousel - Carousel element
 */
export function rebuildIndices(carousel) {
  const slides = carousel.querySelector('ul');
  const indices = carousel.querySelector('nav [role="radiogroup"]');
  if (!slides || !indices) return;

  buildCarouselIndices(slides, indices);
}

/**
 * Initializes and builds a scrollable carousel with navigation controls.
 * @param {HTMLElement} container - Container element that wraps the carousel `<ul>`.
 * @param {boolean} [pagination=true] - Whether to display pagination indicators.
 * @returns {HTMLElement} Carousel container.
 */
export function buildCarousel(container, pagination = true) {
  const carousel = container.querySelector('ul');
  if (!carousel) return null;
  const slides = [...carousel.children];
  if (!slides || slides.length <= 0) return null;
  container.classList.add('carousel');

  // build navigation
  const navEl = document.createElement('nav');
  navEl.setAttribute('aria-label', 'Carousel navigation');
  container.append(navEl);

  // build arrows
  ['Previous', 'Next'].forEach((label, i) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = `nav-arrow nav-arrow-${label.toLowerCase()}`;
    button.setAttribute('aria-label', `${label} frame`);
    button.addEventListener('click', () => {
      const slideWidth = getSlideWidth(carousel);
      const visible = getVisibleSlides(container);
      const { scrollLeft } = carousel;
      const current = Math.round(scrollLeft / slideWidth);

      if (!i) { // Previous button
        if (current <= 0) {
          carousel.scrollTo({
            left: (slides.length - visible) * slideWidth,
            behavior: 'smooth',
          });
        } else {
          carousel.scrollBy({
            left: -slideWidth * visible,
            behavior: 'smooth',
          });
        }
      } else if (current >= slides.length - visible) {
        carousel.scrollTo({
          left: 0,
          behavior: 'smooth',
        });
      } else {
        carousel.scrollBy({
          left: slideWidth * visible,
          behavior: 'smooth',
        });
      }
    });
    navEl.append(button);
  });

  if (pagination) {
    // build indices
    const indices = document.createElement('div');
    indices.setAttribute('role', 'radiogroup');
    navEl.append(indices);
    buildCarouselIndices(carousel, indices);

    carousel.addEventListener('scroll', () => {
      const { scrollLeft } = carousel;
      const current = Math.round(scrollLeft / getSlideWidth(carousel));
      [...indices.querySelectorAll('button')].forEach((btn, i) => {
        btn.setAttribute('aria-checked', i === current);
      });
    });
  }

  // hide nav if all slides are visible
  const observer = new ResizeObserver(() => {
    const visible = getVisibleSlides(container);
    if (slides.length <= visible) navEl.style.visibility = 'hidden';
    else navEl.removeAttribute('style');
  });
  observer.observe(carousel);

  return container;
}

/**
 * Parses variant sections from the Product Pipeline HTML.
 * @param {Array<Element>} sections - The variant section elements
 * @returns {Array<Object>} Array of variant objects with metadata, options, price, and images
 */
function parseVariants(sections) {
  return sections.map((div) => {
    const name = div.querySelector('h2')?.textContent.trim();

    const metadata = {};
    const options = {};

    options.uid = div.dataset.uid;
    options.color = div.dataset.color;
    metadata.sku = div.dataset.sku;

    const imagesHTML = div.querySelectorAll('picture');

    const ldVariant = window.jsonLdData.offers.find((offer) => offer.sku === metadata.sku);
    const price = getOfferPricing(ldVariant);
    if (ldVariant) {
      metadata.availability = ldVariant.availability;
    }

    return {
      ...metadata,
      name,
      options,
      price,
      images: imagesHTML,
    };
  });
}

/**
 * Checks if a variant is out of stock by SKU.
 * @param {string} sku - The variant SKU to check
 * @returns {boolean} True if the variant is out of stock
 */
export function checkVariantOutOfStock(sku) {
  const offer = window.jsonLdData.offers.find((o) => o.sku === sku);
  if (!offer) return true;
  return offer.availability === 'https://schema.org/OutOfStock';
}

/**
 * Checks if the entire product is out of stock (all variants OOS).
 * @returns {boolean} True if the product is out of stock
 */
export function isProductOutOfStock() {
  const { offers } = window.jsonLdData;

  if (!offers || offers.length === 0) return true;

  return !offers.some((offer) => offer.availability === 'https://schema.org/InStock');
}

/**
 * Builds hero block and prepends to main in a new section.
 * @param {Element} main The container element
 */
function buildHeroBlock(main) {
  const h1 = main.querySelector('h1');
  const picture = main.querySelector('picture');
  // eslint-disable-next-line no-bitwise
  if (h1 && picture && (h1.compareDocumentPosition(picture) & Node.DOCUMENT_POSITION_PRECEDING)) {
    if (h1.closest('.hero') || picture.closest('.hero')) {
      return;
    }
    const section = document.createElement('div');
    section.append(buildBlock('hero', { elems: [picture, h1] }));
    main.prepend(section);
  }
}

/**
 * Builds the PDP block from Product Pipeline rendered HTML.
 * @param {Element} main The container element
 */
function buildPDPBlock(main) {
  const section = document.createElement('div');

  // Find LCP picture element from variant section or first picture
  const lcpPicture = main.querySelector('div.section picture') || main.querySelector('picture:first-of-type');

  if (lcpPicture) {
    const lcpImage = lcpPicture.querySelector('img');
    if (lcpImage) {
      lcpImage.loading = 'eager';
    }

    const selectedImage = document.createElement('div');
    selectedImage.classList.add('lcp-image');
    selectedImage.append(lcpPicture.cloneNode(true));

    const lcp = main.querySelector('div:first-child');
    lcp.append(selectedImage);
    lcp.remove();

    if (!main.querySelector('h2')) {
      lcpPicture.remove();
    }

    section.append(buildBlock('pdp', { elems: [...lcp.children] }));
  }

  // Get the JSON-LD from the head and parse it
  const jsonLd = document.head.querySelector('script[type="application/ld+json"]');
  window.jsonLdData = jsonLd ? JSON.parse(jsonLd.textContent) : null;

  const variantSections = Array.from(main.querySelectorAll(':scope > div.section'));

  // Parse variants
  window.variants = parseVariants(variantSections);

  // Store remaining authored content sections
  window.authoredContent = Array.from(main.querySelectorAll(':scope > div'));

  main.textContent = '';
  main.prepend(section);
}

/**
 * load fonts.css and set a session storage flag
 */
async function loadFonts() {
  await loadCSS(`${window.hlx.codeBasePath}/styles/fonts.css`);
  try {
    if (!window.location.hostname.includes('localhost')) sessionStorage.setItem('fonts-loaded', 'true');
  } catch (e) {
    // do nothing
  }
}

/**
 * Builds all synthetic blocks in a container element.
 * @param {Element} main The container element
 */
function buildAutoBlocks(main) {
  try {
    // auto load `*/fragments/*` references
    const fragments = [...main.querySelectorAll('a[href*="/fragments/"]')].filter((f) => !f.closest('.fragment'));
    if (fragments.length > 0) {
      // eslint-disable-next-line import/no-cycle
      import('../blocks/fragment/fragment.js').then(({ loadFragment }) => {
        fragments.forEach(async (fragment) => {
          try {
            const { pathname } = new URL(fragment.href);
            const frag = await loadFragment(pathname);
            fragment.parentElement.replaceWith(...frag.children);
          } catch (error) {
            // eslint-disable-next-line no-console
            console.error('Fragment loading failed', error);
          }
        });
      });
    }

    // setup PDP
    const metaSku = document.querySelector('meta[name="sku"]');
    const pdpBlock = document.querySelector('.pdp');
    if (metaSku && !pdpBlock) {
      buildPDPBlock(main);
    }
    if (metaSku || pdpBlock) {
      document.body.classList.add('pdp-template');
    }

    buildHeroBlock(main);
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('Auto Blocking failed', error);
  }
}

/**
 * Decorates the main element.
 * @param {Element} main The main element
 */
// eslint-disable-next-line import/prefer-default-export
export function decorateMain(main) {
  decorateButtons(main);
  decorateIcons(main);
  buildAutoBlocks(main);
  decorateSections(main);
  decorateBlocks(main);
}

/**
 * Loads everything needed to get to LCP.
 * @param {Element} doc The container element
 */
async function loadEager(doc) {
  document.documentElement.lang = 'en';
  decorateTemplateAndTheme();
  const main = doc.querySelector('main');
  if (main) {
    decorateMain(main);
    document.body.classList.add('appear');
    await loadSection(main.querySelector('.section'), waitForFirstImage);
  }

  try {
    /* if desktop (proxy for fast connection) or fonts already loaded, load fonts.css */
    if (window.innerWidth >= 900 || sessionStorage.getItem('fonts-loaded')) {
      loadFonts();
    }
  } catch (e) {
    // do nothing
  }
}

/**
 * Loads everything that doesn't need to be delayed.
 * @param {Element} doc The container element
 */
async function loadLazy(doc) {
  loadHeader(doc.querySelector('header'));

  const main = doc.querySelector('main');
  await loadSections(main);

  const { hash } = window.location;
  const element = hash ? doc.getElementById(hash.substring(1)) : false;
  if (hash && element) element.scrollIntoView();

  loadFooter(doc.querySelector('footer'));

  loadCSS(`${window.hlx.codeBasePath}/styles/lazy-styles.css`);
  loadFonts();
}

/**
 * Loads everything that happens a lot later,
 * without impacting the user experience.
 */
function loadDelayed() {
  // eslint-disable-next-line import/no-cycle
  window.setTimeout(() => import('./delayed.js'), 3000);
}

async function loadPage() {
  await loadEager(document);
  await loadLazy(document);
  loadDelayed();
}

loadPage();
