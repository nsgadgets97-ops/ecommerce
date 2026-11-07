// frontend/js/app.js
let allProducts = [];
let cart = [];
let bannerTimer = null;
let currentUser = JSON.parse(localStorage.getItem('storeUser')) || null;
let currentPage = 1;
let currentCategory = 'all';
let searchQuery = '';

let isAllDataLoaded = false; // 🌟 NAYA FLAG

// --- API CACHING MASTER FUNCTION ---
async function fetchWithCache(url, cacheKey, ttlHours) {
    const cachedData = localStorage.getItem(cacheKey);
    const cacheTime = localStorage.getItem(cacheKey + '_time');
    const now = new Date().getTime();

    // Agar cache majood hai aur time bacha hai
    if (cachedData && cacheTime) {
        const ageInHours = (now - parseInt(cacheTime)) / (1000 * 60 * 60);
        if (ageInHours < ttlHours) {
            return JSON.parse(cachedData); // Bina API hit kiye seedha return kar do!
        }
    }

    // Agar cache expire ho gaya ya pehli baar website khuli hai
    try {
        const res = await fetch(url);
        const data = await res.json();
        // Caching successful response
        if (data.success || data.banners) {
            localStorage.setItem(cacheKey, JSON.stringify(data));
            localStorage.setItem(cacheKey + '_time', now.toString());
        }
        return data;
    } catch (err) {
        // Fallback: Agar net chala jaye ya server down ho, toh purana cache dikha do
        if (cachedData) return JSON.parse(cachedData);
        throw err;
    }
}

document.addEventListener('DOMContentLoaded', async () => {
    // --- INSTANT SEARCH OPEN LOGIC (पेज लोड होते ही सबसे पहले चलेगा) ---
    const urlParams = new URLSearchParams(window.location.search);
    const hasOpenSearch = urlParams.get('openSearch') === 'true';
    const hasSearchQuery = urlParams.get('q');
    
    if (hasOpenSearch || hasSearchQuery) {
        window.isSearchIntentFlag = true; // वीडियो को रोक देगा
        const searchPanel = document.getElementById('searchPanel');
        const searchInput = document.getElementById('productSearchInput');
        
        if (searchPanel) searchPanel.classList.add('open');
        if (searchInput) {
            if (hasSearchQuery) searchInput.value = hasSearchQuery;
            setTimeout(() => searchInput.focus(), 100);
        }
        
        // URL को तुरंत क्लीन कर दो ताकि रिफ्रेश करने पर नॉर्मल पेज खुले!
        if (hasOpenSearch) {
            window.history.replaceState({}, document.title, window.location.pathname);
        }
    }
    // -------------------------------------------------------------------
    loadCartFromStorage();
    updateAuthUI();
    await loadGlobalSettings();
    loadAnnouncements();
    loadBanners();
    loadCategories();

   
    const targetCategory = urlParams.get('category');

    if (targetCategory && targetCategory !== 'all') {
        const catBtn = document.querySelector(`.category-item[data-category="${targetCategory}"]`);
        if (catBtn) {
            const catName = catBtn.querySelector(':scope > span')?.textContent || catBtn.querySelector('span').textContent;
            filterByCategory(targetCategory, catName, catBtn);
        } else {
            loadProducts(1, 'all');
        }
    } else {
        loadProducts(1, 'all');
    }

    const urlSearch = urlParams.get('q');
    if (urlSearch) {
        searchQuery = urlSearch.trim();
        const searchInput = document.getElementById('productSearchInput');
        const searchPanel = document.getElementById('searchPanel');
        if (searchInput) searchInput.value = searchQuery;
        if (searchPanel) searchPanel.classList.add('open');
        applySearchFilter();
    }

    setupEventListeners();
    checkUrlAndOpenProduct();
});

