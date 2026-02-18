---
name: redesign-pdp
description: Redesign the product details page (PDP) to match provided desktop and mobile screenshot designs
disable-model-invocation: true
argument-hint: [desktop-screenshot] [mobile-screenshot]
---

# PDP Redesign Skill

You are redesigning the product details page (PDP) to match the provided design screenshots.

**Desktop screenshot:** $0
**Mobile screenshot:** $1

Read both screenshots using the Read tool before doing anything else. Study every detail.

## Step 1: Analyze the design screenshots

Before writing any code, perform a detailed visual analysis of both screenshots. Create a structured comparison document identifying:

### Layout analysis
- **Desktop**: Where is the gallery? Where is the product info? What is the column ratio? How are elements ordered top-to-bottom in the info panel?
- **Mobile**: How does it stack? What order are elements in? Does the gallery layout change?
- **Gallery**: Where are thumbnails positioned (bottom, left, right)? What size are they? How does the selected state look?

### Element inventory
Go through each screenshot top-to-bottom and list EVERY visible element. For each one, note:
- What it is (title, price, rating, swatch, button, etc.)
- Its visual styling (font size, weight, color, borders, background)
- Its position relative to other elements
- Whether it exists in the current PDP implementation or is new

### Categorize elements as:
1. **Existing + unchanged**: Elements already in the PDP that look the same
2. **Existing + restyled**: Elements already in the PDP but with different styling
3. **New with data**: New elements where product data could drive them
4. **New placeholder**: New elements with no backing data — need static/placeholder content

## Step 2: Read the current PDP implementation

Read ALL of these files completely to understand the current implementation:

```
blocks/pdp/pdp.js          — Main decorator, state management, layout assembly
blocks/pdp/pdp.css          — Grid layout, all component styles
blocks/pdp/gallery.js       — Image carousel with thumbnails
blocks/pdp/gallery.css      — Gallery-specific styles
blocks/pdp/options.js       — Color/size variant pickers
blocks/pdp/add-to-cart.js   — Quantity selector and cart button
blocks/pdp/pricing.js       — Price display (final, regular, savings)
blocks/pdp/related-products.js  — Related products carousel
blocks/pdp/related-products.css — Related products styles
scripts/scripts.js          — buildCarousel, rebuildIndices, getOfferPricing, etc.
```

Understand:
- The reactive state system (`createState` with `get`, `set`, `onChange`)
- How components are rendered as functions returning DOM elements
- How the CSS grid defines the page layout
- How variant changes propagate (gallery, pricing, add-to-cart all subscribe to state)

## Step 3: Plan the implementation

Based on your analysis, create a concrete plan listing every file change with what specifically changes. Present this plan to the user for approval before writing code.

## Step 4: Implement changes

Follow these rules strictly:

### Architecture rules

1. **Follow existing patterns**: Every new component MUST follow the same pattern as existing ones:
   - Export a `render___()` function that takes `(ph, block, state)` or a subset
   - Return a DOM element (or DocumentFragment)
   - Use `document.createElement()` — no innerHTML for complex structures
   - Attach event listeners inline where needed

2. **Componentize aggressively**: Each distinct UI section gets its own render function. If a section is substantial (>30 lines), put it in its own file. Examples:
   - Star rating → `renderRating()` in its own file if complex, or inline function if simple
   - Stock urgency bar → `renderStockUrgency()`
   - Delivery estimate → `renderDeliveryInfo()`
   - Social proof ("X people viewing") → `renderSocialProof()`
   - Trust badges → `renderTrustBadges()`

3. **Placeholder sections**: For features without real data:
   - Create the render function with the same signature as if real data existed
   - Use realistic placeholder values (not "Lorem ipsum")
   - Add a comment: `// TODO: Replace placeholder with real data from [source]`
   - Structure the function so swapping in real data later is trivial (e.g., accept a `data` parameter with defaults)

4. **Never break existing functionality**:
   - Variant selection must still work
   - Gallery image swapping must still work
   - Add to cart must still work
   - Pricing updates on variant change must still work
   - URL-driven option pre-selection must still work

### CSS rules

1. **Use existing CSS variables** from `styles/styles.css`:
   - Colors: `--text-color`, `--text-color-secondary`, `--text-color-muted`, `--border-color`, `--border-color-strong`, `--accent-color`, `--error-color`, `--background-color`
   - Spacing: `--spacing-xxxs` through `--spacing-xl`
   - Typography: `--body-font-size-xs/s/m`, `--heading-font-size-l/xl/xxl`
   - Radii: `--radius-s/m/l/round`
   - Shadows: `--shadow-s/m`
   - Transitions: `--transition-fast/normal`
   - Button: `--button-primary-bg`, `--button-primary-hover-bg`, `--button-primary-disabled-bg`

2. **For new colors not in variables** (e.g., green for "In Stock", red for urgency), use hex values directly but keep them consistent across related elements.

3. **Grid layout**: The PDP uses CSS Grid with named areas. The grid areas are:
   - `gallery`, `buy-box`, `content`, `related`
   - Desktop switches to multi-column via `@media (width >= 900px)`
   - Match the screenshot layout exactly — determine which side the gallery is on

4. **Mobile-first**: Write base styles for mobile, then override in `@media (width >= 900px)` for desktop.

