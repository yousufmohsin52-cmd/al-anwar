/**
 * AL ANWAR FABRICS & CLOTH - Customer Storefront Application
 * WhatsApp Integration: +923363925950
 * M.A. Jinnah Road, Iqbal Cloth Market, Shop # M101/1, Karachi
 */

const APP_STATE = {
  products: [],
  categories: [],
  announcements: [],
  heroSlides: [],
  currentCategory: 'All',
  searchQuery: '',
  sortBy: 'newest',
  cart: JSON.parse(localStorage.getItem('al_anwar_cart') || '[]'),
  wishlist: JSON.parse(localStorage.getItem('al_anwar_wishlist') || '[]'),
  currentSlideIndex: 0,
  slideTimer: null,
  announcementIndex: 0,
  announcementTimer: null,
  whatsappNumber: '+923363925950',
  freeDeliveryThreshold: 5000,
  deliveryFee: 300
};

// Initialize app on DOM ready
document.addEventListener('DOMContentLoaded', async () => {
  initUIEventListeners();
  updateCartBadge();
  updateWishlistBadge();
  await loadCMSData();
  await loadCategories();
  await loadProducts();
});

// 1. CMS & Site Info Loading
async function loadCMSData() {
  try {
    const res = await fetch('/api/cms/public');
    const data = await res.json();
    if (data.success) {
      if (data.announcements && data.announcements.length > 0) {
        APP_STATE.announcements = data.announcements;
        startAnnouncementRotation();
      }
      if (data.heroSlides && data.heroSlides.length > 0) {
        APP_STATE.heroSlides = data.heroSlides;
        renderHeroCarousel();
      }
      if (data.storeSettings && data.storeSettings.whatsapp) {
        APP_STATE.whatsappNumber = data.storeSettings.whatsapp;
      }
    }
  } catch (err) {
    console.warn('CMS data load fallback:', err.message);
  }
}

function startAnnouncementRotation() {
  const el = document.getElementById('announcementText');
  if (!el || APP_STATE.announcements.length === 0) return;

  el.textContent = APP_STATE.announcements[0];
  if (APP_STATE.announcements.length > 1) {
    clearInterval(APP_STATE.announcementTimer);
    APP_STATE.announcementTimer = setInterval(() => {
      APP_STATE.announcementIndex = (APP_STATE.announcementIndex + 1) % APP_STATE.announcements.length;
      el.style.opacity = '0';
      setTimeout(() => {
        el.textContent = APP_STATE.announcements[APP_STATE.announcementIndex];
        el.style.opacity = '1';
      }, 300);
    }, 4500);
  }
}

function renderHeroCarousel() {
  const container = document.getElementById('heroSlideContainer');
  const dotsContainer = document.getElementById('heroDots');
  if (!container || APP_STATE.heroSlides.length === 0) return;

  container.innerHTML = APP_STATE.heroSlides.map((slide, idx) => `
    <div class="hero-slide ${idx === 0 ? 'active' : ''}" data-index="${idx}">
      <div class="hero-slide-bg" style="${slide.image ? `background-image: linear-gradient(to right, rgba(255,255,255,0.6) 0%, rgba(255,255,255,0.15) 45%, rgba(0,0,0,0) 80%), url('${slide.image}'); background-size: cover; background-position: center right;` : ''}"></div>
      <div class="container">
        <div class="hero-content">
          <div class="hero-badge">✨ ${slide.badge || 'EXCLUSIVE 2026'}</div>
          <h1 class="hero-heading">${escapeHTML(slide.heading)}</h1>
          <p class="hero-subheading">${escapeHTML(slide.subheading)}</p>
          <div class="hero-actions">
            <a href="${slide.buttonUrl || '#collection'}" class="btn-luxury-gold">${escapeHTML(slide.buttonText || 'SHOP COLLECTION')} →</a>
            <a href="https://wa.me/${cleanPhone(APP_STATE.whatsappNumber)}?text=Assalam-o-Alaikum%20Nurah%20by%20TY%20(Al%20Anwar%20Clothes)!%20I%20want%20to%20inquire%20about%20wholesale%20rates" target="_blank" class="btn-luxury-outline">WHOLESALE INQUIRY</a>
          </div>
        </div>
      </div>
    </div>
  `).join('');

  if (dotsContainer) {
    dotsContainer.innerHTML = APP_STATE.heroSlides.map((_, idx) => `
      <div class="hero-dot ${idx === 0 ? 'active' : ''}" onclick="goToHeroSlide(${idx})"></div>
    `).join('');
  }

  startHeroCarousel();
}

