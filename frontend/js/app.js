// frontend/js/app.js
let allProducts = [];
let cart = [];
let bannerTimer = null;
let currentUser = JSON.parse(localStorage.getItem('storeUser')) || null; 
let currentPage = 1;
let currentCategory = 'all';

document.addEventListener('DOMContentLoaded', async () => {
    loadCartFromStorage();
    updateAuthUI(); 
    await loadGlobalSettings();
    loadAnnouncements(); 
    await loadBanners();
    await loadCategories(); 
    
    const urlParams = new URLSearchParams(window.location.search);
    const targetCategory = urlParams.get('category');
    
    if (targetCategory && targetCategory !== 'all') {
        const catBtn = document.querySelector(`.category-item[data-category="${targetCategory}"]`);
        if (catBtn) {
            const catName = catBtn.querySelector('span').textContent;
            filterByCategory(targetCategory, catName, catBtn);
        } else {
            await loadProducts(1, 'all');
        }
    } else {
        await loadProducts(1, 'all');
    }
    
    setupEventListeners();
    checkUrlAndOpenProduct();
});

async function loadGlobalSettings() {
    try {
        const res = await fetch(`${CONFIG.BASE_URL}/settings`);
        const data = await res.json();
        if (data.success && data.data) {
            if (data.data.defaultAdvanceAmount !== undefined) CONFIG.globalAdvancePayment = data.data.defaultAdvanceAmount;
            else if (data.data.defaultAdvancePayment !== undefined) CONFIG.globalAdvancePayment = data.data.defaultAdvancePayment;
            
            CONFIG.adminUpiId = data.data.upiId || '';
            CONFIG.adminQrCodeUrl = data.data.upiQrCodeUrl || data.data.qrCodeUrl || '';
            CONFIG.adminWhatsapp = data.data.whatsappNumber || ''; 

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
        const res = await fetch(`${CONFIG.BASE_URL}/settings`);
        const data = await res.json();
        if (data.success && data.data) {
            let messages = [];
            if (data.data.announcement1) messages.push(data.data.announcement1);
            if (data.data.announcement2) messages.push(data.data.announcement2);
            if (data.data.announcement3) messages.push(data.data.announcement3);

            if (messages.length > 0) {
                document.getElementById('announcement-bar').style.display = 'block';
                document.getElementById('marquee-text').innerHTML = messages.join(' &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp; 🔸 &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp; ');
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
    try {
        const res = await fetch(`${CONFIG.BASE_URL}/banners/active`);
        const data = await res.json();
        const banners = data.banners || data.data || [];
        if (data.success && banners.length > 0) {
            slider.innerHTML = banners.map((b) => `<div class="banner-slide" style="cursor: ${b.targetLink ? 'pointer' : 'default'};" onclick="${b.targetLink ? `window.location.href='${b.targetLink}'` : ''}"><img src="${b.imageUrl}" alt="Banner" /></div>`).join('');
            startBannerAutoScroll(banners.length);
        } else { slider.style.display = 'none'; }
    } catch (err) { slider.style.display = 'none'; }
}

function startBannerAutoScroll(totalSlides) {
    if (totalSlides <= 1) return;
    const slider = document.getElementById('bannerSlider');
    let index = 0;
    if (bannerTimer) clearInterval(bannerTimer);
    bannerTimer = setInterval(() => {
        index = (index + 1) % totalSlides;
        slider.scrollTo({ left: index * slider.clientWidth, behavior: 'smooth' });
    }, 3500);
}

async function loadCategories() {
    const container = document.getElementById('categoryList');
    if (!container) return;
    try {
        const res = await fetch(`${CONFIG.BASE_URL}/categories`);
        const data = await res.json();
        if (data.success && data.data) {
            container.innerHTML = `
                <div class="category-item active-cat" data-category="all" onclick="filterByCategory('all', 'All Products', this)">
        <div style="width: 100%; aspect-ratio: 1; background: transparent; display: flex; align-items: center; justify-content: center; border-radius: 30% 70% 70% 30% / 30% 30% 70% 70%; padding: 15px; margin-bottom: 8px;">
            <span style="font-size: 1.6rem; font-weight: 800; color: #64748b;">ALL</span>
        </div>
        <span>All</span>
    </div>`;
            data.data.forEach((cat) => {
                const imgUrl = cat.imageUrl || 'https://placehold.co/150';
                const div = document.createElement('div');
                div.className = 'category-item';
                div.dataset.category = cat._id;
                div.innerHTML = `<img src="${imgUrl}" alt="${cat.name}" /><span>${cat.name}</span>`;
                div.addEventListener('click', () => filterByCategory(cat._id, cat.name, div));
                container.appendChild(div);
            });
        }
    } catch (err) { console.error('Categories error:', err); }
}

async function loadProducts(page = 1, categoryId = 'all') {
    const grid = document.getElementById('productGrid');
    if (!grid) return;
    
    try {
        let url = `${CONFIG.BASE_URL}/products?page=${page}`;
        if (categoryId !== 'all') url += `&categoryId=${categoryId}`;

        // NEW: Loading Animation Logic - पहले पेज लोड पर सुंदर स्पिनर दिखाना
        if (page === 1) { 
            grid.innerHTML = `
                <div style="grid-column: 1/-1; display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 60px 20px;">
                    <i class="fas fa-spinner fa-spin" style="font-size: 2.5rem; color: #059669; margin-bottom: 15px;"></i>
                    <p style="font-size: 1rem; color: #64748b; font-weight: 600; letter-spacing: 0.5px;">Loading amazing products...</p>
                </div>
            `; 
        }

        const res = await fetch(url);
        const data = await res.json();

        if (data.success && (data.data || data.products)) {
            const fetchedProducts = data.data || data.products;
            if (page === 1) { 
                allProducts = fetchedProducts; 
                grid.innerHTML = ''; 
            } 
            else { 
                allProducts = [...allProducts, ...fetchedProducts]; 
            }
            
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
        } else if (page === 1) {
            grid.innerHTML = '<p style="grid-column: 1/-1; text-align: center; color: #64748b; padding: 40px 0;">No products found in this category.</p>';
            const loadMoreBtn = document.getElementById('loadMoreBtn');
            if (loadMoreBtn) loadMoreBtn.style.display = 'none';
        }
    } catch (err) { 
        if (page === 1) grid.innerHTML = '<p style="grid-column: 1/-1; text-align: center; color: #dc2626;">Unable to load products.</p>'; 
    }
}

function renderProductCards(products, isFirstPage = false) {
    const grid = document.getElementById('productGrid');
    if (!grid) return;
    if (isFirstPage && !products.length) { grid.innerHTML = '<p style="grid-column: 1/-1; text-align: center;">No products found.</p>'; return; }

    const htmlString = products.map((p) => {
        const img = p.thumbnailUrl || (p.images && p.images.length > 0 ? p.images[0] : (p.imageUrl || 'https://placehold.co/300'));
        // let actionButtonsHTML = p.inStock === false 
        //     ? `<div style="color: #dc2626; background: #fee2e2; border: 1px solid #f87171; font-weight: 700; text-align: center; padding: 8px; border-radius: 6px; margin-top: 10px; font-size: 1rem;">🚫 Out of Stock</div>` 
        //     : `<div class="card-actions">
        //       <button class="btn-add-cart" onclick="addToCart('${p._id}')">Add to Cart</button>
        //       <button class="btn-buy-now" onclick="buyNowSingle('${p._id}')">Buy Now</button>
        //     </div>`;
        let actionButtonsHTML = '';
        if (p.inStock === false) {
            actionButtonsHTML = `<div style="color: #dc2626; background: #fee2e2; border: 1px solid #f87171; font-weight: 700; text-align: center; padding: 8px; border-radius: 6px; margin-top: 10px; font-size: 1rem;">🚫 Out of Stock</div>`;
        } else {
            // नया लॉजिक: चेक करो कि क्या प्रोडक्ट में वेरिएंट्स हैं
            if (p.variants && p.variants.length > 0) {
                // अगर वेरिएंट हैं, तो सिर्फ 'Select Options' का बटन दिखाओ जो प्रोडक्ट पेज पर ले जाए
                actionButtonsHTML = `
                <div class="card-actions">
                  <button class="btn-buy-now" style="width: 100%; background: #0f172a; border-radius: 6px; color: #fff; padding: 8px; font-weight: 600; cursor: pointer; border: none;" onclick="window.location.href='product.html?id=${p._id}'">Select Options</button>
                </div>`;
            } else {
                // अगर सिंपल प्रोडक्ट है, तो दोनों बटन दिखाओ
                actionButtonsHTML = `
                <div class="card-actions">
                  <button class="btn-add-cart" onclick="window.addToCart('${p._id}')">Add to Cart</button>
                  <button class="btn-buy-now" onclick="window.buyNowSingle('${p._id}')">Buy Now</button>
                </div>`;
            }
        }

        return `
      <div class="product-card" style="border: 1px solid #e2e8f0; border-radius: 8px; padding: 12px; background: #fff; display: flex; flex-direction: column;">
        <div class="card-img-wrap" onclick="window.location.href='product.html?id=${p._id}'" style="height: 200px; display:flex; align-items:center; justify-content:center; overflow:hidden; cursor:pointer;">
          <img src="${img}" alt="${p.title}" loading="lazy" style="max-height: 100%; object-fit: contain;" />
        </div>
        <div class="card-body">
          <h3 class="card-title" onclick="window.location.href='product.html?id=${p._id}'" style="font-size: 1rem; margin: 8px 0; cursor:pointer;">${p.title}</h3>
          <div class="card-prices" style="margin-bottom: 8px;">
            <span class="sell-price" style="font-weight:700; color:#059669;">${CONFIG.CURRENCY}${p.price}</span>
            ${p.mrp ? `<span class="mrp-price" style="text-decoration: line-through; color: #94a3b8; font-size: 0.85rem; margin-left: 6px;">${CONFIG.CURRENCY}${p.mrp}</span>` : ''}
          </div>
          ${actionButtonsHTML}
        </div>
      </div>`;
    }).join('');

    if (isFirstPage) { grid.innerHTML = htmlString; } else { grid.innerHTML += htmlString; }
}

function filterByCategory(catId, catName, clickedBtn) {
    document.querySelectorAll('.category-item').forEach((b) => b.style.opacity = '0.5');
    clickedBtn.style.opacity = '1';
    
    const titleEl = document.getElementById('currentCategoryTitle');
    if (titleEl) {
        titleEl.textContent = catName;
        
        // NEW: Smooth Scroll Logic - पेज को प्रोडक्ट ग्रिड के टाइटेल तक ले जाने के लिए
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
    // नया: एडवांस अमाउंट सेट करना
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
            advance: advanceToUse // एडवांस को कार्ट में सेव कर दिया
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
      <div class="cart-item-row" style="display:flex; justify-content:space-between; align-items:center; margin-bottom:10px; padding-bottom:8px; border-bottom:1px solid #e2e8f0;">
        <div style="flex-grow: 1;">
          <h4 style="margin: 0; font-size: 0.9rem;">${item.title}</h4>
          <p style="margin: 2px 0; font-size: 0.8rem; color: #64748b;">₹${item.price} x ${item.quantity} = <strong>₹${itemTotal}</strong></p>
        </div>
        <div class="qty-controls" style="display:flex; gap:6px; align-items:center;">
          <button class="qty-btn" onclick="updateQuantity('${item.productId}', -1)">-</button>
          <span>${item.quantity}</span>
          <button class="qty-btn" onclick="updateQuantity('${item.productId}', 1)">+</button>
        </div>
      </div>
    `;
    }).join('');
    totalEl.textContent = `₹${total}`;
}

// 8. Direct URL Link Handler (Infinite Popup Bug Fixed)
function checkUrlAndOpenProduct() {
    const urlParams = new URLSearchParams(window.location.search);
    const targetProductId = urlParams.get('product');
    
    if (targetProductId) {
        // Yaha se Infinite Popup bug permanently fix ho gaya
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
}

function setupEventListeners() {
    document.getElementById('openCartBtn')?.addEventListener('click', () => { renderCartDrawer(); document.getElementById('cartModal').style.display = 'flex'; });
    document.getElementById('closeCartModal')?.addEventListener('click', () => { document.getElementById('cartModal').style.display = 'none'; });
    document.getElementById('cartCheckoutBtn')?.addEventListener('click', () => window.checkoutFromCart());

    document.getElementById('closeAccountModal')?.addEventListener('click', () => { document.getElementById('accountModal').style.display = 'none'; });
    document.getElementById('logoutBtn')?.addEventListener('click', () => {
        localStorage.removeItem('storeUser');
        currentUser = null;
        document.getElementById('accountModal').style.display = 'none';
        updateAuthUI();
        window.location.reload();
    });

    document.getElementById('trackOrderBtn')?.addEventListener('click', () => {
        document.getElementById('trackingModal').style.display = 'flex';
        document.getElementById('trackingLoginView').style.display = 'block';
        document.getElementById('forgotPwdView').style.display = 'none';
        document.getElementById('trackingOrdersView').style.display = 'none';
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

function displayOrders(orders) {
    document.getElementById('trackingLoginView').style.display = 'none';
    const ordersView = document.getElementById('trackingOrdersView');
    const container = document.getElementById('customerOrdersList');
    ordersView.style.display = 'block';

    if (!orders || orders.length === 0) { container.innerHTML = '<p style="font-size: 0.9rem; text-align: center; padding: 15px 0;">No previous orders found.</p>'; return; }

    container.innerHTML = orders.map(function (o) {
        const orderNum = o.orderId || (o._id ? o._id.slice(-6) : 'N/A');
        const paidAmt = o.amountToPayOnline !== undefined ? o.amountToPayOnline : (o.advancePaid || 0);
        const balAmt = o.remainingBalance !== undefined ? o.remainingBalance : 0;
        const courier = o.courierName || 'Courier';
        const trackingInfo = o.trackingId ? `<p style="font-size: 0.85rem; color: #1d4ed8; font-weight: 600; margin: 4px 0 0 0;">${courier} | Tracking: ${o.trackingId}</p>` : `<p style="font-size: 0.75rem; color: #94a3b8; margin: 4px 0 0 0;">Tracking details will appear here once dispatched.</p>`;

        return `<div style="border: 1px solid #e2e8f0; border-radius: 8px; padding: 12px; margin-bottom: 10px; background: #fff;">
                <div style="display: flex; justify-content: space-between; font-size: 0.85rem; font-weight: 700;"><span>Order #${orderNum}</span><span style="color: #059669;">${o.orderStatus}</span></div>
                <p style="font-size: 0.8rem; color: #64748b; margin: 4px 0;">Paid Online: ₹${paidAmt} | COD Balance: ₹${balAmt}</p>${trackingInfo}</div>`;
    }).join('');
}

// Send Batched Views & Likes to Server on Tab Close
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
// Update cart badge when user navigates back via browser back button
window.addEventListener('pageshow', (event) => {
    // event.persisted true hota hai jab page cache se load hota hai
    if (event.persisted) {
        loadCartFromStorage();
    }
});