async function loadGlobalSettings() {
    try {
        /*
         const currentUrlParams = new URLSearchParams(window.location.search);
const isSearchIntent = currentUrlParams.has('q') || currentUrlParams.has('openSearch');

if ((isReload || !isFromProductPage) && !isSearchIntent) {

        */
        // 2 Hours cache for Settings
        const data = await fetchWithCache(`${CONFIG.BASE_URL}/settings`, 'cache_settings', 2);
        
        if (data && data.success && data.data) {
            if (data.data.defaultAdvanceAmount !== undefined) CONFIG.globalAdvancePayment = data.data.defaultAdvanceAmount;
            else if (data.data.defaultAdvancePayment !== undefined) CONFIG.globalAdvancePayment = data.data.defaultAdvancePayment;

            CONFIG.adminUpiId = data.data.upiId || '';
            CONFIG.adminQrCodeUrl = data.data.upiQrCodeUrl || data.data.qrCodeUrl || '';
            CONFIG.adminWhatsapp = data.data.whatsappNumber || '';

            if (data.data.howToOrderVideoUrl) {
                const videoUrl = data.data.howToOrderVideoUrl;

                // --- NAYA ROBUST YOUTUBE URL EXTRACTOR ---
                let videoId = "";
                if (videoUrl.includes("youtu.be/")) {
                    videoId = videoUrl.split("youtu.be/")[1].split("?")[0];
                } else if (videoUrl.includes("watch?v=")) {
                    videoId = videoUrl.split("watch?v=")[1].split("&")[0];
                } else if (videoUrl.includes("shorts/")) {
                    videoId = videoUrl.split("shorts/")[1].split("?")[0];
                } else if (videoUrl.includes("embed/")) {
                    videoId = videoUrl.split("embed/")[1].split("?")[0];
                }

                const embedUrl = videoId ? `https://www.youtube.com/embed/${videoId}?playsinline=1` : videoUrl;
                const dynamicTitle = data.data.howToOrderTitle || 'How to Order';

                const navEntries = performance.getEntriesByType("navigation");
                const isReload = navEntries.length > 0 && navEntries[0].type === "reload";
                const isFromProductPage = document.referrer.includes('product.html');


                const currentUrlParams = new URLSearchParams(window.location.search);
                
                const isSearchIntent = currentUrlParams.has('q') || currentUrlParams.has('openSearch');
                

               // if (isReload || !isFromProductPage) {
               if ((isReload || !isFromProductPage) && window.isSearchIntentFlag !== true) {
               // if ((isReload || !isFromProductPage) && !isSearchIntent){
                    const titleEl = document.getElementById('autoVideoTitle');
                    if (titleEl) {
                        titleEl.innerText = dynamicTitle;
                    }

                    const container = document.getElementById('autoVideoIframeContainer');
                    if (container) {
                        container.style.position = 'relative';
                        container.style.paddingBottom = '56.25%'; // 16:9 Aspect Ratio
                        container.style.height = '0';
                        container.style.overflow = 'hidden';

                        container.innerHTML = `<iframe style="position: absolute; top: 0; left: 0; width: 100%; height: 100%; border: none;" src="${embedUrl}" title="YouTube video player" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen></iframe>`;
                    }

                    document.getElementById('autoVideoModal').style.display = 'flex';
                }
            }

            const waBtn = document.getElementById('floatingWaBtn');
            if (waBtn && CONFIG.adminWhatsapp) {
                let cleanPhone = String(CONFIG.adminWhatsapp).replace(/\D/g, '');
                if (cleanPhone.length === 10) cleanPhone = '91' + cleanPhone;
                waBtn.href = `https://wa.me/${cleanPhone}?text=Need%20Help%20with%20a%20product`;
                waBtn.style.display = 'flex';
            }
        }
    } catch (err) { console.error('Settings load error:', err); }
}

async function loadAnnouncements() {
    try {
        // 2 Hours cache for Announcements (Uses the same settings cache)
        const data = await fetchWithCache(`${CONFIG.BASE_URL}/settings`, 'cache_settings', 2);
        
        if (data && data.success && data.data) {
            let messages = [];
            if (data.data.announcement1) messages.push(data.data.announcement1);
            if (data.data.announcement2) messages.push(data.data.announcement2);
            if (data.data.announcement3) messages.push(data.data.announcement3);

            if (messages.length > 0) {
                const bar = document.getElementById('announcement-bar');
                const textEl = document.getElementById('announcement-text') || document.getElementById('marquee-text');
                if (bar && textEl) {
                    bar.style.display = 'block';
                    const separator = '&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp; <i class="fas fa-bolt" style="color: #fde047; font-size: 0.8rem; margin: 0 4px;"></i> &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;';
                    textEl.innerHTML = messages.join(separator);
                }
            }
        }
    } catch (err) { console.error("Announcement load error:", err); }
}

function updateAuthUI() {
    const authBtn = document.getElementById('navAuthBtn');
    if (!authBtn) return;
    if (currentUser && currentUser.phone) {
        authBtn.textContent = currentUser.name ? `Hi, ${currentUser.name.split(' ')[0]}` : 'My Account';
        authBtn.onclick = () => {
            document.getElementById('accPhone').textContent = currentUser.phone;
            document.getElementById('accName').textContent = currentUser.name || 'Not provided yet';
            document.getElementById('accountModal').style.display = 'flex';
        };
    } else {
        authBtn.textContent = 'Login';
        authBtn.onclick = () => {
            document.getElementById('trackingModal').style.display = 'flex';
            document.getElementById('trackingLoginView').style.display = 'block';
            document.getElementById('forgotPwdView').style.display = 'none';
            document.getElementById('trackingOrdersView').style.display = 'none';
        };
    }
}

async function loadBanners() {
    const slider = document.getElementById('bannerSlider');
    if (!slider) return;

    // Skeleton Show Karo
    slider.innerHTML = Array(2).fill(`
        <div class="banner-slide skeleton" style="border-radius: 12px; aspect-ratio: 16/9; background-color: #e2e8f0; border: none;"></div>
    `).join('');
    slider.style.display = 'flex';
    if (slider.parentElement) slider.parentElement.style.display = 'block';

    try {
        // 2 Hours cache for Banners
        const data = await fetchWithCache(`${CONFIG.BASE_URL}/banners/active`, 'cache_banners', 2);
        const banners = data.banners || data.data || [];

        if (data && data.success && banners.length > 0) {
            slider.innerHTML = banners.map((b) => {
                let clickAction = '';
                let pointerStyle = 'default';

                if (b.targetLink) {
                    pointerStyle = 'pointer';
                    let finalUrl = '';
                    if (b.targetLink.includes('http') || b.targetLink.includes('.html')) {
                        finalUrl = b.targetLink;
                    } else {
                        finalUrl = `product.html?id=${b.targetLink}`;
                    }
                    clickAction = `onclick="window.location.href='${finalUrl}'"`;
                }

                return `<div class="banner-slide" style="cursor: ${pointerStyle};" ${clickAction}><img src="${b.imageUrl}" alt="Banner" /></div>`;
            }).join('');
            startBannerAutoScroll(banners.length);
        }
    } catch (err) {
        console.warn('Banner server is down, keeping skeleton visible.');
    }
}