function startHeroCarousel() {
  clearInterval(APP_STATE.slideTimer);
  if (APP_STATE.heroSlides.length <= 1) return;

  APP_STATE.slideTimer = setInterval(() => {
    goToHeroSlide((APP_STATE.currentSlideIndex + 1) % APP_STATE.heroSlides.length);
  }, 6000);
}

window.goToHeroSlide = function(index) {
  const slides = document.querySelectorAll('.hero-slide');
  const dots = document.querySelectorAll('.hero-dot');
  if (!slides.length) return;

  slides.forEach((s, i) => s.classList.toggle('active', i === index));
  dots.forEach((d, i) => d.classList.toggle('active', i === index));
  APP_STATE.currentSlideIndex = index;
};

// 2. Categories Loading
async function loadCategories() {
  try {
    const res = await fetch('/api/categories');
    const data = await res.json();
    if (data.success && data.categories) {
      APP_STATE.categories = data.categories;
      renderCategoryNavbars();
      renderCollectionShowcase();
    }
  } catch (err) {
    console.error('Error loading categories:', err);
  }
}

function renderCategoryNavbars() {
  const desktopNav = document.getElementById('categoryNavList');
  const mobileNav = document.getElementById('mobileNavList');
  const filterChips = document.getElementById('filterChips');

  // Desktop categories
  if (desktopNav) {
    desktopNav.innerHTML = `
      <li class="category-nav-item ${APP_STATE.currentCategory === 'All' ? 'active' : ''}">
        <a href="#collection" onclick="filterByCategory('All')">All Fabrics</a>
      </li>
      ${APP_STATE.categories.map(c => `
        <li class="category-nav-item ${c.name === 'Sale' ? 'sale-link' : ''} ${APP_STATE.currentCategory === c.name ? 'active' : ''}">
          <a href="#collection" onclick="filterByCategory('${escapeHTML(c.name)}')">${escapeHTML(c.name)}</a>
        </li>
      `).join('')}
    `;
  }

  // Mobile categories
  if (mobileNav) {
    mobileNav.innerHTML = `
      <li class="mobile-nav-item">
        <a href="#collection" onclick="filterByCategory('All'); toggleMobileMenu(false);">✨ All Fabrics Collection</a>
      </li>
      ${APP_STATE.categories.map(c => `
        <li class="mobile-nav-item">
          <a href="#collection" onclick="filterByCategory('${escapeHTML(c.name)}'); toggleMobileMenu(false);">${c.emoji || '🧵'} ${escapeHTML(c.name)}</a>
        </li>
      `).join('')}
      <li class="mobile-nav-item" style="border-top: 1px solid var(--border-light); margin-top: 12px; padding-top: 8px;">
        <a href="https://wa.me/923363925950" target="_blank" style="color: #25d366; font-weight: 600;">💬 WhatsApp Helpline (03363925950)</a>
      </li>
    `;
  }

  // Filter chips above product grid
  if (filterChips) {
    filterChips.innerHTML = `
      <button class="filter-chip ${APP_STATE.currentCategory === 'All' ? 'active' : ''}" onclick="filterByCategory('All')">All</button>
      ${APP_STATE.categories.slice(0, 8).map(c => `
        <button class="filter-chip ${APP_STATE.currentCategory === c.name ? 'active' : ''}" onclick="filterByCategory('${escapeHTML(c.name)}')">${escapeHTML(c.name)}</button>
      `).join('')}
    `;
  }
}

