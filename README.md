# AEM Product Bus demo storefront

A reference e-commerce storefront built on AEM Edge Delivery Services and the [Helix Commerce API](https://main--helix-website--adobe.aem.page/drafts/dyland/product-bus-overview). Product data is managed through the Helix Commerce API and delivered to the storefront via the Product Bus — a pipeline that renders product HTML with embedded structured data, and provides a queryable product index for listing pages.

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

## Local development

```sh
npm install
aem up
```

Starts the AEM proxy at `http://localhost:3000`. Requires the [AEM CLI](https://github.com/adobe/helix-cli): `npm install -g @adobe/aem-cli`.

## Environments

- Preview: https://main--aem-productbus-demo--dylandepass.aem.page/
- Live: https://main--aem-productbus-demo--dylandepass.aem.live/