function startBannerAutoScroll(totalSlides) {
    if (totalSlides <= 1) return;
    const slider = document.getElementById('bannerSlider');
    if (!slider) return;

    let index = 0;
    if (bannerTimer) clearInterval(bannerTimer);

    bannerTimer = setInterval(() => {
        const slide = slider.querySelector('.banner-slide');
        if (!slide) return;

        const slideWidth = slide.clientWidth + 12;
        const visibleSlides = Math.round(slider.clientWidth / slide.clientWidth);
        const maxIndex = totalSlides - visibleSlides;

        index++;
        if (index > maxIndex) {
            index = 0; 
        }
        slider.scrollTo({ left: index * slideWidth, behavior: 'smooth' });
    }, 3500); 
}

async function loadCategories() {
    const container = document.getElementById('categoryList');
    if (!container) return;
    container.innerHTML = Array(6).fill(`
        <div class="category-item" style="pointer-events: none;">
            <div class="category-thumb skeleton" style="border: none;"></div>
            <div class="skeleton" style="height: 12px; width: 50px; border-radius: 4px; margin: 4px auto 0;"></div>
        </div>
    `).join('');
    try {
        // 20 Hours cache for Categories
        const data = await fetchWithCache(`${CONFIG.BASE_URL}/categories`, 'cache_categories', 20);
        
        if (data && data.success && data.data) {
            container.innerHTML = `
                <div class="category-item active-cat" data-category="all" onclick="filterByCategory('all', 'All Products', this)">
                    <div class="category-thumb"><span style="font-size: 0.85rem; font-weight: 800; color: #64748b;">ALL</span></div>
                    <span>All</span>
                </div>`;
            data.data.forEach((cat) => {
                const imgUrl = cat.imageUrl || 'https://placehold.co/150';
                const div = document.createElement('div');
                div.className = 'category-item';
                div.dataset.category = cat._id;
                div.innerHTML = `<div class="category-thumb"><img src="${imgUrl}" alt="${cat.name}" /></div><span>${cat.name}</span>`;
                div.addEventListener('click', () => filterByCategory(cat._id, cat.name, div));
                container.appendChild(div);
            });
        }
    } catch (err) { console.error('Categories error:', err); }
}

window.closeAutoVideoModal = function () {
    document.getElementById('autoVideoModal').style.display = 'none';
    document.getElementById('autoVideoIframeContainer').innerHTML = ''; 
};

async function loadProducts(page = 1, categoryId = 'all') {
    const grid = document.getElementById('productGrid');
    if (!grid) return;

    try {
        const sortVal = document.getElementById('frontendSortSelect')?.value || 'default';

        let url = `${CONFIG.BASE_URL}/products?page=${page}`;
        if (categoryId !== 'all') url += `&categoryId=${categoryId}`;

        if (searchQuery) url += `&search=${encodeURIComponent(searchQuery)}`;
        if (sortVal && sortVal !== 'default') url += `&sort=${sortVal}`;

        if (page === 1) {
            grid.innerHTML = Array(8).fill(`
                <div class="skeleton-card">
                    <div class="skeleton skel-img"></div>
                    <div class="skel-body">
                        <div class="skeleton skel-title"></div>
                        <div class="skeleton skel-price"></div>
                        <div class="skel-btn-group">
                            <div class="skeleton skel-btn"></div>
                            <div class="skeleton skel-btn"></div>
                        </div>
                    </div>
                </div>
            `).join('');
        }

        await new Promise(resolve => setTimeout(resolve, 1000));

        const res = await fetch(url);
        const data = await res.json();

        if (data.success && (data.data || data.products)) {
            const fetchedProducts = data.data || data.products;
            if (page === 1) {
                allProducts = fetchedProducts;
                grid.innerHTML = '';
            } else {
                allProducts = [...allProducts, ...fetchedProducts];
            }
            
            isAllDataLoaded = !data.hasMore;
            renderProductCards(fetchedProducts, page === 1);

            let loadMoreBtn = document.getElementById('loadMoreBtn');
            if (!loadMoreBtn) {
                loadMoreBtn = document.createElement('button');
                loadMoreBtn.id = 'loadMoreBtn';
                loadMoreBtn.className = 'btn-secondary';
                loadMoreBtn.textContent = 'Load More Products ⬇';
                loadMoreBtn.style.margin = '20px auto';
                loadMoreBtn.style.display = 'block';
                loadMoreBtn.onclick = () => loadProducts(currentPage + 1, currentCategory);
                grid.parentNode.insertBefore(loadMoreBtn, grid.nextSibling);
            }
            if (data.hasMore) {
                loadMoreBtn.style.display = 'block';
                currentPage = page;
            } else {
                if (loadMoreBtn) loadMoreBtn.style.display = 'none';
            }
        }
    } catch (err) {
        console.warn('Products server is down, keeping skeleton visible.');
    }
}