function renderCollectionShowcase() {
  const grid = document.getElementById('collectionShowcaseGrid');
  if (!grid) return;

  const topCats = APP_STATE.categories.slice(0, 4);
  grid.innerHTML = topCats.map(c => `
    <div class="collection-card" onclick="filterByCategory('${escapeHTML(c.name)}'); scrollToSection('collection');">
      <div class="collection-emoji-art">${c.emoji || '👗'}</div>
      <h3 class="collection-name">${escapeHTML(c.name)}</h3>
      <div class="collection-meta">Explore Collection →</div>
    </div>
  `).join('');
}

// 3. Products Loading & Filtering
async function loadProducts() {
  try {
    const grid = document.getElementById('productGrid');
    if (grid) {
      grid.innerHTML = `<div style="grid-column: 1/-1; text-align: center; padding: 60px 0; color: var(--text-muted); font-size: 1.1rem;">Loading Nurah by TY Luxury Collections...</div>`;
    }

    let url = `/api/products?limit=60`;
    if (APP_STATE.currentCategory !== 'All') {
      url += `&category=${encodeURIComponent(APP_STATE.currentCategory)}`;
    }
    if (APP_STATE.searchQuery) {
      url += `&search=${encodeURIComponent(APP_STATE.searchQuery)}`;
    }

    const res = await fetch(url);
    const data = await res.json();
    if (data.success && data.products) {
      APP_STATE.products = data.products;
      renderProducts();
    }
  } catch (err) {
    console.error('Error loading products:', err);
  }
}

function renderProducts() {
  const grid = document.getElementById('productGrid');
  const countEl = document.getElementById('productCount');
  if (!grid) return;

  let sorted = [...APP_STATE.products];
  if (APP_STATE.sortBy === 'price_asc') sorted.sort((a, b) => (a.salePrice || a.retailPrice) - (b.salePrice || b.retailPrice));
  if (APP_STATE.sortBy === 'price_desc') sorted.sort((a, b) => (b.salePrice || b.retailPrice) - (a.salePrice || a.retailPrice));

  if (countEl) {
    countEl.textContent = `${sorted.length} Designs Available`;
  }

  if (sorted.length === 0) {
    grid.innerHTML = `
      <div style="grid-column: 1/-1; text-align: center; padding: 80px 20px;">
        <div style="font-size: 3.5rem; margin-bottom: 12px;">🧵</div>
        <h3 style="font-size: 1.6rem; margin-bottom: 8px;">No Fabrics Match Your Selection</h3>
        <p style="color: var(--text-muted); margin-bottom: 20px;">Try clearing search filters or choosing another category.</p>
        <button class="btn-luxury-gold" onclick="filterByCategory('All')">View All Collections</button>
      </div>
    `;
    return;
  }

  grid.innerHTML = sorted.map(product => {
    const isWishlisted = APP_STATE.wishlist.includes(product._id);
    const price = product.salePrice || product.retailPrice;
    const hasDiscount = product.salePrice && product.salePrice < product.retailPrice;
    const discountPercent = hasDiscount ? Math.round(((product.retailPrice - product.salePrice) / product.retailPrice) * 100) : 0;
    const isLowStock = product.stock > 0 && product.stock <= (product.lowStockThreshold || 5);
    const isOutOfStock = product.stock <= 0;

    return `
      <div class="product-card" data-id="${product._id}">
        <div class="product-frame">
          <div class="product-pattern-overlay"></div>
          <div class="product-badges">
            ${hasDiscount ? `<span class="badge-tag badge-sale">${discountPercent}% OFF</span>` : ''}
            ${product.badges && product.badges[0] ? `<span class="badge-tag badge-festive">${escapeHTML(product.badges[0])}</span>` : ''}
            ${isLowStock ? `<span class="badge-tag badge-stock-alert">Only ${product.stock} Left</span>` : ''}
            ${isOutOfStock ? `<span class="badge-tag" style="background:#495057;color:#fff;">Sold Out</span>` : ''}
          </div>

          <button class="wishlist-btn ${isWishlisted ? 'active' : ''}" onclick="toggleWishlist('${product._id}', event)" title="Wishlist">
            ${isWishlisted ? '❤️' : '🤍'}
          </button>

          ${(product.imageUrl || (product.images && product.images[0])) 
            ? `<img class="product-real-img" src="${product.imageUrl || product.images[0]}" alt="${escapeHTML(product.name)}" loading="lazy" onerror="this.onerror=null; this.parentElement.innerHTML='<div class=\\'product-emoji-art\\'>${product.emojiIcon || '👗'}</div>';">` 
            : `<div class="product-emoji-art">${product.emojiIcon || '👗'}</div>`
          }

          <div class="product-card-actions">
            <button class="btn-card-quickview" onclick="openProductQuickView('${product._id}')">Quick View</button>
          </div>
        </div>

        <div class="product-details">
          <div class="product-cat-sku">
            <span>${escapeHTML(product.category)}</span>
            <span>SKU: ${escapeHTML(product.sku)}</span>
          </div>

          <h4 class="product-name" onclick="openProductQuickView('${product._id}')">${escapeHTML(product.name)}</h4>

          <div class="product-fabric-meta">
            <span>🧵 ${escapeHTML(product.fabricType || 'Lawn')}</span>
            ${product.color ? `<span>• ${escapeHTML(product.color)}</span>` : ''}
          </div>

          <div class="product-pricing">
            <span class="price-current ${hasDiscount ? 'price-sale' : ''}">Rs. ${formatPKR(price)}</span>
            ${hasDiscount ? `<span class="price-original">Rs. ${formatPKR(product.retailPrice)}</span>` : ''}
            ${product.wholesalePrice ? `<span class="price-wholesale-tag">Wholesale: Rs. ${formatPKR(product.wholesalePrice)}</span>` : ''}
          </div>

          <div class="product-btn-group">
            <button class="btn-card-cart" onclick="addToCart('${product._id}', 1)" ${isOutOfStock ? 'disabled style="opacity:0.5"' : ''}>
              🛒 Add to Bag
            </button>
            <button class="btn-card-whatsapp" onclick="orderSingleProductWhatsApp('${product._id}')">
              💬 WhatsApp
            </button>
          </div>
        </div>
      </div>
    `;
  }).join('');
}

