# AEM Product Bus demo storefront

A reference e-commerce storefront built on AEM Edge Delivery Services (EDS) and the Product Bus. This project demonstrates how to build a full shopping experience — product pages, category listings, cart, and checkout — using the Product Bus as the product data layer and AEM EDS as the delivery platform.

## Architecture overview

The site consumes product data from the Product Bus through two mechanisms:

1. **Product Pipeline** renders product HTML pages with embedded JSON-LD structured data. The PDP block reads this data at runtime — `window.jsonLdData` for product metadata and `window.variants` for variant information — and builds the interactive product experience on top of it.

2. **Product index** provides a queryable JSON feed of all products, used by the PLP and new arrivals blocks to render category pages and product grids.

All product content (images, descriptions, pricing, variants) originates from the Product Bus. The storefront never calls the Product Bus API directly from the browser — product data arrives pre-rendered via the pipeline, and order operations go through a server-side worker proxy.

## Product Bus integration

### Product detail pages

When a visitor hits a product URL, AEM EDS serves the HTML rendered by the Product Pipeline. This HTML includes:

- A server-rendered `<h1>` with the product name
- Product images as `<picture>` elements (optimized for LCP)
- JSON-LD structured data in a `<script>` tag containing the full product schema
- Variant sections with per-variant pricing, images, and option values

The PDP block (`blocks/pdp/`) reads this pre-rendered content and enhances it with:

- **Image gallery** with thumbnail navigation and variant-specific image swapping
- **Option selectors** for color (swatches) and size (buttons), supporting any number of option dimensions
- **Pricing display** with sale detection (comparing regular vs. final price)
- **Add to cart** with quantity selection and out-of-stock handling
- **Related products** carousel, lazy-loaded from paths stored in `custom.related`

Variant selection updates the gallery, pricing, URL parameters, and stock status without a page reload. The URL reflects the current selection (e.g., `?color=black&size=l`), making specific variants linkable.

### Product listing pages

The PLP block (`blocks/plp/`) fetches the product index at `/products/index.json` and renders filterable category pages. Products are grouped by authored category paths, with anchored sub-navigation and price sorting. Only parent products are shown (variants with `parentSku` are filtered out).

### New arrivals

The new arrivals block (`blocks/new-arrivals/`) also consumes the product index, displaying a configurable number of featured products on the homepage.

## Commerce adapter layer

All commerce operations (cart, orders, auth) go through a single abstracted API defined in `scripts/commerce/api.js`. This API delegates to a swappable adapter, making it possible to plug in any commerce backend without changing the UI code.

### Public API

```js
import { commerce } from './scripts/commerce/api.js';

// Cart
await commerce.addToCart({ sku, name, price, quantity, image, url });
await commerce.getCart();
await commerce.updateItemQuantity(sku, quantity);
await commerce.removeItem(sku);
await commerce.clearCart();

// Orders
await commerce.createOrder({ customer, shipping });
await commerce.getOrder(orderId, email);

// Auth
commerce.isLoggedIn();
commerce.getCustomer();

// Events
commerce.on(commerce.EVENTS.CART_UPDATED, (e) => { /* ... */ });
commerce.on(commerce.EVENTS.ORDER_CREATED, (e) => { /* ... */ });
```

Every cart mutation dispatches a `commerce:cart-updated` CustomEvent on `document` with the updated cart state and the action type (`add`, `update`, `remove`, `clear`). This event-driven architecture means UI components like the header badge and minicart drawer stay in sync automatically without direct coupling.

### Adapter interface

An adapter is a module that exports a default factory function returning an object with these methods:

```js
export default function createAdapter() {
  return {
    // Cart
    async addToCart(item) { },
    async getCart() { },
    async updateItemQuantity(sku, quantity) { },
    async removeItem(sku) { },
    async clearCart() { },

    // Orders
    async createOrder({ customer, shipping }) { },
    async getOrder(orderId, email) { },

    // Auth
    isLoggedIn() { },
    getCustomer() { },
  };
}
```

To add a new adapter, create a file at `scripts/commerce/adapters/{name}.js` implementing this interface. Switch adapters by changing the `ADAPTER` constant in `api.js`, or at runtime via `localStorage.setItem('commerce-adapter', 'name')`.

### Included adapters

#### Mock adapter (`adapters/mock.js`)

A fully client-side adapter for UI development and testing. Cart state persists in localStorage (`mock-cart` key). Orders are generated in-memory with auto-incrementing IDs and reset on page reload. No network calls, no backend required.

Useful for:
- Local development without API access
- UI testing and prototyping
- Demos without infrastructure dependencies

#### Edge adapter (`adapters/edge.js`)

The production adapter. Cart state lives in localStorage (`cart` key) with versioned storage and debounced persistence. A `cart_items_count` cookie is also set for potential server-side use.

Shipping is calculated client-side: free over $150, otherwise $10 flat rate.

Order operations call the Cloudflare Worker proxy, which forwards requests to the Helix Commerce API with server-side authentication. The browser never sees the API token.

### Writing a custom adapter

To integrate with a different commerce platform (e.g., Shopify, commercetools, Adobe Commerce), create a new adapter file:

```js
// scripts/commerce/adapters/shopify.js
export default function createShopifyAdapter() {
  return {
    async addToCart(item) {
      // Call Shopify Storefront API
      const cart = await shopifyClient.addLineItem(item.sku, item.quantity);
      return normalizeCart(cart);
    },
    async getCart() { /* ... */ },
    async updateItemQuantity(sku, quantity) { /* ... */ },
    async removeItem(sku) { /* ... */ },
    async clearCart() { /* ... */ },
    async createOrder({ customer, shipping }) { /* ... */ },
    async getOrder(orderId, email) { /* ... */ },
    isLoggedIn() { /* ... */ },
    getCustomer() { /* ... */ },
  };
}
```