function getVisibleProducts(products) {
    return products; 
}

function applySearchFilter() {
    const bannerSection = document.querySelector('.banner-wrap');
    const categorySection = document.querySelector('.category-section');
    const titleEl = document.getElementById('currentCategoryTitle');

    if (searchQuery.trim().length > 0) {
        if (bannerSection) bannerSection.style.display = 'none';
        if (categorySection) categorySection.style.display = 'none';
        if (titleEl) titleEl.innerText = `Search Results for "${searchQuery}"`;
    } else {
        if (bannerSection) bannerSection.style.display = 'block';
        if (categorySection) categorySection.style.display = 'block';
        const activeCatBtn = document.querySelector('.category-item.active-cat');
        const catName = activeCatBtn ? (activeCatBtn.querySelector(':scope > span')?.textContent || activeCatBtn.querySelector('span').textContent) : 'All Products';
        if (titleEl) titleEl.innerText = catName;
    }

    currentPage = 1;
    loadProducts(1, currentCategory);
}

function renderProductCards(products, isFirstPage = false) {
    const grid = document.getElementById('productGrid');
    if (!grid) return;
    if (isFirstPage && !products.length) {
        grid.innerHTML = `<p style="grid-column: 1/-1; text-align: center; color: #64748b; padding: 40px 0;">${searchQuery ? 'No products match your search.' : 'No products found.'}</p>`;
        return;
    }

    const htmlString = products.map((p) => {
        const img = p.thumbnailUrl || (p.images && p.images.length > 0 ? p.images[0] : (p.imageUrl || 'https://placehold.co/300'));
        const discount = p.mrp && Number(p.mrp) > Number(p.price)
            ? Math.round((1 - Number(p.price) / Number(p.mrp)) * 100)
            : 0;
        let actionButtonsHTML = '';
        if (p.inStock === false) {
            actionButtonsHTML = `<div class="out-of-stock">Out of Stock</div>`;
        } else if (p.variants && p.variants.length > 0) {
            actionButtonsHTML = `
                <div class="card-actions">
                  <button class="btn-select-options" onclick="window.location.href='product.html?id=${p._id}'">Select Options</button>
                </div>`;
        } else {
            actionButtonsHTML = `
                <div class="card-actions">
                  <button class="btn-add-cart" onclick="window.addToCart('${p._id}')">Add to Cart</button>
                  <button class="btn-buy-now" onclick="window.buyNowSingle('${p._id}')">Buy Now</button>
                </div>`;
        }

        return `
      <div class="product-card">
        <div class="card-img-wrap" onclick="window.location.href='product.html?id=${p._id}'">
          ${discount > 0 ? `<span class="discount-badge">${discount}% OFF</span>` : ''}
          <img src="${img}" alt="${p.title}" loading="lazy" />
        </div>
        <div class="card-body">
          <h3 class="card-title" onclick="window.location.href='product.html?id=${p._id}'">${p.title}</h3>
          <div class="card-prices">
            <span class="sell-price">${CONFIG.CURRENCY}${p.price}</span>
            ${p.mrp ? `<span class="mrp-price">${CONFIG.CURRENCY}${p.mrp}</span>` : ''}
          </div>
          ${actionButtonsHTML}
        </div>
      </div>`;
    }).join('');

    if (isFirstPage) { grid.innerHTML = htmlString; } else { grid.innerHTML += htmlString; }
}

function filterByCategory(catId, catName, clickedBtn) {
    document.querySelectorAll('.category-item').forEach((b) => b.classList.remove('active-cat'));
    if (clickedBtn) clickedBtn.classList.add('active-cat');

    const titleEl = document.getElementById('currentCategoryTitle');
    if (titleEl) {
        titleEl.textContent = catName;
        titleEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }

    const newUrl = catId === 'all' ? window.location.pathname : `?category=${catId}`;
    window.history.pushState({ path: newUrl }, '', newUrl);

    currentCategory = catId;
    currentPage = 1;
    loadProducts(1, catId);
}

function loadCartFromStorage() {
    const saved = localStorage.getItem('user_cart');
    if (saved) { try { cart = JSON.parse(saved); } catch (e) { cart = []; } }
    updateCartBadge();
}

function saveCartToStorage() {
    localStorage.setItem('user_cart', JSON.stringify(cart));
    updateCartBadge();
}

function updateCartBadge() {
    const badge = document.getElementById('cartCount');
    if (badge) badge.textContent = cart.reduce((acc, item) => acc + item.quantity, 0);
}

function addToCart(productId, customTitle = null, customPrice = null, customImage = null, customAdvance = null) {
    const p = allProducts.find((item) => item._id === productId);

    const titleToUse = customTitle || (p ? p.title : 'Product');
    const priceToUse = customPrice || (p ? p.price : 0);
    const imageToUse = customImage || (p && p.images && p.images.length ? p.images[0] : (p ? p.imageUrl : 'https://placehold.co/60'));
    const advanceToUse = customAdvance !== null ? customAdvance : (p && p.advancePayment !== undefined ? p.advancePayment : null);

    if (!p && !customTitle) return;

    const existing = cart.find((item) => item.productId === productId && item.title === titleToUse);

    if (existing) {
        existing.quantity += 1;
    } else {
        cart.push({
            productId: productId,
            title: titleToUse,
            price: Number(priceToUse),
            quantity: 1,
            image: imageToUse,
            advance: advanceToUse 
        });
    }

    saveCartToStorage();
    if (typeof renderCartDrawer === 'function') renderCartDrawer();
    alert(`${titleToUse} added to cart!`);
}
window.addSingleToCart = addToCart;