window.filterByCategory = function(category) {
  APP_STATE.currentCategory = category;
  renderCategoryNavbars();
  loadProducts();
};

window.sortBy = function(val) {
  APP_STATE.sortBy = val;
  renderProducts();
};

window.handleSearch = function(query) {
  APP_STATE.searchQuery = query;
  loadProducts();
};

// 4. Shopping Cart Drawer Logic
window.toggleCart = function(show) {
  const drawer = document.getElementById('cartDrawer');
  const overlay = document.getElementById('drawerOverlay');
  const isVisible = drawer.classList.contains('active');
  const target = show !== undefined ? show : !isVisible;

  drawer.classList.toggle('active', target);
  overlay.classList.toggle('active', target);
  if (target) renderCartItems();
};

window.addToCart = function(productId, qty = 1) {
  const product = APP_STATE.products.find(p => p._id === productId);
  if (!product) return;

  const existing = APP_STATE.cart.find(i => i.productId === productId);
  const currentQty = existing ? existing.quantity : 0;
  const newQty = currentQty + qty;

  if (product.stock && newQty > product.stock) {
    alert(`Only ${product.stock} suits available in stock for ${product.name}.`);
    return;
  }

  if (existing) {
    existing.quantity = newQty;
  } else {
    APP_STATE.cart.push({
      productId: product._id,
      sku: product.sku,
      name: product.name,
      fabricType: product.fabricType,
      emojiIcon: product.emojiIcon || '👗',
      price: product.salePrice || product.retailPrice,
      quantity: qty,
      stock: product.stock
    });
  }

  saveCart();
  updateCartBadge();
  toggleCart(true);
};

window.updateCartQty = function(productId, delta) {
  const item = APP_STATE.cart.find(i => i.productId === productId);
  if (!item) return;

  const newQty = item.quantity + delta;
  if (newQty <= 0) {
    window.removeFromCart(productId);
    return;
  }

  if (item.stock && newQty > item.stock) {
    alert(`Maximum available stock is ${item.stock} suits.`);
    return;
  }

  item.quantity = newQty;
  saveCart();
  renderCartItems();
  updateCartBadge();
};

window.removeFromCart = function(productId) {
  APP_STATE.cart = APP_STATE.cart.filter(i => i.productId !== productId);
  saveCart();
  renderCartItems();
  updateCartBadge();
};

