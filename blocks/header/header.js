import { getMetadata } from '../../scripts/aem.js';
import { loadFragment } from '../fragment/fragment.js';

// media query match that indicates mobile/tablet width
const isDesktop = window.matchMedia('(min-width: 900px)');

function closeOnEscape(e) {
  if (e.code === 'Escape') {
    const nav = document.getElementById('nav');
    const navSections = nav.querySelector('.nav-sections');
    if (!navSections) return;
    const navSectionExpanded = navSections.querySelector('[aria-expanded="true"]');
    if (navSectionExpanded && isDesktop.matches) {
      // eslint-disable-next-line no-use-before-define
      toggleAllNavSections(navSections);
      navSectionExpanded.focus();
    } else if (!isDesktop.matches) {
      // eslint-disable-next-line no-use-before-define
      toggleMenu(nav, navSections);
      nav.querySelector('button').focus();
    }
  }
}

function closeOnFocusLost(e) {
  const nav = e.currentTarget;
  if (!nav.contains(e.relatedTarget)) {
    const navSections = nav.querySelector('.nav-sections');
    if (!navSections) return;
    const navSectionExpanded = navSections.querySelector('[aria-expanded="true"]');
    if (navSectionExpanded && isDesktop.matches) {
      // eslint-disable-next-line no-use-before-define
      toggleAllNavSections(navSections, false);
    } else if (!isDesktop.matches) {
      // eslint-disable-next-line no-use-before-define
      toggleMenu(nav, navSections, false);
    }
  }
}

function openOnKeydown(e) {
  const focused = document.activeElement;
  const isNavDrop = focused.className === 'nav-drop';
  if (isNavDrop && (e.code === 'Enter' || e.code === 'Space')) {
    const dropExpanded = focused.getAttribute('aria-expanded') === 'true';
    // eslint-disable-next-line no-use-before-define
    toggleAllNavSections(focused.closest('.nav-sections'));
    focused.setAttribute('aria-expanded', dropExpanded ? 'false' : 'true');
  }
}

function focusNavSection() {
  document.activeElement.addEventListener('keydown', openOnKeydown);
}

/**
 * Toggles all nav sections
 * @param {Element} sections The container element
 * @param {Boolean} expanded Whether the element should be expanded or collapsed
 */
function toggleAllNavSections(sections, expanded = false) {
  if (!sections) return;
  sections.querySelectorAll('.nav-sections-ul-wrapper > ul > li').forEach((section) => {
    section.setAttribute('aria-expanded', expanded);
    if (!expanded || expanded === 'false') {
      section.classList.remove('expanded');
    }
  });
}

/**
 * Toggles the entire nav
 * @param {Element} nav The container element
 * @param {Element} navSections The nav sections within the container element
 * @param {*} forceExpanded Optional param to force nav expand behavior when not null
 */
function toggleMenu(nav, navSections, forceExpanded = null) {
  const expanded = forceExpanded !== null ? !forceExpanded : nav.getAttribute('aria-expanded') === 'true';
  const button = nav.querySelector('.nav-hamburger button');
  document.body.style.overflowY = (expanded || isDesktop.matches) ? '' : 'hidden';
  nav.setAttribute('aria-expanded', expanded ? 'false' : 'true');
  toggleAllNavSections(navSections, expanded || isDesktop.matches ? 'false' : 'true');
  button.setAttribute('aria-label', expanded ? 'Open navigation' : 'Close navigation');
  // enable nav dropdown keyboard accessibility
  if (navSections) {
    const navDrops = navSections.querySelectorAll('.nav-drop');
    if (isDesktop.matches) {
      navDrops.forEach((drop) => {
        if (!drop.hasAttribute('tabindex')) {
          drop.setAttribute('tabindex', 0);
          drop.addEventListener('focus', focusNavSection);
        }
      });
    } else {
      navDrops.forEach((drop) => {
        drop.removeAttribute('tabindex');
        drop.removeEventListener('focus', focusNavSection);
      });
    }
  }

  // enable menu collapse on escape keypress
  if (!expanded || isDesktop.matches) {
    // collapse menu on escape press
    window.addEventListener('keydown', closeOnEscape);
    // collapse menu on focus lost
    nav.addEventListener('focusout', closeOnFocusLost);
  } else {
    window.removeEventListener('keydown', closeOnEscape);
    nav.removeEventListener('focusout', closeOnFocusLost);
  }
}