function updateQuantity(productId, delta) {
    const item = cart.find((i) => i.productId === productId);
    if (!item) return;
    item.quantity += delta;
    if (item.quantity <= 0) { cart = cart.filter((i) => i.productId !== productId); }
    saveCartToStorage();
    renderCartDrawer();
}

function renderCartDrawer() {
    const list = document.getElementById('cartItemsList');
    const totalEl = document.getElementById('cartTotalPrice');
    if (!list || !totalEl) return;
    if (cart.length === 0) { list.innerHTML = '<p style="text-align: center; color: #64748b; padding: 20px 0;">Your cart is empty.</p>'; totalEl.textContent = '₹0'; return; }
    let total = 0;
    list.innerHTML = cart.map((item) => {
        const itemTotal = item.price * item.quantity;
        total += itemTotal;
        return `
      <div class="cart-item-row">
        <div style="flex-grow: 1;">
          <h4 style="margin: 0; font-size: 0.9rem;">${item.title}</h4>
          <p style="margin: 2px 0; font-size: 0.8rem; color: #64748b;">₹${item.price} x ${item.quantity} = <strong>₹${itemTotal}</strong></p>
        </div>
        <div class="qty-controls">
          <button class="qty-btn" onclick="updateQuantity('${item.productId}', -1)">-</button>
          <span>${item.quantity}</span>
          <button class="qty-btn" onclick="updateQuantity('${item.productId}', 1)">+</button>
        </div>
      </div>
    `;
    }).join('');
    totalEl.textContent = `₹${total}`;
}

function checkUrlAndOpenProduct() {
    const urlParams = new URLSearchParams(window.location.search);
    const targetProductId = urlParams.get('product');

    if (targetProductId) {
        window.history.replaceState({}, document.title, window.location.pathname);

        const found = allProducts.find((p) => p._id === targetProductId);
        if (found) { window.buyNowSingle(targetProductId); }
        else {
            fetch(`${CONFIG.BASE_URL}/products/${targetProductId}`)
                .then((res) => res.json())
                .then((data) => {
                    const product = data.data || data.product;
                    if (product) { allProducts.push(product); window.buyNowSingle(product._id); }
                }).catch((err) => console.log('Target product not found:', err));
        }
    }
    // NAYA LOGIC: Agar track page se search karne aaye hain, toh panel open kar do
    
}