function saveCart() {
  localStorage.setItem('al_anwar_cart', JSON.stringify(APP_STATE.cart));
}

function updateCartBadge() {
  const badge = document.getElementById('cartCountBadge');
  const totalItems = APP_STATE.cart.reduce((sum, i) => sum + i.quantity, 0);
  if (badge) {
    badge.textContent = totalItems;
    badge.style.display = totalItems > 0 ? 'flex' : 'none';
  }
}

function renderCartItems() {
  const body = document.getElementById('cartItemsBody');
  const subtotalEl = document.getElementById('cartSubtotal');
  const deliveryEl = document.getElementById('cartDeliveryFee');
  const grandTotalEl = document.getElementById('cartGrandTotal');
  const deliveryNoticeEl = document.getElementById('deliveryNotice');
  if (!body) return;

  if (APP_STATE.cart.length === 0) {
    body.innerHTML = `
      <div class="cart-empty-state">
        <div class="cart-empty-icon">🛍️</div>
        <h3>Your Shopping Bag is Empty</h3>
        <p style="margin-top: 8px;">Explore our unstitched lawn, festive chiffon & pure cotton collections.</p>
      </div>
    `;
    if (subtotalEl) subtotalEl.textContent = 'Rs. 0';
    if (deliveryEl) deliveryEl.textContent = 'Rs. 0';
    if (grandTotalEl) grandTotalEl.textContent = 'Rs. 0';
    if (deliveryNoticeEl) deliveryNoticeEl.textContent = 'Free Delivery nationwide on orders over Rs. 5,000.';
    return;
  }

  const subtotal = APP_STATE.cart.reduce((sum, i) => sum + (i.price * i.quantity), 0);
  const isFreeDelivery = subtotal >= APP_STATE.freeDeliveryThreshold;
  const delivery = isFreeDelivery ? 0 : APP_STATE.deliveryFee;
  const grandTotal = subtotal + delivery;

  body.innerHTML = APP_STATE.cart.map(item => `
    <div class="cart-item">
      <div class="cart-item-art">${item.emojiIcon || '👗'}</div>
      <div class="cart-item-info">
        <div class="cart-item-title">${escapeHTML(item.name)}</div>
        <div class="cart-item-price">Rs. ${formatPKR(item.price)}</div>
        <div class="cart-qty-ctrl">
          <button class="cart-qty-btn" onclick="updateCartQty('${item.productId}', -1)">-</button>
          <span class="cart-qty-val">${item.quantity}</span>
          <button class="cart-qty-btn" onclick="updateCartQty('${item.productId}', 1)">+</button>
        </div>
      </div>
      <button class="cart-item-remove" onclick="removeFromCart('${item.productId}')" title="Remove">✕</button>
    </div>
  `).join('');

  if (subtotalEl) subtotalEl.textContent = `Rs. ${formatPKR(subtotal)}`;
  if (deliveryEl) deliveryEl.textContent = isFreeDelivery ? 'FREE (Special Offer)' : `Rs. ${formatPKR(delivery)}`;
  if (grandTotalEl) grandTotalEl.textContent = `Rs. ${formatPKR(grandTotal)}`;
  if (deliveryNoticeEl) {
    if (isFreeDelivery) {
      deliveryNoticeEl.innerHTML = `🎉 <strong>Congratulations!</strong> You have qualified for FREE delivery across Pakistan.`;
    } else {
      const remaining = APP_STATE.freeDeliveryThreshold - subtotal;
      deliveryNoticeEl.innerHTML = `Add <strong>Rs. ${formatPKR(remaining)}</strong> more to get FREE Delivery!`;
    }
  }
}