/**
 * loads and decorates the header, mainly the nav
 * @param {Element} block The header block element
 */
export default async function decorate(block) {
  // load nav as fragment
  const navMeta = getMetadata('nav');
  const navPath = navMeta ? new URL(navMeta, window.location).pathname : '/nav';
  const fragment = await loadFragment(navPath);

  // decorate nav DOM
  block.textContent = '';
  const nav = document.createElement('nav');
  nav.id = 'nav';
  while (fragment.firstElementChild) nav.append(fragment.firstElementChild);

  const classes = ['brand', 'sections', 'tools'];
  classes.forEach((c, i) => {
    const section = nav.children[i];
    if (section) section.classList.add(`nav-${c}`);
  });

  const navBrand = nav.querySelector('.nav-brand');
  const brandLink = navBrand.querySelector('.button');
  if (brandLink) {
    brandLink.className = '';
    // brandLink.closest('.button-container')?.className = '';
  }

  const navSections = nav.querySelector('.nav-sections');
  if (navSections) {
    // Wrap nav list in .nav-sections-ul-wrapper (expected by header.css for flyout/inline layout)
    const navList = navSections.querySelector(':scope .default-content-wrapper > ul');
    if (navList) {
      const ulWrapper = document.createElement('div');
      ulWrapper.className = 'nav-sections-ul-wrapper';
      ulWrapper.append(navList);
      navSections.prepend(ulWrapper);
    }

    // Convert nav text to links
    const toSlug = (text) => text.toLowerCase().replace(/[&,]+/g, '').replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');

    navSections.querySelectorAll(':scope .nav-sections-ul-wrapper > ul > li').forEach((navSection) => {
      // Convert top-level <p> to <a> with /{slug} href
      const p = navSection.querySelector(':scope > p');
      if (p) {
        const text = p.textContent.trim();
        const slug = toSlug(text);
        const a = document.createElement('a');
        a.href = `/${slug}`;
        a.textContent = text;
        p.replaceWith(a);
      }

      // Convert sub-items to <a> with /{parent-slug}#{sub-slug}
      const parentLink = navSection.querySelector(':scope > a');
      const parentSlug = parentLink ? toSlug(parentLink.textContent.trim()) : '';
      navSection.querySelectorAll(':scope > ul > li').forEach((subItem) => {
        if (!subItem.querySelector('a')) {
          const text = subItem.textContent.trim();
          const subSlug = toSlug(text);
          const a = document.createElement('a');
          a.href = `/${parentSlug}#${subSlug}`;
          a.textContent = text;
          subItem.textContent = '';
          subItem.append(a);
        }
      });

      if (navSection.querySelector('ul')) navSection.classList.add('nav-drop');
      navSection.addEventListener('click', (e) => {
        if (isDesktop.matches) {
          const expanded = navSection.getAttribute('aria-expanded') === 'true';
          toggleAllNavSections(navSections);
          navSection.setAttribute('aria-expanded', expanded ? 'false' : 'true');
        } else if (navSection.classList.contains('nav-drop')) {
          e.preventDefault();
          const isExpanded = navSection.classList.contains('expanded');
          // collapse all siblings first
          navSections.querySelectorAll('.nav-sections-ul-wrapper > ul > li.expanded').forEach((li) => {
            li.classList.remove('expanded');
          });
          if (!isExpanded) {
            navSection.classList.add('expanded');
          }
        }
      });
    });
  }

  // hamburger for mobile
  const hamburger = document.createElement('div');
  hamburger.classList.add('nav-hamburger');
  hamburger.innerHTML = `<button type="button" aria-controls="nav" aria-label="Open navigation">
      <span class="nav-hamburger-icon"></span>
    </button>`;
  hamburger.addEventListener('click', () => toggleMenu(nav, navSections));
  nav.prepend(hamburger);
  nav.setAttribute('aria-expanded', 'false');
  // prevent mobile nav behavior on window resize
  toggleMenu(nav, navSections, isDesktop.matches);
  isDesktop.addEventListener('change', () => toggleMenu(nav, navSections, isDesktop.matches));

  // nav tools: sign in + cart
  const navTools = nav.querySelector('.nav-tools');
  if (navTools) {
    // --- Sign In / Account button ---
    const signinBtn = document.createElement('button');
    signinBtn.className = 'nav-signin';
    signinBtn.type = 'button';
    signinBtn.textContent = 'Sign In';
    navTools.append(signinBtn);

    const logoutBtn = document.createElement('button');
    logoutBtn.className = 'nav-logout';
    logoutBtn.type = 'button';
    logoutBtn.setAttribute('aria-label', 'Logout');
    navTools.append(logoutBtn);

    let authPanel = null;
    const ensureAuthPanel = async () => {
      if (authPanel) return authPanel;
      const authMod = await import('./auth-panel.js');
      authPanel = authMod.default();
      return authPanel;
    };

    const updateAuthUI = (loggedIn, email) => {
      if (loggedIn && email) {
        const [localPart] = email.split('@');
        signinBtn.textContent = localPart;
        signinBtn.setAttribute('aria-label', `Account: ${email}`);
        logoutBtn.style.display = '';
      } else {
        signinBtn.textContent = 'Sign In';
        signinBtn.setAttribute('aria-label', 'Sign In');
        logoutBtn.style.display = 'none';
      }
    };

    signinBtn.addEventListener('click', async () => {
      const hasToken = !!sessionStorage.getItem('auth_token');
      if (hasToken) {
        window.location.href = '/account';
      } else {
        const panel = await ensureAuthPanel();
        panel.showEmailStep();
        panel.open();
      }
    });

    logoutBtn.addEventListener('click', async () => {
      const { commerce } = await import('../../scripts/commerce/api.js');
      await commerce.logout();
    });

    document.addEventListener('commerce:auth-state-changed', (e) => {
      updateAuthUI(e.detail.loggedIn, e.detail.email);
    });

    document.addEventListener('commerce:open-auth-panel', async () => {
      const panel = await ensureAuthPanel();
      panel.showEmailStep();
      panel.open();
    });

    // restore auth UI on load
    try {
      const userRaw = localStorage.getItem('auth_user');
      if (userRaw) {
        const user = JSON.parse(userRaw);
        const hasToken = !!sessionStorage.getItem('auth_token');
        if (hasToken && user?.email) {
          updateAuthUI(true, user.email);
        }
      }
    } catch { /* ignore */ }

    // --- Cart button + minicart ---
    const cartBtn = document.createElement('button');
    cartBtn.className = 'nav-cart-button';
    cartBtn.type = 'button';
    cartBtn.setAttribute('aria-label', 'Cart');
    navTools.append(cartBtn);

    let drawer = null;
    const ensureMinicart = async () => {
      if (drawer) return drawer;
      const [minicartMod, { commerce }] = await Promise.all([
        import('./minicart.js'),
        import('../../scripts/commerce/api.js'),
      ]);
      drawer = minicartMod.default(nav);

      commerce.on(commerce.EVENTS.CART_UPDATED, (e) => {
        const { cart } = e.detail;
        if (cart.itemCount > 0) {
          cartBtn.dataset.count = cart.itemCount;
        } else {
          delete cartBtn.dataset.count;
        }
        drawer.refresh(cart);
      });

      const cart = await commerce.getCart();
      if (cart.itemCount > 0) cartBtn.dataset.count = cart.itemCount;
      drawer.refresh(cart);
      return drawer;
    };

    // Set initial badge from cookie so it shows on every page load
    const cookieMatch = document.cookie.match(/cart_items_count=(\d+)/);
    if (cookieMatch) {
      const [, count] = cookieMatch;
      if (Number(count) > 0) cartBtn.dataset.count = count;
    }

    cartBtn.addEventListener('click', async () => {
      const d = await ensureMinicart();
      d.open();
    });

    document.addEventListener('commerce:cart-updated', async (e) => {
      const { cart, action } = e.detail || {};
      // Update badge for all cart events
      if (cart && cart.itemCount > 0) {
        cartBtn.dataset.count = cart.itemCount;
      } else {
        delete cartBtn.dataset.count;
      }
      // Open minicart only on add
      if (action === 'add') {
        const d = await ensureMinicart();
        d.open();
      }
    });
  }

  const navWrapper = document.createElement('div');
  navWrapper.className = 'nav-wrapper';
  navWrapper.append(nav);
  block.append(navWrapper);
}