function setupEventListeners() {
    const searchToggle = document.getElementById('searchToggleBtn');
    const searchPanel = document.getElementById('searchPanel');
    const searchInput = document.getElementById('productSearchInput');
    const searchClear = document.getElementById('searchClearBtn');

    searchToggle?.addEventListener('click', (e) => {
        e.stopPropagation();
        if (!searchPanel) return;
        searchPanel.classList.toggle('open');
        if (searchPanel.classList.contains('open')) searchInput?.focus();
    });
    let searchDebounceTimer; // Timer variable

    searchInput?.addEventListener('input', () => {
        // Puraana timer clear karo agar user l लगातार type kar raha hai
        clearTimeout(searchDebounceTimer);
        
        searchDebounceTimer = setTimeout(() => {
            const value = searchInput.value.trim();
            if (!document.getElementById('productGrid')) {
                return;
            }
            searchQuery = value;
            applySearchFilter();
        }, 400); // 400 milliseconds ka smart delay
    });
    searchInput?.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            const value = searchInput.value.trim();
            if (!document.getElementById('productGrid')) {
                window.location.href = value ? `index.html?q=${encodeURIComponent(value)}` : 'index.html';
                return;
            }
            searchQuery = value;
            applySearchFilter();
        }
    });
   document.getElementById('frontendSortSelect')?.addEventListener('change', handleSortChange);

    searchClear?.addEventListener('click', () => {
        if (searchInput) searchInput.value = '';
        searchQuery = '';
        if (searchPanel) searchPanel.classList.remove('open');
        if (!document.getElementById('productGrid')) {
            window.location.href = 'index.html';
            return;
        }
        applySearchFilter();
    });

    document.addEventListener('click', (e) => {
        if (!searchPanel || !searchPanel.classList.contains('open')) return;
        if (!e.target.closest('.search-wrap')) searchPanel.classList.remove('open');
    });

    document.getElementById('openCartBtn')?.addEventListener('click', () => { renderCartDrawer(); document.getElementById('cartModal').style.display = 'flex'; });
    document.getElementById('closeCartModal')?.addEventListener('click', () => { document.getElementById('cartModal').style.display = 'none'; });
    document.getElementById('cartModal')?.addEventListener('click', (e) => {
        if (e.target.id === 'cartModal') document.getElementById('cartModal').style.display = 'none';
    });
    document.getElementById('cartCheckoutBtn')?.addEventListener('click', () => window.checkoutFromCart());

    document.getElementById('closeAccountModal')?.addEventListener('click', () => { document.getElementById('accountModal').style.display = 'none'; });
    document.getElementById('logoutBtn')?.addEventListener('click', () => {
        localStorage.removeItem('storeUser');
        currentUser = null;
        document.getElementById('accountModal').style.display = 'none';
        updateAuthUI();
        window.location.reload();
    });

    document.getElementById('trackOrderBtn')?.addEventListener('click', async () => {
        document.getElementById('trackingModal').style.display = 'flex';

        if (currentUser && currentUser.phone) {
            document.getElementById('trackingLoginView').style.display = 'none';
            document.getElementById('forgotPwdView').style.display = 'none';
            document.getElementById('trackingOrdersView').style.display = 'block';
            document.getElementById('customerOrdersList').innerHTML = '<p style="text-align: center; padding: 20px;">Fetching your orders...</p>';

            try {
                const res = await fetch(`${CONFIG.BASE_URL}/orders/track/${currentUser.phone}`);
                const data = await res.json();
                if (data.success) {
                    displayOrders(data.orders);
                } else {
                    document.getElementById('customerOrdersList').innerHTML = '<p style="color: #dc2626; text-align: center;">No orders found.</p>';
                }
            } catch (err) {
                document.getElementById('customerOrdersList').innerHTML = '<p style="color: #dc2626; text-align: center;">Network error while fetching orders.</p>';
            }
        } else {
            document.getElementById('trackingLoginView').style.display = 'block';
            document.getElementById('forgotPwdView').style.display = 'none';
            document.getElementById('trackingOrdersView').style.display = 'none';
        }
    });

    document.getElementById('closeTrackingModal')?.addEventListener('click', () => { document.getElementById('trackingModal').style.display = 'none'; });
    document.getElementById('showForgotPwdBtn')?.addEventListener('click', (e) => { e.preventDefault(); document.getElementById('trackingLoginView').style.display = 'none'; document.getElementById('forgotPwdView').style.display = 'block'; });
    document.getElementById('backToLoginBtn')?.addEventListener('click', (e) => { e.preventDefault(); document.getElementById('forgotPwdView').style.display = 'none'; document.getElementById('trackingLoginView').style.display = 'block'; });

    document.getElementById('forgotPwdForm')?.addEventListener('submit', async (e) => {
        e.preventDefault();
        const phone = document.getElementById('fpPhone').value.trim();
        const pincode = document.getElementById('fpPincode').value.trim();
        const newPassword = document.getElementById('fpNewPwd').value.trim();
        try {
            const res = await fetch(`${CONFIG.BASE_URL}/orders/customer/forgot-password`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ phone, pincode, newPassword })
            });
            const data = await res.json();
            alert(data.message);
            if (data.success) {
                document.getElementById('forgotPwdView').style.display = 'none';
                document.getElementById('trackingLoginView').style.display = 'block';
            }
        } catch (err) { alert('Error resetting password. Check network connection.'); }
    });

    document.getElementById('customerLoginForm')?.addEventListener('submit', async (e) => { e.preventDefault(); await handleCustomerLogin(); });
}