// WhatsApp Order Generation
window.checkoutWhatsApp = function() {
  if (APP_STATE.cart.length === 0) {
    alert('Your shopping bag is empty.');
    return;
  }

  const subtotal = APP_STATE.cart.reduce((sum, i) => sum + (i.price * i.quantity), 0);
  const isFreeDelivery = subtotal >= APP_STATE.freeDeliveryThreshold;
  const delivery = isFreeDelivery ? 0 : APP_STATE.deliveryFee;
  const grandTotal = subtotal + delivery;

  let message = `*Assalam-o-Alaikum NURAH by TY / AL ANWAR CLOTHES!*\n`;
  message += `I would like to place an order for the following suits:\n\n`;
  message += `*ORDER ITEMS:*\n`;

  APP_STATE.cart.forEach((item, idx) => {
    message += `${idx + 1}. *${item.name}*\n`;
    message += `   - SKU: ${item.sku}\n`;
    message += `   - Qty: ${item.quantity} suit(s) @ Rs. ${formatPKR(item.price)}\n`;
    message += `   - Line Total: Rs. ${formatPKR(item.price * item.quantity)}\n\n`;
  });

  message += `*FINANCIAL SUMMARY:*\n`;
  message += `Subtotal: Rs. ${formatPKR(subtotal)}\n`;
  message += `Delivery Fee: ${isFreeDelivery ? 'FREE' : `Rs. ${formatPKR(delivery)}`}\n`;
  message += `*GRAND TOTAL: Rs. ${formatPKR(grandTotal)}*\n\n`;
  message += `Please confirm availability and share payment/delivery details for Karachi / Nationwide delivery.\n`;
  message += `Shop Address: Shop # M101/1, Iqbal Cloth Market, M.A Jinnah Road, Karachi.`;

  const cleanWa = cleanPhone(APP_STATE.whatsappNumber);
  const waUrl = `https://wa.me/${cleanWa}?text=${encodeURIComponent(message)}`;
  window.open(waUrl, '_blank');
};

window.orderSingleProductWhatsApp = function(productId) {
  const product = APP_STATE.products.find(p => p._id === productId);
  if (!product) return;

  const price = product.salePrice || product.retailPrice;
  let message = `*Assalam-o-Alaikum NURAH by TY / AL ANWAR CLOTHES!*\n\n`;
  message += `I am interested in ordering this unstitched suit:\n`;
  message += `*Product:* ${product.name}\n`;
  message += `*SKU:* ${product.sku}\n`;
  message += `*Category:* ${product.category}\n`;
  message += `*Fabric:* ${product.fabricType}\n`;
  message += `*Price:* Rs. ${formatPKR(price)}\n`;
  if (product.wholesalePrice) {
    message += `*Wholesale Rate:* Rs. ${formatPKR(product.wholesalePrice)} (for bulk/shop orders)\n`;
  }
  message += `\nPlease confirm available stock and delivery details.\n`;
  message += `Shop: Shop # M101/1, Iqbal Cloth Market, M.A Jinnah Road, Karachi.`;

  const cleanWa = cleanPhone(APP_STATE.whatsappNumber);
  window.open(`https://wa.me/${cleanWa}?text=${encodeURIComponent(message)}`, '_blank');
};

