// update cart badge from localStorage (runs after LCP)
try {
  const raw = localStorage.getItem('cart');
  if (raw) {
    const parsed = JSON.parse(raw);
    const items = parsed.items || parsed;
    const count = (Array.isArray(items) ? items : []).reduce(
      (sum, item) => sum + (item.quantity || 0),
      0,
    );
    if (count > 0) {
      const cartBtn = document.querySelector('.nav-cart-button');
      if (cartBtn) cartBtn.dataset.count = count;
    }
  }
} catch { /* empty */ }