5. **Gallery thumbnail layout**: The gallery uses a carousel system. If thumbnails need to move (e.g., from bottom to left side), this is done via CSS on the `.gallery.carousel nav [role="radiogroup"]` — change from flex-row to flex-column, reposition with `order: -1`, etc.

### JavaScript rules

1. **Buy-box assembly order**: The `buildBuyBox()` function in `pdp.js` assembles all buy-box children. New sections are added here in the visual order they appear in the design.

2. **State subscriptions**: If a new section needs to update on variant change, add a `state.onChange('selectedVariant', ...)` subscription in the `decorate()` function.

3. **Import pattern**: New component files use:
   ```js
   import renderNewThing from './new-thing.js';
   ```
   and are called inside `buildBuyBox()` or `decorate()`.

4. **Quantity stepper**: If the design shows +/- buttons instead of a dropdown, replace the `<select>` in `add-to-cart.js` with a stepper pattern:
   ```js
   function createQuantityStepper() {
     // minus button, input[type=number], plus button
     // return { container, getValue }
   }
   ```

5. **Size Chart link**: If present, add to `options.js` inside the size option's `selectionContainer` using a wrapper div with `display: flex; justify-content: space-between`.

### File organization

- **Small additions** (< 30 lines of JS): Add as a function in `pdp.js`
- **Medium additions** (30-100 lines): Create a new file in `blocks/pdp/`
- **CSS**: All PDP styles go in `pdp.css` (which imports `gallery.css` and `related-products.css`). Only create a new CSS file if the component is as large as gallery or related-products.

## Step 5: Verify

After implementation:
1. Read back all modified files to verify consistency
2. Check that `buildBuyBox()` assembles elements in the correct visual order
3. Check that the grid layout matches the screenshot (gallery side, column ratios)
4. Check that all existing state subscriptions are preserved
5. Confirm all new render functions follow the pattern: take params, return DOM element
6. Confirm placeholder sections have TODO comments for future data integration

## Reference: Current PDP component structure

```
decorate(block)
  ├── parseJsonLd()           → product data from <script type="application/ld+json">
  ├── parseVariants()         → variant objects with sku, options, price, images
  ├── createState()           → reactive state container
  ├── renderTitle()           → wraps h1 in a <div class="title"> (separate grid area)
  ├── renderGallery()         → image carousel with thumbnails
  ├── buildBuyBox()           → assembles the info panel:
  │   ├── renderPricing()     → price display (final, regular, savings)
  │   ├── renderOptions()     → color swatches, size buttons
  │   └── renderAddToCart()   → quantity <select> dropdown + add to cart button
  ├── renderAuthoredContent() → markdown content sections
  ├── renderRelatedProducts() → related product cards carousel
  │
  ├── Appended to block: content, title, gallery, buyBox, related
  │
  └── state.onChange subscriptions:
      ├── updateGalleryImages()  → swap gallery on variant change
      ├── renderPricing()        → replace .pricing element on variant change
      └── renderAddToCart()      → replace .add-to-cart element on variant change
```

### Current CSS grid layout (main branch)

**Mobile (default):**
```css
grid-template-areas:
  "title"
  "gallery"
  "buy-box"
  "content"
  "related";
```

**Desktop (>=900px):**
```css
grid-template-columns: 2fr 3fr;
grid-template-areas:
  "title gallery"
  "buy-box gallery"
  "content gallery"
  "related related";
```
Title, buy-box, and content are on the LEFT. Gallery is on the RIGHT.
At >=1200px, columns become 1fr 1fr.

### Current gallery layout (main branch)

- **Mobile**: Horizontal carousel with pagination dots at bottom. Thumbnails hidden (dots only).
- **Desktop (>=900px)**: Horizontal thumbnail strip at bottom (58x58px buttons with images). Prev/next arrows on hover.
- Nav arrows are positioned absolutely inside the carousel. Thumbnails are in `nav [role="radiogroup"]` as a horizontal flex row.

### Current add-to-cart (main branch)

- `<select>` dropdown for quantity (1-10 options)
- Single "Add to Cart" `<button>` (max-width 320px on desktop)
- No wishlist, no terms, no buy-now, no action links

### Current options (main branch)

- Each option type gets a `.selection` container with a `.selected-option-label` div and a `.pdp-option-group` div
- Color: circular swatches (36px) with CSS variable backgrounds
- Size: rectangular buttons (min-width 42px, height 42px) with abbreviations
- No "Size Chart" link

## Reference: Available product data fields

From JSON-LD in document head:
```json
{
  "@type": "Product",
  "name": "Product Name",
  "offers": [{
    "sku": "VARIANT-SKU",
    "price": 399.99,
    "priceSpecification": { "price": 499.99 },
    "availability": "https://schema.org/InStock",
    "options": [
      { "id": "color", "value": "Red" },
      { "id": "size", "value": "Medium" }
    ]
  }],
  "custom": {
    "related": ["/path/to/related/product"]
  }
}
```

Fields that exist and can be used: name, sku, price, regular price, availability, color options, size options, images, related products.

Fields that do NOT exist (need placeholders): ratings, reviews, viewer count, sold count, vendor, category, tags, stock quantity, delivery dates, shipping policy.
