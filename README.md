# AEM Product Bus demo storefront

A reference e-commerce storefront built on AEM Edge Delivery Services and the [Helix Commerce API](https://main--helix-website--adobe.aem.page/drafts/dyland/product-bus-overview). Product data is managed through the Helix Commerce API and delivered to the storefront via the Product Bus — a pipeline that renders product HTML with embedded structured data, and provides a queryable product index for listing pages.

[Demo](https://main--aem-productbus-demo--dylandepass.aem.network/)

## Features

- **Product detail pages** — Image gallery with thumbnail navigation, variant selection (color swatches, size buttons), dynamic pricing with sale detection, add to cart with stock awareness, and related products
- **Product listing pages** — Filterable category pages with sub-navigation and price sorting, powered by the product index
- **Cart and minicart** — Client-side cart persisted in localStorage with a reactive slide-out minicart drawer
- **Checkout** — Order form with address collection, Stripe Checkout integration for payment processing, and order confirmation
- **Customer accounts** — Login/logout via magic link auth, order history, and saved addresses
- **Commerce adapter layer** — Pluggable adapter interface so the storefront can work with any commerce backend

## Commerce adapters

All commerce operations go through an abstracted API (`scripts/commerce/api.js`) that delegates to a swappable adapter.

- **Edge adapter** (`adapters/edge.js`) — Production adapter. Cart in localStorage, orders and auth proxied through a Cloudflare Worker to the Helix Commerce API
- **Mock adapter** (`adapters/mock.js`) — Fully client-side adapter for local development and testing with no backend required

To switch adapters at runtime:

```js
localStorage.setItem('commerce-adapter', 'mock');  // use mock
localStorage.removeItem('commerce-adapter');         // back to edge
```

## Project structure

```
blocks/
  pdp/            Product detail page
  plp/            Product listing page
  cart/           Cart page + checkout form
  header/         Navigation + minicart drawer
  new-arrivals/   Homepage product showcase
  order-confirmation/  Post-payment confirmation
  account/        Customer account pages

scripts/
  commerce/
    api.js        Public commerce API
    adapters/     Swappable backend adapters

styles/           Global styles and design tokens
```

## How product detail pages work

Product pages are rendered server-side by the Product Pipeline as static HTML with embedded [JSON-LD](https://json-schema.org/) structured data. The initial HTML is optimized for bots and crawlers — when the page loads in a browser, the client-side PDP block reconstructs the DOM from the structured data.

### Data sources

**JSON-LD** (`<script type="application/ld+json">` in the document head) is the primary data source. It contains product name, SKU, pricing, availability, variant options, and related products. The PDP block parses this in `blocks/pdp/pdp.js` via `parseJsonLd()` and uses it to drive all rendering.

**Initial HTML** provides a few things that aren't in the JSON-LD:
- **Product description** — authored content sections below the buy-box
- **Variant images** — `<picture>` elements inside variant `<div class="section">` elements, each tagged with `data-sku`
- **LCP image** — the first product image is extracted early and kept in the page for fast rendering

### PDP detection and block construction

PDP detection happens in `scripts/scripts.js` inside `buildAutoBlocks()`. When a `<meta name="sku">` tag is present in the document head, `buildPDPBlock()` runs:

1. Extracts the first `<picture>` as the LCP image and marks it `loading="eager"`
2. Stashes all variant sections (`div.section` elements) on `block.variantSections`
3. Stashes remaining authored content on `block.authoredContent`
4. Constructs the PDP block element and clears the original HTML

```js
// scripts/scripts.js — PDP detection
const metaSku = document.querySelector('meta[name="sku"]');
const pdpBlock = document.querySelector('.pdp');
if (metaSku && !pdpBlock) {
  buildPDPBlock(main);
}
```

### Component architecture

The PDP block (`blocks/pdp/pdp.js`) uses a reactive state container and component-based rendering. Each UI section is a function that takes `(ph, block, state)` and returns a DOM element:

| Component | File | What it renders |
|-----------|------|----------------|
| `renderGallery()` | `blocks/pdp/gallery.js` | Image carousel with thumbnail navigation |
| `renderPricing()` | `blocks/pdp/pricing.js` | Price display (final, regular, savings) |
| `renderOptions()` | `blocks/pdp/options.js` | Color swatches and size buttons |
| `renderAddToCart()` | `blocks/pdp/add-to-cart.js` | Quantity selector and cart button |
| `renderRelatedProducts()` | `blocks/pdp/related-products.js` | Related products carousel |

Components are assembled in `buildBuyBox()` and appended to the block in `decorate()`. The layout is controlled by a CSS Grid with named areas (`gallery`, `title`, `buy-box`, `content`, `related`).

### State management

`createState()` provides a lightweight reactive container with `get()`, `set()`, and `onChange()`. When a variant is selected, subscriptions automatically update the gallery, pricing, and add-to-cart:

```js
state.onChange('selectedVariant', () => updateGalleryImages(block, state));
state.onChange('selectedVariant', (variant) => {
  const el = renderPricing(ph, block, state, variant);
  if (el) block.querySelector('.pricing')?.replaceWith(el);
});
```

### Adding new PDP sections

New sections follow the same pattern:

1. Create a `renderNewSection(ph, block, state)` function that returns a DOM element
2. Add it to `buildBuyBox()` in the correct visual order
3. If it needs to react to variant changes, add a `state.onChange('selectedVariant', ...)` subscription in `decorate()`
4. Small additions (<30 lines) go directly in `pdp.js`; larger components get their own file in `blocks/pdp/`

For sections that need placeholder content (e.g., ratings, stock urgency), create the render function with realistic defaults and a `// TODO: Replace placeholder with real data` comment.

## Local development

```sh
npm install
aem up
```

Starts the AEM proxy at `http://localhost:3000`. Requires the [AEM CLI](https://github.com/adobe/helix-cli): `npm install -g @adobe/aem-cli`.

## Environments

- Preview: https://main--aem-productbus-demo--dylandepass.aem.page/
- Live: https://main--aem-productbus-demo--dylandepass.aem.live/