async function handleCustomerLogin() {
    const phone = document.getElementById('trackPhone').value.trim();
    const password = document.getElementById('trackPassword').value.trim();
    try {
        const res = await fetch(`${CONFIG.BASE_URL}/orders/customer/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ phone, password }) });
        const data = await res.json();
        if (data.success) {
            currentUser = { phone: phone, password: password };
            fetch(`${CONFIG.BASE_URL}/orders/customer/verify-address`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ phone, password }) })
                .then(r => r.json()).then(resData => {
                    if (resData.success && resData.data) {
                        currentUser.name = resData.data.name;
                        if (resData.data.address) {
                            currentUser.address = resData.data.address.address; currentUser.city = resData.data.address.city;
                            currentUser.state = resData.data.address.state; currentUser.pincode = resData.data.address.pincode;
                        }
                    }
                    localStorage.setItem('storeUser', JSON.stringify(currentUser));
                    updateAuthUI();
                }).catch(() => { localStorage.setItem('storeUser', JSON.stringify(currentUser)); updateAuthUI(); });

            displayOrders(data.orders);
        } else { alert(data.message || 'Invalid Phone or Password!'); }
    } catch (err) { alert('Login error! Please check network.'); }
}


// Order Card Expand/Collapse Logic
window.toggleOrderDetails = function(orderId) {
    const detailsDiv = document.getElementById('order-details-' + orderId);
    const icon = document.getElementById('icon-' + orderId);
    
    if (detailsDiv.style.display === 'none' || detailsDiv.style.display === '') {
        detailsDiv.style.display = 'block';
        if(icon) icon.style.transform = 'rotate(180deg)'; // Arrow up
    } else {
        detailsDiv.style.display = 'none';
        if(icon) icon.style.transform = 'rotate(0deg)'; // Arrow down
    }
};
function displayOrders(orders) {
    document.getElementById('trackingLoginView').style.display = 'none';
    const ordersView = document.getElementById('trackingOrdersView');
    const container = document.getElementById('customerOrdersList');
    ordersView.style.display = 'block';

    if (!orders || orders.length === 0) {
        container.innerHTML = '<p style="font-size: 0.95rem; text-align: center; padding: 25px 0; color: #64748b;">No previous orders found.</p>';
        return;
    }

    container.innerHTML = orders.map(function (o) {
        const orderNum = o.orderId || (o._id ? o._id.slice(-6) : 'N/A');
        const paidAmt = o.amountToPayOnline !== undefined ? o.amountToPayOnline : 0;
        const balAmt = o.remainingBalance !== undefined ? o.remainingBalance : 0;
        const totalOrderValue = paidAmt + balAmt; // Summary me dikhane ke liye
        const courier = o.courierName || 'Courier';
        const trackId = o.trackingId || '';

        // Status Logic & Colors
        const statusLevels = {
            'Screenshot Pending': 0, 'Pending': 1, 'Accepted': 2,
            'Packed': 3, 'Dispatched': 4, 'Delivered': 5, 'RTO': -1
        };
        const currentLevel = statusLevels[o.orderStatus] !== undefined ? statusLevels[o.orderStatus] : 1;

        // Dynamic Badge Colors
        let badgeBg = '#eff6ff'; let badgeColor = '#2563eb'; // Default Blue (Pending/Accepted)
        if (o.orderStatus === 'Screenshot Pending') {
            badgeBg = '#fee2e2'; badgeColor = '#dc2626'; // RED (Action Required)
        } else if (o.orderStatus === 'Delivered') {
            badgeBg = '#d1fae5'; badgeColor = '#059669'; // GREEN (Completed)
        } else if (o.orderStatus === 'RTO') {
            badgeBg = '#fecaca'; badgeColor = '#991b1b'; // DARK RED
        } else if (currentLevel >= 3) {
            badgeBg = '#fef3c7'; badgeColor = '#b45309'; // ORANGE (Packed/Dispatched)
        }

        // Stepper HTML
        let stepperHtml = '';
        if (currentLevel === -1) {
            stepperHtml = `<div style="color: #dc2626; font-weight: 700; text-align: center; padding: 12px; background: #fee2e2; border-radius: 8px; margin-bottom: 15px;">↩ Order Returned (RTO)</div>`;
        } else {
            stepperHtml = `
            <div class="track-stepper">
                <div class="step ${currentLevel >= 1 ? 'completed' : (currentLevel === 0 ? 'active' : '')}">
                    <div class="circle">${currentLevel > 1 ? '✓' : '1'}</div><div class="label">Placed</div>
                    <span class="step-help">${currentLevel === 0 ? 'Awaiting Payment' : 'Order Received'}</span>
                </div>
                <div class="step ${currentLevel >= 2 ? 'completed' : (currentLevel === 1 ? 'active' : '')}">
                    <div class="circle">${currentLevel > 2 ? '✓' : '2'}</div><div class="label">Confirmed</div><span class="step-help">Preparing</span>
                </div>
                <div class="step ${currentLevel >= 3 ? 'completed' : (currentLevel === 2 ? 'active' : '')}">
                    <div class="circle">${currentLevel > 3 ? '✓' : '3'}</div><div class="label">Packed</div><span class="step-help">Ready</span>
                </div>
                <div class="step ${currentLevel >= 4 ? 'completed' : (currentLevel === 3 ? 'active' : '')}">
                    <div class="circle">${currentLevel > 4 ? '✓' : '4'}</div><div class="label">Shipped</div><span class="step-help">${currentLevel >= 4 ? 'In transit' : 'Waiting'}</span>
                </div>
                <div class="step ${currentLevel === 5 ? 'completed' : (currentLevel === 4 ? 'active' : '')}">
                    <div class="circle">5</div><div class="label">Delivered</div>
                </div>
            </div>`;
        }

        // Products List HTML
        const productsHtml = (o.products && o.products.length > 0) ? o.products.map(p => `
            <div class="track-item">
                <div style="flex: 1; padding-right: 10px;">
                    <strong style="color:#0f172a;">${p.title}</strong><br>
                    <small style="color:#64748b; font-weight: 600;">Qty: ${p.quantity || 1} × ₹${p.price}</small>
                </div>
                <div style="font-weight: 800; color: #334155;">₹${p.price * (p.quantity || 1)}</div>
            </div>
        `).join('') : '<p style="font-size:0.8rem; color:#64748b;">No product details found.</p>';

        // Actions (WhatsApp / Tracking ID)
        let actionHtml = '';
        if (o.orderStatus === 'Screenshot Pending') {
             let cleanPhone = CONFIG.adminWhatsapp ? String(CONFIG.adminWhatsapp).replace(/\D/g, '') : '';
             if (cleanPhone.length === 10) cleanPhone = '91' + cleanPhone;
             const waUrl = `https://wa.me/${cleanPhone}?text=${encodeURIComponent(`Hello! I have paid ₹${paidAmt} for Order ID: ${orderNum}. Here is my payment screenshot.`)}`;
             
             actionHtml = `
             <div style="padding: 12px; background: #fffbeb; border: 1px solid #fde68a; border-radius: 8px; margin-top: 15px; text-align: center;">
                 <p style="font-size: 0.8rem; color: #b45309; font-weight: 700; margin-bottom: 10px;">Action Required: Payment Screenshot Pending!</p>
                 <button onclick="processWhatsAppRedirect(this, '${waUrl}', '${o._id}', '${o.customerPhone}')" class="btn-primary" style="width: 100%; background: #25D366; font-size: 0.9rem; padding: 10px;">
                     💬 Send Screenshot Now
                 </button>
             </div>`;
        } else if (currentLevel >= 4 && trackId) {
             actionHtml = `
             <div style="margin-top: 15px; padding: 12px; background: #eff6ff; border: 1px solid #bfdbfe; border-radius: 8px; font-size: 0.9rem; display: flex; justify-content: space-between; align-items: center;">
                 <div><span style="color: #64748b; font-size: 0.75rem;">Courier Partner</span><br><strong>${courier}</strong></div>
                 <div style="text-align: right;"><span style="color: #64748b; font-size: 0.75rem;">Tracking ID</span><br><strong style="color:#1d4ed8;">${trackId}</strong></div>
             </div>`;
        }

        // ================= FINAL ACCORDION CARD =================
        return `
        <div class="track-card">
            <!-- 1. SUMMARY VIEW (Always Visible, Clickable) -->
            <div onclick="toggleOrderDetails('${orderNum}')" style="cursor: pointer; padding: 16px; display: flex; justify-content: space-between; align-items: center; background: #fff; transition: background 0.2s;">
                <div style="flex: 1;">
                    <strong style="color: #0f172a; font-size: 1rem;">${orderNum}</strong><br>
                    <span style="font-size: 0.75rem; color: #64748b; font-weight: 600;">${new Date(o.createdAt).toLocaleDateString('en-IN')} • Total: ₹${totalOrderValue}</span>
                </div>
                <div style="display: flex; align-items: center; gap: 10px;">
                    <span style="background: ${badgeBg}; color: ${badgeColor}; padding: 5px 10px; border-radius: 20px; font-size: 0.72rem; font-weight: 800; border: 1px solid ${badgeColor}33; text-transform: uppercase;">
                        ${o.orderStatus}
                    </span>
                    <i id="icon-${orderNum}" class="fas fa-chevron-down" style="color: #94a3b8; font-size: 1.1rem; transition: transform 0.3s ease;"></i>
                </div>
            </div>

            <!-- 2. DETAILED VIEW (Hidden by default) -->
            <div id="order-details-${orderNum}" style="display: none; border-top: 1px solid #f1f5f9; background: #fdfdfd;">
                <div class="track-body">
                    ${stepperHtml}
                    <h4 style="font-size: 0.85rem; color: #64748b; text-transform: uppercase; margin: 20px 0 10px; border-bottom: 2px solid #f1f5f9; padding-bottom: 4px;">Order Details</h4>
                    ${productsHtml}
                    <div class="track-payment">
                        <div style="display:flex; justify-content:space-between; margin-bottom:6px;">
                            <span style="color: #065f46;">Paid Online:</span> <strong style="color: #065f46;">₹${paidAmt}</strong>
                        </div>
                        <div style="display:flex; justify-content:space-between; color:#b45309; font-size: 0.95rem; border-top: 1px dashed #bbf7d0; padding-top: 6px; margin-top: 4px;">
                            <span>To Pay (COD):</span> <strong>₹${balAmt}</strong>
                        </div>
                    </div>
                    ${actionHtml}
                </div>
            </div>
        </div>`;
    }).join('');
}