The cart object returned by cart methods should have this shape:

```js
{
  items: [{ sku, name, price, quantity, image, url, currency }],
  itemCount: 3,
  subtotal: 47.00,
  shipping: 0,
}
```

## Cart

The cart is entirely client-side. Items are stored in localStorage per the active adapter's storage format, so the cart persists across page navigations and browser sessions.

### Cart icon and badge

The header displays a cart icon with an item count badge. The badge updates reactively via `commerce:cart-updated` events. On initial page load, `scripts/delayed.js` reads the cart from localStorage directly (without importing the commerce module) and sets the badge count — this runs 3 seconds after page load to avoid impacting LCP.

### Minicart drawer

Clicking the cart icon opens a slide-out drawer from the right side of the page. The minicart shows all cart items with:

- Product thumbnail and name
- Per-unit price
- Quantity controls (+/-)
- Remove button
- Subtotal
- Link to the full cart page

The minicart and commerce module are lazy-loaded on first interaction (click or add-to-cart event), keeping the initial page bundle small.

### Add to cart

The PDP's add-to-cart button collects the selected variant's SKU, name, price, image URL, and chosen quantity, then calls `commerce.addToCart()`. The minicart drawer opens automatically when an item is added.

## Checkout

### Cart page (`/cart`)

The cart block (`blocks/cart/`) renders a two-column layout:

**Left column** — full cart with line items, quantity controls, remove buttons, and line totals.

**Right column** — checkout form with:
- Contact (email, optional "create account" checkbox)
- Shipping address (name, address, city, state, zip, country)
- Order summary (subtotal, shipping, total)
- Place Order button

### Order flow

When the user clicks "Place Order":

1. **Validation** — all required fields are checked; empty fields get a red border highlight
2. **API call** — `commerce.createOrder()` sends customer and shipping data through the active adapter
3. **Worker proxy** (edge adapter) — the request goes to the Cloudflare Worker at `POST /orders`, which injects the API token and forwards to the Helix Commerce API at `POST /{org}/sites/{site}/orders`
4. **Cart clear** — on success, the cart is emptied via `commerce.clearCart()`
5. **Confirmation** — the page replaces both columns with an order confirmation showing the order ID and a "Continue Shopping" link

### Orders API proxy worker

The worker (`aem-productbus-demo-worker/`) is a Cloudflare Worker that proxies order requests to the Helix Commerce API. It exists so that the API token never reaches the browser.

**Endpoints:**

| Method | Path | Upstream |
|--------|------|----------|
| `POST` | `/orders` | `POST /{org}/sites/{site}/orders` |
| `GET` | `/orders/:id?email=...` | `GET /{org}/sites/{site}/customers/{email}/orders/{id}` |

**Configuration** (in `wrangler.toml`):

| Variable | Description |
|----------|-------------|
| `API_ORIGIN` | Helix Commerce API base URL |
| `API_ORG` | Organization slug |
| `API_SITE` | Site slug |
| `ALLOWED_ORIGIN` | CORS allowed origin |
| `API_TOKEN` | API bearer token (set via `wrangler secret put API_TOKEN`) |

The worker handles CORS preflight, adds the `Authorization` header, and forwards upstream error responses with logging.

## Project structure

```
blocks/
  cart/           Cart page + checkout form
  pdp/            Product detail page (gallery, options, pricing, add-to-cart, related)
  plp/            Product listing page with category filtering
  header/         Navigation + minicart drawer
  footer/         Footer with fragment loading
  hero/           Hero banner
  carousel/       Auto-rotating image carousel
  cards/          Generic card layout
  category-cards/ Category navigation cards
  columns/        Multi-column layout
  fragment/       Fragment inclusion
  new-arrivals/   Homepage product showcase

scripts/
  aem.js          AEM EDS framework core (blocks, sections, icons, RUM)
  scripts.js      App utilities (pricing, carousel, variant parsing, auto-blocking)
  delayed.js      Post-LCP deferred work (cart badge)
  commerce/
    api.js        Public commerce API (adapter-agnostic)
    events.js     Commerce event constants and dispatch helpers
    adapters/
      mock.js     Client-side mock (localStorage, no backend)
      edge.js     Production adapter (localStorage cart + worker proxy orders)

styles/
  styles.css      Global styles, design tokens, typography
  fonts.css       Web font declarations
  lazy-styles.css Deferred styles

icons/            SVG icons (cart, search, etc.)
```

## Local development

```sh
npm install
aem up
```

This starts the AEM proxy at `http://localhost:3000`. Ensure the [AEM CLI](https://github.com/adobe/helix-cli) is installed globally: `npm install -g @adobe/aem-cli`.

### Switching adapters

By default the site uses the `edge` adapter. To develop without the worker/API:

```js
localStorage.setItem('commerce-adapter', 'mock');
```

Reload the page. The mock adapter runs entirely in the browser with no network calls. To switch back:

```js
localStorage.removeItem('commerce-adapter');
```

### Worker development

```sh
cd ../aem-productbus-demo-worker
npm run dev     # Local dev server
npm run deploy  # Deploy to Cloudflare Workers
```

Set the API token secret:

```sh
wrangler secret put API_TOKEN
```

## Environments

- Preview: https://main--aem-productbus-demo--dylandepass.aem.page/
- Live: https://main--aem-productbus-demo--dylandepass.aem.live/