// 5. Quick View Modal
window.openProductQuickView = function(productId) {
  const product = APP_STATE.products.find(p => p._id === productId);
  if (!product) return;

  const modal = document.getElementById('quickViewModal');
  const body = document.getElementById('quickViewBody');
  if (!modal || !body) return;

  const price = product.salePrice || product.retailPrice;
  const hasDiscount = product.salePrice && product.salePrice < product.retailPrice;

  body.innerHTML = `
    <div class="modal-gallery">
      ${(product.imageUrl || (product.images && product.images[0]))
        ? `<img src="${product.imageUrl || product.images[0]}" alt="${escapeHTML(product.name)}" style="width:100%; height:100%; object-fit:cover; border-radius:var(--radius-sm);" onerror="this.onerror=null; this.parentElement.innerHTML='<div class=\\'modal-emoji-hero\\'>${product.emojiIcon || '👗'}</div>';">`
        : `<div class="modal-emoji-hero">${product.emojiIcon || '👗'}</div>`
      }
    </div>
    <div class="modal-details">
      <div class="product-cat-sku">
        <span>${escapeHTML(product.category)}</span>
        <span>SKU: ${escapeHTML(product.sku)}</span>
      </div>
      <h2 class="modal-product-name">${escapeHTML(product.name)}</h2>

      <div class="modal-pricing-box">
        <div class="modal-retail-price">Rs. ${formatPKR(price)} ${hasDiscount ? `<span style="font-size:1rem;color:var(--text-muted);text-decoration:line-through;margin-left:8px;">Rs. ${formatPKR(product.retailPrice)}</span>` : ''}</div>
        ${product.wholesalePrice ? `<div class="modal-wholesale-price">🏷️ Wholesale Rate: Rs. ${formatPKR(product.wholesalePrice)} (Available for Bulk / Retailers)</div>` : ''}
      </div>

      <p class="modal-desc">${escapeHTML(product.description || 'Premium luxury unstitched Pakistani designer fabric with exquisite digital print & embroidery.')}</p>

      <div style="font-size: 0.85rem; color: var(--text-secondary); margin-bottom: 20px;">
        <div><strong>Fabric:</strong> ${escapeHTML(product.fabricType || 'Lawn')}</div>
        ${product.color ? `<div><strong>Color:</strong> ${escapeHTML(product.color)}</div>` : ''}
        <div><strong>Stock Status:</strong> <span style="color: ${product.stock > 0 ? '#2b8a3e' : '#c92a2a'}; font-weight: 700;">${product.stock > 0 ? `In Stock (${product.stock} suits available)` : 'Sold Out'}</span></div>
      </div>

      <div class="modal-action-row">
        <button class="btn-luxury-gold" style="flex:1;" onclick="addToCart('${product._id}', 1); closeQuickView();" ${product.stock <= 0 ? 'disabled' : ''}>
          🛒 Add To Bag
        </button>
        <button class="btn-card-whatsapp" style="flex:1; padding: 12px;" onclick="orderSingleProductWhatsApp('${product._id}')">
          💬 Order on WhatsApp
        </button>
      </div>
    </div>
  `;

  modal.classList.add('active');
};

window.closeQuickView = function() {
  const modal = document.getElementById('quickViewModal');
  if (modal) modal.classList.remove('active');
};

// 6. Wishlist Management
window.toggleWishlist = function(productId, event) {
  if (event) event.stopPropagation();
  const idx = APP_STATE.wishlist.indexOf(productId);
  if (idx > -1) {
    APP_STATE.wishlist.splice(idx, 1);
  } else {
    APP_STATE.wishlist.push(productId);
  }
  localStorage.setItem('al_anwar_wishlist', JSON.stringify(APP_STATE.wishlist));
  updateWishlistBadge();
  renderProducts();
};

function updateWishlistBadge() {
  const badge = document.getElementById('wishlistCountBadge');
  if (badge) {
    badge.textContent = APP_STATE.wishlist.length;
    badge.style.display = APP_STATE.wishlist.length > 0 ? 'flex' : 'none';
  }
}

// 7. UI Listeners & Helpers
function initUIEventListeners() {
  // Mobile menu
  const hamburger = document.getElementById('hamburgerBtn');
  if (hamburger) {
    hamburger.addEventListener('click', () => toggleMobileMenu(true));
  }

  // Sticky header scroll detection
  window.addEventListener('scroll', () => {
    const header = document.querySelector('.main-header');
    if (header) {
      header.classList.toggle('scrolled', window.scrollY > 20);
    }
  });

  // Modal background close
  const modal = document.getElementById('quickViewModal');
  if (modal) {
    modal.addEventListener('click', (e) => {
      if (e.target === modal) closeQuickView();
    });
  }

  const overlay = document.getElementById('drawerOverlay');
  if (overlay) {
    overlay.addEventListener('click', () => {
      toggleCart(false);
      toggleMobileMenu(false);
    });
  }
}

window.toggleMobileMenu = function(show) {
  const drawer = document.getElementById('mobileNavDrawer');
  const overlay = document.getElementById('drawerOverlay');
  if (drawer && overlay) {
    drawer.classList.toggle('active', show);
    overlay.classList.toggle('active', show);
  }
};

window.scrollToSection = function(id) {
  const el = document.getElementById(id);
  if (el) el.scrollIntoView({ behavior: 'smooth' });
};

function formatPKR(num) {
  return Number(num || 0).toLocaleString('en-PK');
}

function cleanPhone(phone) {
  return String(phone || '').replace(/[^0-9]/g, '');
}