window.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') {
        const views = JSON.parse(sessionStorage.getItem('session_views')) || [];
        const likes = JSON.parse(sessionStorage.getItem('session_likes')) || [];

        if (views.length > 0 || likes.length > 0) {
            const payload = JSON.stringify({ views, likes });
            const blob = new Blob([payload], { type: 'application/json' });
            navigator.sendBeacon(`${CONFIG.BASE_URL}/products/batch-interaction`, blob);
            sessionStorage.removeItem('session_views');
            sessionStorage.removeItem('session_likes');
        }
    }
});

window.addEventListener('pageshow', (event) => {
    if (event.persisted) {
        loadCartFromStorage();
    }
});

window.openVideoModal = function (embedUrl, title) {
    document.getElementById('videoModalTitle').innerText = title;
    document.getElementById('videoIframeContainer').innerHTML = `<iframe width="100%" height="100%" src="${embedUrl}?autoplay=1" frameborder="0" allow="autoplay; encrypted-media" allowfullscreen></iframe>`;
    document.getElementById('videoModal').style.display = 'flex';
};

window.closeVideoModal = function () {
    document.getElementById('videoModal').style.display = 'none';
    document.getElementById('videoIframeContainer').innerHTML = ''; 
};

function handleSortChange() {
    const sortVal = document.getElementById('frontendSortSelect')?.value || 'default';
    
    if (isAllDataLoaded) {
        let sortedVisible = [...allProducts];
        
        if (sortVal === 'priceLowHigh') {
            sortedVisible.sort((a, b) => Number(a.price) - Number(b.price));
        } else if (sortVal === 'priceHighLow') {
            sortedVisible.sort((a, b) => Number(b.price) - Number(a.price));
        } else if (sortVal === 'nameAZ') {
            sortedVisible.sort((a, b) => (a.title || '').localeCompare(b.title || ''));
        } else if (sortVal === 'nameZA') {
            sortedVisible.sort((a, b) => (b.title || '').localeCompare(a.title || ''));
        } else {
            sortedVisible.sort((a, b) => {
                const pA = a.priority || 0;
                const pB = b.priority || 0;
                if (pB !== pA) return pB - pA;
                return new Date(b.createdAt || 0) - new Date(a.createdAt || 0); 
            });
        }
        renderProductCards(sortedVisible, true);
    } else {
        currentPage = 1;
        loadProducts(1, currentCategory);
    }
}