function escapeHTML(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

window.openProductQuickView = function(productId) {
  const product = APP_STATE.products.find(p => p._id === productId);
  if (!product) return;

  const modal = document.getElementById('quickViewModal');
  const body = document.getElementById('quickViewBody');
  if (!modal || !body) return;

  const price = product.salePrice || product.retailPrice;
  const hasDiscount = product.salePrice && product.salePrice < product.retailPrice;
  const discountPercent = hasDiscount ? Math.round(((product.retailPrice - product.salePrice) / product.retailPrice) * 100) : 0;
  const isOutOfStock = product.stock <= 0;

  const hasRealImg = Boolean(product.imageUrl || (product.images && product.images[0]));
  const mediaContent = hasRealImg 
    ? `<img src="${product.imageUrl || product.images[0]}" alt="${escapeHTML(product.name)}" style="width:100%; height:100%; object-fit:cover; border-radius:var(--radius-sm);">`
    : `<div class="modal-emoji-hero">${product.emojiIcon || '👗'}</div>`;

  body.innerHTML = `
    <button class="modal-close-btn" onclick="closeQuickView()">✕</button>
    <div class="modal-gallery">
      ${mediaContent}
    </div>
    <div class="modal-info">
      <div style="font-size:0.75rem; color:var(--color-gold-dark); text-transform:uppercase; font-weight:700; letter-spacing:1.5px; margin-bottom:6px;">
        ${escapeHTML(product.category)} • SKU: ${escapeHTML(product.sku)}
      </div>
      <h2 style="font-size:1.6rem; margin-bottom:12px; line-height:1.2;">${escapeHTML(product.name)}</h2>
      
      <div class="product-pricing" style="margin-bottom:16px;">
        <span class="price-current" style="font-size:1.4rem;">Rs. ${formatPKR(price)}</span>
        ${hasDiscount ? `<span class="price-original" style="font-size:1rem;">Rs. ${formatPKR(product.retailPrice)}</span>` : ''}
        ${hasDiscount ? `<span class="badge-tag badge-sale">${discountPercent}% OFF</span>` : ''}
        ${product.wholesalePrice ? `<span class="price-wholesale-tag" style="font-size:0.75rem;">Wholesale: Rs. ${formatPKR(product.wholesalePrice)}</span>` : ''}
      </div>

      <p style="color:var(--text-secondary); font-size:0.9rem; line-height:1.6; margin-bottom:20px;">
        ${escapeHTML(product.description || 'Premium luxury unstitched ensemble crafted with fine yarn from Karachi textile mills. Comes with authentic tags and wholesale packaging.')}
      </p>

      <div style="background:var(--bg-ivory); border:1px solid var(--border-light); border-radius:var(--radius-sm); padding:14px; margin-bottom:20px; font-size:0.82rem;">
        <div style="margin-bottom:6px;"><strong>Fabric Material:</strong> ${escapeHTML(product.fabricType || 'Lawn')}</div>
        ${product.color ? `<div style="margin-bottom:6px;"><strong>Color Tone:</strong> ${escapeHTML(product.color)}</div>` : ''}
        <div><strong>Availability:</strong> ${isOutOfStock ? '<span style="color:#c92a2a;font-weight:700;">Out of Stock</span>' : `<span style="color:#2b8a3e;font-weight:700;">In Stock (${product.stock} suits left)</span>`}</div>
      </div>

      <div style="display:flex; gap:10px; margin-top:auto;">
        <button class="btn-luxury-gold" style="flex:1; justify-content:center;" onclick="addToCart('${product._id}', 1); closeQuickView();" ${isOutOfStock ? 'disabled style="opacity:0.5"' : ''}>
          🛒 Add To Bag
        </button>
        <button class="btn-checkout-whatsapp" style="flex:1; justify-content:center;" onclick="orderSingleProductWhatsApp('${product._id}')">
          💬 Order on WhatsApp
        </button>
      </div>
    </div>
  `;

  modal.classList.add('active');
};

window.closeQuickView = function() {
  const modal = document.getElementById('quickViewModal');
  if (modal) modal.classList.remove('active');
};

